// Esto es configuración de PANTALLA (íconos, etiquetas, a qué clasificación
// de producto corresponde cada acción rápida) — no datos de negocio. Los
// productos, precios y stock reales siempre vienen de la API; acá solo se
// decide cómo se ve y cómo se agrupa cada rubro. Agregar un tercer negocio
// (otro rubro) es sumar una entrada más a este objeto, no tocar ninguna
// pantalla.

import type { IconProps } from "../components/icons/Icons";
import {
  FilterIcon,
  GaugeIcon,
  NutIcon,
  OilDropIcon,
  SprayIcon,
  TireIcon,
  TubeIcon,
  WrenchIcon,
  SparklesIcon,
  BoxIcon,
} from "../components/icons/Icons";

export interface AccionRapida {
  id: string;
  label: string;
  icon: (props: IconProps) => JSX.Element;
  // Nombrado distinto de Producto.clasificacion a propósito: esto es
  // agrupación de PANTALLA (qué sección del Inicio, "capital" vs "no
  // capital" en el filtro real — ver lib/contabilidad.ts), no el valor
  // real que guarda el backend ("capital" es el único que importa ahí).
  categoria: "servicio" | "producto";
  /** Solo "venta de llanta" agrupa por medida antes de mostrar marcas —
   * ver MovimientoFlow. */
  agruparPorMedida?: boolean;
}

export interface NegocioTipoConfig {
  /** Debe calzar exacto (case-insensitive) con Negocio.rubro en la API —
   * ver useNegocio. */
  rubro: string;
  nombreFallback: string;
  saludoFallback: string;
  logo: (props: IconProps) => JSX.Element;
  servicios: AccionRapida[];
  productos: AccionRapida[];
  /** Con qué módulos opcionales arranca el negocio de prueba — ver
   * useNegocio. En producción esto lo decide quien instala la app, no el
   * frontend; acá es solo el valor por defecto de la semilla de prueba. */
  modulosActivosDefault: Record<string, boolean>;
  moduloRusActivoDefault: boolean;
}

export const NEGOCIOS_CONFIG = {
  llanteria: {
    rubro: "llantería",
    nombreFallback: "Llantería",
    saludoFallback: "Hola",
    logo: TireIcon,
    servicios: [
      { id: "parchado", label: "Parchado", icon: WrenchIcon, categoria: "servicio" },
      { id: "balanceo", label: "Balanceo", icon: GaugeIcon, categoria: "servicio" },
      { id: "enllante", label: "Enllante", icon: TireIcon, categoria: "servicio" },
      { id: "inflado", label: "Inflado", icon: GaugeIcon, categoria: "servicio" },
    ],
    productos: [
      {
        id: "venta-llanta",
        label: "Venta de llanta",
        icon: TireIcon,
        categoria: "producto",
        agruparPorMedida: true,
      },
      { id: "parches-insumos", label: "Parches e Insumos", icon: WrenchIcon, categoria: "producto" },
      { id: "accesorio", label: "Accesorio", icon: NutIcon, categoria: "producto" },
    ],
    modulosActivosDefault: {},
    // El papá (dueño de la llantería) es justo el caso RUS del spec —
    // negocio chico, régimen simplificado.
    moduloRusActivoDefault: true,
  },
  lubricentro: {
    rubro: "lubricentro",
    nombreFallback: "Lubricentro",
    saludoFallback: "Hola",
    logo: OilDropIcon,
    servicios: [
      { id: "cambio-aceite", label: "Cambio de aceite", icon: OilDropIcon, categoria: "servicio" },
      { id: "lavado-motor", label: "Lavado de motor", icon: SprayIcon, categoria: "servicio" },
    ],
    productos: [
      { id: "filtro-aire", label: "Filtro de aire", icon: FilterIcon, categoria: "producto" },
      { id: "silicona", label: "Silicona", icon: TubeIcon, categoria: "producto" },
    ],
    modulosActivosDefault: { clientes_vehiculos: true },
    moduloRusActivoDefault: false,
  },
  lenceria: {
    rubro: "lencería",
    nombreFallback: "Lencería & Modas",
    saludoFallback: "Hola",
    logo: SparklesIcon,
    servicios: [
      { id: "ajuste-costura", label: "Ajuste / Costura", icon: WrenchIcon, categoria: "servicio" },
      { id: "planchado", label: "Planchado y Vapor", icon: SprayIcon, categoria: "servicio" },
    ],
    productos: [
      { id: "prendas-conjuntos", label: "Prendas y Conjuntos", icon: BoxIcon, categoria: "producto" },
      { id: "accesorios-moda", label: "Accesorios", icon: SparklesIcon, categoria: "producto" },
    ],
    modulosActivosDefault: { stock: true },
    moduloRusActivoDefault: true,
  },
} as const satisfies Record<string, NegocioTipoConfig>;

export type NegocioTipo = keyof typeof NEGOCIOS_CONFIG;

export function esNegocioTipo(valor: string | undefined): valor is NegocioTipo {
  return valor !== undefined && valor in NEGOCIOS_CONFIG;
}

export function tipoDesdeRubro(rubro: string | undefined | null): NegocioTipo {
  if (!rubro) return "llanteria";
  const r = rubro
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (r.includes("llant") || r.includes("neumat")) return "llanteria";
  if (r.includes("lubri") || r.includes("aceit")) return "lubricentro";
  if (
    r.includes("lencer") ||
    r.includes("ropa") ||
    r.includes("boutique") ||
    r.includes("moda") ||
    r.includes("textil")
  ) {
    return "lenceria";
  }

  const match = (Object.keys(NEGOCIOS_CONFIG) as NegocioTipo[]).find((tipo) => {
    const configRubro = NEGOCIOS_CONFIG[tipo].rubro
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    return configRubro === r;
  });

  return match ?? "llanteria";
}

export function buscarAccion(tipo: NegocioTipo, accionId: string): AccionRapida | undefined {
  const config = NEGOCIOS_CONFIG[tipo];
  return [...config.servicios, ...config.productos].find((a) => a.id === accionId);
}
