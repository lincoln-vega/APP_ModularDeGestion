// Único punto de acceso a la API — evita `fetch` suelto desperdigado por
// los componentes, así headers, manejo de errores y base URL quedan en un
// solo lugar. Los tipos de acá siguen docs/openapi.yaml al pie de la letra;
// si el backend cambia una forma de respuesta, este archivo se actualiza
// junto con el contrato, no antes.

import {
  actualizarStockOptimista,
  deleteMovimientoCache,
  deleteProductoCache,
  eliminarSyncItem,
  encolarSyncItem,
  generateUUID,
  getCierresCajaCache,
  getColaSync,
  getMovimientosCache,
  getNegocioCache,
  getProductosCache,
  saveCierresCajaCache,
  saveMovimientoCache,
  saveMovimientosCache,
  saveNegocioCache,
  saveProductoCache,
  saveProductosCache,
} from "../lib/offlineStore";
import { syncManager } from "../lib/syncManager";

const BASE_URL = import.meta.env.VITE_API_URL;

// --- sesión: token en localStorage + aviso global cuando el backend
// rechaza por 401. Es un módulo plano (no un componente), así que no
// puede usar useNavigate directo — quien quiera reaccionar a un 401
// (típicamente el AuthProvider, que sí vive dentro del Router) se
// suscribe con onUnauthorized.
const TOKEN_KEY = "gestion:token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage puede fallar (modo privado, cuota) — no hay mucho más
    // que hacer, la sesión simplemente no persiste entre recargas.
  }
}

