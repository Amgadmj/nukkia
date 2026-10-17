import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Sparkles, Plus } from "lucide-react";
import { OnboardingMark } from "./quick-start-flow";
import { changeDemoContext, QUICK_GOALS, type DemoData } from "@/lib/quick-start";
import {
  briefIssues,
  updateBrand,
  researchSchema,
  type BrandSuggestion,
} from "@/lib/brand-preview";
import { normalizeWebsite, normalizeInstagram, CHAPTERS } from "@/lib/onboarding";
import {
  completeBrandOnboarding,
  recommendedVisualStyle,
  type VisualStyle,
} from "@/lib/brand-preview";
import { BrandDirection } from "./brand-direction";
import { profileFingerprint, profileConfirmed } from "@/lib/brand-preview";
import { CONTENT_INTENTS, selectedContentIntents, toggleContentIntent } from "@/lib/brand-preview";
import { BrandSources } from "./brand-sources";
import { ResearchSuggestions } from "./research-suggestions";
import {
  referenceFingerprint,
  applyResearchSuggestion,
  allowedSuggestions,
  prepareFreshReading,
  replaceBrandReference,
} from "@/lib/brand-research";
import { groupBrandSources, sourceIdentity } from "@/lib/brand-sources";

const websiteMaxLength = 2048;
const READING_LIMIT_MS = 45_000;
const exampleTextNotice =
  "Encontramos textos de exemplo no site e os excluímos da leitura. Confirme as informações da marca antes de usar.";

export function CompactAnswer({
  label,
  value,
  onChange,
  maxLength = 300,
  placeholder = "",
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight + 2}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [value]);
  return (
    <label>
      {label}
      <textarea
        ref={ref}
        className="quick-input quick-autogrow"
        rows={1}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}

function areaList(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;\n]/)
        .map((area) => area.trim())
        .filter(Boolean),
    ),
  ];
}

