// Preset de categorías, marcas y medidas comerciales para el asistente
// inteligente de creación y edición de productos/servicios.

export interface CategoriaPreset {
  id: string;
  nombre: string;
  icono: string;
  tipo: "producto" | "servicio";
  clasificacion: "capital" | "servicio";
  descripcion: string;
}

export const CATEGORIAS_DEFAULT: CategoriaPreset[] = [
  {
    id: "llantas",
    nombre: "Llantas",
    icono: "🚗",
    tipo: "producto",
    clasificacion: "capital",
    descripcion: "Neumáticos nuevos y usados por medida y marca",
  },
  {
    id: "parches_servicios",
    nombre: "Parchados y Servicios",
    icono: "🛠️",
    tipo: "servicio",
    clasificacion: "servicio",
    descripcion: "Mano de obra (parchado, alineación) e insumos (cajas de parches, mechas)",
  },
  {
    id: "aceites",
    nombre: "Aceites y Lubricantes",
    icono: "🛢️",
    tipo: "producto",
    clasificacion: "capital",
    descripcion: "Aceites de motor, caja y fluidos por viscosidad",
  },
  {
    id: "aditivos",
    nombre: "Aditivos y Fluidos",
    icono: "🧪",
    tipo: "producto",
    clasificacion: "capital",
    descripcion: "Refrigerante, líquido de frenos, limpia inyectores",
  },
  {
    id: "accesorios",
    nombre: "Accesorios y Repuestos",
    icono: "🔩",
    tipo: "producto",
    clasificacion: "capital",
    descripcion: "Filtros, plumillas, tuercas de rueda y repuestos",
  },
  {
    id: "otro",
    nombre: "Otro Producto / Especial",
    icono: "📦",
    tipo: "producto",
    clasificacion: "capital",
    descripcion: "Artículos personalizados fuera de las categorías base",
  },
];

export const MARCAS_LLANTAS_DEFAULT = [
  "Michelin",
  "Bridgestone",
  "Goodyear",
  "Continental",
  "Pirelli",
  "Dunlop",
  "Hankook",
  "Westlake",
  "Triangle",
  "Linglong",
  "Yokohama",
  "Maxxis",
  "Firestone",
  "Sailun",
  "Kumho",
];

export interface MedidaAro {
  aro: string; // ej. "Aro 13", "Aro 14", "Aro 15", "Aro 16", "Aro 17", "Aro 18+"
  medidas: string[];
}

export const MEDIDAS_LLANTAS_POR_ARO: MedidaAro[] = [
  {
    aro: "Aro 13",
    medidas: [
      "155/80 R13",
      "165/70 R13",
      "175/70 R13",
      "185/65 R13",
      "185/70 R13",
    ],
  },
  {
    aro: "Aro 14",
    medidas: [
      "175/65 R14",
      "175/70 R14",
      "185/60 R14",
      "185/65 R14",
      "185/70 R14",
      "195/70 R14",
    ],
  },
  {
    aro: "Aro 15",
    medidas: [
      "185/60 R15",
      "185/65 R15",
      "195/60 R15",
      "195/65 R15",
      "195/70 R15",
      "205/65 R15",
      "205/70 R15",
      "235/75 R15",
    ],
  },
  {
    aro: "Aro 16",
    medidas: [
      "205/55 R16",
      "205/60 R16",
      "215/60 R16",
      "215/65 R16",
      "225/60 R16",
      "245/70 R16",
      "265/70 R16",
    ],
  },
  {
    aro: "Aro 17",
    medidas: [
      "215/55 R17",
      "225/60 R17",
      "225/65 R17",
      "235/65 R17",
      "265/65 R17",
    ],
  },
  {
    aro: "Aro 18+",
    medidas: [
      "225/45 R18",
      "235/50 R18",
      "245/45 R18",
      "265/60 R18",
      "275/55 R20",
    ],
  },
];

export const ACEITES_VISCOSIDADES_DEFAULT = [
  "10W-40",
  "20W-50",
  "5W-30",
  "15W-40",
  "5W-40",
  "0W-20",
  "75W-90",
  "80W-90",
  "Monogrado 50",
];

export const ACEITES_MARCAS_DEFAULT = [
  "Motul",
  "Castrol",
  "Mobil",
  "Shell",
  "Liqui Moly",
  "Valvoline",
  "Total",
  "Vistony",
  "Repsol",
  "Havoline",
];