type UnauthorizedListener = () => void;
let unauthorizedListeners: UnauthorizedListener[] = [];

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.push(listener);
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((l) => l !== listener);
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Se arma con Headers en vez de un spread de objetos para no perder
  // Content-Type cuando el caller manda sus propios headers (ej. Authorization).
  const headers = new Headers({ "Content-Type": "application/json" });
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !path.startsWith("/auth/login")) {
    // Token ausente, vencido o inválido — se limpia y se avisa; el
    // AuthProvider decide qué hacer (redirigir a /login), acá no se sabe
    // de rutas. No se ejecuta en /auth/login para no desloguear llamadas legítimas.
    setToken(null);
    unauthorizedListeners.forEach((listener) => listener());
  }

  if (!res.ok) {
    const body = await res.text();
    let detail: unknown;
    try {
      detail = body ? JSON.parse(body) : undefined;
    } catch {
      detail = body;
    }
    // FastAPI devuelve errores simples como {"detail": "mensaje humano"} —
    // si el body sigue esa forma, .message queda con el texto limpio en
    // vez del JSON crudo. Los 409 con detail estructurado (candidatos de
    // duplicado, stock bajo mínimo) no matchean esto y caen al body tal
    // cual, pero esos ya se manejan por su propia subclase de error, no
    // leyendo .message.
    const message =
      detail && typeof detail === "object" && typeof (detail as { detail?: unknown }).detail === "string"
        ? (detail as { detail: string }).detail
        : body || res.statusText;
    throw new ApiError(res.status, message, detail);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

function json(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}

function jsonPatch(body: unknown): RequestInit {
  return { method: "PATCH", body: JSON.stringify(body) };
}

// --- tipos: reflejan components/schemas de docs/openapi.yaml ---
// Los montos llegan como string (Decimal en el backend, no float) —
// ver ../lib/format.ts para mostrarlos/editarlos.

export interface Negocio {
  id: number;
  nombre: string;
  rubro: string;
  modulos_activos: Record<string, unknown>;
  plan_estado: string;
  fecha_ultimo_pago: string | null;
  link_sunat: string | null;
  modulo_rus_activo: boolean;
}

export interface NegocioCreate {
  nombre: string;
  rubro: string;
  modulos_activos?: Record<string, unknown>;
  plan_estado?: string;
  fecha_ultimo_pago?: string | null;
  link_sunat?: string | null;
  modulo_rus_activo?: boolean;
  usuario_inicial?: {
    nombre: string;
    rol: string;
    username: string;
    password?: string;
  };
}
export type NegocioUpdate = Partial<Omit<Negocio, "id">>;

export interface Usuario {
  id: number;
  negocio_id: number | null;
  nombre: string;
  rol: string;
  username?: string;
  activo?: boolean;
}

export interface UsuarioCreate {
  nombre: string;
  rol: string;
  username: string;
  password?: string;
}

export interface UsuarioUpdate {
  nombre?: string;
  rol?: string;
  password?: string;
  activo?: boolean;
}

export interface Producto {
  id: number;
  negocio_id: number;
  nombre: string;
  medida: string | null;
  marca: string | null;
  estado_uso: string | null;
  precio_lista: string;
  precio_compra: string;
  clasificacion: string | null;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
}

export interface ProductoCreate {
  nombre: string;
  medida?: string | null;
  marca?: string | null;
  estado_uso?: string | null;
  precio_lista?: string;
  precio_compra?: string;
  clasificacion?: string | null;
  stock_actual?: number;
  stock_minimo?: number;
  activo?: boolean;
}

export interface ProductoUpdate {
  nombre?: string | null;
  medida?: string | null;
  marca?: string | null;
  estado_uso?: string | null;
  precio_lista?: string | null;
  precio_compra?: string | null;
  clasificacion?: string | null;
  stock_actual?: number | null;
  stock_minimo?: number | null;
  activo?: boolean | null;
}

export interface ProductoCandidatoDuplicado {
  id: number;
  nombre: string;
  medida: string | null;
  marca: string | null;
}

export class ProductoDuplicadoError extends ApiError {
  public candidatos: ProductoCandidatoDuplicado[];
  constructor(status: number, message: string, detail: unknown) {
    super(status, message, detail);
    this.name = "ProductoDuplicadoError";
    const d = detail as { candidatos?: ProductoCandidatoDuplicado[] } | undefined;
    this.candidatos = d?.candidatos ?? [];
  }
}

export interface ClienteVehiculo {
  id: number;
  negocio_id: number;
  nombre_cliente: string;
  telefono: string | null;
  placa: string | null;
  marca_vehiculo: string | null;
  modelo_vehiculo: string | null;
  tipo_aceite: string | null;
  intervalo_meses: number | null;
  fecha_ultimo_servicio: string | null;
  /** La calcula el servidor a partir de fecha_ultimo_servicio +
   * intervalo_meses — nunca se manda al crear/editar. */
  fecha_proximo_mantenimiento: string | null;
  activo: boolean;
}

export interface Movimiento {
  id: number;
  negocio_id: number;
  usuario_id: number;
  producto_id: number;
  cliente_vehiculo_id: number | null;
  tipo: string;
  cantidad: number;
  descripcion: string | null;
  precio_lista: string;
  precio_final: string;
  monto_capital: number;
  metodo_pago: string | null;
  fecha: string;
  _sync_pendiente?: boolean;
}

export type MovimientoCreate = Omit<Movimiento, "id" | "negocio_id" | "monto_capital" | "cantidad"> & {
  cantidad?: number;
  monto_capital?: number | null;
};

export interface CierreCaja {
  id: number;
  negocio_id: number;
  periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_bruto: string;
  total_capital: string;
  total_ganancia: string;
  total_efectivo: string;
  total_digital: string;
}

export interface CierreCajaCreate {
  periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
}

/** Registro auditado (feed de SUNAT) — requiere modulo_rus_activo. Para
 * una corrección simple sin ese rastro está ajustarStock más abajo. */
export interface RegistroCompra {
  id: number;
  negocio_id: number;
  producto_id: number;
  cantidad: number;
  costo_unitario: string;
  fecha: string;
}

export interface RegistroCompraCreate {
  producto_id: number;
  cantidad: number;
  costo_unitario: string;
  fecha?: string | null;
}

/** Se lanza cuando el backend responde 409 a una venta que deja el stock
 * bajo el mínimo — el flujo debe mostrar el modal de confirmación y
 * reintentar con confirmarBajoMinimo: true. */
export class StockBajoMinimoError extends ApiError {}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  rol: string;
  negocio_id: number | null;
  nombre: string;
  usuario_id: number;
}

export interface ColaSyncItem {
  id: string;
  entidad: string;
  payload: Record<string, unknown>;
  fecha_creacion: string;
}

export interface ColaSyncResultado {
  id: string;
  estado: "aplicado" | "error" | "duplicado";
  detalle: string | null;
}

/**
 * Encola un movimiento en la base de datos local (IndexedDB) cuando no hay conexión,
 * realiza el descuento optimista de stock y retorna el movimiento generado.
 */
