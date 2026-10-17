import { inspirationSchema } from "./inspiration-schema.ts";
import { contentLibrarySchema } from "./content-library.ts";
import { z } from "zod";
import { answersSchema, CHAPTERS, hasAnswer, type Answers } from "./onboarding.ts";
import { brandPreviewSchema, creativeStatus, researchSchema } from "./brand-preview.ts";
import { healthStudioSchema } from "./health-studio.ts";

export const QUICK_GOALS = [
  {
    value: "Atrair novos clientes",
    label: "Ser conhecido por novos pacientes",
    detail: "Apresente a clínica para quem ainda não conhece seu trabalho.",
  },
  {
    value: "Receber mais agendamentos",
    label: "Transformar interesse em agendamentos",
    detail: "Ajude quem já tem interesse a entrar em contato.",
  },
  {
    value: "Educar meus pacientes",
    label: "Educar meus pacientes sobre condições e cuidados",
    detail: "Crie explicações e vídeos sobre exames, condições e acompanhamento.",
  },
  {
    value: "Fortalecer minha marca",
    label: "Fortalecer a confiança na clínica",
    detail: "Mostre sua equipe, experiência e forma de cuidar.",
  },
  {
    value: "Lançar uma oferta",
    label: "Apresentar um novo serviço",
    detail: "Explique um atendimento ou novidade da clínica.",
  },
] as const;

export const QUICK_TEXT_SUGGESTIONS = {
  offers: [
    { label: "Aulas", value: "Aulas em pequenos grupos" },
    { label: "Atendimentos", value: "Atendimentos personalizados" },
    { label: "Planos", value: "Planos mensais" },
    { label: "Produtos", value: "Produtos mais procurados" },
  ],
  audience: [
    { label: "Minha região", value: "Pessoas da minha região" },
    { label: "Bem-estar", value: "Pessoas que buscam bem-estar" },
    { label: "Praticidade", value: "Pessoas que querem economizar tempo" },
    { label: "Empresas", value: "Empresas que precisam de apoio" },
  ],
  differentials: [
    { label: "Atendimento próximo", value: "Atendimento próximo" },
    { label: "Experiência personalizada", value: "Experiência personalizada" },
    { label: "Especialidade", value: "Especialidade no que faço" },
    { label: "Método próprio", value: "Um método próprio" },
  ],
} as const;

export const QUICK_DIAGNOSTIC_KEYS = ["goals", "offers", "audience", "differentials"] as const;

export const JOURNEY_MISSIONS = [
  {
    title: "Coloque sua marca no mapa",
    benefit: "Ajude as pessoas a encontrar seu negócio.",
    chapter: 0,
  },
  {
    title: "Encontre seu diferencial",
    benefit: "Dê ao cliente um bom motivo para escolher você.",
    chapter: 1,
  },
  {
    title: "Conheça melhor seu público",
    benefit: "Crie mensagens que parecem feitas para ele.",
    chapter: 2,
  },
  {
    title: "Transforme interesse em conversa",
    benefit: "Antecipe dúvidas e facilite o próximo passo.",
    chapter: 3,
  },
  {
    title: "Conte uma história que conecta",
    benefit: "Dê personalidade e propósito à sua comunicação.",
    chapter: 4,
  },
] as const;

export function diagnosticCoverage(answers: Answers) {
  const questions = CHAPTERS.flatMap((chapter) => chapter.questions);
  const answered = questions.filter((question) => hasAnswer(answers[question.key])).length;
  return {
    answered,
    total: questions.length,
    percent: Math.round((answered / questions.length) * 100),
    xp: 20,
  };
}

