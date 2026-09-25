import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { clearOnboardingDrafts } from "@/lib/onboarding-draft";
import { MarketingProvider, clearMarketingWorkspace } from "@/components/marketing-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user)
      throw redirect({
        to: "/auth",
        search: {
          modo: "entrar",
          inicio: location.pathname === "/boas-vindas" ? "onboarding" : undefined,
        },
      });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionValid, setSessionValid] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_OUT" ||
        (event === "INITIAL_SESSION" && !session) ||
        (session && session.user.id !== user.id)
      ) {
        setSessionValid(false);
        clearOnboardingDrafts();
        clearMarketingWorkspace();
        queryClient.clear();
        void navigate({ to: "/auth", search: { modo: "entrar" }, replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [user.id, navigate, queryClient]);
  if (!sessionValid) return null;
  return (
    <MarketingProvider ownerId={user.id}>
      {pathname === "/boas-vindas" ? (
        <Outlet />
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
    </MarketingProvider>
  );
}
