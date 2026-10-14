/**
 * Unit economics and the margin-floor rule. Pure functions: given a plan, a
 * price and a set of assumptions they return the gross margin and the lowest
 * price that clears a margin target. The server uses `checkPrice` to refuse a
 * price below the hard floor; the admin panel uses the same functions to show
 * what a price does to margin before anyone saves it.
 *
 *   P_min = (C * X + F) / ((1 - t)(1 - m) - f)
 *
 * with variable cost C (USD), FX X (BRL per USD), fixed card fee F (BRL),
 * tax t, card fee f and margin target m.
 */
import {
  CAROUSEL_SLIDES_MAX,
  PLANS,
  PURCHASES,
  type ImageTier,
  type PlanKey,
  type PurchaseSku,
  type QuotaKind,
} from "./catalog.ts";

export const HARD_FLOOR = 0.4;
export const ALARM_MARGIN = 0.55;
export const TARGET_MARGIN = 0.6;

export type Assumptions = {
  /** Reais per dollar. */
  fxBrlPerUsd: number;
  /** Share of gross revenue paid as tax (Simples Nacional). */
  taxRate: number;
  /** Card fee as a share of the charge. */
  cardFeePct: number;
  /** Fixed card fee per charge, in reais. */
  cardFeeFixedBrl: number;
  /** Variable infrastructure per active company per month, USD. */
  infraUsdPerCompany: number;
  /** Price of one Higgsfield credit, USD (pay-as-you-go). */
  usdPerCredit: number;
  /** Credits spent by one 15-second render (720p plus upscale). */
  renderCredits: number;
  /** Renders needed for one kept clip. */
  videoYield: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  fxBrlPerUsd: 5.2,
  taxRate: 0.06, // confirmed by the founders on 14 Oct 2026
  cardFeePct: 0.0399, // estimate, to be confirmed with the processor
  cardFeeFixedBrl: 0.39, // estimate
  infraUsdPerCompany: 0.5,
  usdPerCredit: 0.0627,
  renderCredits: 68.5,
  videoYield: 2.5,
};

// Provider list prices and the standard cost derived from them (USD per kept unit).
export const IMAGE_LIST_USD: Record<ImageTier, number> = { base: 0.0336, premium: 0.067 };
export const IMAGE_RETRY_FACTOR = 1.3;

export const TEXT_UNIT_COST_USD = {
  diagnostico: 0.057,
  plano: 0.084,
  carrossel_outline: 0.0225,
  video_storyboard: 0.0195,
  pesquisa_empresa: 0.027,
  paleta: 0.012,
} as const;

/** Credits for the character sheet, two boards and two 480p tests of a 30-second film. */
export const FILM_FIXED_CREDITS = 49.5;

export function imageUnitUsd(tier: ImageTier): number {
  return IMAGE_LIST_USD[tier] * IMAGE_RETRY_FACTOR;
}

export function renderUsd(a: Assumptions): number {
  return a.renderCredits * a.usdPerCredit;
}

/** Standard cost of one unit of a quota kind for a plan, USD. */
export function unitCostUsd(kind: QuotaKind, plan: PlanKey, a: Assumptions): number {
  const tier = PLANS[plan].imageTier;
  switch (kind) {
    case "arte":
      return imageUnitUsd(tier);
    case "carrossel":
      return TEXT_UNIT_COST_USD.carrossel_outline + CAROUSEL_SLIDES_MAX * imageUnitUsd(tier);
    case "video_render":
      return renderUsd(a);
    case "diagnostico":
      return TEXT_UNIT_COST_USD.diagnostico;
    case "plano":
      return TEXT_UNIT_COST_USD.plano;
    case "video_storyboard":
      return TEXT_UNIT_COST_USD.video_storyboard;
    case "pesquisa_empresa":
      return TEXT_UNIT_COST_USD.pesquisa_empresa;
    case "paleta":
      return TEXT_UNIT_COST_USD.paleta;
  }
}

export type CostMode = "worst" | "expected";

export type CostLine = { kind: QuotaKind; units: number; unitUsd: number; totalUsd: number };

