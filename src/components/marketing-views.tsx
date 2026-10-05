import { applyServiceToBrief } from "@/lib/service-brief";
import { InspirationBoard } from "./inspiration-board";
import { WorkspaceServices } from "./workspace-services";
import type { CatalogScope } from "@/lib/service-catalog-storage";
import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Check,
  ChevronLeft,
  Circle,
  FileText,
  Film,
  Image,
  Layers,
  Globe2,
  Lightbulb,
  Palette,
  Pencil,
  Plus,
  Trophy,
} from "lucide-react";
import {
  type ContentApproach,
  composeContent,
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
  onChooseApproach,
  onEditPiece,
  onResumeSaved,
  onLibrary,
  identity,
  snapshots = [],
  metricsState = "ready",
}: BaseProps & {
  onEditBrief: () => void;
  onChooseApproach: (approach?: ContentApproach) => void;
  onEditPiece: () => void;
  onResumeSaved?: (id: string, version: number) => void;
  onLibrary?: () => void;
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
  const healthDraft = data.healthStudio.options.find(
    (option) => option.id === data.healthStudio.selectedOption,
  );
  return (
    <div className="workspace-page command-center">
      <section aria-labelledby="home-create-title" className="home-create-section">
        <div className="command-section-title">
          <h2 id="home-create-title">O que você quer criar?</h2>
          <button className="quick-text-button" onClick={() => onChooseApproach()}>
            Comparar abordagens <ArrowRight size={15} />
          </button>
        </div>
        <div className="home-format-grid">
          <button
            className="home-format-card format-video"
            aria-label="Criar roteiro de vídeo"
            onClick={() => onSection("conteudo")}
          >
            <strong>Vídeo</strong>
            <p>Monte seu roteiro e ajuste cada cena.</p>
            <span className="home-format-arrow">
              <ArrowRight size={18} />
            </span>
            <Film className="home-format-art" size={68} strokeWidth={1} />
          </button>
          <button
            className="home-format-card format-image"
            aria-label="Criar imagem"
            onClick={() => onChooseApproach("invite")}
          >
            <strong>Imagem</strong>
            <p>Defina uma nova peça no briefing.</p>
            <span className="home-format-arrow">
              <ArrowRight size={18} />
            </span>
            <Image className="home-format-art" size={68} strokeWidth={1} />
          </button>
          <button
            className="home-format-card format-carousel"
            aria-label="Criar carrossel"
            onClick={() => onChooseApproach("educate")}
          >
            <strong>Carrossel</strong>
            <p>Explique uma ideia em três páginas editáveis.</p>
            <span className="home-format-arrow">
              <ArrowRight size={18} />
            </span>
            <Layers className="home-format-art" size={68} strokeWidth={1} />
          </button>
        </div>
      </section>
      <div className="home-start-grid">
        <section className="home-setup-card" aria-labelledby="home-setup-title">
          <h2 id="home-setup-title">Comece pela sua marca</h2>
          <button onClick={() => onSection("cerebro")}>
            <span className="home-setup-icon">
              <FileText size={18} />
            </span>
            <span>
              <strong>Serviços e ofertas</strong>
              <small>{data.answers.offers || "Defina o que sua clínica oferece"}</small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button onClick={onEditBrief} data-complete={diagnostic.complete}>
            <span className="home-setup-icon">
              <Brain size={18} />
            </span>
            <span>
              <strong>Contexto</strong>
              <small>{diagnostic.complete ? "Essencial concluído" : "Continuar diagnóstico"}</small>
            </span>
            {diagnostic.complete ? <Check size={16} /> : <ArrowRight size={16} />}
          </button>
          <button onClick={() => onSection("marca")} data-complete={identityReady(data.brand)}>
            <span className="home-setup-icon">
              <Palette size={18} />
            </span>
            <span>
              <strong>Identidade visual</strong>
              <small>Revise cores, logo e direção</small>
            </span>
            {identityReady(data.brand) ? <Check size={16} /> : <ArrowRight size={16} />}
          </button>
        </section>
        <section className="home-studio-card" aria-labelledby="home-studio-title">
          <div>
            <span className="studio-kicker">ESTÚDIO DE SAÚDE</span>
            <h2 id="home-studio-title">Do roteiro à sequência.</h2>
            <p>Escolha uma estrutura, compare três exemplos e edite cena por cena.</p>
          </div>
          <div className="home-scene-art" aria-hidden="true">
            <span />
            <span>
              <Film size={32} strokeWidth={1.3} />
            </span>
            <span />
          </div>
          <button className="quick-primary" onClick={() => onSection("conteudo")}>
            {healthDraft ? "Continuar roteiro" : "Criar roteiro"}
            <ArrowRight size={17} />
          </button>
          <small>Prévia em cartões de texto · exemplo fictício</small>
        </section>
      </div>
      <section className="home-library" aria-labelledby="home-library-title">
        <div className="command-section-title">
          <h2 id="home-library-title">Seus rascunhos</h2>
          {onLibrary && (
            <button className="quick-text-button" onClick={onLibrary}>
              Abrir biblioteca
            </button>
          )}
        </div>
        {healthDraft || creative ? (
          <div className="home-draft-grid">
            {healthDraft && (
              <button className="home-draft-card" onClick={() => onSection("conteudo")}>
                <div className="home-draft-cover">
                  <span>EXEMPLO FICTÍCIO</span>
                  <strong>{healthDraft.scenes[0]?.heading}</strong>
                  <Film size={23} />
                </div>
                <strong>{healthDraft.title}</strong>
                <small>{healthDraft.scenes.length} cenas · sem aprovação</small>
              </button>
            )}
            {creative && (
              <button className="home-draft-card" onClick={onEditPiece}>
                <img
                  className="home-saved-thumbnail"
                  alt={`Rascunho atual: ${creative.copy.title}`}
                  src={svgUrl(
                    postSvg(firstPostBrief(data), creative.copy, data.brand, {
                      approach: creative.approach,
                      page: 1,
                      total: creative.slides.length + 1,
                    }),
                  )}
                />
                <strong>{creative.copy.title || "Sua peça de conteúdo"}</strong>
                <span>
                  {creative.slides.length ? "Carrossel" : "Imagem"} ·{" "}
                  {status.approved ? "Aprovação criativa registrada" : "Rascunho"}
                </span>
                <small>
                  {status.stale
                    ? "Contexto atualizado · revisar peça"
                    : "Abrir no editor de imagem"}
                </small>
              </button>
            )}
          </div>
        ) : (
          <div className="home-library-empty">
            <FileText size={24} />
            <p>Os roteiros e peças que você preparar ficam aqui.</p>
            <button className="quick-text-button" onClick={() => onChooseApproach("invite")}>
              Preparar minha primeira peça <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
      {onResumeSaved && data.library.items.some((item) => !item.archived) && (
        <section className="home-library" aria-label="Versões guardadas">
          <h2>Versões guardadas</h2>
          <div className="home-draft-grid">
            {data.library.items
              .filter((item) => !item.archived)
              .slice()
              .sort((a, b) => b.versions.at(-1)!.savedAt.localeCompare(a.versions.at(-1)!.savedAt))
              .slice(0, 4)
              .map((item) => {
                const saved = item.versions.at(-1)!;
                const snapshot = saved.snapshot;
                const savedCreative = snapshot.kind === "generic" ? snapshot.brand.creative : null;
                const savedScene =
                  snapshot.kind === "health"
                    ? snapshot.draft.options.find(
                        (option) => option.id === snapshot.draft.selectedOption,
                      )?.scenes[0]
                    : null;
                return (
                  <button
                    className="home-draft-card"
                    key={item.id}
                    onClick={() => onResumeSaved(item.id, saved.version)}
                  >
                    {snapshot.kind === "generic" && savedCreative ? (
                      <img
                        className="home-saved-thumbnail"
                        alt={`Prévia guardada: ${savedCreative.copy.title}`}
                        src={svgUrl(
                          postSvg(
                            firstPostBrief({
                              name: snapshot.name,
                              segment: snapshot.segment,
                              answers: {
                                offers: snapshot.offer,
                                audience: snapshot.audience,
                                goals: snapshot.goal,
                              },
                              brand: snapshot.brand,
                            }),
                            savedCreative.copy,
                            snapshot.brand,
                            {
                              approach: savedCreative.approach,
                              page: 1,
                              total: savedCreative.slides.length + 1,
                            },
                          ),
                        )}
                      />
                    ) : (
                      <div className="home-draft-cover">
                        <span>ROTEIRO FICTÍCIO</span>
                        <strong>{savedScene?.heading || "Roteiro guardado"}</strong>
                        <p>{savedScene?.script}</p>
                      </div>
                    )}
                    <strong>{item.title}</strong>
                    <span>
                      {item.kind === "health"
                        ? "Roteiro fictício"
                        : savedCreative?.slides.length
                          ? "Carrossel"
                          : "Imagem"}
                    </span>
                    <small>
                      {snapshot.kind === "health"
                        ? "Sem revisão profissional"
                        : snapshot.approved
                          ? "Aprovação criativa registrada"
                          : "Rascunho"}
                    </small>
                    <small>{new Date(saved.savedAt).toLocaleString("pt-BR")}</small>
                    <span>{`Retomar versão ${saved.version}`}</span>
                  </button>
                );
              })}
          </div>
        </section>
      )}
      <section className="home-objective" aria-label="Seu objetivo">
        <div>
          <small>OBJETIVO DA MARCA</small>
          <strong>{data.answers.goals || "Defina sua prioridade"}</strong>
          <span>
            {measurement?.label || "Indicador a definir"} · {channel?.label || "Canal a definir"}
          </span>
        </div>
        <button className="quick-text-button" onClick={onEditBrief}>
          <Pencil size={14} /> Editar
        </button>
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
  catalogScope,
  onServiceBrief,
  serviceBriefDisabled = false,
}: BaseProps & {
  onData: Dispatch<SetStateAction<DemoData>>;
  onEditBrief: () => void;
  onReport?: (() => void) | undefined;
  reportLabel?: string;
  catalogScope?: CatalogScope | undefined;
  onServiceBrief?: () => void;
  serviceBriefDisabled?: boolean;
}) {
  const [tab, setTab] = useState<"confirmed" | "found" | "hypotheses" | "gaps" | "services">(
    "confirmed",
  );
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
        description="A cópia digital da sua marca: o que ela oferece, para quem fala e como se comunica. Revise as informações e suas fontes."
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
      <div className="workspace-tabs brain-tabs" role="tablist" aria-label="Conhecimento da marca">
        {(
          [
            ["confirmed", "Confirmado"],
            ["services", "Serviços e ofertas"],
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
        <div hidden={tab !== "services"}>
          <WorkspaceServices
            scope={catalogScope}
            onApplyBrief={
              serviceBriefDisabled
                ? undefined
                : (service, revision) => {
                    const now = new Date();
                    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                    onData((current) => applyServiceToBrief(current, service, revision, today));
                    if (onServiceBrief) onServiceBrief();
                    else onSection("conteudo");
                  }
            }
          />
        </div>
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
      <section className="workspace-deeper" hidden={tab === "services"}>
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
      <section className="workspace-card" hidden={tab === "services"}>
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
  const [selected, setSelected] = useState(-1);
  const trailId = useId();
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
  const phaseIcons = [Brain, Globe2, Palette, FileText, Lightbulb];
  const reasons = [
    "Uma oferta e um público bem definidos ajudam a criar conteúdo relevante, sem inventar informações sobre sua marca.",
    "Priorizar um canal concentra seu esforço onde seu público pode encontrar você. Um link informado ainda não conecta a conta.",
    "Cores, estilo e materiais consistentes ajudam as pessoas a reconhecer sua marca em cada peça.",
    "Revisar a mensagem e o visual evita levar informações incorretas para o público. Baixar uma peça não a publica.",
    "Comparar entregas com dados observados ajuda a decidir o que manter e o que ajustar, sem confundir hipóteses com resultados.",
  ];
  return (
    <div className="workspace-page journey-page">
      <div className="workspace-trail-summary">
        <Trophy size={26} aria-hidden="true" />
        <div>
          <strong>Primeira entrega</strong>
          <p>
            {status.completed} de {status.total} marcos concluídos · {status.xp} XP
          </p>
        </div>
        <progress aria-label="Progresso da trilha" value={status.completed} max={status.total} />
      </div>
      <p className="journey-intro">
        Selecione uma etapa para entender o que fazer e por que ela importa.
      </p>
      <ol className="journey-path" aria-label="Etapas da sua trilha">
        {phases.map((phase, index) => {
          const done = phase.tasks.every((task) => task.done);
          const Icon = phaseIcons[index]!;
          const open = selected === index;
          const buttonId = `${trailId}-step-${index}`;
          const panelId = `${trailId}-detail-${index}`;
          return (
            <li key={phase.title} className={index % 2 ? "journey-stop is-right" : "journey-stop"}>
              <section data-complete={done} className="journey-stage">
                <button
                  id={buttonId}
                  className={`journey-dot${done ? " is-complete" : ""}${open ? " is-selected" : ""}`}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setSelected(open ? -1 : index)}
                >
                  <span className="journey-orbit" aria-hidden="true">
                    <Icon size={30} strokeWidth={1.6} />
                    {done && <Check className="journey-check" size={20} />}
                  </span>
                  <strong>{phase.title}</strong>
                  <small>
                    {done
                      ? "Concluída"
                      : `${phase.tasks.filter((task) => task.done).length} de ${phase.tasks.length} ações concluídas`}
                  </small>
                </button>
                <div
                  id={panelId}
                  hidden={!open}
                  role="region"
                  aria-labelledby={buttonId}
                  className="journey-detail"
                >
                  {
                    <>
                      <h2>O que fazer e por quê</h2>
                      <ul>
                        <li>{phase.detail}</li>
                        <li>{reasons[index]}</li>
                      </ul>
                      <div className="journey-actions">
                        {phase.tasks.map((task) => (
                          <button
                            key={task.title}
                            className="journey-action"
                            onClick={() =>
                              task.section === "cerebro" && onDiagnose
                                ? onDiagnose()
                                : task.section === "calendar"
                                  ? onCalendar?.()
                                  : onSection(task.section as WorkspaceSection)
                            }
                          >
                            {task.done ? (
                              <Check size={17} className="workspace-complete" aria-hidden="true" />
                            ) : (
                              <Circle size={15} aria-hidden="true" />
                            )}
                            <span>
                              <strong>{task.title}</strong>
                              <small>{task.why}</small>
                            </span>
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </>
                  }
                </div>
              </section>
              {index < phases.length - 1 && (
                <svg
                  className="journey-connector"
                  viewBox="0 0 600 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d={
                      index % 2
                        ? "M 480 0 C 480 65, 120 35, 120 100"
                        : "M 120 0 C 120 65, 480 35, 480 100"
                    }
                  />
                </svg>
              )}
            </li>
          );
        })}
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
        title="Identidade da marca"
        description="Confirme o estilo, a cor e os materiais do seu primeiro post."
      />
      <div className="identity-workbench">
        <section className="workspace-card identity-live-preview" aria-label="Prévia da identidade">
          <h2>Identidade na sua peça</h2>
          <p>
            {data.brand.identityConfirmed
              ? "Identidade confirmada"
              : "Ajustes em andamento · confirme para continuar"}
          </p>
          <img
            alt={`Prévia de identidade de ${data.name || "sua marca"}`}
            src={svgUrl(
              postSvg(
                firstPostBrief(data),
                (data.brand.creative || composeContent(data, "invite")).copy,
                { ...data.brand, visualStyle: selected },
                {
                  approach: data.brand.creative?.approach || "invite",
                  page: 1,
                  total: (data.brand.creative?.slides.length || 0) + 1,
                },
              ),
            )}
          />
          <p>
            Prévia com as cores e materiais atuais. Alterações exigem uma nova aprovação da peça.
          </p>
        </section>
        <div className="identity-controls">
          <VisualStylePicker
            selected={selected}
            recommended={recommendedVisualStyle(data)}
            onSelect={(visualStyle) =>
              onData((current) => ({
                ...current,
                brand: updateBrand(current.brand, { visualStyle }),
              }))
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
      </div>
      <InspirationBoard data={data} onData={onData} />
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
        title="Resultados"
        description="Estados observados neste espaço de trabalho. Publicações e resultados dos canais dependem de dados externos."
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
