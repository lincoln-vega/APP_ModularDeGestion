import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "./AppShell";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";
import { TutorialModal } from "./TutorialModal";
import { useNegocioDelTipo } from "../hooks/useNegocioDelTipo";
import { navItemsFor } from "../data/navigation";
import { useAuth } from "../hooks/useAuth";

const TUTORIAL_STORAGE_KEY = "gestion:tutorial_visto";

export default function BusinessLayout() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { tipo, tipoValido, config, negocio, loading, error, crearDePrueba } = useNegocioDelTipo();
  const [tutorialAbierto, setTutorialAbierto] = useState(false);

  // Abrir tutorial automáticamente en el primer uso
  useEffect(() => {
    if (loading || !negocio) return;
    try {
      const yaVisto = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (!yaVisto) {
        setTutorialAbierto(true);
      }
    } catch {
      // Ignorar errores de localStorage
    }
  }, [loading, negocio]);

  function cerrarTutorial() {
    setTutorialAbierto(false);
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    } catch {
      // Ignorar
    }
  }

  function abrirTutorial() {
    setTutorialAbierto(true);
  }

  if (!tipoValido) {
    return <Navigate to="/llanteria" replace />;
  }

  if (loading) {
    return (
      <AppShell
        logo={<config.logo size={20} />}
        negocioNombre={config.nombreFallback}
        saludo={config.saludoFallback}
        navItems={navItemsFor(tipo, config.modulosActivosDefault, config.moduloRusActivoDefault)}
        activeId="inicio"
        tipoRubro={tipo}
      >
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>Cargando información del negocio…</p>
        </div>
      </AppShell>
    );
  }

  if (!negocio) {
    return (
      <AppShell
        logo={<config.logo size={20} />}
        negocioNombre={config.nombreFallback}
        saludo={config.saludoFallback}
        navItems={navItemsFor(tipo, config.modulosActivosDefault, config.moduloRusActivoDefault)}
        activeId="inicio"
        tipoRubro={tipo}
      >
        <EmptyState
          icon={<config.logo size={24} />}
          title={`Todavía no hay un negocio de "${config.rubro}" registrado`}
          message={
            isAdmin
              ? "Se crea una vez por instalación. Podés generarlo ahora con datos de ejemplo para seguir probando la app."
              : error || "Este negocio todavía no está dado de alta. Un administrador tiene que crearlo."
          }
          action={
            isAdmin ? <Button onClick={() => crearDePrueba()}>Crear negocio de prueba</Button> : undefined
          }
        />
      </AppShell>
    );
  }

  const navItems = navItemsFor(tipo, negocio.modulos_activos, negocio.modulo_rus_activo);
  const pathname = location.pathname;

  // Determinar activeId según la ruta actual
  let activeId = "inicio";
  if (pathname.includes("/cierre-caja")) {
    activeId = "caja";
  } else if (pathname.includes("/stock") || pathname.includes("/compras")) {
    activeId = "stock";
  } else if (pathname.includes("/clientes")) {
    activeId = "clientes";
  } else if (pathname.includes("/sunat")) {
    activeId = "sunat";
  }

  // Determinar saludo / título de la barra superior
  let saludo = `${config.saludoFallback}, ${negocio.nombre}`;
  if (pathname.includes("/cierre-caja")) {
    saludo = "Cierre de caja";
  } else if (pathname.includes("/stock/ajustar")) {
    saludo = "Ajustar stock";
  } else if (pathname.includes("/stock/comprar")) {
    saludo = "Registrar compra";
  } else if (pathname.includes("/stock")) {
    saludo = "Inventario y Stock";
  } else if (pathname.includes("/clientes")) {
    saludo = "Clientes y Vehículos";
  } else if (pathname.includes("/sunat")) {
    saludo = "SUNAT (RUS)";
  } else if (pathname.includes("/compras")) {
    saludo = "Historial de compras";
  } else if (pathname.includes("/registrar/")) {
    saludo = "Registrar movimiento";
  }

  return (
    <>
      <AppShell
        logo={<config.logo size={20} />}
        negocioNombre={negocio.nombre}
        saludo={saludo}
        navItems={navItems}
        activeId={activeId}
        negocioId={negocio.id}
        tipoRubro={tipo}
        onAbrirTutorial={abrirTutorial}
      >
        <Outlet />
      </AppShell>

      {tutorialAbierto && (
        <TutorialModal
          negocioNombre={negocio.nombre}
          negocioTipo={tipo}
          negocio={negocio}
          onClose={cerrarTutorial}
        />
      )}
    </>
  );
}
