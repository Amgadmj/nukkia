import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChannelOverview } from "@/components/channel-overview";
import { ChannelRecommendations } from "@/components/channel-recommendations";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { projectChannelReferences } from "@/lib/brand-sources";

export const Route = createFileRoute("/_authenticated/redes")({
  head: () => ({
    meta: [
      { title: "Canais | Nukkia" },
      {
        name: "description",
        content: "Seus links públicos e o status registrado das suas contas.",
      },
    ],
  }),
  component: Redes,
});

function Redes() {
  const { data: workspace, setData, sync } = useMarketingWorkspace();
  const navigate = Route.useNavigate();
  const companyQuery = useCompany();
  const company = companyQuery.data;
  const accounts = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["social-accounts", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("provider, username, status")
        .eq("company_id", company!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const latestData = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["channel-latest-metrics", company?.id],
    queryFn: async () => {
      const rows = await Promise.all(
        ["instagram", "linkedin"].map(async (provider) => {
          const { data, error } = await supabase
            .from("metrics_snapshots")
            .select("provider, captured_for")
            .eq("company_id", company!.id)
            .eq("provider", provider)
            .order("captured_for", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          return data;
        }),
      );
      return rows.filter((row) => row !== null);
    },
  });

  if (companyQuery.isPending || sync === "loading")
    return (
      <p role="status" className="text-muted-foreground">
        Carregando seus canais…
      </p>
    );
  if (companyQuery.isError)
    return (
      <div role="alert" className="space-y-4">
        <p>Não foi possível carregar sua empresa.</p>
        <Button variant="outline" onClick={() => void companyQuery.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!company)
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-3xl font-semibold">Canais</h1>
        <p className="text-muted-foreground">Cadastre sua empresa para reunir seus canais.</p>
        <Button asChild>
          <Link to="/boas-vindas">Cadastrar empresa</Link>
        </Button>
      </div>
    );

  return (
    <ChannelOverview
      references={projectChannelReferences(workspace)}
      priority={
        <ChannelRecommendations
          data={workspace}
          onData={setData}
          onDiagnose={() =>
            void navigate({
              to: "/diagnostico",
              search: { editar: "diagnostico", retorno: "redes", capitulo: 1 },
            })
          }
        />
      }
      company={{
        website: workspace.answers.website,
        instagram_handle: workspace.answers.instagram,
        linkedin_url: workspace.answers.linkedin,
      }}
      accounts={accounts.data ?? []}
      accountsState={accounts.isError ? "error" : accounts.isPending ? "loading" : "ready"}
      latestData={latestData.data ?? []}
      dataState={latestData.isError ? "error" : latestData.isPending ? "loading" : "ready"}
      onRetry={() => {
        void accounts.refetch();
        void latestData.refetch();
      }}
      action={
        <Link to="/diagnostico" search={{ editar: "contexto", retorno: "redes" }}>
          Revisar meus links
        </Link>
      }
    />
  );
}
