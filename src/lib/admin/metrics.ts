/**
 * Business metrics for the admin panel, computed from a snapshot of the
 * database. Pure and deterministic: the same snapshot always gives the same
 * numbers, which is what the tests pin down. Costs are the standard costs
 * booked per action in `ai_usage.est_cost_usd`, not provider invoices.
 */
import { PLANS, PLAN_KEYS, isPlanKey, type PlanKey } from "../pricing/catalog.ts";
import {
  ALARM_MARGIN,
  TARGET_MARGIN,
  feeUsd,
  netRevenueUsd,
  planMargin,
  type Assumptions,
} from "../pricing/economics.ts";
import type { AdminAlert, AdminData, CostGroup, SubscriptionRow, UsageRow } from "./types.ts";

const DAY = 86_400_000;
const LIVE = new Set(["active", "past_due"]);

/** A subscription that pays us: active or late, and not a design-partner trial. */
export function isPaying(sub: SubscriptionRow): boolean {
  return LIVE.has(sub.status) && !sub.is_design_partner;
}

export function monthlyBrl(
  sub: Pick<SubscriptionRow, "amount_cents" | "billing_interval">,
): number {
  return sub.amount_cents / 100 / (sub.billing_interval === "year" ? 12 : 1);
}

export function costGroup(kind: string): CostGroup {
  if (kind === "video_render") return "video";
  if (kind === "arte" || kind === "carrossel") return "images";
  return "text";
}

export const dayKey = (date: Date | string): string => new Date(date).toISOString().slice(0, 10);

