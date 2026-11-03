import { useEffect, useState } from "react";
import { api } from "./client";
import { useAuth } from "../hooks/useAuth";

/**
 * Resuelve el usuario del negocio para asociarlo a las operaciones contables.
 * Prioriza de inmediato el usuarioId almacenado en la sesión local (disponible offline
 * y al despertar la app), evitando bloqueos o fallos de red.
 */
export function useUsuarioPrincipal(negocioId: number | undefined) {
  const { session } = useAuth();
  const [usuarioId, setUsuarioId] = useState<number | null>(() => session?.usuarioId ?? null);
  const [loading, setLoading] = useState(session?.usuarioId == null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.usuarioId != null) {
      setUsuarioId(session.usuarioId);
      setLoading(false);
      return;
    }

    if (negocioId === undefined) return;
    let cancelado = false;
    setLoading(true);
    api
      .listUsuarios(negocioId)
      .then((usuarios) => {
        if (cancelado) return;
        setUsuarioId(usuarios[0]?.id ?? null);
        if (usuarios.length === 0) {
          setError("El negocio no tiene ningún usuario todavía.");
        }
      })
      .catch((err) => {
        if (!cancelado) {
          // Si falló por offline pero ya teníamos id previo, no sobreescribir con error
          if (!usuarioId) {
            setError(err instanceof Error ? err.message : "Error inesperado");
          }
        }
      })
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [negocioId, session?.usuarioId, usuarioId]);

  return { usuarioId, loading, error };
}
