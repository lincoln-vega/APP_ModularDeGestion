import type { CierreCaja, Movimiento, Negocio, Producto } from "../api/client";

export const DB_NAME = "gestion_offline_db";
export const DB_VERSION = 2;

export interface ColaSyncItemLocal {
  id: string; // UUID v4 único e idempotente
  negocio_id: number;
  entidad: string; // ej. "movimiento", "producto"
  payload: Record<string, unknown>;
  fecha_creacion: string; // ISO 8601
  estado: "pendiente" | "sincronizando" | "error";
  error_detalle?: string | null;
  reintentos?: number;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está soportado en este entorno."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store 'productos' (caché de catálogo local)
      if (!db.objectStoreNames.contains("productos")) {
        const productosStore = db.createObjectStore("productos", { keyPath: "id" });
        productosStore.createIndex("negocio_id", "negocio_id", { unique: false });
      }

      // 2. Store 'negocios' (caché de metadatos y configuración)
      if (!db.objectStoreNames.contains("negocios")) {
        db.createObjectStore("negocios", { keyPath: "id" });
      }

      // 3. Store 'cola_sync' (cola de ventas y movimientos offline)
      if (!db.objectStoreNames.contains("cola_sync")) {
        const syncStore = db.createObjectStore("cola_sync", { keyPath: "id" });
        syncStore.createIndex("negocio_id", "negocio_id", { unique: false });
        syncStore.createIndex("estado", "estado", { unique: false });
        syncStore.createIndex("fecha_creacion", "fecha_creacion", { unique: false });
      }

      // 4. Store 'movimientos' (caché persistente local de ventas y servicios)
      if (!db.objectStoreNames.contains("movimientos")) {
        const movStore = db.createObjectStore("movimientos", { keyPath: "id" });
        movStore.createIndex("negocio_id", "negocio_id", { unique: false });
        movStore.createIndex("fecha", "fecha", { unique: false });
      }

      // 5. Store 'cierres_caja' (caché persistente de cierres de caja)
      if (!db.objectStoreNames.contains("cierres_caja")) {
        const cierresStore = db.createObjectStore("cierres_caja", { keyPath: "id" });
        cierresStore.createIndex("negocio_id", "negocio_id", { unique: false });
        cierresStore.createIndex("fecha_inicio", "fecha_inicio", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn("IndexedDB bloqueado: cierre otras pestañas abiertas con la app.");
    };
  });

  return dbPromise;
}

// --- PRODUCTOS CACHE ---

