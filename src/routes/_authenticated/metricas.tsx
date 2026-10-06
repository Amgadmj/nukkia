import { WorkspaceSkeleton } from "@/components/workspace-skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { creativeStatus } from "@/lib/brand-preview";
import { firstValueMinutes } from "@/lib/marketing-workspace";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/metricas")({
  head: () => ({
    meta: [
      { title: "Resultados | Nukkia" },
      {
        name: "description",
        content: "Acompanhe o conteúdo aprovado e os resultados registrados da sua marca.",
      },
    ],
  }),
  component: Metricas,
});

const metrics = [
  { key: "reach", label: "Alcance" },
  { key: "engagement", label: "Engajamento" },
  { key: "profile_visits", label: "Visitas ao perfil" },
  { key: "website_clicks", label: "Cliques no site" },
  { key: "messages", label: "Mensagens" },
  { key: "saves", label: "Salvamentos" },
  { key: "comments", label: "Comentários" },
  { key: "likes", label: "Curtidas" },
];

function metricValue(data: Json, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "—";
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value.toLocaleString("pt-BR")
    : "—";
}

function periodLabel(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function Metricas() {
  const { data: workspace, sync } = useMarketingWorkspace();
  const firstPiece = creativeStatus(workspace);
  const firstMinutes = firstValueMinutes(workspace);
  const firstPieceLoading = sync === "loading";
  const companyQuery = useCompany();
  const company = companyQuery.data;
  const snapshots = useQuery({
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
  const activity = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["content-items", company?.id, "result-counts"],
    queryFn: async () => {
      const counts = await Promise.all([
        supabase
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company!.id)
          .eq("status", "approved"),
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company!.id)
          .eq("status", "scheduled"),
        supabase
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company!.id)
          .eq("status", "published"),
      ]);
      return counts.map(({ count, error }) => {
        if (error) throw error;
        if (count === null) throw new Error("Contagem indisponível");
        return count;
      });
    },
  });

  if (companyQuery.isPending) return <WorkspaceSkeleton layout="dashboard" />;
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
        <h1 className="text-3xl font-semibold">Resultados</h1>
        <p className="text-muted-foreground">
          Cadastre sua empresa para acompanhar sua produção de conteúdo.
        </p>
        <Button asChild>
          <Link to="/boas-vindas">Cadastrar empresa</Link>
        </Button>
      </div>
    );

  const activityCards = [
    {
      label: "Conteúdos aprovados",
      description: "Peças com aprovação registrada, ainda nesta etapa.",
      icon: CheckCircle2,
    },
    {
      label: "Publicações agendadas",
      description: "Registros na fila de publicação. Datas de rascunhos não entram aqui.",
      icon: CalendarDays,
    },
    {
      label: "Publicações registradas",
      description: "Registros marcados como publicados. Publicações manuais podem não constar.",
      icon: Send,
    },
  ];
  const hasApproved =
    (!firstPieceLoading && firstPiece.approved) ||
    (!activity.isError && (activity.data?.[0] ?? 0) > 0);
  const records = snapshots.isError ? [] : (snapshots.data ?? []);
  // Each provider retains its own period. Never sum potentially overlapping snapshots.
  const latest = records.filter(
    (record, index) => records.findIndex((entry) => entry.provider === record.provider) === index,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Da intenção à prática
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Resultados</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Acompanhe o que sua marca já colocou em movimento, com os dados disponíveis na Nukkia.
        </p>
      </header>
      <section aria-labelledby="first-piece" className="space-y-5">
        <div>
          <h2 id="first-piece" className="text-lg font-semibold">
            Sua primeira peça
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Aprovação e exportação da versão atual no seu espaço de trabalho. Exportar não significa
            publicar.
          </p>
        </div>
        <dl className="grid gap-6 rounded-2xl border border-border bg-card/40 p-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Aprovação atual</dt>
            <dd className="mt-3 text-lg font-medium">
              {firstPieceLoading
                ? "Consultando…"
                : firstPiece.approved
                  ? "Aprovada"
                  : firstPiece.stale
                    ? "Revisão necessária"
                    : "Pendente"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Exportação atual</dt>
            <dd className="mt-3 text-lg font-medium">
              {firstPieceLoading ? "Consultando…" : firstPiece.exported ? "Exportada" : "Pendente"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Até a primeira entrega</dt>
            <dd className="mt-3 text-lg font-medium tabular-nums">
              {!firstPieceLoading && firstMinutes !== null && Number.isFinite(firstMinutes)
                ? `${firstMinutes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          Tempo observado entre o início e a primeira exportação de uma peça aprovada, a partir dos
          eventos registrados; inclui pausas. Sem esses eventos, fica indisponível. Esse histórico
          permanece mesmo se você editar a peça. Os dados desta seção não são somados aos totais do
          calendário abaixo.
        </p>
      </section>
      <section aria-labelledby="content-activity" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="content-activity" className="text-lg font-semibold">
            Registros do calendário
          </h2>
          <span className="text-xs text-muted-foreground">Status atuais · todos os registros</span>
        </div>
        {activity.isError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>Não foi possível consultar as contagens.</p>
            <Button size="sm" variant="outline" onClick={() => void activity.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {activity.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Consultando registros…
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {activityCards.map(({ label, description, icon: Icon }, index) => (
            <article key={label} className="rounded-2xl border border-border bg-card/40 p-6">
              <Icon className="mb-6 size-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-4xl font-semibold tabular-nums tracking-tight">
                {activity.isError || activity.isPending
                  ? "—"
                  : (activity.data?.[index]?.toLocaleString("pt-BR") ?? "—")}
              </p>
              <h3 className="mt-3 text-sm font-medium">{label}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Uma peça pode ter publicações em mais de uma rede. As contagens representam etapas
          diferentes e não devem ser somadas.
        </p>
      </section>
      <section
        className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-border bg-muted/30 p-6 sm:p-7"
        aria-labelledby="next-action"
      >
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            Próximo passo
          </p>
          <h2 id="next-action" className="mt-3 text-lg font-semibold">
            {hasApproved
              ? "Leve seu conteúdo aprovado para a rede."
              : "Continue sua produção de conteúdo."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {hasApproved
              ? "Revise a peça e publique diretamente no canal escolhido. A publicação automática ainda não está habilitada na Nukkia."
              : "Abra seu conteúdo para revisar as peças e aprovar o que estiver pronto. A aprovação é o primeiro avanço que você pode acompanhar aqui."}
          </p>
        </div>
        <Button asChild>
          <Link
            to="/conteudo"
            search={{ aba: !firstPiece.approved && hasApproved ? "calendario" : "peca" }}
          >
            {hasApproved ? "Ver conteúdo aprovado" : "Revisar conteúdo"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </section>
      <section aria-labelledby="network-results" className="space-y-5">
        <div>
          <h2 id="network-results" className="text-lg font-semibold">
            Desempenho nas redes
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Alcance e interação dependem de dados das plataformas. Um link público ou uma peça
            aprovada não gera essas métricas.
          </p>
        </div>
        {snapshots.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Consultando métricas…
          </p>
        ) : snapshots.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5 text-sm"
          >
            <p>Não foi possível consultar as métricas das redes.</p>
            <Button variant="outline" size="sm" onClick={() => void snapshots.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : latest.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 sm:px-8">
            <BarChart3 className="mb-5 size-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-medium">Ainda sem dados de desempenho</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Não há métricas registradas para sua empresa. A conexão automática das redes ainda
              está indisponível. Você pode consultar os resultados diretamente no Instagram ou
              LinkedIn.
            </p>
            <Link
              to="/redes"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver meus canais <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs leading-5 text-muted-foreground">
              Último registro de cada rede entre os 60 mais recentes. Valores como registrados, sem
              somar períodos ou redes. “—” indica uma métrica não informada.
            </p>
            {latest.map((record) => (
              <article
                key={record.provider}
                className="rounded-2xl border border-border bg-card/40 p-6"
              >
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-medium">
                    {record.provider === "instagram"
                      ? "Instagram"
                      : record.provider === "linkedin"
                        ? "LinkedIn"
                        : record.provider}
                  </h3>
                  <Badge variant="outline">Referente a {periodLabel(record.captured_for)}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-7 lg:grid-cols-4">
                  {metrics.map(({ key, label }) => (
                    <div key={key}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-2 text-xl font-medium tabular-nums">
                        {metricValue(record.metrics, key)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
            <details className="rounded-xl border border-border p-5">
              <summary className="cursor-pointer text-sm font-medium">
                Histórico de registros ({records.length})
              </summary>
              <ul className="mt-4 divide-y divide-border">
                {records.map((record, index) => (
                  <li
                    key={`${record.provider}-${record.captured_for}-${index}`}
                    className="flex flex-wrap justify-between gap-2 py-4 text-xs text-muted-foreground"
                  >
                    <span className="capitalize">
                      {record.provider} · {periodLabel(record.captured_for)}
                    </span>
                    <span>
                      Alcance: {metricValue(record.metrics, "reach")} · Engajamento:{" "}
                      {metricValue(record.metrics, "engagement")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          Receita, vendas e retorno sobre investimento não são medidos aqui. Esses resultados exigem
          dados de conversão e custos que ainda não estão disponíveis.
        </p>
      </section>
    </div>
  );
}
