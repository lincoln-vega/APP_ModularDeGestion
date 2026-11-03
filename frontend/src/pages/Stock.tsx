import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { useNegocioDelTipo } from "../hooks/useNegocioDelTipo";
import { useProductos } from "../api/useProductos";
import {
  api,
  ApiError,
  ProductoDuplicadoError,
  type Producto,
  type ProductoCandidatoDuplicado,
} from "../api/client";
import { formatMoney } from "../lib/format";
import { esCapital, getEstadoUsoBadge } from "../lib/contabilidad";
import {
  AlertTriangleIcon,
  BoxIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  TireIcon,
  TrashIcon,
  WrenchIcon,
} from "../components/icons/Icons";
import {
  CATEGORIAS_DEFAULT,
  ACEITES_VISCOSIDADES_DEFAULT,
  ACEITES_MARCAS_DEFAULT,
  ACEITES_PRESENTACIONES_DEFAULT,
  ADITIVOS_PLANTILLAS_DEFAULT,
  ACCESORIOS_PLANTILLAS_DEFAULT,
  getCustomCatalog,
  addCustomAro,
  removeCustomAro,
  addCustomMarca,
  removeCustomMarca,
  addCustomMedida,
  removeCustomMedida,
  type CategoriaPreset,
} from "../data/catalogoPresets";
import styles from "./Stock.module.css";

type TabPrincipal = "productos" | "servicios" | "todos";
type VistaStock = "marca" | "general";

// Opciones esenciales más comunes en talleres para evitar saturación visual
export const AROS_COMUNES_DEFAULT = ["Aro 13", "Aro 14", "Aro 15", "Aro 16"];

export const MEDIDAS_COMUNES_POR_ARO_DEFAULT: Record<string, string[]> = {
  "Aro 13": ["175/70 R13", "165/70 R13", "185/70 R13"],
  "Aro 14": ["175/70 R14", "185/65 R14", "185/60 R14", "195/70 R14"],
  "Aro 15": ["185/65 R15", "195/65 R15", "185/60 R15", "195/70 R15"],
  "Aro 16": ["205/55 R16", "215/65 R16", "205/60 R16"],
  "Aro 17": ["215/55 R17", "225/65 R17"],
};

export const MARCAS_COMUNES_DEFAULT = [
  "Goodyear",
  "Michelin",
  "Bridgestone",
  "Linglong",
  "Westlake",
];

export const SERVICIOS_TALLER_COMUNES = [
  "Parchado de auto (frío)",
  "Parchado de auto (tarugo)",
  "Vulcanizado de llanta",
  "Balanceo Aro Fierro",
  "Balanceo Aro Aluminio",
  "Enllante y Desenllante",
  "Inflado con Nitrógeno",
];

export const INSUMOS_TALLER_COMUNES = [
  "Parche radial Nro 12",
  "Parche frío redondo Nro 01",
  "Pitón Válvula TR-414",
  "Cámara de aire Aro 13-14",
  "Cemento vulcanizante / Pegamento",
];

/**
 * Determina la categoría de un producto de forma inteligente según su nombre,
 * medida y clasificación para los filtros dinámicos.
 */