export type PlanCost = {
  lines: CostLine[];
  aiUsd: number;
  videoUsd: number;
  infraUsd: number;
  /** AI plus video plus infrastructure, before card fees. */
  totalUsd: number;
};

/**
 * Cost of serving one company for a month. `worst` uses every cap in full,
 * including all renders. `expected` uses every cap in full except video, which
 * is the included videos times the render yield (never above the render cap).
 */
export function planCost(plan: PlanKey, a: Assumptions, mode: CostMode): PlanCost {
  const def = PLANS[plan];
  const lines: CostLine[] = (Object.keys(def.monthly) as QuotaKind[]).map((kind) => {
    let units = def.monthly[kind];
    if (kind === "video_render" && mode === "expected") {
      units = Math.min(units, def.includedVideos * a.videoYield);
    }
    const unitUsd = unitCostUsd(kind, plan, a);
    return { kind, units, unitUsd, totalUsd: units * unitUsd };
  });
  const videoUsd = lines.find((l) => l.kind === "video_render")?.totalUsd ?? 0;
  const aiUsd = lines.reduce((sum, l) => sum + (l.kind === "video_render" ? 0 : l.totalUsd), 0);
  const infraUsd = a.infraUsdPerCompany;
  return { lines, aiUsd, videoUsd, infraUsd, totalUsd: aiUsd + videoUsd + infraUsd };
}

export type Interval = "month" | "year";

export function monthlyEquivalentBrl(amountCents: number, interval: Interval): number {
  return amountCents / 100 / (interval === "year" ? 12 : 1);
}

/** Net revenue per month after tax, USD. */
export function netRevenueUsd(amountCents: number, interval: Interval, a: Assumptions): number {
  return (monthlyEquivalentBrl(amountCents, interval) * (1 - a.taxRate)) / a.fxBrlPerUsd;
}

/** Card fees per month, USD. An annual charge pays its fixed fee once a year. */
export function feeUsd(amountCents: number, interval: Interval, a: Assumptions): number {
  const monthlyBrl = monthlyEquivalentBrl(amountCents, interval);
  const fixed = a.cardFeeFixedBrl / (interval === "year" ? 12 : 1);
  return (monthlyBrl * a.cardFeePct + fixed) / a.fxBrlPerUsd;
}

export type MarginResult = {
  netUsd: number;
  feeUsd: number;
  costUsd: number;
  grossProfitUsd: number;
  margin: number;
};

export function planMargin(
  plan: PlanKey,
  amountCents: number,
  interval: Interval,
  a: Assumptions,
  mode: CostMode,
): MarginResult {
  const net = netRevenueUsd(amountCents, interval, a);
  const fees = feeUsd(amountCents, interval, a);
  const cost = planCost(plan, a, mode).totalUsd;
  const grossProfitUsd = net - fees - cost;
  return {
    netUsd: net,
    feeUsd: fees,
    costUsd: cost,
    grossProfitUsd,
    margin: net > 0 ? grossProfitUsd / net : 0,
  };
}

/** Lowest monthly-equivalent price, in reais, at which `costUsd` reaches `margin`. */
export function minMonthlyBrl(
  costUsd: number,
  margin: number,
  interval: Interval,
  a: Assumptions,
): number {
  const fixed = a.cardFeeFixedBrl / (interval === "year" ? 12 : 1);
  const denominator = (1 - a.taxRate) * (1 - margin) - a.cardFeePct;
  if (denominator <= 0) return Number.POSITIVE_INFINITY;
  return (costUsd * a.fxBrlPerUsd + fixed) / denominator;
}

/** Lowest price in centavos, for the billing interval, that reaches `margin`. */
export function minPriceCents(
  plan: PlanKey,
  margin: number,
  interval: Interval,
  a: Assumptions,
  mode: CostMode,
): number {
  const monthly = minMonthlyBrl(planCost(plan, a, mode).totalUsd, margin, interval, a);
  return Math.ceil(monthly * (interval === "year" ? 12 : 1) * 100);
}

export type PriceLevel = "blocked" | "alarm" | "below_target" | "ok";

export type PriceCheck = {
  level: PriceLevel;
  /** True when the price may be saved (anything but `blocked`). */
  allowed: boolean;
  worstMargin: number;
  expectedMargin: number;
  /** Lowest price that keeps the worst case at the hard floor. This is what the database stores. */
  floorMinCents: number;
  alarmMinCents: number;
  targetMinCents: number;
  messages: string[];
};

