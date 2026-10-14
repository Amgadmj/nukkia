import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  CreditCard,
  Database,
  FlaskConical,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAdminData } from "@/lib/admin/data";
import { isFixtureMode } from "@/lib/admin/fixture-mode";
import { useIsAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { relativeTime } from "./ui";

const NAV = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/receita", label: "Receita e margem", icon: TrendingUp },
  { to: "/admin/precos", label: "Preços", icon: Tag },
  { to: "/admin/uso", label: "Uso e custos", icon: Activity },
  { to: "/admin/cobrancas", label: "Cobranças", icon: CreditCard },
  { to: "/admin/dados", label: "Dados", icon: Database },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Administração" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active =
          "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              active && "bg-secondary font-medium text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Palette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { data } = useAdminData();
  const go = (action: () => void) => {
    onOpenChange(false);
    action();
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Ir para uma página ou buscar um cliente…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {NAV.map((item) => (
            <CommandItem
              key={item.to}
              value={`página ${item.label}`}
              onSelect={() => go(() => void navigate({ to: item.to }))}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {data?.companies.length ? (
          <CommandGroup heading="Clientes">
            {data.companies.slice(0, 200).map((company) => (
              <CommandItem
                key={company.id}
                value={`cliente ${company.name} ${company.segment ?? ""}`}
                onSelect={() =>
                  go(
                    () => void navigate({ to: "/admin/clientes", search: { empresa: company.id } }),
                  )
                }
              >
                <Users className="size-4" aria-hidden />
                {company.name}
                {company.segment ? <CommandShortcut>{company.segment}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * The admin frame: a fixed sidebar on wide screens, a drawer on narrow ones,
 * a top bar with search (Ctrl or Cmd + K) and a refresh button that also shows
 * how old the numbers are. It also guards the area: a signed-in non-admin sees
 * a refusal, and the real protection stays in RLS and the admin API.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const fixtures = isFixtureMode();
  const role = useIsAdmin();
  const query = useAdminData();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allowed = fixtures || role.data === true;
  if (!fixtures && role.isPending) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">Esta área é exclusiva para a equipe Nukkia.</p>
        <Button variant="outline" asChild>
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  const updated = query.dataUpdatedAt
    ? relativeTime(new Date(query.dataUpdatedAt).toISOString())
    : "—";

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r bg-card/50 px-3 py-5 lg:flex">
        <Link to="/admin" className="px-3" aria-label="Nukkia Admin">
          <NukkiaLogo symbolWidth={24} />
        </Link>
        <NavList />
        <div className="mt-auto space-y-2 px-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            asChild
          >
            <Link to="/painel">
              <ArrowLeft className="size-4" aria-hidden /> Voltar ao app
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setDrawer(true)}
          >
            <Menu className="size-5" />
          </Button>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:max-w-sm"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Buscar página ou cliente</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] sm:block">
              Ctrl K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {fixtures ? (
              <span className="mr-2 hidden items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 text-[11px] font-medium sm:inline-flex">
                <FlaskConical className="size-3" aria-hidden /> Dados de exemplo
              </span>
            ) : null}
            <span className="mr-1 hidden text-xs text-muted-foreground md:block">
              Atualizado {updated}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Atualizar números"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-64 px-3 py-5">
          <SheetTitle className="sr-only">Menu de administração</SheetTitle>
          <div className="mb-6 px-3">
            <NukkiaLogo symbolWidth={24} />
          </div>
          <NavList onNavigate={() => setDrawer(false)} />
        </SheetContent>
      </Sheet>
      <Palette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
