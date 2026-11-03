import { useEffect, useMemo, useState } from "react";
import { useNegocioDelTipo } from "../hooks/useNegocioDelTipo";
import { useProductos } from "../api/useProductos";
import { api, type CierreCaja as CierreCajaType, type Movimiento } from "../api/client";
import { syncManager } from "../lib/syncManager";
import { formatMoney, todayKey } from "../lib/format";
import { esCapital } from "../lib/contabilidad";
import { Button } from "../components/Button";
import { TrashIcon } from "../components/icons/Icons";
import styles from "./CierreCaja.module.css";

export default function CierreCaja() {
  const { negocio, loading: cargandoNegocio } = useNegocioDelTipo();
  const { productos, recargar: recargarProductos } = useProductos(negocio?.id);

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cierreDeHoy, setCierreDeHoy] = useState<CierreCajaType | null | undefined>(undefined);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal para anular venta / movimiento
  const [movimientoAAnular, setMovimientoAAnular] = useState<Movimiento | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [errorAnular, setErrorAnular] = useState<string | null>(null);

  useEffect(() => {
    if (!negocio) return;
    let cancelado = false;
    setCargandoDatos(true);

    // Intentar sincronizar cola pendiente si hay conexión al abrir Cierre de Caja
    syncManager.syncAll().catch(() => {});

    Promise.allSettled([api.listMovimientos(negocio.id), api.listCierresCaja(negocio.id)])
      .then(([resMovs, resCierres]) => {
        if (cancelado) return;
        if (resMovs.status === "fulfilled") {
          setMovimientos(resMovs.value);
        } else {
          setError(
            resMovs.reason instanceof Error
              ? resMovs.reason.message
              : "Error al cargar movimientos",
          );
        }

        if (resCierres.status === "fulfilled") {
          setCierreDeHoy(
            resCierres.value.find(
              (c) => c.fecha_inicio === todayKey() && c.fecha_fin === todayKey(),
            ) ?? null,
          );
        }
      })
      .finally(() => !cancelado && setCargandoDatos(false));

    return () => {
      cancelado = true;
    };
  }, [negocio]);

  const handleConfirmarAnular = async () => {
    if (!negocio || !movimientoAAnular) return;
    setAnulando(true);
    setErrorAnular(null);
    try {
      await api.deleteMovimiento(negocio.id, movimientoAAnular.id);
      // Quitar el movimiento de la lista para recalcular los totales en vivo
      setMovimientos((prev) => prev.filter((m) => m.id !== movimientoAAnular.id));
      // Actualizar la lista de productos si se devolvió stock
      await recargarProductos();
      setMovimientoAAnular(null);
    } catch (err) {
      setErrorAnular(
        err instanceof Error ? err.message : "No se pudo anular el movimiento",
      );
    } finally {
      setAnulando(false);
    }
  };

  if (cargandoNegocio || !negocio) return null;

  return (
    <CierreCajaContenido
      negocioId={negocio.id}
      negocioNombre={negocio.nombre}
      productos={productos}
      movimientos={movimientos}
      cierreDeHoy={cierreDeHoy}
      cargando={cargandoDatos}
      cerrando={cerrando}
      error={error}
      onCerrar={async () => {
        setCerrando(true);
        setError(null);
        try {
          const cierre = await api.createCierreCaja(negocio.id, {
            periodo: "diario",
            fecha_inicio: todayKey(),
            fecha_fin: todayKey(),
          });
          setCierreDeHoy(cierre);
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo cerrar la caja");
        } finally {
          setCerrando(false);
        }
      }}
      movimientoAAnular={movimientoAAnular}
      anulando={anulando}
      errorAnular={errorAnular}
      onSolicitarAnular={(m) => {
        setMovimientoAAnular(m);
        setErrorAnular(null);
      }}
      onCancelarAnular={() => setMovimientoAAnular(null)}
      onConfirmarAnular={handleConfirmarAnular}
    />
  );
}

