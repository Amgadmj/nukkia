import { useState, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Plus } from "lucide-react";
import { CompactAnswer } from "./brand-onboarding";
import { BrandSources } from "./brand-sources";
import { changeDemoContext, type DemoData } from "@/lib/quick-start";
import { answersSchema, CHAPTERS, hasAnswer, type AnswerKey } from "@/lib/onboarding";
import { markBrandFieldsEdited, updateBrand } from "@/lib/brand-preview";
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
  mode = "contexto",
  chapter,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onReturn: () => void;
  onChapter: (chapter?: number) => void;
  onReport?: (() => void) | undefined;
  mode?: "contexto" | "diagnostico";
  chapter?: number | undefined;
}) {
  const [error, setError] = useState("");
  const [editingLink, setEditingLink] = useState<{ key: string; value: string } | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const progress = essentialDiagnostic(data);
  const activeChapter = mode === "diagnostico" && chapter !== undefined ? CHAPTERS[chapter] : null;
  const references = referenceFingerprint(data);
  const referencesPending = Boolean(references && references !== data.brand.referencesConfirmed);
  const pendingLink = editingLink !== null || newLink !== null;
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
        key={key}
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
    const canConfirm =
      data.name.trim().length >= 2 &&
      data.segment.trim().length >= 2 &&
      data.answers.audience.trim().length >= 3;
    onData((current) => ({
      ...current,
      brand: updateBrand(current.brand, { confirmed: canConfirm }),
    }));
    onReturn();
  }
  return (
    <div className="workspace-page context-editor">
      <button type="button" className="quick-text-button context-back" onClick={onReturn}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <header className="workspace-page-heading">
        <p className="workspace-eyebrow">{data.name || "SUA MARCA"}</p>
        <h1>{activeChapter?.title ?? "Diagnóstico da marca"}</h1>
        <p>
          {activeChapter
            ? activeChapter.description
            : "Defina o que importa para o seu negócio. Suas respostas anteriores já estão aqui."}
        </p>
      </header>
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
            <section className="workspace-card context-section">
              <h2>Seu objetivo</h2>
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
            <section className="workspace-card context-section">
              <h2>Marca e oferta</h2>
              <div className="brand-fields">
                <div className="context-field-pair">
                  <CompactAnswer
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
                <CompactAnswer
                  label="Um detalhe verdadeiro que vale destacar"
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
        <section className="workspace-card context-section">
          <h2>Referências da marca</h2>
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
        <div className="context-save">
          <button
            type="submit"
            className="quick-primary"
            disabled={pendingLink || referencesPending}
          >
            Salvar e voltar <Check size={17} />
          </button>
          <span>Você pode completar o restante depois.</span>
          {onReport && (
            <button
              type="button"
              className="quick-text-button"
              disabled={pendingLink || referencesPending}
              onClick={onReport}
            >
              Revisar para gerar análise <ArrowRight size={16} />
            </button>
          )}
        </div>
      </form>
      <section className="context-chapters" aria-label="Aprofundar diagnóstico">
        <div className="workspace-card-top">
          <h2>Aprofundar diagnóstico</h2>
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
                onClick={() => onChapter(index)}
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
