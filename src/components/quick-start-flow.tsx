import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { QUICK_GOALS, QUICK_TEXT_SUGGESTIONS } from "@/lib/quick-start";
import type { Answers } from "@/lib/onboarding";

export function OnboardingMark() {
  return (
    <span className="quick-mark" role="img" aria-label="Nukkia">
      <img src="/nukkia-official.jpg" alt="" width="2000" height="2000" />
    </span>
  );
}

type TextAnswerKey = "offers" | "audience" | "differentials";

function GrowingTextarea({
  label,
  value,
  placeholder,
  describedBy,
  invalid = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  describedBy: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useLayoutEffect(resize, [value]);

  return (
    <textarea
      ref={textarea}
      className="quick-input quick-autogrow"
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      maxLength={1000}
      rows={1}
      placeholder={placeholder}
      value={value}
      onInput={resize}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function QuickStartFlow({
  step,
  name,
  segment,
  answers,
  onName,
  onSegment,
  onAnswer,
  onStep,
}: {
  step: number;
  name: string;
  segment: string;
  answers: Answers;
  onName: (value: string) => void;
  onSegment: (value: string) => void;
  onAnswer: (key: keyof Answers, value: string) => void;
  onStep: (step: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setRevealed(true), reduced ? 0 : 1500);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    setError("");
    if (revealed) title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, revealed]);

  const headings = [
    "Vamos conhecer a sua empresa?",
    "O que você quer conquistar primeiro?",
    "O que você quer vender mais?",
    "Quem você quer alcançar?",
    "O que torna sua empresa diferente?",
  ];
  const hints = [
    "Nome e área de atuação ajudam a dar contexto à sua primeira publicação.",
    "Uma prioridade ajuda a escolher a próxima ação. Você pode mudar depois.",
    "Escolha um produto ou serviço para começar. Uma frase é suficiente.",
    "Pense em quem mais se beneficia da sua oferta. Não precisa acertar tudo agora.",
    "Opcional. Pode ser seu jeito de atender, uma especialidade ou um cuidado que seus clientes valorizam.",
  ];
  const value =
    step === 0
      ? name
      : step === 1
        ? answers.goals
        : step === 2
          ? answers.offers
          : step === 3
            ? answers.audience
            : answers.differentials;
  const textQuestion:
    | {
        key: TextAnswerKey;
        label: string;
        placeholder: string;
        optional: boolean;
      }
    | undefined =
    step === 2
      ? {
          key: "offers",
          label: "Sua principal oferta",
          placeholder: "Ex.: Aulas de pilates",
          optional: false,
        }
      : step === 3
        ? {
            key: "audience",
            label: "Seu público",
            placeholder: "Ex.: Pessoas que querem se movimentar mais",
            optional: false,
          }
        : step === 4
          ? {
              key: "differentials",
              label: "Seu diferencial (opcional)",
              placeholder: "Ex.: Atendimento em grupos pequenos",
              optional: true,
            }
          : undefined;
  function next() {
    if (step === 0 && segment.trim().length < 2) {
      setError("Informe sua área de atuação, por exemplo: estúdio de pilates.");
      return;
    }
    if (step < 4 && value.trim().length < (step === 0 ? 2 : 1)) {
      setError(
        step === 0
          ? "Digite o nome da sua marca, com pelo menos 2 caracteres."
          : "Responda para continuar.",
      );
      return;
    }
    onStep(step + 1);
  }
  return (
    <div className="quick-onboarding" data-revealed={revealed}>
      <div
        className="quick-top-progress"
        role="progressbar"
        aria-label="Onboarding"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={step}
      >
        <div style={{ width: `${(step / 5) * 100}%` }} />
      </div>
      <div className="quick-floating-logo">
        <OnboardingMark />
      </div>
      {!revealed && (
        <p className="sr-only" role="status">
          Bem-vindo à Nukkia
        </p>
      )}
      <main className="quick-question" inert={!revealed} aria-hidden={!revealed}>
        <div className="quick-progress-row">
          <div className="quick-question-meta">
            <button type="button" className="quick-back" onClick={() => onStep(step - 1)}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <div className="quick-segments" aria-hidden="true">
            {headings.map((_, index) => (
              <span key={index} data-current={index === step} data-done={index < step} />
            ))}
          </div>
        </div>
        <section key={step} className="quick-step">
          <h1 ref={title} tabIndex={-1}>
            {headings[step]}
          </h1>
          <p className="quick-hint" id="quick-hint">
            {hints[step]}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              next();
            }}
          >
            {step === 0 && (
              <div className="quick-field-stack">
                <label>
                  Nome da empresa
                  <input
                    aria-label="Nome da marca"
                    aria-describedby="quick-hint quick-error"
                    aria-invalid={Boolean(error)}
                    className="quick-input"
                    placeholder="Ex.: Aurora Studio"
                    autoComplete="organization"
                    maxLength={120}
                    value={name}
                    onChange={(event) => onName(event.target.value)}
                  />
                </label>
                <label>
                  Área de atuação
                  <input
                    className="quick-input"
                    aria-label="Área de atuação"
                    aria-describedby="quick-hint quick-error"
                    aria-invalid={Boolean(error)}
                    placeholder="Ex.: Estúdio de pilates"
                    maxLength={120}
                    value={segment}
                    onChange={(event) => onSegment(event.target.value)}
                  />
                </label>
              </div>
            )}
            {step === 1 && (
              <fieldset className="quick-options">
                <legend className="sr-only">Seu principal objetivo</legend>
                {QUICK_GOALS.map((goal) => (
                  <label className="quick-option" key={goal.value}>
                    <input
                      type="radio"
                      name="goal"
                      checked={answers.goals === goal.value}
                      onChange={() => onAnswer("goals", goal.value)}
                    />
                    <span>
                      <strong>{goal.value}</strong>
                      <small>{goal.detail}</small>
                    </span>
                    {answers.goals === goal.value ? (
                      <Check size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </label>
                ))}
              </fieldset>
            )}
            {textQuestion && (
              <>
                <GrowingTextarea
                  label={textQuestion.label}
                  describedBy={textQuestion.optional ? "quick-hint" : "quick-hint quick-error"}
                  invalid={!textQuestion.optional && Boolean(error)}
                  placeholder={textQuestion.placeholder}
                  value={answers[textQuestion.key]}
                  onChange={(nextValue) => onAnswer(textQuestion.key, nextValue)}
                />
                <div className="quick-suggestions" role="group" aria-label="Sugestões para começar">
                  {QUICK_TEXT_SUGGESTIONS[textQuestion.key].map((suggestion) => (
                    <button
                      type="button"
                      className="quick-suggestion"
                      aria-pressed={answers[textQuestion.key] === suggestion.value}
                      key={suggestion.value}
                      onClick={() => onAnswer(textQuestion.key, suggestion.value)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {error && (
              <p id="quick-error" role="alert" className="quick-error">
                {error}
              </p>
            )}
            <button type="submit" className="quick-primary">
              {step === 4 ? "Preparar minha primeira publicação" : "Continuar"}
              <ArrowRight size={16} />
            </button>
          </form>
          {step === 3 && (
            <button
              className="quick-skip"
              onClick={() => {
                onAnswer("audience", "Ainda estou descobrindo");
                onStep(4);
              }}
            >
              Ainda estou descobrindo
            </button>
          )}
          {step === 4 && (
            <button
              className="quick-skip"
              onClick={() => {
                onAnswer("differentials", "");
                onStep(5);
              }}
            >
              Preciso de ajuda para descobrir
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
