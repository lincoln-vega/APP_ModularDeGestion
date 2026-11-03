import { BoxIcon, CashIcon, HomeIcon, ReceiptIcon, UserIcon } from "../components/icons/Icons";
import type { NavItem } from "../components/AppShell";
import type { NegocioTipo } from "./negociosConfig";

/**
 * Ítems de la barra de navegación (sidebar en escritorio, barra inferior táctil en móvil).
 * Se derivan dinámicamente de los módulos activos de cada negocio (multi-tenant escalable),
 * asegurando consistencia entre talleres, lubricentros, lencerías/retail o futuros rubros.
 */
export function navItemsFor(
  tipo: NegocioTipo,
  modulosActivos?: Record<string, unknown>,
  moduloRusActivo?: boolean,
): NavItem[] {
  const base = `/${tipo}`;
  const items: NavItem[] = [
    { id: "inicio", label: "Inicio", icon: HomeIcon, to: base },
  ];

  // Módulo de Stock e Inventario (activo por defecto salvo para lubricentro u omitido explícitamente)
  const tieneStock =
    modulosActivos && typeof modulosActivos.stock === "boolean"
      ? Boolean(modulosActivos.stock)
      : tipo !== "lubricentro";
  if (tieneStock) {
    items.push({ id: "stock", label: "Stock", icon: BoxIcon, to: `${base}/stock` });
  }

  // Módulo de Clientes / Vehículos (activo para lubricentro o según configuración de módulos)
  const tieneClientes =
    modulosActivos && typeof modulosActivos.clientes_vehiculos === "boolean"
      ? Boolean(modulosActivos.clientes_vehiculos)
      : tipo === "lubricentro";
  if (tieneClientes) {
    items.push({ id: "clientes", label: "Clientes", icon: UserIcon, to: `${base}/clientes` });
  }

  // Módulo de Caja (siempre presente para control de turno y efectivo)
  items.push({ id: "caja", label: "Caja", icon: CashIcon, to: `${base}/cierre-caja` });

  // Módulo SUNAT / RUS (régimen simplificado de boletas)
  const tieneSunat =
    moduloRusActivo !== undefined
      ? moduloRusActivo
      : tipo === "llanteria" || tipo === "lenceria";
  if (tieneSunat) {
    items.push({ id: "sunat", label: "SUNAT", icon: ReceiptIcon, to: `${base}/sunat` });
  }

  return items;
}
