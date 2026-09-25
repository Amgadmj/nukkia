import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { WorkspaceShell } from "./workspace-shell";
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
  const { data, company } = useMarketingWorkspace();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
      xp={progress.xp}
      completed={progress.completed}
      total={progress.total}
      notifications={workspaceNotifications(data)}
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
          <button onClick={() => void signOut()} aria-label="Sair da conta">
            <LogOut size={17} />
            <span className="workspace-action-label">Sair da conta</span>
          </button>
        </>
      }
    >
      <WorkspaceSaveStatus />
      {children}
    </WorkspaceShell>
  );
}
