/**
 * A deterministic sample database for the admin panel. It exists for tests and
 * for the development-only preview route, so the dashboards can be seen and
 * regression-tested without a live database. Nothing here is ever shown in
 * production: the preview route refuses to render outside development.
 */
import {
  LAUNCH_PRICES,
  PLANS,
  QUOTA_KINDS,
  type PlanKey,
  type QuotaKind,
} from "../pricing/catalog.ts";
import { DEFAULT_ASSUMPTIONS, checkPrice, unitCostUsd } from "../pricing/economics.ts";
import type {
  AdminData,
  BillingEventRow,
  CompanyRow,
  LotRow,
  PriceRow,
  ProfileRow,
  PurchaseRow,
  SubscriptionRow,
  UsageRow,
  VideoItemRow,
} from "./types.ts";

const DAY = 86_400_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const NAMES: [string, string][] = [
  ["Clínica Aurora Dermatologia", "Dermatologia"],
  ["Mendes & Rocha Advogados", "Advocacia"],
  ["Studio Pilates Vitalis", "Pilates"],
  ["Odonto Prime Brasília", "Odontologia"],
  ["Dra. Helena Costa Nutrição", "Nutrição"],
  ["Barros Advocacia Trabalhista", "Advocacia"],
  ["Clínica Vida Plena", "Clínica médica"],
  ["Lima Fisioterapia", "Fisioterapia"],
  ["Sorriso Azul Ortodontia", "Odontologia"],
  ["Ferraz & Dutra Sociedade de Advogados", "Advocacia"],
  ["Espaço Corpo em Movimento", "Pilates"],
  ["Clínica Olhar Atento", "Oftalmologia"],
  ["Dr. Rafael Nunes Cardiologia", "Cardiologia"],
  ["Instituto Bem Viver", "Psicologia"],
  ["Cardoso Previdenciário", "Advocacia"],
  ["Clínica Pele Nova", "Dermatologia"],
  ["Fisio Total Asa Sul", "Fisioterapia"],
  ["Nutri Equilíbrio", "Nutrição"],
  ["Pediatria Crescer", "Pediatria"],
  ["Souza Advogados Associados", "Advocacia"],
  ["Studio Flex Lago Sul", "Pilates"],
  ["Clínica Sorriso & Saúde", "Odontologia"],
  ["Dra. Beatriz Alves Ginecologia", "Ginecologia"],
  ["Reis & Tavares Advocacia", "Advocacia"],
  ["Centro Médico Planalto", "Clínica médica"],
  ["Terapia Integrada", "Psicologia"],
  ["Estética Avançada Marina", "Estética"],
  ["Martins Direito Civil", "Advocacia"],
];

type Spec = {
  plan: PlanKey;
  status: SubscriptionRow["status"];
  interval?: "month" | "year";
  partner?: boolean;
  startedDaysAgo?: number;
  canceledDaysAgo?: number;
  cohort?: "founding" | "early";
};

// First entries are customers worth looking at; the rest are free sign-ups.
const SPECS: Spec[] = [
  { plan: "pro", status: "active", startedDaysAgo: 78, cohort: "founding" },
  { plan: "pro", status: "active", startedDaysAgo: 64, cohort: "founding" },
  { plan: "pro", status: "active", interval: "year", startedDaysAgo: 41, cohort: "founding" },
  { plan: "pro", status: "past_due", startedDaysAgo: 52, cohort: "founding" },
  { plan: "essencial", status: "active", startedDaysAgo: 84, cohort: "founding" },
  { plan: "essencial", status: "active", startedDaysAgo: 70, cohort: "founding" },
  { plan: "essencial", status: "active", startedDaysAgo: 55, cohort: "founding" },
  { plan: "essencial", status: "active", startedDaysAgo: 33, cohort: "founding" },
  { plan: "essencial", status: "active", startedDaysAgo: 21, cohort: "founding" },
  { plan: "essencial", status: "active", startedDaysAgo: 9, cohort: "founding" },
  {
    plan: "essencial",
    status: "canceled",
    startedDaysAgo: 60,
    canceledDaysAgo: 12,
    cohort: "founding",
  },
  { plan: "pro", status: "trialing", partner: true, startedDaysAgo: 24, cohort: "founding" },
  { plan: "pro", status: "trialing", partner: true, startedDaysAgo: 17, cohort: "founding" },
  { plan: "pro", status: "trialing", partner: true, startedDaysAgo: 6, cohort: "founding" },
];