export const ACEITES_PRESENTACIONES_DEFAULT = [
  "1/4 Galón",
  "Galón (4L)",
  "Litro (1L)",
  "Balde (5 Gal)",
];

export const PARCHES_PLANTILLAS_DEFAULT = [
  "Parche Frío Redondo",
  "Parche Frío Ovalado",
  "Parche Radial",
  "Mecha / Tarugo de Vulcanizar",
  "Cámara Aro 13",
  "Cámara Aro 14",
  "Cámara Aro 15",
  "Cámara Aro 16",
  "Válvula Pitón TR414",
  "Válvula Pitón TR413",
  "Cemento Vulcanizante (Lata)",
];

export const PARCHES_MEDIDAS_DEFAULT = [
  "00",
  "01",
  "02",
  "03",
  "RAC 10",
  "RAC 12",
  "RAC 14",
  "RAC 20",
  "VD-1",
  "VD-2",
  "Tarugo / Mecha",
  "Lata 250ml",
  "Lata 500ml",
];

export const PARCHES_MARCAS_DEFAULT = [
  "Vipal",
  "Rema TipTop",
  "Maruni",
  "Tech",
  "Slime",
];

export const PARCHES_PRESENTACIONES_DEFAULT = [
  "Caja x 100",
  "Caja x 50",
  "Caja x 20",
  "Lata / Tubo",
  "Unidad suelta",
];

export const PARCHADOS_SERVICIOS_PLANTILLAS_DEFAULT = [
  "Parchado de auto (frío)",
  "Parchado de auto (tarugo)",
  "Parchado de camioneta / SUV",
  "Parchado de moto / mototaxi",
  "Vulcanizado en caliente",
  "Enllante y desllante (por rueda)",
  "Balanceo computarizado (por rueda)",
  "Alineamiento computarizado",
  "Cambio de aceite y filtro",
  "Bajada y subida de rueda",
  "Rotación de 4 ruedas",
  "Calibración de aire con nitrógeno",
];

export const PARCHADOS_MEDIDAS_SERVICIOS_DEFAULT = [
  "Chico 00",
  "Mediano 01",
  "Grande 02",
  "RAC 10",
  "RAC 12",
  "RAC 14",
  "VD-1",
  "Tarugo / Mecha",
  "Estándar",
];

export const ADITIVOS_PLANTILLAS_DEFAULT = [
  "Refrigerante / Coolant (Galón)",
  "Refrigerante / Coolant (Litro)",
  "Líquido de Frenos DOT 3",
  "Líquido de Frenos DOT 4",
  "Limpia Inyectores Gasolina",
  "Limpia Inyectores Diésel",
  "Agua Desmineralizada / Batería",
  "Spray Aflojatodo (WD-40)",
  "Silicona para Tablero",
  "Desengrasante de Motor",
];

export const ACCESORIOS_PLANTILLAS_DEFAULT = [
  "Filtro de Aceite",
  "Filtro de Aire",
  "Filtro de Gasolina",
  "Plumilla Limpiaparabrisas 16\"",
  "Plumilla Limpiaparabrisas 18\"",
  "Plumilla Limpiaparabrisas 20\"",
  "Plumilla Limpiaparabrisas 22\"",
  "Tuerca de Rueda",
  "Perno de Rueda",
  "Tapa de Válvula de Lujo",
];

export const SERVICIOS_PLANTILLAS_DEFAULT = [
  "Parchado de auto (frío)",
  "Parchado de auto (tarugo)",
  "Parchado de camioneta / SUV",
  "Parchado de moto / mototaxi",
  "Enllante y desllante (por rueda)",
  "Balanceo computarizado (por rueda)",
  "Alineamiento computarizado",
  "Cambio de aceite y filtro",
  "Bajada y subida de rueda",
  "Rotación de 4 ruedas",
  "Calibración de aire con nitrógeno",
];

// --- Manejo de Persistencia de Opciones Personalizadas por Negocio ---

export interface CustomCatalogStorage {
  arosPersonalizados?: string[];
  marcasPersonalizadas: string[];
  medidasPersonalizadas: { aro: string; medida: string }[];
  categoriasPersonalizadas: CategoriaPreset[];
  plantillasPersonalizadas: { categoriaId: string; nombre: string }[];
}

const STORAGE_PREFIX = "gestion:custom_catalog_";

