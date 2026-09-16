import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas | Nukkia" },
      {
        name: "description",
        content: "Alcance, engajamento, mensagens, visitas ao perfil e ao site em um só painel.",
      },
      { property: "og:title", content: "Métricas | Nukkia" },
      { property: "og:description", content: "Resultados das suas redes em um só painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Metricas,
});

const cards = [
  { key: "reach", label: "Alcance" },
  { key: "engagement", label: "Engajamento" },
  { key: "profile_visits", label: "Visitas ao perfil" },
  { key: "website_clicks", label: "Visitas ao site" },
  { key: "messages", label: "Mensagens" },
  { key: "saves", label: "Salvamentos" },
  { key: "comments", label: "Comentários" },
  { key: "likes", label: "Curtidas" },
];

function Metricas() {
  const { data: company } = useCompany();
  const { data: snapshots } = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["metrics", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrics_snapshots")
        .select("provider, captured_for, metrics")
        .eq("company_id", company!.id)
        .order("captured_for", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  const totals: Record<string, number> = {};
  for (const snap of snapshots ?? []) {
    const m = (snap.metrics ?? {}) as Record<string, number>;
    for (const card of cards) {
      totals[card.key] = (totals[card.key] ?? 0) + (Number(m[card.key]) || 0);
    }
  }

  const temDados = (snapshots ?? []).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Métricas</h1>
        <p className="mt-1 text-muted-foreground">
          {temDados
            ? "Somatório dos últimos registros coletados das suas redes."
            : "Conecte suas redes para começarmos a coletar os resultados automaticamente."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl">
                {temDados ? (totals[card.key] ?? 0).toLocaleString("pt-BR") : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Coletas diárias por rede.</CardDescription>
        </CardHeader>
        <CardContent>
          {!temDados && (
            <p className="text-sm text-muted-foreground">Ainda não há coletas registradas.</p>
          )}
          {temDados && (
            <div className="space-y-2 text-sm">
              {(snapshots ?? []).map((snap, index) => {
                const m = (snap.metrics ?? {}) as Record<string, number>;
                return (
                  <div
                    key={`${snap.provider}-${snap.captured_for}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-medium capitalize">{snap.provider}</span>
                    <span className="text-muted-foreground">
                      {new Date(snap.captured_for).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-muted-foreground">
                      Alcance {Number(m["reach"]) || 0} · Engajamento {Number(m["engagement"]) || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