// A transparent, deterministic first plan. No AI call, predictions or invented performance data.
export function starterPlan(name: string, answers: Answers, segment = "") {
  const goal = answers.goals;
  const audience =
    answers.audience === "Ainda estou descobrindo"
      ? "o público que você quer descobrir"
      : answers.audience;
  const action =
    goal === "Receber mais agendamentos"
      ? "Prepare um convite para uma primeira conversa."
      : goal === "Fortalecer minha marca"
        ? "Apresente a história por trás da sua marca."
        : goal === "Lançar uma oferta"
          ? "Apresente sua oferta e abra uma lista de interessados."
          : "Apresente sua oferta a quem ainda não conhece você.";
  const post = [
    `Conheça a ${name}.`,
    `Trabalhamos com ${answers.offers}.`,
    answers.problems ? `Como podemos ajudar: ${answers.problems}` : "",
    answers.differentials ? `Nosso diferencial: ${answers.differentials}` : "",
    `${answers.audience === "Ainda estou descobrindo" ? "Quer saber se essa oferta faz sentido para você?" : `Você faz parte deste público: ${answers.audience}?`} Vamos conversar sobre o que você precisa.`,
    "Envie uma mensagem para saber mais.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    headline: action,
    brief: `${name}${segment ? ` (${segment})` : ""} quer ${goal.toLocaleLowerCase("pt-BR")}, apresentando ${answers.offers} para ${audience}.`,
    post,
    ideas: [
      {
        title: "Apresente sua oferta",
        purpose: "Ajude quem chega a entender o que você oferece.",
        draft: post,
      },
      {
        title: answers.differentials ? "Mostre seu jeito de fazer" : "Abra uma conversa",
        purpose: answers.differentials
          ? "Dê visibilidade a um diferencial que você informou."
          : "Descubra uma dúvida real antes de tentar adivinhar.",
        draft: answers.differentials
          ? `${name}: nosso jeito de trabalhar\n\n${answers.differentials}\n\nConheça ${answers.offers}. Envie uma mensagem para conversar.`
          : `Qual é a sua principal dúvida sobre ${answers.offers}?\n\nConte para a equipe de ${name}. Sua pergunta pode orientar nosso próximo conteúdo.`,
      },
      {
        title:
          goal === "Receber mais agendamentos"
            ? "Convide para agendar"
            : "Convide para o próximo passo",
        purpose: "Deixe claro como iniciar uma conversa, sem prometer resultados.",
        draft: `Quer saber mais sobre ${answers.offers}?\n\nFale com ${name} para entender a proposta${goal === "Receber mais agendamentos" ? " e consultar os horários disponíveis" : ""}.\n\nEnvie sua dúvida por mensagem.`,
      },
    ],
    rhythm:
      answers.challenge === "Falta tempo para o marketing"
        ? "Comece com uma publicação nesta semana. Reaproveite a mesma ideia em uma conversa com um cliente."
        : "Comece com uma apresentação da sua oferta. Depois, responda a uma dúvida frequente do seu público.",
  };
}

const deliverySchema = z.object({
  draft: z.string().max(10000).nullable().default(null),
  draftContext: z.string().nullable().default(null),
  approvedText: z.string().max(10000).nullable().default(null),
  approvedContext: z.string().nullable().default(null),
  exportedText: z.string().max(10000).nullable().default(null),
});
export const hypothesisSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().trim().min(3).max(600),
  source: z.enum(["user", "suggestion"]).default("user"),
});
export const demoSchema = z.object({
  workspaceSchemaVersion: z
    .union([z.literal(2), z.literal(3)])
    .default(3)
    .transform(() => 3 as const),
  library: contentLibrarySchema,
  inspirations: z.array(inspirationSchema).max(20).default([]),
  healthStudio: healthStudioSchema.default({}),
  name: z.string().max(120),
  segment: z.string().max(120).default(""),
  onboarded: z.boolean().default(false),
  hypotheses: z.array(hypothesisSchema).max(30).default([]),
  strategy: z
    .object({
      metric: z
        .enum(["", "messages", "website_clicks", "reach", "saves", "appointments"])
        .default(""),
      channel: z
        .enum(["", "instagram", "googleBusiness", "linkedin", "facebook", "tiktok", "website"])
        .default(""),
    })
    .default({}),
  answers: answersSchema,
  brand: brandPreviewSchema.default({}),
  achievements: z
    .array(z.enum(["context", "direction", "identity", "approved", "exported"]))
    .max(5)
    .default([]),
  events: z
    .array(
      z.object({
        type: z.enum(["started", "approved", "exported"]),
        at: z.string().datetime(),
        fingerprint: z.string().max(100).default(""),
      }),
    )
    .max(200)
    .default([]),
  delivery: deliverySchema.default({
    draft: null,
    draftContext: null,
    approvedText: null,
    approvedContext: null,
    exportedText: null,
  }),
});
export type DemoData = z.infer<typeof demoSchema>;

