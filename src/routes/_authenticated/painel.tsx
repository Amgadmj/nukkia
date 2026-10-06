import { resumeLibraryVersion } from "@/lib/content-library";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WorkspaceOverview } from "@/components/marketing-views";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { WORKSPACE_NAV, type WorkspaceSection } from "@/lib/marketing-workspace";
import { useQuery } from "@tanstack/react-query";
import { useCompany, useBrandKit } from "@/lib/company";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Meu painel | Nukkia" }] }),
  component: Painel,
});
function Painel() {
  const { data, setData } = useMarketingWorkspace();
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: kit } = useBrandKit(company?.id);
  const snapshots = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["metrics", company?.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("metrics_snapshots")
        .select("provider, captured_for, metrics")
        .eq("company_id", company!.id)
        .order("captured_for", { ascending: false })
        .limit(60);
      if (error) throw error;
      return rows ?? [];
    },
  });
  const section = (id: WorkspaceSection) =>
    id === "marca"
      ? void navigate({ to: "/marca", search: { retorno: "painel" } })
      : void navigate({ to: WORKSPACE_NAV.find((item) => item.id === id)!.to });
  return (
    <WorkspaceOverview
      data={data}
      onLibrary={() => void navigate({ to: "/conteudo", search: { aba: "biblioteca" } })}
      onResumeSaved={(id, version) => {
        if (
          !window.confirm(
            "Retomar esta versão? Guarde antes o rascunho atual que deseja manter. A aprovação deverá ser refeita.",
          )
        )
          return;
        const item = data.library.items.find((item) => item.id === id);
        if (!item) return;
        setData((current) => resumeLibraryVersion(current, id, version));
        void navigate({
          to: "/conteudo",
          search: { aba: item.kind === "generic" ? "peca" : "saude" },
        });
      }}
      onSection={section}
      onEditBrief={() =>
        void navigate({ to: "/diagnostico", search: { editar: "contexto", retorno: "painel" } })
      }
      identity={{
        logo: !!kit?.logo_url,
        tone: Boolean(kit?.selected_index != null && kit?.palette && kit?.tone),
      }}
      snapshots={snapshots.data ?? []}
      metricsState={
        snapshots.isError ? "error" : company?.id && snapshots.isPending ? "loading" : "ready"
      }
      onChooseApproach={(approach) => {
        if (approach)
          setData((current) => ({
            ...current,
            brand: {
              ...current.brand,
              preferredApproach: approach,
              pieceBrief: {
                ...(current.brand.pieceBrief ?? {
                  idea: "",
                  goal: "",
                  audience: "",
                  constraints: "",
                  ratio: "4:5" as const,
                }),
                asNew: true,
                format: approach === "educate" ? ("carousel" as const) : ("image" as const),
              },
            },
          }));
        void navigate({ to: "/conteudo", search: { aba: "briefing" } });
      }}
      onEditPiece={() => void navigate({ to: "/conteudo", search: { aba: "peca" } })}
    />
  );
}