export async function saveProductosCache(negocioId: number, productos: Producto[]): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("productos", "readwrite");
    const store = tx.objectStore("productos");

    for (const prod of productos) {
      // Aseguramos que el negocio_id esté presente
      store.put({ ...prod, negocio_id: negocioId });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProductosCache(negocioId: number): Promise<Producto[]> {
  const db = await getDB();
  return new Promise<Producto[]>((resolve, reject) => {
    const tx = db.transaction("productos", "readonly");
    const store = tx.objectStore("productos");
    const index = store.index("negocio_id");
    const request = index.getAll(IDBKeyRange.only(negocioId));

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getProductoCache(productoId: number): Promise<Producto | undefined> {
  const db = await getDB();
  return new Promise<Producto | undefined>((resolve, reject) => {
    const tx = db.transaction("productos", "readonly");
    const store = tx.objectStore("productos");
    const request = store.get(productoId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProductoCache(producto: Producto): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("productos", "readwrite");
    const store = tx.objectStore("productos");
    store.put(producto);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProductoCache(productoId: number): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("productos", "readwrite");
    const store = tx.objectStore("productos");
    store.delete(productoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Descuenta o suma stock de manera optimista en la base de datos local.
 * Delta negativo (ej. -1) descuenta una venta offline, delta positivo repone.
 */
export async function actualizarStockOptimista(
  _negocioId: number,
  productoId: number,
  delta: number,
): Promise<Producto | null> {
  const db = await getDB();
  return new Promise<Producto | null>((resolve, reject) => {
    const tx = db.transaction("productos", "readwrite");
    const store = tx.objectStore("productos");
    const request = store.get(productoId);

    request.onsuccess = () => {
      const prod: Producto | undefined = request.result;
      if (!prod) {
        resolve(null);
        return;
      }
      const nuevoStock = Math.max(0, (prod.stock_actual ?? 0) + delta);
      const prodActualizado: Producto = {
        ...prod,
        stock_actual: nuevoStock,
      };
      store.put(prodActualizado);
      resolve(prodActualizado);
    };

    request.onerror = () => reject(request.error);
  });
}

// --- NEGOCIOS CACHE ---

export async function saveNegocioCache(negocio: Negocio): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("negocios", "readwrite");
    const store = tx.objectStore("negocios");
    store.put(negocio);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveNegociosCache(negocios: Negocio[]): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("negocios", "readwrite");
    const store = tx.objectStore("negocios");
    for (const n of negocios) {
      store.put(n);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getNegocioCache(negocioId: number): Promise<Negocio | undefined> {
  const db = await getDB();
  return new Promise<Negocio | undefined>((resolve, reject) => {
    const tx = db.transaction("negocios", "readonly");
    const store = tx.objectStore("negocios");
    const request = store.get(negocioId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listNegociosCache(): Promise<Negocio[]> {
  const db = await getDB();
  return new Promise<Negocio[]>((resolve, reject) => {
    const tx = db.transaction("negocios", "readonly");
    const store = tx.objectStore("negocios");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// --- MOVIMIENTOS CACHE (HISTORIAL DE VENTAS Y SERVICIOS) ---

export async function saveMovimientosCache(negocioId: number, movimientos: Movimiento[]): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("movimientos", "readwrite");
    const store = tx.objectStore("movimientos");
    for (const m of movimientos) {
      store.put({ ...m, negocio_id: negocioId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMovimientoCache(mov: Movimiento): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("movimientos", "readwrite");
    const store = tx.objectStore("movimientos");
    store.put(mov);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMovimientosCache(negocioId: number): Promise<Movimiento[]> {
  const db = await getDB();
  return new Promise<Movimiento[]>((resolve, reject) => {
    const tx = db.transaction("movimientos", "readonly");
    const store = tx.objectStore("movimientos");
    const index = store.index("negocio_id");
    const request = index.getAll(IDBKeyRange.only(negocioId));

    request.onsuccess = () => {
      const results: Movimiento[] = request.result || [];
      results.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMovimientoCache(id: number): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("movimientos", "readwrite");
    const store = tx.objectStore("movimientos");
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- CIERRES DE CAJA CACHE ---

export async function saveCierresCajaCache(negocioId: number, cierres: CierreCaja[]): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cierres_caja", "readwrite");
    const store = tx.objectStore("cierres_caja");
    for (const c of cierres) {
      store.put({ ...c, negocio_id: negocioId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCierresCajaCache(negocioId: number): Promise<CierreCaja[]> {
  const db = await getDB();
  return new Promise<CierreCaja[]>((resolve, reject) => {
    const tx = db.transaction("cierres_caja", "readonly");
    const store = tx.objectStore("cierres_caja");
    const index = store.index("negocio_id");
    const request = index.getAll(IDBKeyRange.only(negocioId));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// --- COLA DE SINCRONIZACIÓN (OFFLINE QUEUE) ---

export async function encolarSyncItem(
  item: Omit<ColaSyncItemLocal, "id" | "fecha_creacion" | "estado"> & {
    id?: string;
    fecha_creacion?: string;
    estado?: "pendiente" | "sincronizando" | "error";
  },
): Promise<ColaSyncItemLocal> {
  const db = await getDB();
  const itemCompleto: ColaSyncItemLocal = {
    id: item.id || generateUUID(),
    negocio_id: item.negocio_id,
    entidad: item.entidad,
    payload: item.payload,
    fecha_creacion: item.fecha_creacion || new Date().toISOString(),
    estado: item.estado || "pendiente",
    error_detalle: null,
    reintentos: 0,
  };

  return new Promise<ColaSyncItemLocal>((resolve, reject) => {
    const tx = db.transaction("cola_sync", "readwrite");
    const store = tx.objectStore("cola_sync");
    store.put(itemCompleto);
    tx.oncomplete = () => resolve(itemCompleto);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getColaSync(negocioId?: number): Promise<ColaSyncItemLocal[]> {
  const db = await getDB();
  return new Promise<ColaSyncItemLocal[]>((resolve, reject) => {
    const tx = db.transaction("cola_sync", "readonly");
    const store = tx.objectStore("cola_sync");
    let request: IDBRequest;

    if (negocioId !== undefined) {
      const index = store.index("negocio_id");
      request = index.getAll(IDBKeyRange.only(negocioId));
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const results: ColaSyncItemLocal[] = request.result || [];
      // Orden cronológico FIFO
      results.sort(
        (a, b) =>
          new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime(),
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getColaSyncCount(negocioId?: number): Promise<number> {
  const items = await getColaSync(negocioId);
  return items.length;
}

export async function actualizarSyncItemEstado(
  id: string,
  estado: "pendiente" | "sincronizando" | "error",
  errorDetalle?: string | null,
): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cola_sync", "readwrite");
    const store = tx.objectStore("cola_sync");
    const request = store.get(id);

    request.onsuccess = () => {
      const item: ColaSyncItemLocal | undefined = request.result;
      if (!item) {
        resolve();
        return;
      }
      item.estado = estado;
      if (errorDetalle !== undefined) {
        item.error_detalle = errorDetalle;
      }
      if (estado === "error") {
        item.reintentos = (item.reintentos || 0) + 1;
      }
      store.put(item);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function eliminarSyncItem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cola_sync", "readwrite");
    const store = tx.objectStore("cola_sync");
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function eliminarSyncItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cola_sync", "readwrite");
    const store = tx.objectStore("cola_sync");
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function limpiarColaSync(negocioId?: number): Promise<void> {
  const items = await getColaSync(negocioId);
  const ids = items.map((i) => i.id);
  await eliminarSyncItems(ids);
}