export function canEnterDemo(data: DemoData) {
  return (
    data.onboarded ||
    (data.name.trim().length >= 2 &&
      Boolean(
        data.answers.goals.trim() && data.answers.offers.trim() && data.answers.audience.trim(),
      ))
  );
}

function contextVersion(data: DemoData) {
  return JSON.stringify([data.name.trim(), data.segment.trim(), answersSchema.parse(data.answers)]);
}

export function changeDemoContext(
  data: DemoData,
  patch: Partial<Pick<DemoData, "name" | "segment" | "answers">>,
): DemoData {
  const next = { ...data, ...patch };
  // Only a website edit changes the research reference; unrelated answers must
  // not replace an existing reference (including legacy URLs over 200 chars).
  if (patch.answers && patch.answers.website !== data.answers.website) {
    const referenceUrl = patch.answers.website;
    next.brand = {
      ...data.brand,
      referenceUrl,
      research:
        referenceUrl.trim() === data.brand.referenceUrl.trim()
          ? data.brand.research
          : researchSchema.parse({}),
    };
  }
  const referenceChanged = next.brand.referenceUrl.trim() !== data.brand.referenceUrl.trim();
  if (contextVersion(next) === contextVersion(data) && !referenceChanged) return next;
  return {
    ...next,
    brand: next.brand.creative
      ? { ...next.brand, creative: { ...next.brand.creative, approved: null, exported: null } }
      : next.brand,
    delivery: { ...data.delivery, approvedText: null, approvedContext: null, exportedText: null },
  };
}

export function deliveryStatus(data: DemoData) {
  const text = data.delivery.draft ?? starterPlan(data.name, data.answers, data.segment).post;
  const approved =
    Boolean(text.trim()) &&
    data.delivery.approvedText === text &&
    data.delivery.approvedContext === contextVersion(data);
  const exported = approved && data.delivery.exportedText === text;
  return {
    text,
    approved,
    exported,
    contextChanged:
      data.delivery.draftContext !== null && data.delivery.draftContext !== contextVersion(data),
    xp: data.brand.creative
      ? creativeStatus(data).xp
      : 20 + (approved ? 40 : 0) + (exported ? 30 : 0),
    completed: data.brand.creative
      ? creativeStatus(data).completed
      : 1 + Number(approved) + Number(exported),
  };
}

export function editDelivery(data: DemoData, text: string): DemoData {
  return {
    ...data,
    delivery: {
      draft: text,
      draftContext: contextVersion(data),
      approvedText: null,
      approvedContext: null,
      exportedText: null,
    },
  };
}

export function approveDelivery(data: DemoData): DemoData {
  const { text, approved } = deliveryStatus(data);
  if (!text.trim() || approved) return data;
  return {
    ...data,
    delivery: {
      ...data.delivery,
      draft: text,
      draftContext: contextVersion(data),
      approvedText: text,
      approvedContext: contextVersion(data),
      exportedText: null,
    },
  };
}

export function exportDelivery(data: DemoData): DemoData {
  const status = deliveryStatus(data);
  if (!status.approved) return data;
  return { ...data, delivery: { ...data.delivery, exportedText: status.text } };
}