const brl = (cents: number) =>
  `R$${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (value: number) => `${(value * 100).toFixed(1).replace(".", ",")}%`;

export function checkPrice(
  input: { plan: PlanKey; amountCents: number; interval: Interval },
  a: Assumptions,
): PriceCheck {
  const { plan, amountCents, interval } = input;
  const worst = planMargin(plan, amountCents, interval, a, "worst");
  const expected = planMargin(plan, amountCents, interval, a, "expected");
  const floorMinCents = minPriceCents(plan, HARD_FLOOR, interval, a, "worst");
  const alarmMinCents = minPriceCents(plan, ALARM_MARGIN, interval, a, "expected");
  const targetMinCents = minPriceCents(plan, TARGET_MARGIN, interval, a, "expected");

  const messages: string[] = [];
  let level: PriceLevel = "ok";
  if (worst.margin < HARD_FLOOR) {
    level = "blocked";
    messages.push(
      `Margem no pior caso de ${pct(worst.margin)}, abaixo do piso de ${pct(HARD_FLOOR)}. O menor preço permitido é ${brl(floorMinCents)}.`,
    );
  } else if (expected.margin < ALARM_MARGIN) {
    level = "alarm";
    messages.push(
      `Margem esperada de ${pct(expected.margin)}, abaixo do alarme de ${pct(ALARM_MARGIN)}. Para ${pct(TARGET_MARGIN)} o preço é ${brl(targetMinCents)}.`,
    );
  } else if (expected.margin < TARGET_MARGIN) {
    level = "below_target";
    messages.push(
      `Margem esperada de ${pct(expected.margin)}, abaixo da meta de ${pct(TARGET_MARGIN)}. Para a meta o preço é ${brl(targetMinCents)}.`,
    );
  }
  return {
    level,
    allowed: level !== "blocked",
    worstMargin: worst.margin,
    expectedMargin: expected.margin,
    floorMinCents,
    alarmMinCents,
    targetMinCents,
    messages,
  };
}

// --- One-off purchases -------------------------------------------------------

/** Standard cost of one purchase SKU, USD, at the assumed yield. */
export function purchaseCostUsd(sku: PurchaseSku, a: Assumptions): number {
  if (sku === "video_15s") return renderUsd(a) * a.videoYield;
  // 30-second film: fixed pipeline credits plus two renders per kept clip.
  return (FILM_FIXED_CREDITS + 2 * a.renderCredits * a.videoYield) * a.usdPerCredit;
}

export function purchaseMargin(sku: PurchaseSku, priceCents: number, a: Assumptions): number {
  const net = ((priceCents / 100) * (1 - a.taxRate)) / a.fxBrlPerUsd;
  const fees = ((priceCents / 100) * a.cardFeePct + a.cardFeeFixedBrl) / a.fxBrlPerUsd;
  const cost = purchaseCostUsd(sku, a);
  return net > 0 ? (net - fees - cost) / net : 0;
}

export function checkPurchasePrice(
  sku: PurchaseSku,
  priceCents: number,
  a: Assumptions,
): { level: PriceLevel; allowed: boolean; margin: number; floorMinCents: number } {
  const margin = purchaseMargin(sku, priceCents, a);
  const denominator = (1 - a.taxRate) * (1 - HARD_FLOOR) - a.cardFeePct;
  const floorMinCents = Math.ceil(
    ((purchaseCostUsd(sku, a) * a.fxBrlPerUsd + a.cardFeeFixedBrl) / denominator) * 100,
  );
  const level: PriceLevel =
    margin < HARD_FLOOR
      ? "blocked"
      : margin < ALARM_MARGIN
        ? "alarm"
        : margin < TARGET_MARGIN
          ? "below_target"
          : "ok";
  return { level, allowed: level !== "blocked", margin, floorMinCents };
}

/** Purchase catalog price, for callers that only need to know the launch price. */
export function launchPurchasePriceCents(sku: PurchaseSku): number {
  return PURCHASES[sku].priceCents;
}
