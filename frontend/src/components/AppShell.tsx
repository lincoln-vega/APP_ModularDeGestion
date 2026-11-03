import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HelpCircleIcon, LogoutIcon, SyncIcon, UserIcon, WifiOffIcon } from "./icons/Icons";
import type { IconProps } from "./icons/Icons";
import { useAuth } from "../hooks/useAuth";
import { useSync } from "../hooks/useSync";
import styles from "./AppShell.module.css";

export interface NavItem {
  id: string;
  label: string;
  icon: (props: IconProps) => JSX.Element;
  to: string;
  badge?: boolean;
}

export interface AppShellProps {
  logo: ReactNode;
  negocioNombre: string;
  saludo: string;
  navItems: NavItem[];
  activeId: string;
  negocioId?: number;
  tipoRubro?: string;
  onAbrirTutorial?: () => void;
  children: ReactNode;
}

interface SyncBadgeProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  onSync: () => void;
  compact?: boolean;
}

function SyncBadge({ isOnline, isSyncing, pendingCount, onSync, compact }: SyncBadgeProps) {
  if (isSyncing) {
    return (
      <div
        className={`${styles.syncBadge} ${styles.syncBadgeSyncing} ${compact ? styles.syncBadgeCompact : ""}`}
        title="Sincronizando movimientos con el servidor…"
        role="status"
        aria-live="polite"
      >
        <SyncIcon size={14} className={styles.spinIcon} />
        {!compact && <span>Sincronizando…</span>}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className={`${styles.syncBadge} ${styles.syncBadgeOffline} ${compact ? styles.syncBadgeCompact : ""}`}
        title={
          pendingCount > 0
            ? `Modo Offline: ${pendingCount} venta(s) pendiente(s) de sincronizar`
            : "Modo Offline (Sin conexión a internet)"
        }
        role="status"
      >
        <WifiOffIcon size={14} />
        <span>{compact ? "Offline" : "Modo Offline"}</span>
        {pendingCount > 0 && <span className={styles.pendingPill}>{pendingCount}</span>}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        type="button"
        className={`${styles.syncBadge} ${styles.syncBadgePending} ${compact ? styles.syncBadgeCompact : ""}`}
        onClick={onSync}
        title="Clic para sincronizar las ventas pendientes ahora"
        role="button"
      >
        <SyncIcon size={14} />
        <span>{pendingCount} pendiente{pendingCount > 1 ? "s" : ""}</span>
        {!compact && <span className={styles.syncActionHint}>• Sincronizar</span>}
      </button>
    );
  }

  return (
    <div
      className={`${styles.syncBadge} ${styles.syncBadgeOnline} ${compact ? styles.syncBadgeCompact : ""}`}
      title="Conectado al servidor en tiempo real"
      role="status"
    >
      <span className={styles.onlineDot} />
      <span>{compact ? "Online" : "En línea"}</span>
    </div>
  );
}

/**
 * Chrome de navegación responsivo con soporte Offline-First y badge
 * de sincronización integrado en móvil y escritorio.
 */
export function AppShell({
  logo,
  negocioNombre,
  saludo,
  navItems,
  activeId,
  negocioId,
  tipoRubro,
  onAbrirTutorial,
  children,
}: AppShellProps) {
  const { session, logout } = useAuth();
  const { isOnline, isSyncing, pendingCount, syncNow } = useSync(
    negocioId ?? session?.negocioId ?? undefined,
  );

  return (
    <div className={styles.shell} data-rubro={tipoRubro}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <div className={styles.sidebarLogo}>{logo}</div>
          <span className={styles.brandName}>{negocioNombre}</span>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={`${styles.sidebarLink} ${item.id === activeId ? styles.sidebarLinkActive : ""}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.badge && <span className={styles.dot} />}
            </Link>
          ))}
          {session?.rol === "admin" && (
            <Link to="/negocios" className={styles.adminNavBtn}>
              <span>⚙️ Panel SuperAdmin</span>
            </Link>
          )}
        </nav>

        <div className={styles.sidebarSpacer} />

        {onAbrirTutorial && (
          <button
            type="button"
            className={styles.sidebarTutorialBtn}
            onClick={onAbrirTutorial}
            title="Ver Guía interactiva del sistema"
          >
            <HelpCircleIcon size={16} />
            <span>Guía interactiva</span>
          </button>
        )}

        <div className={styles.sidebarSync}>
          <SyncBadge
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={pendingCount}
            onSync={syncNow}
          />
        </div>

        <button type="button" className={styles.sidebarUser} onClick={logout}>
          <UserIcon size={16} />
          <span>{session?.nombre ?? "Cuenta"}</span>
          <LogoutIcon size={14} className={styles.logoutHint} />
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <div className={styles.brand}>
            <div className={styles.logo}>{logo}</div>
            <div>
              <div className={styles.brandName}>{negocioNombre}</div>
              <div className={styles.saludo}>{saludo}</div>
            </div>
          </div>
          <div className={styles.mobileHeaderRight}>
            {session?.rol === "admin" && (
              <Link to="/negocios" className={styles.adminHeaderBadge} title="Ir a Panel Admin">
                Admin
              </Link>
            )}
            <SyncBadge
              isOnline={isOnline}
              isSyncing={isSyncing}
              pendingCount={pendingCount}
              onSync={syncNow}
              compact
            />
            {onAbrirTutorial && (
              <button
                type="button"
                className={styles.tutorialBtnMobile}
                onClick={onAbrirTutorial}
                title="Guía interactiva del sistema"
                aria-label="Ver Guía del sistema"
              >
                <HelpCircleIcon size={15} />
                <span>Guía</span>
              </button>
            )}
            <button
              type="button"
              className={styles.iconButton}
              onClick={logout}
              aria-label="Cerrar sesión"
            >
              <LogoutIcon size={18} />
            </button>
          </div>
        </header>

        <header className={styles.desktopTopbar}>
          <h1 className={styles.desktopTitle}>{saludo}</h1>
          <div className={styles.desktopActions}>
            {session?.rol === "admin" && (
              <Link to="/negocios" className={styles.adminHeaderBtn} title="Ir a Panel Admin">
                ⚙️ Panel SuperAdmin
              </Link>
            )}
            <SyncBadge
              isOnline={isOnline}
              isSyncing={isSyncing}
              pendingCount={pendingCount}
              onSync={syncNow}
            />
            {onAbrirTutorial && (
              <button
                type="button"
                className={styles.tutorialBtnDesktop}
                onClick={onAbrirTutorial}
                title="Ver Guía interactiva del sistema"
              >
                <HelpCircleIcon size={16} />
                <span>Guía rápida</span>
              </button>
            )}
            <button
              type="button"
              className={styles.iconButton}
              onClick={logout}
              aria-label="Cerrar sesión"
            >
              <LogoutIcon size={18} />
            </button>
          </div>
        </header>

        <div className={styles.content}>{children}</div>

        <nav className={styles.bottomNav}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={`${styles.bottomNavItem} ${item.id === activeId ? styles.bottomNavItemActive : ""}`}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
