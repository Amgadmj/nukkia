import { WorkspaceSkeleton } from "@/components/workspace-skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BrainCircuit, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiagnosticWizard } from "@/components/diagnostic-wizard";
import { useCompany, useDiagnostic } from "@/lib/company";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { BrandBrain } from "@/components/marketing-views";
import {
  WORKSPACE_NAV,
  contextSearch,
  editWorkspaceAnswers,
  type ContextSearch,
} from "@/lib/marketing-workspace";
import { WorkspaceContextEditor } from "@/components/workspace-context-editor";
import { DiagnosticReportStart } from "@/components/diagnostic-report-start";
import { apiFetch } from "@/lib/api";
import {
  answersSchema,
  CHAPTERS,
  chapterMissing,
  diagnosticMatchesAnswers,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { etapa?: number; relatorio?: boolean } & ContextSearch => {
    const step = Number(search["etapa"]);
    return {
      ...contextSearch(search),
      ...(Number.isInteger(step) && step >= 0 && step < 5 ? { etapa: step } : {}),
      ...(search["relatorio"] === true || search["relatorio"] === "true"
        ? { relatorio: true }
        : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Cérebro da marca | Nukkia" },
      {
        name: "description",
        content:
          "Construa a cópia digital da sua marca: serviços, público, objetivos e referências reunidos no Cérebro.",
      },
    ],
  }),
  component: Diagnostico,
});
type Report = {
  resumo: string;
  pontos_fortes: string[];
  oportunidades: string[];
  recomendacoes: string[];
  pilares: string[];
};
function Diagnostico() {
  const workspace = useMarketingWorkspace();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const companyQuery = useCompany();
  const company = companyQuery.data;
  const diagnosticQuery = useDiagnostic(company?.id);
  const diagnostic = diagnosticQuery.data;
  const reportStale = Boolean(
    diagnostic?.report && !diagnosticMatchesAnswers(diagnostic.answers, workspace.data.answers),
  );
  const showReport = Boolean(search.relatorio);
  if (search.editar)
    return (
      <WorkspaceContextEditor
        data={workspace.data}
        onData={workspace.setData}
        onHealthStudio={() => void navigate({ to: "/conteudo", search: { aba: "saude" } })}
        mode={search.editar}
        chapter={search.capitulo}
        onReport={company ? () => void navigate({ search: { relatorio: true } }) : undefined}
        onReturn={() =>
          void navigate({
            to: WORKSPACE_NAV.find((item) => item.id === (search.retorno ?? "painel"))!.to,
            search: search.retorno === "conteudo" ? { aba: search.origemConteudo ?? "peca" } : {},
          })
        }
        onChapter={(chapter) =>
          void navigate({
            to: "/diagnostico",
            search: {
              editar: chapter === undefined ? "contexto" : "diagnostico",
              retorno: search.retorno ?? "painel",
              origemConteudo: search.origemConteudo,
              capitulo: chapter,
            },
          })
        }
      />
    );
  if (search.etapa === undefined && !showReport)
    return (
      <BrandBrain
        onServiceBrief={() => void navigate({ to: "/conteudo", search: { aba: "briefing" } })}
        serviceBriefDisabled={workspace.sync === "loading" || workspace.sync === "conflict"}
        catalogScope={
          workspace.company?.owner_id === workspace.ownerId
            ? { kind: "account", ownerId: workspace.ownerId, companyId: workspace.company.id }
            : undefined
        }
        data={workspace.data}
        onData={workspace.setData}
        onSection={(id) => void navigate({ to: WORKSPACE_NAV.find((item) => item.id === id)!.to })}
        onEditBrief={() =>
          void navigate({ to: "/diagnostico", search: { editar: "contexto", retorno: "cerebro" } })
        }
        onReport={company ? () => void navigate({ search: { relatorio: true } }) : undefined}
        reportLabel={
          diagnostic?.status === "ready" && diagnostic.report
            ? "Meu relatório salvo"
            : "Revisar para gerar análise"
        }
      />
    );
  if (companyQuery.isLoading || diagnosticQuery.isLoading)
    return <WorkspaceSkeleton layout="editor" />;
  if (companyQuery.error || diagnosticQuery.error)
    return (
      <p role="alert">
        Não foi possível carregar suas respostas. Atualize a página para tentar novamente.
      </p>
    );
  if (!company)
    return (
      <div className="py-12 text-center">
        <BrainCircuit className="mx-auto mb-5 size-10 text-primary" />
        <h1 className="text-2xl font-semibold">Tudo começa com sua empresa.</h1>
        <p className="mb-6 mt-3 text-muted-foreground">
          Cadastre seu negócio para construir seu cérebro de marketing.
        </p>
        <Button asChild>
          <Link to="/painel">
            Cadastrar empresa
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  const companyId = company.id;
  const report = (diagnostic?.status === "ready" ? diagnostic.report : null) as Report | null;
  const missing = CHAPTERS.map((_, chapter) => ({
    chapter,
    count: chapterMissing(chapter, workspace.data.answers).length,
  })).filter((item) => item.count > 0);
  async function generateReport() {
    if (generating) return;
    const parsed = answersSchema.safeParse(workspace.data.answers);
    if (!parsed.success) {
      setGenerationError("Revise suas respostas antes de gerar a análise.");
      return;
    }
    setGenerating(true);
    setGenerationError("");
    try {
      const response = await apiFetch("/api/diagnostico", {
        companyId,
        answers: parsed.data,
      });
      if (!response.ok)
        throw new Error(
          (await response.text()).slice(0, 240) || "Não foi possível gerar a análise.",
        );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["diagnostic", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["missions", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["company"] }),
      ]);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setGenerationError(
        (error instanceof Error ? error.message : "Não foi possível gerar a análise.") +
          " Suas respostas continuam salvas.",
      );
    } finally {
      setGenerating(false);
    }
  }
  return (
    <div className="space-y-8">
      {(report || showReport) && (
        <div className="mx-auto flex max-w-[880px] gap-2 border-b border-border pb-4">
          <Button
            variant={!showReport ? "secondary" : "ghost"}
            onClick={() => navigate({ search: {} })}
          >
            <BrainCircuit className="size-4" />
            Visão do cérebro
          </Button>
          <Button
            variant={showReport ? "secondary" : "ghost"}
            onClick={() => navigate({ search: { relatorio: true } })}
          >
            <FileText className="size-4" />
            Meu relatório
          </Button>
        </div>
      )}
      {showReport && report ? (
        <div className="mx-auto max-w-[880px] space-y-6">
          {reportStale && (
            <div
              role="status"
              className="rounded-xl border border-border p-4 text-sm text-muted-foreground"
            >
              Relatório anterior. Suas respostas mudaram desde esta análise; as recomendações abaixo
              ainda não refletem o contexto atual.
              <Button
                variant="link"
                className="h-auto p-0 ml-2"
                onClick={() => navigate({ search: { etapa: 0 } })}
              >
                Revisar e atualizar análise
              </Button>
            </div>
          )}
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-8 shrink-0 text-emerald-400" />
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-emerald-400">
                {reportStale ? "Análise anterior" : "Diagnóstico concluído"}
              </p>
              <h1 className="text-3xl font-semibold">Seu próximo passo está mais claro.</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Suas respostas viraram prioridades. Agora, dê uma identidade à sua estratégia.
              </p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Seu ponto de partida</CardTitle>
              <CardDescription>
                Presença digital: {diagnostic?.score ?? "—"}/100 · Esta é a análise de marketing,
                separada do progresso na trilha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-7">
              <p className="text-sm leading-7">{report.resumo}</p>
              <Section title="Pontos fortes" items={report.pontos_fortes} />
              <Section title="Oportunidades" items={report.oportunidades} />
              <Section title="Recomendações" items={report.recomendacoes} />
              {report.pilares?.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-semibold">Pilares de conteúdo</p>
                  <div className="flex flex-wrap gap-2">
                    {report.pilares.map((p) => (
                      <Badge key={p} variant="secondary">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/marca">
                Continuar para identidade
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/trilha">Ver minhas conquistas</Link>
            </Button>
          </div>
        </div>
      ) : showReport ? (
        <DiagnosticReportStart
          missing={missing}
          generating={generating}
          error={generationError}
          onGenerate={() => void generateReport()}
          onResume={(chapter) => void navigate({ search: { etapa: chapter } })}
        />
      ) : (
        <DiagnosticWizard
          key={company.id}
          company={company}
          previousAnswers={workspace.data.answers}
          onAnswersChange={(answers) =>
            workspace.setData((current) => editWorkspaceAnswers(current, answers))
          }
          initialStep={search.etapa}
          onComplete={() => {
            void navigate({ search: { relatorio: true } });
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
}
function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2.5 size-1 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
