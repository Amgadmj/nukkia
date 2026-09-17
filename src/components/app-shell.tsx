import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BrainCircuit,
  CalendarDays,
  Gauge,
  LayoutDashboard,
  LogOut,
  Palette,
  Share2,
  ShieldCheck,
  Trophy,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/diagnostico", label: "Diagnóstico", icon: BrainCircuit },
  { to: "/marca", label: "Identidade", icon: Palette },
  { to: "/trilha", label: "Trilha", icon: Trophy },
  { to: "/conteudo", label: "Conteúdo", icon: CalendarDays },
  { to: "/redes", label: "Redes", icon: Share2 },
  { to: "/metricas", label: "Métricas", icon: Gauge },
  { to: "/conta", label: "Conta", icon: UserCog },
] as const;

// A smaller subset for the mobile bottom bar — the full 8-item row doesn't
// fit, and a bottom bar users have to scroll sideways defeats the point
// (UI/UX review: the old design's only mobile nav was that same scrolling
// top row). Diagnóstico/Redes/Métricas stay reachable from Painel's shortcut
// cards on mobile.
const mobileNav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/trilha", label: "Trilha", icon: Trophy },
  { to: "/conteudo", label: "Conteúdo", icon: CalendarDays },
  { to: "/marca", label: "Marca", icon: Palette },
  { to: "/conta", label: "Conta", icon: UserCog },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth", search: { modo: "entrar" } });
  }

  // A session expiring or being signed out from another tab must also wipe
  // this tab's cache — otherwise the next person to sign in on this browser
  // can briefly see the previous account's company/diagnostic/missions data
  // served straight from React Query's cache (C16 in the code review).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        navigate({ to: "/auth", search: { modo: "entrar" } });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, queryClient]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/painel">
            <NukkiaLogo />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
        {/* Full nav row: desktop/tablet only. Mobile gets the fixed bottom
            bar below instead of a sideways-scrolling row. */}
        <nav
          aria-label="Navegação principal"
          className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:flex"
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
            />
          ))}
          {isAdmin && <NavLink to="/admin" label="Admin" icon={ShieldCheck} pathname={pathname} />}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:pb-8">{children}</main>

      <nav
        aria-label="Navegação principal (móvel)"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {mobileNav.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  pathname,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  pathname: string;
}) {
  const active = pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
