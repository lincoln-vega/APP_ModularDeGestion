import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  api,
  ApiError,
  type Negocio,
  type Usuario,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/Button";
import { tipoDesdeRubro } from "../data/negociosConfig";
import {
  BoxIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  EditIcon,
  LogoutIcon,
  NutIcon,
  OilDropIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SyncIcon,
  TireIcon,
  TrashIcon,
  UserIcon,
  WrenchIcon,
} from "../components/icons/Icons";
import styles from "./Dashboard.module.css";

export interface ModulosConfig {
  stock: boolean;
  clientes_vehiculos: boolean;
  sunat: boolean;
  whatsapp: boolean;
  [key: string]: boolean;
}

export interface SaaSPlan {
  id: string;
  nombre: string;
  descripcion: string;
  badgeLabel: string;
  precioMensual?: number | null;
  modulos: ModulosConfig;
  esDefault?: boolean;
}

export const SAAS_PLANES_STORAGE_KEY = "gestion:saas_planes";

export const DEFAULT_SAAS_PLANES: SaaSPlan[] = [
  {
    id: "basico",
    nombre: "Plan Básico (Stock)",
    descripcion: "Control de inventario y caja para ventas rápidas",
    badgeLabel: "Básico",
    precioMensual: 49,
    modulos: { stock: true, clientes_vehiculos: false, sunat: false, whatsapp: false },
    esDefault: true,
  },
  {
    id: "profesional",
    nombre: "Plan Profesional (Taller)",
    descripcion: "Inventario + Historial de Clientes y Vehículos",
    badgeLabel: "Profesional",
    precioMensual: 89,
    modulos: { stock: true, clientes_vehiculos: true, sunat: false, whatsapp: false },
    esDefault: true,
  },
  {
    id: "full",
    nombre: "Plan Full (Empresarial)",
    descripcion: "Todos los módulos + SUNAT + Notificaciones WhatsApp",
    badgeLabel: "Full",
    precioMensual: 149,
    modulos: { stock: true, clientes_vehiculos: true, sunat: true, whatsapp: true },
    esDefault: true,
  },
];

export function getModulosNegocio(negocio: Negocio): ModulosConfig {
  const m = (negocio.modulos_activos || {}) as Record<string, boolean>;
  return {
    stock: m.stock ?? true,
    clientes_vehiculos: m.clientes_vehiculos ?? false,
    sunat: negocio.modulo_rus_activo ?? false,
    whatsapp: m.whatsapp ?? false,
  };
}

export function detectarPlan(negocio: Negocio, planes: SaaSPlan[]): SaaSPlan | null {
  const modulosActuales = getModulosNegocio(negocio);
  const match = planes.find((p) => {
    return (
      Boolean(p.modulos.stock) === modulosActuales.stock &&
      Boolean(p.modulos.clientes_vehiculos) === modulosActuales.clientes_vehiculos &&
      Boolean(p.modulos.sunat) === modulosActuales.sunat &&
      Boolean(p.modulos.whatsapp) === modulosActuales.whatsapp
    );
  });
  return match || null;
}

function getRubroIcon(rubro: string) {
  const r = (rubro || "").toLowerCase();
  if (r.includes("llant") || r.includes("neumat")) return <TireIcon size={22} />;
  if (r.includes("lubri") || r.includes("aceit")) return <OilDropIcon size={22} />;
  if (r.includes("repuesto") || r.includes("bodega") || r.includes("stock"))
    return <BoxIcon size={22} />;
  if (r.includes("ferreter")) return <NutIcon size={22} />;
  return <WrenchIcon size={22} />;
}

