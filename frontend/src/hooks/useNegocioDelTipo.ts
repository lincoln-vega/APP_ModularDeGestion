import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Negocio } from "../api/client";
import { useNegocio } from "../api/useNegocio";
import { useAuth } from "./useAuth";
import { NEGOCIOS_CONFIG, esNegocioTipo, type NegocioTipo, tipoDesdeRubro } from "../data/negociosConfig";

/**
 * Resuelve el tipo de negocio a partir de `:negocioTipo` en la ruta y trae
 * el negocio real correspondiente. `tipoValido` distingue una ruta con un
 * tipo inexistente (el caller decide qué hacer, normalmente redirigir) de
 * un tipo válido que simplemente no tiene negocio creado todavía — o que
 * no es el negocio de quien está logueado.
 *
 * Dos caminos según el rol, porque GET /negocios (listar todos) quedó
 * admin-only al agregar autenticación:
 * - Admin: sigue listando y buscando por rubro (puede, y puede crear uno
 *   de prueba — ver useNegocio).
 * - Usuario normal: su negocio sale directo de `session.negocioId`, sin
 *   listar nada; si ese negocio no es del rubro que pide la URL (un
 *   usuario de lubricentro entrando a /llanteria), se trata como ruta
 *   inválida en vez de mostrar datos de otro negocio.
 */
export function useNegocioDelTipo() {
  const { negocioTipo } = useParams<{ negocioTipo: string }>();
  const { session, isAdmin } = useAuth();
  const tipoValidoParam = esNegocioTipo(negocioTipo);
  const tipo: NegocioTipo = tipoValidoParam ? negocioTipo : "llanteria";
  const config = NEGOCIOS_CONFIG[tipo];

  const plantilla = {
    nombre: config.nombreFallback,
    modulos_activos: config.modulosActivosDefault,
    plan_estado: "activo",
    fecha_ultimo_pago: null,
    link_sunat: null,
    modulo_rus_activo: config.moduloRusActivoDefault,
  };

  // Los hooks se llaman siempre, mismo orden — el que no aplica según el
  // rol queda deshabilitado (enabled/negocioId undefined) en vez de
  // saltearse con un if, que rompería las reglas de hooks apenas cambia
  // el rol o la ruta.
  const negocioAdmin = useNegocio(config.rubro, plantilla, isAdmin);

  const [negocioSesion, setNegocioSesion] = useState<Negocio | null>(null);
  const [loadingSesion, setLoadingSesion] = useState(true);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin || session?.negocioId == null) {
      setLoadingSesion(false);
      return;
    }
    let cancelado = false;
    setLoadingSesion(true);
    setErrorSesion(null);
    api
      .getNegocio(session.negocioId)
      .then((n) => !cancelado && setNegocioSesion(n))
      .catch((err) => !cancelado && setErrorSesion(err instanceof Error ? err.message : "Error inesperado"))
      .finally(() => !cancelado && setLoadingSesion(false));
    return () => {
      cancelado = true;
    };
  }, [isAdmin, session?.negocioId]);

  const fallbackNegocio: Negocio = {
    id: session?.negocioId ?? 1,
    nombre: config.nombreFallback,
    rubro: config.rubro,
    modulos_activos: config.modulosActivosDefault,
    plan_estado: "activo",
    fecha_ultimo_pago: null,
    link_sunat: null,
    modulo_rus_activo: config.moduloRusActivoDefault,
  };

  if (isAdmin) {
    return {
      tipo,
      tipoValido: tipoValidoParam,
      config,
      ...negocioAdmin,
      negocio: negocioAdmin.negocio ?? (negocioAdmin.error ? fallbackNegocio : null),
    };
  }

  const rubroCoincide = tipoDesdeRubro(negocioSesion?.rubro) === tipo;
  const negocioFinal = rubroCoincide
    ? negocioSesion
    : errorSesion
      ? fallbackNegocio
      : null;

  return {
    tipo,
    tipoValido: tipoValidoParam && (loadingSesion || rubroCoincide || Boolean(errorSesion)),
    config,
    negocio: negocioFinal,
    loading: loadingSesion,
    error: errorSesion,
    recargar: () => {},
    crearDePrueba: async (): Promise<never> => {
      throw new Error("Solo un administrador puede crear negocios.");
    },
  };
}
