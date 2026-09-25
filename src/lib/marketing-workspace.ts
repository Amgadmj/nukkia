import { changeDemoContext, demoSchema, hypothesisSchema, type DemoData } from "./quick-start.ts";
import { answersSchema, normalizeAnswers, type AnswerKey } from "./onboarding.ts";
export { projectChannelReferences } from "./brand-sources.ts";
import {
  briefIssues,
  creativeFingerprint,
  creativeStatus,
  identityReady,
  recommendContent,
  recoverResearch,
  markBrandFieldsEdited,
  updateBrand,
} from "./brand-preview.ts";

export const WORKSPACE_NAV = [
  { id: "painel", to: "/painel", label: "Meu painel", icon: "dashboard" },
  { id: "trilha", to: "/trilha", label: "Minha trilha", icon: "trophy" },
  { id: "cerebro", to: "/diagnostico", label: "Cérebro da marca", icon: "brain" },
  { id: "conteudo", to: "/conteudo", label: "Conteúdo", icon: "calendar" },
  { id: "marca", to: "/marca", label: "Identidade", icon: "palette" },
  { id: "redes", to: "/redes", label: "Canais", icon: "channels" },
  { id: "metricas", to: "/metricas", label: "Resultados", icon: "chart" },
] as const;
export type WorkspaceSection = (typeof WORKSPACE_NAV)[number]["id"];

export function editWorkspaceAnswers(data: DemoData, answers: DemoData["answers"]): DemoData {
  const changed = (Object.keys(answers) as AnswerKey[]).filter(
    (key) => answers[key] !== data.answers[key],
  );
  if (!changed.length) return data;
  const next = changeDemoContext(data, { answers });
  return {
    ...next,
    brand: updateBrand(next.brand, {
      ...markBrandFieldsEdited(next.brand, changed),
      ...(changed.includes("differentials") ? { detail: answers.differentials.slice(0, 600) } : {}),
      ...(changed.includes("website")
        ? { siteAuthorized: false, aiAuthorized: false, referencesConfirmed: "" }
        : {}),
    }),
  };
}

export const MEASUREMENT_OPTIONS = [
  { value: "messages", label: "Mensagens recebidas" },
  { value: "website_clicks", label: "Cliques no site" },
  { value: "reach", label: "Alcance da marca" },
  { value: "saves", label: "Conteúdos salvos" },
  { value: "appointments", label: "Agendamentos confirmados" },
] as const;
export const CHANNEL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "googleBusiness", label: "Perfil da Empresa no Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "website", label: "Site" },
] as const;

export type ChannelRecommendation = {
  value: Exclude<DemoData["strategy"]["channel"], "">;
  label: string;
  reason: string;
};

/**
 * A transparent first recommendation based only on the context the brand supplied.
 * These are starting hypotheses, not measured performance claims.
 */