export default function Dashboard() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (session && session.rol !== "admin") {
    return <Navigate to="/" replace />;
  }

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtro de búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [updatingNegocioId, setUpdatingNegocioId] = useState<number | null>(null);

  // --- GESTIÓN DINÁMICA DE PLANES SAAS ---
  const [planes, setPlanes] = useState<SaaSPlan[]>(() => {
    try {
      const raw = localStorage.getItem(SAAS_PLANES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error al cargar planes desde localStorage:", e);
    }
    return DEFAULT_SAAS_PLANES;
  });

  const actualizarPlanes = (nuevosPlanes: SaaSPlan[]) => {
    setPlanes(nuevosPlanes);
    try {
      localStorage.setItem(SAAS_PLANES_STORAGE_KEY, JSON.stringify(nuevosPlanes));
    } catch (e) {
      console.error("Error al guardar planes en localStorage:", e);
    }
  };

  // Modal Gestión de Planes SaaS
  const [modalPlanesAbierto, setModalPlanesAbierto] = useState(false);
  const [modoEditorPlan, setModoEditorPlan] = useState<"crear" | "editar" | null>(null);
  const [planEditandoId, setPlanEditandoId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    id: "",
    nombre: "",
    descripcion: "",
    badgeLabel: "",
    precioMensual: "",
    stock: true,
    clientes_vehiculos: false,
    sunat: false,
    whatsapp: false,
  });
  const [errorPlanForm, setErrorPlanForm] = useState<string | null>(null);

  // Modal 1: Dar de alta nuevo negocio
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [creandoNegocio, setCreandoNegocio] = useState(false);
  const [errorNuevoNegocio, setErrorNuevoNegocio] = useState<string | null>(null);

  // Formulario nuevo negocio
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string>("llantería");
  const [customRubroTexto, setCustomRubroTexto] = useState<string>("");
  const [planAltaSeleccionado, setPlanAltaSeleccionado] = useState<string>("basico");
  const [nuevoForm, setNuevoForm] = useState({
    nombre: "",
    rubro: "llantería",
    stock: true,
    clientes_vehiculos: false,
    sunat: true,
    whatsapp: false,
    usuario_nombre: "",
    usuario_username: "",
    usuario_password: "",
  });

  // Modal 2: Gestión de usuarios
  const [negocioUsuariosModal, setNegocioUsuariosModal] = useState<Negocio | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // Sub-estados en modal de usuarios (Reset pass & Crear user)
  const [usuarioPassReset, setUsuarioPassReset] = useState<{
    usuarioId: number;
    nombre: string;
    nuevaPassword: string;
  } | null>(null);
  const [guardandoPassReset, setGuardandoPassReset] = useState(false);
  const [mostrarFormCrearUser, setMostrarFormCrearUser] = useState(false);
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [nuevoUserForm, setNuevoUserForm] = useState({
    nombre: "",
    username: "",
    password: "",
    rol: "dueño",
  });

  // Cargar lista de negocios
  const cargarNegocios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listNegocios();
      setNegocios(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al obtener negocios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarNegocios();
  }, []);

  // Cargar usuarios de un negocio específico
  const abrirGestionUsuarios = async (negocio: Negocio) => {
    setNegocioUsuariosModal(negocio);
    setLoadingUsuarios(true);
    setErrorUsuarios(null);
    setUsuarioPassReset(null);
    setMostrarFormCrearUser(false);
    try {
      const list = await api.listUsuarios(negocio.id);
      setUsuarios(list);
    } catch (err) {
      setErrorUsuarios(
        err instanceof ApiError ? err.message : "No se pudieron obtener los usuarios",
      );
    } finally {
      setLoadingUsuarios(false);
    }
  };

  // Activar / Desactivar módulos de un negocio
  const toggleModulo = async (
    negocio: Negocio,
    moduloKey: "stock" | "clientes_vehiculos" | "sunat" | "whatsapp",
  ) => {
    setUpdatingNegocioId(negocio.id);
    try {
      let updated: Negocio;
      if (moduloKey === "sunat") {
        const nuevoRus = !negocio.modulo_rus_activo;
        updated = await api.updateNegocio(negocio.id, { modulo_rus_activo: nuevoRus });
      } else {
        const actualModulos = (negocio.modulos_activos || {}) as Record<string, boolean>;
        const nuevoModulos = {
          ...actualModulos,
          [moduloKey]: !actualModulos[moduloKey],
        };
        updated = await api.updateNegocio(negocio.id, { modulos_activos: nuevoModulos });
      }
      setNegocios((prev) => prev.map((n) => (n.id === negocio.id ? updated : n)));
      if (negocioUsuariosModal?.id === negocio.id) {
        setNegocioUsuariosModal(updated);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error al actualizar módulo del negocio.");
    } finally {
      setUpdatingNegocioId(null);
    }
  };

  // Aplicar un paquete / plan SaaS en 1 clic
  const aplicarPlanNegocio = async (negocio: Negocio, planId: string) => {
    if (planId === "personalizado") return;
    const plan = planes.find((p) => p.id === planId);
    if (!plan) return;
    setUpdatingNegocioId(negocio.id);
    try {
      const updated = await api.updateNegocio(negocio.id, {
        modulo_rus_activo: plan.modulos.sunat ?? false,
        modulos_activos: {
          stock: plan.modulos.stock ?? true,
          clientes_vehiculos: plan.modulos.clientes_vehiculos ?? false,
          whatsapp: plan.modulos.whatsapp ?? false,
        },
      });
      setNegocios((prev) => prev.map((n) => (n.id === negocio.id ? updated : n)));
      if (negocioUsuariosModal?.id === negocio.id) {
        setNegocioUsuariosModal(updated);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error al actualizar plan del negocio.");
    } finally {
      setUpdatingNegocioId(null);
    }
  };

  // Handlers para Administración de Planes SaaS
  const abrirCrearNuevoPlan = () => {
    setPlanForm({
      id: "",
      nombre: "",
      descripcion: "",
      badgeLabel: "",
      precioMensual: "",
      stock: true,
      clientes_vehiculos: false,
      sunat: false,
      whatsapp: false,
    });
    setPlanEditandoId(null);
    setModoEditorPlan("crear");
    setErrorPlanForm(null);
  };

  const abrirCrearPlanDesdeNegocio = (negocio: Negocio) => {
    const m = getModulosNegocio(negocio);
    const baseName = `Plan ${negocio.nombre}`;
    const slug =
      baseName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `plan-${Date.now()}`;

    setPlanForm({
      id: slug,
      nombre: baseName,
      descripcion: `Configuración personalizada basada en ${negocio.nombre}`,
      badgeLabel: negocio.nombre.slice(0, 8).toUpperCase(),
      precioMensual: "",
      stock: m.stock,
      clientes_vehiculos: m.clientes_vehiculos,
      sunat: m.sunat,
      whatsapp: m.whatsapp,
    });
    setPlanEditandoId(null);
    setModoEditorPlan("crear");
    setErrorPlanForm(null);
    setModalPlanesAbierto(true);
  };

  const abrirEditarPlan = (plan: SaaSPlan) => {
    setPlanForm({
      id: plan.id,
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      badgeLabel: plan.badgeLabel,
      precioMensual: plan.precioMensual != null ? String(plan.precioMensual) : "",
      stock: plan.modulos.stock ?? false,
      clientes_vehiculos: plan.modulos.clientes_vehiculos ?? false,
      sunat: plan.modulos.sunat ?? false,
      whatsapp: plan.modulos.whatsapp ?? false,
    });
    setPlanEditandoId(plan.id);
    setModoEditorPlan("editar");
    setErrorPlanForm(null);
  };

  const submitGuardarPlan = (e: FormEvent) => {
    e.preventDefault();
    if (!planForm.nombre.trim()) {
      setErrorPlanForm("El nombre del plan es obligatorio.");
      return;
    }

    const generatedId = planForm.id.trim()
      ? planForm.id
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9_-]/g, "-")
      : planForm.nombre
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `plan-${Date.now()}`;

    let precioNum: number | null = null;
    if (planForm.precioMensual.trim() !== "") {
      const val = parseFloat(planForm.precioMensual.trim());
      if (isNaN(val) || val < 0) {
        setErrorPlanForm("El precio mensual debe ser un número positivo.");
        return;
      }
      precioNum = val;
    }

    const badgeFinal =
      planForm.badgeLabel.trim() ||
      planForm.nombre.trim().split(" ")[0].toUpperCase();

    const planObj: SaaSPlan = {
      id: modoEditorPlan === "editar" && planEditandoId ? planEditandoId : generatedId,
      nombre: planForm.nombre.trim(),
      descripcion: planForm.descripcion.trim(),
      badgeLabel: badgeFinal,
      precioMensual: precioNum,
      modulos: {
        stock: planForm.stock,
        clientes_vehiculos: planForm.clientes_vehiculos,
        sunat: planForm.sunat,
        whatsapp: planForm.whatsapp,
      },
      esDefault:
        modoEditorPlan === "editar" && planEditandoId
          ? planes.find((p) => p.id === planEditandoId)?.esDefault
          : false,
    };

    if (modoEditorPlan === "crear") {
      if (planes.some((p) => p.id === planObj.id)) {
        setErrorPlanForm(
          `Ya existe un plan con el identificador "${planObj.id}". Modifica el nombre o ID.`,
        );
        return;
      }
      actualizarPlanes([...planes, planObj]);
    } else if (modoEditorPlan === "editar" && planEditandoId) {
      actualizarPlanes(
        planes.map((p) => (p.id === planEditandoId ? planObj : p)),
      );
    }

    setModoEditorPlan(null);
    setPlanEditandoId(null);
    setErrorPlanForm(null);
  };

  const eliminarPlan = (planId: string) => {
    const p = planes.find((item) => item.id === planId);
    if (!p) return;
    if (window.confirm(`¿Estás seguro de eliminar el plan "${p.nombre}"?`)) {
      const actualizados = planes.filter((item) => item.id !== planId);
      actualizarPlanes(actualizados);
      if (planAltaSeleccionado === planId) {
        setPlanAltaSeleccionado(actualizados[0]?.id || "personalizado");
      }
      if (planEditandoId === planId) {
        setModoEditorPlan(null);
        setPlanEditandoId(null);
      }
    }
  };

  const restablecerPlanesPorDefecto = () => {
    if (
      window.confirm(
        "¿Deseas restablecer los planes a los 3 originales por defecto (Básico, Profesional, Full)?",
      )
    ) {
      actualizarPlanes(DEFAULT_SAAS_PLANES);
      setModoEditorPlan(null);
      setPlanEditandoId(null);
      setErrorPlanForm(null);
    }
  };

  const handlePlanAltaChange = (planId: string) => {
    setPlanAltaSeleccionado(planId);
    if (planId !== "personalizado") {
      const p = planes.find((item) => item.id === planId);
      if (p) {
        setNuevoForm((prev) => ({
          ...prev,
          stock: p.modulos.stock ?? true,
          clientes_vehiculos: p.modulos.clientes_vehiculos ?? false,
          sunat: p.modulos.sunat ?? false,
          whatsapp: p.modulos.whatsapp ?? false,
        }));
      }
    }
  };

  const handleCheckboxAltaChange = (
    moduloKey: "stock" | "clientes_vehiculos" | "sunat" | "whatsapp",
    value: boolean,
  ) => {
    const updated = { ...nuevoForm, [moduloKey]: value };
    setNuevoForm(updated);
    const match = planes.find(
      (p) =>
        Boolean(p.modulos.stock) === updated.stock &&
        Boolean(p.modulos.clientes_vehiculos) === updated.clientes_vehiculos &&
        Boolean(p.modulos.sunat) === updated.sunat &&
        Boolean(p.modulos.whatsapp) === updated.whatsapp,
    );
    setPlanAltaSeleccionado(match ? match.id : "personalizado");
  };

  // Revocar o reactivar acceso de usuario (activo = true/false)
  const toggleEstadoUsuario = async (usuario: Usuario) => {
    if (!negocioUsuariosModal) return;
    setTogglingUserId(usuario.id);
    try {
      const nuevoEstado = !(usuario.activo ?? true);
      const updated = await api.updateUsuario(negocioUsuariosModal.id, usuario.id, {
        activo: nuevoEstado,
      });
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? updated : u)));
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Error al modificar el estado del usuario.",
      );
    } finally {
      setTogglingUserId(null);
    }
  };

  // Guardar nueva contraseña
  const submitResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!negocioUsuariosModal || !usuarioPassReset || !usuarioPassReset.nuevaPassword) return;
    setGuardandoPassReset(true);
    try {
      await api.updateUsuario(negocioUsuariosModal.id, usuarioPassReset.usuarioId, {
        password: usuarioPassReset.nuevaPassword,
      });
      alert(`Contraseña actualizada con éxito para el usuario ${usuarioPassReset.nombre}`);
      setUsuarioPassReset(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error al resetear la contraseña.");
    } finally {
      setGuardandoPassReset(false);
    }
  };

  // Registrar un usuario adicional para el negocio
  const submitCrearUsuarioAdicional = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !negocioUsuariosModal ||
      !nuevoUserForm.nombre ||
      !nuevoUserForm.username ||
      !nuevoUserForm.password
    )
      return;
    setCreandoUsuario(true);
    try {
      const u = await api.createUsuario(negocioUsuariosModal.id, {
        nombre: nuevoUserForm.nombre,
        username: nuevoUserForm.username,
        password: nuevoUserForm.password,
        rol: nuevoUserForm.rol || "dueño",
      });
      setUsuarios((prev) => [...prev, u]);
      setNuevoUserForm({ nombre: "", username: "", password: "", rol: "dueño" });
      setMostrarFormCrearUser(false);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error al crear el nuevo usuario.");
    } finally {
      setCreandoUsuario(false);
    }
  };

  // Handler inteligente para cambio de rubro con sugerencia de módulos
  const handleRubroChange = (nuevoRubroKey: string) => {
    setRubroSeleccionado(nuevoRubroKey);
    let defaults = {
      stock: true,
      clientes_vehiculos: false,
      sunat: false,
      whatsapp: false,
    };
    if (nuevoRubroKey === "llantería") {
      defaults = { stock: true, clientes_vehiculos: false, sunat: true, whatsapp: false };
    } else if (nuevoRubroKey === "lubricentro") {
      defaults = { stock: true, clientes_vehiculos: true, sunat: false, whatsapp: true };
    } else if (nuevoRubroKey === "taller_mixto" || nuevoRubroKey === "taller_mecanico") {
      defaults = { stock: true, clientes_vehiculos: true, sunat: true, whatsapp: true };
    } else if (nuevoRubroKey === "carwash") {
      defaults = { stock: false, clientes_vehiculos: true, sunat: false, whatsapp: true };
    } else if (
      nuevoRubroKey === "repuestos" ||
      nuevoRubroKey === "ferreteria" ||
      nuevoRubroKey === "bodega"
    ) {
      defaults = { stock: true, clientes_vehiculos: false, sunat: true, whatsapp: false };
    }

    const rubroFinal =
      nuevoRubroKey === "personalizado" ? customRubroTexto || "otro" : nuevoRubroKey;

    const updated = {
      ...nuevoForm,
      rubro: rubroFinal,
      ...defaults,
    };
    setNuevoForm(updated);

    const match = planes.find(
      (p) =>
        Boolean(p.modulos.stock) === updated.stock &&
        Boolean(p.modulos.clientes_vehiculos) === updated.clientes_vehiculos &&
        Boolean(p.modulos.sunat) === updated.sunat &&
        Boolean(p.modulos.whatsapp) === updated.whatsapp,
    );
    setPlanAltaSeleccionado(match ? match.id : "personalizado");
  };

  // Dar de alta negocio con su usuario inicial
  const submitNuevoNegocio = async (e: FormEvent) => {
    e.preventDefault();
    if (!nuevoForm.nombre || !nuevoForm.usuario_username || !nuevoForm.usuario_password)
      return;

    const rubroFinal =
      rubroSeleccionado === "personalizado"
        ? customRubroTexto.trim() || "otro"
        : rubroSeleccionado;

    setCreandoNegocio(true);
    setErrorNuevoNegocio(null);
    try {
      const creado = await api.createNegocio({
        nombre: nuevoForm.nombre,
        rubro: rubroFinal,
        plan_estado: "activo",
        modulo_rus_activo: nuevoForm.sunat,
        modulos_activos: {
          stock: nuevoForm.stock,
          clientes_vehiculos: nuevoForm.clientes_vehiculos,
          whatsapp: nuevoForm.whatsapp,
        },
        usuario_inicial: {
          nombre: nuevoForm.usuario_nombre || `Administrador ${nuevoForm.nombre}`,
          username: nuevoForm.usuario_username,
          password: nuevoForm.usuario_password,
          rol: "dueño",
        },
      });
      setNegocios((prev) => [creado, ...prev]);
      setModalNuevoAbierto(false);
      setRubroSeleccionado("llantería");
      setCustomRubroTexto("");
      setNuevoForm({
        nombre: "",
        rubro: "llantería",
        stock: true,
        clientes_vehiculos: false,
        sunat: true,
        whatsapp: false,
        usuario_nombre: "",
        usuario_username: "",
        usuario_password: "",
      });
      setPlanAltaSeleccionado("basico");
    } catch (err) {
      setErrorNuevoNegocio(
        err instanceof ApiError ? err.message : "Error al dar de alta el negocio.",
      );
    } finally {
      setCreandoNegocio(false);
    }
  };

  // Filtrado de negocios
  const negociosFiltrados = negocios.filter((n) => {
    const query = busqueda.toLowerCase().trim();
    if (!query) return true;
    return n.nombre.toLowerCase().includes(query) || n.rubro.toLowerCase().includes(query);
  });

  // Estadísticas rápidas
  const totalNegocios = negocios.length;
  const negociosSunat = negocios.filter((n) => n.modulo_rus_activo).length;
  const negociosClientes = negocios.filter(
    (n) => (n.modulos_activos as Record<string, boolean> | undefined)?.clientes_vehiculos,
  ).length;

  return (
    <div className={styles.wrapper}>
      <main className={styles.page}>
        {/* Fondos luminosos para Glassmorphism */}
        <div className={styles.bgGlowTop} />
        <div className={styles.bgGlowBottom} />

        <header className={styles.topHeader}>
          <div className={styles.brandGroup}>
            <div className={styles.logoBadge}>
              <SettingsIcon size={22} />
            </div>
            <div>
              <h1 className={styles.title}>Panel de Administración</h1>
              <p className={styles.subtitle}>
                Conectado como <strong className={styles.adminName}>{session?.nombre}</strong> (SuperAdmin)
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <Button
              variant="outline"
              onClick={() => {
                setModoEditorPlan(null);
                setPlanEditandoId(null);
                setErrorPlanForm(null);
                setModalPlanesAbierto(true);
              }}
            >
              <SettingsIcon size={18} />
              <span>⚙️ Gestionar Planes SaaS</span>
            </Button>
            <Button onClick={() => setModalNuevoAbierto(true)}>
              <PlusIcon size={18} />
              <span>Nuevo Negocio</span>
            </Button>
            <Button variant="ghost" onClick={logout} className={styles.logoutBtn}>
              <LogoutIcon size={18} />
              <span>Cerrar sesión</span>
            </Button>
          </div>
        </header>

        {/* Tarjetas de Métricas Rápidas */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIconContainer}>
              <NutIcon size={22} />
            </div>
            <div>
              <span className={styles.statValue}>{totalNegocios}</span>
              <span className={styles.statLabel}>Negocios Registrados</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconContainerTeal}>
              <ReceiptIcon size={22} />
            </div>
            <div>
              <span className={styles.statValue}>{negociosSunat}</span>
              <span className={styles.statLabel}>Módulo SUNAT / RUS</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconContainerCyan}>
              <WrenchIcon size={22} />
            </div>
            <div>
              <span className={styles.statValue}>{negociosClientes}</span>
              <span className={styles.statLabel}>Clientes / Vehículos</span>
            </div>
          </div>
        </section>

        {/* Barra de Filtro y Búsqueda */}
        <section className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <SearchIcon size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar negocio por nombre o rubro…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setBusqueda("")}
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>

          <span className={styles.counterText}>
            Mostrando {negociosFiltrados.length} de {totalNegocios} negocios
          </span>
        </section>

        {/* Listado de Negocios en formato Cards Glassmorphic */}
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <p>Cargando lista de negocios…</p>
          </div>
        ) : error ? (
          <div className={styles.errorBanner} role="alert">
            <p>Error al cargar la información: {error}</p>
            <Button size="sm" onClick={cargarNegocios}>
              Reintentar
            </Button>
          </div>
        ) : negociosFiltrados.length === 0 ? (
          <div className={styles.emptyContainer}>
            <NutIcon size={44} />
            <h3>No se encontraron negocios</h3>
            <p>
              {busqueda
                ? "No hay resultados que coincidan con la búsqueda."
                : "Registra un nuevo negocio para comenzar."}
            </p>
            {!busqueda && (
              <Button onClick={() => setModalNuevoAbierto(true)}>
                <PlusIcon size={18} />
                <span>Registrar Negocio</span>
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.negociosGrid}>
            {negociosFiltrados.map((negocio) => {
              const modulos = (negocio.modulos_activos || {}) as Record<string, boolean>;
              const stockActivo = modulos.stock ?? true;
              const clientesActivo = modulos.clientes_vehiculos ?? false;
              const sunatActivo = negocio.modulo_rus_activo ?? false;
              const whatsappActivo = modulos.whatsapp ?? false;
              const isUpdating = updatingNegocioId === negocio.id;

              const planActual = detectarPlan(negocio, planes);

              return (
                <div key={negocio.id} className={styles.negocioCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleGroup}>
                      <div className={styles.rubroIcon}>
                        {getRubroIcon(negocio.rubro)}
                      </div>
                      <div>
                        <h2 className={styles.negocioNombre}>{negocio.nombre}</h2>
                        <span className={styles.rubroBadge}>{negocio.rubro}</span>
                      </div>
                    </div>
                    <div className={styles.cardHeaderRight}>
                      <span
                        className={
                          negocio.plan_estado === "activo"
                            ? styles.statusActive
                            : styles.statusInactive
                        }
                      >
                        ● {negocio.plan_estado || "Activo"}
                      </span>
                      <span
                        className={`${styles.planBadge} ${
                          planActual?.id === "basico"
                            ? styles.planBadgeBasico
                            : planActual?.id === "profesional"
                            ? styles.planBadgeProfesional
                            : planActual?.id === "full"
                            ? styles.planBadgeFull
                            : styles.planBadgePersonalizado
                        }`}
                      >
                        {planActual ? planActual.badgeLabel : "Personalizado"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.divider} />

                  {/* Interruptores / Switches de Módulos */}
                  <div className={styles.modulosSection}>
                    <div className={styles.planSelectorRow}>
                      <span className={styles.planSelectorLabel}>Plan Asignado:</span>
                      <select
                        className={styles.planSelect}
                        value={planActual ? planActual.id : "personalizado"}
                        disabled={isUpdating}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          if (selectedId !== "personalizado") {
                            aplicarPlanNegocio(negocio, selectedId);
                          }
                        }}
                      >
                        {planes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.precioMensual != null ? `(S/ ${p.precioMensual})` : ""}
                          </option>
                        ))}
                        {!planActual && (
                          <option value="personalizado">⚙️ Personalizado (Módulos a medida)</option>
                        )}
                      </select>
                    </div>

                    {!planActual && (
                      <button
                        type="button"
                        className={styles.saveAsPlanBtn}
                        onClick={() => abrirCrearPlanDesdeNegocio(negocio)}
                        title="Guardar esta combinación de módulos como un nuevo plan SaaS"
                      >
                        <SparklesIcon size={15} />
                        <span>Guardar configuración como nuevo plan</span>
                      </button>
                    )}

                    <span className={styles.modulosTitle}>Módulos Habilitados</span>
                    <div className={styles.switchesGrid}>
                      {/* Modulo Stock */}
                      <div className={styles.switchItem}>
                        <div className={styles.switchInfo}>
                          <BoxIcon size={16} />
                          <span>Inventario / Stock</span>
                        </div>
                        <label className={styles.switchLabel}>
                          <input
                            type="checkbox"
                            checked={stockActivo}
                            disabled={isUpdating}
                            onChange={() => toggleModulo(negocio, "stock")}
                          />
                          <span className={styles.slider} />
                        </label>
                      </div>

                      {/* Modulo Clientes - Vehiculos */}
                      <div className={styles.switchItem}>
                        <div className={styles.switchInfo}>
                          <WrenchIcon size={16} />
                          <span>Cliente - Vehículo</span>
                        </div>
                        <label className={styles.switchLabel}>
                          <input
                            type="checkbox"
                            checked={clientesActivo}
                            disabled={isUpdating}
                            onChange={() => toggleModulo(negocio, "clientes_vehiculos")}
                          />
                          <span className={styles.slider} />
                        </label>
                      </div>

                      {/* Modulo SUNAT */}
                      <div className={styles.switchItem}>
                        <div className={styles.switchInfo}>
                          <ReceiptIcon size={16} />
                          <span>Facturación SUNAT (RUS)</span>
                        </div>
                        <label className={styles.switchLabel}>
                          <input
                            type="checkbox"
                            checked={sunatActivo}
                            disabled={isUpdating}
                            onChange={() => toggleModulo(negocio, "sunat")}
                          />
                          <span className={styles.slider} />
                        </label>
                      </div>

                      {/* Modulo WhatsApp */}
                      <div className={styles.switchItem}>
                        <div className={styles.switchInfo}>
                          <ChatIcon size={16} />
                          <span>Notificaciones WhatsApp</span>
                        </div>
                        <label className={styles.switchLabel}>
                          <input
                            type="checkbox"
                            checked={whatsappActivo}
                            disabled={isUpdating}
                            onChange={() => toggleModulo(negocio, "whatsapp")}
                          />
                          <span className={styles.slider} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/${tipoDesdeRubro(negocio.rubro)}`)}
                    >
                      <span>Entrar al POS ➔</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirGestionUsuarios(negocio)}
                    >
                      <UserIcon size={16} />
                      <span>Usuarios</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL 1: ALTA DE NUEVO NEGOCIO */}
        {modalNuevoAbierto && (
          <div className={styles.modalOverlay} onClick={() => setModalNuevoAbierto(false)}>
            <div
              className={styles.modalCard}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>Dar de Alta Nuevo Negocio</h2>
                  <p className={styles.modalSubtitle}>
                    Configura la empresa y las credenciales del usuario inicial
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.closeModalBtn}
                  onClick={() => setModalNuevoAbierto(false)}
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <form onSubmit={submitNuevoNegocio} className={styles.modalForm}>
                {errorNuevoNegocio && (
                  <div className={styles.errorBox} role="alert">
                    <p>{errorNuevoNegocio}</p>
                  </div>
                )}

                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>1. Información del Negocio</h3>
                  <div className={styles.formRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Nombre Comercial *</span>
                      <input
                        required
                        type="text"
                        className={styles.input}
                        placeholder="Ej. Llantería San Martín"
                        value={nuevoForm.nombre}
                        onChange={(e) =>
                          setNuevoForm({ ...nuevoForm, nombre: e.target.value })
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Rubro *</span>
                      <select
                        className={styles.input}
                        value={rubroSeleccionado}
                        onChange={(e) => handleRubroChange(e.target.value)}
                      >
                        <option value="llantería">Llantería / Neumáticos</option>
                        <option value="lubricentro">Lubricentro / Aceites</option>
                        <option value="taller_mixto">Taller Mixto (Llantería + Lubricentro)</option>
                        <option value="taller_mecanico">Taller Mecánico / Automotriz</option>
                        <option value="carwash">Lavado de Autos / Car Wash</option>
                        <option value="repuestos">Venta de Repuestos / Autopartes</option>
                        <option value="ferreteria">Ferretería / Herramientas</option>
                        <option value="bodega">Bodega / Minimarket</option>
                        <option value="servicios">Servicios Generales</option>
                        <option value="personalizado">✏️ Otro rubro (Escribir personalizado...)</option>
                      </select>
                    </label>
                  </div>

                  {rubroSeleccionado === "personalizado" && (
                    <div className={styles.formRow} style={{ marginTop: "12px" }}>
                      <label className={styles.field}>
                        <span className={styles.label}>Nombre del Rubro Personalizado *</span>
                        <input
                          required
                          type="text"
                          className={styles.input}
                          placeholder="Ej. Taller de Motos, Carpintería, etc."
                          value={customRubroTexto}
                          onChange={(e) => {
                            setCustomRubroTexto(e.target.value);
                            setNuevoForm((prev) => ({ ...prev, rubro: e.target.value }));
                          }}
                        />
                      </label>
                    </div>
                  )}

                  <div className={styles.field}>
                    <span className={styles.label}>Paquete / Plan SaaS Inicial</span>
                    <div className={styles.planPillsGrid}>
                      {planes.map((p) => {
                        return (
                          <div
                            key={p.id}
                            className={`${styles.planPill} ${
                              planAltaSeleccionado === p.id ? styles.planPillActive : ""
                            }`}
                            onClick={() => handlePlanAltaChange(p.id)}
                          >
                            <span className={styles.planPillName}>{p.nombre}</span>
                            {p.precioMensual != null && (
                              <span className={styles.planPillPrice}>S/ {p.precioMensual}/mes</span>
                            )}
                            <span className={styles.planPillDesc}>{p.descripcion}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.label}>Módulos Iniciales Activos</span>
                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={nuevoForm.stock}
                          onChange={(e) => handleCheckboxAltaChange("stock", e.target.checked)}
                        />
                        <span>Inventario / Stock</span>
                      </label>

                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={nuevoForm.clientes_vehiculos}
                          onChange={(e) =>
                            handleCheckboxAltaChange("clientes_vehiculos", e.target.checked)
                          }
                        />
                        <span>Cliente - Vehículo</span>
                      </label>

                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={nuevoForm.sunat}
                          onChange={(e) => handleCheckboxAltaChange("sunat", e.target.checked)}
                        />
                        <span>SUNAT (RUS)</span>
                      </label>

                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={nuevoForm.whatsapp}
                          onChange={(e) => handleCheckboxAltaChange("whatsapp", e.target.checked)}
                        />
                        <span>WhatsApp Bot</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>2. Credenciales Usuario Inicial</h3>
                  <div className={styles.formRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Nombre Responsable</span>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Ej. Pedro Pérez"
                        value={nuevoForm.usuario_nombre}
                        onChange={(e) =>
                          setNuevoForm({ ...nuevoForm, usuario_nombre: e.target.value })
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Usuario (Login) *</span>
                      <input
                        required
                        type="text"
                        className={styles.input}
                        placeholder="Ej. llanteria_sanmartin"
                        value={nuevoForm.usuario_username}
                        onChange={(e) =>
                          setNuevoForm({ ...nuevoForm, usuario_username: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <label className={styles.field}>
                    <span className={styles.label}>Contraseña Inicial *</span>
                    <input
                      required
                      type="password"
                      className={styles.input}
                      placeholder="••••••••"
                      value={nuevoForm.usuario_password}
                      onChange={(e) =>
                        setNuevoForm({ ...nuevoForm, usuario_password: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className={styles.modalActions}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setModalNuevoAbierto(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      creandoNegocio ||
                      !nuevoForm.nombre ||
                      !nuevoForm.usuario_username ||
                      !nuevoForm.usuario_password
                    }
                  >
                    {creandoNegocio ? "Creando Negocio…" : "Crear Negocio"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: GESTIÓN DE USUARIOS DEL NEGOCIO */}
        {negocioUsuariosModal && (
          <div
            className={styles.modalOverlay}
            onClick={() => setNegocioUsuariosModal(null)}
          >
            <div
              className={styles.modalCardWide}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>
                    Usuarios: {negocioUsuariosModal.nombre}
                  </h2>
                  <p className={styles.modalSubtitle}>
                    Administración de accesos, reseteo de claves y nuevos perfiles
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.closeModalBtn}
                  onClick={() => setNegocioUsuariosModal(null)}
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className={styles.userModalBody}>
                <div className={styles.userListHeader}>
                  <h3>Usuarios Registrados</h3>
                  {!mostrarFormCrearUser && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMostrarFormCrearUser(true)}
                    >
                      <PlusIcon size={16} />
                      <span>Agregar Usuario</span>
                    </Button>
                  )}
                </div>

                {/* Formulario para agregar usuario adicional */}
                {mostrarFormCrearUser && (
                  <form
                    onSubmit={submitCrearUsuarioAdicional}
                    className={styles.formAddUser}
                  >
                    <h4 className={styles.subFormTitle}>Crear Usuario Adicional</h4>
                    <div className={styles.formRow}>
                      <label className={styles.field}>
                        <span className={styles.label}>Nombre</span>
                        <input
                          required
                          type="text"
                          className={styles.input}
                          placeholder="Ej. Juan Vendedor"
                          value={nuevoUserForm.nombre}
                          onChange={(e) =>
                            setNuevoUserForm({ ...nuevoUserForm, nombre: e.target.value })
                          }
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.label}>Usuario Login</span>
                        <input
                          required
                          type="text"
                          className={styles.input}
                          placeholder="Ej. juan_ventas"
                          value={nuevoUserForm.username}
                          onChange={(e) =>
                            setNuevoUserForm({ ...nuevoUserForm, username: e.target.value })
                          }
                        />
                      </label>
                    </div>

                    <div className={styles.formRow}>
                      <label className={styles.field}>
                        <span className={styles.label}>Contraseña</span>
                        <input
                          required
                          type="password"
                          className={styles.input}
                          placeholder="••••••••"
                          value={nuevoUserForm.password}
                          onChange={(e) =>
                            setNuevoUserForm({
                              ...nuevoUserForm,
                              password: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.label}>Rol</span>
                        <select
                          className={styles.input}
                          value={nuevoUserForm.rol}
                          onChange={(e) =>
                            setNuevoUserForm({ ...nuevoUserForm, rol: e.target.value })
                          }
                        >
                          <option value="dueño">Dueño</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="empleado">Empleado</option>
                        </select>
                      </label>
                    </div>

                    <div className={styles.subFormActions}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMostrarFormCrearUser(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" disabled={creandoUsuario}>
                        {creandoUsuario ? "Guardando…" : "Crear Usuario"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Reset Password Form si hay usuario seleccionado */}
                {usuarioPassReset && (
                  <form
                    onSubmit={submitResetPassword}
                    className={styles.formResetPassword}
                  >
                    <h4 className={styles.subFormTitle}>
                      Resetear Contraseña para: {usuarioPassReset.nombre}
                    </h4>
                    <div className={styles.resetRow}>
                      <input
                        required
                        type="password"
                        className={styles.input}
                        placeholder="Nueva contraseña"
                        value={usuarioPassReset.nuevaPassword}
                        onChange={(e) =>
                          setUsuarioPassReset({
                            ...usuarioPassReset,
                            nuevaPassword: e.target.value,
                          })
                        }
                      />
                      <Button type="submit" size="sm" disabled={guardandoPassReset}>
                        {guardandoPassReset ? "Guardando…" : "Actualizar Clave"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUsuarioPassReset(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}

                {loadingUsuarios ? (
                  <div className={styles.loadingContainer}>
                    <div className={styles.spinner} />
                    <p>Cargando usuarios…</p>
                  </div>
                ) : errorUsuarios ? (
                  <div className={styles.errorBox} role="alert">
                    <p>{errorUsuarios}</p>
                  </div>
                ) : usuarios.length === 0 ? (
                  <p className={styles.mutedText}>No hay usuarios para este negocio.</p>
                ) : (
                  <div className={styles.usersTableWrapper}>
                    <table className={styles.usersTable}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Estado</th>
                          <th style={{ textAlign: "right" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((u) => {
                          const estaActivo = u.activo ?? true;
                          const isToggling = togglingUserId === u.id;

                          return (
                            <tr key={u.id}>
                              <td>#{u.id}</td>
                              <td className={styles.userNombre}>{u.nombre}</td>
                              <td>{u.username || "-"}</td>
                              <td>
                                <span className={styles.rolBadge}>{u.rol}</span>
                              </td>
                              <td>
                                <span
                                  className={
                                    estaActivo
                                      ? styles.badgeActivo
                                      : styles.badgeDesactivado
                                  }
                                >
                                  {estaActivo ? "Activo" : "Acceso Revocado"}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div className={styles.userActionsGroup}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setUsuarioPassReset({
                                        usuarioId: u.id,
                                        nombre: u.nombre,
                                        nuevaPassword: "",
                                      })
                                    }
                                  >
                                    Reset Clave
                                  </Button>

                                  <Button
                                    variant={estaActivo ? "outline" : "primary"}
                                    size="sm"
                                    disabled={isToggling}
                                    onClick={() => toggleEstadoUsuario(u)}
                                  >
                                    {estaActivo ? "Revocar Acceso" : "Reactivar Acceso"}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: ADMINISTRAR Y CREAR PLANES SAAS */}
        {modalPlanesAbierto && (
          <div
            className={styles.modalOverlay}
            onClick={() => {
              setModalPlanesAbierto(false);
              setModoEditorPlan(null);
              setPlanEditandoId(null);
            }}
          >
            <div
              className={styles.modalCardExtraWide}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>⚙️ Gestión de Planes SaaS</h2>
                  <p className={styles.modalSubtitle}>
                    Crea, edita y personaliza los paquetes de módulos y tarifas para tus clientes
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.closeModalBtn}
                  onClick={() => {
                    setModalPlanesAbierto(false);
                    setModoEditorPlan(null);
                    setPlanEditandoId(null);
                  }}
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className={styles.planesBar}>
                <div className={styles.planesBarStats}>
                  <span>📦 {planes.length} paquetes configurados</span>
                </div>
                <div className={styles.planesBarActions}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={restablecerPlanesPorDefecto}
                  >
                    <SyncIcon size={16} />
                    <span>Restablecer por defecto</span>
                  </Button>
                  {!modoEditorPlan && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={abrirCrearNuevoPlan}
                    >
                      <PlusIcon size={16} />
                      <span>➕ Crear Nuevo Plan</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Formulario Editor de Plan (Crear / Editar) */}
              {modoEditorPlan && (
                <form onSubmit={submitGuardarPlan} className={styles.editorPlanCard}>
                  <h3 className={styles.editorPlanTitle}>
                    {modoEditorPlan === "crear" ? (
                      <>
                        <PlusIcon size={18} />
                        <span>Crear Nuevo Plan SaaS</span>
                      </>
                    ) : (
                      <>
                        <EditIcon size={18} />
                        <span>Editar Plan: {planForm.nombre}</span>
                      </>
                    )}
                  </h3>

                  {errorPlanForm && (
                    <div className={styles.errorBox} role="alert">
                      <p>{errorPlanForm}</p>
                    </div>
                  )}

                  <div className={styles.editorFormGrid}>
                    <label className={styles.field}>
                      <span className={styles.label}>Nombre del Plan *</span>
                      <input
                        required
                        type="text"
                        className={styles.input}
                        placeholder="Ej. Plan Lubricentro Pro"
                        value={planForm.nombre}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, nombre: e.target.value })
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Etiqueta / Badge</span>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Ej. LUBRI-PRO"
                        value={planForm.badgeLabel}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, badgeLabel: e.target.value })
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Precio Mensual (S/)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={styles.input}
                        placeholder="Ej. 89.00"
                        value={planForm.precioMensual}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, precioMensual: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Descripción del Paquete</span>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Ej. Inventario + Clientes y Vehículos para talleres automotrices"
                        value={planForm.descripcion}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, descripcion: e.target.value })
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Identificador (ID)</span>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Opcional (se genera automáticamente)"
                        disabled={modoEditorPlan === "editar"}
                        value={planForm.id}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, id: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.label}>Módulos Incluidos en el Paquete</span>
                    <div className={styles.editorModulesGrid}>
                      <label
                        className={`${styles.moduleCheckboxCard} ${
                          planForm.stock ? styles.moduleCheckboxCardActive : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={planForm.stock}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, stock: e.target.checked })
                          }
                        />
                        <BoxIcon size={16} />
                        <span>Inventario / Stock</span>
                      </label>

                      <label
                        className={`${styles.moduleCheckboxCard} ${
                          planForm.clientes_vehiculos ? styles.moduleCheckboxCardActive : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={planForm.clientes_vehiculos}
                          onChange={(e) =>
                            setPlanForm({
                              ...planForm,
                              clientes_vehiculos: e.target.checked,
                            })
                          }
                        />
                        <WrenchIcon size={16} />
                        <span>Clientes y Vehículos</span>
                      </label>

                      <label
                        className={`${styles.moduleCheckboxCard} ${
                          planForm.sunat ? styles.moduleCheckboxCardActive : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={planForm.sunat}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, sunat: e.target.checked })
                          }
                        />
                        <ReceiptIcon size={16} />
                        <span>Facturación SUNAT (RUS)</span>
                      </label>

                      <label
                        className={`${styles.moduleCheckboxCard} ${
                          planForm.whatsapp ? styles.moduleCheckboxCardActive : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={planForm.whatsapp}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, whatsapp: e.target.checked })
                          }
                        />
                        <ChatIcon size={16} />
                        <span>WhatsApp Bot</span>
                      </label>
                    </div>
                  </div>

                  <div className={styles.editorActions}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setModoEditorPlan(null);
                        setPlanEditandoId(null);
                        setErrorPlanForm(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm">
                      <CheckIcon size={16} />
                      <span>
                        {modoEditorPlan === "crear" ? "Guardar Plan" : "Actualizar Plan"}
                      </span>
                    </Button>
                  </div>
                </form>
              )}

              {/* Grid de Tarjetas de Planes */}
              <div className={styles.saasPlanesGrid}>
                {planes.map((plan) => {
                  const countUsos = negocios.filter((n) => {
                    const dp = detectarPlan(n, planes);
                    return dp?.id === plan.id;
                  }).length;

                  return (
                    <div key={plan.id} className={styles.saasPlanCard}>
                      <div className={styles.saasPlanHeader}>
                        <div>
                          <h4 className={styles.saasPlanName}>{plan.nombre}</h4>
                          <span
                            className={`${styles.planBadge} ${
                              plan.id === "basico"
                                ? styles.planBadgeBasico
                                : plan.id === "profesional"
                                ? styles.planBadgeProfesional
                                : plan.id === "full"
                                ? styles.planBadgeFull
                                : styles.planBadgePersonalizado
                            }`}
                          >
                            {plan.badgeLabel}
                          </span>
                        </div>
                        <div>
                          {plan.precioMensual != null ? (
                            <div className={styles.saasPlanPrice}>
                              S/ {plan.precioMensual}
                              <span className={styles.saasPlanPriceUnit}>/mes</span>
                            </div>
                          ) : (
                            <span className={styles.saasPlanPriceFree}>Personalizado</span>
                          )}
                        </div>
                      </div>

                      <p className={styles.saasPlanDesc}>
                        {plan.descripcion || "Sin descripción"}
                      </p>

                      <div className={styles.saasPlanModulesList}>
                        <div
                          className={`${styles.saasModuleRow} ${
                            plan.modulos.stock
                              ? styles.saasModuleRowActive
                              : styles.saasModuleRowInactive
                          }`}
                        >
                          <BoxIcon size={14} />
                          <span>Inventario / Stock</span>
                        </div>

                        <div
                          className={`${styles.saasModuleRow} ${
                            plan.modulos.clientes_vehiculos
                              ? styles.saasModuleRowActive
                              : styles.saasModuleRowInactive
                          }`}
                        >
                          <WrenchIcon size={14} />
                          <span>Clientes y Vehículos</span>
                        </div>

                        <div
                          className={`${styles.saasModuleRow} ${
                            plan.modulos.sunat
                              ? styles.saasModuleRowActive
                              : styles.saasModuleRowInactive
                          }`}
                        >
                          <ReceiptIcon size={14} />
                          <span>Facturación SUNAT (RUS)</span>
                        </div>

                        <div
                          className={`${styles.saasModuleRow} ${
                            plan.modulos.whatsapp
                              ? styles.saasModuleRowActive
                              : styles.saasModuleRowInactive
                          }`}
                        >
                          <ChatIcon size={14} />
                          <span>WhatsApp Notificaciones</span>
                        </div>
                      </div>

                      <div className={styles.saasPlanFooter}>
                        <span className={styles.usageBadge}>
                          {countUsos} {countUsos === 1 ? "negocio" : "negocios"}
                        </span>

                        <div className={styles.saasPlanBtns}>
                          <button
                            type="button"
                            className={styles.btnIconAction}
                            onClick={() => abrirEditarPlan(plan)}
                            title="Editar este plan"
                          >
                            <EditIcon size={14} />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            className={`${styles.btnIconAction} ${styles.btnIconDanger}`}
                            onClick={() => eliminarPlan(plan.id)}
                            title="Eliminar este plan"
                          >
                            <TrashIcon size={14} />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
