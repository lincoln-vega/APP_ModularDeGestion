import { useNavigate } from "react-router-dom";
import { ActionCard } from "../components/ActionCard";
import { AlertBanner } from "../components/AlertBanner";
import { Button } from "../components/Button";
import { useProductos } from "../api/useProductos";
import { useClientesVehiculos, estaVencido } from "../api/useClientesVehiculos";
import { useNegocioDelTipo } from "../hooks/useNegocioDelTipo";
import { esCapital } from "../lib/contabilidad";
import { formatMoney } from "../lib/format";
import { BoxIcon, CashIcon, PlusIcon, ReceiptIcon, UserIcon } from "../components/icons/Icons";
import styles from "./Inicio.module.css";

export default function Inicio() {
  const navigate = useNavigate();
  const { tipo, config, negocio, loading } = useNegocioDelTipo();
  const { productos } = useProductos(negocio?.id);
  
  const modulos = (negocio?.modulos_activos || {}) as Record<string, boolean>;
  const moduloStockActivo =
    typeof modulos.stock === "boolean"
      ? Boolean(modulos.stock)
      : tipo !== "lubricentro";
  const moduloClientesActivo =
    typeof modulos.clientes_vehiculos === "boolean"
      ? Boolean(modulos.clientes_vehiculos)
      : tipo === "lubricentro";

  const { clientes } = useClientesVehiculos(negocio?.id, moduloClientesActivo);

  if (loading || !negocio) return null;

  const productoBajoMinimo = moduloStockActivo
    ? productos.find((p) => p.activo && p.stock_actual < p.stock_minimo)
    : undefined;
  const vencidos = clientes.filter(estaVencido);

  const serviciosRegistrados = productos.filter(
    (p) => p.activo && !esCapital(p.clasificacion),
  );
  const productosEnStock = productos.filter(
    (p) => p.activo && esCapital(p.clasificacion),
  );

  // Primera acción para atajo de cobro rápido
  const primeraAccion = config.servicios[0] || config.productos[0];

  return (
    <div className={styles.container}>
      {/* 1. Header / Bienvenida de Turno */}
      <div className={styles.heroHeader}>
        <div>
          <h1 className={styles.heroTitle}>Hola, {negocio.nombre}</h1>
          <p className={styles.heroSub}>Panel táctil de gestión y mostrador</p>
        </div>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} />
          <span>Turno activo</span>
        </div>
      </div>

      {/* Alertas prioritarias si existen */}
      {moduloClientesActivo && vencidos.length > 0 && (
        <AlertBanner
          id="mantenimientos-vencidos"
          title={`${vencidos.length} mantenimiento${vencidos.length > 1 ? "s" : ""} vencido${vencidos.length > 1 ? "s" : ""}`}
          message="Clientes que ya deberían haber vuelto para su próximo servicio o cambio de aceite."
          action={
            <Button variant="accent" onClick={() => navigate(`/${tipo}/clientes`)}>
              Ver clientes
            </Button>
          }
        />
      )}

      {moduloStockActivo && productoBajoMinimo && (
        <AlertBanner
          id={`stock-bajo-${productoBajoMinimo.id}`}
          title={`Stock bajo · ${productoBajoMinimo.nombre}`}
          message={`Quedan ${productoBajoMinimo.stock_actual} unidades — el mínimo es ${productoBajoMinimo.stock_minimo}.`}
          action={
            <Button
              variant="accent"
              onClick={() =>
                navigate(`/${tipo}/stock/ajustar/${productoBajoMinimo.id}`)
              }
            >
              Reponer stock
            </Button>
          }
        />
      )}

      {/* 2. Las Tarjetas Gigantes Táctiles (Minimalistas y accesibles para móvil y tablet) */}
      <section className={styles.touchCardsGrid}>
        {/* Tarjeta 1: Cobro Rápido / Registrar Venta o Servicio */}
        <div
          className={`${styles.touchCard} ${styles.touchCardPrimary}`}
          onClick={() => {
            if (primeraAccion) {
              navigate(`/${tipo}/registrar/${primeraAccion.id}`);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className={styles.touchCardTop}>
            <div className={styles.touchCardIconPrimary}>
              <CashIcon size={24} />
            </div>
            <span className={styles.touchCardBadge}>
              {tipo === "lubricentro" ? "Servicio rápido" : "Atajo de cobro"}
            </span>
          </div>
          <div className={styles.touchCardBody}>
            <h2 className={styles.touchCardTitle}>
              {tipo === "lubricentro"
                ? "Registrar Servicio"
                : tipo === "lenceria"
                ? "Registrar Venta"
                : "Registrar Cobro"}
            </h2>
            <p className={styles.touchCardDesc}>
              {tipo === "lubricentro"
                ? "Cambio de aceite, filtro, lavado o mano de obra"
                : tipo === "lenceria"
                ? "Venta directa de prendas y lencería"
                : "Cobro rápido en efectivo o digital (Yape / Plin / Tarjeta)"}
            </p>
          </div>
          <div className={styles.touchCardCta}>
            <span>{tipo === "lubricentro" ? "Atender cliente →" : "Iniciar cobro →"}</span>
          </div>
        </div>

        {/* Tarjeta 2: Cierre de Caja (Siempre presente) */}
        <div
          className={styles.touchCard}
          onClick={() => navigate(`/${tipo}/cierre-caja`)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.touchCardTop}>
            <div className={styles.touchCardIcon}>
              <ReceiptIcon size={24} />
            </div>
            <span className={styles.touchCardTag}>Turno</span>
          </div>
          <div className={styles.touchCardBody}>
            <h2 className={styles.touchCardTitle}>Cierre de Caja</h2>
            <p className={styles.touchCardDesc}>
              Control de ingresos, arqueo de turno y balance
            </p>
          </div>
          <div className={styles.touchCardCtaSecondary}>
            <span>Ver arqueo →</span>
          </div>
        </div>

        {/* Tarjeta 3: Stock e Inventario (Solo si el módulo está habilitado) */}
        {moduloStockActivo && (
          <div
            className={styles.touchCard}
            onClick={() => navigate(`/${tipo}/stock`)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.touchCardTop}>
              <div className={styles.touchCardIcon}>
                <BoxIcon size={24} />
              </div>
              <span className={productoBajoMinimo ? styles.touchCardTagWarning : styles.touchCardTag}>
                {productoBajoMinimo ? "⚠️ Stock bajo" : `${productosEnStock.length} ítems`}
              </span>
            </div>
            <div className={styles.touchCardBody}>
              <h2 className={styles.touchCardTitle}>Stock & Precios</h2>
              <p className={styles.touchCardDesc}>
                Catálogo de precios, cantidades y reposición
              </p>
            </div>
            <div className={styles.touchCardCtaSecondary}>
              <span>Ver catálogo →</span>
            </div>
          </div>
        )}

        {/* Tarjeta 4: Clientes y Vehículos (si módulo está activo) */}
        {moduloClientesActivo && (
          <div
            className={styles.touchCard}
            onClick={() => navigate(`/${tipo}/clientes`)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.touchCardTop}>
              <div className={styles.touchCardIcon}>
                <UserIcon size={24} />
              </div>
              <span className={vencidos.length > 0 ? styles.touchCardTagWarning : styles.touchCardTag}>
                {vencidos.length > 0 ? `⚠️ ${vencidos.length} por contactar` : `${clientes.length} clientes`}
              </span>
            </div>
            <div className={styles.touchCardBody}>
              <h2 className={styles.touchCardTitle}>Clientes & Placas</h2>
              <p className={styles.touchCardDesc}>
                Historial de vehículos y avisos por WhatsApp
              </p>
            </div>
            <div className={styles.touchCardCtaSecondary}>
              <span>Ver clientes →</span>
            </div>
          </div>
        )}
      </section>

      {/* 3. Acciones Rápidas - Servicios */}
      {config.servicios.length > 0 && (
        <section className={styles.sectionWrap}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>
              <span className={`${styles.dot} ${styles.dotServicio}`} />
              Servicios y Mano de Obra
            </h2>
          </div>
          <div className={styles.grid}>
            {config.servicios.map((accion) => (
              <ActionCard
                key={accion.id}
                icon={accion.icon}
                label={accion.label}
                tone="servicio"
                onClick={() => navigate(`/${tipo}/registrar/${accion.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. Acciones Rápidas - Productos / Ventas Físicas */}
      {config.productos.length > 0 && (
        <section className={styles.sectionWrap}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>
              <span className={`${styles.dot} ${styles.dotProducto}`} />
              Venta de Repuestos y Productos
            </h2>
          </div>
          <div className={styles.grid}>
            {config.productos.map((accion) => (
              <ActionCard
                key={accion.id}
                icon={accion.icon}
                label={accion.label}
                tone="producto"
                onClick={() => navigate(`/${tipo}/registrar/${accion.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. Catálogo Registrado Resumido */}
      {(serviciosRegistrados.length > 0 || productosEnStock.length > 0) && (
        <section className={styles.catalogSection}>
          <div className={styles.catalogHeader}>
            <h2 className={styles.sectionLabel} style={{ margin: 0 }}>
              <span className={`${styles.dot} ${styles.dotCatalogo}`} />
              Precios Frecuentes ({productos.filter((p) => p.activo).length} ítems registrados)
            </h2>
            <button
              type="button"
              className={styles.viewAllBtn}
              onClick={() => navigate(`/${tipo}/stock`)}
            >
              Ver todos →
            </button>
          </div>

          <div className={styles.catalogGrid}>
            {serviciosRegistrados.slice(0, 4).map((serv) => (
              <div
                key={serv.id}
                className={styles.catalogCard}
                onClick={() => navigate(`/${tipo}/stock`)}
                title="Ver detalles en Stock"
              >
                <span className={styles.catalogCardName}>{serv.nombre}</span>
                <span className={styles.catalogCardSub}>Mano de obra</span>
                <div className={styles.catalogCardFooter}>
                  <span className={styles.catalogCardPrice}>
                    {formatMoney(serv.precio_lista)}
                  </span>
                  <span className={styles.catalogBadgeStock}>Servicio</span>
                </div>
              </div>
            ))}

            {productosEnStock.slice(0, 4).map((prod) => {
              const bajo = prod.stock_actual < prod.stock_minimo;
              return (
                <div
                  key={prod.id}
                  className={styles.catalogCard}
                  onClick={() => navigate(`/${tipo}/stock`)}
                  title="Ver en Stock"
                >
                  <span className={styles.catalogCardName}>{prod.nombre}</span>
                  <span className={styles.catalogCardSub}>
                    {[prod.marca, prod.medida].filter(Boolean).join(" · ") ||
                      "Producto físico"}
                  </span>
                  <div className={styles.catalogCardFooter}>
                    <span className={styles.catalogCardPrice}>
                      {formatMoney(prod.precio_lista)}
                    </span>
                    <span
                      className={
                        bajo ? styles.catalogBadgeLow : styles.catalogBadgeStock
                      }
                    >
                      {prod.stock_actual} en stock
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Acciones de pie de página contextuales según módulos activos */}
      <div className={styles.bottomActions}>
        {moduloStockActivo ? (
          <>
            <button
              type="button"
              className={styles.addCatalogBtn}
              onClick={() => navigate(`/${tipo}/stock`)}
            >
              <PlusIcon size={16} />
              <span>+ Nuevo Producto / Precio</span>
            </button>

            <button
              type="button"
              className={styles.quickLink}
              onClick={() => navigate(`/${tipo}/stock`)}
            >
              <BoxIcon size={18} />
              <span>Consultar inventario completo ({productosEnStock.length})</span>
            </button>
          </>
        ) : moduloClientesActivo ? (
          <>
            <button
              type="button"
              className={styles.addCatalogBtn}
              onClick={() => navigate(`/${tipo}/clientes`)}
            >
              <PlusIcon size={16} />
              <span>+ Nuevo Vehículo / Cliente</span>
            </button>

            <button
              type="button"
              className={styles.quickLink}
              onClick={() => navigate(`/${tipo}/clientes`)}
            >
              <UserIcon size={18} />
              <span>Ver cartera de clientes ({clientes.length})</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.quickLink}
            onClick={() => navigate(`/${tipo}/cierre-caja`)}
          >
            <CashIcon size={18} />
            <span>Consultar arqueo de caja</span>
          </button>
        )}
      </div>
    </div>
  );
}
