import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftToLine,
  ArrowRightFromLine,
  BarChart3,
  Bell,
  Brain,
  CalendarDays,
  Film,
  LayoutDashboard,
  Menu,
  Moon,
  LogOut,
  Palette,
  Share2,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { NukkiaLogo } from "./nukkia-logo";
import { useTheme } from "./theme-provider";
import { WORKSPACE_NAV, type WorkspaceSection } from "@/lib/marketing-workspace";
import "@/demo.css";
import "@/workspace.css";
import "@/studio.css";

const icons = {
  dashboard: LayoutDashboard,
  trophy: Trophy,
  brain: Brain,
  calendar: Film,
  palette: Palette,
  channels: Share2,
  chart: BarChart3,
};
export function WorkspaceShell({
  name,
  section,
  onSection,
  onCalendar,
  calendarActive = false,
  xp,
  completed,
  total = 5,
  notifications = [],
  children,
  accountActions,
  onSignOut,
}: {
  name: string;
  section?: WorkspaceSection | undefined;
  onSection: (id: WorkspaceSection) => void;
  onCalendar?: () => void;
  calendarActive?: boolean;
  xp: number;
  completed: number;
  total?: number;
  notifications?: { id: string; title: string; description: string; section: WorkspaceSection }[];
  children: ReactNode;
  accountActions?: ReactNode;
  onSignOut?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const menuId = useId();
  const notificationsId = useId();
  const notificationsTitleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const notificationsDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (mobileOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mobileOpen]);
  useEffect(() => {
    if (notificationsOpen) notificationsDialog.current?.showModal();
    else notificationsDialog.current?.close();
  }, [notificationsOpen]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (query.matches) setMobileOpen(false);
    };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [section]);
  function navigation(compact = false) {
    return (
      <>
        <button
          className="workspace-brand-button"
          aria-label="Nukkia — Meu painel"
          onClick={() => onSection("painel")}
        >
          <NukkiaLogo compact={compact} />
        </button>
        {!compact && <p className="workspace-nav-label">BRASIL · MEDICINA</p>}
        <nav aria-label="Navegação principal">
          {[
            { label: "Workspace", ids: ["painel", "trilha"] },
            { label: "Criação", ids: ["conteudo"] },
            { label: "Marca", ids: ["cerebro", "marca"] },
            { label: "Canais", ids: ["redes", "metricas"] },
          ].map((group) => (
            <div className="workspace-nav-group" key={group.label}>
              {!compact && <p>{group.label}</p>}
              {WORKSPACE_NAV.filter((item) => group.ids.includes(item.id)).map((item) => {
                const Icon = icons[item.icon];
                return (
                  <button
                    key={item.id}
                    title={compact ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={!calendarActive && section === item.id ? "page" : undefined}
                    onClick={() => {
                      onSection(item.id);
                      setMobileOpen(false);
                    }}
                  >
                    <Icon size={18} strokeWidth={1.7} />
                    {!compact && <span>{item.label}</span>}
                    {!compact && item.id === "trilha" && <small>{xp} XP</small>}
                  </button>
                );
              })}
              {group.label === "Criação" && onCalendar && (
                <button
                  title={compact ? "Calendário" : undefined}
                  aria-label="Calendário"
                  aria-current={calendarActive ? "page" : undefined}
                  onClick={() => {
                    onCalendar();
                    setMobileOpen(false);
                  }}
                >
                  <CalendarDays size={18} strokeWidth={1.7} />
                  {!compact && <span>Calendário</span>}
                </button>
              )}
            </div>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          {!compact && (
            <button className="workspace-level-card" onClick={() => onSection("trilha")}>
              <Trophy size={18} />
              <span>
                {completed} de {total} etapas<small>Seu progresso na primeira entrega</small>
              </span>
            </button>
          )}
          {accountActions && <div className="workspace-account-actions">{accountActions}</div>}
          <div className="workspace-company">
            <span>{(name || "NU").slice(0, 2).toUpperCase()}</span>
            {!compact && (
              <div>
                <strong>{name || "Sua marca"}</strong>
                <small>Conteúdo para clínicas</small>
              </div>
            )}
          </div>
          <div className="workspace-footer-controls">
            {onSignOut && (
              <button
                type="button"
                className="workspace-icon-button"
                aria-label="Sair da conta"
                title="Sair da conta"
                onClick={onSignOut}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="workspace-icon-button"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="workspace-icon-button"
              aria-label="Notificações"
              title="Notificações"
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              aria-controls={notificationsId}
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </>
    );
  }
  return (
    <div className={`nukkia-workspace workspace-shell${collapsed ? " is-collapsed" : ""}`}>
      <a className="workspace-skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="workspace-sidebar">
        {navigation(collapsed)}
        <button
          className="workspace-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ArrowRightFromLine size={13} /> : <ArrowLeftToLine size={13} />}
        </button>
      </aside>
      <dialog
        ref={dialog}
        id={menuId}
        className="workspace-mobile-nav"
        onClose={() => setMobileOpen(false)}
        aria-label="Menu Nukkia"
      >
        <button
          className="workspace-mobile-close"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        {navigation()}
      </dialog>
      <dialog
        ref={notificationsDialog}
        id={notificationsId}
        className="workspace-notifications"
        aria-labelledby={notificationsTitleId}
        onClose={() => setNotificationsOpen(false)}
      >
        <div className="workspace-notifications-heading">
          <h2 id={notificationsTitleId}>Notificações</h2>
          <button
            type="button"
            className="workspace-icon-button"
            aria-label="Fechar notificações"
            onClick={() => setNotificationsOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {notifications.length ? (
          <ul className="workspace-alert-list">
            {notifications.map((notice) => (
              <li key={notice.id}>
                <button
                  type="button"
                  className="workspace-notice"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setMobileOpen(false);
                    onSection(notice.section);
                  }}
                >
                  <strong>{notice.title}</strong>
                  <span>{notice.description}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="workspace-notifications-empty">Nenhuma notificação por enquanto.</p>
        )}
      </dialog>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <button
            className="workspace-mobile-trigger"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-controls={menuId}
            aria-haspopup="dialog"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h1 className="workspace-top-context">
            {calendarActive
              ? "Calendário"
              : (WORKSPACE_NAV.find((item) => item.id === section)?.label ?? "Minha conta")}
          </h1>
          <button className="workspace-top-progress" onClick={() => onSection("trilha")}>
            <Trophy size={14} />
            <span>Primeira entrega</span>
            <progress aria-label="Progresso da primeira entrega" value={completed} max={total} />
            <small>
              {completed}/{total}
            </small>
          </button>
        </header>
        <main id="main-content" className="workspace-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
