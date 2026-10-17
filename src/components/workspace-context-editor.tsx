import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useBlocker } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, FileText, Plus } from "lucide-react";
import { CompactAnswer } from "./brand-onboarding";
import { BrandSources } from "./brand-sources";
import { changeDemoContext, type DemoData } from "@/lib/quick-start";
import { answersSchema, CHAPTERS, hasAnswer, type AnswerKey } from "@/lib/onboarding";
import { markBrandFieldsEdited, updateBrand, profileFingerprint } from "@/lib/brand-preview";
import { referenceFingerprint, replaceBrandReference } from "@/lib/brand-research";
import { sourceIdentity } from "@/lib/brand-sources";
import {
  editWorkspaceAnswers,
  essentialDiagnostic,
  MEASUREMENT_OPTIONS,
} from "@/lib/marketing-workspace";

export function WorkspaceContextEditor({
  data,
  onData,
  onReturn,
  onChapter,
  onReport,
  onIdentity,
  mode = "contexto",
  chapter,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onReturn: () => void;
  onChapter: (chapter?: number) => void;
  onReport?: (() => void) | undefined;
  onHealthStudio?: (() => void) | undefined;
  onIdentity?: (() => void) | undefined;
  mode?: "contexto" | "diagnostico";
  chapter?: number | undefined;
}) {
  const [error, setError] = useState("");
  const [contextStep, setContextStep] = useState(0);
  const [localReport, setLocalReport] = useState(false);
  const [editingLink, setEditingLink] = useState<{ key: string; value: string } | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const progress = essentialDiagnostic(data);
  const activeChapter = mode === "diagnostico" && chapter !== undefined ? CHAPTERS[chapter] : null;
  const contextHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    contextHeading.current?.focus({ preventScroll: true });
  }, [contextStep, activeChapter?.title]);
  const references = referenceFingerprint(data);
  const referencesPending = Boolean(references && references !== data.brand.referencesConfirmed);
  const pendingLink = editingLink !== null || newLink !== null;
  const canConfirm =
    data.name.trim().length >= 2 &&
    data.segment.trim().length >= 2 &&
    data.answers.audience.trim().length >= 3;
  const setupIncomplete =
    pendingLink ||
    referencesPending ||
    !progress.complete ||
    !canConfirm ||
    !!activeChapter?.questions.some(
      (question) => question.required && !hasAnswer(data.answers[question.key]),
    );
  useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: ({ next }) => {
      const search = next.search as Record<string, unknown>;
      const overview =
        next.pathname === "/painel" ||
        next.pathname === "/trilha" ||
        (next.pathname === "/demo" &&
          !search["editar"] &&
          (search["aba"] === "painel" || search["aba"] === "trilha"));
      if (!setupIncomplete || !overview) return false;
      setError("Conclua a configuração antes de voltar. Suas respostas permanecem salvas.");
      return true;
    },
  });
  const edited = (brand: DemoData["brand"], field: string) => markBrandFieldsEdited(brand, [field]);
  const patchBrand = (patch: Parameters<typeof updateBrand>[1]) =>
    onData((current) => ({ ...current, brand: updateBrand(current.brand, patch) }));
  function answer(key: AnswerKey, value: string) {
    setError("");
    onData((current) => editWorkspaceAnswers(current, { ...current.answers, [key]: value }));
  }
  function field(key: AnswerKey, label: string, placeholder = "") {
    return (
      <CompactAnswer
        key={`${key}:${contextStep}`}
        label={label}
        value={data.answers[key]}
        placeholder={placeholder}
        maxLength={answersSchema.shape[key].removeDefault().maxLength ?? 1000}
        onChange={(value) => answer(key, value)}
      />
    );
  }
  function save() {
    if (pendingLink) {
      setError("Salve ou cancele a edição do link antes de continuar.");
      return;
    }
    if (referencesPending) {
      setError("Confira os links e confirme que pertencem à sua marca.");
      return;
    }
    if (!canConfirm || !progress.complete) {
      setError(
        "Complete o nome, a área, o público, a oferta, o objetivo, o principal obstáculo e o indicador antes de gerar a análise.",
      );
      setContextStep(!canConfirm ? 0 : 1);
      return;
    }
    if (
      activeChapter &&
      activeChapter.questions.some(
        (question) => question.required && !hasAnswer(data.answers[question.key]),
      )
    ) {
      setError("Preencha as respostas obrigatórias deste capítulo antes de continuar.");
      return;
    }
    onData((current) => ({
      ...current,
      brand: updateBrand(current.brand, {
        confirmed: true,
        profileConfirmation: profileFingerprint(current),
      }),
    }));
    if (onReport) onReport();
    else setLocalReport(true);
  }
  function changeStep(step: number) {
    if (pendingLink) {
      setError("Salve ou cancele a edição do link antes de mudar de etapa.");
      return;
    }
    if (step > contextStep && (!canConfirm || !hasAnswer(data.answers.offers))) {
      setError("Complete o nome, a área, a oferta e o público antes de avançar.");
      return;
    }
    if (step > contextStep && step > 1 && !progress.complete) {
      setError("Complete o objetivo, o principal obstáculo e o indicador antes de avançar.");
      return;
    }
    setError("");
    setContextStep(step);
  }
  if (localReport)
    return (
      <div className="workspace-page">
        <section className="workspace-card" aria-label="Visão do Cérebro">
          <h1>Seu próximo passo está mais claro.</h1>
          <p>
            Visão do Cérebro · resumo das informações que você confirmou, sem uma nova análise por
            IA.
          </p>
          <dl className="workspace-facts">
            {[
              ["Clínica", data.name],
              ["Objetivo", data.answers.goals],
              ["Público", data.answers.audience],
              ["Prioridade", data.answers.challenge],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <button className="quick-primary" onClick={onIdentity ?? onReturn}>
            Continuar para Identidade <ArrowRight size={18} />
          </button>
        </section>
      </div>
    );
  return (
    <div className="workspace-page context-editor">
      <button
        type="button"
        className="quick-text-button context-back"
        onClick={() => {
          if (setupIncomplete) {
            setError("Conclua a configuração antes de voltar. Suas respostas permanecem salvas.");
            return;
          }
          onReturn();
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      <header className="workspace-page-heading">
        <p className="workspace-eyebrow">{data.name || "SUA MARCA"}</p>
        <h1>
          {activeChapter?.title ??
            (mode === "contexto" ? "Contexto da clínica" : "Diagnóstico da marca")}
        </h1>
        <p>
          {activeChapter
            ? activeChapter.description
            : "Organize a comunicação da sua clínica. Suas respostas e referências anteriores continuam aqui."}
        </p>
      </header>
      {!activeChapter && (
        <nav className="studio-stepper context-stepper" aria-label="Etapas do contexto">
          {["Marca", "Objetivo", "Referências"].map((label, i) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-current={contextStep === i ? "step" : undefined}
              onClick={() => changeStep(i)}
            >
              <span>{i + 1}</span>
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="context-progress">
        <span>
          <Check size={16} /> {progress.completed} de 4 decisões essenciais
        </span>
        <progress aria-label="Diagnóstico essencial" value={progress.completed} max={4} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {activeChapter ? (
          <section className="workspace-card brand-fields">
            {activeChapter.questions.map((question) =>
              field(question.key, question.label, question.placeholder),
            )}
          </section>
        ) : (
          <>
            <section
              className="workspace-card context-section"
              aria-label="Seu objetivo"
              hidden={contextStep !== 1}
            >
              <h2 ref={contextStep === 1 ? contextHeading : undefined} tabIndex={-1}>
                Seu objetivo
              </h2>
              <div className="brand-fields">
                {field(
                  "goals",
                  "O que você quer melhorar?",
                  "Ex.: aumentar os agendamentos de fisioterapia",
                )}
                {field(
                  "challenge",
                  "O que mais dificulta esse resultado hoje?",
                  "Ex.: as pessoas conhecem a clínica, mas poucas entram em contato",
                )}
                <label>
                  O que você quer acompanhar?
                  <select
                    className="quick-input"
                    value={data.strategy.metric}
                    onChange={(event) =>
                      onData((current) => ({
                        ...current,
                        strategy: {
                          ...current.strategy,
                          metric: event.target.value as DemoData["strategy"]["metric"],
                        },
                      }))
                    }
                  >
                    <option value="">Escolher um indicador</option>
                    {MEASUREMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="workspace-note">
                  A medição depende de dados conectados. Escolher um indicador não ativa uma
                  integração.
                </p>
              </div>
            </section>
            <section
              className="workspace-card context-section"
              aria-label="Marca e oferta"
              hidden={contextStep !== 0}
            >
              <h2 ref={contextStep === 0 ? contextHeading : undefined} tabIndex={-1}>
                Marca e oferta
              </h2>
              <div className="brand-fields">
                <div className="context-field-pair">
                  <CompactAnswer
                    key={`name:${contextStep}`}
                    label="Nome da marca"
                    value={data.name}
                    maxLength={120}
                    onChange={(name) =>
                      onData((current) => {
                        const next = changeDemoContext(current, { name });
                        return {
                          ...next,
                          brand: updateBrand(next.brand, edited(next.brand, "name")),
                        };
                      })
                    }
                  />
                  <CompactAnswer
                    key={`segment:${contextStep}`}
                    label="Área de atuação"
                    value={data.segment}
                    maxLength={120}
                    onChange={(segment) =>
                      onData((current) => {
                        const next = changeDemoContext(current, { segment });
                        return {
                          ...next,
                          brand: updateBrand(next.brand, edited(next.brand, "segment")),
                        };
                      })
                    }
                  />
                </div>
                {field("offers", "Oferta prioritária")}
                {field("audience", "Quem você quer alcançar?")}
                <details className="context-audience-details">
                  <summary>Detalhar o público da clínica (opcional)</summary>
                  {field("age", "Faixa etária do público")}
                  {field("location", "Onde seu público está?")}
                  {field("income", "Perfil socioeconômico (opcional)")}
                  {field("interests", "Interesses, necessidades e condições atendidas")}
                  {field(
                    "objections",
                    "Quais dúvidas fazem a pessoa adiar o atendimento?",
                    "Objeções são dúvidas ou motivos para adiar a decisão: preço, tempo ou insegurança sobre o preparo.",
                  )}
                </details>
                <CompactAnswer
                  key={`detail:${contextStep}`}
                  label="Um detalhe importante que vale destacar (opcional)"
                  value={data.brand.detail}
                  maxLength={600}
                  onChange={(detail) =>
                    onData((current) => ({
                      ...current,
                      brand: updateBrand(current.brand, { detail, confirmed: false }),
                    }))
                  }
                />
                {data.brand.offerReviewRequired && (
                  <label className="brand-check">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={(event) => {
                        if (event.target.checked) patchBrand({ offerReviewRequired: false });
                      }}
                    />
                    Conferi a vigência e as condições desta oferta.
                  </label>
                )}
              </div>
            </section>
          </>
        )}
        <section
          className="workspace-card context-section"
          aria-label="Referências da marca"
          hidden={!activeChapter && contextStep !== 2}
        >
          <h2 ref={contextStep === 2 ? contextHeading : undefined} tabIndex={-1}>
            Referências da marca
          </h2>
          <BrandSources
            research={data.brand.research}
            showVerificationNote={false}
            extraLinks={data.brand.extraLinks}
            excludedKeys={data.brand.excludedReferences}
            onRemove={(key) => {
              if (
                data.brand.excludedReferences.length >= 24 &&
                !data.brand.excludedReferences.includes(key)
              ) {
                setError(
                  "O limite de referências removidas foi atingido. Edite um link existente.",
                );
                return;
              }
              patchBrand({
                excludedReferences: [...new Set([...data.brand.excludedReferences, key])],
                referencesConfirmed: "",
                confirmed: false,
              });
            }}
            editor={{
              current: editingLink,
              onStart: (source) => {
                setNewLink(null);
                setEditingLink({ key: source.key, value: source.url });
                setError("");
              },
              onChange: (value) =>
                setEditingLink((current) => (current ? { ...current, value } : null)),
              onCancel: () => {
                setEditingLink(null);
                setError("");
              },
              onSave: () => {
                if (!editingLink) return;
                const result = replaceBrandReference(data, editingLink.key, editingLink.value);
                if (!result.data) {
                  setError(result.error);
                  return;
                }
                onData(result.data);
                setEditingLink(null);
                setError("");
              },
            }}
          />
          {!references && (
            <p className="workspace-note">
              Adicione o site ou os perfis oficiais. Isso não conecta suas contas.
            </p>
          )}
          {newLink !== null ? (
            <div className="context-add-link">
              <label>
                Link oficial
                <input
                  className="quick-input"
                  value={newLink}
                  maxLength={2048}
                  inputMode="url"
                  onChange={(event) => setNewLink(event.target.value)}
                  placeholder="https://"
                />
              </label>
              <button
                type="button"
                className="quick-secondary"
                onClick={() => {
                  const identity = sourceIdentity(newLink);
                  if (!identity) {
                    setError("Informe um link HTTPS válido.");
                    return;
                  }
                  if (data.brand.extraLinks.length >= 12) {
                    setError("Remova um link antes de adicionar outro (limite de 12).");
                    return;
                  }
                  patchBrand({
                    extraLinks: [...new Set([...data.brand.extraLinks, identity.url])],
                    excludedReferences: data.brand.excludedReferences.filter(
                      (key) => key !== identity.key,
                    ),
                    referencesConfirmed: "",
                    confirmed: false,
                  });
                  setNewLink(null);
                  setError("");
                }}
              >
                Adicionar
              </button>
              <button
                type="button"
                className="quick-text-button"
                onClick={() => {
                  setNewLink(null);
                  setError("");
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="quick-text-button"
              disabled={!!editingLink}
              onClick={() => setNewLink("")}
            >
              <Plus size={15} /> Adicionar link
            </button>
          )}
          {references && (
            <label className="brand-check">
              <input
                type="checkbox"
                disabled={pendingLink}
                checked={!referencesPending}
                onChange={(event) => {
                  patchBrand({
                    referencesConfirmed: event.target.checked ? references : "",
                    confirmed: false,
                  });
                  setError("");
                }}
              />
              Conferi os links e confirmo que pertencem à minha marca.
            </label>
          )}
        </section>
        {error && (
          <p role="alert" className="context-error">
            {error}
          </p>
        )}
        {!activeChapter && contextStep < 2 && (
          <div className="studio-next">
            <button
              type="button"
              className="quick-primary"
              onClick={() => changeStep(contextStep + 1)}
            >
              Continuar <ArrowRight size={17} />
            </button>
          </div>
        )}
        <div className="context-save" hidden={!activeChapter && contextStep !== 2}>
          <button
            type="submit"
            className="quick-primary"
            disabled={pendingLink || referencesPending}
          >
            Gerar Análise <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <section className="context-chapters" aria-label="Capítulos do Cérebro">
        <div className="workspace-card-top">
          <h2>Complete os capítulos do Cérebro</h2>
          {activeChapter && (
            <button type="button" className="quick-text-button" onClick={() => onChapter()}>
              Voltar ao essencial
            </button>
          )}
        </div>
        <div className="workspace-chapter-grid">
          {CHAPTERS.map((item, index) => {
            const count = item.questions.filter((q) => hasAnswer(data.answers[q.key])).length;
            return (
              <button
                type="button"
                key={item.title}
                data-complete={count === item.questions.length}
                aria-current={index === chapter ? "step" : undefined}
                onClick={() => {
                  if (
                    pendingLink ||
                    (activeChapter &&
                      index > (chapter ?? 0) &&
                      activeChapter.questions.some(
                        (question) => question.required && !hasAnswer(data.answers[question.key]),
                      ))
                  ) {
                    setError(
                      "Conclua as respostas obrigatórias e salve os links antes de avançar de capítulo.",
                    );
                    return;
                  }
                  onChapter(index);
                }}
              >
                {count === item.questions.length ? <Check size={18} /> : <FileText size={18} />}
                <strong>{item.title}</strong>
                <small>
                  {count} de {item.questions.length} respostas
                </small>
                <ArrowRight size={15} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
