import { inspirationSchema, localImageSchema } from "./inspiration-schema.ts";
import { z } from "zod";
import { HEALTH_CATALOG } from "./health-catalog.ts";
export { HEALTH_CATALOG } from "./health-catalog.ts";

// Synthetic editor state only. This schema cannot carry production authority.
const sceneSchema = z.object({
  id: z.string().uuid(),
  material: inspirationSchema.nullable().default(null),
  kind: z.literal("text_card"),
  heading: z.string().max(120),
  script: z.string().max(800),
  seconds: z.number().finite().int().min(3).max(60),
});
const optionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(120),
  intent: z.string().max(240),
  scenes: z.array(sceneSchema).min(1).max(12),
});
const snapshotSchema = z.object({
  idea: z.string().max(800).default(""),
  material: inspirationSchema.nullable().default(null),
  templateId: z
    .string()
    .regex(/^V(0[1-9]|1[0-9]|2[0-4])$/)
    .default("V01"),
  duration: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
  ratio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  style: z.enum(["clear_classic", "photo_editorial"]).default("clear_classic"),
  selectedOption: z.string().uuid().nullable().default(null),
  options: z.array(optionSchema).max(3).default([]),
});
export const healthStudioSchema = snapshotSchema.extend({
  schemaVersion: z.literal(1).default(1),
  media: z.record(z.string().uuid(), localImageSchema).default({}),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  past: z.array(snapshotSchema).max(20).default([]),
  future: z.array(snapshotSchema).max(20).default([]),
});
export type HealthStudioDraft = z.infer<typeof healthStudioSchema>;
export type HealthScene = z.infer<typeof sceneSchema>;
export type HealthOption = z.infer<typeof optionSchema>;
export function previewFramesFit(
  frames: Iterable<
    Pick<HTMLElement, "clientHeight" | "scrollHeight" | "clientWidth" | "scrollWidth">
  >,
) {
  const items = [...frames];
  return (
    items.length > 0 &&
    items.every(
      (frame) =>
        frame.clientHeight > 0 &&
        frame.clientWidth > 0 &&
        frame.scrollHeight <= frame.clientHeight + 1 &&
        frame.scrollWidth <= frame.clientWidth + 1,
    )
  );
}