export function recommendChannels(data: DemoData): ChannelRecommendation[] {
  const context = [
    data.segment,
    data.answers.offers,
    data.answers.audience,
    data.answers.goals,
    data.answers.location,
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  const localService =
    /clínic|clinic|saúde|saude|fisioter|pilates|academ|estúdio|estudio|consult|restaurante|salão|salao|região|regiao|bairro|cidade/.test(
      context,
    );
  const businessAudience =
    /empresa|empresarial|b2b|gestor|gestora|equipe|profissiona|corporativ/.test(context);
  if (businessAudience && !localService)
    return [
      {
        value: "linkedin",
        label: "LinkedIn",
        reason:
          "Uma hipótese inicial para alcançar profissionais e decisores com conteúdo escrito.",
      },
      {
        value: "website",
        label: "Site",
        reason: "Centraliza oferta, provas e próximos passos em um endereço controlado pela marca.",
      },
      {
        value: "instagram",
        label: "Instagram",
        reason: "Pode apoiar reconhecimento visual e mostrar bastidores, equipe e entregas.",
      },
    ];
  return [
    {
      value: "googleBusiness",
      label: "Perfil da Empresa no Google",
      reason: "Ajuda uma operação local a organizar descoberta, localização e contato.",
    },
    {
      value: "instagram",
      label: "Instagram",
      reason: "Uma hipótese para demonstrar ambiente, serviço e confiança de forma visual.",
    },
    {
      value: "website",
      label: "Site",
      reason: "Concentra informações verificadas e oferece um destino estável para campanhas.",
    },
  ];
}

export function essentialDiagnostic(data: DemoData) {
  const completed = [
    data.answers.goals.trim().length >= 3,
    data.answers.offers.trim().length >= 3 && data.answers.audience.trim().length >= 3,
    data.answers.challenge.trim().length >= 3,
    Boolean(data.strategy.metric),
  ].filter(Boolean).length;
  return { completed, total: 4, complete: completed === 4 };
}

export type ContextSearch = {
  editar?: "contexto" | "diagnostico" | undefined;
  retorno?: WorkspaceSection | undefined;
  capitulo?: number | undefined;
};
export function contextSearch(search: Record<string, unknown>): ContextSearch {
  if (search["editar"] !== "contexto" && search["editar"] !== "diagnostico") return {};
  const chapter = Number(search["capitulo"]);
  return {
    editar: search["editar"],
    retorno: WORKSPACE_NAV.some((s) => s.id === search["retorno"])
      ? (search["retorno"] as WorkspaceSection)
      : "painel",
    ...(search["capitulo"] !== undefined && Number.isInteger(chapter) && chapter >= 0 && chapter < 5
      ? { capitulo: chapter }
      : {}),
  };
}

export type CommandPriority = {
  id: string;
  title: string;
  description: string;
  label: string;
  section: WorkspaceSection;
  done: boolean;
};
export function commandPriorities(
  data: DemoData,
  identity?: { logo?: boolean; tone?: boolean },
): CommandPriority[] {
  const diagnosis = essentialDiagnostic(data);
  const items: CommandPriority[] = [];
  if (!diagnosis.complete || !data.brand.confirmed)
    items.push({
      id: "diagnosis",
      title: "Concluir diagnóstico da marca",
      description: `${diagnosis.completed} de 4 decisões definidas. Objetivo, oferta e público, obstáculo e indicador.`,
      label: "Continuar diagnóstico",
      section: "cerebro",
      done: false,
    });
  if (!identityReady(data.brand))
    items.push({
      id: "identity",
      title: "Reunir referências visuais da marca",
      description: identity?.tone
        ? "Seu kit está salvo. Confirme os materiais que devem orientar as próximas peças."
        : "Adicione logo, cores e materiais para adaptar as próximas peças à sua marca.",
      label: "Reunir materiais",
      section: "marca",
      done: false,
    });
  if (diagnosis.complete && data.brand.confirmed && !data.strategy.channel)
    items.push({
      id: "channels",
      title: "Revisar canais recomendados",
      description:
        "A Nukkia usa público, objetivo e presença atual para sugerir onde começar. Você confirma a prioridade.",
      label: "Ver recomendações",
      section: "redes",
      done: false,
    });
  const status = creativeStatus(data);
  if (data.brand.creative || (!briefIssues(data).length && identityReady(data.brand)))
    items.push({
      id: "content",
      title: status.approved
        ? "Levar sua peça para o canal"
        : data.brand.creative
          ? "Retomar sua peça"
          : "Preparar seu conteúdo",
      description: status.approved
        ? "A versão aprovada está disponível para baixar. Publicação manual."
        : "Use o contexto e os materiais da marca no editor.",
      label: status.approved ? "Abrir peça aprovada" : "Abrir conteúdo",
      section: "conteudo",
      done: false,
    });
  if (!items.length)
    items.push({
      id: "context",
      title: "Revisar sua próxima ação",
      description: "Aprofunde o diagnóstico ou ajuste o contexto da próxima peça.",
      label: "Abrir diagnóstico",
      section: "cerebro",
      done: false,
    });
  return items.slice(0, 3);
}

export type MetricSnapshot = { provider: string; captured_for: string; metrics: unknown };
export function dashboardMetrics(records: MetricSnapshot[], preferred: string) {
  const labels: Record<string, string> = {
    messages: "Mensagens",
    website_clicks: "Cliques no site",
    reach: "Alcance",
    saves: "Salvamentos",
    profile_visits: "Visitas ao perfil",
    appointments: "Agendamentos confirmados",
  };
  const dated = records
    .filter(
      (r) =>
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.captured_for) &&
        Number.isFinite(Date.parse(r.captured_for)) &&
        new Date(r.captured_for).toISOString().startsWith(r.captured_for) &&
        r.provider.trim(),
    )
    .sort((a, b) => b.captured_for.localeCompare(a.captured_for));
  const latest = dated.filter(
    (r, i) => dated.findIndex((row) => row.provider === r.provider) === i,
  );
  const keys = [...new Set([preferred, "reach", "website_clicks", "saves"])].filter(
    (key) => key in labels,
  );
  const cards: { key: string; label: string; value: number; provider: string; period: string }[] =
    [];
  for (const key of keys)
    for (const record of latest) {
      if (!record.metrics || typeof record.metrics !== "object" || Array.isArray(record.metrics))
        continue;
      const value = (record.metrics as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0)
        cards.push({
          key,
          label: labels[key]!,
          value,
          provider: record.provider,
          period: record.captured_for,
        });
    }
  return cards.slice(0, 3);
}

