import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  BrainCircuit,
  Loader2,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import {
  CHAPTERS,
  ESSENTIAL_QUESTIONS,
  answersSchema,
  chapterMissing,
  hasAnswer,
  normalizeAnswers,
  type AnswerKey,
  type Answers,
} from "@/lib/onboarding";
import { useDraft, useDraftSync, saveDraft, removeDraft } from "@/lib/onboarding-draft";
import type { Company, CompanyResearch } from "@/lib/company";
import { cn } from "@/lib/utils";

export function DiagnosticWizard({
  company,
  previousAnswers,
  initialStep,
  onComplete,
  onChapterChange,
  onAnswersChange,
  suggestedKeys,
}: {
  company: Company;
  previousAnswers: unknown;
  initialStep: number | undefined;
  onComplete: () => void;
  onChapterChange?: (step: number) => void;
  onAnswersChange?: (answers: Answers) => void;
  /** Answers prefilled from the brand research and not edited since. */
  suggestedKeys?: AnswerKey[];
}) {
  const workspaceMode = Boolean(onAnswersChange);
  const draft = useDraft(workspaceMode ? "" : company.owner_id, workspaceMode ? "" : company.id);
  const sync = useDraftSync(workspaceMode ? "" : company.owner_id, workspaceMode ? "" : company.id);
  const research = company.research?.draft;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const [answers, setAnswers] = useState<Answers>(
    () =>
      (workspaceMode ? normalizeAnswers(previousAnswers) : draft?.answers) ??
      normalizeAnswers({
        website: company.website ?? "",
        instagram: company.instagram_handle ?? "",
        linkedin: company.linkedin_url ?? "",
        audience: research?.publico_alvo ?? "",
        market: research?.mercado_concorrencia ?? "",
        differentials: research?.diferenciais_provaveis ?? "",
        goals: research?.objetivos_provaveis ?? "",
        ...(previousAnswers && typeof previousAnswers === "object" ? previousAnswers : {}),
      }),
  );
  const [step, setStep] = useState(() => initialStep ?? draft?.step ?? 0);
  useEffect(() => {
    if (!workspaceMode) return;
    const next = normalizeAnswers(previousAnswers);
    setAnswers((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, [previousAnswers, workspaceMode]);
  useEffect(() => {
    if (initialStep !== undefined) setStep(initialStep);
  }, [initialStep]);
  useEffect(() => {
    onChapterChange?.(step);
  }, [step, onChapterChange]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [saved, setSaved] = useState(Boolean(draft));
  const displayedDraft = useRef(draft);
  // The store reconciles cloud/local versions before publishing. Hydrate only
  // actual changes, so acknowledgement of a save does not disrupt typing.
  useEffect(() => {
    const chapterChanged = displayedDraft.current?.step !== draft?.step;
    displayedDraft.current = draft;
    if (!draft || workspaceMode) return;
    setAnswers((current) =>
      JSON.stringify(current) === JSON.stringify(draft.answers) ? current : draft.answers,
    );
    if (initialStep === undefined && chapterChanged) setStep(draft.step);
    setSaved(true);
  }, [draft, initialStep, workspaceMode]);
  const [aiKeys, setAiKeys] = useState<AnswerKey[]>(() =>
    !draft && !previousAnswers && research
      ? ["audience", "market", "differentials", "goals"]
      : (suggestedKeys ?? []),
  );
  const chapter = CHAPTERS[step]!;
  const essentialDone = ESSENTIAL_QUESTIONS.filter((q) => hasAnswer(answers[q.key])).length;

  function persist(next: Answers, nextStep: number) {
    if (onAnswersChange) {
      onAnswersChange(next);
      return;
    }
    const success = saveDraft(company.owner_id, company.id, next, nextStep);
    setStorageFailed(!success);
    setSaved(success);
  }
  function change(key: AnswerKey, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setAiKeys((keys) => keys.filter((k) => k !== key));
    persist(next, step);
    setError("");
  }
  function goTo(next: number) {
    setStep(next);
    setError("");
    persist(answers, next);
    if (onChapterChange) onChapterChange(next);
    else void navigate({ to: "/diagnostico", search: { etapa: next }, replace: true });
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "center" });
    });
  }
  async function suggest() {
    setSuggesting(true);
    setError("");
    try {
      const response = await apiFetch("/api/pesquisa-empresa", { companyId: company.id });
      if (!response.ok) throw new Error((await response.text()).slice(0, 180));
      const { research: result } = (await response.json()) as { research: CompanyResearch };
      const suggestions: Partial<Answers> = {
        audience: result.draft?.publico_alvo,
        market: result.draft?.mercado_concorrencia,
        differentials: result.draft?.diferenciais_provaveis,
        goals: result.draft?.objetivos_provaveis,
      } as Partial<Answers>;
      const filled: AnswerKey[] = [];
      const next = { ...answers };
      for (const key of Object.keys(suggestions) as AnswerKey[]) {
        if (!hasAnswer(next[key]) && suggestions[key]) {
          next[key] = suggestions[key]!.slice(0, 1000);
          filled.push(key);
        }
      }
      setAnswers(next);
      setAiKeys(filled);
      persist(next, step);
      toast.success(
        filled.length
          ? "Sugestões adicionadas aos campos vazios. Revise antes de gerar."
          : "Suas respostas foram preservadas; nenhum campo vazio para sugerir.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível sugerir respostas. Tente novamente.",
      );
    } finally {
      setSuggesting(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || suggesting) return;
    if (sync.status === "conflict") {
      setError("Escolha qual rascunho usar antes de continuar.");
      return;
    }
    if (chapterMissing(step, answers).length) {
      setError("Preencha as respostas essenciais desta etapa para continuar.");
      return;
    }
    if (step < CHAPTERS.length - 1) {
      goTo(step + 1);
      return;
    }
    const missingIndex = CHAPTERS.findIndex(
      (_, index) => chapterMissing(index, answers).length > 0,
    );
    if (missingIndex >= 0) {
      goTo(missingIndex);
      setError("Falta uma resposta essencial aqui. Complete para gerar seu diagnóstico.");
      return;
    }
    const parsed = answersSchema.safeParse(answers);
    if (!parsed.success) {
      setError("Revise o tamanho das respostas antes de continuar.");
      return;
    }
    setSaving(true);
    setError("");
    persist(answers, step);
    try {
      const response = await apiFetch("/api/diagnostico", {
        companyId: company.id,
        answers: parsed.data,
      });
      if (!response.ok)
        throw new Error(
          (await response.text()).slice(0, 240) || "Não foi possível gerar o diagnóstico.",
        );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["diagnostic", company.id] }),
        queryClient.invalidateQueries({ queryKey: ["missions", company.id] }),
        queryClient.invalidateQueries({ queryKey: ["company"] }),
      ]);
      const cleared = workspaceMode || (await removeDraft(company.owner_id, company.id));
      if (!cleared && sync.reason !== "schema-unavailable") {
        toast.info("Diagnóstico salvo. A limpeza do rascunho da conta ainda está pendente.");
      }
      toast.success("Seu diagnóstico está pronto. Próxima conquista: identidade da marca.");
      onComplete();
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "Não foi possível gerar o diagnóstico.") +
          " Suas respostas continuam aqui para tentar novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  function useCloudDraft() {
    const cloud = sync.remote?.draft;
    setAnswers(cloud?.answers ?? normalizeAnswers(previousAnswers));
    setStep(cloud?.step ?? 0);
    sync.resolveConflict("remote");
  }

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-9 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <BrainCircuit className="size-4 text-primary" />
          FUNDAÇÃO DA MARCA
        </span>
        <span className="text-xs text-muted-foreground">
          {essentialDone}/{ESSENTIAL_QUESTIONS.length} respostas essenciais
        </span>
      </div>
      <nav aria-label="Etapas do diagnóstico" className="mb-12 grid grid-cols-5 gap-2 sm:gap-4">
        {CHAPTERS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => goTo(index)}
            disabled={saving || suggesting}
            aria-current={step === index ? "step" : undefined}
            aria-label={`Etapa ${index + 1}: ${item.title}`}
            className="text-left"
          >
            <span
              className={cn(
                "mb-3 block h-1 rounded-full",
                step === index ? "bg-primary" : index < step ? "bg-primary/40" : "bg-white/10",
              )}
            />
            <span
              className={cn(
                "text-[10px] sm:text-xs",
                step === index ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="hidden sm:inline">{item.title}</span>
            </span>
          </button>
        ))}
      </nav>
      <div className="mx-auto max-w-[620px]">
        <p className="mb-3 text-xs font-medium text-primary">
          ETAPA {step + 1} DE {CHAPTERS.length} · {chapter.title.toUpperCase()}
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-semibold leading-[1.18] tracking-tight outline-none sm:text-[38px]"
        >
          {chapter.headline}
        </h1>
        <p className="mb-8 mt-4 text-sm leading-7 text-muted-foreground">{chapter.description}</p>
        <form onSubmit={submit} className="space-y-6">
          <fieldset disabled={saving || suggesting} className="space-y-5">
            {chapter.questions.map((question) => (
              <div key={question.key} className="space-y-2.5">
                <Label
                  htmlFor={question.key}
                  className="flex flex-wrap items-center gap-2 text-[13px] font-medium"
                >
                  {question.label}
                  {question.required && (
                    <span className="text-[10px] font-normal text-primary">Essencial</span>
                  )}
                  {aiKeys.includes(question.key) && (
                    <span className="text-[10px] text-amber-300">Sugestão da IA · revise</span>
                  )}
                </Label>
                {question.options ? (
                  <select
                    id={question.key}
                    value={answers[question.key]}
                    onChange={(event) => change(question.key, event.target.value)}
                    className="w-full rounded-xl border border-input px-3 py-3 text-sm"
                  >
                    <option value="">Selecione, se souber</option>
                    {question.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : question.short ? (
                  <Input
                    id={question.key}
                    value={answers[question.key]}
                    onChange={(event) => change(question.key, event.target.value)}
                    placeholder={question.placeholder}
                    maxLength={
                      question.key === "instagram"
                        ? 100
                        : question.key === "city" || question.key === "ticket"
                          ? 120
                          : question.key === "state"
                            ? 60
                            : question.key === "googleBusiness"
                              ? 300
                              : question.key === "hours" || question.key === "location"
                                ? 1000
                                : 200
                    }
                    className="h-12 rounded-xl"
                    required={question.required}
                  />
                ) : (
                  <Textarea
                    id={question.key}
                    value={answers[question.key]}
                    onChange={(event) => change(question.key, event.target.value)}
                    placeholder={question.placeholder}
                    required={question.required}
                    maxLength={1000}
                    className="min-h-[105px] resize-y rounded-xl p-3.5 leading-relaxed"
                  />
                )}
              </div>
            ))}
          </fieldset>
          {step === 0 && (
            <p className="text-xs leading-6 text-muted-foreground">
              Informar um link dá contexto ao diagnóstico. A conexão com uma rede social é feita na
              seção Canais.
            </p>
          )}
          {step === 1 &&
            Boolean(company.website || company.instagram_handle || company.linkedin_url) && (
              <Button
                type="button"
                variant="outline"
                disabled={suggesting || saving}
                onClick={suggest}
              >
                <Wand2 className="size-4" />
                {suggesting ? "Buscando sugestões…" : "Sugerir campos vazios com IA"}
              </Button>
            )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-400/25 bg-red-400/8 p-4 text-sm text-red-200"
            >
              {error}
            </p>
          )}
          {sync.status === "conflict" && (
            <div
              role="alert"
              className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm"
            >
              <p className="font-medium">Há outro rascunho na sua conta.</p>
              <p className="text-xs leading-6 text-muted-foreground">
                As duas versões foram preservadas. Escolha qual deve substituir a outra antes de
                continuar.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => sync.resolveConflict("local")}
                >
                  Manter minhas respostas
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={useCloudDraft}>
                  Usar respostas da conta
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium">O que estamos construindo</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {chapter.outcome}. Suas respostas serão usadas no relatório e nas missões da marca.
              </p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving || suggesting}
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Construindo seu diagnóstico…
              </>
            ) : step === 4 ? (
              <>
                Gerar meu diagnóstico
                <BrainCircuit className="size-4" />
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 text-xs text-muted-foreground">
            {step > 0 ? (
              <button
                type="button"
                disabled={saving || suggesting}
                onClick={() => goTo(step - 1)}
                className="flex min-h-10 items-center gap-2"
              >
                <ArrowLeft className="size-3.5" />
                Voltar
              </button>
            ) : (
              <Link to="/painel" className="flex min-h-10 items-center gap-2">
                <ArrowLeft className="size-3.5" />
                Painel
              </Link>
            )}
            {!workspaceMode && (
              <span aria-live="polite" className="flex flex-wrap items-center gap-1.5">
                {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
                {sync.status === "conflict"
                  ? "Escolha uma versão do rascunho"
                  : sync.status === "syncing"
                    ? "Sincronizando rascunho…"
                    : saved && sync.status === "synced"
                      ? "Rascunho salvo na sua conta"
                      : storageFailed
                        ? "Rascunho não salvo: mantenha esta página aberta"
                        : saved
                          ? sync.reason === "schema-unavailable"
                            ? "Salvo neste dispositivo · sincronização ainda não ativada"
                            : "Rascunho salvo neste dispositivo"
                          : "Você pode pausar e continuar depois"}
                {sync.reason === "unavailable" && (
                  <button
                    type="button"
                    onClick={() => void sync.retry()}
                    className="underline underline-offset-4"
                  >
                    Tentar sincronizar
                  </button>
                )}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