interface ContenidoProps {
  negocioId: number;
  negocioNombre: string;
  productos: ReturnType<typeof useProductos>["productos"];
  movimientos: Movimiento[];
  cierreDeHoy: CierreCajaType | null | undefined;
  cargando: boolean;
  cerrando: boolean;
  error: string | null;
  onCerrar: () => void;
  movimientoAAnular: Movimiento | null;
  anulando: boolean;
  errorAnular: string | null;
  onSolicitarAnular: (m: Movimiento) => void;
  onCancelarAnular: () => void;
  onConfirmarAnular: () => void;
}

function CierreCajaContenido({
  productos,
  movimientos,
  cierreDeHoy,
  cargando,
  cerrando,
  error,
  onCerrar,
  movimientoAAnular,
  anulando,
  errorAnular,
  onSolicitarAnular,
  onCancelarAnular,
  onConfirmarAnular,
}: ContenidoProps) {
  const productosPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const movimientosDeHoy = useMemo(
    () => movimientos.filter((m) => m.fecha.slice(0, 10) === todayKey()),
    [movimientos],
  );

  const totales = useMemo(() => {
    let bruto = 0;
    let capital = 0;
    let ganancia = 0;
    let efectivo = 0;
    let digital = 0;
    for (const m of movimientosDeHoy) {
      const monto = Number(m.precio_final);
      bruto += monto;
      const esItemCapital = esCapital(productosPorId.get(m.producto_id)?.clasificacion ?? null);
      if (esItemCapital) capital += monto;
      else ganancia += monto;
      if (m.metodo_pago === "digital") digital += monto;
      else efectivo += monto;
    }
    return { bruto, capital, ganancia, efectivo, digital };
  }, [movimientosDeHoy, productosPorId]);

  const cerrada = Boolean(cierreDeHoy);
  const totalBruto = cerrada ? Number(cierreDeHoy!.total_bruto) : totales.bruto;
  const totalCapital = cerrada ? Number(cierreDeHoy!.total_capital) : totales.capital;
  const totalGanancia = cerrada ? Number(cierreDeHoy!.total_ganancia) : totales.ganancia;
  const totalEfectivo = cerrada ? Number(cierreDeHoy!.total_efectivo) : totales.efectivo;
  const totalDigital = cerrada ? Number(cierreDeHoy!.total_digital) : totales.digital;
  const pctCapital = totalBruto ? (totalCapital / totalBruto) * 100 : 0;
  const pctEfectivo = totalBruto ? (totalEfectivo / totalBruto) * 100 : 0;

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cierre de caja</h1>
          <p className={styles.subtitle}>
            Hoy {cerrada && <span className={styles.badge}>cerrada</span>}
          </p>
        </div>
      </div>

      <div className={styles.totalCard}>
        <div>
          <div className={styles.totalLabel}>Total bruto {cerrada ? "del cierre" : "(en vivo)"}</div>
          <div className={styles.totalValue}>{formatMoney(totalBruto.toFixed(2))}</div>
        </div>
        {!cerrada && (
          <Button variant="accent" onClick={onCerrar} disabled={cerrando || cargando || movimientosDeHoy.length === 0}>
            {cerrando ? "Cerrando…" : "Cerrar caja del día"}
          </Button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.breakdownGrid}>
        <BreakdownCard
          title="Capital vs. Ganancia"
          pct={pctCapital}
          colorA="var(--producto)"
          colorB="var(--success)"
          items={[
            { label: "Capital", color: "var(--producto)", value: totalCapital },
            { label: "Ganancia", color: "var(--success)", value: totalGanancia },
          ]}
        />
        <BreakdownCard
          title="Efectivo vs. Digital"
          pct={pctEfectivo}
          colorA="var(--servicio)"
          colorB="var(--ink)"
          items={[
            { label: "Efectivo", color: "var(--servicio)", value: totalEfectivo },
            { label: "Digital", color: "var(--ink)", value: totalDigital },
          ]}
        />
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableTitle}>Movimientos de hoy</div>
        {cargando ? (
          <p className={styles.muted}>Cargando…</p>
        ) : movimientosDeHoy.length === 0 ? (
          <p className={styles.muted}>Todavía no hay movimientos registrados hoy.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Método</th>
                <th className={styles.right}>Monto</th>
                {!cerrada && <th className={styles.center}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {movimientosDeHoy.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" })}</td>
                  <td>
                    <span className={`${styles.tag} ${m.tipo === "servicio" ? styles.tagServicio : styles.tagProducto}`}>
                      {m.tipo === "servicio" ? "Servicio" : "Producto"}
                    </span>
                  </td>
                  <td>
                    {m.cantidad && m.cantidad > 1 && (
                      <span className={styles.cantBadge}>{m.cantidad}x</span>
                    )}
                    <span>{m.descripcion ?? productosPorId.get(m.producto_id)?.nombre ?? "—"}</span>
                    {m._sync_pendiente && (
                      <span
                        className={styles.badgeSyncPendiente}
                        title="Guardado localmente en este dispositivo. Se sincronizará con el servidor al conectar."
                      >
                        🔄 Pendiente
                      </span>
                    )}
                  </td>
                  <td className={styles.muted}>{m.metodo_pago === "digital" ? "Digital" : "Efectivo"}</td>
                  <td className={styles.right}>{formatMoney(m.precio_final)}</td>
                  {!cerrada && (
                    <td className={styles.center}>
                      <button
                        type="button"
                        className={styles.btnAnular}
                        onClick={() => onSolicitarAnular(m)}
                        title="Anular venta / movimiento"
                        aria-label="Anular venta"
                      >
                        <TrashIcon size={14} />
                        <span>Anular</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {movimientoAAnular && (
        <div className={styles.modalOverlay} onClick={onCancelarAnular}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.deleteIconWrap}>
              <TrashIcon size={24} />
            </div>

            <h2 className={styles.modalTitle}>
              ¿Anular {movimientoAAnular.tipo === "servicio" ? "este servicio" : "esta venta"}?
            </h2>

            <div className={styles.deleteItemSummary}>
              <span className={styles.deleteItemName}>
                {movimientoAAnular.cantidad && movimientoAAnular.cantidad > 1 ? `${movimientoAAnular.cantidad}x ` : ""}
                {movimientoAAnular.descripcion ??
                  productosPorId.get(movimientoAAnular.producto_id)?.nombre ??
                  "Movimiento"}
              </span>
              <span className={styles.deleteItemDetail}>
                {formatMoney(movimientoAAnular.precio_final)}
              </span>
            </div>

            <p className={styles.deleteWarningNote}>
              ¿Anular esta venta? {movimientoAAnular.cantidad && movimientoAAnular.cantidad > 1 ? `Se devolverán ${movimientoAAnular.cantidad} unidades de stock al inventario` : "Se devolverá el stock al inventario"} y se descontará del cierre de caja.
            </p>

            {errorAnular && (
              <div className={styles.errorBox} role="alert">
                <p style={{ margin: 0 }}>{errorAnular}</p>
              </div>
            )}

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancelarAnular}
                disabled={anulando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={onConfirmarAnular}
                disabled={anulando}
              >
                {anulando ? "Anulando…" : "Sí, anular"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BreakdownCard({
  title,
  pct,
  colorA,
  colorB,
  items,
}: {
  title: string;
  pct: number;
  colorA: string;
  colorB: string;
  items: { label: string; color: string; value: number }[];
}) {
  return (
    <div className={styles.breakdownCard}>
      <div className={styles.tableTitle}>{title}</div>
      <div className={styles.bar}>
        <div style={{ width: `${pct}%`, background: colorA }} />
        <div style={{ width: `${100 - pct}%`, background: colorB }} />
      </div>
      {items.map((item) => (
        <div key={item.label} className={styles.legendRow}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: item.color }} />
            {item.label}
          </span>
          <span className={styles.legendValue}>{formatMoney(item.value.toFixed(2))}</span>
        </div>
      ))}
    </div>
  );
}
