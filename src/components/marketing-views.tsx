import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Check,
  ChevronLeft,
  Circle,
  FileText,
  Globe2,
  Lightbulb,
  Palette,
  Pencil,
  Plus,
  Trophy,
} from "lucide-react";
import {
  briefIssues,
  CONTENT_APPROACHES,
  creativeStatus,
  firstPostBrief,
  recommendContent,
  updateBrand,
  identityIssues,
  identityReady,
  recommendedVisualStyle,
  VISUAL_STYLES,
} from "@/lib/brand-preview";
import { changeDemoContext, diagnosticCoverage, type DemoData } from "@/lib/quick-start";
import { answersSchema, CHAPTERS, hasAnswer } from "@/lib/onboarding";
import {
  firstValueMinutes,
  nextWorkspaceAction,
  workspaceGaps,
  journeyProgress,
  saveHypothesis,
  removeHypothesis,
  essentialDiagnostic,
  commandPriorities,
  dashboardMetrics,
  MEASUREMENT_OPTIONS,
  CHANNEL_OPTIONS,
  projectChannelReferences,
  type MetricSnapshot,
  type WorkspaceSection,
} from "@/lib/marketing-workspace";
import { postSvg, prepareAsset, svgUrl } from "@/lib/post-art";
import { CompactAnswer } from "./brand-onboarding";
import { BrandSources } from "./brand-sources";
import { ResearchSuggestions } from "./research-suggestions";
import { VisualStylePicker } from "./brand-direction";
import { ChannelRecommendations } from "./channel-recommendations";
import { applyResearchSuggestion, allowedSuggestions } from "@/lib/brand-research";