export function catalogStats() {
  const videos = HEALTH_CATALOG.filter((t) => t.medium === "video");
  const presets = (items: typeof videos) =>
    items.reduce((sum, t) => sum + t.durations.length * 3 * 2, 0);
  return {
    videos: videos.length,
    images: HEALTH_CATALOG.filter((t) => t.medium === "image").length,
    carousels: HEALTH_CATALOG.filter((t) => t.medium === "carousel").length,
    emails: HEALTH_CATALOG.filter((t) => t.medium === "email").length,
    betaVideos: videos.filter((t) => t.beta).length,
    baselinePresets: presets(videos),
    betaPresets: presets(videos.filter((t) => t.beta)),
    twinEligibleVideos: videos.filter((t) => t.twinEligible).length,
    qualifiedPresets: null,
  };
}
const snapshot = (value: HealthStudioDraft) => snapshotSchema.parse(value);
export function resolveHealthMaterial(draft: HealthStudioDraft, material: HealthScene["material"]) {
  return material
    ? { ...material, image: material.image || draft.media[material.assetId ?? ""] || "" }
    : null;
}
/** Pixel bytes live once per Health document; undo snapshots retain immutable references. */
function compactHealthMedia(draft: HealthStudioDraft): HealthStudioDraft {
  const media: Record<string, string> = {};
  const intern = (material: HealthScene["material"]): HealthScene["material"] => {
    if (!material) return null;
    const image = material.image || draft.media[material.assetId ?? ""];
    if (!image) return material;
    let assetId = Object.keys(media).find((key) => media[key] === image);
    if (!assetId) {
      assetId =
        Object.keys(draft.media).find((key) => draft.media[key] === image) ?? crypto.randomUUID();
      media[assetId] = image;
    }
    return { ...material, image: "", assetId };
  };
  const compact = (state: z.infer<typeof snapshotSchema>) => ({
    ...state,
    material: intern(state.material),
    options: state.options.map((option) => ({
      ...option,
      scenes: option.scenes.map((scene) => ({ ...scene, material: intern(scene.material) })),
    })),
  });
  const current = compact(snapshot(draft));
  const past = draft.past.map(compact),
    future = draft.future.map(compact);
  return healthStudioSchema.parse({ ...draft, ...current, past, future, media });
}
function changed(previous: HealthStudioDraft, next: z.infer<typeof snapshotSchema>) {
  return compactHealthMedia(
    healthStudioSchema.parse({
      ...next,
      media: previous.media,
      revision: previous.revision + 1,
      past: [...previous.past, snapshot(previous)].slice(-20),
      future: [],
    }),
  );
}
export function configureHealthDraft(
  draft: HealthStudioDraft,
  patch: Partial<
    Pick<
      HealthStudioDraft,
      "templateId" | "duration" | "ratio" | "style" | "selectedOption" | "idea" | "material"
    >
  >,
) {
  const next = snapshotSchema.parse({ ...snapshot(draft), ...patch });
  const template = HEALTH_CATALOG.find((t) => t.id === next.templateId)!;
  if (!template.durations.includes(next.duration))
    next.duration = template.durations[0] as 15 | 30 | 60;
  if (next.templateId !== draft.templateId) {
    next.options = [];
    next.selectedOption = null;
  }
  if (JSON.stringify(snapshot(draft)) === JSON.stringify(next)) return draft;
  return changed(draft, next);
}
export function prepareHealthOptions(draft: HealthStudioDraft) {
  const template = HEALTH_CATALOG.find((t) => t.id === draft.templateId)!;
  const seconds = [
    Math.floor(draft.duration / 3),
    Math.floor(draft.duration / 3),
    draft.duration - 2 * Math.floor(draft.duration / 3),
  ];
  const concepts = [
    {
      title: "Apresente o assunto",
      intent: "Comece pela informação que a pessoa precisa reconhecer.",
      headings: ["O assunto", "A informação", "Onde saber mais"],
      scripts: [
        "Clínica Exemplo — demonstração fictícia.",
        `Tema do rascunho: ${template.name}.`,
        "Inclua um contato administrativo verificado antes da revisão.",
      ],
    },
    {
      title: "Mostre um passo a passo",
      intent: "Organize a mensagem em uma sequência fácil de acompanhar.",
      headings: ["Por onde começar", "O próximo passo", "O que confirmar"],
      scripts: [
        "Este é um exemplo de sequência, sem orientação médica.",
        "Insira aqui uma etapa comprovada e sua fonte revisada.",
        "Confirme com a equipe a informação administrativa necessária.",
      ],
    },
    {
      title: "Abra com uma pergunta",
      intent: "Parta de uma dúvida geral e indique uma fonte adequada.",
      headings: ["A pergunta", "A explicação", "Continue a conversa"],
      scripts: [
        "Qual informação você procura sobre este assunto?",
        "A resposta depende de uma fonte e de revisão profissional.",
        "Use um canal administrativo confirmado para saber mais.",
      ],
    },
  ];
  const options = concepts.map((concept) => ({
    id: crypto.randomUUID(),
    title: concept.title,
    intent: concept.intent,
    scenes: concept.scripts.map((script, index) => ({
      id: crypto.randomUUID(),
      kind: "text_card" as const,
      material: index === 0 ? draft.material : null,
      heading: concept.headings[index]!,
      script: index === 0 && draft.idea.trim() ? draft.idea.trim() : script,
      seconds: seconds[index]!,
    })),
  }));
  return changed(draft, { ...snapshot(draft), options, selectedOption: options[0]!.id });
}
export type HealthSceneChange =
  | { type: "material"; sceneId: string; value: z.input<typeof inspirationSchema> | null }
  | { type: "script" | "heading"; sceneId: string; value: string }
  | { type: "seconds"; sceneId: string; value: number }
  | { type: "add" | "duplicate" | "split" | "merge" | "delete"; sceneId: string }
  | { type: "move"; sceneId: string; offset: -1 | 1 };
