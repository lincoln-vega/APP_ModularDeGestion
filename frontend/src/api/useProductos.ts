import { useCallback, useEffect, useState } from "react";
import { api, type Producto } from "./client";

export function useProductos(negocioId: number | undefined) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (negocioId === undefined) return;
    setLoading(true);
    setError(null);
    try {
      setProductos(await api.listProductos(negocioId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al cargar productos");
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }, [negocioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { productos, loading, error, recargar: cargar };
}