async function procesarMovimientoOffline(
  negocioId: number,
  payload: MovimientoCreate,
): Promise<Movimiento> {
  const uuid = generateUUID();
  const fecha = payload.fecha || new Date().toISOString();

  // 1. Encolar en IndexedDB
  await encolarSyncItem({
    id: uuid,
    negocio_id: negocioId,
    entidad: "movimiento",
    payload: {
      usuario_id: payload.usuario_id,
      producto_id: payload.producto_id,
      cliente_vehiculo_id: payload.cliente_vehiculo_id ?? null,
      tipo: payload.tipo,
      descripcion: payload.descripcion ?? null,
      precio_lista: payload.precio_lista,
      precio_final: payload.precio_final,
      monto_capital: payload.monto_capital ?? null,
      metodo_pago: payload.metodo_pago ?? null,
      fecha: fecha,
    },
    fecha_creacion: fecha,
    estado: "pendiente",
  });

  const cant = payload.cantidad && payload.cantidad > 0 ? payload.cantidad : 1;

  // 2. Descontar stock local optimista si es venta
  if (payload.tipo === "venta" || payload.monto_capital !== null) {
    try {
      await actualizarStockOptimista(negocioId, payload.producto_id, -cant);
    } catch (e) {
      console.warn("No se pudo descontar stock local optimista:", e);
    }
  }

  // 3. Notificar al syncManager para actualizar badges y estado
  syncManager.notifyItemQueued(negocioId);

  const movGenerado: Movimiento = {
    id: -Date.now(),
    negocio_id: negocioId,
    usuario_id: payload.usuario_id,
    producto_id: payload.producto_id,
    cliente_vehiculo_id: payload.cliente_vehiculo_id ?? null,
    tipo: payload.tipo,
    cantidad: cant,
    descripcion: payload.descripcion ?? null,
    precio_lista: payload.precio_lista ?? "0.00",
    precio_final: payload.precio_final ?? "0.00",
    monto_capital: Number(payload.monto_capital ?? 0),
    metodo_pago: payload.metodo_pago ?? null,
    fecha: fecha,
    _sync_pendiente: true,
  };

  // 4. Guardar de inmediato en la caché de movimientos para que aparezca al instante en Cierre de Caja
  try {
    await saveMovimientoCache(movGenerado);
  } catch (e) {
    console.warn("No se pudo cachear movimiento generado offline:", e);
  }

  // 5. Retornar el movimiento generado para continuar el flujo del usuario
  return movGenerado;
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", json({ username, password })),

  listNegocios: () => request<Negocio[]>("/negocios"),
  getNegocio: async (id: number): Promise<Negocio> => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (!isOffline) {
      try {
        const n = await request<Negocio>(`/negocios/${id}`);
        saveNegocioCache(n).catch(() => {});
        return n;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status >= 500 || err.status === 0) {
          const cached = await getNegocioCache(id);
          if (cached) return cached;
        }
        throw err;
      }
    }
    const cached = await getNegocioCache(id);
    if (cached) return cached;
    return await request<Negocio>(`/negocios/${id}`);
  },
  refreshToken: () => request<LoginResponse>("/auth/refresh", { method: "POST" }),
  createNegocio: (payload: NegocioCreate) =>
    request<Negocio>("/negocios", json(payload)),
  updateNegocio: (id: number, payload: NegocioUpdate) =>
    request<Negocio>(`/negocios/${id}`, jsonPatch(payload)),

  listUsuarios: (negocioId: number) =>
    request<Usuario[]>(`/negocios/${negocioId}/usuarios`),
  createUsuario: (negocioId: number, payload: UsuarioCreate) =>
    request<Usuario>(`/negocios/${negocioId}/usuarios`, json(payload)),
  updateUsuario: (negocioId: number, usuarioId: number, payload: UsuarioUpdate) =>
    request<Usuario>(`/negocios/${negocioId}/usuarios/${usuarioId}`, jsonPatch(payload)),

  listProductos: async (negocioId: number): Promise<Producto[]> => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      const cached = await getProductosCache(negocioId);
      if (cached.length > 0) return cached;
    }
    try {
      const productos = await request<Producto[]>(`/negocios/${negocioId}/productos`);
      saveProductosCache(negocioId, productos).catch((err) => {
        console.warn("Error guardando productos en cache local:", err);
      });
      return productos;
    } catch (err) {
      // Si falló por error de red o servidor inaccesible, recuperar del caché local
      if (!(err instanceof ApiError) || err.status >= 500 || err.status === 0) {
        const cached = await getProductosCache(negocioId);
        if (cached.length > 0) {
          return cached;
        }
      }
      throw err;
    }
  },

  createProducto: async (
    negocioId: number,
    payload: ProductoCreate,
    confirmarNuevo = false,
  ): Promise<Producto> => {
    const qs = confirmarNuevo ? "?confirmar_nuevo=true" : "";
    try {
      const nuevo = await request<Producto>(
        `/negocios/${negocioId}/productos${qs}`,
        json(payload),
      );
      try {
        const actualCache = await getProductosCache(negocioId);
        await saveProductosCache(negocioId, [
          ...actualCache.filter((p) => p.id !== nuevo.id),
          nuevo,
        ]);
      } catch (e) {
        console.warn("No se pudo actualizar caché local de productos:", e);
      }
      return nuevo;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw new ProductoDuplicadoError(err.status, err.message, err.detail);
      }
      throw err;
    }
  },

  updateProducto: async (
    negocioId: number,
    productoId: number,
    payload: ProductoUpdate,
  ): Promise<Producto> => {
    const actualizado = await request<Producto>(
      `/negocios/${negocioId}/productos/${productoId}`,
      jsonPatch(payload),
    );
    try {
      await saveProductoCache(actualizado);
    } catch (e) {
      console.warn("No se pudo actualizar caché local de producto:", e);
    }
    return actualizado;
  },

  deleteProducto: async (
    negocioId: number,
    productoId: number,
  ): Promise<{ ok: boolean; mensaje: string }> => {
    const res = await request<{ ok: boolean; mensaje: string }>(
      `/negocios/${negocioId}/productos/${productoId}`,
      { method: "DELETE" },
    );
    try {
      await deleteProductoCache(productoId);
    } catch (e) {
      console.warn("No se pudo eliminar de caché local de productos:", e);
    }
    return res;
  },

  /** 403 si el negocio no tiene modulos_activos.clientes_vehiculos — el
   * caller debe chequear eso antes de llamar, no solo capturar el error. */
  listClientesVehiculos: (negocioId: number, activo?: boolean) => {
    const qs = activo === undefined ? "" : `?activo=${activo}`;
    return request<ClienteVehiculo[]>(`/negocios/${negocioId}/clientes-vehiculos${qs}`);
  },

  listMovimientos: async (negocioId: number): Promise<Movimiento[]> => {
    let baseMovimientos: Movimiento[] = [];
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (!isOffline) {
      try {
        baseMovimientos = await request<Movimiento[]>(`/negocios/${negocioId}/movimientos`);
        saveMovimientosCache(negocioId, baseMovimientos).catch((err) => {
          console.warn("Error guardando movimientos en cache:", err);
        });
      } catch (err) {
        if (!(err instanceof ApiError) || err.status >= 500 || err.status === 0) {
          baseMovimientos = await getMovimientosCache(negocioId);
        } else {
          throw err;
        }
      }
    } else {
      baseMovimientos = await getMovimientosCache(negocioId);
    }

    // Unir con ventas pendientes en cola_sync para que nunca desaparezcan de la vista
    try {
      const colaItems = await getColaSync(negocioId);
      const itemsMovimiento = colaItems.filter(
        (i) => i.entidad === "movimiento" && i.estado !== "error",
      );

      if (itemsMovimiento.length > 0) {
        const idSet = new Set(baseMovimientos.map((m) => m.id));
        for (const item of itemsMovimiento) {
          const p = item.payload as Record<string, unknown>;
          let id = typeof p.id === "number" ? p.id : -1;
          if (id === -1) {
            let hash = 0;
            for (let i = 0; i < item.id.length; i++) {
              hash = (hash << 5) - hash + item.id.charCodeAt(i);
              hash |= 0;
            }
            id = -Math.abs(hash || Date.now());
          }

          if (!idSet.has(id)) {
            baseMovimientos.push({
              id,
              negocio_id: negocioId,
              usuario_id: Number(p.usuario_id || 1),
              producto_id: Number(p.producto_id),
              cliente_vehiculo_id: (p.cliente_vehiculo_id as number | null) ?? null,
              tipo: String(p.tipo || "venta"),
              cantidad: Number(p.cantidad || 1),
              descripcion: (p.descripcion as string | null) ?? null,
              precio_lista: String(p.precio_lista ?? "0.00"),
              precio_final: String(p.precio_final ?? "0.00"),
              monto_capital: Number(p.monto_capital ?? 0),
              metodo_pago: (p.metodo_pago as string | null) ?? null,
              fecha: String(p.fecha || item.fecha_creacion),
              _sync_pendiente: true,
            });
            idSet.add(id);
          }
        }
      }
    } catch (e) {
      console.warn("Error combinando cola_sync con movimientos:", e);
    }

    return baseMovimientos.sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
  },

  deleteMovimiento: async (negocioId: number, movimientoId: number) => {
    if (movimientoId < 0) {
      // Movimiento offline local — eliminar de cola_sync y de la caché
      try {
        const cola = await getColaSync(negocioId);
        const item = cola.find((i) => {
          const p = i.payload as Record<string, unknown>;
          return p.id === movimientoId;
        }) || cola[0];
        if (item) {
          await eliminarSyncItem(item.id);
        }
        await deleteMovimientoCache(movimientoId);
        syncManager.notifyItemQueued(negocioId);
        return { ok: true, mensaje: "Movimiento local anulado." };
      } catch (err) {
        console.warn("Error al anular movimiento offline:", err);
      }
    }

    const res = await request<{ ok: boolean; mensaje: string }>(
      `/negocios/${negocioId}/movimientos/${movimientoId}`,
      { method: "DELETE" },
    );
    deleteMovimientoCache(movimientoId).catch(() => {});
    return res;
  },

  async createMovimiento(
    negocioId: number,
    payload: MovimientoCreate,
    { confirmarBajoMinimo = false }: { confirmarBajoMinimo?: boolean } = {},
  ): Promise<Movimiento> {
    const qs = confirmarBajoMinimo ? "?confirmar_bajo_minimo=true" : "";
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      return await procesarMovimientoOffline(negocioId, payload);
    }
    try {
      return await request<Movimiento>(
        `/negocios/${negocioId}/movimientos${qs}`,
        json(payload),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw new StockBajoMinimoError(err.status, err.message, err.detail);
      }
      // Error de red (fetch fallido, conexión interrumpida, etc.)
      if (!(err instanceof ApiError) || err.status >= 500 || err.status === 0) {
        return await procesarMovimientoOffline(negocioId, payload);
      }
      throw err;
    }
  },

  listCierresCaja: async (negocioId: number): Promise<CierreCaja[]> => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (!isOffline) {
      try {
        const cierres = await request<CierreCaja[]>(`/negocios/${negocioId}/cierres-caja`);
        saveCierresCajaCache(negocioId, cierres).catch(() => {});
        return cierres;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status >= 500 || err.status === 0) {
          return await getCierresCajaCache(negocioId);
        }
        throw err;
      }
    }
    return await getCierresCajaCache(negocioId);
  },
  createCierreCaja: (negocioId: number, payload: CierreCajaCreate) =>
    request<CierreCaja>(`/negocios/${negocioId}/cierres-caja`, json(payload)),

  /** Gateado por modulo_rus_activo (403 si no está activo). Suma
   * `cantidad` a stock_actual y queda como historial para SUNAT. */
  listRegistroCompras: (negocioId: number) =>
    request<RegistroCompra[]>(`/negocios/${negocioId}/registro-compras`),
  createRegistroCompra: (negocioId: number, payload: RegistroCompraCreate) =>
    request<RegistroCompra>(`/negocios/${negocioId}/registro-compras`, json(payload)),

  /** Corrección directa de stock_actual, siempre disponible (no depende
   * de modulo_rus_activo) y sin rastro auditado — para eso está
   * registro-compras. delta positivo repone, negativo corrige. El
   * backend responde 400 con detail de texto plano si delta es 0 o si
   * dejaría el stock negativo. */
  ajustarStock: (negocioId: number, productoId: number, delta: number) =>
    request<Producto>(
      `/negocios/${negocioId}/productos/${productoId}/ajustar-stock`,
      json({ delta }),
    ),

  /**
   * Procesa la cola de sincronización offline enviada por el cliente.
   * Idempotente por item vía su UUID generado en el cliente.
   */
  sync: (negocioId: number, items: ColaSyncItem[]) =>
    request<ColaSyncResultado[]>(`/negocios/${negocioId}/sync`, json(items)),
};
