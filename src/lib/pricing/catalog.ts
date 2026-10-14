/**
 * The product catalog: plans, their monthly quotas and the standard unit costs
 * that price them. Pure data, no I/O, imported by the quota gate, the price
 * registry, the checkout flow and the admin panel so that all of them agree.
 *
 * Source of the numbers: Nukkia pricing plan v1 (14 Oct 2026). Unit costs are
 * "standard costs": estimates from provider list prices that the ledger books
 * per action until real invoices replace them.
 */

export const PLAN_KEYS = ["free", "essencial", "pro"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const PAID_PLAN_KEYS = ["essencial", "pro"] as const;
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];

export const QUOTA_KINDS = [
  "diagnostico",
  "plano",
  "arte",
  "carrossel",
  "video_storyboard",
  "video_render",
  "pesquisa_empresa",
  "paleta",
] as const;
export type QuotaKind = (typeof QUOTA_KINDS)[number];

export type ImageTier = "base" | "premium";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  /** Monthly (rolling 30 days) cap per metered action. */
  monthly: Record<QuotaKind, number>;
  /** Burst guard per rolling 24 hours; never above the monthly cap. */
  daily: Record<QuotaKind, number>;
  /** Image model tier used by this plan for single images and carousel slides. */
  imageTier: ImageTier;
  /** Finished 15-second videos granted each month. */
  includedVideos: number;
  /** What the pricing page promises, in the customer's words. */
  promises: string[];
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Grátis",
    monthly: {
      diagnostico: 1,
      plano: 1,
      arte: 20,
      carrossel: 2,
      video_storyboard: 0,
      video_render: 0,
      pesquisa_empresa: 3,
      paleta: 3,
    },
    daily: {
      diagnostico: 1,
      plano: 1,
      arte: 10,
      carrossel: 2,
      video_storyboard: 0,
      video_render: 0,
      pesquisa_empresa: 3,
      paleta: 3,
    },
    imageTier: "base",
    includedVideos: 0,
    promises: [
      "Janela gratuita de 30 dias",
      "Cérebro da marca e relatório de diagnóstico",
      "1 plano de conteúdo",
      "2 carrosséis",
      "20 imagens com IA",
    ],
  },
  essencial: {
    key: "essencial",
    name: "Essencial",
    monthly: {
      diagnostico: 2,
      plano: 2,
      arte: 40,
      carrossel: 4,
      video_storyboard: 0,
      video_render: 0,
      pesquisa_empresa: 6,
      paleta: 6,
    },
    daily: {
      diagnostico: 1,
      plano: 1,
      arte: 15,
      carrossel: 2,
      video_storyboard: 0,
      video_render: 0,
      pesquisa_empresa: 3,
      paleta: 3,
    },
    imageTier: "base",
    includedVideos: 0,
    promises: [
      "1 plano de conteúdo por mês",
      "Atualização trimestral do diagnóstico",
      "4 carrosséis",
      "40 imagens com IA",
      "Posts e vídeos promocionais gerados em código, sem limite",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthly: {
      diagnostico: 3,
      plano: 2,
      arte: 80,
      carrossel: 8,
      video_storyboard: 4,
      video_render: 5,
      pesquisa_empresa: 10,
      paleta: 10,
    },
    daily: {
      diagnostico: 1,
      plano: 1,
      arte: 25,
      carrossel: 3,
      video_storyboard: 2,
      video_render: 2,
      pesquisa_empresa: 4,
      paleta: 4,
    },
    imageTier: "premium",
    includedVideos: 2,
    promises: [
      "Tudo do Essencial",
      "8 carrosséis",
      "80 imagens premium",
      "4 roteiros de vídeo",
      "2 vídeos finalizados de 15 segundos por mês",
    ],
  },
};

/** Slides generated per carousel unit (outline plus up to this many images). */
export const CAROUSEL_SLIDES_MAX = 6;

/** Kinds shown to customers as meters, in display order, with Portuguese labels. */
export const QUOTA_LABELS: Record<QuotaKind, string> = {
  diagnostico: "Diagnósticos",
  plano: "Planos de conteúdo",
  arte: "Imagens com IA",
  carrossel: "Carrosséis",
  video_storyboard: "Roteiros de vídeo",
  video_render: "Renderizações de vídeo",
  pesquisa_empresa: "Pesquisas da empresa",
  paleta: "Paletas de cores",
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return typeof value === "string" && (PAID_PLAN_KEYS as readonly string[]).includes(value);
}

// --- Cohort ladder (public price steps) -----------------------------------

export type CohortKey = "founding" | "early" | "growth";

export type Cohort = {
  key: CohortKey;
  label: string;
  /** Customers 1..seats take this price; later customers take the next cohort. */
  seats: number;
};

export const COHORTS: readonly Cohort[] = [
  { key: "founding", label: "Fundadores (clientes 1 a 10)", seats: 10 },
  { key: "early", label: "Primeira onda (clientes 11 a 25)", seats: 15 },
  { key: "growth", label: "Crescimento (clientes 26 a 50)", seats: 25 },
];

/** Launch prices in centavos of real, per plan, interval and cohort. Annual = 10 monthly payments. */
export const LAUNCH_PRICES: ReadonlyArray<{
  plan: PaidPlanKey;
  interval: "month" | "year";
  cohort: CohortKey;
  amountCents: number;
}> = [
  { plan: "essencial", interval: "month", cohort: "founding", amountCents: 19_700 },
  { plan: "essencial", interval: "year", cohort: "founding", amountCents: 197_000 },
  { plan: "pro", interval: "month", cohort: "founding", amountCents: 49_700 },
  { plan: "pro", interval: "year", cohort: "founding", amountCents: 497_000 },
  { plan: "essencial", interval: "month", cohort: "early", amountCents: 24_700 },
  { plan: "essencial", interval: "year", cohort: "early", amountCents: 247_000 },
  { plan: "pro", interval: "month", cohort: "early", amountCents: 59_700 },
  { plan: "pro", interval: "year", cohort: "early", amountCents: 597_000 },
  { plan: "essencial", interval: "month", cohort: "growth", amountCents: 29_700 },
  { plan: "essencial", interval: "year", cohort: "growth", amountCents: 297_000 },
  { plan: "pro", interval: "month", cohort: "growth", amountCents: 69_700 },
  { plan: "pro", interval: "year", cohort: "growth", amountCents: 697_000 },
];

// --- One-off purchases ------------------------------------------------------

export const PURCHASE_SKUS = ["video_15s", "film_30s"] as const;
export type PurchaseSku = (typeof PURCHASE_SKUS)[number];

export const PURCHASES: Record<
  PurchaseSku,
  { label: string; units: number; priceCents: number; purchasable: boolean }
> = {
  video_15s: {
    label: "Vídeo extra de 15 segundos",
    units: 1,
    priceCents: 17_900,
    purchasable: true,
  },
  // Opens only after the measured render yield passes the launch gate.
  film_30s: {
    label: "Filme cinematográfico de 30 segundos",
    units: 2,
    priceCents: 32_900,
    purchasable: false,
  },
};

export function isPurchaseSku(value: unknown): value is PurchaseSku {
  return typeof value === "string" && (PURCHASE_SKUS as readonly string[]).includes(value);
}