function within(iso: string, now: Date, days: number): boolean {
  const t = new Date(iso).getTime();
  return t > now.getTime() - days * DAY && t <= now.getTime();
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

// --- Revenue ----------------------------------------------------------------

export type Overview = {
  mrrBrl: number;
  arrBrl: number;
  /** Net monthly revenue after tax, USD. */
  netMrrUsd: number;
  payingCustomers: number;
  pastDue: number;
  pilots: number;
  freeCompanies: number;
  totalCompanies: number;
  planMix: Record<PlanKey, number>;
  /** New and lost MRR over the last 30 days, in reais. */
  newMrrBrl: number;
  churnedMrrBrl: number;
  /** Customers who canceled in 30 days divided by customers paying at the start of the window. */
  logoChurn30: number | null;
  costUsd30: number;
  costByGroup30: Record<CostGroup, number>;
  /** Cost of serving companies that do not pay: free users and pilots. */
  investmentUsd30: number;
  feesUsd: number;
  grossProfitUsd: number;
  /** Gross margin on net revenue, after standard AI cost, card fees and infrastructure. Null with no revenue. */
  grossMargin: number | null;
  renders30: number;
  videosDelivered30: number;
  /** Renders per delivered video. Null until a video is delivered. */
  yield30: number | null;
  videoBalanceUnits: number;
};

export function computeOverview(data: AdminData): Overview {
  const { now, subscriptions, assumptions: a } = data;
  const paying = subscriptions.filter(isPaying);
  const mrrBrl = sum(paying.map(monthlyBrl));
  const netMrrUsd = sum(
    paying.map((s) =>
      netRevenueUsd(s.amount_cents, s.billing_interval === "year" ? "year" : "month", a),
    ),
  );
  const feesUsd = sum(
    paying.map((s) => feeUsd(s.amount_cents, s.billing_interval === "year" ? "year" : "month", a)),
  );

  const usage30 = data.usage.filter((u) => within(u.created_at, now, 30));
  const costByGroup30: Record<CostGroup, number> = { text: 0, images: 0, video: 0 };
  for (const u of usage30) costByGroup30[costGroup(u.kind)] += Number(u.est_cost_usd);
  const costUsd30 = costByGroup30.text + costByGroup30.images + costByGroup30.video;

  const payingIds = new Set(paying.map((s) => s.company_id));
  const investmentUsd30 = sum(
    usage30.filter((u) => !payingIds.has(u.company_id)).map((u) => Number(u.est_cost_usd)),
  );

  const infraUsd = a.infraUsdPerCompany * payingIds.size;
  const grossProfitUsd = netMrrUsd - feesUsd - costUsd30 - infraUsd;
  const grossMargin =
    netMrrUsd > 0
      ? (netMrrUsd - feesUsd - (costUsd30 - investmentUsd30) - infraUsd) / netMrrUsd
      : null;

  const planMix: Record<PlanKey, number> = { free: 0, essencial: 0, pro: 0 };
  const liveByCompany = new Map<string, SubscriptionRow>();
  for (const s of subscriptions) {
    if (["trialing", "active", "past_due"].includes(s.status)) liveByCompany.set(s.company_id, s);
  }
  for (const c of data.companies) {
    const live = liveByCompany.get(c.id);
    const plan = live && isPlanKey(live.plan_key) ? live.plan_key : "free";
    planMix[plan] += 1;
  }

  const started30 = subscriptions.filter(
    (s) =>
      !s.is_design_partner &&
      s.started_at &&
      within(s.started_at, now, 30) &&
      s.status !== "trialing",
  );
  const canceled30 = subscriptions.filter(
    (s) => !s.is_design_partner && s.started_at && s.canceled_at && within(s.canceled_at, now, 30),
  );
  const payingAtStart = subscriptions.filter(
    (s) =>
      !s.is_design_partner &&
      s.started_at &&
      new Date(s.started_at).getTime() <= now.getTime() - 30 * DAY &&
      (!s.canceled_at || new Date(s.canceled_at).getTime() > now.getTime() - 30 * DAY),
  );

  const renders30 = usage30.filter((u) => u.kind === "video_render").length;
  const videosDelivered30 = data.videoItems.filter(
    (v) => v.video_path && within(v.created_at, now, 30),
  ).length;

  return {
    mrrBrl,
    arrBrl: mrrBrl * 12,
    netMrrUsd,
    payingCustomers: payingIds.size,
    pastDue: subscriptions.filter((s) => s.status === "past_due" && !s.is_design_partner).length,
    pilots: subscriptions.filter((s) => s.status === "trialing").length,
    freeCompanies: planMix.free,
    totalCompanies: data.companies.length,
    planMix,
    newMrrBrl: sum(started30.map(monthlyBrl)),
    churnedMrrBrl: sum(canceled30.map(monthlyBrl)),
    logoChurn30: payingAtStart.length > 0 ? canceled30.length / payingAtStart.length : null,
    costUsd30,
    costByGroup30,
    investmentUsd30,
    feesUsd,
    grossProfitUsd,
    grossMargin,
    renders30,
    videosDelivered30,
    yield30: videosDelivered30 > 0 ? renders30 / videosDelivered30 : null,
    videoBalanceUnits: sum(
      data.lots
        .filter((l) => !l.expires_at || new Date(l.expires_at).getTime() > now.getTime())
        .map((l) => l.units_remaining),
    ),
  };
}

// --- Time series -----------------------------------------------------------

export type DayPoint = { date: string };

/** Paying MRR in reais at the end of each of the last `days` days. */
export function mrrSeries(
  data: AdminData,
  days: number,
): (DayPoint & { mrr: number; customers: number })[] {
  const out: (DayPoint & { mrr: number; customers: number })[] = [];
  const subs = data.subscriptions.filter((s) => !s.is_design_partner && s.started_at);
  for (let i = days - 1; i >= 0; i--) {
    const end = new Date(data.now.getTime() - i * DAY);
    const t = end.getTime();
    const active = subs.filter(
      (s) =>
        new Date(s.started_at!).getTime() <= t &&
        (!s.canceled_at || new Date(s.canceled_at).getTime() > t) &&
        s.status !== "trialing",
    );
    out.push({ date: dayKey(end), mrr: sum(active.map(monthlyBrl)), customers: active.length });
  }
  return out;
}

/** Standard cost per day, split into text, images and video, in dollars. */
export function costSeries(
  usage: UsageRow[],
  now: Date,
  days: number,
): (DayPoint & Record<CostGroup, number>)[] {
  const buckets = new Map<string, Record<CostGroup, number>>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(now.getTime() - i * DAY)), { text: 0, images: 0, video: 0 });
  }
  for (const u of usage) {
    const bucket = buckets.get(dayKey(u.created_at));
    if (bucket) bucket[costGroup(u.kind)] += Number(u.est_cost_usd);
  }
  return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
}

// --- Per customer ----------------------------------------------------------

export type CustomerRow = {
  companyId: string;
  name: string;
  segment: string | null;
  email: string | null;
  plan: PlanKey;
  status: string;
  isDesignPartner: boolean;
  mrrBrl: number;
  cost30Usd: number;
  renders30: number;
  videosDelivered30: number;
  videoBalance: number;
  /** Gross margin 30d for paying customers; null for free users and pilots. */
  margin: number | null;
  createdAt: string;
  lastActiveAt: string | null;
};

