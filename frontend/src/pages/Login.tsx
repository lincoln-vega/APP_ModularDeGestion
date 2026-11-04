import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { resolverDestino } from "../hooks/useDestinoSesion";
import { ApiError, BASE_URL } from "../api/client";
import { GaugeIcon, WrenchIcon } from "../components/icons/Icons";
import styles from "./Login.module.css";

export default function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Ya logueado — redirigir según corresponda
  if (session) {
    return <Navigate to="/" replace />;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const nuevaSesion = await login(username, password);
      if (nuevaSesion.rol === "admin") {
        navigate("/negocios", { replace: true });
      } else {
        const destino = await resolverDestino(nuevaSesion);
        navigate(destino, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Usuario o contraseña incorrectos.");
      } else if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
        setError(
          `No se pudo conectar con el servidor backend (${BASE_URL}). Verifica que el servicio en Railway esté activo y sin errores.`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Error al intentar iniciar sesión.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={enviar}>
        <div className={styles.badge}>
          <GaugeIcon size={14} />
          <span>Sistema Modular de Gestión</span>
        </div>

        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <WrenchIcon size={24} />
          </div>
          <div>
            <h1 className={styles.title}>Bienvenido</h1>
            <p className={styles.subtitle}>Ingresa tus credenciales para acceder</p>
          </div>
        </div>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>Usuario</span>
            <div className={styles.inputWrapper}>
              <input
                className={styles.input}
                type="text"
                placeholder="Ej. lincoln o llanteria"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Contraseña</span>
            <div className={styles.inputWrapper}>
              <input
                type={mostrarPassword ? "text" : "password"}
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setMostrarPassword(!mostrarPassword)}
                tabIndex={-1}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <div className={styles.errorBox} role="alert">
            <span className={styles.errorDot} />
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        <Button
          type="submit"
          fullWidth
          disabled={enviando || !username || !password}
        >
          {enviando ? "Autenticando…" : "Ingresar al Sistema"}
        </Button>

        <div className={styles.quickAccessSection}>
          <p className={styles.quickAccessTitle}>
            Cuentas de acceso rápido (clic para rellenar):
          </p>
          <div className={styles.quickAccessGrid}>
            <button
              type="button"
              className={styles.quickAccountBtn}
              onClick={() => {
                setUsername("lincoln");
                setPassword("admin123");
              }}
            >
              <span className={styles.quickRole}>👑 SuperAdmin</span>
              <span className={styles.quickUser}>lincoln</span>
            </button>
            <button
              type="button"
              className={styles.quickAccountBtn}
              onClick={() => {
                setUsername("llanteria");
                setPassword("dueno123");
              }}
            >
              <span className={styles.quickRole}>🚗 Llantería</span>
              <span className={styles.quickUser}>llanteria</span>
            </button>
            <button
              type="button"
              className={styles.quickAccountBtn}
              onClick={() => {
                setUsername("lubricentro");
                setPassword("dueno123");
              }}
            >
              <span className={styles.quickRole}>🛢️ Lubricentro</span>
              <span className={styles.quickUser}>lubricentro</span>
            </button>
            <button
              type="button"
              className={styles.quickAccountBtn}
              onClick={() => {
                setUsername("lenceria");
                setPassword("dueno123");
              }}
            >
              <span className={styles.quickRole}>✨ Lencería</span>
              <span className={styles.quickUser}>lenceria</span>
            </button>
          </div>
        </div>

        <p className={styles.footerNote}>
          Acceso protegido • Multi-Negocio & Multi-Módulo
        </p>
      </form>
    </div>
  );
}
