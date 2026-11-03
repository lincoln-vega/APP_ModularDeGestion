import { api, type ColaSyncItem } from "../api/client";
import {
  actualizarSyncItemEstado,
  eliminarSyncItems,
  getColaSync,
  getColaSyncCount,
} from "./offlineStore";

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  lastError: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncManager {
  private isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;
  private lastError: string | null = null;
  private listeners: Map<SyncListener, number | undefined> = new Map();
  private pendingCounts: Map<number | undefined, number> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());

      // Sincronizar y actualizar conteos inmediatamente cuando el usuario reabre la app o desbloquea su móvil
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            this.refreshAllCounts();
            this.syncAll().catch(() => {});
          }
        });
      }

      window.addEventListener("focus", () => {
        this.refreshAllCounts();
        this.syncAll().catch(() => {});
      });

      // Chequeo periódico en segundo plano cada 25 segundos para evitar items acumulados
      setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.syncAll().catch(() => {});
        }
      }, 25000);

      // Inicializar conteo
      this.refreshAllCounts();
    }
  }

  private handleOnline() {
    this.isOnline = true;
    this.lastError = null;
    this.notifyAll();
    // Al volver la conexión, sincronizar automáticamente
    this.syncAll().catch((err) => {
      console.warn("Error en auto-sincronización al volver online:", err);
    });
  }

  private handleOffline() {
    this.isOnline = false;
    this.notifyAll();
  }

  public getState(negocioId?: number): SyncState {
    const pendingCount = this.pendingCounts.get(negocioId) ?? 0;
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  public subscribe(listener: SyncListener, negocioId?: number): () => void {
    this.listeners.set(listener, negocioId);
    // Notificar estado actual de inmediato
    listener(this.getState(negocioId));
    // Refrescar conteo para este negocio
    this.refreshCount(negocioId);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyItemQueued(negocioId: number): void {
    this.refreshCount(negocioId).then(() => {
      this.refreshCount(undefined);
    });
  }

  public async refreshCount(negocioId?: number): Promise<number> {
    try {
      const count = await getColaSyncCount(negocioId);
      this.pendingCounts.set(negocioId, count);
      this.notifyForNegocio(negocioId);
      return count;
    } catch {
      return 0;
    }
  }

  private async refreshAllCounts(): Promise<void> {
    const total = await this.refreshCount(undefined);
    // Refrescar para los listeners específicos
    const negocios = new Set(this.listeners.values());
    for (const nId of negocios) {
      if (nId !== undefined) {
        await this.refreshCount(nId);
      }
    }
    if (total === 0 && this.isOnline && this.lastSyncTime === null) {
      this.lastSyncTime = new Date();
    }
  }

  private notifyAll(): void {
    for (const [listener, negocioId] of this.listeners.entries()) {
      listener(this.getState(negocioId));
    }
  }

  private notifyForNegocio(negocioId?: number): void {
    for (const [listener, subscribedNegocioId] of this.listeners.entries()) {
      if (subscribedNegocioId === negocioId || subscribedNegocioId === undefined || negocioId === undefined) {
        listener(this.getState(subscribedNegocioId));
      }
    }
  }

  /**
   * Sincroniza la cola de un negocio específico contra el backend.
   */
  public async syncNegocio(
    negocioId: number,
  ): Promise<{ success: boolean; procesados: number; errores: number }> {
    if (!this.isOnline) {
      return { success: false, procesados: 0, errores: 0 };
    }

    if (this.isSyncing) {
      return { success: false, procesados: 0, errores: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyAll();

    try {
      const items = await getColaSync(negocioId);
      const itemsPendientes = items.filter((i) => i.estado !== "sincronizando");

      if (itemsPendientes.length === 0) {
        // Nada pendiente: aprovechamos para refrescar el catálogo en segundo plano
        try {
          await api.listProductos(negocioId);
        } catch {
          // Si falla el listado no bloqueamos
        }
        this.lastSyncTime = new Date();
        this.isSyncing = false;
        await this.refreshCount(negocioId);
        await this.refreshCount(undefined);
        this.notifyAll();
        return { success: true, procesados: 0, errores: 0 };
      }

      // Marcar en IndexedDB como sincronizando
      for (const item of itemsPendientes) {
        await actualizarSyncItemEstado(item.id, "sincronizando");
      }

      // Armar payload según contrato OpenAPI (ColaSyncItem)
      const payload: ColaSyncItem[] = itemsPendientes.map((i) => ({
        id: i.id,
        entidad: i.entidad,
        payload: i.payload,
        fecha_creacion: i.fecha_creacion,
      }));

      // Enviar lote al backend: POST /negocios/{negocioId}/sync
      const resultados = await api.sync(negocioId, payload);

      const idsAEliminar: string[] = [];
      let errores = 0;

      for (const res of resultados) {
        if (res.estado === "aplicado" || res.estado === "duplicado") {
          idsAEliminar.push(res.id);
        } else if (res.estado === "error") {
          errores++;
          await actualizarSyncItemEstado(res.id, "error", res.detalle);
        }
      }

      // Limpiar de IndexedDB los items que ya fueron aplicados o duplicados
      if (idsAEliminar.length > 0) {
        await eliminarSyncItems(idsAEliminar);
      }

      // Recarga fresca del catálogo y de los movimientos desde el servidor para reflejar stock consolidado y persistencia
      try {
        await Promise.allSettled([
          api.listProductos(negocioId),
          api.listMovimientos(negocioId),
        ]);
      } catch (err) {
        console.warn("No se pudo recargar el catálogo o movimientos tras sync:", err);
      }

      this.lastSyncTime = new Date();
      this.isSyncing = false;
      await this.refreshCount(negocioId);
      await this.refreshCount(undefined);
      this.notifyAll();

      return {
        success: errores === 0,
        procesados: idsAEliminar.length,
        errores,
      };
    } catch (err) {
      // Revertir estado a pendiente si ocurrió un fallo de red durante el envío
      try {
        const items = await getColaSync(negocioId);
        for (const item of items) {
          if (item.estado === "sincronizando") {
            await actualizarSyncItemEstado(item.id, "pendiente");
          }
        }
      } catch {
        // Silenciar error en reversión
      }

      this.lastError = err instanceof Error ? err.message : "Error durante la sincronización";
      this.isSyncing = false;
      await this.refreshCount(negocioId);
      await this.refreshCount(undefined);
      this.notifyAll();

      return { success: false, procesados: 0, errores: 1 };
    }
  }

  /**
   * Sincroniza todos los negocios que tengan elementos en cola.
   */
  public async syncAll(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    try {
      const todosLosItems = await getColaSync();
      const negociosIds = [...new Set(todosLosItems.map((i) => i.negocio_id))];

      if (negociosIds.length === 0) {
        this.lastSyncTime = new Date();
        this.notifyAll();
        return;
      }

      for (const nId of negociosIds) {
        await this.syncNegocio(nId);
      }
    } catch (err) {
      console.warn("Error en syncAll:", err);
    }
  }
}

export const syncManager = new SyncManager();
