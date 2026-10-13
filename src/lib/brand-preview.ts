import type { DemoData } from "./quick-start.ts";
import { inspirationSchema } from "./inspiration-schema.ts";
import { z } from "zod";
import { brandReferencesFingerprint } from "./brand-sources.ts";
import { PROFILE_KEYS } from "./brand-profile-keys.ts";

const imageData = z
  .string()
  .max(1_500_000)
  .refine((value) => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
export const sourceSchema = z.object({
  url: z.string().max(2048),
  title: z.string().max(200),
  text: z.string().max(10000),
  fetchedAt: z.string(),
});
export const suggestionSchema = z.object({
  field: z.enum(["name", "segment", "audience", "offers", "detail", "faq"]),
  title: z.string().max(80).default(""),
  value: z.string().max(300),
  quote: z.string().max(500),
  sourceUrl: z.string().max(2048),
  kind: z.enum(["fact", "past-campaign", "opportunity"]).default("fact"),
  origin: z.enum(["extracted", "ai"]).default("extracted"),
  rationale: z.string().max(400).default(""),
  foundAt: z.string().default(""),
  publishedAt: z.string().max(80).nullable().default(null),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  validity: z.literal("unconfirmed").default("unconfirmed"),
});
// One drafted answer to a diagnostic question. `site` means the evidence states
// it; `inferred` is a hypothesis for the user to confirm.
export const profileFieldSchema = z.object({
  key: z.enum(PROFILE_KEYS),
  value: z.string().max(1000),
  basis: z.enum(["site", "inferred"]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  sourceUrl: z.string().max(2048).default(""),
  rationale: z.string().max(300).default(""),
});
export const researchSchema = z.object({
  status: z.enum(["idle", "loading", "ready", "unavailable"]).default("idle"),
  sources: z.array(sourceSchema).max(16).default([]),
  discoveredLinks: z
    .array(
      z.object({
        url: z.string().max(2048),
        foundOn: z.string().max(2048),
      }),
    )
    .max(12)
    .default([]),
  suggestions: z.array(suggestionSchema).max(18).default([]),
  profile: z.array(profileFieldSchema).max(30).default([]),
  phase: z.enum(["collecting", "synthesizing", "deepening", "complete"]).optional(),
  startedAt: z.string().optional(),
  elapsedMs: z.number().nonnegative().optional(),
  synthesis: z.enum(["pending", "ready", "unavailable", "local"]).optional(),
  message: z.string().max(500).default(""),
  logo: imageData.default(""),
  logoSource: z.string().max(2048).default(""),
});
export const CTA_OPTIONS = [
  { value: "direct", label: "Receber uma mensagem", copy: "Vamos conversar? Envie uma mensagem." },
  {
    value: "booking",
    label: "Convidar para agendar",
    copy: "Fale com a equipe para consultar os horários.",
  },
  { value: "website", label: "Levar ao site", copy: "Conheça os detalhes no nosso site." },
] as const;
export const pieceBriefSchema = z.object({
  asNew: z.boolean().default(false),
  format: z.enum(["image", "carousel"]).default("image"),
  idea: z.string().max(600).default(""),
  goal: z.string().max(1000).default(""),
  audience: z.string().max(1000).default(""),
  constraints: z.string().max(600).default(""),
  ratio: z.literal("4:5").default("4:5"),
});
export const briefSchema = z.object({
  idea: z.string().max(600).optional(),
  constraints: z.string().max(600).optional(),
  format: z.enum(["image", "carousel"]).optional(),
  name: z.string().trim().min(2).max(120),
  segment: z.string().trim().min(2).max(120),
  offer: z.string().trim().min(3).max(1000),
  audience: z.string().trim().min(3).max(1000),
  goal: z.string().trim().min(3).max(1000),
  detail: z.string().trim().min(12).max(600),
  action: z.enum(["direct", "booking", "website"]),
  destination: z.string().trim().max(200),
});
export const postCopySchema = z.object({
  title: z.string().trim().min(3).max(78),
  body: z.string().trim().min(10).max(180),
  caption: z.string().trim().min(20).max(1800),
});
export const creativeSchema = z.object({
  approach: z
    .enum(["educate", "trust", "invite", "question", "checklist", "behind"])
    .default("invite"),
  questionKey: z.string().default(""),
  slides: z
    .array(z.object({ title: z.string().max(78), body: z.string().max(180) }))
    .max(2)
    .default([]),
  // Draft persistence accepts empty/in-progress edits; approval uses postCopySchema.
  copy: z.object({
    title: z.string().max(78),
    body: z.string().max(180),
    caption: z.string().max(1800),
  }),
  briefKey: z.string(),
  origin: z.enum(["ai", "manual"]),
  review: z.enum(["passed", "needs-review"]),
  reviewNotes: z.array(z.string().max(300)).max(5).default([]),
  approved: z.string().nullable().default(null),
  exported: z.string().nullable().default(null),
});
export const brandPreviewSchema = z.object({
  pieceBrief: pieceBriefSchema.nullable().default(null),
  serviceBrief: z
    .object({
      id: z.string().max(100),
      catalogRevision: z.string().max(100),
      visualMaterial: inspirationSchema.nullable().optional(),
      source: z.string().max(1000),
      validUntil: z.string().max(10),
      offer: z.string().max(1000),
      audience: z.string().max(1000),
      detail: z.string().max(600),
    })
    .nullable()
    .default(null),
  inspirationBrief: z.array(inspirationSchema).max(20).default([]),
  referenceUrl: z.string().max(2048).default(""),
  entrySource: z.enum(["website", "instagram"]).default("website"),
  material: z.string().max(8000).default(""),
  research: researchSchema.default({}),
  confirmed: z.boolean().default(false),
  siteAuthorized: z.boolean().default(false),
  aiAuthorized: z.boolean().default(false),
  extraLinks: z.array(z.string().max(2048)).max(12).default([]),
  excludedReferences: z.array(z.string().max(2048)).max(24).default([]),
  referencesConfirmed: z.string().default(""),
  suggestedFields: z.array(z.string()).max(6).default([]),
  // Diagnostic answers already prefilled from research; never refilled after the user clears them.
  profileApplied: z.array(z.string()).max(30).default([]),
  editedFields: z.array(z.string()).max(6).default([]),
  offerReviewRequired: z.boolean().default(false),
  selectedOfferKind: z.enum(["fact", "past-campaign", "opportunity"]).nullable().default(null),
  customerQuestion: z.string().max(240).default(""),
  questionAnswer: z.string().max(300).default(""),
  detail: z.string().max(600).default(""),
  action: z.enum(["direct", "booking", "website"]).default("direct"),
  destination: z.string().max(200).default(""),
  visualStyle: z.enum(["essential", "warm", "dynamic"]).nullable().default(null),
  identityConfirmed: z.boolean().default(false),
  preferredApproach: z
    .enum(["educate", "trust", "invite", "question", "checklist", "behind"])
    .nullable()
    .default(null),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#395D51"),
  logo: imageData.default(""),
  photo: imageData.default(""),
  assetSource: z.string().max(2048).default(""),
  creative: creativeSchema.nullable().default(null),
});
export type BrandPreview = z.infer<typeof brandPreviewSchema>;
export function markBrandFieldsEdited(brand: BrandPreview, fields: string[]) {
  const tracked = new Set<string>(suggestionSchema.shape.field.options);
  const changed = fields.filter((field) => tracked.has(field));
  return {
    confirmed: false,
    editedFields: [...new Set([...brand.editedFields, ...changed])].filter((field) =>
      tracked.has(field),
    ),
    suggestedFields: brand.suggestedFields.filter((field) => !changed.includes(field)),
  };
}
export type ProfileField = z.infer<typeof profileFieldSchema>;
export type BrandResearch = z.infer<typeof researchSchema>;
export type BrandSuggestion = z.input<typeof suggestionSchema>;
export type FirstPostBrief = z.infer<typeof briefSchema>;
export type PostCopy = z.infer<typeof postCopySchema>;
export type Creative = z.infer<typeof creativeSchema>;
export function recoverResearch(research: BrandResearch): BrandResearch {
  if (research.status !== "loading" && (!research.phase || research.phase === "complete"))
    return research;
  return {
    ...research,
    status: research.sources.length ? "ready" : "unavailable",
    phase: "complete",
    synthesis: research.synthesis === "pending" ? "unavailable" : research.synthesis,
    message:
      "A leitura foi interrompida. As evidências recebidas foram preservadas. Volte à referência para tentar novamente.",
  };
}
export function applyBrandResearch(
  brand: BrandPreview,
  reference: { url: string; material: string },
  research: BrandResearch,
): BrandPreview {
  if (brand.referenceUrl !== reference.url || brand.material !== reference.material) return brand;
  return { ...brand, research };
}
type BrandData = {
  name: string;
  segment: string;
  answers: { offers: string; audience: string; goals: string };
  brand: BrandPreview;
};

export function firstPostBrief(data: BrandData): FirstPostBrief {
  return {
    name: data.name.trim(),
    segment: data.segment.trim(),
    offer: data.brand.serviceBrief?.offer ?? data.answers.offers.trim(),
    audience:
      data.brand.pieceBrief?.audience.trim() ||
      data.brand.serviceBrief?.audience ||
      data.answers.audience.trim(),
    goal: data.brand.pieceBrief?.goal.trim() || data.answers.goals.trim(),
    ...(data.brand.pieceBrief
      ? {
          idea: data.brand.pieceBrief.idea,
          constraints: data.brand.pieceBrief.constraints,
          format: data.brand.pieceBrief.format,
        }
      : {}),
    detail: data.brand.serviceBrief?.detail ?? data.brand.detail.trim(),
    action: data.brand.action,
    destination: data.brand.destination.trim(),
  };
}
export function briefKey(brief: FirstPostBrief) {
  return JSON.stringify(brief);
}
export function actionableDestination(brief: FirstPostBrief) {
  if (brief.action !== "website") return true;
  try {
    const url = new URL(brief.destination);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function briefIssues(data: BrandData): string[] {
  const brief = firstPostBrief(data);
  const issues: string[] = [];
  if (data.brand.serviceBrief?.validUntil) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (data.brand.serviceBrief.validUntil < today)
      issues.push(
        "O serviço do briefing venceu. Confirme a vigência no catálogo ou remova-o do briefing.",
      );
  }
  const references = brandReferencesFingerprint(data.brand);
  if (references && data.brand.referencesConfirmed !== references)
    issues.push(
      "Confira as referências atualizadas em “Vamos dar contexto à sua marca” antes de continuar.",
    );
  if (!data.brand.confirmed) issues.push("Confirme as informações da sua marca.");
  if (data.brand.offerReviewRequired)
    issues.push("Confirme a vigência e as condições da oferta antes de criar a peça.");
  if (brief.name.length < 2 || brief.segment.length < 2)
    issues.push("Informe o nome e a área de atuação da marca.");
  if (brief.offer.length < 3) issues.push("Escolha ou descreva a oferta que vamos apresentar.");
  if (brief.audience.length < 3) issues.push("Descreva quem você quer alcançar.");
  if (brief.goal.length < 3) issues.push("Informe o objetivo da comunicação.");
  for (const [field, label] of [
    ["offer", "a oferta"],
    ["audience", "a descrição do público"],
    ["goal", "o objetivo"],
  ] as const) {
    if (brief[field].length > 1000) issues.push(`Reduza ${label} para até 1.000 caracteres.`);
  }
  if (brief.detail.length < 12)
    issues.push("Adicione um detalhe concreto com pelo menos 12 caracteres.");
  if (!issues.length && !briefSchema.safeParse(brief).success)
    issues.push("Revise as informações da peça antes de continuar.");
  if (!actionableDestination(brief))
    issues.push("Informe o endereço HTTPS do site para esta chamada para ação.");
  return issues;
}
export function creativeFingerprint(data: BrandData) {
  const value = JSON.stringify([
    firstPostBrief(data),
    ...(data.brand.inspirationBrief.length ? [data.brand.inspirationBrief] : []),
    data.brand.creative?.copy,
    data.brand.creative?.slides ?? [],
    data.brand.creative?.approach ?? "invite",
    questionKey(data),
    data.brand.accent,
    data.brand.logo,
    data.brand.photo,
    ...(data.brand.visualStyle ? [data.brand.visualStyle] : []),
  ]);
  // Local edit detection, not an authorization/signature mechanism. Keep large
  // uploaded images out of the duplicated approval/export markers.
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `${value.length}:${a >>> 0}:${b >>> 0}`;
}
export function groundedSuggestions(
  suggestions: BrandSuggestion[],
  sources: BrandResearch["sources"],
) {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  return suggestions.filter(
    (suggestion) =>
      suggestion.quote.trim().length >= 3 &&
      sources.some(
        (source) =>
          source.url === suggestion.sourceUrl &&
          normalize(source.text).includes(normalize(suggestion.quote)),
      ),
  );
}
export function creativeStatus(data: BrandData) {
  const creative = data.brand.creative;
  const stale =
    !!creative &&
    (creative.briefKey !== briefKey(firstPostBrief(data)) ||
      (creative.questionKey ?? "") !== questionKey(data));
  const contentIssues = creativeIssues(data);
  const valid =
    !!creative &&
    !stale &&
    !briefIssues(data).length &&
    !contentIssues.length &&
    postCopySchema.safeParse(creative.copy).success;
  const approved = valid && creative.approved === creativeFingerprint(data);
  const exported = approved && creative.exported === creative.approved;
  const foundation = data.brand.confirmed;
  return {
    stale,
    contentIssues,
    valid,
    approved,
    exported,
    xp: (foundation ? 20 : 0) + (approved ? 40 : 0) + (exported ? 30 : 0),
    completed: Number(foundation) + Number(approved) + Number(exported),
  };
}
export function updateBrand(brand: BrandPreview, patch: Partial<BrandPreview>): BrandPreview {
  const changed = Object.entries(patch).some(
    ([key, value]) => JSON.stringify(brand[key as keyof BrandPreview]) !== JSON.stringify(value),
  );
  const next = { ...brand, ...patch };
  if (patch.visualStyle !== undefined && patch.visualStyle !== brand.visualStyle)
    next.identityConfirmed = false;
  if (changed && next.creative)
    next.creative = { ...next.creative, approved: null, exported: null };
  return next;
}

export const VISUAL_STYLES = [
  {
    id: "essential",
    name: "Essencial",
    description: "Tipografia e espaço para a mensagem respirar.",
    material: "Pode começar sem foto.",
  },
  {
    id: "warm",
    name: "Acolhedor",
    description: "Fotografia e proximidade para mostrar seu jeito de cuidar.",
    material: "Vamos pedir uma foto própria.",
  },
  {
    id: "dynamic",
    name: "Dinâmico",
    description: "Contraste e ritmo para colocar sua oferta em movimento.",
    material: "Pode começar sem foto.",
  },
] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number]["id"];
export function visualStyleTokens(style: VisualStyle | null | undefined, accent: string) {
  const dynamic = style === "dynamic";
  return {
    accent: /^#[a-f\d]{6}$/i.test(accent) ? accent : "#395D51",
    background: dynamic ? "#111318" : style === "warm" ? "#f2e6dc" : "#f5f3ed",
    ink: dynamic ? "#f7f6f2" : "#1c2822",
    secondary: dynamic ? "#c4cad2" : "#53615a",
    font: style === "warm" ? "Georgia,serif" : "Arial,sans-serif",
  };
}
export function recommendedVisualStyle(data: BrandData): VisualStyle {
  const approach = recommendContent(data).approach;
  return approach === "trust" ? "warm" : approach === "invite" ? "dynamic" : "essential";
}
export function identityIssues(brand: BrandPreview): string[] {
  if (!brand.visualStyle) return ["Escolha uma direção visual para sua marca."];
  if (brand.visualStyle === "warm" && !brand.photo)
    return [
      "Adicione uma foto própria para seguir com o estilo Acolhedor, ou escolha outro estilo.",
    ];
  return [];
}
export function identityReady(brand: BrandPreview) {
  return brand.identityConfirmed && identityIssues(brand).length === 0;
}
export function completeBrandOnboarding<T extends BrandData & { onboarded: boolean }>(
  data: T,
  style: VisualStyle,
): T {
  return { ...data, onboarded: true, brand: updateBrand(data.brand, { visualStyle: style }) };
}
export function reviseCreative(creative: Creative, copy: PostCopy): Creative {
  return { ...creative, copy, review: "needs-review", approved: null, exported: null };
}
function concise(value: string, limit: number) {
  if (value.length <= limit) return value;
  const prefix = value.slice(0, limit - 1);
  const boundary = prefix.lastIndexOf(" ");
  return (boundary > 0 ? prefix.slice(0, boundary) : prefix).trimEnd() + "…";
}
export function fallbackCopy(brief: FirstPostBrief): PostCopy {
  const action = CTA_OPTIONS.find((option) => option.value === brief.action)!.copy;
  return {
    title: concise(brief.offer, 78),
    body: concise(brief.detail, 180),
    caption: [brief.name + " • " + brief.offer, brief.detail, action, brief.destination]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1800),
  };
}

export const CONTENT_APPROACHES = [
  {
    id: "educate",
    name: "Explicar",
    format: "Carrossel · 3 páginas",
    purpose: "Torne sua oferta mais fácil de entender.",
    need: "Use uma dúvida real ou apresente como sua oferta funciona.",
  },
  {
    id: "trust",
    name: "Gerar confiança",
    format: "Post com foto · 1 página",
    purpose: "Mostre um detalhe real do seu jeito de fazer.",
    need: "Adicione uma foto própria no editor. Sem depoimentos inventados.",
  },
  {
    id: "invite",
    name: "Convidar para agir",
    format: "Oferta + convite · 1 página",
    purpose: "Dê um próximo passo claro a quem já tem interesse.",
    need: "Oferta confirmada e uma chamada coerente, sem prometer resultados.",
  },
  {
    id: "question",
    name: "Responder uma dúvida",
    format: "Pergunta + resposta",
    purpose: "Parta de uma pergunta que seu público realmente faz.",
    need: "Revise a resposta com informações confirmadas da sua prática.",
  },
  {
    id: "checklist",
    name: "Organizar um checklist",
    format: "Lista prática",
    purpose: "Organize os pontos essenciais para orientar o próximo passo.",
    need: "Inclua apenas orientações que você pode confirmar.",
  },
  {
    id: "behind",
    name: "Mostrar os bastidores",
    format: "Processo e equipe",
    purpose: "Apresente como sua equipe trabalha, com detalhes reais.",
    need: "Use informações próprias; imagens de pessoas exigem permissão.",
  },
] as const;
export type ContentApproach = (typeof CONTENT_APPROACHES)[number]["id"];
function questionKey(data: BrandData) {
  return data.brand.customerQuestion?.trim() || data.brand.questionAnswer?.trim()
    ? JSON.stringify([
        data.brand.customerQuestion?.trim() ?? "",
        data.brand.questionAnswer?.trim() ?? "",
      ])
    : "";
}
export function recommendContent(data: BrandData) {
  const question = data.brand.customerQuestion.trim();
  const goal = data.answers.goals;
  const normalizedGoal = goal
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  const approach: ContentApproach = question
    ? "educate"
    : ["receber mais agendamentos", "lancar uma oferta"].includes(normalizedGoal)
      ? "invite"
      : normalizedGoal === "fortalecer minha marca"
        ? "trust"
        : "educate";
  return {
    approach,
    observation: `Você confirmou o foco “${goal}” e a oferta “${firstPostBrief(data).offer}”.`,
    hypothesis: question
      ? `Responder “${question}” pode ajudar alguém a decidir. Ainda precisamos testar se essa dúvida é uma barreira relevante para seu público.`
      : approach === "trust"
        ? "Mostrar seu jeito de fazer pode tornar a marca mais concreta para quem ainda não conhece você."
        : approach === "invite"
          ? "Uma oferta específica com um próximo passo claro pode facilitar o contato de quem já tem interesse."
          : "Explicar a oferta e um detalhe concreto pode ajudar quem está conhecendo sua marca a entender se ela faz sentido para si.",
    reason: question
      ? "Você trouxe uma pergunta real; vamos começar ajudando a respondê-la."
      : approach === "trust"
        ? "Seu foco é fortalecer a marca. Uma foto própria e um detalhe verificável dão material para começar."
        : approach === "invite"
          ? "Seu foco pede uma ação. Vamos deixar a oferta e o convite no centro da peça."
          : normalizedGoal === "atrair novos clientes"
            ? "Seu foco é atrair novos clientes. Vamos apresentar a oferta antes de pedir uma decisão."
            : "Como ponto de partida, propomos explicar sua oferta. Você pode escolher outra abordagem se ela servir melhor ao seu objetivo.",
    coverage: {
      pages: data.brand.research.sources.filter((source) => source.url.startsWith("https://"))
        .length,
      sources: data.brand.research.sources,
      socialHistory: "unavailable" as const,
    },
  };
}
export function composeContent(data: BrandData, approach: ContentApproach): Creative {
  const brief = firstPostBrief(data);
  const copy = fallbackCopy(brief);
  const action = CTA_OPTIONS.find((option) => option.value === brief.action)!.copy;
  const question = data.brand.customerQuestion.trim();
  const answer = data.brand.questionAnswer.trim();
  const slides = (
    data.brand.pieceBrief ? data.brand.pieceBrief.format === "carousel" : approach === "educate"
  )
    ? [
        {
          title: question ? "O que você precisa saber" : "Um detalhe que faz parte da oferta",
          body: concise(
            question
              ? answer || "Adicione sua resposta no briefing antes de aprovar esta peça."
              : brief.detail,
            180,
          ),
        },
        { title: "Seu próximo passo", body: action },
      ]
    : [];
  if (approach === "educate") {
    copy.title = concise(question || brief.offer, 78);
    copy.body = question
      ? concise(brief.offer, 180)
      : concise(`Conheça a proposta de ${brief.name}.`, 180);
    copy.caption = [
      brief.name + " • " + brief.offer,
      question,
      question ? answer : brief.detail,
      action,
      brief.destination,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1800);
  }
  if (data.brand.pieceBrief?.idea.trim()) {
    copy.title = concise(data.brand.pieceBrief.idea.trim(), 78);
    copy.caption = [data.brand.pieceBrief.idea.trim(), copy.caption].join("\n\n").slice(0, 1800);
  }
  const topic = data.brand.pieceBrief?.idea.trim() || brief.offer;
  if (approach === "question") {
    copy.title = concise(question || `Quer saber mais sobre ${topic}?`, 78);
    copy.body = concise(answer || brief.detail, 180);
    copy.caption = [copy.title, copy.body, action, brief.destination]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1800);
    if (slides.length) slides[0] = { title: "Nossa resposta", body: copy.body };
  }
  if (approach === "checklist") {
    copy.title = concise(`Pontos essenciais: ${topic}`, 78);
    copy.body = concise(brief.detail, 180);
    copy.caption = [
      copy.title,
      `• ${brief.offer}`,
      `• ${brief.detail}`,
      `• ${action}`,
      brief.destination,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1800);
    if (slides.length) slides[0] = { title: "O que considerar", body: copy.body };
  }
  if (approach === "behind") {
    copy.title = concise(`Por dentro: ${topic}`, 78);
    copy.body = concise(brief.detail, 180);
    copy.caption = [
      copy.title,
      `Conheça a proposta de ${brief.name}.`,
      brief.detail,
      action,
      brief.destination,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1800);
    if (slides.length) slides[0] = { title: "Nosso jeito de trabalhar", body: copy.body };
  }
  return creativeSchema.parse({
    approach,
    slides,
    copy,
    questionKey: questionKey(data),
    briefKey: briefKey(brief),
    origin: "manual",
    review: "needs-review",
  });
}
export function creativeIssues(data: BrandData): string[] {
  const creative = data.brand.creative;
  if (!creative) return [];
  const issues: string[] = [];
  if ((creative.approach === "trust" || data.brand.visualStyle === "warm") && !data.brand.photo)
    issues.push("Adicione uma foto própria para concluir este formato.");
  if (creative.approach === "educate") {
    if (data.brand.customerQuestion.trim() && data.brand.questionAnswer.trim().length < 10)
      issues.push("Confirme a resposta à dúvida no briefing. Não vamos inventá-la.");
  }
  if (
    data.brand.pieceBrief
      ? data.brand.pieceBrief.format === "carousel"
      : creative.approach === "educate"
  ) {
    if (
      creative.slides.length !== 2 ||
      creative.slides.some(
        (slide) => !postCopySchema.pick({ title: true, body: true }).safeParse(slide).success,
      )
    )
      issues.push("Complete o título e a mensagem das três páginas antes de aprovar.");
  }
  return issues;
}

/** Every explicit composition entry point consumes the same new-item intent. */
export function composeWorkspaceContent(data: DemoData, approach: ContentApproach): DemoData {
  return {
    ...data,
    library: data.brand.pieceBrief?.asNew ? { ...data.library, activeGeneric: null } : data.library,
    brand: updateBrand(data.brand, {
      creative: composeContent(data, approach),
      ...(data.brand.pieceBrief ? { pieceBrief: { ...data.brand.pieceBrief, asNew: false } } : {}),
    }),
  };
}
