import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { WorkspaceShell } from "./workspace-shell";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { workspaceLoadingLayout } from "@/lib/workspace-loading";
import {
  useMarketingWorkspace,
  clearMarketingWorkspace,
  WorkspaceSaveStatus,
} from "./marketing-provider";
import {
  WORKSPACE_NAV,
  journeyProgress,
  workspaceNotifications,
  type WorkspaceSection,
} from "@/lib/marketing-workspace";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/roles";
import { clearOnboardingDrafts } from "@/lib/onboarding-draft";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const { data, company, sync } = useMarketingWorkspace();
  const [hasShownContent, setHasShownContent] = useState(sync !== "loading");
  useEffect(() => {
    if (sync !== "loading") setHasShownContent(true);
  }, [sync]);
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tab = useRouterState({ select: (state) => state.location.search.aba });
  const queryClient = useQueryClient();
  const progress = journeyProgress(data);
  const section = WORKSPACE_NAV.find((item) => item.to === pathname)?.id;
  const go = (id: WorkspaceSection) =>
    void navigate({ to: WORKSPACE_NAV.find((item) => item.id === id)!.to });
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Não foi possível sair da conta. Tente novamente.");
      return;
    }
    clearOnboardingDrafts();
    clearMarketingWorkspace();
    queryClient.clear();
    void navigate({ to: "/auth", search: { modo: "entrar" } });
  }
  return (
    <WorkspaceShell
      name={data.name || company?.name || ""}
      section={section}
      onSection={go}
      onCalendar={() => void navigate({ to: "/conteudo", search: { aba: "planejamento" } })}
      calendarActive={pathname === "/conteudo" && (tab === "planejamento" || tab === "calendario")}
      xp={progress.xp}
      completed={progress.completed}
      total={progress.total}
      notifications={workspaceNotifications(data)}
      onSignOut={() => void signOut()}
      accountActions={
        <>
          {isAdmin && (
            <Link to="/admin" aria-label="Administração">
              <ShieldCheck size={17} />
              <span className="workspace-action-label">Administração</span>
            </Link>
          )}
          <Link to="/conta" aria-label="Configurações">
            <Settings size={17} />
            <span className="workspace-action-label">Configurações</span>
          </Link>
        </>
      }
    >
      <WorkspaceSaveStatus />
      {!hasShownContent && sync === "loading" ? (
        <WorkspaceSkeleton layout={workspaceLoadingLayout(pathname, tab)} />
      ) : (
        children
      )}
    </WorkspaceShell>
  );
}
