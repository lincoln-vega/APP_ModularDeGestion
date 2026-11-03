import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, onUnauthorized, setToken } from "../api/client";

const SESSION_KEY = "gestion:session";

export interface Session {
  rol: string;
  negocioId: number | null;
  nombre: string;
  usuarioId: number | null;
}

interface AuthContextValue {
  session: Session | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<Session>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extraerUsuarioIdDeToken(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    const id = Number(payload.sub);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

function leerSesionGuardada(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (session && session.usuarioId == null) {
      session.usuarioId = extraerUsuarioIdDeToken(getToken());
    }
    return session;
  } catch {
    return null;
  }
}

function guardarSesion(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ver setToken en client.ts — mismo motivo, no es crítico.
  }
}

/**
 * Sesión de la app. El token en sí vive en client.ts (getToken/setToken,
 * junto al fetch que lo usa); acá se guarda además `{rol, negocioId,
 * nombre, usuarioId}` — lo que devuelve el login — para no tener que decodificar el
 * JWT en el cliente solo para saber quién es el usuario.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => leerSesionGuardada());
  const navigate = useNavigate();

  useEffect(() => {
    return onUnauthorized(() => {
      guardarSesion(null);
      setSession(null);
      navigate("/login", { replace: true });
    });
  }, [navigate]);

  // Keep-alive silencioso: renueva el token al reabrir la app o periódicamente para evitar desconexiones
  useEffect(() => {
    if (!session) return;

    let cancelado = false;
    const intentarRenovarToken = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const renovado = await api.refreshToken();
        if (cancelado) return;
        setToken(renovado.access_token);
        const sesionActualizada: Session = {
          rol: renovado.rol,
          negocioId: renovado.negocio_id,
          nombre: renovado.nombre,
          usuarioId: renovado.usuario_id ?? session.usuarioId,
        };
        guardarSesion(sesionActualizada);
        setSession(sesionActualizada);
      } catch {
        // En caso de fallo transitorio o Railway iniciando, no interrumpimos la sesión activa
      }
    };

    const onResume = () => {
      if (document.visibilityState === "visible") {
        intentarRenovarToken();
      }
    };

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);

    // Renovar cada 12 horas si la app se mantiene abierta
    const interval = setInterval(intentarRenovarToken, 12 * 60 * 60 * 1000);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      clearInterval(interval);
    };
  }, [session]);

  const login = useCallback(async (username: string, password: string): Promise<Session> => {
    const res = await api.login(username, password);
    setToken(res.access_token);
    const nuevaSesion: Session = {
      rol: res.rol,
      negocioId: res.negocio_id,
      nombre: res.nombre,
      usuarioId: res.usuario_id ?? extraerUsuarioIdDeToken(res.access_token),
    };
    guardarSesion(nuevaSesion);
    setSession(nuevaSesion);
    return nuevaSesion;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    guardarSesion(null);
    setSession(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const value: AuthContextValue = {
    session,
    isAdmin: session?.rol === "admin",
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