function AreaChips({
  value,
  onChange,
  onSuggestion,
}: {
  value: string;
  onChange: (value: string) => void;
  onSuggestion: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const errorId = useId();
  const areas = areaList(value);
  const add = () => {
    const next = areaList(draft);
    const segment = [...new Set([...areas, ...next])].join(", ");
    if (segment.length > 120) {
      setError(
        "As áreas de atuação devem somar até 120 caracteres. Reduza o texto ou remova uma área.",
      );
      return;
    }
    if (next.length) onChange(segment);
    setError("");
    setDraft("");
  };
  return (
    <div className="segment-chip-input" aria-label="Áreas de atuação">
      <div className="quick-input segment-chip-control">
        <div className="segment-chips" aria-live="polite">
          {areas.map((area) => (
            <button
              type="button"
              className="segment-chip"
              key={area}
              onClick={() => onChange(areas.filter((item) => item !== area).join(", "))}
              aria-label={`Remover ${area}`}
            >
              {area} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
        <input
          className="segment-chip-entry"
          aria-label="Adicionar área de atuação"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          placeholder="Digite uma área e pressione Enter"
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            }
            if (event.key === "Backspace" && !draft && areas.length)
              onChange(areas.slice(0, -1).join(", "));
            if (event.key === "Tab" && !draft && !areas.length) onSuggestion();
          }}
          onBlur={add}
        />
      </div>
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BrandOnboarding({
  step: requestedStep,
  data,
  onData,
  onStep,
  onResearch,
  onComplete,
  busy = false,
}: {
  step: number;
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onStep: (step: number) => void;
  onResearch: () => void;
  onComplete?: (data: DemoData) => void;
  busy?: boolean;
}) {
  const step = requestedStep > 1 && !profileConfirmed(data) ? 1 : requestedStep;
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [newLink, setNewLink] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [editingLink, setEditingLink] = useState<{ key: string; value: string } | null>(null);
  const [longWait, setLongWait] = useState(false);
  // Holds the first screen while the site is read, so the next screen opens filled in.
  const [reading, setReading] = useState(false);
  const [choice, setChoice] = useState<VisualStyle | null>(data.brand.visualStyle ?? null);
  const selected = choice ?? recommendedVisualStyle(data);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setRevealed(true),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400,
    );
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    setError("");
    if (revealed) title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step, revealed, data.brand.entrySource]);
  const brand = data.brand;
  const contentIntents = selectedContentIntents(brand);
  const instagramStep = step === 0 && brand.entrySource === "instagram";
  const researchMessage = brand.research.message.replaceAll(exampleTextNotice, "").trim();
  const researching = brand.research.phase
    ? brand.research.phase !== "complete"
    : brand.research.status === "loading";
  useEffect(() => {
    setLongWait(false);
    if (!researching) return;
    const timer = window.setTimeout(() => setLongWait(true), 12000);
    return () => window.clearTimeout(timer);
  }, [brand.research.startedAt, researching]);
  const readingDone =
    brand.research.profile.length > 0 ||
    brand.research.phase === "deepening" ||
    brand.research.phase === "complete" ||
    brand.research.status === "unavailable";
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  useEffect(() => {
    if (reading && (readingDone || step !== 0)) {
      setReading(false);
      if (step === 0) onStepRef.current(1);
    }
  }, [reading, readingDone, step]);
  useEffect(() => {
    if (!reading) return;
    // Never trap the user: after this the form opens and the rest arrives live.
    const timer = window.setTimeout(() => {
      setReading(false);
      onStepRef.current(1);
    }, READING_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, [reading]);
  const references = referenceFingerprint(data);
  const editingReferenceKey = editingLink?.key;
  useEffect(() => {
    if (step !== 1 || (editingReferenceKey && !references.split("|").includes(editingReferenceKey)))
      setEditingLink(null);
    if (step !== 1) {
      setAddingLink(false);
      setNewLink("");
    }
  }, [step, references, editingReferenceKey]);
  const pendingReference = !!editingLink || addingLink;
  const referencesNeedConfirmation = !!references && brand.referencesConfirmed !== references;
  const patch = (value: Parameters<typeof updateBrand>[1]) =>
    onData((current) => ({ ...current, brand: updateBrand(current.brand, value) }));
  const answer = (key: "audience" | "offers" | "goals" | "preferredChannel", value: string) =>
    onData((current) =>
      changeDemoContext(current, { answers: { ...current.answers, [key]: value } }),
    );
  const markEdited = (field: string) =>
    onData((current) => ({
      ...current,
      brand: {
        ...current.brand,
        editedFields: [...new Set([...current.brand.editedFields, field])],
        suggestedFields: current.brand.suggestedFields.filter((item) => item !== field),
      },
    }));
  function applySuggestion(suggestion: BrandSuggestion) {
    if (suggestion.field === "segment") {
      onData((current) => {
        const areas = areaList(current.segment);
        const nextAreas = areas.includes(suggestion.value)
          ? areas.filter((value) => value !== suggestion.value)
          : [...areas, suggestion.value];
        const segment = nextAreas.join(", ");
        if (segment.length > 120) return current;
        const next = changeDemoContext(current, { segment });
        return {
          ...next,
          brand: {
            ...next.brand,
            confirmed: false,
            editedFields: [...new Set([...next.brand.editedFields, "segment"])],
          },
        };
      });
      return;
    }
    onData((current) => applyResearchSuggestion(current, suggestion));
  }
  function suggestions(fields: BrandSuggestion["field"][], asTopic = false) {
    const found = allowedSuggestions(data).filter((item) => fields.includes(item.field));
    if (!found.length) return null;
    const selectedValue =
      fields.length !== 1
        ? undefined
        : fields[0] === "name"
          ? data.name
          : fields[0] === "segment"
            ? data.segment
            : fields[0] === "audience"
              ? data.answers.audience
              : fields[0] === "offers"
                ? data.answers.offers
                : fields[0] === "detail"
                  ? brand.detail
                  : fields[0] === "faq"
                    ? brand.customerQuestion
                    : undefined;
    return (
      <ResearchSuggestions
        compact
        selectedValue={selectedValue}
        selectedValues={fields.includes("segment") ? areaList(data.segment) : undefined}
        suggestions={found.slice(0, fields.includes("segment") ? 6 : 3)}
        onUse={(item) => applySuggestion(asTopic ? { ...item, field: "offers" } : item)}
        confirmedValue={
          fields.includes("offers") && !brand.offerReviewRequired ? data.answers.offers : undefined
        }
      />
    );
  }
  const firstSuggestion = (field: BrandSuggestion["field"]) =>
    allowedSuggestions(data).find((item) => item.field === field);
  const acceptSuggestionOnTab = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: BrandSuggestion["field"],
    value: string,
  ) => {
    if (event.key !== "Tab" || value.trim()) return;
    const suggestion = firstSuggestion(field);
    if (suggestion) applySuggestion(suggestion);
  };
  function next() {
    if (step === 0) {
      if (instagramStep) {
        try {
          const instagram = data.answers.instagram.trim()
            ? normalizeInstagram(data.answers.instagram)
            : "";
          if (
            instagram &&
            brand.extraLinks.filter((link) => sourceIdentity(link)?.kind !== "Instagram").length >=
              12
          ) {
            setError(
              "Você já tem 12 referências. Remova uma em Contexto antes de adicionar o Instagram.",
            );
            return;
          }
          onData((current) => ({
            ...current,
            answers: { ...current.answers, instagram },
            brand: updateBrand(current.brand, {
              extraLinks: [
                ...current.brand.extraLinks.filter(
                  (link) => sourceIdentity(link)?.kind !== "Instagram",
                ),
                ...(instagram ? [`https://instagram.com/${instagram.slice(1)}`] : []),
              ],
              referencesConfirmed: "",
            }),
          }));
        } catch {
          setError("Informe o @perfil da empresa, como @suaclinica.");
          return;
        }
      } else {
        try {
          normalizeWebsite(brand.referenceUrl);
        } catch {
          setError("Informe um site como suaclinica.com.br ou escolha Não tenho site.");
          return;
        }
      }
      if (brand.referenceUrl.trim() && !brand.siteAuthorized) {
        setError("Confirme o site e a autorização de análise para continuar.");
        return;
      }
      // Back/Continue is navigation, not permission to discard or restart a scan.
      // Editing/removing the URL already invalidates research at the input boundary.
      if (brand.research.status !== "idle" || brand.research.phase) {
        onStep(1);
        return;
      }
      // A new reading may refill fields that were filled, then cleared, before.
      onData(prepareFreshReading);
      onResearch();
      // Without a site and AI consent there is nothing to wait for.
      if (brand.referenceUrl.trim() && brand.aiAuthorized) setReading(true);
      else onStep(1);
      return;
    }
    if (step === 1) {
      if (researching) {
        setError("Aguarde o processamento do perfil antes de confirmar.");
        return;
      }
      if (pendingReference) {
        setError("Salve ou cancele a edição do link antes de continuar.");
        return;
      }
      if (referencesNeedConfirmation) {
        setError("Confira e confirme as referências da sua marca antes de continuar.");
        return;
      }
      if (
        data.name.trim().length < 2 ||
        data.segment.trim().length < 2 ||
        data.answers.audience.trim().length < 3
      ) {
        setError("Conte o nome, a área e quem você quer alcançar.");
        return;
      }
      patch({ confirmed: true, profileConfirmation: profileFingerprint(data) });
      if (!data.answers.goals) answer("goals", "Atrair novos clientes");
      onStep(2);
      return;
    }
    if (!profileConfirmed(data)) {
      setError("Confirme o nome, as áreas e o público da clínica antes de continuar.");
      onStep(1);
      return;
    }
    // Offer confirmation happens in the Brain/catalog, not in the intent picker.
    // Content creation still enforces the complete factual brief there.
    const issues = briefIssues(data).filter(
      (issue) => issue !== "Escolha ou descreva a oferta que vamos apresentar.",
    );
    if (references && brand.referencesConfirmed !== references) {
      onStep(1);
      return;
    }
    if (issues.length) {
      setError(issues[0]!);
      return;
    }
    if (step === 2) {
      if (!contentIntents.length) {
        setError("Selecione pelo menos um tipo de conteúdo.");
        return;
      }
      onStep(3);
      return;
    }
    const completed = completeBrandOnboarding(data, selected);
    onData(completed);
    if (onComplete) onComplete(completed);
    else onStep(6);
  }
  return (
    <div className="quick-onboarding" data-revealed={revealed}>
      <div className="quick-floating-logo">
        <OnboardingMark />
        <p className="quick-logo-greeting">Nukkia</p>
      </div>
      <main
        className={`quick-question brand-question${step === 3 ? " brand-recommendation-question" : ""}`}
        inert={!revealed}
      >
        <div className="quick-progress-row">
          <div className="quick-question-meta">
            <button
              className="quick-back"
              onClick={() => (instagramStep ? patch({ entrySource: "website" }) : onStep(step - 1))}
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          </div>
          <div
            className="quick-segments"
            role="progressbar"
            aria-label="Preparação da clínica"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={step + 1}
          >
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                data-state={index === step ? "current" : index < step ? "complete" : "future"}
              />
            ))}
          </div>
        </div>
        <h1 ref={title} tabIndex={-1}>
          {instagramStep
            ? "Qual é o Instagram da sua empresa?"
            : [
                "Onde podemos conhecer sua clínica?",
                "Vamos dar contexto à sua clínica.",
                "O que vamos comunicar primeiro?",
                "Sistema da marca",
              ][step]}
        </h1>
        {step === 0 && (
          <p className="quick-hint">
            {instagramStep
              ? "Guarde o perfil e conte um pouco sobre sua empresa."
              : "Informe seu site para reunir referências no Cérebro. Português do Brasil."}
          </p>
        )}
        {step === 3 && (
          <p className="quick-hint">
            Revise a paleta, a tipografia e o uso do logo antes de criar conteúdo.
          </p>
        )}
        <form
          className="brand-fields"
          onSubmit={(event) => {
            event.preventDefault();
            next();
          }}
        >
          {step === 0 && !instagramStep && (
            <>
              <label>
                Site da sua clínica
                <input
                  className="quick-input"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="suaclinica.com.br"
                  maxLength={websiteMaxLength}
                  value={brand.referenceUrl}
                  onChange={(event) => {
                    let website = event.target.value.slice(0, websiteMaxLength);
                    try {
                      website = normalizeWebsite(website);
                    } catch {
                      /* Keep in-progress domain entry editable. */
                    }
                    onData((current) => {
                      const next = changeDemoContext(current, {
                        answers: { ...current.answers, website: website.slice(0, 200) },
                      });
                      return {
                        ...next,
                        brand: updateBrand(next.brand, {
                          referenceUrl: website,
                          confirmed: false,
                          siteAuthorized: false,
                          aiAuthorized: false,
                          referencesConfirmed: "",
                          research:
                            website.trim() === current.brand.referenceUrl.trim()
                              ? current.brand.research
                              : researchSchema.parse({}),
                        }),
                      };
                    });
                  }}
                />
              </label>
              {brand.referenceUrl.trim() && (
                <>
                  <label className="research-check">
                    <input
                      type="checkbox"
                      checked={brand.siteAuthorized}
                      onChange={(e) => patch({ siteAuthorized: e.target.checked })}
                    />
                    <span>Este é o site da minha clínica. Autorizo a análise.</span>
                  </label>
                  <label className="research-check">
                    <input
                      type="checkbox"
                      aria-describedby="brand-data-use"
                      checked={brand.aiAuthorized}
                      onChange={(e) => patch({ aiAuthorized: e.target.checked })}
                    />
                    <span>Analisar meu site com IA e personalizar minhas sugestões.</span>
                  </label>
                  <details className="brand-source-details" id="brand-data-use">
                    <summary>Como usamos seus dados</summary>
                    <p>
                      A IA é opcional. Se você autorizar, enviamos à Anthropic trechos públicos do
                      site para sugerir o contexto e a comunicação da sua marca e pré-preencher as
                      perguntas do diagnóstico. Esse processamento pode ocorrer fora do Brasil. Você
                      pode desmarcar a opção para interromper novos envios; isso não desfaz envios
                      já realizados.
                    </p>
                    <p>
                      Sem IA, você pode continuar com a leitura do site e o preenchimento manual,
                      sem enviar trechos à Anthropic. Evite sites ou textos com dados pessoais, de
                      pacientes ou depoimentos. Aplicamos filtros para reduzir esses dados, mas eles
                      não garantem anonimização.
                    </p>
                    <p>
                      Começamos por até oito páginas prioritárias e identificamos os perfis
                      vinculados. A análise pode continuar enquanto você avança. Encontrar um perfil
                      não significa analisar suas publicações.
                    </p>
                    <a href="/privacidade" target="_blank" rel="noreferrer">
                      Política de privacidade
                    </a>
                  </details>
                </>
              )}
            </>
          )}
          {instagramStep && (
            <>
              <label>
                Instagram da empresa
                <input
                  className="quick-input"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="@suaclinica"
                  maxLength={100}
                  value={data.answers.instagram}
                  onChange={(event) =>
                    onData((current) => ({
                      ...current,
                      answers: { ...current.answers, instagram: event.target.value },
                    }))
                  }
                />
              </label>
              <CompactAnswer
                label="Bio ou apresentação da empresa"
                maxLength={8000}
                placeholder="Cole a bio e descreva seus serviços…"
                value={brand.material}
                onChange={(material) => patch({ material, confirmed: false })}
              />
              <p className="brand-microcopy">
                O perfil fica salvo como referência; não lemos as publicações do Instagram. Cole a
                bio para completar o contexto. Não inclua dados de pacientes.
              </p>
              <button
                className="quick-secondary"
                type="button"
                onClick={() => {
                  onData((current) => ({
                    ...current,
                    answers: { ...current.answers, instagram: "" },
                    brand: updateBrand(current.brand, {
                      extraLinks: current.brand.extraLinks.filter(
                        (link) => sourceIdentity(link)?.kind !== "Instagram",
                      ),
                      referencesConfirmed: "",
                    }),
                  }));
                  onStep(1);
                }}
              >
                Não tenho Instagram
              </button>
            </>
          )}
          {((step > 0 && step < 3) || reading) && (
            <>
              {!researching &&
                brand.research.status === "ready" &&
                brand.research.sources.some((source) => source.url !== "material:fornecido") && (
                  <div className="research-progress" role="status">
                    <p className="brand-research-status">
                      <Check size={15} /> Leitura concluída ·{" "}
                      {
                        brand.research.sources.filter(
                          (source) => source.url !== "material:fornecido",
                        ).length
                      }{" "}
                      {brand.research.sources.filter(
                        (source) => source.url !== "material:fornecido",
                      ).length === 1
                        ? "página no Cérebro"
                        : "páginas no Cérebro"}
                    </p>
                    <p>Revise as referências e as sugestões antes de confirmar sua marca.</p>
                  </div>
                )}
              {researching && (
                <div className="research-progress" role="status" aria-live="polite">
                  <p className="brand-research-status">
                    <LoaderCircle className="brand-spin" size={15} />
                    {brand.research.phase === "deepening"
                      ? "Aprofundando o contexto em segundo plano…"
                      : brand.research.phase === "synthesizing"
                        ? "Preparando recomendações…"
                        : "Conhecendo sua marca…"}
                  </p>
                  {brand.research.sources.length > 0 && (
                    <p>
                      <Check size={13} /> Site encontrado · {brand.research.sources.length} páginas
                      lidas
                    </p>
                  )}
                  {groupBrandSources(brand.research).filter(
                    (g) => g.kind !== "Site" && g.kind !== "Texto",
                  ).length > 0 && (
                    <p>
                      <Check size={13} />{" "}
                      {groupBrandSources(brand.research)
                        .filter((g) => g.kind !== "Site" && g.kind !== "Texto")
                        .map((g) => g.kind)
                        .join(" e ")}{" "}
                      encontrados
                    </p>
                  )}
                  {brand.research.suggestions.filter((s) => s.field === "offers").length > 0 && (
                    <p>
                      <Check size={13} />{" "}
                      {brand.research.suggestions.filter((s) => s.field === "offers").length}{" "}
                      sugestões de oferta preparadas
                    </p>
                  )}
                  <small>
                    {longWait
                      ? "Está levando um pouco mais. As evidências recebidas estão preservadas; aguarde a revisão do perfil."
                      : "Ao concluir, mostraremos nome, áreas e público juntos para sua confirmação."}
                  </small>
                </div>
              )}
              {researchMessage && (
                <p className="brand-microcopy" role="status">
                  {researchMessage}
                </p>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <BrandSources
                research={brand.research}
                showVerificationNote={false}
                showResearchDocument={false}
                extraLinks={brand.extraLinks}
                excludedKeys={brand.excludedReferences}
                editor={{
                  current: editingLink,
                  onStart: (source) => {
                    setAddingLink(false);
                    setError("");
                    setEditingLink({ key: source.key, value: source.url });
                  },
                  onChange: (value) =>
                    setEditingLink(editingLink ? { ...editingLink, value } : null),
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
                    if (result.data.brand.referenceUrl !== brand.referenceUrl) onStep(0);
                  },
                }}
                onRemove={(key) =>
                  patch({
                    excludedReferences: [...brand.excludedReferences, key],
                    referencesConfirmed: "",
                    confirmed: false,
                  })
                }
              />
              <div className="research-reference-actions">
                <button
                  type="button"
                  className="quick-text-button"
                  disabled={!!editingLink}
                  onClick={() => setAddingLink(!addingLink)}
                >
                  <Plus size={14} /> Adicionar link
                </button>
                <button
                  type="button"
                  className="quick-text-button"
                  onClick={onResearch}
                  disabled={researching || !brand.siteAuthorized || pendingReference}
                >
                  Analisar novamente
                </button>
              </div>
              {addingLink && (
                <div className="research-add-link">
                  <input
                    className="quick-input"
                    type="url"
                    aria-label="Outro link da marca"
                    placeholder="https://instagram.com/suamarca"
                    value={newLink}
                    maxLength={2048}
                    onChange={(e) => setNewLink(e.target.value)}
                  />
                  <button
                    type="button"
                    className="quick-text-button"
                    onClick={() => {
                      const identity = sourceIdentity(newLink.trim());
                      if (!identity) {
                        setError("Informe um link HTTPS válido.");
                        return;
                      }
                      if (brand.extraLinks.length >= 12) {
                        setError("Limite de 12 links adicionais.");
                        return;
                      }
                      patch({
                        extraLinks: [...new Set([...brand.extraLinks, identity.url])],
                        excludedReferences: brand.excludedReferences.filter(
                          (k) => k !== identity.key,
                        ),
                        referencesConfirmed: "",
                        confirmed: false,
                      });
                      setNewLink("");
                      setAddingLink(false);
                      setError("");
                    }}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="quick-text-button"
                    onClick={() => {
                      setAddingLink(false);
                      setNewLink("");
                      setError("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
              {references && (
                <label className="research-check">
                  <input
                    type="checkbox"
                    disabled={pendingReference}
                    checked={brand.referencesConfirmed === references}
                    onChange={(e) =>
                      patch({
                        referencesConfirmed: e.target.checked ? references : "",
                        confirmed: false,
                      })
                    }
                  />
                  <span>Conferi os links e confirmo que pertencem à minha clínica.</span>
                </label>
              )}
              {brand.suggestedFields.length > 0 && (
                <p className="research-ai-label">
                  <Sparkles size={13} />{" "}
                  {brand.research.synthesis === "ready"
                    ? "Sugestões do site e da IA"
                    : "Sugerido a partir do site"}{" "}
                  · confira e edite os campos abaixo.
                </p>
              )}
              {researching ? (
                <p role="status">
                  Processando nome, áreas de atuação e público da clínica… As sugestões aparecerão
                  juntas para sua revisão.
                </p>
              ) : (
                <>
                  <p>
                    Revise os três campos. Ao continuar, você confirma o perfil que será usado nas
                    próximas etapas.
                  </p>
                  <div className="brand-field-pair">
                    <div className="clinic-name-field">
                      <label>
                        Nome da clínica
                        <input
                          className="quick-input"
                          maxLength={120}
                          value={data.name}
                          onChange={(event) => {
                            onData((current) =>
                              changeDemoContext(current, { name: event.target.value }),
                            );
                            markEdited("name");
                          }}
                          onKeyDown={(event) => acceptSuggestionOnTab(event, "name", data.name)}
                        />
                      </label>
                      {suggestions(["name"])}
                    </div>
                    <div className="clinic-areas-field">
                      <label>
                        Áreas de atuação
                        <AreaChips
                          value={data.segment}
                          onChange={(segment) => {
                            onData((current) => changeDemoContext(current, { segment }));
                            markEdited("segment");
                          }}
                          onSuggestion={() => {
                            const suggestion = firstSuggestion("segment");
                            if (suggestion) applySuggestion(suggestion);
                          }}
                        />
                      </label>
                      {suggestions(["segment"])}
                    </div>
                  </div>
                  <CompactAnswer
                    label="Quem você quer alcançar?"
                    placeholder="Ex.: pessoas que buscam se movimentar com orientação"
                    value={data.answers.audience}
                    onChange={(value) => {
                      answer("audience", value);
                      markEdited("audience");
                    }}
                    onKeyDown={(event) =>
                      acceptSuggestionOnTab(event, "audience", data.answers.audience)
                    }
                  />
                  {suggestions(["audience"])}
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <fieldset className="content-intent-picker">
                <legend>Que tipo de conteúdo você quer criar?</legend>
                <p>Selecione suas prioridades. A ordem de seleção define o que vem primeiro.</p>
                <div className="content-intent-grid">
                  {CONTENT_INTENTS.map(({ value, label, description, icon }) => (
                    <button
                      type="button"
                      aria-pressed={contentIntents.includes(value)}
                      className="content-intent-card"
                      data-intent={value}
                      data-selected={contentIntents.includes(value)}
                      key={value}
                      onClick={() =>
                        onData((current) => {
                          const next = updateBrand(
                            current.brand,
                            toggleContentIntent(current.brand, value),
                          );
                          return {
                            ...current,
                            brand: next,
                            answers: {
                              ...current.answers,
                              goals:
                                !current.answers.goals ||
                                QUICK_GOALS.some((goal) => goal.value === current.answers.goals)
                                  ? {
                                      service: "Lançar uma oferta",
                                      explain: "Educar meus pacientes",
                                      trust: "Fortalecer minha marca",
                                      booking: "Receber mais agendamentos",
                                    }[selectedContentIntents(next)[0] ?? "service"]
                                  : current.answers.goals,
                            },
                          };
                        })
                      }
                    >
                      {contentIntents.includes(value) && (
                        <span
                          className="content-intent-priority"
                          aria-label={`Prioridade ${contentIntents.indexOf(value) + 1}`}
                        >
                          {contentIntents.indexOf(value) + 1}
                        </span>
                      )}
                      <span className="content-intent-icon" aria-hidden="true">
                        {icon}
                      </span>
                      <strong>{label}</strong>
                      <span>{description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <CompactAnswer
                label="Um detalhe importante que vale destacar (opcional)"
                maxLength={600}
                placeholder="Ex.: turmas de até quatro pessoas, com acompanhamento próximo"
                value={brand.detail}
                onChange={(detail) => patch({ detail })}
              />
              {suggestions(["detail"])}
              {(brand.offerReviewRequired || brand.selectedOfferKind) && (
                <label className="research-check">
                  <input
                    type="checkbox"
                    checked={!brand.offerReviewRequired}
                    onChange={(e) => patch({ offerReviewRequired: !e.target.checked })}
                  />
                  <span>
                    Confirmei a vigência, os detalhes e as condições da oferta. Para serviços de
                    saúde, revisei também as regras profissionais aplicáveis.
                  </span>
                </label>
              )}
              <section className="patient-questions" aria-label="Dúvidas dos pacientes">
                <h2>O que seus pacientes costumam perguntar? (opcional)</h2>
                <CompactAnswer
                  label="Uma dúvida que você costuma ouvir"
                  maxLength={240}
                  value={brand.customerQuestion}
                  onChange={(customerQuestion) => patch({ customerQuestion })}
                  placeholder="Ex.: preciso ter experiência para começar?"
                />
                {suggestions(["faq"])}
                <label>
                  Canal preferido de atendimento
                  <select
                    className="quick-input"
                    value={data.answers.preferredChannel}
                    onChange={(event) => answer("preferredChannel", event.target.value)}
                  >
                    <option value="">Escolher um canal (opcional)</option>
                    {[
                      ...new Set([
                        ...(CHAPTERS.flatMap((chapter) => chapter.questions).find(
                          (question) => question.key === "preferredChannel",
                        )?.options ?? []),
                        ...(data.answers.preferredChannel ? [data.answers.preferredChannel] : []),
                      ]),
                    ].map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </>
          )}
          {step === 3 && (
            <BrandDirection
              data={data}
              selected={selected}
              onSelect={(style) => {
                setChoice(style);
                patch({ visualStyle: style });
              }}
              onAccent={(accent) => patch({ accent })}
              onIdentity={(identityEdits) => patch({ identityEdits })}
              onLogo={(logo) =>
                onData((current) =>
                  current.brand.referenceUrl === brand.referenceUrl
                    ? {
                        ...current,
                        brand: updateBrand(current.brand, {
                          logo,
                          assetSource: "",
                          identityConfirmed: false,
                        }),
                      }
                    : current,
                )
              }
              onCorrect={() => onStep(1)}
            />
          )}
          {error && (
            <p className="brand-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="quick-primary"
            type="submit"
            disabled={
              busy ||
              reading ||
              (step === 1 && (researching || pendingReference || referencesNeedConfirmation)) ||
              (step === 2 && (!contentIntents.length || !profileConfirmed(data)))
            }
          >
            {busy
              ? "Preparando seu espaço…"
              : reading
                ? "Lendo seu site…"
                : step === 0
                  ? "Continuar"
                  : step === 1
                    ? "Confirmar perfil da clínica"
                    : step === 2
                      ? "Ver sistema da marca"
                      : "Ir para meu painel"}
            <ArrowRight size={16} />
          </button>
          {reading && (
            <button
              className="quick-skip"
              type="button"
              onClick={() => {
                setReading(false);
                onStep(1);
              }}
            >
              Preencher manualmente agora
            </button>
          )}
          {step === 0 && !instagramStep && !reading && (
            <button
              className="quick-skip"
              type="button"
              onClick={() => {
                setError("");
                onData((current) => ({
                  ...changeDemoContext(current, { answers: { ...current.answers, website: "" } }),
                  brand: updateBrand(current.brand, {
                    entrySource: "instagram",
                    referenceUrl: "",
                    siteAuthorized: false,
                    aiAuthorized: false,
                    research: researchSchema.parse({}),
                    referencesConfirmed: "",
                  }),
                }));
              }}
            >
              Não tenho site
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