export function customerRows(data: AdminData): CustomerRow[] {
  const { now, assumptions: a } = data;
  const emailByOwner = new Map(data.profiles.map((p) => [p.id, p.email]));
  const liveByCompany = new Map<string, SubscriptionRow>();
  for (const s of data.subscriptions) {
    if (["pending", "trialing", "active", "past_due"].includes(s.status))
      liveByCompany.set(s.company_id, s);
  }
  const usageByCompany = new Map<string, UsageRow[]>();
  for (const u of data.usage) {
    const list = usageByCompany.get(u.company_id) ?? [];
    list.push(u);
    usageByCompany.set(u.company_id, list);
  }
  const videosByCompany = new Map<string, number>();
  for (const v of data.videoItems) {
    if (v.video_path && within(v.created_at, now, 30))
      videosByCompany.set(v.company_id, (videosByCompany.get(v.company_id) ?? 0) + 1);
  }
  const balanceByCompany = new Map<string, number>();
  for (const l of data.lots) {
    if (!l.expires_at || new Date(l.expires_at).getTime() > now.getTime()) {
      balanceByCompany.set(
        l.company_id,
        (balanceByCompany.get(l.company_id) ?? 0) + l.units_remaining,
      );
    }
  }

  return data.companies.map((c) => {
    const sub = liveByCompany.get(c.id);
    const usage = usageByCompany.get(c.id) ?? [];
    const recent = usage.filter((u) => within(u.created_at, now, 30));
    const cost30Usd = sum(recent.map((u) => Number(u.est_cost_usd)));
    const paying = sub ? isPaying(sub) : false;
    const interval = sub?.billing_interval === "year" ? "year" : "month";
    const net = sub && paying ? netRevenueUsd(sub.amount_cents, interval, a) : 0;
    const margin =
      paying && sub && net > 0
        ? (net - feeUsd(sub.amount_cents, interval, a) - cost30Usd - a.infraUsdPerCompany) / net
        : null;
    const last = usage.reduce<string | null>(
      (max, u) => (max === null || u.created_at > max ? u.created_at : max),
      null,
    );
    return {
      companyId: c.id,
      name: c.name,
      segment: c.segment,
      email: emailByOwner.get(c.owner_id) ?? null,
      plan: sub && isPlanKey(sub.plan_key) ? sub.plan_key : "free",
      status: sub?.status ?? "free",
      isDesignPartner: sub?.is_design_partner ?? false,
      mrrBrl: sub && paying ? monthlyBrl(sub) : 0,
      cost30Usd,
      renders30: recent.filter((u) => u.kind === "video_render").length,
      videosDelivered30: videosByCompany.get(c.id) ?? 0,
      videoBalance: balanceByCompany.get(c.id) ?? 0,
      margin,
      createdAt: c.created_at,
      lastActiveAt: last,
    };
  });
}

// --- Price ladder ----------------------------------------------------------

export type LadderStep = {
  priceId: string;
  plan: PlanKey;
  interval: "month" | "year";
  cohort: string;
  amountCents: number;
  seats: number;
  taken: number;
  worstMargin: number | null;
  expectedMargin: number | null;
  status: string;
};

/** Seats taken mirror the database: a started subscription or a checkout opened in the last two hours. */
export function ladder(data: AdminData): LadderStep[] {
  const taken = new Map<string, number>();
  for (const s of data.subscriptions) {
    if (!s.price_registry_id) continue;
    const counts =
      s.started_at !== null ||
      (s.status === "pending" &&
        new Date(s.created_at).getTime() > data.now.getTime() - 2 * 3_600_000);
    if (counts) taken.set(s.price_registry_id, (taken.get(s.price_registry_id) ?? 0) + 1);
  }
  return data.prices
    .map((p) => ({
      priceId: p.id,
      plan: (isPlanKey(p.plan_key) ? p.plan_key : "free") as PlanKey,
      interval: (p.billing_interval === "year" ? "year" : "month") as "month" | "year",
      cohort: p.cohort_key,
      amountCents: p.amount_cents,
      seats: p.seats,
      taken: taken.get(p.id) ?? 0,
      worstMargin: p.worst_margin,
      expectedMargin: p.expected_margin,
      status: p.status,
    }))
    .sort(
      (x, y) =>
        x.plan.localeCompare(y.plan) ||
        x.interval.localeCompare(y.interval) ||
        x.amountCents - y.amountCents,
    );
}

// --- Alerts: the pricing plan's scorecard ----------------------------------

/**
 * The triggers agreed in the pricing plan, evaluated on live numbers: margin
 * under the alarm line, render yield over 2.3, a client over its AI-cost cap,
 * past-due payments, failed webhooks, and a price step about to sell out.
 */
