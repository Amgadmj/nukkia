import { MaterialInput } from "./material-input";
import { useEffect, useState, useRef, type Dispatch, type SetStateAction } from "react";
import type { DemoData } from "@/lib/quick-start";
import {
  HEALTH_CATALOG,
  catalogStats,
  configureHealthDraft,
  prepareHealthOptions,
  changeHealthScene,
  undoHealthEdit,
  redoHealthEdit,
  timingIssues,
  healthProductionStatus,
  previewFramesFit,
  resolveHealthMaterial,
  type HealthStudioDraft,
  type HealthSceneChange,
  type HealthOption,
} from "@/lib/health-studio";
import {
  ArrowLeft,
  ArrowRight,
  Film,
  Layers,
  Image,
  Mail,
  UserRound,
  BookOpen,
} from "lucide-react";

const mediaLabels = {
  video: "Vídeos",
  image: "Imagens",
  carousel: "Carrosséis",
  email: "E-mails em rascunho",
};
const evidenceLabels: Record<string, string> = {
  administrative: "Informações administrativas",
  credential: "Credenciais verificadas",
  clinical: "Fontes clínicas revisadas",
  clinical_or_mixed: "Fontes clínicas e administrativas",
};
const sceneErrors: Record<string, string> = {
  revision_conflict: "O rascunho mudou. Revise a versão atual antes de continuar.",
  storage_limit:
    "Sem espaço para esta alteração. O roteiro anterior foi preservado; tente uma imagem menor.",
  maximum_12_scenes: "O exemplo pode ter até 12 cenas.",
  split_requires_time_and_text: "Dividir exige pelo menos 6 segundos e duas palavras.",
  incompatible_merge: "Escolha uma cena com uma próxima cena compatível.",
  cannot_delete_last_scene: "Mantenha pelo menos uma cena.",
};

type StudioStep = "formatos" | "instrucoes" | "opcoes" | "editor";
const studioSteps: { id: StudioStep; label: string }[] = [
  { id: "formatos", label: "Formato" },
  { id: "instrucoes", label: "Instruções" },
  { id: "opcoes", label: "Opções" },
  { id: "editor", label: "Editor" },
];