// Journey credit records completed setup, not permission to use unconfirmed
// claims. Content approval continues to use briefIssues/creativeStatus.
function currentMilestones(data: DemoData) {
  const delivery = creativeStatus(data);
  const completedOnboarding =
    data.onboarded &&
    [data.name, data.segment, data.answers.audience, data.answers.offers, data.answers.goals].every(
      (value) => value.trim().length >= 2,
    );
  const context = data.brand.confirmed || completedOnboarding;
  const direction = !!data.brand.visualStyle;
  const identity = identityReady(data.brand);
  return {
    context,
    contextNeedsReview: context && !data.brand.confirmed,
    direction,
    identity,
    approved: delivery.approved,
    exported: delivery.exported,
  };
}

const MILESTONE_XP = {
  context: 20,
  direction: 10,
  identity: 20,
  approved: 40,
  exported: 30,
} as const;
type Milestone = keyof typeof MILESTONE_XP;
function earnedMilestones(data: DemoData) {
  const current = currentMilestones(data);
  const earned = new Set<Milestone>(data.achievements);
  for (const key of Object.keys(MILESTONE_XP) as Milestone[]) if (current[key]) earned.add(key);
  // Legacy first-value events are evidence of prior approved/exported versions,
  // not permission to approve the current version.
  if (data.events.some((event) => event.type === "approved" && event.fingerprint))
    earned.add("approved");
  if (
    data.events.some(
      (event) =>
        event.type === "exported" &&
        event.fingerprint &&
        data.events.some(
          (approval) =>
            approval.type === "approved" &&
            approval.fingerprint === event.fingerprint &&
            approval.at <= event.at,
        ),
    )
  )
    earned.add("exported");
  return earned;
}
export function retainWorkspaceAchievements(previous: DemoData, next: DemoData): DemoData {
  const achievements = [...new Set([...earnedMilestones(previous), ...earnedMilestones(next)])];
  return achievements.length === next.achievements.length &&
    achievements.every((key) => next.achievements.includes(key))
    ? next
    : { ...next, achievements };
}
export function journeyProgress(data: DemoData) {
  const current = currentMilestones(data);
  const earned = earnedMilestones(data);
  return {
    ...current,
    earned: [...earned],
    xp: [...earned].reduce((sum, key) => sum + MILESTONE_XP[key], 0),
    completed: (Object.keys(MILESTONE_XP) as Milestone[]).filter((key) => current[key]).length,
    total: 5,
  };
}

export function saveHypothesis(
  data: DemoData,
  input: { id: string; text: string; source: "user" | "suggestion" },
): DemoData {
  const item = hypothesisSchema.parse(input);
  const existing = data.hypotheses.some((h) => h.id === item.id);
  if (!existing && data.hypotheses.length >= 30)
    throw new Error("Você já tem 30 hipóteses. Edite uma delas para continuar.");
  return {
    ...data,
    hypotheses: existing
      ? data.hypotheses.map((h) => (h.id === item.id ? item : h))
      : [...data.hypotheses, item],
  };
}