export function getCustomCatalog(negocioId: number): CustomCatalogStorage {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${negocioId}`);
    if (!raw) {
      return {
        arosPersonalizados: [],
        marcasPersonalizadas: [],
        medidasPersonalizadas: [],
        categoriasPersonalizadas: [],
        plantillasPersonalizadas: [],
      };
    }
    const parsed = JSON.parse(raw);
    return {
      arosPersonalizados: parsed.arosPersonalizados || [],
      marcasPersonalizadas: parsed.marcasPersonalizadas || [],
      medidasPersonalizadas: parsed.medidasPersonalizadas || [],
      categoriasPersonalizadas: parsed.categoriasPersonalizadas || [],
      plantillasPersonalizadas: parsed.plantillasPersonalizadas || [],
    };
  } catch {
    return {
      arosPersonalizados: [],
      marcasPersonalizadas: [],
      medidasPersonalizadas: [],
      categoriasPersonalizadas: [],
      plantillasPersonalizadas: [],
    };
  }
}

export function saveCustomCatalog(
  negocioId: number,
  data: CustomCatalogStorage,
): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${negocioId}`, JSON.stringify(data));
  } catch (e) {
    console.warn("No se pudo guardar catálogo personalizado en localStorage:", e);
  }
}

export function addCustomAro(negocioId: number, aro: string): void {
  let a = aro.trim();
  if (!a) return;
  if (!a.toLowerCase().startsWith("aro") && !isNaN(Number(a))) {
    a = `Aro ${a}`;
  }
  const data = getCustomCatalog(negocioId);
  if (!data.arosPersonalizados) data.arosPersonalizados = [];
  if (!data.arosPersonalizados.includes(a)) {
    data.arosPersonalizados.push(a);
    saveCustomCatalog(negocioId, data);
  }
}

export function removeCustomAro(negocioId: number, aro: string): void {
  const data = getCustomCatalog(negocioId);
  if (!data.arosPersonalizados) return;
  data.arosPersonalizados = data.arosPersonalizados.filter((a) => a !== aro);
  saveCustomCatalog(negocioId, data);
}

export function addCustomMarca(negocioId: number, marca: string): void {
  const m = marca.trim();
  if (!m) return;
  const data = getCustomCatalog(negocioId);
  if (!data.marcasPersonalizadas.includes(m) && !MARCAS_LLANTAS_DEFAULT.includes(m)) {
    data.marcasPersonalizadas.push(m);
    saveCustomCatalog(negocioId, data);
  }
}

export function removeCustomMarca(negocioId: number, marca: string): void {
  const data = getCustomCatalog(negocioId);
  data.marcasPersonalizadas = data.marcasPersonalizadas.filter((m) => m !== marca);
  saveCustomCatalog(negocioId, data);
}

export function addCustomMedida(
  negocioId: number,
  aro: string,
  medida: string,
): void {
  const med = medida.trim().toUpperCase();
  if (!med) return;
  const data = getCustomCatalog(negocioId);
  const existe = data.medidasPersonalizadas.some(
    (item) => item.medida.toUpperCase() === med,
  );
  if (!existe) {
    data.medidasPersonalizadas.push({ aro: aro || "Otras Medidas", medida: med });
    saveCustomCatalog(negocioId, data);
  }
}

export function removeCustomMedida(negocioId: number, medida: string): void {
  const data = getCustomCatalog(negocioId);
  data.medidasPersonalizadas = data.medidasPersonalizadas.filter(
    (item) => item.medida.toUpperCase() !== medida.toUpperCase(),
  );
  saveCustomCatalog(negocioId, data);
}

export function addCustomCategoria(
  negocioId: number,
  categoria: CategoriaPreset,
): void {
  const data = getCustomCatalog(negocioId);
  const existe =
    CATEGORIAS_DEFAULT.some((c) => c.id === categoria.id) ||
    data.categoriasPersonalizadas.some((c) => c.id === categoria.id);
  if (!existe) {
    data.categoriasPersonalizadas.push(categoria);
    saveCustomCatalog(negocioId, data);
  }
}

export function removeCustomCategoria(negocioId: number, categoriaId: string): void {
  const data = getCustomCatalog(negocioId);
  data.categoriasPersonalizadas = data.categoriasPersonalizadas.filter(
    (c) => c.id !== categoriaId,
  );
  saveCustomCatalog(negocioId, data);
}