export function HealthStudio({
  data,
  onData,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
}) {
  const draft = data.healthStudio;
  const [error, setError] = useState<string | null>(null);
  const [medium, setMedium] = useState<keyof typeof mediaLabels>("video");
  const [step, setStep] = useState<StudioStep>(draft.options.length ? "editor" : "formatos");
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const template = HEALTH_CATALOG.find((t) => t.id === draft.templateId)!;
  const option = draft.options.find((o) => o.id === draft.selectedOption);
  const currentStep = !option && (step === "opcoes" || step === "editor") ? "instrucoes" : step;
  const index = Math.max(0, option?.scenes.findIndex((s) => s.id === activeSceneId) ?? 0);
  const scene = option?.scenes[index];
  const issues = timingIssues(draft);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [currentStep]);
  const stats = catalogStats();
  const production = healthProductionStatus();
  function commit(update: (value: HealthStudioDraft) => HealthStudioDraft) {
    try {
      const next = update(draft);
      if (
        new TextEncoder().encode(JSON.stringify({ ...data, healthStudio: next })).byteLength >
        4_800_000
      )
        throw new Error("storage_limit");
      onData((current) =>
        current.healthStudio.revision === draft.revision
          ? { ...current, healthStudio: next }
          : current,
      );
      setError(null);
      return true;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(sceneErrors[message] ?? "Confira os limites de texto e duração antes de continuar.");
      return false;
    }
  }
  const edit = (action: HealthSceneChange) => {
    const saved = commit((current) => changeHealthScene(current, action, draft.revision));
    // Anchor the implicit first selection before a reorder changes its position.
    if (saved && scene && action.type !== "delete") setActiveSceneId(scene.id);
    return saved;
  };
  function back() {
    const position = studioSteps.findIndex((s) => s.id === currentStep);
    setStep(studioSteps[Math.max(0, position - 1)]!.id);
  }
  return (
    <div className="workspace-page health-studio" data-studio-step={currentStep}>
      <header className="studio-toolbar">
        <button className="studio-back" disabled={currentStep === "formatos"} onClick={back}>
          <ArrowLeft size={15} aria-hidden="true" /> Voltar
        </button>
        <nav className="studio-stepper" aria-label="Etapas da criação">
          {studioSteps.map((item, i) => (
            <button
              key={item.id}
              aria-current={currentStep === item.id ? "step" : undefined}
              disabled={!option && (item.id === "opcoes" || item.id === "editor")}
              onClick={() => setStep(item.id)}
            >
              <span>{i + 1}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="health-tools" aria-label="Histórico do estúdio">
          <button disabled={!draft.past.length} onClick={() => commit(undoHealthEdit)}>
            Desfazer
          </button>
          <button disabled={!draft.future.length} onClick={() => commit(redoHealthEdit)}>
            Refazer
          </button>
        </div>
      </header>
      <p className="studio-demo-note" role="note">
        Demonstração com textos fictícios · sem áudio ou exportação. Não insira dados de pacientes.
      </p>
      {error && (
        <p className="health-error" role="alert">
          {error}
        </p>
      )}

      {currentStep === "formatos" && (
        <section className="studio-create-home" aria-labelledby="health-setup-title">
          <div className="studio-intro">
            <h1 id="health-setup-title" ref={heading} tabIndex={-1}>
              O que vamos criar?
            </h1>
            <p>Escolha seu ponto de partida. Comece pelo roteiro e revise cena por cena.</p>
          </div>
          <div className="studio-mode-grid">
            <button
              className="studio-mode-card is-available"
              aria-label="Roteiro em cenas"
              onClick={() => setStep("instrucoes")}
            >
              <span className="studio-mode-art">
                <Film size={29} strokeWidth={1.3} />
              </span>
              <span>
                <strong>Roteiro em cenas</strong>
                <small>Três exemplos para escolher e editar</small>
              </span>
              <ArrowRight size={18} />
            </button>
            <div className="studio-mode-card" aria-disabled="true">
              <span className="studio-mode-art">
                <UserRound size={29} strokeWidth={1.3} />
              </span>
              <span>
                <strong>Gêmeo digital</strong>
                <small>Requer provedor, autorizações e revisão</small>
                <em>Planejado</em>
              </span>
            </div>
            <div className="studio-mode-card" aria-disabled="true">
              <span className="studio-mode-art">
                <Image size={29} strokeWidth={1.3} />
              </span>
              <span>
                <strong>Imagem de saúde</strong>
                <small>{stats.images} estruturas no catálogo</small>
                <em>Planejado</em>
              </span>
            </div>
            <div className="studio-mode-card" aria-disabled="true">
              <span className="studio-mode-art">
                <Layers size={29} strokeWidth={1.3} />
              </span>
              <span>
                <strong>Carrossel educativo</strong>
                <small>{stats.carousels} estruturas no catálogo</small>
                <em>Planejado</em>
              </span>
            </div>
            <div className="studio-mode-card" aria-disabled="true">
              <span className="studio-mode-art">
                <Mail size={29} strokeWidth={1.3} />
              </span>
              <span>
                <strong>E-mail da clínica</strong>
                <small>{stats.emails} estruturas no catálogo</small>
                <em>Planejado</em>
              </span>
            </div>
            <button
              className="studio-mode-card"
              aria-label="Explorar catálogo"
              onClick={() =>
                (() => {
                  const catalog = document.getElementById(
                    "health-catalog",
                  ) as HTMLDetailsElement | null;
                  if (catalog) {
                    catalog.open = true;
                    catalog.scrollIntoView({ behavior: "smooth" });
                  }
                })()
              }
            >
              <span className="studio-mode-art">
                <BookOpen size={29} strokeWidth={1.3} />
              </span>
              <span>
                <strong>Explorar catálogo</strong>
                <small>Veja as {stats.videos} estruturas de vídeo propostas</small>
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}

      {currentStep === "instrucoes" && (
        <section className="studio-instructions" aria-labelledby="health-instructions-title">
          <div className="studio-intro">
            <span className="studio-kicker">ROTEIRO EM CENAS</span>
            <h1 id="health-instructions-title" ref={heading} tabIndex={-1}>
              Prepare seu roteiro
            </h1>
            <p>Escolha a estrutura, o tempo e o formato da prévia.</p>
          </div>
          <label>
            Ideia ou roteiro inicial
            <textarea
              maxLength={800}
              value={draft.idea}
              placeholder="Descreva o assunto com conteúdo sintético para esta prévia"
              onChange={(event) =>
                commit((current) => configureHealthDraft(current, { idea: event.target.value }))
              }
            />
          </label>
          <details>
            <summary>Material de referência opcional</summary>
            <MaterialInput
              value={resolveHealthMaterial(draft, draft.material)}
              library={data.inspirations}
              onChange={(material) => {
                if (!commit((current) => configureHealthDraft(current, { material })))
                  throw new Error("O material não foi aplicado. Confira o aviso do estúdio.");
              }}
            />
          </details>
          <label>
            Estrutura do roteiro
            <select
              value={draft.templateId}
              onChange={(event) => {
                if (
                  draft.options.length &&
                  !window.confirm(
                    "Trocar o formato substituirá os exemplos atuais. Você poderá desfazer.",
                  )
                )
                  return;
                commit((current) =>
                  configureHealthDraft(current, { templateId: event.target.value }),
                );
              }}
            >
              {HEALTH_CATALOG.filter((t) => t.medium === "video").map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.beta ? " · prioridade beta" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-template-brief">
            <Film size={21} />
            <div>
              <strong>{template.name}</strong>
              <p>
                Este formato exige:{" "}
                {evidenceLabels[template.evidenceClass] ?? template.evidenceClass}. A demonstração
                não verifica fontes ou credenciais.
              </p>
            </div>
          </div>
          <fieldset className="studio-segmented">
            <legend>Duração</legend>
            <div>
              {template.durations.map((seconds) => (
                <button
                  key={seconds}
                  aria-pressed={draft.duration === seconds}
                  onClick={() =>
                    commit((current) =>
                      configureHealthDraft(current, {
                        duration: seconds as HealthStudioDraft["duration"],
                      }),
                    )
                  }
                >
                  {seconds} segundos
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="studio-segmented">
            <legend>Proporção</legend>
            <div>
              {(["9:16", "1:1", "16:9"] as const).map((ratio) => (
                <button
                  key={ratio}
                  aria-pressed={draft.ratio === ratio}
                  onClick={() => commit((current) => configureHealthDraft(current, { ratio }))}
                >
                  <span
                    className="studio-ratio-icon"
                    style={{ aspectRatio: ratio.replace(":", "/") }}
                  />
                  {ratio}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="health-small">
            Sua ideia abre três estruturas locais ilustrativas, sem chamada de IA. Revise os demais
            textos depois de escolher.
          </p>
          <div className="studio-next">
            <button
              className="quick-primary"
              onClick={() => {
                if (
                  draft.options.length &&
                  !window.confirm(
                    "Preparar novos exemplos substituirá as três opções atuais. Você poderá desfazer.",
                  )
                )
                  return;
                if (commit(prepareHealthOptions)) {
                  setActiveSceneId(null);
                  setStep("opcoes");
                }
              }}
            >
              Preparar três exemplos <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {currentStep === "opcoes" && option && (
        <section className="studio-choices" aria-labelledby="health-options-title">
          <div className="studio-intro">
            <h1 id="health-options-title" ref={heading} tabIndex={-1}>
              Escolha uma abordagem
            </h1>
            <p>Abra uma opção para ajustar seus textos e a sequência das cenas.</p>
          </div>
          <div className="health-options">
            {draft.options.map((candidate, i) => (
              <button
                key={candidate.id}
                className="studio-option-card"
                aria-label={candidate.title}
                aria-pressed={candidate.id === draft.selectedOption}
                onClick={() => {
                  if (
                    commit((current) =>
                      configureHealthDraft(current, { selectedOption: candidate.id }),
                    )
                  ) {
                    setActiveSceneId(null);
                    setStep("editor");
                  }
                }}
              >
                <div className={`studio-option-cover cover-${i}`}>
                  <span>EXEMPLO FICTÍCIO</span>
                  <strong>{candidate.scenes[0]!.heading}</strong>
                  <Film size={25} />
                </div>
                <div className="studio-option-copy">
                  <strong>{candidate.title}</strong>
                  <span>{candidate.intent}</span>
                  <small>
                    {candidate.scenes.length} cenas · {draft.duration}s
                  </small>
                  <span className="studio-option-action">
                    Editar esta opção <ArrowRight size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {currentStep === "editor" && option && scene && (
        <section className="studio-editor" aria-labelledby="health-scenes-title">
          <div className="studio-editor-heading">
            <div>
              <h1 id="health-scenes-title" ref={heading} tabIndex={-1}>
                {option.title}
              </h1>
              <p>
                {option.scenes.length} de 12 cenas ·{" "}
                {option.scenes.reduce((sum, s) => sum + s.seconds, 0)} de {draft.duration} segundos
                · {draft.ratio}
              </p>
            </div>
            <button className="quick-text-button" onClick={() => setStep("instrucoes")}>
              Ajustar formato
            </button>
          </div>
          <div className="studio-canvas-layout">
            <div className="studio-preview-stage">
              <HealthAnimatic
                key={`${option.id}:${draft.revision}:${scene.id}`}
                option={option}
                ratio={draft.ratio}
                blocked={issues.length > 0}
                startAt={option.scenes.slice(0, index).reduce((sum, s) => sum + s.seconds, 0)}
              />
            </div>
            <nav className="studio-scene-rail" aria-label="Cenas do roteiro">
              {option.scenes.map((candidate, i) => (
                <button
                  key={candidate.id}
                  aria-label={`Editar cena ${i + 1}`}
                  aria-pressed={candidate.id === scene.id}
                  onClick={() => setActiveSceneId(candidate.id)}
                >
                  <span className="studio-scene-thumb">
                    <Film size={17} />
                    <strong>{candidate.heading}</strong>
                  </span>
                  <small>
                    Cena {i + 1} · {candidate.seconds}s
                  </small>
                </button>
              ))}
            </nav>
          </div>
          <article className="studio-scene-editor" aria-label={`Editor da cena ${index + 1}`}>
            <details>
              <summary>Material de referência desta cena</summary>
              <MaterialInput
                key={scene.id}
                value={resolveHealthMaterial(draft, scene.material)}
                library={data.inspirations}
                onChange={(value) => {
                  if (!edit({ type: "material", sceneId: scene.id, value }))
                    throw new Error("O material não foi aplicado. Confira o aviso do estúdio.");
                }}
              />
              <p>
                Material de referência. A reprodução continua sendo uma prévia de texto, sem vídeo
                ou áudio renderizado.
              </p>
            </details>
            <div className="studio-scene-editor-title">
              <h2>Cena {index + 1}</h2>
              <span>Rascunho ilustrativo · sem aprovação</span>
            </div>
            <label>
              Título
              <input
                maxLength={120}
                value={scene.heading}
                onChange={(event) =>
                  edit({ type: "heading", sceneId: scene.id, value: event.target.value })
                }
              />
            </label>
            <label>
              Texto do exemplo
              <textarea
                rows={3}
                maxLength={800}
                value={scene.script}
                onChange={(event) =>
                  edit({ type: "script", sceneId: scene.id, value: event.target.value })
                }
              />
            </label>
            <SceneDurationInput
              key={`${scene.id}:${scene.seconds}`}
              value={scene.seconds}
              onCommit={(value) => edit({ type: "seconds", sceneId: scene.id, value })}
            />
            <div className="health-tools" aria-label={`Operações da cena ${index + 1}`}>
              <button
                disabled={index === 0}
                onClick={() => edit({ type: "move", sceneId: scene.id, offset: -1 })}
              >
                Mover acima
              </button>
              <button
                disabled={index === option.scenes.length - 1}
                onClick={() => edit({ type: "move", sceneId: scene.id, offset: 1 })}
              >
                Mover abaixo
              </button>
              <button
                disabled={option.scenes.length >= 12}
                onClick={() => edit({ type: "add", sceneId: scene.id })}
              >
                Adicionar depois
              </button>
              <button
                disabled={option.scenes.length >= 12}
                onClick={() => edit({ type: "duplicate", sceneId: scene.id })}
              >
                Duplicar
              </button>
              <button
                disabled={
                  option.scenes.length >= 12 ||
                  scene.seconds < 6 ||
                  scene.script.trim().split(/\s+/).length < 2
                }
                onClick={() => edit({ type: "split", sceneId: scene.id })}
              >
                Dividir
              </button>
              <button
                disabled={
                  index === option.scenes.length - 1 ||
                  scene.seconds + option.scenes[index + 1]!.seconds > 60 ||
                  scene.script.length + (option.scenes[index + 1]?.script.length ?? 0) + 1 > 800
                }
                onClick={() => edit({ type: "merge", sceneId: scene.id })}
              >
                Unir à próxima
              </button>
              <button
                disabled={option.scenes.length === 1}
                onClick={() => edit({ type: "delete", sceneId: scene.id })}
              >
                Excluir
              </button>
            </div>
          </article>
          {issues.length > 0 && (
            <div className="health-notice" role="status">
              <strong>Ajuste antes de reproduzir</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="health-small">
            Prévia em cartões de texto, sem voz ou filmagem. Tempo de leitura estimado; o vídeo
            final ainda precisa de testes.
          </p>
        </section>
      )}

      <details className="studio-production" aria-labelledby="health-release-title">
        <summary id="health-release-title">Produção com gêmeo digital · indisponível</summary>
        <p>
          Escopo escolhido: Brasil · medicina. A política profissional ainda não foi ativada. Um
          retrato não autoriza usar a imagem ou clonar a voz de alguém.
        </p>
        <button className="quick-secondary" disabled>
          Gerar com gêmeo digital
        </button>
        <p>O que precisa estar verificado:</p>
        <ul>
          {production.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="health-small">
          Custo: não estimado · automação: não medida · aprovação e entrega: indisponíveis.
        </p>
      </details>
      <details className="studio-catalog" id="health-catalog">
        <summary>
          Catálogo proposto · {stats.videos + stats.images + stats.carousels + stats.emails}{" "}
          estruturas
        </summary>
        <p>
          {stats.videos} vídeos, {stats.images} imagens, {stats.carousels} carrosséis e{" "}
          {stats.emails} e-mails em rascunho. {stats.baselinePresets} combinações de vídeo
          previstas; qualificação ainda não realizada.
        </p>
        <p>
          {stats.betaVideos} vídeos priorizados para beta · {stats.betaPresets} combinações beta ·{" "}
          {stats.twinEligibleVideos} estruturas com gêmeo digital previsto.
        </p>
        <label>
          Ver formatos
          <select
            value={medium}
            onChange={(event) => setMedium(event.target.value as keyof typeof mediaLabels)}
          >
            {Object.entries(mediaLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <ul className="health-catalog-list">
          {HEALTH_CATALOG.filter((t) => t.medium === medium).map((t) => (
            <li key={t.id}>
              <span>
                <strong>{t.name}</strong>
                <small>{evidenceLabels[t.evidenceClass] ?? t.evidenceClass}</small>
              </span>
              <span className="health-small">
                {t.medium === "video" ? "Exemplo de roteiro" : "Planejado"}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function SceneDurationInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [input, setInput] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  function commit() {
    const parsed = Number(input);
    const valid = input.trim() !== "" && Number.isInteger(parsed) && parsed >= 3 && parsed <= 60;
    setInvalid(!valid);
    if (valid && parsed !== value) onCommit(parsed);
  }
  return (
    <div>
      <label>
        Duração em segundos
        <input
          type="number"
          min={3}
          max={60}
          step={1}
          value={input}
          aria-invalid={invalid}
          onChange={(event) => {
            setInput(event.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </label>
      {invalid && (
        <p role="alert" className="health-error">
          Use um número inteiro de 3 a 60 segundos.
        </p>
      )}
    </div>
  );
}

export function HealthAnimatic({
  option,
  ratio,
  blocked,
  startAt = 0,
}: {
  option: HealthOption;
  ratio: HealthStudioDraft["ratio"];
  blocked: boolean;
  startAt?: number;
}) {
  const [elapsed, setElapsed] = useState(startAt);
  const elapsedRef = useRef(startAt);
  const [playing, setPlaying] = useState(false);
  const [fits, setFits] = useState<boolean | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const unavailable = blocked || fits !== true;
  const total = option.scenes.reduce((sum, s) => sum + s.seconds, 0);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let active = true;
    const measure = () => {
      if (active)
        setFits(previewFramesFit(root.querySelectorAll<HTMLElement>("[data-fit-content]")));
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    root
      .querySelectorAll<HTMLElement>("[data-fit-content]")
      .forEach((frame) => observer?.observe(frame));
    window.addEventListener("resize", measure);
    measure();
    if (document.fonts) void document.fonts.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [option, ratio]);
  useEffect(() => {
    if (!playing || unavailable) {
      if (playing && unavailable) setPlaying(false);
      return;
    }
    const start = performance.now() - elapsedRef.current * 1000;
    const timer = window.setInterval(() => {
      const current = Math.min(total, (performance.now() - start) / 1000);
      elapsedRef.current = current;
      setElapsed(current);
      if (current >= total) setPlaying(false);
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, unavailable, total]);
  let end = 0;
  const scene =
    option.scenes.find((s) => {
      end += s.seconds;
      return elapsed < end;
    }) ?? option.scenes.at(-1)!;
  return (
    <div className="health-animatic" ref={container}>
      <HealthTextFrame scene={scene} ratio={ratio} />
      <div className="health-fit-probes" aria-hidden="true">
        {option.scenes.map((candidate) => (
          <HealthTextFrame key={candidate.id} scene={candidate} ratio={ratio} />
        ))}
      </div>
      {fits === false && (
        <p className="health-notice" role="status">
          O texto não cabe em uma das cenas nesta proporção. Reduza o texto, divida a cena ou
          escolha outra proporção.
        </p>
      )}
      {fits === null && (
        <p className="health-small" role="status">
          Verificando o espaço dos textos…
        </p>
      )}
      <label>
        Posição da prévia: {Math.floor(elapsed)} de {total} segundos
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={elapsed}
          disabled={unavailable}
          onChange={(event) => {
            setPlaying(false);
            elapsedRef.current = Number(event.target.value);
            setElapsed(Number(event.target.value));
          }}
        />
      </label>
      <div className="health-tools">
        <button
          className="quick-secondary"
          disabled={unavailable}
          onClick={() => {
            if (elapsed >= total) {
              elapsedRef.current = 0;
              setElapsed(0);
            }
            setPlaying(!playing);
          }}
        >
          {playing ? "Pausar" : "Reproduzir prévia"}
        </button>
        <button
          className="quick-text-button"
          onClick={() => {
            setElapsed(0);
            elapsedRef.current = 0;
            setPlaying(false);
          }}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}

function HealthTextFrame({
  scene,
  ratio,
}: {
  scene: HealthOption["scenes"][number];
  ratio: HealthStudioDraft["ratio"];
}) {
  return (
    <div
      className="health-text-frame"
      style={{ aspectRatio: ratio.replace(":", "/") }}
      aria-label="Cartão da cena atual"
    >
      <div className="health-frame-content" data-fit-content>
        <span className="health-example-label">EXEMPLO FICTÍCIO</span>
        <h3>{scene.heading}</h3>
        <p>{scene.script}</p>
        <small>Prévia sem áudio · sem aprovação para publicação</small>
      </div>
    </div>
  );
}