export function removeHypothesis(data: DemoData, id: string): DemoData {
  return { ...data, hypotheses: data.hypotheses.filter((h) => h.id !== id) };
}

export type WorkspaceNotification = {
  id: string;
  title: string;
  description: string;
  section: WorkspaceSection;
};
export function workspaceNotifications(data: DemoData): WorkspaceNotification[] {
  const notices: WorkspaceNotification[] = [];
  const status = creativeStatus(data);
  if (data.brand.research.status === "unavailable")
    notices.push({
      id: "research",
      title: "Leitura do site incompleta",
      description: "Confira as referências ou tente a leitura novamente.",
      section: "cerebro",
    });
  if (journeyProgress(data).contextNeedsReview)
    notices.push({
      id: "context",
      title: "Contexto atualizado",
      description: "Revise as informações da marca antes de preparar uma peça.",
      section: "cerebro",
    });
  if (data.brand.creative && !status.approved)
    notices.push({
      id: "review",
      title: "Peça aguardando revisão",
      description: status.stale
        ? "O contexto mudou desde a criação deste rascunho."
        : "Confira o texto e a arte antes de aprovar.",
      section: "conteudo",
    });
  if (status.approved && !status.exported)
    notices.push({
      id: "download",
      title: "Peça aprovada",
      description: "A arte e a legenda estão disponíveis para baixar.",
      section: "conteudo",
    });
  return notices;
}
export const WORKSPACE_PREFIX = "nukkia:workspace:v1:";
export const workspaceKey = (ownerId: string, companyId?: string) =>
  `${WORKSPACE_PREFIX}${ownerId}:${companyId || "new"}`;

export const recoveryOwnerPrefix = (ownerId: string) =>
  `nukkia:workspace-recovery:v1:${encodeURIComponent(ownerId)}:`;

export function seedWorkspace(
  company?: {
    name: string;
    segment: string | null;
    website: string | null;
    instagram_handle?: string | null;
    linkedin_url?: string | null;
  } | null,
  answers?: unknown,
): DemoData {
  const previous = normalizeAnswers(answers);
  previous.website ||= company?.website ?? "";
  previous.instagram ||= company?.instagram_handle ?? "";
  previous.linkedin ||= company?.linkedin_url ?? "";
  for (const key of Object.keys(previous) as AnswerKey[]) {
    const limit = answersSchema.shape[key].removeDefault().maxLength ?? 1000;
    const value = previous[key].trim();
    previous[key] = ["website", "instagram", "linkedin", "googleBusiness"].includes(key)
      ? value.length <= limit
        ? value
        : ""
      : value.slice(0, limit);
  }
  const reference = company?.website?.trim() ?? "";
  return demoSchema.parse({
    name: company?.name.trim().slice(0, 120) ?? "",
    segment: company?.segment?.trim().slice(0, 120) ?? "",
    answers: previous,
    brand: {
      referenceUrl: reference.length <= 2048 ? reference : "",
      detail: previous.differentials.slice(0, 600),
    },
  });
}

export function recordWorkspaceEvent(
  data: DemoData,
  type: DemoData["events"][number]["type"],
  at = new Date().toISOString(),
): DemoData {
  const fingerprint = type === "started" ? "" : creativeFingerprint(data);
  const status = creativeStatus(data);
  if (type === "approved" && !status.approved) return data;
  if (type === "exported" && !status.exported) return data;
  if (data.events.some((event) => event.type === type && event.fingerprint === fingerprint))
    return data;
  // Preserve first-value history while bounding later edits.
  const events =
    data.events.length >= 200
      ? [...data.events.slice(0, 3), ...data.events.slice(-196)]
      : data.events;
  return { ...data, events: [...events, { type, at, fingerprint }] };
}

