import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { useNegocioDelTipo } from "../hooks/useNegocioDelTipo";
import { useProductos } from "../api/useProductos";
import { useUsuarioPrincipal } from "../api/useUsuarioPrincipal";
import {
  api,
  ApiError,
  StockBajoMinimoError,
  type Movimiento,
  type Producto,
} from "../api/client";
import { formatMoney, parseMoneyInput } from "../lib/format";
import { esCapital, esProductoNuevo, esProductoUsado, getEstadoUsoBadge } from "../lib/contabilidad";
import { buscarAccion } from "../data/negociosConfig";
import {
  AlertTriangleIcon,
  CardIcon,
  CashIcon,
  ChatIcon,
  CheckIcon,
  ChevronLeftIcon,
  PlusIcon,
  PrintIcon,
  ReceiptIcon,
  SearchIcon,
  TrashIcon,
} from "../components/icons/Icons";
import {
  clasificarServicio,
  clasificarProductoFisico,
  ordenarProductosDeCategoria,
  CATEGORIAS_SERVICIOS_INFO,
  CATEGORIAS_PRODUCTOS_INFO,
  type SubcategoriaServicio,
  type SubcategoriaProducto,
  type InfoCategoriaVisual,
} from "../lib/catalogoClasificacion";
import styles from "./MovimientoFlow.module.css";

type Paso = "elegir" | "precio" | "confirmar";
const PASOS: { id: Paso; label: string }[] = [
  { id: "elegir", label: "Elegir" },
  { id: "precio", label: "Cantidad y precio" },
  { id: "confirmar", label: "Pago" },
];