export function changeHealthScene(
  draft: HealthStudioDraft,
  action: HealthSceneChange,
  expectedRevision: number,
) {
  if (expectedRevision !== draft.revision) throw Error("revision_conflict");
  const next = snapshot(draft);
  const option = next.options.find((o) => o.id === next.selectedOption);
  const index = option?.scenes.findIndex((s) => s.id === action.sceneId) ?? -1;
  if (!option || index < 0) throw Error("scene_not_found");
  const scene = option.scenes[index]!;
  switch (action.type) {
    case "material":
      scene.material = action.value ? inspirationSchema.parse(action.value) : null;
      break;
    case "script":
      scene.script = action.value;
      break;
    case "heading":
      scene.heading = action.value;
      break;
    case "seconds":
      scene.seconds = action.value;
      break;
    case "add":
    case "duplicate":
      if (option.scenes.length >= 12) throw Error("maximum_12_scenes");
      option.scenes.splice(
        index + 1,
        0,
        action.type === "duplicate"
          ? { ...scene, id: crypto.randomUUID() }
          : {
              id: crypto.randomUUID(),
              kind: "text_card",
              material: null,
              heading: "Nova cena",
              script: "",
              seconds: 3,
            },
      );
      break;
    case "split": {
      if (option.scenes.length >= 12) throw Error("maximum_12_scenes");
      if (scene.seconds < 6 || scene.script.trim().split(/\s+/).length < 2)
        throw Error("split_requires_time_and_text");
      const words = scene.script.trim().split(/\s+/),
        middle = Math.ceil(words.length / 2);
      const second = {
        ...scene,
        id: crypto.randomUUID(),
        script: words.slice(middle).join(" "),
        seconds: scene.seconds - Math.floor(scene.seconds / 2),
      };
      scene.script = words.slice(0, middle).join(" ");
      scene.seconds = Math.floor(scene.seconds / 2);
      option.scenes.splice(index + 1, 0, second);
      break;
    }
    case "merge": {
      const neighbor = option.scenes[index + 1];
      if (!neighbor || neighbor.kind !== scene.kind) throw Error("incompatible_merge");
      scene.script = `${scene.script} ${neighbor.script}`.trim();
      scene.seconds += neighbor.seconds;
      option.scenes.splice(index + 1, 1);
      break;
    }
    case "delete":
      if (option.scenes.length === 1) throw Error("cannot_delete_last_scene");
      option.scenes.splice(index, 1);
      break;
    case "move": {
      const target = index + action.offset;
      if (target < 0 || target >= option.scenes.length) return draft;
      [option.scenes[index], option.scenes[target]] = [option.scenes[target]!, scene];
      break;
    }
  }
  return changed(draft, next);
}
export function undoHealthEdit(draft: HealthStudioDraft) {
  const previous = draft.past.at(-1);
  if (!previous) return draft;
  return compactHealthMedia(
    healthStudioSchema.parse({
      ...previous,
      media: draft.media,
      revision: draft.revision + 1,
      past: draft.past.slice(0, -1),
      future: [snapshot(draft), ...draft.future].slice(0, 20),
    }),
  );
}
export function redoHealthEdit(draft: HealthStudioDraft) {
  const next = draft.future[0];
  if (!next) return draft;
  return compactHealthMedia(
    healthStudioSchema.parse({
      ...next,
      media: draft.media,
      revision: draft.revision + 1,
      past: [...draft.past, snapshot(draft)].slice(-20),
      future: draft.future.slice(1),
    }),
  );
}
export function timingIssues(draft: HealthStudioDraft) {
  const option = draft.options.find((o) => o.id === draft.selectedOption);
  if (!option) return ["Escolha uma abordagem para visualizar."];
  const issues: string[] = [];
  if (option.scenes.reduce((sum, s) => sum + s.seconds, 0) !== draft.duration)
    issues.push(`A soma das cenas precisa ser ${draft.duration} segundos.`);
  for (const [index, scene] of option.scenes.entries()) {
    if (!scene.script.trim()) issues.push(`Cena ${index + 1}: escreva o texto do exemplo.`);
    // Conservative preview estimate only; measured caption/audio fit is a later render gate.
    const words = `${scene.heading} ${scene.script}`.trim().split(/\s+/).length;
    if (Math.ceil(words / 3) > scene.seconds)
      issues.push(`Cena ${index + 1}: aumente o tempo de leitura ou reduza o texto.`);
  }
  return issues;
}
export function healthProductionStatus() {
  return {
    available: false as const,
    cost: null,
    automationPercent: null,
    missing: [
      "Política para profissão e jurisdição",
      "Identidade e credenciais verificadas",
      "Fontes e direitos de uso revisados",
      "Consentimento separado para imagem e voz",
      "Provedor de gêmeo digital qualificado",
      "Orçamento e execução protegidos",
      "Revisão profissional do pacote exato",
    ],
  };
}