export function firstValueMinutes(data: DemoData): number | null {
  const start = data.events.find((event) => event.type === "started");
  const exported = data.events.find(
    (event) =>
      event.type === "exported" &&
      data.events.some(
        (approval) =>
          approval.type === "approved" &&
          approval.fingerprint === event.fingerprint &&
          approval.at <= event.at,
      ),
  );
  if (!start || !exported) return null;
  const difference = Date.parse(exported.at) - Date.parse(start.at);
  return difference >= 0 ? Math.round(difference / 6000) / 10 : null;
}

export function workspaceGaps(data: DemoData, identity?: { logo?: boolean; tone?: boolean }) {
  return [
    {
      missing: !data.brand.confirmed,
      title: "Confirmar o contexto da marca",
      why: "Uma base revisada orienta a recomendação e evita afirmações incorretas.",
      section: "cerebro" as const,
    },
    {
      missing: !data.answers.offers.trim(),
      title: "Escolher uma oferta",
      why: "Uma oferta específica torna a primeira mensagem mais útil.",
      section: "cerebro" as const,
    },
    {
      missing: !data.answers.audience.trim(),
      title: "Descrever seu público",
      why: "Ajude a mensagem a falar com quem se beneficia da oferta.",
      section: "cerebro" as const,
    },
    {
      missing: data.brand.detail.trim().length < 12,
      title: "Adicionar um detalhe concreto",
      why: "Um detalhe real dá substância à peça e diferencia sua comunicação.",
      section: "cerebro" as const,
    },
    {
      missing: !data.brand.logo && !identity?.logo,
      title: "Adicionar sua logomarca",
      why: "Sua próxima peça já pode carregar a identidade da empresa.",
      section: "marca" as const,
    },
    {
      missing: !data.brand.photo,
      title: "Adicionar uma foto própria",
      why: "Desbloqueie a abordagem de confiança com uma imagem do seu negócio.",
      section: "conteudo" as const,
    },
    {
      missing: !data.brand.customerQuestion.trim(),
      title: "Registrar uma dúvida de cliente",
      why: "Uma pergunta real ajuda a escolher o próximo conteúdo educativo.",
      section: "cerebro" as const,
    },
  ].filter((gap) => gap.missing);
}

export function nextWorkspaceAction(data: DemoData) {
  const status = creativeStatus(data);
  if (briefIssues(data).length)
    return {
      label: "Completar meu contexto",
      title: "Dê uma direção à sua primeira peça.",
      section: "cerebro" as const,
    };
  if (status.stale)
    return {
      label: "Revisar minha peça",
      title: "Seu contexto evoluiu. Sua peça pode acompanhar.",
      section: "conteudo" as const,
    };
  if (status.exported)
    return {
      label: "Explorar minha trilha",
      title: "Sua primeira entrega abriu o caminho.",
      section: "trilha" as const,
    };
  if (status.approved)
    return {
      label: "Baixar arte e legenda",
      title: "Sua peça está aprovada. Leve para o mundo.",
      section: "conteudo" as const,
    };
  if (data.brand.creative)
    return {
      label: "Revisar minha peça",
      title: "Dê seu toque à primeira publicação.",
      section: "conteudo" as const,
    };
  if (!identityReady(data.brand))
    return {
      label: "Personalizar meu primeiro post",
      title: "Vamos dar forma à sua marca.",
      section: "marca" as const,
    };
  return {
    label: "Escolher uma abordagem",
    title:
      recommendContent(data).approach === "educate"
        ? "Ajude seu público a entender sua oferta."
        : "Transforme sua oferta em uma próxima ação.",
    section: "conteudo" as const,
  };
}

export type StoredWorkspace = { data: DemoData; revision: string | null; dirty: boolean };
export function parseStoredWorkspace(raw: string | null): StoredWorkspace | null {
  try {
    const value = JSON.parse(raw || "null");
    const parsed = demoSchema.safeParse(value?.data);
    if (
      !parsed.success ||
      !(value.revision === null || typeof value.revision === "string") ||
      typeof value.dirty !== "boolean"
    )
      return null;
    parsed.data.brand.research = recoverResearch(parsed.data.brand.research);
    return { data: parsed.data, revision: value.revision, dirty: value.dirty };
  } catch {
    return null;
  }
}
