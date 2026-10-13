import { z } from "zod";

/** Accept familiar domain entry; collection still validates DNS and redirects. */
export function normalizeWebsite(value: string): string {
  const raw = value.trim();
  if (!raw || /\s|\\/.test(raw)) throw new Error("Informe um site como suamarca.com.br.");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  const labels = url.hostname.split(".");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443" && !(url.protocol === "http:" && url.port === "80")) ||
    labels.length < 2 ||
    labels.some((label) => !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)) ||
    !/^[a-z]{2,}$/i.test(labels.at(-1)!) ||
    /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname)
  )
    throw new Error("Informe um domínio público, como suamarca.com.br.");
  url.protocol = "https:";
  url.port = "";
  url.hash = "";
  return url.href;
}

export function normalizeInstagram(value: string): string {
  let handle = value.trim();
  if (/^(?:https?:\/\/)?(?:www\.)?instagram\.com(?:\/|$)/i.test(handle)) {
    const url = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`);
    if (url.username || url.password || url.port) throw new Error("Use o @perfil da empresa.");
    handle = url.pathname.replace(/^\/|\/$/g, "");
  } else handle = handle.replace(/^@/, "");
  if (
    !/^[a-z\d_](?:[a-z\d_.]{0,28}[a-z\d_])?$/i.test(handle) ||
    handle.includes("..") ||
    /^(accounts|explore|reels?|p|stories|direct|about|legal)$/i.test(handle)
  )
    throw new Error("Informe o @perfil da empresa, como @suaclinica.");
  return `@${handle.toLowerCase()}`;
}

const text = z.string().trim().max(1000).default("");
export const answersSchema = z.object({
  city: z.string().trim().max(120).default(""),
  state: z.string().trim().max(60).default(""),
  website: z.string().trim().max(200).default(""),
  instagram: z.string().trim().max(100).default(""),
  linkedin: z.string().trim().max(200).default(""),
  googleBusiness: z.string().trim().max(300).default(""),
  offers: text,
  problems: text,
  ticket: z.string().trim().max(120).default(""),
  market: text,
  differentials: text,
  audience: text,
  gender: text,
  age: text,
  location: text,
  income: text,
  interests: text,
  physical: text,
  online: text,
  hours: text,
  objections: text,
  praise: text,
  preferredChannel: text,
  goals: text,
  challenge: text,
  purpose: text,
  founderStory: text,
  // Preserved from the original diagnostic and editable in the direction chapter.
  restrictions: text,
});
export type Answers = z.infer<typeof answersSchema>;
export type AnswerKey = keyof Answers;
export type Question = {
  key: AnswerKey;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  short?: boolean;
};
export const CHAPTERS: {
  title: string;
  headline: string;
  description: string;
  outcome: string;
  questions: Question[];
}[] = [
  {
    title: "Seu negócio",
    headline: "Vamos conhecer seu ponto de partida.",
    description:
      "Onde sua marca está e como as pessoas encontram você. Preencha o que já tiver — os links são opcionais.",
    outcome: "Contexto da sua presença digital",
    questions: [
      { key: "city", label: "Cidade", short: true, placeholder: "São Paulo" },
      { key: "state", label: "Estado", short: true, placeholder: "SP" },
      { key: "website", label: "Site", short: true, placeholder: "https://suaempresa.com.br" },
      { key: "instagram", label: "Instagram", short: true, placeholder: "@suaempresa" },
      { key: "linkedin", label: "LinkedIn", short: true, placeholder: "Link da página da empresa" },
      {
        key: "googleBusiness",
        label: "Perfil da Empresa no Google",
        short: true,
        placeholder: "Nome, link ou “ainda não tenho”",
      },
    ],
  },
  {
    title: "Sua oferta",
    headline: "O que só a sua marca pode oferecer?",
    description:
      "Conte o que você vende e por que isso faz diferença. Cada resposta dá mais contexto à sua estratégia.",
    outcome: "Oferta e posicionamento",
    questions: [
      {
        key: "offers",
        label: "Quais produtos ou serviços você vende?",
        required: true,
        placeholder: "Descreva suas principais ofertas e o que cada uma inclui.",
      },
      {
        key: "problems",
        label: "Que problemas você resolve para o cliente?",
        required: true,
        placeholder: "O que muda na vida de quem compra de você?",
      },
      {
        key: "ticket",
        label: "Ticket médio (opcional)",
        short: true,
        placeholder: "Ex.: R$ 350 por atendimento",
      },
      {
        key: "market",
        label: "Concorrentes e referências",
        placeholder: "Quais empresas disputam esse público ou inspiram você?",
      },
      {
        key: "differentials",
        label: "O que torna sua empresa diferente?",
        placeholder: "Método, experiência, atendimento, especialização…",
      },
    ],
  },
  {
    title: "Seu público",
    headline: "Quem você quer alcançar?",
    description:
      "Pense nas pessoas que mais se beneficiam do que você faz. Se ainda não souber um detalhe, pode deixar em branco.",
    outcome: "Perfil do cliente ideal",
    questions: [
      {
        key: "audience",
        label: "Quem é o seu público-alvo?",
        required: true,
        placeholder: "Descreva seu cliente ideal com suas próprias palavras.",
      },
      {
        key: "gender",
        label: "Perfil de gênero",
        options: [
          "Todos os gêneros",
          "Predominantemente feminino",
          "Predominantemente masculino",
          "Ainda não sei",
        ],
      },
      {
        key: "age",
        label: "Faixa etária predominante",
        options: [
          "Menos de 18 anos",
          "18 a 24 anos",
          "25 a 34 anos",
          "35 a 44 anos",
          "45 a 59 anos",
          "60 anos ou mais",
          "Várias faixas",
          "Ainda não sei",
        ],
      },
      {
        key: "location",
        label: "Onde esse público está?",
        short: true,
        placeholder: "Bairros, cidades, estados ou todo o Brasil",
      },
      {
        key: "income",
        label: "Renda mensal aproximada",
        options: [
          "Até R$ 2.000",
          "R$ 2.001 a R$ 5.000",
          "R$ 5.001 a R$ 10.000",
          "Acima de R$ 10.000",
          "Perfis variados",
          "Ainda não sei",
        ],
      },
      {
        key: "interests",
        label: "Quais são seus interesses e desejos?",
        placeholder: "O que essas pessoas valorizam e gostariam de conquistar?",
      },
    ],
  },
  {
    title: "A jornada de compra",
    headline: "Como a conversa vira uma venda?",
    description:
      "Esses detalhes ajudam a criar mensagens mais úteis, com o tom e os argumentos certos.",
    outcome: "Argumentos e canais de comunicação",
    questions: [
      {
        key: "physical",
        label: "Você atende em um espaço físico? Como funciona?",
        placeholder: "Local, agendamento, experiência — ou diga que não se aplica.",
      },
      {
        key: "online",
        label: "Você vende online? Como funciona?",
        placeholder: "Site, WhatsApp, redes sociais, marketplace…",
      },
      {
        key: "hours",
        label: "Dias, horários de atendimento e horários de pico",
        short: true,
        placeholder: "Ex.: seg. a sex., 9h–18h; maior movimento à tarde",
      },
      {
        key: "objections",
        label: "Quais são as três principais objeções à compra?",
        placeholder: "Preço, falta de tempo, insegurança sobre o resultado…",
      },
      {
        key: "praise",
        label: "O que seus clientes mais elogiam?",
        placeholder: "Atendimento, qualidade, conveniência…",
      },
      {
        key: "preferredChannel",
        label: "Canal de atendimento preferido",
        options: [
          "WhatsApp",
          "Redes sociais / Direct",
          "E-mail",
          "Ligação telefônica",
          "Visita presencial",
          "Site",
          "Videochamada",
        ],
      },
    ],
  },
  {
    title: "Sua direção",
    headline: "Vamos dar uma direção ao seu marketing.",
    description:
      "Falta pouco. Suas respostas vão se transformar em um diagnóstico, prioridades e missões para colocar em prática.",
    outcome: "Objetivos e prioridades da marca",
    questions: [
      {
        key: "goals",
        label: "O que você quer alcançar nos próximos três meses?",
        required: true,
        placeholder: "Ex.: aumentar agendamentos, lançar um serviço, atrair outro público.",
      },
      {
        key: "challenge",
        label: "Qual é a sua maior dificuldade hoje?",
        required: true,
        placeholder: "O principal obstáculo entre você e esse objetivo.",
      },
      {
        key: "purpose",
        label: "Por que sua empresa existe? (opcional)",
        placeholder: "O propósito que motivou a criação da marca.",
      },
      {
        key: "founderStory",
        label: "Qual é a história dos fundadores? (opcional)",
        placeholder: "Conte o que vale a pena levar para a narrativa da marca.",
      },
      {
        key: "restrictions",
        label: "Há limites ou regras para a comunicação da sua marca? (opcional)",
        placeholder:
          "Termos que não devemos usar, regras profissionais ou cuidados com imagens. Não inclua dados de pacientes.",
      },
    ],
  },
];
export const ESSENTIAL_QUESTIONS = CHAPTERS.flatMap((c) => c.questions).filter((q) => q.required);
export const hasAnswer = (value: unknown) => typeof value === "string" && value.trim().length > 0;
export function chapterMissing(index: number, answers: Answers) {
  return (CHAPTERS[index]?.questions ?? []).filter((q) => q.required && !hasAnswer(answers[q.key]));
}
export function normalizeAnswers(value: unknown): Answers {
  const empty = answersSchema.parse({});
  if (!value || typeof value !== "object") return empty;
  for (const key of Object.keys(empty) as AnswerKey[]) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === "string") empty[key] = candidate;
  }
  return empty;
}
export function foundationProgress(input: {
  company: boolean;
  answers: Answers;
  diagnostic: boolean;
  logo: boolean;
  identity: boolean;
  pendingReportUpdate?: boolean;
}) {
  const answered = ESSENTIAL_QUESTIONS.filter((q) => hasAnswer(input.answers[q.key])).length;
  const earned =
    (input.company ? 10 : 0) +
    answered * 10 +
    (input.diagnostic ? 20 : 0) +
    (input.logo ? 10 : 0) +
    (input.identity ? 10 : 0);
  // Preserve earned work while editing, but reserve completion for a report
  // that actually includes the latest draft.
  const percent = input.pendingReportUpdate ? Math.min(99, earned) : earned;
  return { answered, total: ESSENTIAL_QUESTIONS.length, percent, complete: percent === 100 };
}
export function diagnosticPrompt(answers: Answers) {
  return CHAPTERS.flatMap((c) => c.questions)
    .map((q) => `${q.label}: ${answers[q.key] || "não informado"}`)
    .join("\n");
}

export function diagnosticMatchesAnswers(saved: unknown, current: Answers) {
  const previous = normalizeAnswers(saved);
  return CHAPTERS.every((chapter) =>
    chapter.questions.every(
      (question) => previous[question.key].trim() === current[question.key].trim(),
    ),
  );
}