export function makeFixtureData(now = new Date("2026-10-14T15:00:00Z")): AdminData {
  const rand = rng(20261014);
  const a = DEFAULT_ASSUMPTIONS;

  const prices: PriceRow[] = LAUNCH_PRICES.map((row, index) => {
    const check = checkPrice(
      { plan: row.plan, amountCents: row.amountCents, interval: row.interval },
      a,
    );
    return {
      id: `price-${index}`,
      plan_key: row.plan,
      billing_interval: row.interval,
      cohort_key: row.cohort,
      amount_cents: row.amountCents,
      floor_min_cents: check.floorMinCents,
      seats: row.cohort === "founding" ? 10 : row.cohort === "early" ? 15 : 25,
      status: "published",
      worst_margin: check.worstMargin,
      expected_margin: check.expectedMargin,
      assumptions: a as unknown as PriceRow["assumptions"],
      created_by: null,
      created_at: new Date(now.getTime() - 30 * DAY).toISOString(),
      retired_at: null,
    };
  });
  const priceFor = (plan: string, interval: string, cohort: string) =>
    prices.find(
      (p) => p.plan_key === plan && p.billing_interval === interval && p.cohort_key === cohort,
    )!;

  const companies: CompanyRow[] = [];
  const profiles: ProfileRow[] = [];
  const subscriptions: SubscriptionRow[] = [];
  const usage: UsageRow[] = [];
  const videoItems: VideoItemRow[] = [];
  const lots: LotRow[] = [];
  const purchases: PurchaseRow[] = [];

  NAMES.forEach(([name, segment], index) => {
    const id = `company-${String(index + 1).padStart(2, "0")}`;
    const ownerId = `owner-${String(index + 1).padStart(2, "0")}`;
    const spec = SPECS[index];
    const created = new Date(
      now.getTime() - (spec?.startedDaysAgo ?? 3 + Math.floor(rand() * 70)) * DAY - DAY * 2,
    );
    companies.push({
      id,
      name,
      segment,
      owner_id: ownerId,
      created_at: created.toISOString(),
      onboarding_step: index % 5 === 4 ? "brand" : "done",
    });
    profiles.push({
      id: ownerId,
      email: `contato${index + 1}@${name
        .split(" ")[0]!
        .toLowerCase()
        .replace(/[^a-z]/g, "")}.com.br`,
      full_name: null,
    });

    let plan: PlanKey = "free";
    if (spec) {
      plan = spec.plan;
      const interval = spec.interval ?? "month";
      const price = priceFor(spec.plan, interval, spec.cohort ?? "founding");
      const started = new Date(now.getTime() - (spec.startedDaysAgo ?? 0) * DAY);
      subscriptions.push({
        id: `sub-${index + 1}`,
        company_id: id,
        plan_key: spec.plan,
        status: spec.status,
        billing_interval: interval,
        amount_cents: price.amount_cents,
        price_registry_id: price.id,
        cohort_key: spec.cohort ?? "founding",
        is_design_partner: spec.partner ?? false,
        provider: "asaas",
        provider_customer_id: `cus_${index}`,
        provider_subscription_id: spec.partner ? null : `sub_${index}`,
        started_at: started.toISOString(),
        current_period_start: started.toISOString(),
        current_period_end: new Date(started.getTime() + 30 * DAY).toISOString(),
        trial_ends_at: spec.partner ? new Date(started.getTime() + 90 * DAY).toISOString() : null,
        cancel_at_period_end: false,
        canceled_at: spec.canceledDaysAgo
          ? new Date(now.getTime() - spec.canceledDaysAgo * DAY).toISOString()
          : null,
        created_at: started.toISOString(),
        updated_at: started.toISOString(),
      });
    }

    // Usage over the last 60 days, scaled by how engaged the plan is.
    const days = spec?.startedDaysAgo ? Math.min(60, spec.startedDaysAgo) : 20;
    const def = PLANS[plan];
    const engagement = plan === "pro" ? 0.7 : plan === "essencial" ? 0.55 : 0.4;
    for (const kind of QUOTA_KINDS as readonly QuotaKind[]) {
      const monthlyCap = def.monthly[kind];
      if (monthlyCap <= 0) continue;
      const count = Math.round(((monthlyCap * engagement * days) / 30) * (0.7 + rand() * 0.6));
      for (let n = 0; n < count; n++) {
        const at = new Date(now.getTime() - rand() * days * DAY);
        usage.push({
          company_id: id,
          kind,
          created_at: at.toISOString(),
          est_cost_usd: Math.round(unitCostUsd(kind, plan, a) * 10_000) / 10_000,
          plan_key: plan,
        });
      }
    }

    // Videos: delivered clips need roughly yield-many renders; already counted above as video_render usage.
    if (plan === "pro") {
      const delivered = Math.max(
        1,
        Math.round(
          usage.filter((u) => u.company_id === id && u.kind === "video_render").length / 2.2,
        ),
      );
      for (let n = 0; n < delivered; n++) {
        videoItems.push({
          id: `video-${id}-${n}`,
          company_id: id,
          created_at: new Date(now.getTime() - rand() * Math.min(days, 28) * DAY).toISOString(),
          video_path: `${id}/video-${n}.mp4`,
        });
      }
      lots.push({
        company_id: id,
        units_remaining: Math.max(0, 2 - (delivered % 3)),
        expires_at: new Date(now.getTime() + 40 * DAY).toISOString(),
        source: "plan_grant",
      });
    }
  });

  purchases.push({
    id: "purchase-1",
    company_id: "company-05",
    sku: "video_15s",
    units: 1,
    amount_cents: 17_900,
    status: "paid",
    provider_payment_id: "pay_p1",
    invoice_url: null,
    created_at: new Date(now.getTime() - 6 * DAY).toISOString(),
    paid_at: new Date(now.getTime() - 6 * DAY).toISOString(),
  });
  lots.push({
    company_id: "company-05",
    units_remaining: 1,
    expires_at: new Date(now.getTime() + 359 * DAY).toISOString(),
    source: "purchase",
  });

  const eventTypes = [
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_CREATED",
    "PAYMENT_CONFIRMED",
  ];
  const events: BillingEventRow[] = Array.from({ length: 14 }, (_, i) => ({
    id: `event-${i}`,
    provider: "asaas",
    event_id: `evt_${i}`,
    event_type: eventTypes[i % eventTypes.length]!,
    status: i === 3 ? "failed" : i % 6 === 5 ? "ignored" : "processed",
    error: i === 3 ? "timeout aplicando o evento" : null,
    received_at: new Date(now.getTime() - i * 2.5 * DAY).toISOString(),
    processed_at: new Date(now.getTime() - i * 2.5 * DAY + 800).toISOString(),
  }));

  return {
    now,
    companies,
    profiles,
    subscriptions,
    usage,
    purchases,
    videoItems,
    lots,
    events,
    prices,
    assumptions: a,
  };
}