export default function MovimientoFlow() {
  const navigate = useNavigate();
  const { accionId } = useParams<{ accionId: string }>();
  const { tipo, tipoValido, negocio, loading: cargandoNegocio } = useNegocioDelTipo();
  const { productos, loading: cargandoProductos, recargar } = useProductos(negocio?.id);
  const { usuarioId, error: errorUsuario } = useUsuarioPrincipal(negocio?.id);

  const [paso, setPaso] = useState<Paso>("elegir");
  const [filtroEstadoUso, setFiltroEstadoUso] = useState<"todas" | "nuevo" | "usado">("todas");
  const [medidaElegida, setMedidaElegida] = useState<string | null>(null);
  const [productoElegido, setProductoElegido] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState<number>(1);
  const [precioUnitario, setPrecioUnitario] = useState<number>(0);
  const [capitalUnitario, setCapitalUnitario] = useState<number>(0);
  const [precioFinal, setPrecioFinal] = useState("");
  const [montoCapital, setMontoCapital] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "digital">("efectivo");
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  // Estados para Ticket Digital por WhatsApp e Impresión
  const [movimientoCreado, setMovimientoCreado] = useState<Movimiento | null>(null);
  const [telefonoTicket, setTelefonoTicket] = useState("");

  // Estado para Anulación de Venta Reciente / Prueba
  const [modalAnularAbierto, setModalAnularAbierto] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [errorAnular, setErrorAnular] = useState<string | null>(null);

  const accion = accionId ? buscarAccion(tipo, accionId) : undefined;

  const subcategoriaInicial = (() => {
    if (!accionId) return "todos";
    if (accionId === "parchado") return "parchados";
    if (accionId === "balanceo") return "balanceo";
    if (accionId === "enllante") return "enllante";
    if (accionId === "inflado") return "inflado";
    if (accionId === "parches-insumos") return "parches_insumos";
    if (accionId === "venta-llanta") return "llantas";
    if (accionId === "accesorio") return "accesorios";
    return "todos";
  })();

  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>(subcategoriaInicial);
  const [busqueda, setBusqueda] = useState("");

  function cambiarCantidad(nuevaCant: number) {
    const cantValida = Math.max(1, nuevaCant);
    setCantidad(cantValida);
    setPrecioFinal((precioUnitario * cantValida).toFixed(2));
    setMontoCapital((capitalUnitario * cantValida).toFixed(2));
  }

  if (!tipoValido || !accion) {
    return <Navigate to={tipoValido ? `/${tipo}` : "/llanteria"} replace />;
  }

  if (cargandoNegocio || !negocio) return null;

  async function enviar(confirmarBajoMinimo = false) {
    if (!negocio || !productoElegido) return;
    if (usuarioId === null) {
      setError(errorUsuario ?? "Todavía no se pudo resolver el usuario del negocio.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const creado = await api.createMovimiento(
        negocio.id,
        {
          // Sigue sin haber login por empleado (CLAUDE.md, "Fuera de
          // alcance por ahora") — usuarioId es el único usuario que
          // siembra el backend al crear el negocio, no uno elegido.
          usuario_id: usuarioId,
          producto_id: productoElegido.id,
          cliente_vehiculo_id: null,
          tipo: accion!.categoria === "producto" ? "venta" : "servicio",
          cantidad: cantidad,
          descripcion: cantidad > 1 ? `${cantidad}x ${accion!.label}` : accion!.label,
          precio_lista: (Number(productoElegido.precio_lista) * cantidad).toFixed(2),
          precio_final: parseMoneyInput(precioFinal),
          monto_capital: esCapital(productoElegido.clasificacion)
            ? Number(parseMoneyInput(montoCapital))
            : null,
          metodo_pago: metodoPago,
          fecha: new Date().toISOString(),
        },
        { confirmarBajoMinimo },
      );
      setMovimientoCreado(creado);
      setExito(true);
      recargar();
    } catch (err) {
      if (err instanceof StockBajoMinimoError && !confirmarBajoMinimo) {
        setPidiendoConfirmacion(true);
      } else if (err instanceof ApiError) {
        setError(err.message || "No se pudo registrar el movimiento");
      } else {
        setError("No se pudo registrar el movimiento");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function anularVentaRecienCreada() {
    if (!negocio || !movimientoCreado) return;
    setAnulando(true);
    setErrorAnular(null);
    try {
      await api.deleteMovimiento(negocio.id, movimientoCreado.id);
      await recargar();
      setModalAnularAbierto(false);
      navigate(`/${tipo}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorAnular(err.message || "No se pudo anular la venta");
      } else {
        setErrorAnular(err instanceof Error ? err.message : "Error inesperado al anular la venta");
      }
    } finally {
      setAnulando(false);
    }
  }

  // Generar texto estructurado para WhatsApp
  const generarTextoWhatsApp = () => {
    if (!negocio || !productoElegido) return "";
    const fechaHora = new Date().toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const metodo =
      metodoPago === "efectivo" ? "Efectivo" : "Digital (Yape / Plin / Tarjeta)";
    const detalleCondicion = productoElegido.estado_uso
      ? esProductoNuevo(productoElegido.estado_uso)
        ? "Nuevo"
        : "De segunda"
      : "";

    let texto = `*🧾 COMPROBANTE DE ATENCIÓN*\n`;
    texto += `🏢 *${negocio.nombre}*\n`;
    texto += `📅 Fecha: ${fechaHora}\n`;
    if (movimientoCreado?.id) {
      texto += `🔖 Ticket N°: #${String(movimientoCreado.id).padStart(5, "0")}\n`;
    }
    texto += `----------------------------------------\n`;
    texto += `✅ *${cantidad > 1 ? `${cantidad}x ` : ""}${productoElegido.nombre}*\n`;
    if (productoElegido.medida) texto += `• Medida: ${productoElegido.medida}\n`;
    if (productoElegido.marca) texto += `• Marca: ${productoElegido.marca}\n`;
    if (detalleCondicion) texto += `• Condición: ${detalleCondicion}\n`;
    texto += `• Cantidad: ${cantidad}\n`;
    if (cantidad > 1) {
      texto += `• Precio unit.: S/ ${precioUnitario.toFixed(2)}\n`;
    }
    texto += `\n💰 Total Pagado: *S/ ${Number(parseMoneyInput(precioFinal)).toFixed(2)}*\n`;
    texto += `💳 Método de Pago: ${metodo}\n`;
    texto += `----------------------------------------\n`;
    texto += `¡Muchas gracias por su preferencia! 🙏✨\n`;
    return texto;
  };

  const enviarTicketWhatsApp = () => {
    const texto = generarTextoWhatsApp();
    const cleanPhone = telefonoTicket.replace(/\D/g, "");
    const targetPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;
    const url = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const imprimirTicket = () => {
    window.print();
  };

  if (exito) {
    const fechaHora = new Date().toLocaleString("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    return (
      <div className={styles.ticketContainer}>
        {/* Tarjeta de Ticket Estilo Recibo Físico */}
        <div className={styles.ticketCard} id="seccion-ticket-imprimible">
          <div className={styles.ticketHeader}>
            <div className={styles.ticketBadge}>
              <ReceiptIcon size={24} />
            </div>
            <h2 className={styles.ticketBusinessName}>{negocio.nombre}</h2>
            <span className={styles.ticketSubtitle}>Comprobante de Atención</span>
            {movimientoCreado?.id && (
              <span className={styles.ticketNumber}>
                Ticket #{String(movimientoCreado.id).padStart(5, "0")}
              </span>
            )}
            <span className={styles.ticketDate}>{fechaHora}</span>
          </div>

          <div className={styles.ticketDivider} />

          <div className={styles.ticketBody}>
            <div className={styles.ticketItemRow}>
              <div>
                <span className={styles.ticketItemName}>
                  {cantidad > 1 ? `${cantidad}x ` : ""}{productoElegido?.nombre}
                </span>
                <div className={styles.ticketItemDetails}>
                  <span>Cant: {cantidad} &nbsp;|&nbsp; S/ {precioUnitario.toFixed(2)} c/u</span>
                  {productoElegido?.medida && <span>Medida: {productoElegido.medida}</span>}
                  {productoElegido?.marca && <span>Marca: {productoElegido.marca}</span>}
                  {productoElegido?.estado_uso && (
                    <span className={styles.ticketConditionBadge}>
                      {esProductoNuevo(productoElegido.estado_uso)
                        ? "Nuevo"
                        : "De segunda"}
                    </span>
                  )}
                </div>
              </div>
              <span className={styles.ticketItemPrice}>
                S/ {Number(parseMoneyInput(precioFinal)).toFixed(2)}
              </span>
            </div>
          </div>

          <div className={styles.ticketDivider} />

          <div className={styles.ticketSummary}>
            <div className={styles.ticketTotalRow}>
              <span>TOTAL PAGADO</span>
              <span className={styles.ticketTotalAmount}>
                S/ {Number(parseMoneyInput(precioFinal)).toFixed(2)}
              </span>
            </div>
            <div className={styles.ticketPaymentRow}>
              <span>Método de pago</span>
              <span className={styles.ticketPaymentBadge}>
                {metodoPago === "efectivo" ? "Efectivo" : "Digital (Yape / Plin)"}
              </span>
            </div>
          </div>

          <div className={styles.ticketFooter}>
            <p>¡Gracias por su preferencia!</p>
          </div>
        </div>

        {/* Acciones del Ticket: WhatsApp e Impresión */}
        <div className={styles.ticketActionsCard}>
          <h3 className={styles.ticketActionsTitle}>Compartir con el Cliente</h3>

          <div className={styles.phoneInputGroup}>
            <label className={styles.phoneLabel}>
              <span>Número de WhatsApp (opcional)</span>
              <div className={styles.phoneInputWrapper}>
                <span className={styles.phonePrefix}>+51</span>
                <input
                  type="tel"
                  className={styles.phoneInput}
                  placeholder="987 654 321"
                  maxLength={9}
                  value={telefonoTicket}
                  onChange={(e) => setTelefonoTicket(e.target.value)}
                />
              </div>
            </label>

            <Button
              variant="primary"
              onClick={enviarTicketWhatsApp}
              className={styles.whatsappBtn}
            >
              <ChatIcon size={18} />
              <span>Enviar Ticket por WhatsApp</span>
            </Button>
          </div>

          <div className={styles.secondaryActionsRow}>
            <Button
              variant="outline"
              onClick={imprimirTicket}
              className={styles.printBtn}
            >
              <PrintIcon size={18} />
              <span>Imprimir Recibo</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setPaso("elegir");
                setMedidaElegida(null);
                setProductoElegido(null);
                setPrecioFinal("");
                setMontoCapital("");
                setExito(false);
                setMovimientoCreado(null);
                setTelefonoTicket("");
                setModalAnularAbierto(false);
                setBusqueda("");
                setFiltroSubcategoria(subcategoriaInicial);
              }}
            >
              <PlusIcon size={18} />
              <span>Nueva Venta</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => setModalAnularAbierto(true)}
            className={styles.anularVentaBtn}
          >
            <span>↩️ Anular venta / Prueba</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate(`/${tipo}`)}
            className={styles.backHomeBtn}
          >
            <span>Volver a Inicio</span>
          </Button>
        </div>

        {/* Modal Confirmación Anular Venta / Prueba */}
        {modalAnularAbierto && (
          <div
            className={styles.modalOverlay}
            onClick={() => !anulando && setModalAnularAbierto(false)}
          >
            <div
              className={styles.modalCard}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.deleteIconWrap}>
                <TrashIcon size={24} />
              </div>

              <h2 className={styles.modalTitle}>¿Anular esta venta recién registrada?</h2>

              <div className={styles.deleteItemSummary}>
                <span className={styles.deleteItemName}>{productoElegido?.nombre}</span>
                <span className={styles.deleteItemDetail}>
                  S/ {Number(parseMoneyInput(precioFinal)).toFixed(2)}
                </span>
              </div>

              <p className={styles.deleteWarningNote}>
                Se devolverá el stock al inventario y se eliminará por completo del registro de caja sin dejar rastro.
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
                  onClick={() => setModalAnularAbierto(false)}
                  disabled={anulando}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={anularVentaRecienCreada}
                  disabled={anulando}
                >
                  {anulando ? "Anulando…" : "Sí, anular venta"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // El backend solo distingue "capital" (inventario físico) de todo lo
  // demás (ver lib/contabilidad.ts) — nunca compara contra "producto" ni
  // "servicio" literal, esos son categoría de PANTALLA.
  const candidatos = productos.filter(
    (p) => p.activo && esCapital(p.clasificacion) === (accion.categoria === "producto"),
  );

  const esServicio = accion.categoria === "servicio";

  const hayProductosConEstado =
    candidatos.some((p) => Boolean(p.estado_uso)) || accion.agruparPorMedida;

  const candidatosFiltrados = candidatos.filter((p) => {
    if (filtroEstadoUso === "nuevo") return esProductoNuevo(p.estado_uso);
    if (filtroEstadoUso === "usado") return esProductoUsado(p.estado_uso);
    return true;
  });

  // Filtro por búsqueda de texto interactiva
  const q = busqueda.trim().toLowerCase();
  const candidatosConBusqueda = candidatosFiltrados.filter((p) => {
    if (!q) return true;
    const matchNom = (p.nombre || "").toLowerCase().includes(q);
    const matchMed = (p.medida || "").toLowerCase().includes(q);
    const matchMar = (p.marca || "").toLowerCase().includes(q);
    return matchNom || matchMed || matchMar;
  });

  // Agrupación y ordenamiento inteligente por categoría
  const subcatsServicio: SubcategoriaServicio[] = [
    "parchados",
    "balanceo",
    "enllante",
    "inflado",
    "otros",
  ];
  const subcatsProducto: SubcategoriaProducto[] = [
    "parches_insumos",
    "llantas",
    "aceites",
    "aditivos",
    "accesorios",
    "otros",
  ];

  const gruposCategorias: { info: InfoCategoriaVisual; items: Producto[] }[] = esServicio
    ? subcatsServicio.map((catId) => {
        const items = candidatosConBusqueda.filter((p) => clasificarServicio(p) === catId);
        return {
          info: CATEGORIAS_SERVICIOS_INFO[catId],
          items: ordenarProductosDeCategoria(items, catId),
        };
      })
    : subcatsProducto.map((catId) => {
        const items = candidatosConBusqueda.filter((p) => clasificarProductoFisico(p) === catId);
        return {
          info: CATEGORIAS_PRODUCTOS_INFO[catId],
          items: ordenarProductosDeCategoria(items, catId),
        };
      });

  // Solo categorías que tengan al menos 1 producto según los filtros actuales
  const categoriasConItems = gruposCategorias.filter((c) => c.items.length > 0);

  // Categorías que se mostrarán en la vista
  const categoriasAMostrar =
    filtroSubcategoria === "todos"
      ? categoriasConItems
      : categoriasConItems.filter((c) => c.info.id === filtroSubcategoria);

  // Medidas disponibles para llantas (en caso aplique agrupación por medida)
  const itemsLlantas = candidatosFiltrados.filter(
    (p) => clasificarProductoFisico(p) === "llantas"
  );
  const medidas = [
    ...new Set(itemsLlantas.map((p) => p.medida).filter((m): m is string => Boolean(m))),
  ];
  const enPasoMedida =
    accion.agruparPorMedida &&
    !medidaElegida &&
    (filtroSubcategoria === "llantas" || filtroSubcategoria === "todos") &&
    !busqueda;

  function seleccionarProducto(p: Producto) {
    setProductoElegido(p);
    const pUnit = Number(p.precio_lista) || 0;
    const cUnit = Number(p.precio_compra) || 0;
    setPrecioUnitario(pUnit);
    setCapitalUnitario(cUnit);
    setCantidad(1);
    setPrecioFinal(p.precio_lista);
    setMontoCapital(p.precio_compra ?? "0");
    setPaso("precio");
  }

  function renderCardProducto(p: Producto) {
    const badge = getEstadoUsoBadge(p.estado_uso);
    return (
      <button
        key={p.id}
        type="button"
        className={styles.optionRow}
        onClick={() => seleccionarProducto(p)}
      >
        <div className={styles.optionInfo}>
          <div className={styles.optionHeader}>
            <span className={styles.optionName}>{p.nombre}</span>
            {badge && (
              <span
                className={
                  badge.tipo === "nuevo" ? styles.badgeNuevo : styles.badgeUsado
                }
              >
                {badge.label}
              </span>
            )}
          </div>
          <div className={styles.optionMetaRow}>
            {p.medida && (
              <span className={styles.medidaBadge}>
                {p.medida}
              </span>
            )}
            {p.marca && <span className={styles.marcaBadge}>• {p.marca}</span>}
          </div>
        </div>
        <span className={styles.optionPrice}>{formatMoney(p.precio_lista)}</span>
      </button>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate(`/${tipo}`)}
          aria-label="Volver a inicio"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <h1 className={styles.title}>{accion.label}</h1>
      </div>

      <ol className={styles.stepper}>
        {PASOS.map((p, i) => {
          const actual = PASOS.findIndex((x) => x.id === paso);
          const estado = i < actual ? "hecho" : i === actual ? "activo" : "pendiente";
          return (
            <li key={p.id} className={styles.step}>
              <span className={`${styles.stepCircle} ${styles[estado]}`}>
                {estado === "hecho" ? <CheckIcon size={14} /> : i + 1}
              </span>
              <span className={styles.stepLabel}>{p.label}</span>
              {i < PASOS.length - 1 && <span className={`${styles.stepLine} ${styles[estado]}`} />}
            </li>
          );
        })}
      </ol>

      {paso === "elegir" && (
        <section className={styles.sectionElegir}>
          {cargandoProductos ? (
            <p className={styles.muted}>Cargando…</p>
          ) : candidatos.length === 0 ? (
            <EmptyState
              icon={<AlertTriangleIcon size={22} />}
              title={`No hay ${esServicio ? "servicios" : "productos"} de este tipo`}
              message="Agregalos primero desde Stock para poder registrar esta acción."
              action={<Button onClick={() => navigate(`/${tipo}/stock`)}>Ir a Stock</Button>}
            />
          ) : (
            <>
              {/* 1. Barra de Filtros por Categoría (Chips / Tabs) */}
              {categoriasConItems.length > 0 && (
                <div className={styles.categoryTabsBar} role="tablist" aria-label="Filtrar categoría">
                  <button
                    type="button"
                    className={`${styles.categoryTab} ${filtroSubcategoria === "todos" ? styles.categoryTabActive : ""}`}
                    onClick={() => {
                      setFiltroSubcategoria("todos");
                      setMedidaElegida(null);
                    }}
                  >
                    <span>📋 Todos</span>
                    <span className={styles.categoryTabCount}>{candidatosConBusqueda.length}</span>
                  </button>
                  {categoriasConItems.map(({ info, items }) => (
                    <button
                      key={info.id}
                      type="button"
                      className={`${styles.categoryTab} ${filtroSubcategoria === info.id ? styles.categoryTabActive : ""}`}
                      onClick={() => {
                        setFiltroSubcategoria(info.id);
                        setMedidaElegida(null);
                      }}
                    >
                      <span>{info.emoji} {info.label}</span>
                      <span className={styles.categoryTabCount}>{items.length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 2. Filtro de Condición (Nuevo / Usado) y Buscador Rápido */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                {hayProductosConEstado && (
                  <div className={styles.filterPills} role="group" aria-label="Filtrar por condición">
                    <button
                      type="button"
                      className={`${styles.filterPill} ${filtroEstadoUso === "todas" ? styles.filterPillActive : ""}`}
                      onClick={() => setFiltroEstadoUso("todas")}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${filtroEstadoUso === "nuevo" ? styles.filterPillActive : ""}`}
                      onClick={() => setFiltroEstadoUso("nuevo")}
                    >
                      Nuevas
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${filtroEstadoUso === "usado" ? styles.filterPillActive : ""}`}
                      onClick={() => setFiltroEstadoUso("usado")}
                    >
                      Usadas / Segunda
                    </button>
                  </div>
                )}

                {/* Buscador de texto interactivo */}
                <div className={styles.searchFilterWrap}>
                  <span className={styles.searchIcon}>
                    <SearchIcon size={16} />
                  </span>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={`Buscar ${esServicio ? "servicio" : "producto"} (ej: 00, RAC, balanceo, 185)...`}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => setBusqueda("")}
                      style={{
                        position: "absolute",
                        right: "10px",
                        background: "none",
                        border: "none",
                        color: "var(--ink-soft)",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                      aria-label="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Selección de Medida para Llantas si aplica */}
              {enPasoMedida ? (
                <>
                  <p className={styles.stepHint}>Elegí la medida de llanta</p>
                  {medidas.length === 0 ? (
                    <p className={styles.muted}>No hay medidas disponibles con ese filtro.</p>
                  ) : (
                    <div className={styles.optionList}>
                      {medidas.map((medida) => (
                        <button
                          key={medida}
                          type="button"
                          className={styles.optionRow}
                          onClick={() => setMedidaElegida(medida)}
                        >
                          <span style={{ fontWeight: 600 }}>{medida}</span>
                          <span className={styles.muted}>Ver marcas →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {medidaElegida && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className={styles.stepHint}>Marcas en stock para: <strong>{medidaElegida}</strong></span>
                      <button
                        type="button"
                        className={styles.linkBack}
                        onClick={() => setMedidaElegida(null)}
                      >
                        ← Cambiar medida
                      </button>
                    </div>
                  )}

                  {/* 4. Columnas distintas organizadas o categoría específica */}
                  {categoriasAMostrar.length > 0 ? (
                    <div className={styles.columnasGrid}>
                      {categoriasAMostrar.map(({ info, items }) => {
                        const itemsFinales = medidaElegida
                          ? items.filter((p) => p.medida === medidaElegida)
                          : items;

                        if (itemsFinales.length === 0) return null;

                        return (
                          <div key={info.id} className={styles.columnaCard}>
                            <div className={styles.columnaHeader}>
                              <div className={styles.columnaTitleGroup}>
                                <span className={styles.columnaEmoji}>{info.emoji}</span>
                                <h3 className={styles.columnaTitle}>{info.label}</h3>
                              </div>
                              <span className={styles.columnaBadge}>
                                {itemsFinales.length} {itemsFinales.length === 1 ? "ítem" : "ítems"}
                              </span>
                            </div>

                            <div className={styles.columnaBody}>
                              {itemsFinales.map((p) => renderCardProducto(p))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.muted} style={{ textAlign: "center", padding: "28px 0" }}>
                      <p>No se encontraron ítems en esta sección con los filtros actuales.</p>
                      {filtroSubcategoria !== "todos" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFiltroSubcategoria("todos")}
                        >
                          Ver todos los {esServicio ? "servicios" : "productos"}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {paso === "precio" && productoElegido && (() => {
        const esProdCapital = esCapital(productoElegido.clasificacion);
        const badge = getEstadoUsoBadge(productoElegido.estado_uso);
        const numPrecio = Number(parseMoneyInput(precioFinal)) || 0;
        const numCapital = Number(parseMoneyInput(montoCapital)) || 0;
        const gananciaNeta = numPrecio - numCapital;

        return (
          <section className={styles.section}>
            <div className={styles.summaryChip}>
              <div>
                <div className={styles.optionHeader}>
                  <div className={styles.summaryName}>{productoElegido.nombre}</div>
                  {badge && (
                    <span
                      className={
                        badge.tipo === "nuevo" ? styles.badgeNuevo : styles.badgeUsado
                      }
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
                {productoElegido.marca && <div className={styles.optionSub}>{productoElegido.marca}</div>}
              </div>
            </div>

            {/* Control Interactivo de Cantidad */}
            <div className={styles.cantidadCard}>
              <div className={styles.cantidadHeader}>
                <label className={styles.fieldLabel} htmlFor="stepper-cantidad">
                  Cantidad a registrar
                </label>
                {esProdCapital && (
                  <span className={styles.stockDisponibleBadge}>
                    Stock actual: {productoElegido.stock_actual}
                  </span>
                )}
              </div>

              <div className={styles.stepperContainer}>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() => cambiarCantidad(cantidad - 1)}
                  disabled={cantidad <= 1}
                  aria-label="Disminuir cantidad"
                >
                  −
                </button>
                <div className={styles.stepperInputWrapper}>
                  <input
                    id="stepper-cantidad"
                    type="number"
                    min="1"
                    max={esProdCapital ? Math.max(1, productoElegido.stock_actual) : 999}
                    value={cantidad}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        cambiarCantidad(val);
                      }
                    }}
                    className={styles.stepperInput}
                  />
                  <span className={styles.stepperUnitLabel}>
                    {cantidad === 1 ? "unidad" : "unidades"}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() => cambiarCantidad(cantidad + 1)}
                  disabled={esProdCapital && cantidad >= productoElegido.stock_actual}
                  aria-label="Aumentar cantidad"
                >
                  +
                </button>
              </div>

              {/* Botones de selección rápida 1, 2, 3, 4 */}
              <div className={styles.quickCantPills} role="group" aria-label="Cantidad rápida">
                {[1, 2, 3, 4].map((n) => {
                  const deshabilitado = esProdCapital && n > productoElegido.stock_actual;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.quickCantPill} ${cantidad === n ? styles.quickCantPillActive : ""}`}
                      onClick={() => cambiarCantidad(n)}
                      disabled={deshabilitado}
                    >
                      {n} {n === 1 ? "unidad" : "unidades"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.priceCard}>
              <div className={styles.priceRow}>
                <span className={styles.muted}>
                  Precio unitario de lista {cantidad > 1 ? `(x ${cantidad})` : ""}
                </span>
                <span className={styles.strike}>
                  {formatMoney((precioUnitario * cantidad).toFixed(2))}
                </span>
              </div>

              <label className={styles.fieldLabel} htmlFor="precio-final">
                {esProdCapital ? "Total a cobrar" : "Total final a cobrar"}
                {cantidad > 1 && (
                  <span className={styles.unitSubHint}>
                    ({cantidad} x {formatMoney(precioUnitario.toFixed(2))})
                  </span>
                )}
              </label>
              <div className={styles.priceInput}>
                <span>S/</span>
                <input
                  id="precio-final"
                  inputMode="decimal"
                  value={precioFinal}
                  onChange={(e) => setPrecioFinal(e.target.value)}
                />
              </div>

              {esProdCapital && (
                <>
                  <label className={styles.fieldLabel} htmlFor="monto-capital">
                    Total capital a reponer
                    {cantidad > 1 && (
                      <span className={styles.unitSubHint}>
                        ({cantidad} x {formatMoney(capitalUnitario.toFixed(2))})
                      </span>
                    )}
                  </label>
                  <div className={styles.priceInput}>
                    <span>S/</span>
                    <input
                      id="monto-capital"
                      inputMode="decimal"
                      value={montoCapital}
                      onChange={(e) => setMontoCapital(e.target.value)}
                    />
                  </div>
                  <p className={styles.fieldHint}>
                    Costo base para reponer {cantidad} unidad(es) de inventario.
                  </p>

                  <div className={`${styles.gananciaBox} ${gananciaNeta < 0 ? styles.gananciaNegativa : ""}`}>
                    <div className={styles.gananciaHeader}>
                      <span className={styles.gananciaLabel}>Ganancia neta estimada</span>
                      <span className={styles.gananciaValor}>
                        {gananciaNeta >= 0 ? "+" : ""}{formatMoney(gananciaNeta.toFixed(2))}
                      </span>
                    </div>
                    <div className={styles.gananciaFormula}>
                      <span>Cobro {formatMoney(numPrecio.toFixed(2))}</span>
                      <span>−</span>
                      <span>Capital {formatMoney(numCapital.toFixed(2))}</span>
                      <span>=</span>
                      <span>{formatMoney(gananciaNeta.toFixed(2))}</span>
                    </div>
                  </div>
                </>
              )}

              {!esProdCapital && (
                <p className={styles.fieldHint}>
                  {cantidad > 1
                    ? `Calculado para ${cantidad} unidades. Puedes ajustar el total si realizaste un descuento o combo especial.`
                    : "Se guardan ambos precios: el de lista y el que cobraste."}
                </p>
              )}
            </div>

            <Button
              fullWidth
              onClick={() => {
                setPrecioFinal(parseMoneyInput(precioFinal));
                setMontoCapital(parseMoneyInput(montoCapital));
                setPaso("confirmar");
              }}
            >
              Continuar
            </Button>
          </section>
        );
      })()}

      {paso === "confirmar" && productoElegido && (() => {
        const esProdCapital = esCapital(productoElegido.clasificacion);
        const badge = getEstadoUsoBadge(productoElegido.estado_uso);
        const numPrecio = Number(parseMoneyInput(precioFinal)) || 0;
        const numCapital = Number(parseMoneyInput(montoCapital)) || 0;
        const gananciaNeta = numPrecio - numCapital;

        return (
          <section className={styles.section}>
            <div className={styles.summaryChip}>
              <div>
                <div className={styles.optionHeader}>
                  <div className={styles.summaryName}>
                    {cantidad > 1 ? `${cantidad}x ` : ""}{productoElegido.nombre}
                  </div>
                  {badge && (
                    <span
                      className={
                        badge.tipo === "nuevo" ? styles.badgeNuevo : styles.badgeUsado
                      }
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className={styles.optionSub}>
                  Cantidad: <strong>{cantidad}</strong> {cantidad === 1 ? "unidad" : "unidades"}
                  {cantidad > 1 && ` • S/ ${precioUnitario.toFixed(2)} c/u`}
                  {productoElegido.marca && ` • ${productoElegido.marca}`}
                </div>
              </div>
              <span className={styles.optionPrice}>{formatMoney(parseMoneyInput(precioFinal))}</span>
            </div>

            {esProdCapital && (
              <div className={styles.desgloseCard}>
                <div className={styles.desgloseRow}>
                  <span className={styles.muted}>Capital a reponer:</span>
                  <span className={styles.desgloseVal}>{formatMoney(numCapital.toFixed(2))}</span>
                </div>
                <div className={styles.desgloseRow}>
                  <span className={styles.muted}>Ganancia neta:</span>
                  <span
                    className={`${styles.desgloseVal} ${gananciaNeta >= 0 ? styles.gananciaPositivaText : styles.gananciaNegativaText}`}
                  >
                    {gananciaNeta >= 0 ? "+" : ""}{formatMoney(gananciaNeta.toFixed(2))}
                  </span>
                </div>
              </div>
            )}

            <div>
              <p className={styles.fieldLabel}>Método de pago</p>
              <div className={styles.paymentGrid}>
                <button
                  type="button"
                  className={`${styles.paymentOption} ${metodoPago === "efectivo" ? styles.paymentOptionActive : ""}`}
                  onClick={() => setMetodoPago("efectivo")}
                >
                  <CashIcon size={22} />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  className={`${styles.paymentOption} ${metodoPago === "digital" ? styles.paymentOptionActive : ""}`}
                  onClick={() => setMetodoPago("digital")}
                >
                  <CardIcon size={22} />
                  <span>Digital</span>
                </button>
              </div>
            </div>

            {pidiendoConfirmacion && (
              <div className={styles.warnBox}>
                <AlertTriangleIcon size={18} />
                <div>
                  <p className={styles.warnTitle}>Esto deja el stock bajo el mínimo</p>
                  <p className={styles.fieldHint}>¿Confirmás la venta igual?</p>
                  <div className={styles.warnActions}>
                    <Button variant="accent" onClick={() => enviar(true)} disabled={enviando || usuarioId === null}>
                      Sí, confirmar
                    </Button>
                    <Button variant="ghost" onClick={() => setPidiendoConfirmacion(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            {!pidiendoConfirmacion && (
              <>
                <div className={styles.mobileStickyBar}>
                  <div>
                    <div className={styles.stickyTotalLabel}>Total a cobrar</div>
                    <div className={styles.stickyTotalAmount}>
                      {formatMoney(parseMoneyInput(precioFinal))}
                    </div>
                  </div>
                  <Button
                    onClick={() => enviar(false)}
                    disabled={enviando || usuarioId === null}
                  >
                    {enviando ? "Registrando…" : "Confirmar ✓"}
                  </Button>
                </div>

                <Button fullWidth onClick={() => enviar(false)} disabled={enviando || usuarioId === null}>
                  {enviando ? "Registrando…" : `Confirmar ${accion.categoria === "producto" ? "venta" : "servicio"}`}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => navigate(`/${tipo}`)}>
              Cancelar
            </Button>
          </section>
        );
      })()}
    </>
  );
}