export function alerts(
  data: AdminData,
  overview: Overview,
  customers: CustomerRow[],
): AdminAlert[] {
  const out: AdminAlert[] = [];
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  if (overview.grossMargin !== null && overview.grossMargin < ALARM_MARGIN) {
    out.push({
      id: "margin-alarm",
      level: overview.grossMargin < 0.4 ? "critical" : "warning",
      title: `Margem bruta de ${pct(overview.grossMargin)} nos últimos 30 dias`,
      detail: `Abaixo do alarme de ${pct(ALARM_MARGIN)}. Revise preços e o rendimento de vídeo.`,
      href: "/admin/receita",
    });
  } else if (overview.grossMargin !== null && overview.grossMargin < TARGET_MARGIN) {
    out.push({
      id: "margin-target",
      level: "info",
      title: `Margem bruta de ${pct(overview.grossMargin)}, abaixo da meta de ${pct(TARGET_MARGIN)}`,
      detail: "Ainda acima do alarme. Acompanhe o rendimento de vídeo.",
      href: "/admin/receita",
    });
  }

  if (overview.yield30 !== null && overview.yield30 > 2.3) {
    out.push({
      id: "yield",
      level: overview.yield30 > 3 ? "critical" : "warning",
      title: `Rendimento de vídeo de ${overview.yield30.toFixed(1)} renderizações por vídeo`,
      detail:
        "A meta é 1,8. Acima de 2,3 a margem do Pro cai abaixo de 65%. Melhore prompts e a checagem de qualidade.",
      href: "/admin/uso",
    });
  }

  const proCap = PLANS.pro.monthly.video_render;
  for (const c of customers) {
    if (c.plan === "pro" && c.renders30 >= proCap) {
      out.push({
        id: `cap-${c.companyId}`,
        level: "info",
        title: `${c.name} usou todas as ${proCap} renderizações do mês`,
        detail: "O limite técnico protege a margem. Considere oferecer um vídeo extra.",
        href: "/admin/clientes",
      });
    }
    if (c.margin !== null && c.margin < 0.4) {
      out.push({
        id: `margin-${c.companyId}`,
        level: "warning",
        title: `${c.name} está com margem de ${pct(c.margin)}`,
        detail: "Abaixo do piso de 40% neste cliente nos últimos 30 dias.",
        href: "/admin/clientes",
      });
    }
  }

  if (overview.pastDue > 0) {
    out.push({
      id: "past-due",
      level: "warning",
      title: `${overview.pastDue} ${overview.pastDue === 1 ? "assinatura" : "assinaturas"} com pagamento atrasado`,
      detail: "O plano segue ativo por 7 dias de carência e depois volta para o gratuito.",
      href: "/admin/cobrancas",
    });
  }

  const failed = data.events.filter((e) => e.status === "failed").length;
  if (failed > 0) {
    out.push({
      id: "events-failed",
      level: "critical",
      title: `${failed} ${failed === 1 ? "evento de cobrança falhou" : "eventos de cobrança falharam"}`,
      detail: "O Asaas tenta de novo; se continuar, confira o registro e o token do webhook.",
      href: "/admin/cobrancas",
    });
  }

  for (const step of ladder(data)) {
    if (step.status === "published" && step.plan !== "free" && step.interval === "month") {
      const left = step.seats - step.taken;
      if (left <= 2 && left >= 0 && step.taken > 0) {
        out.push({
          id: `seats-${step.priceId}`,
          level: "info",
          title: `Restam ${left} ${left === 1 ? "vaga" : "vagas"} no degrau ${step.cohort} do ${PLANS[step.plan].name}`,
          detail: "Quando acabar, o preço sobe para o próximo degrau público.",
          href: "/admin/precos",
        });
      }
    }
  }

  if (data.prices.filter((p) => p.status === "published").length === 0) {
    out.push({
      id: "no-prices",
      level: "critical",
      title: "Nenhum preço publicado",
      detail: "Ninguém consegue assinar até os preços de lançamento serem publicados.",
      href: "/admin/precos",
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((x, y) => order[x.level] - order[y.level]);
}

// --- Unit economics by plan -------------------------------------------------

export type PlanEconomics = {
  plan: PlanKey;
  priceCents: number | null;
  worstMargin: number | null;
  expectedMargin: number | null;
  /** Average real margin across paying customers on this plan (last 30 days), or null. */
  actualMargin: number | null;
  customers: number;
};

export function planEconomics(data: AdminData, customers: CustomerRow[]): PlanEconomics[] {
  return PLAN_KEYS.map((plan) => {
    const sub = data.subscriptions.find((s) => s.plan_key === plan && isPaying(s));
    const margins = customers
      .filter((c) => c.plan === plan && c.margin !== null)
      .map((c) => c.margin as number);
    const monthlyCents = sub ? Math.round(monthlyBrl(sub) * 100) : null;
    return {
      plan,
      priceCents: monthlyCents,
      worstMargin:
        plan !== "free" && monthlyCents
          ? planMargin(plan, monthlyCents, "month", data.assumptions, "worst").margin
          : null,
      expectedMargin:
        plan !== "free" && monthlyCents
          ? planMargin(plan, monthlyCents, "month", data.assumptions, "expected").margin
          : null,
      actualMargin: margins.length > 0 ? sum(margins) / margins.length : null,
      customers: customers.filter((c) => c.plan === plan && c.mrrBrl > 0).length,
    };
  });
}

export type { Assumptions };