export function obtenerCategoriaProducto(p: Producto): string {
  const nom = (p.nombre || "").toLowerCase();
  const med = (p.medida || "").toUpperCase();

  // Si no es capital, es mano de obra / servicio directo
  if (!esCapital(p.clasificacion)) {
    return "servicios";
  }

  // Llantas físicas (medidas de aro R13-R24 o nombre con llanta/neumático)
  if (
    med.includes("R1") ||
    med.includes("R2") ||
    nom.includes("llanta") ||
    nom.includes("neumat")
  ) {
    return "llantas";
  }

  // Aceites y lubricantes de motor/caja
  if (
    nom.includes("aceite") ||
    nom.includes("lubric") ||
    med.includes("W-") ||
    med.includes("SAE")
  ) {
    return "aceites";
  }

  // Insumos físicos de llantería: parches, vulcanización, válvulas, cámaras, mechas
  if (
    nom.includes("parche") ||
    nom.includes("camara") ||
    nom.includes("cámara") ||
    nom.includes("mecha") ||
    nom.includes("tarugo") ||
    nom.includes("vulcaniz") ||
    nom.includes("valvula") ||
    nom.includes("válvula") ||
    nom.includes("piton") ||
    nom.includes("pitón") ||
    nom.includes("cemento")
  ) {
    return "parches";
  }

  // Aditivos y fluidos de mantenimiento
  if (
    nom.includes("refrigerante") ||
    nom.includes("coolant") ||
    nom.includes("freno") ||
    nom.includes("aditivo") ||
    nom.includes("inyector") ||
    nom.includes("bateria") ||
    nom.includes("batería") ||
    nom.includes("desengrasante") ||
    nom.includes("spray") ||
    nom.includes("wd-40") ||
    nom.includes("silicona")
  ) {
    return "aditivos";
  }

  // Accesorios y repuestos mecánicos
  if (
    nom.includes("filtro") ||
    nom.includes("plumilla") ||
    nom.includes("tuerca") ||
    nom.includes("perno") ||
    nom.includes("tapa") ||
    nom.includes("repuesto")
  ) {
    return "accesorios";
  }

  return "otro";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Formatea la tarjeta de producto para mostrar Marca arriba y Medida abajo
 * de forma limpia, tal como lo solicitó el usuario, evitando redundancias.
 */
export function formatProductCardTitles(p: Producto) {
  const marca = p.marca?.trim();
  const medida = p.medida?.trim();
  const nombre = p.nombre.trim();

  if (marca && medida) {
    const cleanedNombre = nombre
      .replace(/^Llanta\s*/i, "")
      .replace(/^Aceite\s*/i, "")
      .replace(new RegExp(escapeRegex(medida), "i"), "")
      .replace(new RegExp(escapeRegex(marca), "i"), "")
      .replace(/[()·-]/g, "")
      .trim();

    const isRedundant =
      cleanedNombre.length <= 2 ||
      marca.toLowerCase().includes(cleanedNombre.toLowerCase()) ||
      cleanedNombre.toLowerCase().includes(marca.toLowerCase());

    return {
      titulo: marca,
      subtitulo: medida,
      detalleExtra: isRedundant ? null : cleanedNombre,
    };
  }

  if (marca) {
    const cleanedNombre = nombre.replace(new RegExp(escapeRegex(marca), "i"), "").trim();
    return {
      titulo: marca,
      subtitulo: cleanedNombre && cleanedNombre !== nombre ? cleanedNombre : null,
      detalleExtra: null,
    };
  }

  if (medida) {
    return {
      titulo: nombre,
      subtitulo: medida,
      detalleExtra: null,
    };
  }

  return {
    titulo: nombre,
    subtitulo: esCapital(p.clasificacion) ? null : "Mano de obra / Servicio",
    detalleExtra: null,
  };
}


export default function Stock() {
  const navigate = useNavigate();
  const { tipo, negocio, loading: cargandoNegocio } = useNegocioDelTipo();
  const { productos, loading: cargandoProductos, recargar } = useProductos(negocio?.id);

  // Tabs y Filtros
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("productos");
  const [vistaStock, setVistaStock] = useState<VistaStock>("marca");
  const [busqueda, setBusqueda] = useState("");
  const [medidasExpandidas, setMedidasExpandidas] = useState<Set<string>>(new Set());

  // Filtro por Categoría en la cabecera (muy aparte de los tabs de tipo)
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  // Estado del Modal de Creación Asistida
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>("llantas");
  const [tipoItemNuevo, setTipoItemNuevo] = useState<"producto" | "servicio">("producto");
  const [aroActivo, setAroActivo] = useState<string>("Aro 15");
  const [viscosidadAceite, setViscosidadAceite] = useState<string>("10W-40");
  const [presentacionAceite, setPresentacionAceite] = useState<string>("1/4 Galón");
  const [marcaAceite, setMarcaAceite] = useState<string>("Motul");

  // Sub-formularios inline para agregar nuevas opciones sobre la marcha (+ Otra)
  const [inlineAroAbierto, setInlineAroAbierto] = useState(false);
  const [nuevoAroTexto, setNuevoAroTexto] = useState("");
  const [inlineMarcaAbierto, setInlineMarcaAbierto] = useState(false);
  const [nuevaMarcaTexto, setNuevaMarcaTexto] = useState("");
  const [inlineMedidaAbierto, setInlineMedidaAbierto] = useState(false);
  const [nuevaMedidaTexto, setNuevaMedidaTexto] = useState("");
  const [aroParaNuevaMedida, setAroParaNuevaMedida] = useState("Aro 15");

  // Estados específicos para el módulo unificado de Parchados y Servicios
  const [subTipoParchado, setSubTipoParchado] = useState<"servicio" | "insumo">("servicio");
  const [parcheServicioNombre, setParcheServicioNombre] = useState("Parchado de auto (frío)");
  const [parcheInsumoNombre, setParcheInsumoNombre] = useState("Parche radial Nro 12");

  const duplicateBannerRef = useRef<HTMLDivElement>(null);

  // Versión local de catálogo personalizado para forzar re-render
  const [catalogVersion, setCatalogVersion] = useState(0);

  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [candidatosDuplicados, setCandidatosDuplicados] = useState<
    ProductoCandidatoDuplicado[] | null
  >(null);

  useEffect(() => {
    if (candidatosDuplicados && candidatosDuplicados.length > 0) {
      duplicateBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [candidatosDuplicados]);

  const [formNuevo, setFormNuevo] = useState({
    nombre: "",
    medida: "",
    marca: "",
    estado_uso: "nuevo" as "nuevo" | "usado",
    precio_lista: "",
    precio_compra: "",
    stock_actual: "1",
    stock_minimo: "2",
  });

  // Estado del Modal de Edición
  const [itemAEditar, setItemAEditar] = useState<Producto | null>(null);
  const [guardandoEditar, setGuardandoEditar] = useState(false);
  const [errorEditar, setErrorEditar] = useState<string | null>(null);
  const [restockDelta, setRestockDelta] = useState(0);
  const [formEditar, setFormEditar] = useState({
    nombre: "",
    medida: "",
    marca: "",
    estado_uso: "nuevo" as "nuevo" | "usado",
    precio_lista: "",
    precio_compra: "",
    stock_actual: "0",
    stock_minimo: "0",
    activo: true,
  });

  // Estado del Modal de Eliminación
  const [itemAEliminar, setItemAEliminar] = useState<Producto | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // Filtros calculados
  const productosActivos = useMemo(
    () => productos.filter((p) => p.activo),
    [productos],
  );

  const inventarioProductos = useMemo(
    () => productosActivos.filter((p) => esCapital(p.clasificacion)),
    [productosActivos],
  );

  const servicios = useMemo(
    () => productosActivos.filter((p) => !esCapital(p.clasificacion)),
    [productosActivos],
  );

  const conteoProductos = inventarioProductos.length;
  const conteoServicios = servicios.length;
  const conteoTotal = productosActivos.length;

  // Catálogo personalizado del negocio
  const customCatalog = useMemo(() => {
    if (!negocio) {
      return {
        arosPersonalizados: [],
        marcasPersonalizadas: [],
        medidasPersonalizadas: [],
        categoriasPersonalizadas: [],
        plantillasPersonalizadas: [],
      };
    }
    void catalogVersion;
    return getCustomCatalog(negocio.id);
  }, [negocio, catalogVersion]);

  // Lista consolidada de categorías disponibles
  const todasCategorias = useMemo(() => {
    return [...CATEGORIAS_DEFAULT, ...customCatalog.categoriasPersonalizadas];
  }, [customCatalog]);

  // Aros esenciales más comunes (Aro 13 a 16 + agregados por el usuario)
  const listaAros = useMemo(() => {
    const set = new Set([
      ...AROS_COMUNES_DEFAULT,
      ...(customCatalog.arosPersonalizados || []),
    ]);
    return Array.from(set);
  }, [customCatalog]);

  // Marcas esenciales más comunes (+ marcas agregadas por el usuario)
  const todasMarcasLlantas = useMemo(() => {
    const set = new Set([
      ...MARCAS_COMUNES_DEFAULT,
      ...customCatalog.marcasPersonalizadas,
    ]);
    return Array.from(set);
  }, [customCatalog]);

  // Medidas esenciales más comunes para el Aro seleccionado (+ medidas agregadas por el usuario)
  const medidasFiltradas = useMemo(() => {
    const base = MEDIDAS_COMUNES_POR_ARO_DEFAULT[aroActivo] || ["185/65 R15", "195/65 R15"];
    const personalizadas = customCatalog.medidasPersonalizadas
      .filter((item) => (item.aro || "Aro 15") === aroActivo)
      .map((item) => item.medida);

    return Array.from(new Set([...base, ...personalizadas]));
  }, [aroActivo, customCatalog]);

  // Lista de píldoras de filtro por categoría según el tab activo
  const filtrosCategoriaDisponibles = useMemo(() => {
    const universo =
      tabPrincipal === "productos"
        ? inventarioProductos
        : tabPrincipal === "servicios"
          ? servicios
          : productosActivos;

    const conteos: Record<string, number> = {};
    for (const p of universo) {
      const cat = obtenerCategoriaProducto(p);
      conteos[cat] = (conteos[cat] || 0) + 1;
    }

    const opciones: { id: string; label: string; conteo: number }[] = [
      { id: "todas", label: "Todas las categorías", conteo: universo.length },
    ];

    const catalogoDef = [
      { id: "llantas", label: "🚗 Llantas" },
      { id: "parches", label: "🔧 Parches e Insumos" },
      { id: "aceites", label: "🛢️ Aceites y Lubricantes" },
      { id: "aditivos", label: "🧪 Aditivos y Fluidos" },
      { id: "accesorios", label: "🔩 Accesorios y Repuestos" },
      { id: "servicios", label: "🛠️ Servicios y Mano de Obra" },
      { id: "otro", label: "📦 Otros" },
    ];

    for (const cat of catalogoDef) {
      if ((conteos[cat.id] || 0) > 0) {
        opciones.push({
          id: cat.id,
          label: cat.label,
          conteo: conteos[cat.id],
        });
      }
    }

    return opciones;
  }, [tabPrincipal, inventarioProductos, servicios, productosActivos]);

  // Productos físicos filtrados por categoría y buscador
  const inventarioFiltrado = useMemo(() => {
    let lista = inventarioProductos;
    if (filtroCategoria !== "todas") {
      lista = lista.filter((p) => obtenerCategoriaProducto(p) === filtroCategoria);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.marca && p.marca.toLowerCase().includes(q)) ||
          (p.medida && p.medida.toLowerCase().includes(q)),
      );
    }
    return lista;
  }, [inventarioProductos, filtroCategoria, busqueda]);

  // Servicios filtrados por categoría y buscador
  const serviciosFiltrados = useMemo(() => {
    let lista = servicios;
    if (filtroCategoria !== "todas" && filtroCategoria !== "servicios") {
      return [];
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((s) => s.nombre.toLowerCase().includes(q));
    }
    return lista;
  }, [servicios, filtroCategoria, busqueda]);

  // Todos los ítems filtrados por categoría y buscador
  const todosFiltrados = useMemo(() => {
    let lista = productosActivos;
    if (filtroCategoria !== "todas") {
      lista = lista.filter((p) => obtenerCategoriaProducto(p) === filtroCategoria);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.marca && p.marca.toLowerCase().includes(q)) ||
          (p.medida && p.medida.toLowerCase().includes(q)),
      );
    }
    return lista;
  }, [productosActivos, filtroCategoria, busqueda]);

  // Agrupamiento por marca para productos físicos filtrados
  const porMarca = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const p of inventarioFiltrado) {
      const clave = p.marca?.trim() || "Sin marca";
      grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [inventarioFiltrado]);

  // Agrupamiento general (por medida/especificación) para productos con sus items
  const general = useMemo(() => {
    const grupos = new Map<
      string,
      { cantidad: number; valor: number; productos: Producto[] }
    >();
    for (const p of inventarioFiltrado) {
      const clave = p.medida?.trim() || "Sin medida";
      const actual = grupos.get(clave) ?? { cantidad: 0, valor: 0, productos: [] };
      grupos.set(clave, {
        cantidad: actual.cantidad + (p.stock_actual ?? 0),
        valor:
          actual.valor +
          (p.stock_actual ?? 0) * (parseFloat(p.precio_lista) || 0),
        productos: [...actual.productos, p],
      });
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [inventarioFiltrado]);

  // Expandir o colapsar una medida individual
  const toggleMedidaExpandida = (medida: string) => {
    setMedidasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(medida)) {
        next.delete(medida);
      } else {
        next.add(medida);
      }
      return next;
    });
  };

  // Expandir todas o colapsar todas
  const toggleTodasMedidas = () => {
    if (medidasExpandidas.size >= general.length) {
      setMedidasExpandidas(new Set());
    } else {
      setMedidasExpandidas(new Set(general.map(([m]) => m)));
    }
  };

  // Si el usuario busca algo específico, auto-desplegamos las medidas coincidentes
  useEffect(() => {
    if (busqueda.trim() && general.length > 0) {
      setMedidasExpandidas(new Set(general.map(([m]) => m)));
    }
  }, [busqueda, general]);

  // Cálculos de Margen y Ganancia en Vivo
  const gananciaNuevo = useMemo(() => {
    const p = parseFloat(formNuevo.precio_lista || "0");
    const c = parseFloat(formNuevo.precio_compra || "0");
    const g = p - c;
    const m = p > 0 ? ((g / p) * 100).toFixed(1) : "0";
    return { ganancia: g, margen: m, tieneCosto: c > 0 && p > 0 };
  }, [formNuevo.precio_lista, formNuevo.precio_compra]);

  const gananciaEditar = useMemo(() => {
    const p = parseFloat(formEditar.precio_lista || "0");
    const c = parseFloat(formEditar.precio_compra || "0");
    const g = p - c;
    const m = p > 0 ? ((g / p) * 100).toFixed(1) : "0";
    return { ganancia: g, margen: m, tieneCosto: c > 0 && p > 0 };
  }, [formEditar.precio_lista, formEditar.precio_compra]);

  // --- Manejo de la Cascada y Selección ---
  const seleccionarCategoria = (cat: CategoriaPreset) => {
    setCategoriaActivaId(cat.id);
    setTipoItemNuevo(cat.tipo);
    setErrorNuevo(null);
    setCandidatosDuplicados(null);
    setInlineMarcaAbierto(false);
    setInlineMedidaAbierto(false);

    if (cat.id === "llantas") {
      const marcaDef = "Michelin";
      const medidaDef = "185/65 R15";
      setFormNuevo((prev) => ({
        ...prev,
        marca: marcaDef,
        medida: medidaDef,
        nombre: `Llanta ${medidaDef} ${marcaDef}`,
        estado_uso: "nuevo",
        stock_actual: "2",
        stock_minimo: "2",
      }));
    } else if (cat.id === "aceites") {
      setFormNuevo((prev) => ({
        ...prev,
        marca: marcaAceite,
        medida: viscosidadAceite,
        nombre: `Aceite ${marcaAceite} ${viscosidadAceite} (${presentacionAceite})`,
        stock_actual: "4",
        stock_minimo: "2",
      }));
    } else if (
      cat.id === "parches_servicios" ||
      cat.id === "parches" ||
      cat.id === "servicios"
    ) {
      setSubTipoParchado("servicio");
      setTipoItemNuevo("servicio");
      setFormNuevo((prev) => ({
        ...prev,
        nombre: parcheServicioNombre,
        marca: "",
        medida: "",
        precio_lista: "7.00",
        precio_compra: "0.00",
        stock_actual: "0",
        stock_minimo: "0",
      }));
    } else if (cat.id === "aditivos") {
      setFormNuevo((prev) => ({
        ...prev,
        nombre: "Refrigerante / Coolant (Galón)",
        marca: "",
        medida: "",
        stock_actual: "3",
        stock_minimo: "2",
      }));
    } else if (cat.id === "accesorios") {
      setFormNuevo((prev) => ({
        ...prev,
        nombre: "Filtro de Aceite",
        marca: "",
        medida: "",
        stock_actual: "2",
        stock_minimo: "2",
      }));
    } else {
      setFormNuevo((prev) => ({
        ...prev,
        nombre: "",
        marca: "",
        medida: "",
      }));
    }
  };

  const cambiarSubTipoParchado = (sub: "servicio" | "insumo") => {
    setSubTipoParchado(sub);
    setErrorNuevo(null);
    setCandidatosDuplicados(null);
    if (sub === "servicio") {
      setTipoItemNuevo("servicio");
      setFormNuevo((prev) => ({
        ...prev,
        nombre: "Parchado de auto (frío)",
        marca: "",
        medida: "",
        precio_lista: prev.precio_lista || "7.00",
        precio_compra: "0.00",
        stock_actual: "0",
        stock_minimo: "0",
      }));
    } else {
      setTipoItemNuevo("producto");
      setFormNuevo((prev) => ({
        ...prev,
        nombre: "Parche radial Nro 12",
        marca: "RAC",
        medida: "Nro 12",
        estado_uso: "nuevo",
        precio_lista: prev.precio_lista || "8.50",
        precio_compra: prev.precio_compra || "4.00",
        stock_actual: "10",
        stock_minimo: "5",
      }));
    }
  };

  const seleccionarMarcaLlanta = (m: string) => {
    setFormNuevo((prev) => {
      const medida = prev.medida || "";
      const cond = prev.estado_uso === "usado" ? " (Usada)" : "";
      return {
        ...prev,
        marca: m,
        nombre: medida ? `Llanta ${medida} ${m}${cond}` : `Llanta ${m}${cond}`,
      };
    });
  };

  const seleccionarAroLlanta = (aro: string) => {
    setAroActivo(aro);
    setAroParaNuevaMedida(aro);
    const medidas = MEDIDAS_COMUNES_POR_ARO_DEFAULT[aro];
    if (medidas && medidas.length > 0) {
      seleccionarMedidaLlanta(medidas[0]);
    }
  };

  const seleccionarMedidaLlanta = (med: string) => {
    setFormNuevo((prev) => {
      const marca = prev.marca || "";
      const cond = prev.estado_uso === "usado" ? " (Usada)" : "";
      return {
        ...prev,
        medida: med,
        nombre: marca ? `Llanta ${med} ${marca}${cond}` : `Llanta ${med}${cond}`,
      };
    });
  };

  const seleccionarCondicionLlanta = (estado: "nuevo" | "usado") => {
    setFormNuevo((prev) => {
      const medida = prev.medida || "";
      const marca = prev.marca || "";
      const cond = estado === "usado" ? " (Usada)" : "";
      const base =
        medida && marca ? `Llanta ${medida} ${marca}` : prev.nombre.replace(" (Usada)", "");
      return {
        ...prev,
        estado_uso: estado,
        nombre: `${base}${cond}`,
      };
    });
  };

  const seleccionarViscosidadAceite = (visc: string) => {
    setViscosidadAceite(visc);
    setFormNuevo((prev) => ({
      ...prev,
      medida: visc,
      nombre: `Aceite ${prev.marca || marcaAceite} ${visc} (${presentacionAceite})`,
    }));
  };

  const seleccionarMarcaAceite = (m: string) => {
    setMarcaAceite(m);
    setFormNuevo((prev) => ({
      ...prev,
      marca: m,
      nombre: `Aceite ${m} ${viscosidadAceite} (${presentacionAceite})`,
    }));
  };

  const seleccionarPresentacionAceite = (pres: string) => {
    setPresentacionAceite(pres);
    setFormNuevo((prev) => ({
      ...prev,
      nombre: `Aceite ${prev.marca || marcaAceite} ${viscosidadAceite} (${pres})`,
    }));
  };

  const guardarNuevoAro = () => {
    if (!negocio || !nuevoAroTexto.trim()) return;
    let a = nuevoAroTexto.trim();
    if (!a.toLowerCase().startsWith("aro") && !isNaN(Number(a))) {
      a = `Aro ${a}`;
    }
    addCustomAro(negocio.id, a);
    setCatalogVersion((v) => v + 1);
    setAroActivo(a);
    setAroParaNuevaMedida(a);
    setNuevoAroTexto("");
    setInlineAroAbierto(false);
  };

  const guardarNuevaMarca = () => {
    if (!negocio || !nuevaMarcaTexto.trim()) return;
    const m = nuevaMarcaTexto.trim();
    addCustomMarca(negocio.id, m);
    setCatalogVersion((v) => v + 1);
    seleccionarMarcaLlanta(m);
    setNuevaMarcaTexto("");
    setInlineMarcaAbierto(false);
  };

  const guardarNuevaMedida = () => {
    if (!negocio || !nuevaMedidaTexto.trim()) return;
    const med = nuevaMedidaTexto.trim().toUpperCase();
    addCustomMedida(negocio.id, aroParaNuevaMedida, med);
    setCatalogVersion((v) => v + 1);
    seleccionarMedidaLlanta(med);
    setNuevaMedidaTexto("");
    setInlineMedidaAbierto(false);
  };

  const ajustarPrecioNuevo = (sum: number) => {
    const actual = parseFloat(formNuevo.precio_lista) || 0;
    const nuevo = Math.max(0, actual + sum);
    setFormNuevo((prev) => ({ ...prev, precio_lista: nuevo.toFixed(2) }));
  };

  const redondearPrecioNuevo = () => {
    const actual = parseFloat(formNuevo.precio_lista) || 0;
    const redondeado = Math.round(actual);
    setFormNuevo((prev) => ({ ...prev, precio_lista: redondeado.toFixed(2) }));
  };

  const cambiarStockNuevo = (delta: number) => {
    const actual = parseInt(formNuevo.stock_actual, 10) || 0;
    const nuevo = Math.max(0, actual + delta);
    setFormNuevo((prev) => ({ ...prev, stock_actual: String(nuevo) }));
  };

  const ajustarPrecioEditar = (sum: number) => {
    const actual = parseFloat(formEditar.precio_lista) || 0;
    const nuevo = Math.max(0, actual + sum);
    setFormEditar((prev) => ({ ...prev, precio_lista: nuevo.toFixed(2) }));
  };

  const redondearPrecioEditar = () => {
    const actual = parseFloat(formEditar.precio_lista) || 0;
    const redondeado = Math.round(actual);
    setFormEditar((prev) => ({ ...prev, precio_lista: redondeado.toFixed(2) }));
  };

  const setRestockAmount = (delta: number) => {
    if (!itemAEditar) return;
    const stockBase = itemAEditar.stock_actual ?? 0;
    setRestockDelta(delta);
    setFormEditar((prev) => ({
      ...prev,
      stock_actual: String(Math.max(0, stockBase + delta)),
    }));
  };

  const eliminarAroPersonalizado = (e: React.MouseEvent, aro: string) => {
    e.stopPropagation();
    if (!negocio) return;
    removeCustomAro(negocio.id, aro);
    setCatalogVersion((v) => v + 1);
  };

  const eliminarMarcaPersonalizada = (e: React.MouseEvent, m: string) => {
    e.stopPropagation();
    if (!negocio) return;
    removeCustomMarca(negocio.id, m);
    setCatalogVersion((v) => v + 1);
  };

  const eliminarMedidaPersonalizada = (e: React.MouseEvent, med: string) => {
    e.stopPropagation();
    if (!negocio) return;
    removeCustomMedida(negocio.id, med);
    setCatalogVersion((v) => v + 1);
  };

  // --- Manejo del Modal Nuevo ---
  const abrirModalNuevo = (tipoPorDefecto: "producto" | "servicio" = "producto") => {
    setErrorNuevo(null);
    setCandidatosDuplicados(null);
    setInlineAroAbierto(false);
    setInlineMarcaAbierto(false);
    setInlineMedidaAbierto(false);

    if (tipoPorDefecto === "servicio") {
      setCategoriaActivaId("servicios");
      setTipoItemNuevo("servicio");
      setFormNuevo({
        nombre: "Parchado de auto (frío)",
        medida: "",
        marca: "",
        estado_uso: "nuevo",
        precio_lista: "7.00",
        precio_compra: "0.00",
        stock_actual: "0",
        stock_minimo: "0",
      });
    } else {
      setCategoriaActivaId("llantas");
      setTipoItemNuevo("producto");
      setAroActivo("Aro 15");
      setFormNuevo({
        nombre: "Llanta 185/65 R15 Goodyear",
        medida: "185/65 R15",
        marca: "Goodyear",
        estado_uso: "nuevo",
        precio_lista: "185.00",
        precio_compra: "135.00",
        stock_actual: "4",
        stock_minimo: "2",
      });
    }
    setModalNuevoAbierto(true);
  };

  const submitNuevoItem = async (e?: FormEvent, confirmarNuevo = false) => {
    if (e) e.preventDefault();
    if (!negocio || !formNuevo.nombre.trim()) return;

    setGuardandoNuevo(true);
    setErrorNuevo(null);
    if (!confirmarNuevo) {
      setCandidatosDuplicados(null);
    }

    try {
      if (tipoItemNuevo === "producto") {
        await api.createProducto(
          negocio.id,
          {
            nombre: formNuevo.nombre.trim(),
            medida: formNuevo.medida.trim() || null,
            marca: formNuevo.marca.trim() || null,
            estado_uso: formNuevo.estado_uso,
            precio_lista: formNuevo.precio_lista.trim() || "0.00",
            precio_compra: formNuevo.precio_compra.trim() || "0.00",
            clasificacion: "capital",
            stock_actual: Math.max(0, parseInt(formNuevo.stock_actual, 10) || 0),
            stock_minimo: Math.max(0, parseInt(formNuevo.stock_minimo, 10) || 0),
            activo: true,
          },
          confirmarNuevo,
        );
      } else {
        await api.createProducto(
          negocio.id,
          {
            nombre: formNuevo.nombre.trim(),
            medida: null,
            marca: null,
            estado_uso: null,
            precio_lista: formNuevo.precio_lista.trim() || "0.00",
            precio_compra: "0.00",
            clasificacion: "servicio",
            stock_actual: 0,
            stock_minimo: 0,
            activo: true,
          },
          confirmarNuevo,
        );
      }

      await recargar();
      setModalNuevoAbierto(false);
      setCandidatosDuplicados(null);
    } catch (err) {
      if (err instanceof ProductoDuplicadoError) {
        setCandidatosDuplicados(err.candidatos || []);
        setErrorNuevo(
          "Ya existe un producto o servicio con un nombre muy similar en este negocio.",
        );
      } else if (err instanceof ApiError) {
        setErrorNuevo(err.message || "Error al registrar el producto o servicio.");
      } else {
        setErrorNuevo(
          err instanceof Error ? err.message : "Error inesperado al guardar.",
        );
      }
    } finally {
      setGuardandoNuevo(false);
    }
  };

  // --- Manejo del Modal Editar con Reposición Rápida ---
  const abrirModalEditar = (item: Producto) => {
    setItemAEditar(item);
    setErrorEditar(null);
    setRestockDelta(0);
    setFormEditar({
      nombre: item.nombre || "",
      medida: item.medida || "",
      marca: item.marca || "",
      estado_uso: (item.estado_uso === "usado" ? "usado" : "nuevo") as "nuevo" | "usado",
      precio_lista: item.precio_lista || "",
      precio_compra: item.precio_compra || "",
      stock_actual: String(item.stock_actual ?? 0),
      stock_minimo: String(item.stock_minimo ?? 0),
      activo: item.activo !== false,
    });
  };

  const submitEditarItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!negocio || !itemAEditar || !formEditar.nombre.trim()) return;

    setGuardandoEditar(true);
    setErrorEditar(null);

    const esProd = esCapital(itemAEditar.clasificacion);

    try {
      if (esProd) {
        await api.updateProducto(negocio.id, itemAEditar.id, {
          nombre: formEditar.nombre.trim(),
          medida: formEditar.medida.trim() || null,
          marca: formEditar.marca.trim() || null,
          estado_uso: formEditar.estado_uso,
          precio_lista: formEditar.precio_lista.trim() || "0.00",
          precio_compra: formEditar.precio_compra.trim() || "0.00",
          stock_actual: Math.max(0, parseInt(formEditar.stock_actual, 10) || 0),
          stock_minimo: Math.max(0, parseInt(formEditar.stock_minimo, 10) || 0),
          activo: formEditar.activo,
        });
      } else {
        await api.updateProducto(negocio.id, itemAEditar.id, {
          nombre: formEditar.nombre.trim(),
          precio_lista: formEditar.precio_lista.trim() || "0.00",
          activo: formEditar.activo,
        });
      }

      await recargar();
      setItemAEditar(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorEditar(err.message || "Error al actualizar el ítem.");
      } else {
        setErrorEditar(
          err instanceof Error ? err.message : "Error inesperado al guardar cambios.",
        );
      }
    } finally {
      setGuardandoEditar(false);
    }
  };

  // --- Manejo del Modal Eliminar ---
  const abrirModalEliminar = (item: Producto) => {
    setItemAEliminar(item);
    setErrorEliminar(null);
  };

  const confirmarEliminarItem = async () => {
    if (!negocio || !itemAEliminar) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await api.deleteProducto(negocio.id, itemAEliminar.id);
      await recargar();
      setItemAEliminar(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorEliminar(err.message || "Error al eliminar el ítem.");
      } else {
        setErrorEliminar(
          err instanceof Error ? err.message : "Error inesperado al eliminar.",
        );
      }
    } finally {
      setEliminando(false);
    }
  };

  if (cargandoNegocio || cargandoProductos) {
    return (
      <div className={styles.centerBox}>
        <p className={styles.mutedText}>Cargando catálogo e inventario…</p>
      </div>
    );
  }

  if (!negocio) {
    return (
      <EmptyState
        icon={<BoxIcon size={24} />}
        title="Negocio no encontrado"
        message="No se pudo cargar la información del negocio para gestionar el stock."
      />
    );
  }

  return (
    <div className={styles.stockContainer}>
      {/* Encabezado principal */}
      <header className={styles.stockHeader}>
        <nav className={styles.mainTabs} aria-label="Secciones de Stock">
          <button
            type="button"
            className={`${styles.mainTab} ${tabPrincipal === "productos" ? styles.mainTabActive : ""}`}
            onClick={() => {
              setTabPrincipal("productos");
              setFiltroCategoria("todas");
            }}
          >
            <BoxIcon size={16} />
            <span>Productos en Stock</span>
            <span className={styles.tabBadge}>{conteoProductos}</span>
          </button>
          <button
            type="button"
            className={`${styles.mainTab} ${tabPrincipal === "servicios" ? styles.mainTabActive : ""}`}
            onClick={() => {
              setTabPrincipal("servicios");
              setFiltroCategoria("todas");
            }}
          >
            <WrenchIcon size={16} />
            <span>Servicios y Mano de Obra</span>
            <span className={styles.tabBadge}>{conteoServicios}</span>
          </button>
          <button
            type="button"
            className={`${styles.mainTab} ${tabPrincipal === "todos" ? styles.mainTabActive : ""}`}
            onClick={() => {
              setTabPrincipal("todos");
              setFiltroCategoria("todas");
            }}
          >
            <span>Todos los Ítems</span>
            <span className={styles.tabBadge}>{conteoTotal}</span>
          </button>
        </nav>

        <button
          type="button"
          className={styles.btnNuevo}
          onClick={() =>
            abrirModalNuevo(tabPrincipal === "servicios" ? "servicio" : "producto")
          }
        >
          <PlusIcon size={16} />
          <span>+ Nuevo Producto / Servicio</span>
        </button>
      </header>

      {/* ========================================================================= */}
      {/* Barra de Filtros por Categoría (Separada de los tabs principales)          */}
      {/* ========================================================================= */}
      <div className={styles.categoryFilterContainer}>
        <div
          className={styles.categoryFilterRow}
          role="tablist"
          aria-label="Filtrar por categoría de producto"
        >
          {filtrosCategoriaDisponibles.map((cat) => {
            const activa = filtroCategoria === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.categoryFilterPill} ${activa ? styles.categoryFilterPillActive : ""}`}
                onClick={() => setFiltroCategoria(cat.id)}
              >
                <span>{cat.label}</span>
                <span className={styles.categoryFilterBadge}>{cat.conteo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Búsqueda y Sub-vistas */}
      <div className={styles.subTabsRow}>
        {tabPrincipal === "productos" ? (
          <div className={styles.subTabs} role="group" aria-label="Modo de visualización">
            <button
              type="button"
              className={`${styles.subTab} ${vistaStock === "marca" ? styles.subTabActive : ""}`}
              onClick={() => setVistaStock("marca")}
            >
              Por marca
            </button>
            <button
              type="button"
              className={`${styles.subTab} ${vistaStock === "general" ? styles.subTabActive : ""}`}
              onClick={() => setVistaStock("general")}
            >
              Agrupado por medida
            </button>
          </div>
        ) : (
          <div />
        )}

        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <SearchIcon size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por nombre, marca o medida…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido Principal según el Tab Seleccionado */}
      {tabPrincipal === "productos" ? (
        inventarioFiltrado.length === 0 ? (
          <EmptyState
            icon={<BoxIcon size={24} />}
            title="Todavía no hay productos físicos registrados"
            message="Agrega tus neumáticos, aceites, cámaras o repuestos para llevar el control de inventario."
            action={
              <Button onClick={() => abrirModalNuevo("producto")}>
                <PlusIcon size={16} />
                <span>Crear primer producto</span>
              </Button>
            }
          />
        ) : vistaStock === "marca" ? (
          <div className={styles.brandList}>
            {porMarca.map(([marca, prods]) => (
              <section key={marca} className={styles.brandGroup}>
                <div className={styles.brandGroupHeader}>
                  <h2 className={styles.brandName}>{marca}</h2>
                  <span className={styles.brandCount}>
                    {prods.length} {prods.length === 1 ? "ítem" : "ítems"}
                  </span>
                </div>
                <div className={styles.cardGrid}>
                  {prods.map((p) => {
                    const { titulo, subtitulo, detalleExtra } = formatProductCardTitles(p);
                    const badge = getEstadoUsoBadge(p.estado_uso);
                    const bajoMinimo = p.stock_minimo > 0 && p.stock_actual <= p.stock_minimo;
                    return (
                      <div key={p.id} className={styles.productCard}>
                        <div className={styles.cardTop}>
                          <div className={styles.titleArea}>
                            {/* Visualización limpia solicitada: Marca arriba, Medida abajo */}
                            <h3 className={styles.cardMarcaTitle}>{titulo}</h3>
                            {subtitulo && (
                              <span className={styles.cardMedidaSubtitle}>{subtitulo}</span>
                            )}
                            {detalleExtra && (
                              <span className={styles.cardExtraNombre}>{detalleExtra}</span>
                            )}
                          </div>
                          <div className={styles.cardBadges}>
                            {badge && (
                              <span
                                className={
                                  badge.tipo === "nuevo"
                                    ? styles.badgeNuevo
                                    : styles.badgeUsado
                                }
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className={styles.cardInfoRow}>
                          <span
                            className={bajoMinimo ? styles.cantidadBaja : styles.cantidad}
                          >
                            {bajoMinimo && <AlertTriangleIcon size={14} />}
                            {p.stock_actual} en stock
                            {p.stock_minimo > 0 && ` (mín. ${p.stock_minimo})`}
                          </span>
                          <div className={styles.precioBlock}>
                            <span className={styles.precio}>
                              {formatMoney(p.precio_lista)}
                            </span>
                            {parseFloat(p.precio_compra) > 0 && (
                              <span className={styles.costo}>
                                Costo: {formatMoney(p.precio_compra)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => navigate(`/${tipo}/stock/ajustar/${p.id}`)}
                            title="Ajustar cantidad de stock"
                          >
                            <WrenchIcon size={13} />
                            <span>Ajustar</span>
                          </button>
                          {negocio.modulo_rus_activo && (
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => navigate(`/${tipo}/stock/comprar/${p.id}`)}
                              title="Registrar compra formal"
                            >
                              <PlusIcon size={13} />
                              <span>Comprar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionIconBtn}
                            onClick={() => abrirModalEditar(p)}
                            title="Editar producto"
                            aria-label={`Editar ${p.nombre}`}
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                            onClick={() => abrirModalEliminar(p)}
                            title="Eliminar producto"
                            aria-label={`Eliminar ${p.nombre}`}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.generalList}>
            <div className={styles.generalToolbar}>
              <span className={styles.generalHint}>
                💡 Haz clic en cualquier medida para ver y gestionar sus marcas
              </span>
              {general.length > 0 && (
                <button
                  type="button"
                  className={styles.generalToggleAllBtn}
                  onClick={toggleTodasMedidas}
                >
                  {medidasExpandidas.size >= general.length
                    ? "Colapsar todas"
                    : "Desplegar todas"}
                </button>
              )}
            </div>

            {general.map(([medida, totales]) => {
              const estaExpandido = medidasExpandidas.has(medida);
              const marcasUnicas = new Set(
                totales.productos.map((p) => (p.marca || p.nombre).trim())
              );
              const marcasCount = marcasUnicas.size;

              return (
                <div
                  key={medida}
                  className={`${styles.generalItem} ${
                    estaExpandido ? styles.generalItemExpanded : ""
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={estaExpandido}
                    className={`${styles.generalRow} ${
                      estaExpandido ? styles.generalRowExpanded : ""
                    }`}
                    onClick={() => toggleMedidaExpandida(medida)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMedidaExpandida(medida);
                      }
                    }}
                  >
                    <div className={styles.generalHeaderLeft}>
                      <span
                        className={`${styles.generalChevron} ${
                          estaExpandido ? styles.generalChevronOpen : ""
                        }`}
                      >
                        <ChevronDownIcon size={18} />
                      </span>
                      <span className={styles.generalMedida}>{medida}</span>
                      <span className={styles.generalBrandsBadge}>
                        {marcasCount} {marcasCount === 1 ? "marca" : "marcas"}
                      </span>
                    </div>

                    <div className={styles.generalHeaderRight}>
                      <span className={styles.generalCantidad}>
                        {totales.cantidad} {totales.cantidad === 1 ? "unidad" : "unidades"}
                      </span>
                      <span className={styles.generalValor}>
                        {formatMoney(totales.valor.toFixed(2))}
                      </span>
                    </div>
                  </div>

                  {estaExpandido && (
                    <div className={styles.generalDropdownContent}>
                      <div className={styles.generalCardsGrid}>
                        {totales.productos.map((p) => {
                          const { titulo, detalleExtra } = formatProductCardTitles(p);
                          const badge = getEstadoUsoBadge(p.estado_uso);
                          const bajoMinimo =
                            p.stock_minimo > 0 && p.stock_actual <= p.stock_minimo;
                          return (
                            <div key={p.id} className={styles.generalProductCard}>
                              <div className={styles.cardTop}>
                                <div className={styles.titleArea}>
                                  <h4 className={styles.cardMarcaTitle}>
                                    {p.marca || titulo}
                                  </h4>
                                  {detalleExtra && (
                                    <span className={styles.cardExtraNombre}>
                                      {detalleExtra}
                                    </span>
                                  )}
                                  {p.nombre &&
                                    p.nombre !== p.marca &&
                                    !detalleExtra && (
                                      <span className={styles.cardExtraNombre}>
                                        {p.nombre}
                                      </span>
                                    )}
                                </div>
                                {badge && (
                                  <span
                                    className={
                                      badge.tipo === "nuevo"
                                        ? styles.badgeNuevo
                                        : styles.badgeUsado
                                    }
                                  >
                                    {badge.label}
                                  </span>
                                )}
                              </div>

                              <div className={styles.cardInfoRow}>
                                <span
                                  className={
                                    bajoMinimo ? styles.cantidadBaja : styles.cantidad
                                  }
                                >
                                  {bajoMinimo && <AlertTriangleIcon size={14} />}
                                  {p.stock_actual} en stock
                                  {p.stock_minimo > 0 && ` (mín. ${p.stock_minimo})`}
                                </span>
                                <div className={styles.precioBlock}>
                                  <span className={styles.precio}>
                                    {formatMoney(p.precio_lista)}
                                  </span>
                                  {parseFloat(p.precio_compra) > 0 && (
                                    <span className={styles.costo}>
                                      Costo: {formatMoney(p.precio_compra)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className={styles.cardActions}>
                                <button
                                  type="button"
                                  className={styles.actionButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/${tipo}/stock/ajustar/${p.id}`);
                                  }}
                                  title="Ajustar cantidad de stock"
                                >
                                  <WrenchIcon size={13} />
                                  <span>Ajustar</span>
                                </button>
                                {negocio?.modulo_rus_activo && (
                                  <button
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/${tipo}/stock/comprar/${p.id}`);
                                    }}
                                    title="Registrar compra formal"
                                  >
                                    <PlusIcon size={13} />
                                    <span>Comprar</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={styles.actionButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirModalEditar(p);
                                  }}
                                  title="Editar producto"
                                  aria-label={`Editar ${p.nombre}`}
                                >
                                  <EditIcon size={13} />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirModalEliminar(p);
                                  }}
                                  title="Eliminar producto"
                                  aria-label={`Eliminar ${p.nombre}`}
                                >
                                  <TrashIcon size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : tabPrincipal === "servicios" ? (
        serviciosFiltrados.length === 0 ? (
          <EmptyState
            icon={<WrenchIcon size={24} />}
            title="Todavía no hay servicios registrados"
            message="Agrega servicios de mano de obra como mantenimientos, diagnósticos, alineamientos o parchados."
            action={
              <Button onClick={() => abrirModalNuevo("servicio")}>
                <PlusIcon size={16} />
                <span>Crear primer servicio</span>
              </Button>
            }
          />
        ) : (
          <div className={styles.cardGrid}>
            {serviciosFiltrados.map((s) => (
              <div key={s.id} className={styles.serviceCard}>
                <div className={styles.serviceHeader}>
                  <div className={styles.serviceIconWrap}>
                    <WrenchIcon size={20} />
                  </div>
                  <div className={styles.serviceInfo}>
                    <h3 className={styles.serviceTitle}>{s.nombre}</h3>
                    <span className={styles.serviceTag}>Mano de obra / Servicio</span>
                  </div>
                </div>

                <div className={styles.servicePriceRow}>
                  <span className={styles.servicePriceLabel}>Precio de lista</span>
                  <span className={styles.servicePriceValue}>
                    {formatMoney(s.precio_lista)}
                  </span>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => abrirModalEditar(s)}
                  >
                    <EditIcon size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                    onClick={() => abrirModalEliminar(s)}
                    title="Eliminar servicio"
                    aria-label={`Eliminar ${s.nombre}`}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Tab 3: Todos los ítems */
        todosFiltrados.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={24} />}
            title="No se encontraron ítems"
            message={
              busqueda
                ? `No hay productos ni servicios que coincidan con "${busqueda}".`
                : "No hay registros disponibles en el catálogo."
            }
          />
        ) : (
          <div className={styles.cardGrid}>
            {todosFiltrados.map((item) => {
              const esProd = esCapital(item.clasificacion);
              const { titulo, subtitulo, detalleExtra } = formatProductCardTitles(item);
              const badge = esProd ? getEstadoUsoBadge(item.estado_uso) : null;
              return (
                <div key={item.id} className={styles.productCard}>
                  <div className={styles.cardTop}>
                    <div className={styles.titleArea}>
                      {/* Visualización limpia solicitada: Marca arriba, Medida abajo */}
                      <h3 className={styles.cardMarcaTitle}>{titulo}</h3>
                      {subtitulo && (
                        <span className={styles.cardMedidaSubtitle}>{subtitulo}</span>
                      )}
                      {detalleExtra && (
                        <span className={styles.cardExtraNombre}>{detalleExtra}</span>
                      )}
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

                  <div className={styles.cardInfoRow}>
                    {esProd ? (
                      <span className={styles.cantidad}>{item.stock_actual} en stock</span>
                    ) : (
                      <span className={styles.serviceTag}>Sin control de stock</span>
                    )}
                    <span className={styles.precio}>{formatMoney(item.precio_lista)}</span>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => abrirModalEditar(item)}
                      title="Editar ítem"
                      aria-label={`Editar ${item.nombre}`}
                    >
                      <EditIcon size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                      onClick={() => abrirModalEliminar(item)}
                      title="Eliminar ítem"
                      aria-label={`Eliminar ${item.nombre}`}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* 1. Modal Asistente de Alta de Nuevo Producto / Servicio                   */}
      {/* ========================================================================= */}
      {modalNuevoAbierto && (
        <div className={styles.modalOverlay} onClick={() => setModalNuevoAbierto(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Tirador táctil superior para móvil */}
            <div className={styles.dragHandle} />

            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className={styles.modalHeaderIcon}>
                  {tipoItemNuevo === "producto" ? "🛞" : "🛠️"}
                </div>
                <div>
                  <h2 className={styles.modalTitle}>
                    {tipoItemNuevo === "producto"
                      ? "Registrar Producto en Stock"
                      : "Registrar Servicio"}
                  </h2>
                  <p className={styles.modalSubtitle}>
                    {negocio.nombre} • Ingreso Rápido Asistido
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setModalNuevoAbierto(false)}
                aria-label="Cerrar modal"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={(e) => submitNuevoItem(e, false)} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* 1. Selector Visual de Categoría (Píldoras Horizontales Táctiles) */}
                <div className={styles.chipsSection}>
                  <div className={styles.chipsSectionHeader}>
                    <span className={styles.chipsLabel}>1. Categoría de Registro:</span>
                  </div>
                  <div className={styles.aroTabsRow}>
                    {todasCategorias.map((cat) => {
                      const activa = categoriaActivaId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={`${styles.aroTab} ${activa ? styles.aroTabActive : ""}`}
                          onClick={() => seleccionarCategoria(cat)}
                        >
                          <span>{cat.icono}</span>
                          <span>{cat.nombre}</span>
                          {activa && <CheckIcon size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ============================================================= */}
                {/* CASCADA 1: LLANTAS                                            */}
                {/* ============================================================= */}
                {categoriaActivaId === "llantas" && (
                  <div className={styles.guidedCard}>
                    <div className={styles.guidedCardHeader}>
                      <div className={styles.guidedCardTitle}>
                        <TireIcon size={18} />
                        <span>Especificaciones de la Llanta</span>
                      </div>
                      <span className={styles.guidedBadge}>Paso Guiado</span>
                    </div>

                    {/* Selector de Aros */}
                    <div className={styles.chipsSection}>
                      <div className={styles.chipsSectionHeader}>
                        <span className={styles.chipsLabel}>Tamaño de Aro:</span>
                        {!inlineAroAbierto && (
                          <button
                            type="button"
                            className={styles.chipAdd}
                            style={{ padding: "3px 8px", borderRadius: "8px", fontSize: "11px", cursor: "pointer" }}
                            onClick={() => setInlineAroAbierto(true)}
                          >
                            + Otro aro
                          </button>
                        )}
                      </div>

                      {inlineAroAbierto && (
                        <div className={styles.inlineAddBox}>
                          <input
                            type="text"
                            className={styles.inlineAddInput}
                            placeholder="Ej. Aro 12, Aro 19, Aro 22.5..."
                            value={nuevoAroTexto}
                            onChange={(e) => setNuevoAroTexto(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className={styles.inlineAddBtn}
                            onClick={guardarNuevoAro}
                          >
                            Guardar y usar
                          </button>
                          <button
                            type="button"
                            className={styles.inlineCancelBtn}
                            onClick={() => setInlineAroAbierto(false)}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className={styles.aroTabsRow}>
                        {listaAros.map((aro) => {
                          const esCustom = customCatalog.arosPersonalizados?.includes(aro);
                          const activa = aroActivo === aro;
                          return (
                            <button
                              key={aro}
                              type="button"
                              className={`${styles.aroTab} ${activa ? styles.aroTabActive : ""}`}
                              onClick={() => seleccionarAroLlanta(aro)}
                            >
                              <span>{aro}</span>
                              {activa && <CheckIcon size={12} />}
                              {esCustom && (
                                <span
                                  className={styles.chipDeleteBtn}
                                  onClick={(e) => eliminarAroPersonalizado(e, aro)}
                                  title="Eliminar de mi lista"
                                >
                                  ✕
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selector de Medidas por Aro */}
                    <div className={styles.chipsSection}>
                      <div className={styles.chipsSectionHeader}>
                        <span className={styles.chipsLabel}>Medida Exacta ({aroActivo}):</span>
                        {!inlineMedidaAbierto && (
                          <button
                            type="button"
                            className={styles.chipAdd}
                            style={{ padding: "3px 8px", borderRadius: "8px", fontSize: "11px", cursor: "pointer" }}
                            onClick={() => setInlineMedidaAbierto(true)}
                          >
                            + Otra medida
                          </button>
                        )}
                      </div>

                      {inlineMedidaAbierto && (
                        <div className={styles.inlineAddBox}>
                          <input
                            type="text"
                            className={styles.inlineAddInput}
                            placeholder="Ej. 185/65 R15 o 195/70 R14..."
                            value={nuevaMedidaTexto}
                            onChange={(e) => setNuevaMedidaTexto(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className={styles.inlineAddBtn}
                            onClick={guardarNuevaMedida}
                          >
                            Guardar y usar
                          </button>
                          <button
                            type="button"
                            className={styles.inlineCancelBtn}
                            onClick={() => setInlineMedidaAbierto(false)}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className={styles.chipsRow}>
                        {medidasFiltradas.map((med) => {
                          const esCustom = customCatalog.medidasPersonalizadas.some(
                            (item) => item.medida.toUpperCase() === med.toUpperCase(),
                          );
                          const activa = formNuevo.medida.toUpperCase() === med.toUpperCase();
                          return (
                            <button
                              key={med}
                              type="button"
                              className={`${styles.chip} ${activa ? styles.chipActive : ""}`}
                              onClick={() => seleccionarMedidaLlanta(med)}
                            >
                              <span>{med}</span>
                              {activa && <CheckIcon size={12} />}
                              {esCustom && (
                                <span
                                  className={styles.chipDeleteBtn}
                                  onClick={(e) => eliminarMedidaPersonalizada(e, med)}
                                  title="Eliminar de mi lista"
                                >
                                  ✕
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selector de Marcas */}
                    <div className={styles.chipsSection}>
                      <div className={styles.chipsSectionHeader}>
                        <span className={styles.chipsLabel}>Marca del Neumático:</span>
                        {!inlineMarcaAbierto && (
                          <button
                            type="button"
                            className={styles.chipAdd}
                            style={{ padding: "3px 8px", borderRadius: "8px", fontSize: "11px", cursor: "pointer" }}
                            onClick={() => setInlineMarcaAbierto(true)}
                          >
                            + Otra marca (China/Económica)
                          </button>
                        )}
                      </div>

                      {inlineMarcaAbierto && (
                        <div className={styles.inlineAddBox}>
                          <input
                            type="text"
                            className={styles.inlineAddInput}
                            placeholder="Escribe la marca (ej. Linglong, Triangle, Otani...)"
                            value={nuevaMarcaTexto}
                            onChange={(e) => setNuevaMarcaTexto(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className={styles.inlineAddBtn}
                            onClick={guardarNuevaMarca}
                          >
                            Guardar y usar
                          </button>
                          <button
                            type="button"
                            className={styles.inlineCancelBtn}
                            onClick={() => setInlineMarcaAbierto(false)}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className={styles.chipsRow}>
                        {todasMarcasLlantas.map((m) => {
                          const esCustom = customCatalog.marcasPersonalizadas.includes(m);
                          const activa = formNuevo.marca.toLowerCase() === m.toLowerCase();
                          return (
                            <button
                              key={m}
                              type="button"
                              className={`${styles.chip} ${activa ? styles.chipActive : ""}`}
                              onClick={() => seleccionarMarcaLlanta(m)}
                            >
                              <span>{m}</span>
                              {activa && <CheckIcon size={12} />}
                              {esCustom && (
                                <span
                                  className={styles.chipDeleteBtn}
                                  onClick={(e) => eliminarMarcaPersonalizada(e, m)}
                                  title="Eliminar de mi lista"
                                >
                                  ✕
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Condición: Nuevo o Usado */}
                    <div className={styles.field}>
                      <span className={styles.label}>Estado del Neumático</span>
                      <div className={styles.radioPills}>
                        <label
                          className={`${styles.radioPill} ${formNuevo.estado_uso === "nuevo" ? styles.radioPillActive : ""}`}
                        >
                          <input
                            type="radio"
                            name="llanta_condicion"
                            checked={formNuevo.estado_uso === "nuevo"}
                            onChange={() => seleccionarCondicionLlanta("nuevo")}
                          />
                          <span>✨ Nueva (Sellada)</span>
                        </label>
                        <label
                          className={`${styles.radioPill} ${formNuevo.estado_uso === "usado" ? styles.radioPillActive : ""}`}
                        >
                          <input
                            type="radio"
                            name="llanta_condicion"
                            checked={formNuevo.estado_uso === "usado"}
                            onChange={() => seleccionarCondicionLlanta("usado")}
                          />
                          <span>♻️ De segunda / Seminuevo</span>
                        </label>
                      </div>
                    </div>

                    {/* Previsualización en Vivo de Nombre */}
                    <div className={styles.namePreviewCard}>
                      <span className={styles.namePreviewIcon}>🏷️</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={styles.namePreviewLabel}>Nombre automático en catálogo</div>
                        <div className={styles.namePreviewText} title={formNuevo.nombre}>
                          {formNuevo.nombre || "Selecciona especificaciones"}
                        </div>
                      </div>
                      <CheckIcon size={18} />
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* CASCADA 2: ACEITES Y LUBRICANTES                              */}
                {/* ============================================================= */}
                {categoriaActivaId === "aceites" && (
                  <div className={styles.guidedCard}>
                    <div className={styles.guidedCardHeader}>
                      <div className={styles.guidedCardTitle}>
                        <span>🛢️ Especificaciones del Aceite</span>
                      </div>
                      <span className={styles.guidedBadge}>Paso Guiado</span>
                    </div>

                    {/* Viscosidad */}
                    <div className={styles.chipsSection}>
                      <span className={styles.chipsLabel}>Viscosidad / Grado:</span>
                      <div className={styles.chipsRow}>
                        {ACEITES_VISCOSIDADES_DEFAULT.map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`${styles.chip} ${viscosidadAceite === v ? styles.chipActive : ""}`}
                            onClick={() => seleccionarViscosidadAceite(v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Marca de Aceite */}
                    <div className={styles.chipsSection}>
                      <span className={styles.chipsLabel}>Marca:</span>
                      <div className={styles.chipsRow}>
                        {ACEITES_MARCAS_DEFAULT.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`${styles.chip} ${marcaAceite === m ? styles.chipActive : ""}`}
                            onClick={() => seleccionarMarcaAceite(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Presentación */}
                    <div className={styles.chipsSection}>
                      <span className={styles.chipsLabel}>Presentación:</span>
                      <div className={styles.chipsRow}>
                        {ACEITES_PRESENTACIONES_DEFAULT.map((pres) => (
                          <button
                            key={pres}
                            type="button"
                            className={`${styles.chip} ${presentacionAceite === pres ? styles.chipActive : ""}`}
                            onClick={() => seleccionarPresentacionAceite(pres)}
                          >
                            {pres}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* CASCADA 3: PARCHADOS Y SERVICIOS                              */}
                {/* ============================================================= */}
                {(categoriaActivaId === "parches_servicios" ||
                  categoriaActivaId === "parches" ||
                  categoriaActivaId === "servicios") && (
                  <div className={styles.guidedCard}>
                    <div className={styles.typeSelector}>
                      <button
                        type="button"
                        className={`${styles.typeBtn} ${subTipoParchado === "servicio" ? styles.typeBtnActive : ""}`}
                        onClick={() => cambiarSubTipoParchado("servicio")}
                      >
                        <WrenchIcon size={15} />
                        <span>🔧 Servicio al Cliente</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.typeBtn} ${subTipoParchado === "insumo" ? styles.typeBtnActive : ""}`}
                        onClick={() => cambiarSubTipoParchado("insumo")}
                      >
                        <BoxIcon size={15} />
                        <span>📦 Insumo Físico</span>
                      </button>
                    </div>

                    {subTipoParchado === "servicio" ? (
                      <div>
                        <span className={styles.chipsLabel}>Servicio o Trabajo Común:</span>
                        <div className={styles.chipsRow} style={{ marginTop: "6px" }}>
                          {SERVICIOS_TALLER_COMUNES.map((plantilla) => (
                            <button
                              key={plantilla}
                              type="button"
                              className={`${styles.chip} ${parcheServicioNombre === plantilla ? styles.chipActive : ""}`}
                              onClick={() => {
                                setParcheServicioNombre(plantilla);
                                setFormNuevo((prev) => ({
                                  ...prev,
                                  nombre: plantilla,
                                  medida: "",
                                  marca: "",
                                }));
                              }}
                            >
                              <span>{plantilla}</span>
                              {parcheServicioNombre === plantilla && <CheckIcon size={12} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className={styles.chipsLabel}>Material o Insumo Físico:</span>
                        <div className={styles.chipsRow} style={{ marginTop: "6px" }}>
                          {INSUMOS_TALLER_COMUNES.map((insumo) => (
                            <button
                              key={insumo}
                              type="button"
                              className={`${styles.chip} ${parcheInsumoNombre === insumo ? styles.chipActive : ""}`}
                              onClick={() => {
                                setParcheInsumoNombre(insumo);
                                setFormNuevo((prev) => ({
                                  ...prev,
                                  nombre: insumo,
                                  marca: "Taller",
                                  medida: "",
                                }));
                              }}
                            >
                              <span>{insumo}</span>
                              {parcheInsumoNombre === insumo && <CheckIcon size={12} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================= */}
                {/* CASCADA 4: ADITIVOS Y FLUIDOS                                 */}
                {/* ============================================================= */}
                {categoriaActivaId === "aditivos" && (
                  <div className={styles.guidedCard}>
                    <span className={styles.chipsLabel}>Aditivos y fluidos comunes:</span>
                    <div className={styles.chipsRow}>
                      {ADITIVOS_PLANTILLAS_DEFAULT.map((plantilla) => (
                        <button
                          key={plantilla}
                          type="button"
                          className={`${styles.chip} ${formNuevo.nombre === plantilla ? styles.chipActive : ""}`}
                          onClick={() =>
                            setFormNuevo((prev) => ({ ...prev, nombre: plantilla }))
                          }
                        >
                          {plantilla}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* CASCADA 5: ACCESORIOS Y REPUESTOS                             */}
                {/* ============================================================= */}
                {categoriaActivaId === "accesorios" && (
                  <div className={styles.guidedCard}>
                    <span className={styles.chipsLabel}>Accesorios frecuentes:</span>
                    <div className={styles.chipsRow}>
                      {ACCESORIOS_PLANTILLAS_DEFAULT.map((plantilla) => (
                        <button
                          key={plantilla}
                          type="button"
                          className={`${styles.chip} ${formNuevo.nombre === plantilla ? styles.chipActive : ""}`}
                          onClick={() =>
                            setFormNuevo((prev) => ({ ...prev, nombre: plantilla }))
                          }
                        >
                          {plantilla}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campo de Nombre Manual solo si NO es llanta (las llantas usan la previsualización automática limpia) */}
                {categoriaActivaId !== "llantas" && (
                  <label className={styles.field}>
                    <span className={styles.label}>
                      {tipoItemNuevo === "producto"
                        ? "Nombre del Producto *"
                        : "Nombre del Servicio *"}
                    </span>
                    <input
                      required
                      type="text"
                      className={styles.input}
                      placeholder="Escribe el nombre del ítem o trabajo"
                      value={formNuevo.nombre}
                      onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })}
                    />
                  </label>
                )}

                {/* ============================================================= */}
                {/* PRECIOS Y MARGEN (DOS BOLSILLOS)                              */}
                {/* ============================================================= */}
                <div className={styles.guidedCard}>
                  <div className={styles.guidedCardHeader}>
                    <div className={styles.guidedCardTitle}>
                      <span>💰 Precios y Márgenes (Dos Bolsillos)</span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#5F6368" }}>
                      Soles (S/)
                    </span>
                  </div>

                  <div className={styles.twoPocketGrid}>
                    {/* Precio de Venta al Cliente */}
                    <div className={styles.priceCard}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#1B4332", textTransform: "uppercase" }}>
                        ¿A cuánto vendes al cliente? *
                      </span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "6px 0" }}>
                        <span style={{ fontSize: "16px", fontWeight: "800", color: "#5F6368" }}>S/</span>
                        <input
                          required
                          type="number"
                          step="0.01"
                          min="0"
                          className={styles.input}
                          style={{ fontSize: "20px", fontWeight: "800", padding: "6px 10px", width: "100%" }}
                          placeholder="0.00"
                          value={formNuevo.precio_lista}
                          onChange={(e) =>
                            setFormNuevo({ ...formNuevo, precio_lista: e.target.value })
                          }
                        />
                      </div>
                      <div className={styles.quickPricePills}>
                        <button type="button" className={styles.quickPriceBtn} onClick={() => ajustarPrecioNuevo(5)}>+5</button>
                        <button type="button" className={styles.quickPriceBtn} onClick={() => ajustarPrecioNuevo(10)}>+10</button>
                        <button type="button" className={styles.quickPriceBtn} onClick={() => ajustarPrecioNuevo(20)}>+20</button>
                        <button type="button" className={styles.quickPriceBtn} onClick={redondearPrecioNuevo}>Redondear</button>
                      </div>
                    </div>

                    {/* Costo del Distribuidor */}
                    {tipoItemNuevo === "producto" && (
                      <div className={styles.costCard}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#5F6368", textTransform: "uppercase" }}>
                          ¿A cuánto te deja distribuidor?
                        </span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "6px 0" }}>
                          <span style={{ fontSize: "16px", fontWeight: "800", color: "#5F6368" }}>S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={styles.input}
                            style={{ fontSize: "20px", fontWeight: "800", padding: "6px 10px", width: "100%" }}
                            placeholder="0.00 (Opcional)"
                            value={formNuevo.precio_compra}
                            onChange={(e) =>
                              setFormNuevo({ ...formNuevo, precio_compra: e.target.value })
                            }
                          />
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#5F6368", fontWeight: "500" }}>
                          Costo de reposición por unidad
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Margen de Ganancia en Vivo */}
                  {gananciaNuevo.tieneCosto && (
                    <div className={styles.profitCleanBanner}>
                      <span style={{ fontSize: "20px" }}>💰</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: "800" }}>
                            Ganancia Limpia: S/ {gananciaNuevo.ganancia.toFixed(2)} por unidad
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: "700", background: "#1B4332", color: "#fff", padding: "2px 6px", borderRadius: "6px" }}>
                            +{gananciaNuevo.margen}%
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                          Capital a reponer: <strong style={{ color: "#191C1E" }}>S/ {parseFloat(formNuevo.precio_compra || "0").toFixed(2)}</strong> (No tocar para gastos)
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ============================================================= */}
                {/* EXISTENCIAS / STOCK STEPPER                                   */}
                {/* ============================================================= */}
                {tipoItemNuevo === "producto" && (
                  <div className={styles.guidedCard}>
                    <div className={styles.guidedCardHeader}>
                      <div>
                        <span style={{ fontSize: "12.5px", fontWeight: "800", color: "#191C1E", textTransform: "uppercase" }}>
                          Existencias a Ingresar
                        </span>
                        <span style={{ display: "block", fontSize: "11px", color: "#5F6368" }}>
                          ¿Cuántas unidades tienes físicamente hoy en tienda?
                        </span>
                      </div>
                      <span className={styles.guidedBadge}>En mostrador</span>
                    </div>

                    <div className={styles.stepperBox}>
                      <button
                        type="button"
                        className={`${styles.stepperBtn} ${styles.stepperBtnMinus}`}
                        onClick={() => cambiarStockNuevo(-1)}
                      >
                        −
                      </button>
                      <div>
                        <div className={styles.stepperNumber}>{formNuevo.stock_actual || "0"}</div>
                        <div className={styles.stepperSub}>unidades en tienda</div>
                      </div>
                      <button
                        type="button"
                        className={`${styles.stepperBtn} ${styles.stepperBtnPlus}`}
                        onClick={() => cambiarStockNuevo(1)}
                      >
                        +
                      </button>
                    </div>

                    <div className={styles.quickBatchGrid}>
                      <button type="button" className={styles.quickBatchBtn} onClick={() => cambiarStockNuevo(2)}>
                        +2 (Par)
                      </button>
                      <button type="button" className={styles.quickBatchBtn} onClick={() => cambiarStockNuevo(4)}>
                        +4 (Juego completo)
                      </button>
                      <button type="button" className={styles.quickBatchBtn} onClick={() => cambiarStockNuevo(8)}>
                        +8 (Lote)
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #F4F1EA" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#5F6368" }}>
                        Avisarme cuando queden menos de:
                      </span>
                      <input
                        type="number"
                        min="0"
                        className={styles.input}
                        style={{ width: "80px", textAlign: "center", padding: "4px 8px", fontSize: "13px" }}
                        value={formNuevo.stock_minimo}
                        onChange={(e) =>
                          setFormNuevo({ ...formNuevo, stock_minimo: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Manejo de Posible Duplicado */}
                {candidatosDuplicados && candidatosDuplicados.length > 0 && (
                  <div ref={duplicateBannerRef} className={styles.duplicateBanner} role="alert">
                    <div className={styles.duplicateHeader}>
                      <AlertTriangleIcon size={18} />
                      <span>⚠️ Posible ítem duplicado detectado</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#78350F" }}>
                      Encontramos productos o servicios con nombres similares en tu inventario:
                    </p>
                    <div className={styles.candidatosList}>
                      {candidatosDuplicados.map((c) => (
                        <div key={c.id} className={styles.candidatoItem}>
                          <strong>• {c.nombre}</strong>
                          <span>
                            {[c.marca, c.medida].filter(Boolean).join(" · ") || "Sin detalles"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.duplicateActions}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCandidatosDuplicados(null)}
                      >
                        Revisar datos
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={guardandoNuevo}
                        onClick={() => submitNuevoItem(undefined, true)}
                      >
                        {guardandoNuevo ? "Guardando…" : "Confirmar: Es otro ítem"}
                      </Button>
                    </div>
                  </div>
                )}

                {errorNuevo && !candidatosDuplicados && (
                  <div className={styles.errorBox} role="alert">
                    <p style={{ margin: 0 }}>{errorNuevo}</p>
                  </div>
                )}
              </div>

              {/* Botón Sticky Inferior de Alta Visibilidad */}
              <div className={styles.modalStickyFooter}>
                <button
                  type="submit"
                  disabled={guardandoNuevo || !formNuevo.nombre.trim() || !formNuevo.precio_lista}
                  className={styles.modalPrimaryBtn}
                >
                  <span>
                    {guardandoNuevo
                      ? "Guardando…"
                      : tipoItemNuevo === "producto"
                        ? "GUARDAR Y LISTO PARA VENDER ➔"
                        : "GUARDAR SERVICIO ➔"}
                  </span>
                </button>
                <div style={{ textAlign: "center", fontSize: "11px", fontWeight: "600", color: "#5F6368" }}>
                  Se sincroniza al catálogo y al mostrador táctil al instante
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Modal de Edición con Reposición Rápida en 1 Clic                       */}
      {/* ========================================================================= */}
      {itemAEditar && (
        <div className={styles.modalOverlay} onClick={() => setItemAEditar(null)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Tirador táctil superior para móvil */}
            <div className={styles.dragHandle} />

            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className={styles.modalHeaderIcon}>
                  {esCapital(itemAEditar.clasificacion) ? "🛞" : "🛠️"}
                </div>
                <div>
                  <h2 className={styles.modalTitle}>
                    {esCapital(itemAEditar.clasificacion)
                      ? "Editar Llanta / Reponer Stock"
                      : "Editar Servicio"}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "700", background: "#F4F1EA", padding: "1px 6px", borderRadius: "4px", border: "1px solid #E5E0D5" }}>
                      ID: #{itemAEditar.id}
                    </span>
                    <span style={{ fontSize: "11px", color: "#5F6368" }}>
                      • {negocio.nombre}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setItemAEditar(null)}
                aria-label="Cerrar modal"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={submitEditarItem} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {errorEditar && (
                  <div className={styles.errorBox} role="alert">
                    <p style={{ margin: 0 }}>{errorEditar}</p>
                  </div>
                )}

                {/* ============================================================= */}
                {/* 1. REPOSICIÓN RÁPIDA DE STOCK (1 SOLO TOQUE)                  */}
                {/* ============================================================= */}
                {esCapital(itemAEditar.clasificacion) && (
                  <div className={styles.guidedCard}>
                    <div className={styles.guidedCardHeader}>
                      <div className={styles.guidedCardTitle}>
                        <BoxIcon size={16} />
                        <span>1. Llegó Mercadería (Reposición Rápida)</span>
                      </div>
                      <span className={styles.guidedBadge}>1 Solo Toque</span>
                    </div>

                    {/* Feedback Banner */}
                    <div className={styles.restockFeedbackBanner}>
                      <div>
                        <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#5F6368", textTransform: "uppercase" }}>
                          Estado de Inventario
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "2px" }}>
                          <span style={{ fontSize: "13px", color: "#5F6368" }}>
                            Stock actual: <strong style={{ color: "#191C1E" }}>{itemAEditar.stock_actual} unid.</strong>
                          </span>
                          <span style={{ color: "#1B4332", fontWeight: "800" }}>➔</span>
                          <span style={{ fontSize: "14px", fontWeight: "900", color: "#1B4332", background: "#E8F5E9", padding: "1px 8px", borderRadius: "6px" }}>
                            {formEditar.stock_actual} unid.
                            {restockDelta > 0 && (
                              <span style={{ fontSize: "11px", fontWeight: "600", marginLeft: "4px" }}>
                                (+{restockDelta} agregadas)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <CheckIcon size={22} />
                    </div>

                    {/* Pastillas de Reposición Rápida */}
                    <div className={styles.quickStockPills}>
                      <button
                        type="button"
                        className={`${styles.quickStockPill} ${restockDelta === 1 ? styles.quickStockPillActive : ""}`}
                        onClick={() => setRestockAmount(1)}
                      >
                        <span>+1 unidad</span>
                        <span style={{ fontSize: "11px", opacity: 0.8 }}>+1</span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.quickStockPill} ${restockDelta === 2 ? styles.quickStockPillActive : ""}`}
                        onClick={() => setRestockAmount(2)}
                      >
                        <div style={{ textAlign: "left" }}>
                          <div style={{ lineHeight: 1.1 }}>+2 unid.</div>
                          <div style={{ fontSize: "10px", opacity: 0.75, fontWeight: "normal" }}>(Par)</div>
                        </div>
                        <span style={{ fontSize: "11px", opacity: 0.8 }}>+2</span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.quickStockPill} ${restockDelta === 4 ? styles.quickStockPillActive : ""}`}
                        onClick={() => setRestockAmount(4)}
                      >
                        <div style={{ textAlign: "left" }}>
                          <div style={{ lineHeight: 1.1 }}>+4 unid. ★</div>
                          <div style={{ fontSize: "10px", opacity: 0.75, fontWeight: "normal" }}>(Juego completo)</div>
                        </div>
                        <span style={{ fontSize: "11px", opacity: 0.8 }}>+4</span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.quickStockPill} ${restockDelta === 10 ? styles.quickStockPillActive : ""}`}
                        onClick={() => setRestockAmount(10)}
                      >
                        <div style={{ textAlign: "left" }}>
                          <div style={{ lineHeight: 1.1 }}>+10 unid.</div>
                          <div style={{ fontSize: "10px", opacity: 0.75, fontWeight: "normal" }}>(Carga taller)</div>
                        </div>
                        <span style={{ fontSize: "11px", opacity: 0.8 }}>+10</span>
                      </button>
                    </div>

                    {/* Ajuste Fino Manual de Stock */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #F4F1EA" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#5F6368" }}>
                        O ajuste manual exacto de stock:
                      </span>
                      <input
                        type="number"
                        min="0"
                        className={styles.input}
                        style={{ width: "90px", textAlign: "center", padding: "4px 8px", fontSize: "14px", fontWeight: "800" }}
                        value={formEditar.stock_actual}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormEditar({ ...formEditar, stock_actual: val });
                          const diff = (parseInt(val, 10) || 0) - (itemAEditar.stock_actual ?? 0);
                          setRestockDelta(diff > 0 ? diff : 0);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* 2. ESPECIFICACIONES / DATOS                                   */}
                {/* ============================================================= */}
                <div className={styles.guidedCard}>
                  <div className={styles.guidedCardHeader}>
                    <div className={styles.guidedCardTitle}>
                      <EditIcon size={16} />
                      <span>2. Datos del {esCapital(itemAEditar.clasificacion) ? "Producto" : "Servicio"}</span>
                    </div>
                  </div>

                  <label className={styles.field}>
                    <span className={styles.label}>
                      {esCapital(itemAEditar.clasificacion)
                        ? "Nombre del Producto *"
                        : "Nombre del Servicio *"}
                    </span>
                    <input
                      required
                      type="text"
                      className={styles.input}
                      value={formEditar.nombre}
                      onChange={(e) =>
                        setFormEditar({ ...formEditar, nombre: e.target.value })
                      }
                    />
                  </label>

                  {esCapital(itemAEditar.clasificacion) && (
                    <>
                      <div className={styles.formRow}>
                        <label className={styles.field}>
                          <span className={styles.label}>Medida / Dimensión</span>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="Ej. 185/65 R15"
                            value={formEditar.medida}
                            onChange={(e) =>
                              setFormEditar({ ...formEditar, medida: e.target.value })
                            }
                          />
                        </label>

                        <label className={styles.field}>
                          <span className={styles.label}>Marca del Fabricante</span>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="Ej. Michelin, Goodyear..."
                            value={formEditar.marca}
                            onChange={(e) =>
                              setFormEditar({ ...formEditar, marca: e.target.value })
                            }
                          />
                        </label>
                      </div>

                      <div className={styles.field}>
                        <span className={styles.label}>Condición del Producto</span>
                        <div className={styles.radioPills}>
                          <label
                            className={`${styles.radioPill} ${formEditar.estado_uso === "nuevo" ? styles.radioPillActive : ""}`}
                          >
                            <input
                              type="radio"
                              name="edit_estado_uso"
                              checked={formEditar.estado_uso === "nuevo"}
                              onChange={() =>
                                setFormEditar({ ...formEditar, estado_uso: "nuevo" })
                              }
                            />
                            <span>✨ Nuevo</span>
                          </label>
                          <label
                            className={`${styles.radioPill} ${formEditar.estado_uso === "usado" ? styles.radioPillActive : ""}`}
                          >
                            <input
                              type="radio"
                              name="edit_estado_uso"
                              checked={formEditar.estado_uso === "usado"}
                              onChange={() =>
                                setFormEditar({ ...formEditar, estado_uso: "usado" })
                              }
                            />
                            <span>♻️ De segunda / Seminuevo</span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ============================================================= */}
                {/* 3. PRECIOS Y MARGEN (DOS BOLSILLOS)                           */}
                {/* ============================================================= */}
                <div className={styles.guidedCard}>
                  <div className={styles.guidedCardHeader}>
                    <div className={styles.guidedCardTitle}>
                      <span>💰 3. Precios y Margen de Utilidad</span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#5F6368" }}>
                      Soles (S/)
                    </span>
                  </div>

                  <div className={styles.twoPocketGrid}>
                    {/* Precio de Venta al Cliente */}
                    <div className={styles.priceCard}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#1B4332", textTransform: "uppercase" }}>
                        Precio Venta (Público) *
                      </span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "6px 0" }}>
                        <span style={{ fontSize: "16px", fontWeight: "800", color: "#5F6368" }}>S/</span>
                        <input
                          required
                          type="number"
                          step="0.01"
                          min="0"
                          className={styles.input}
                          style={{ fontSize: "20px", fontWeight: "800", padding: "6px 10px", width: "100%" }}
                          value={formEditar.precio_lista}
                          onChange={(e) =>
                            setFormEditar({ ...formEditar, precio_lista: e.target.value })
                          }
                        />
                      </div>
                      <div className={styles.quickPricePills}>
                        <button type="button" className={styles.quickPriceBtn} onClick={() => ajustarPrecioEditar(5)}>+5</button>
                        <button type="button" className={styles.quickPriceBtn} onClick={() => ajustarPrecioEditar(10)}>+10</button>
                        <button type="button" className={styles.quickPriceBtn} onClick={redondearPrecioEditar}>Redondear</button>
                      </div>
                    </div>

                    {/* Costo de Compra */}
                    {esCapital(itemAEditar.clasificacion) && (
                      <div className={styles.costCard}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#5F6368", textTransform: "uppercase" }}>
                          Costo Distribuidor
                        </span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "6px 0" }}>
                          <span style={{ fontSize: "16px", fontWeight: "800", color: "#5F6368" }}>S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={styles.input}
                            style={{ fontSize: "20px", fontWeight: "800", padding: "6px 10px", width: "100%" }}
                            value={formEditar.precio_compra}
                            onChange={(e) =>
                              setFormEditar({ ...formEditar, precio_compra: e.target.value })
                            }
                          />
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#5F6368", fontWeight: "500" }}>
                          Precio compra por unidad
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Margen en Vivo */}
                  {gananciaEditar.tieneCosto && (
                    <div className={styles.profitCleanBanner}>
                      <span style={{ fontSize: "20px" }}>💰</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: "800" }}>
                            Ganancia limpia: S/ {gananciaEditar.ganancia.toFixed(2)} por unidad
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: "700", background: "#1B4332", color: "#fff", padding: "2px 6px", borderRadius: "6px" }}>
                            +{gananciaEditar.margen}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ============================================================= */}
                {/* 4. VISIBILIDAD EN MOSTRADOR (INTERRUPTOR TÁCTIL)              */}
                {/* ============================================================= */}
                <div className={styles.toggleCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "22px" }}>👁️</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "800", color: "#191C1E" }}>
                        Visible para venta en mostrador
                      </div>
                      <div style={{ fontSize: "11px", color: "#5F6368" }}>
                        {formEditar.activo
                          ? "Aparecerá en el teclado táctil de cobro rápido"
                          : "Pausado temporalmente (no saldrá en POS)"}
                      </div>
                    </div>
                  </div>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={formEditar.activo}
                      onChange={(e) => setFormEditar({ ...formEditar, activo: e.target.checked })}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              </div>

              {/* Botón Sticky Inferior */}
              <div className={styles.modalStickyFooter}>
                <button
                  type="submit"
                  disabled={guardandoEditar || !formEditar.nombre.trim() || !formEditar.precio_lista}
                  className={styles.modalPrimaryBtn}
                >
                  <span>{guardandoEditar ? "Guardando…" : "GUARDAR CAMBIOS ➔"}</span>
                </button>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#5F6368", fontWeight: "600" }}>
                  <span>Tocar fuera para descartar</span>
                  <span>Stock resultante: {formEditar.stock_actual} unid.</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Modal de Confirmación de Eliminación                                    */}
      {/* ========================================================================= */}
      {itemAEliminar && (
        <div className={styles.modalOverlay} onClick={() => setItemAEliminar(null)}>
          <div
            className={`${styles.modalCard} ${styles.deleteCard}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.deleteIconWrap}>
              <TrashIcon size={24} />
            </div>

            <h2 className={styles.modalTitle}>
              ¿Eliminar {esCapital(itemAEliminar.clasificacion) ? "producto" : "servicio"}?
            </h2>

            <div className={styles.deleteItemSummary}>
              <span className={styles.deleteItemName}>{itemAEliminar.nombre}</span>
              <span className={styles.deleteItemDetail}>
                {formatMoney(itemAEliminar.precio_lista)}
              </span>
            </div>

            <p className={styles.deleteWarningNote}>
              Si este ítem tiene movimientos, ventas o compras registradas, se desactivará de forma segura para conservar intacto tu historial contable. Si no tiene movimientos vinculados, se eliminará por completo.
            </p>

            {errorEliminar && (
              <div className={styles.errorBox} role="alert" style={{ marginBottom: "16px" }}>
                <p style={{ margin: 0 }}>{errorEliminar}</p>
              </div>
            )}

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setItemAEliminar(null)}
                disabled={eliminando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmarEliminarItem}
                disabled={eliminando}
              >
                {eliminando ? "Eliminando…" : "Sí, eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