type BaseProps = { data: DemoData; onSection: (section: WorkspaceSection) => void };
export function WorkspaceHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="workspace-page-heading">
      {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
export function WorkspaceOverview({
  data,
  onSection,
  onEditBrief,
  identity,
  snapshots = [],
  metricsState = "ready",
}: BaseProps & {
  onEditBrief: () => void;
  onChooseApproach: () => void;
  identity?: { logo?: boolean; tone?: boolean };
  snapshots?: MetricSnapshot[];
  metricsState?: "ready" | "loading" | "error";
}) {
  const diagnostic = essentialDiagnostic(data);
  const coverage = diagnosticCoverage(data.answers);
  const priorities = commandPriorities(data, identity);
  const metrics = metricsState === "ready" ? dashboardMetrics(snapshots, data.strategy.metric) : [];
  const measurement = MEASUREMENT_OPTIONS.find((option) => option.value === data.strategy.metric);
  const channel = CHANNEL_OPTIONS.find((option) => option.value === data.strategy.channel);
  const creative = data.brand.creative;
  const status = creativeStatus(data);
  return (
    <div className="workspace-page command-center">
      <header className="command-heading">
        <div>
          <p>{data.name || "Seu workspace"}</p>
          <h1>Meu painel</h1>
        </div>
        <button className="quick-secondary" onClick={() => onSection("trilha")}>
          Minha trilha <ArrowRight size={16} />
        </button>
      </header>
      <section className="command-objective" aria-label="Seu objetivo">
        <div>
          <span className="workspace-eyebrow">SEU OBJETIVO</span>
          <h2>{data.answers.goals || "O que sua marca precisa agora?"}</h2>
          <p>
            {data.answers.goals
              ? data.answers.challenge ||
                "Defina o principal obstáculo para orientar suas prioridades."
              : "Defina uma prioridade para orientar seu diagnóstico e seu conteúdo."}
          </p>
        </div>
        <div className="command-objective-meta">
          <span>{measurement?.label || "Indicador a definir"}</span>
          <span>
            {channel?.label || (diagnostic.complete ? "Canais a recomendar" : "Após o diagnóstico")}
          </span>
          <button className="quick-text-button" onClick={onEditBrief}>
            <Pencil size={14} /> Editar objetivo
          </button>
        </div>
      </section>
      <section aria-labelledby="command-priorities">
        <div className="command-section-title">
          <h2 id="command-priorities">Prioridades</h2>
          <span>Com base na sua configuração</span>
        </div>
        <div className="command-priorities">
          {priorities.map((task, index) => (
            <article
              key={task.id}
              className={index === 0 ? "command-priority is-primary" : "command-priority"}
            >
              <div className="command-priority-icon">
                {task.section === "cerebro" ? (
                  <Brain size={22} />
                ) : task.section === "redes" ? (
                  <Globe2 size={22} />
                ) : task.section === "marca" ? (
                  <Palette size={22} />
                ) : (
                  <FileText size={22} />
                )}
                {index === 0 && <span>Comece por aqui</span>}
              </div>
              <h3>{task.title}</h3>
              <p>{task.description}</p>
              <button
                className={index === 0 ? "quick-primary" : "quick-text-button"}
                onClick={() =>
                  task.section === "cerebro" ? onEditBrief() : onSection(task.section)
                }
              >
                {task.label}
                <ArrowRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="command-results">
        <div className="command-section-title">
          <h2 id="command-results">Resultados</h2>
          <button className="quick-text-button" onClick={() => onSection("metricas")}>
            Ver resultados <ArrowRight size={15} />
          </button>
        </div>
        {metrics.length ? (
          <div className="command-metrics">
            {metrics.map((metric) => (
              <article key={metric.provider + metric.key}>
                <span>{metric.label}</span>
                <strong>{metric.value.toLocaleString("pt-BR")}</strong>
                <small>
                  {metric.provider} · Referente a{" "}
                  {new Date(metric.period + "T00:00:00Z").toLocaleDateString("pt-BR", {
                    timeZone: "UTC",
                  })}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="command-metrics-empty">
            <Globe2 size={25} strokeWidth={1.5} />
            <div>
              <h3>
                {metricsState === "loading"
                  ? "Consultando seus dados…"
                  : metricsState === "error"
                    ? "Dados indisponíveis no momento"
                    : "Seus resultados começam nos seus canais"}
              </h3>
              <p>
                {metricsState === "error"
                  ? "Abra Resultados para tentar novamente. Nenhum valor estimado está sendo exibido."
                  : "A conexão automática ainda não está disponível. Prepare os canais que você quer acompanhar."}
              </p>
            </div>
            <button
              className="quick-secondary"
              onClick={() => onSection(metricsState === "error" ? "metricas" : "redes")}
            >
              {metricsState === "error" ? "Verificar dados" : "Ver meus canais"}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
      {(coverage.answered > 0 || creative) && (
        <section aria-labelledby="command-current">
          <div className="command-section-title">
            <h2 id="command-current">Em andamento</h2>
          </div>
          <div className="command-current">
            {coverage.answered > 0 && (
              <button onClick={onEditBrief}>
                <span className="command-current-icon">
                  <Brain size={20} />
                </span>
                <span>
                  <strong>Diagnóstico da marca</strong>
                  <small>
                    {diagnostic.complete
                      ? "Essencial concluído"
                      : diagnostic.completed + " de 4 decisões essenciais"}{" "}
                    · {coverage.answered} respostas registradas
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            )}
            {creative && (
              <button onClick={() => onSection("conteudo")}>
                <span className="command-current-icon">
                  <FileText size={20} />
                </span>
                <span>
                  <strong>{creative.copy.title || "Sua peça de conteúdo"}</strong>
                  <small>
                    {status.approved
                      ? "Aprovada · disponível para baixar"
                      : status.stale
                        ? "Contexto atualizado · revisar peça"
                        : "Rascunho em edição"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export function BrandBrain({
  data,
  onData,
  onSection,
  onEditBrief,
  onReport,
  reportLabel = "Meu relatório salvo",
}: BaseProps & {
  onData: Dispatch<SetStateAction<DemoData>>;
  onEditBrief: () => void;
  onReport?: (() => void) | undefined;
  reportLabel?: string;
}) {
  const [tab, setTab] = useState<"confirmed" | "found" | "hypotheses" | "gaps">("confirmed");
  const [chapter, setChapter] = useState<number | null>(null);
  const [hypothesisDraft, setHypothesisDraft] = useState<string | null>(null);
  const [hypothesisId, setHypothesisId] = useState<string | null>(null);
  const [hypothesisSource, setHypothesisSource] = useState<"user" | "suggestion">("user");
  const [hypothesisError, setHypothesisError] = useState("");
  function editHypothesis(
    text = "",
    id: string | null = null,
    source: "user" | "suggestion" = "user",
  ) {
    setHypothesisDraft(text);
    setHypothesisId(id);
    setHypothesisSource(source);
    setHypothesisError("");
  }
  const recommendation = recommendContent(data);
  const gaps = workspaceGaps(data);
  const coverage = diagnosticCoverage(data.answers);
  const values = [
    ["Marca", data.name],
    ["Área", data.segment],
    ["Objetivo", data.answers.goals],
    ["Oferta", data.answers.offers],
    ["Público", data.answers.audience],
    ["Detalhe concreto", data.brand.detail],
  ];
  return (
    <div className="workspace-page">
      <WorkspaceHeading
        eyebrow="CONHECIMENTO QUE VIRA DIREÇÃO"
        title={`O Cérebro de ${data.name || "sua marca"}.`}
        description="O que sabemos, de onde veio e o que ainda pode tornar sua comunicação mais precisa."
      />
      <div className="workspace-actions">
        <button className="quick-primary" onClick={onEditBrief}>
          Continuar diagnóstico <ArrowRight size={15} />
        </button>
        {onReport && (
          <button className="quick-text-button" onClick={onReport}>
            <FileText size={16} /> {reportLabel}
          </button>
        )}
      </div>
      <div className="workspace-tabs" role="tablist" aria-label="Conhecimento da marca">
        {(
          [
            ["confirmed", "Confirmado"],
            ["found", "Encontrado"],
            ["hypotheses", "Hipóteses"],
            ["gaps", "Lacunas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            id={`brain-tab-${id}`}
            role="tab"
            aria-controls="brain-panel"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "gaps" && <span>{gaps.length}</span>}
          </button>
        ))}
      </div>
      <section
        id="brain-panel"
        role="tabpanel"
        aria-labelledby={`brain-tab-${tab}`}
        className="workspace-card"
      >
        {tab === "confirmed" && (
          <>
            <div className="workspace-card-top">
              <h2>
                {data.brand.confirmed
                  ? "A base que você confirmou."
                  : "Seu contexto, pronto para revisar."}
              </h2>
              <span className="workspace-tag">
                {data.brand.confirmed ? "Informado por você" : "Aguardando confirmação"}
              </span>
            </div>
            <dl className="workspace-facts">
              {values.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Ainda não informado"}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {tab === "found" && (
          <>
            <div className="workspace-card-top">
              <h2>Referências da marca</h2>
              <Globe2 size={20} />
            </div>
            {data.brand.research.sources.length || data.brand.research.discoveredLinks.length ? (
              <BrandSources
                research={data.brand.research}
                showMaterial
                extraLinks={data.brand.extraLinks}
                excludedKeys={data.brand.excludedReferences}
              />
            ) : (
              <div className="workspace-empty">
                <h3>
                  {data.brand.referenceUrl
                    ? "Referência indicada. Leitura ainda não disponível."
                    : "Uma fonte torna o contexto mais concreto."}
                </h3>
                <p>
                  {data.brand.referenceUrl ||
                    "Adicione o site ou cole uma apresentação da sua marca."}
                </p>
                <button className="quick-text-button" onClick={onEditBrief}>
                  Adicionar ou revisar referências <ArrowRight size={15} />
                </button>
              </div>
            )}
            <p className="workspace-note">
              Referências públicas não incluem alcance, conversões ou o histórico completo das suas
              redes.
            </p>
            {data.brand.research.phase && data.brand.research.phase !== "complete" && (
              <p role="status" className="workspace-note">
                Pesquisa complementar em andamento. Suas respostas confirmadas não serão alteradas.
              </p>
            )}
            <ResearchSuggestions
              suggestions={allowedSuggestions(data).filter((s) => s.kind !== "opportunity")}
              onUse={(item) => onData((current) => applyResearchSuggestion(current, item))}
            />
          </>
        )}
        {tab === "hypotheses" && (
          <>
            <div className="workspace-card-top">
              <div>
                <h2>Hipóteses para testar</h2>
                <p>Ideias da sua equipe e sugestões que ainda precisam de evidências.</p>
              </div>
              <button className="quick-secondary" onClick={() => editHypothesis()}>
                <Plus size={16} /> Nova hipótese
              </button>
            </div>
            {hypothesisDraft !== null && (
              <form
                className="workspace-hypothesis-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  const input = {
                    id: hypothesisId ?? crypto.randomUUID(),
                    text: hypothesisDraft,
                    source: hypothesisSource,
                  };
                  try {
                    saveHypothesis(data, input);
                    onData((current) => saveHypothesis(current, input));
                    setHypothesisDraft(null);
                    setHypothesisError("");
                  } catch {
                    setHypothesisError(
                      data.hypotheses.length >= 30 && !hypothesisId
                        ? "Você já tem 30 hipóteses. Edite uma delas para continuar."
                        : "Escreva uma hipótese com 3 a 600 caracteres.",
                    );
                  }
                }}
              >
                <label htmlFor="brand-hypothesis">
                  {hypothesisId ? "Editar hipótese" : "Sua hipótese"}
                </label>
                <textarea
                  id="brand-hypothesis"
                  autoFocus
                  value={hypothesisDraft}
                  rows={3}
                  maxLength={600}
                  placeholder="O que você acredita que pode melhorar a comunicação da marca?"
                  onChange={(event) => {
                    setHypothesisDraft(event.target.value);
                    setHypothesisError("");
                  }}
                />
                {hypothesisError && <p role="alert">{hypothesisError}</p>}
                <div className="workspace-actions">
                  <button
                    type="submit"
                    className="quick-primary"
                    disabled={hypothesisDraft.trim().length < 3}
                  >
                    Salvar hipótese
                  </button>
                  <button
                    type="button"
                    className="quick-text-button"
                    onClick={() => setHypothesisDraft(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {data.hypotheses.map((item) => (
              <article key={item.id} className="workspace-hypothesis-card">
                <span className="workspace-tag">
                  {item.source === "user" ? "Criada por você" : "Adaptada de uma sugestão"} · A
                  testar
                </span>
                <p className="workspace-large-copy">{item.text}</p>
                <div className="workspace-actions">
                  <button
                    className="quick-text-button"
                    aria-label="Editar hipótese"
                    onClick={() => editHypothesis(item.text, item.id, item.source)}
                  >
                    <Pencil size={15} /> Editar
                  </button>
                  <button
                    className="quick-text-button"
                    onClick={() => {
                      onData((current) => removeHypothesis(current, item.id));
                      if (hypothesisId === item.id) setHypothesisDraft(null);
                    }}
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
            <ResearchSuggestions
              suggestions={allowedSuggestions(data).filter((s) => s.kind === "opportunity")}
              onUse={(item) => editHypothesis(item.value, null, "suggestion")}
            />
            <div className="workspace-card-top">
              <h2>Sugestão para sua marca</h2>
              <Lightbulb size={20} />
            </div>
            <p className="workspace-large-copy">
              {data.brand.confirmed
                ? recommendation.hypothesis
                : "Confirme seu objetivo e sua oferta para começarmos com uma hipótese relevante."}
            </p>
            {data.brand.confirmed && (
              <button
                className="quick-secondary"
                onClick={() => editHypothesis(recommendation.hypothesis, null, "suggestion")}
              >
                <Pencil size={15} /> Personalizar sugestão
              </button>
            )}
            <button className="quick-text-button" onClick={() => onSection("conteudo")}>
              Ver recomendação de conteúdo <ArrowRight size={15} />
            </button>
          </>
        )}
        {tab === "gaps" && (
          <>
            <h2>Mais contexto. Melhores próximas escolhas.</h2>
            <div className="workspace-task-list">
              {gaps.map((gap) => (
                <button
                  key={gap.title}
                  onClick={() =>
                    gap.section === "cerebro" ? onEditBrief() : onSection(gap.section)
                  }
                >
                  <span>
                    <strong>{gap.title}</strong>
                    <small>{gap.why}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            {!gaps.length && (
              <p>
                Seu contexto inicial está completo. Aprofunde apenas o que ajudar sua próxima
                entrega.
              </p>
            )}
          </>
        )}
      </section>
      <section className="workspace-deeper">
        <div className="workspace-card-top">
          <div>
            <p className="workspace-eyebrow">DIAGNÓSTICO PROGRESSIVO</p>
            <h2>Diagnóstico da marca</h2>
          </div>
          <span className="workspace-tag">
            {coverage.answered}/{coverage.total} respostas
          </span>
        </div>
        <p className="workspace-note">
          Complete o que for útil agora. As respostas aprofundam seu contexto; a quantidade não mede
          a qualidade da marca.
        </p>
        {chapter === null ? (
          <div className="workspace-chapter-grid">
            {CHAPTERS.map((item, index) => (
              <button key={item.title} onClick={() => setChapter(index)}>
                <FileText size={18} aria-hidden="true" />
                <strong>{item.title}</strong>
                <small>{item.outcome}</small>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="workspace-card">
            <button className="quick-text-button" onClick={() => setChapter(null)}>
              <ChevronLeft size={15} /> Todos os capítulos
            </button>
            <h2>{CHAPTERS[chapter]!.title}</h2>
            <div className="brand-fields">
              {CHAPTERS[chapter]!.questions.map((question) => (
                <CompactAnswer
                  key={question.key}
                  label={question.label}
                  value={data.answers[question.key]}
                  maxLength={answersSchema.shape[question.key].removeDefault().maxLength ?? 1000}
                  placeholder={question.placeholder ?? ""}
                  onChange={(value) =>
                    onData((current) =>
                      changeDemoContext(current, {
                        answers: { ...current.answers, [question.key]: value },
                      }),
                    )
                  }
                />
              ))}
            </div>
            <button className="quick-secondary" onClick={() => setChapter(null)}>
              Concluir por agora <Check size={15} />
            </button>
          </div>
        )}
      </section>
      <section className="workspace-card">
        <p className="workspace-eyebrow">APRENDER COM SEU PÚBLICO</p>
        <h2>Uma dúvida real pode virar seu próximo conteúdo.</h2>
        <p>Registre o que seus clientes perguntam e uma resposta que você pode confirmar.</p>
        <div className="brand-fields">
          <CompactAnswer
            label="O que seus clientes perguntam antes de comprar?"
            value={data.brand.customerQuestion}
            maxLength={240}
            onChange={(customerQuestion) =>
              onData((current) => ({
                ...current,
                brand: updateBrand(current.brand, { customerQuestion }),
              }))
            }
          />
          <CompactAnswer
            label="Como você responde?"
            value={data.brand.questionAnswer}
            maxLength={300}
            onChange={(questionAnswer) =>
              onData((current) => ({
                ...current,
                brand: updateBrand(current.brand, { questionAnswer }),
              }))
            }
          />
        </div>
        <p className="workspace-note">
          Isso atualiza o contexto da recomendação. Sua peça continua editável e precisará de nova
          revisão.
        </p>
      </section>
    </div>
  );
}

export function DeliveryJourney({
  data,
  onSection,
  onCalendar,
  onDiagnose,
  identity,
}: BaseProps & {
  identity?: { logo: boolean; tone: boolean };
  onCalendar?: () => void;
  onDiagnose?: () => void;
}) {
  const status = journeyProgress(data);
  const essential = essentialDiagnostic(data);
  const phases = [
    {
      title: "Objetivo e diagnóstico",
      detail: "O que sua marca precisa e como acompanhar a melhora.",
      tasks: [
        {
          title: status.context ? "Contexto da marca concluído" : "Confirmar sua marca",
          why: status.contextNeedsReview
            ? "Etapa concluída no onboarding. Há informações atualizadas para revisar."
            : "Nome, área de atuação e público.",
          done: status.context,
          section: "cerebro",
          reward: "+20 XP",
        },
        {
          title: "Concluir diagnóstico da marca",
          why: `${essential.completed} de 4 decisões: objetivo, oferta e público, obstáculo e indicador.`,
          done: essential.complete,
          section: "cerebro",
        },
      ],
    },
    {
      title: "Canais e presença digital",
      detail: "Use o diagnóstico para priorizar presença e preparar as conexões.",
      tasks: [
        {
          title: data.strategy.channel ? "Canal inicial confirmado" : "Revisar canais recomendados",
          why:
            CHANNEL_OPTIONS.find((option) => option.value === data.strategy.channel)?.label ||
            (essential.complete
              ? "Confirme uma hipótese baseada no público e no objetivo da marca."
              : "Disponível depois do diagnóstico da marca."),
          done: !!data.strategy.channel,
          section: "redes",
        },
        {
          title: "Preparar a conexão da conta",
          why: "Integração automática ainda indisponível. Um link não é uma conexão autorizada.",
          done: false,
          section: "redes",
        },
      ],
    },
    {
      title: "Identidade da marca",
      detail: "Escolha o estilo e confirme os materiais do primeiro conteúdo.",
      tasks: [
        {
          title: "Escolher uma direção visual",
          why: "Essencial, Acolhedor ou Dinâmico. Você pode mudar depois.",
          done: !!data.brand.visualStyle,
          section: "marca",
          reward: "+10 XP",
        },
        {
          title: "Confirmar os materiais da marca",
          why: identity?.logo
            ? "Logo salvo na conta. Você pode revisar o kit e aplicá-lo à peça."
            : "Adicione logo, cores e materiais da sua marca.",
          done: identityReady(data.brand) || Boolean(identity?.tone),
          section: "marca",
          reward: "+20 XP",
        },
      ],
    },
    {
      title: "Conteúdo e execução",
      detail: "Da recomendação a uma peça que você pode usar.",
      tasks: [
        {
          title: "Escolher uma abordagem",
          why: "Explicar, gerar confiança ou convidar para agir.",
          done: !!data.brand.creative,
          section: "conteudo",
        },
        {
          title: "Aprovar a peça completa",
          why: "Revise o visual, as informações e a chamada para ação.",
          done: status.approved,
          section: "conteudo",
          reward: "+40 XP",
        },
        {
          title: "Levar a peça para usar",
          why: "Inicie o download de arte, legenda e referências.",
          done: status.exported,
          section: "conteudo",
          reward: "+30 XP",
        },
        ...(onCalendar
          ? [
              {
                title: "Explorar o planejamento",
                why: "Seu calendário existente continua disponível em Conteúdo.",
                done: false,
                section: "calendar",
              },
            ]
          : []),
      ],
    },
    {
      title: "Resultados e aprendizado",
      detail: "Use evidências para orientar a próxima escolha.",
      tasks: [
        {
          title: "Aprofundar seu contexto",
          why: "Explore os capítulos que podem ajudar sua próxima entrega.",
          done: CHAPTERS.every((chapter) =>
            chapter.questions.every((question) => hasAnswer(data.answers[question.key])),
          ),
          section: "cerebro",
        },
        {
          title: "Acompanhar suas entregas",
          why: "Veja o que já aprovou e o que conseguiu levar para usar.",
          done: false,
          section: "metricas",
        },
      ],
    },
  ];
  return (
    <div className="workspace-page">
      <WorkspaceHeading title="Minha trilha" />
      <div className="workspace-trail-summary">
        <Trophy size={26} />
        <div>
          <strong>{status.xp} XP</strong>
          <p>
            {status.completed} de {status.total} marcos da primeira entrega
          </p>
        </div>
        <progress aria-label="Progresso da trilha" value={status.completed} max={status.total} />
      </div>
      <ol className="workspace-phases">
        {phases.map((phase) => (
          <li key={phase.title}>
            <div className="workspace-phase-marker" aria-hidden="true">
              {phase.tasks.every((task) => task.done) ? (
                <Check size={18} className="workspace-complete" />
              ) : (
                <Circle size={14} />
              )}
            </div>
            <section
              data-complete={phase.tasks.every((task) => task.done)}
              className={`workspace-card${phase.tasks.every((task) => task.done) ? " workspace-phase-complete" : ""}`}
            >
              <div className="workspace-card-top">
                <div>
                  <h2>{phase.title}</h2>
                  <p>{phase.detail}</p>
                </div>
                <span
                  className={`workspace-tag${phase.tasks.every((task) => task.done) ? " workspace-tag-complete" : ""}`}
                >
                  {phase.tasks.every((task) => task.done) ? "Concluída" : "A completar"}
                </span>
              </div>
              <div className="workspace-task-list">
                {phase.tasks.map((task) => (
                  <button
                    key={task.title}
                    className={task.done ? "workspace-task-complete" : undefined}
                    onClick={() =>
                      task.section === "cerebro" && onDiagnose
                        ? onDiagnose()
                        : task.section === "calendar"
                          ? onCalendar?.()
                          : onSection(task.section as WorkspaceSection)
                    }
                  >
                    {task.done ? (
                      <Check size={17} className="workspace-complete" />
                    ) : (
                      <Circle size={15} />
                    )}
                    <span>
                      <strong>{task.title}</strong>
                      <small>{task.why}</small>
                    </span>
                    {"reward" in task && <em>{task.reward}</em>}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </section>
          </li>
        ))}
      </ol>
      <p className="workspace-note">
        O progresso considera as etapas concluídas e a versão atual da peça. Aprovação e download
        precisam de nova revisão após alterações; baixar não significa publicar.
      </p>
    </div>
  );
}

export function LocalIdentity({
  data,
  onData,
  onContinue,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onContinue: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const selected = data.brand.visualStyle ?? recommendedVisualStyle(data);
  const photoRequired = selected === "warm" || data.brand.preferredApproach === "trust";
  const missing = identityIssues({ ...data.brand, visualStyle: selected });
  if (photoRequired && !data.brand.photo && !missing.length)
    missing.push(
      "Adicione uma foto própria para a abordagem Gerar confiança, ou escolha um formato sem foto.",
    );
  async function upload(file: File | undefined, kind: "logo" | "photo") {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await prepareAsset(file, kind === "logo");
      if (!active.current) return;
      onData((current) => ({ ...current, brand: updateBrand(current.brand, { [kind]: asset }) }));
      setNotice("Imagem adicionada à identidade da sua marca.");
    } catch (error) {
      if (active.current)
        setNotice(error instanceof Error ? error.message : "Não foi possível abrir a imagem.");
    } finally {
      if (active.current) setUploading(false);
    }
  }
  return (
    <div className="workspace-page">
      <WorkspaceHeading
        eyebrow="RECONHECÍVEL EM CADA DETALHE"
        title="Vamos dar forma à sua marca."
        description="Confirme o estilo, a cor e os materiais do seu primeiro post."
      />
      <VisualStylePicker
        selected={selected}
        recommended={recommendedVisualStyle(data)}
        onSelect={(visualStyle) =>
          onData((current) => ({ ...current, brand: updateBrand(current.brand, { visualStyle }) }))
        }
      />
      <div className="workspace-secondary-grid">
        {(["logo", "photo"] as const).map((kind) => (
          <section className="workspace-card" key={kind}>
            <h2>
              {kind === "logo"
                ? "Seu logo · opcional"
                : `Sua fotografia · ${photoRequired ? "necessária" : "opcional"}`}
            </h2>
            {data.brand[kind] ? (
              <img
                className="workspace-asset-preview"
                src={data.brand[kind]}
                alt={kind === "logo" ? "Logo da marca" : "Foto fornecida pela marca"}
              />
            ) : kind === "logo" && data.brand.research.logo ? (
              <div>
                <img
                  className="workspace-asset-preview"
                  src={data.brand.research.logo}
                  alt="Logo encontrado no site da marca"
                />
                <button
                  className="quick-text-button"
                  onClick={() =>
                    onData((current) => ({
                      ...current,
                      brand: updateBrand(current.brand, {
                        logo: current.brand.research.logo,
                        assetSource: current.brand.research.logoSource,
                      }),
                    }))
                  }
                >
                  Usar logo encontrado no site <Check size={15} />
                </button>
              </div>
            ) : (
              <div className="workspace-preview-empty">
                <Palette size={32} />
                <p>
                  {kind === "logo"
                    ? "Seu símbolo dá identidade a cada entrega."
                    : "Uma foto própria permite mostrar seu jeito de fazer."}
                </p>
              </div>
            )}
            <label className="workspace-file-label">
              Escolher imagem
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  void upload(event.target.files?.[0], kind);
                  event.target.value = "";
                }}
              />
            </label>
          </section>
        ))}
      </div>
      <section className="workspace-card">
        <h2>Sua cor de destaque</h2>
        <label className="workspace-color">
          <input
            aria-label="Cor da marca"
            type="color"
            value={data.brand.accent}
            onChange={(event) =>
              onData((current) => ({
                ...current,
                brand: updateBrand(current.brand, { accent: event.target.value }),
              }))
            }
          />
          <span>{data.brand.accent}</span>
        </label>
        <p>Essa cor será aplicada ao estilo escolhido. Você pode ajustá-la depois.</p>
      </section>
      {missing.length > 0 && (
        <p className="brand-review-note" role="status">
          {missing[0]}
        </p>
      )}
      {data.brand.preferredApproach === "trust" && !data.brand.photo && selected !== "warm" && (
        <button
          className="quick-text-button"
          onClick={() =>
            onData((current) => ({
              ...current,
              brand: { ...current.brand, preferredApproach: "educate" },
            }))
          }
        >
          Escolher um formato sem foto <ArrowRight size={15} />
        </button>
      )}
      <div className="workspace-actions">
        <button
          className="quick-primary"
          disabled={uploading || missing.length > 0}
          onClick={() => {
            if (uploading || missing.length) return;
            onData((current) => {
              const brand = updateBrand(current.brand, { visualStyle: selected });
              if (identityIssues(brand).length) return current;
              return { ...current, brand: { ...brand, identityConfirmed: true } };
            });
            onContinue();
          }}
        >
          {uploading ? "Preparando imagem…" : "Salvar identidade e continuar"}
          <ArrowRight size={17} />
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

export function LocalChannels({
  data,
  onSection,
  onData,
  onEditBrief,
}: BaseProps & { onData?: Dispatch<SetStateAction<DemoData>>; onEditBrief?: () => void }) {
  const references = projectChannelReferences(data);
  const links = [
    ...references,
    ...CHANNEL_OPTIONS.filter(
      (option) =>
        ["website", "instagram", "linkedin", "googleBusiness"].includes(option.value) &&
        !references.some((reference) => reference.provider === option.value),
    ).map((option) => ({
      key: option.value,
      provider: option.value,
      label: option.label,
      value: option.value === "googleBusiness" ? data.answers.googleBusiness : "",
      state: "informed" as const,
    })),
  ];
  return (
    <div className="workspace-page">
      <WorkspaceHeading
        title="Canais"
        description="Seus endereços oficiais e as conexões que vão permitir acompanhar resultados."
      />
      {onData && (
        <ChannelRecommendations
          data={data}
          onData={onData}
          onDiagnose={() => onSection("cerebro")}
        />
      )}
      <div className="workspace-secondary-grid">
        {links.map(({ key, label, value, state }) => (
          <section className="workspace-card" key={key}>
            <div className="workspace-card-top">
              <h2>{label}</h2>
              <span className="workspace-tag">
                {!value
                  ? "Ainda não informado"
                  : state === "confirmed"
                    ? "Link confirmado"
                    : state === "identified"
                      ? "Link identificado"
                      : "Referência informada"}
              </span>
            </div>
            <p className="workspace-break">
              {value || "Adicione este canal ao contexto da marca quando fizer sentido."}
            </p>
            <p className="workspace-note">
              {value
                ? "Conexão para publicação e métricas ainda não disponível nesta demonstração."
                : "Você pode criar sua primeira peça sem conectar redes sociais."}
            </p>
            <button
              className="quick-text-button"
              onClick={() => (onEditBrief ? onEditBrief() : onSection("cerebro"))}
            >
              Revisar no cérebro da marca <ArrowRight size={15} />
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

export function LocalResults({ data, onSection }: BaseProps) {
  const status = creativeStatus(data);
  const minutes = firstValueMinutes(data);
  return (
    <div className="workspace-page">
      <WorkspaceHeading
        eyebrow="APRENDER COM O QUE ACONTECEU"
        title="Cada entrega deixa um aprendizado."
        description="Acompanhe sua primeira peça e o tempo até levá-la para usar."
      />
      <div className="workspace-stats">
        {[
          ["Peça atual aprovada", status.approved ? "1" : "0"],
          ["Download da versão atual", status.exported ? "Iniciado" : "Pendente"],
          [
            "Até o primeiro download aprovado",
            minutes === null ? "Ainda não medido" : `${minutes} min`,
          ],
        ].map(([label, value]) => (
          <section className="workspace-card" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
      <section className="workspace-card">
        <h2>Seu próximo aprendizado</h2>
        <p>
          {status.exported
            ? "Leve a peça para seu público. Que perguntas ela gerou? Registre essas dúvidas no cérebro da marca para orientar o próximo conteúdo."
            : "Revise sua peça e baixe o conjunto. Essa primeira entrega será o ponto de partida para aprender com seu público."}
        </p>
        <button
          className="quick-text-button"
          onClick={() => onSection(status.exported ? "cerebro" : "conteudo")}
        >
          {status.exported ? "Registrar uma dúvida de cliente" : "Continuar minha peça"}
          <ArrowRight size={15} />
        </button>
      </section>
      <section className="workspace-inset">
        <h3>Resultados dos canais</h3>
        <p>
          Alcance, engajamento e conversões ficam disponíveis quando houver uma integração com dados
          reais. Download não confirma que o conteúdo foi publicado.
        </p>
      </section>
    </div>
  );
}
