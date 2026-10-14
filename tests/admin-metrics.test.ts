import test from "node:test";
import assert from "node:assert/strict";
import { makeFixtureData } from "../src/lib/admin/fixtures.ts";
import {
  alerts,
  computeOverview,
  costSeries,
  customerRows,
  isPaying,
  ladder,
  monthlyBrl,
  mrrSeries,
  planEconomics,
} from "../src/lib/admin/metrics.ts";
import type { AdminData, SubscriptionRow } from "../src/lib/admin/types.ts";
import { DEFAULT_ASSUMPTIONS, feeUsd, netRevenueUsd } from "../src/lib/pricing/economics.ts";

const NOW = new Date("2026-10-14T12:00:00Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

function sub(over: Partial<SubscriptionRow> & { id: string; company_id: string }): SubscriptionRow {
  return {
    plan_key: "essencial",
    status: "active",
    billing_interval: "month",
    amount_cents: 19_700,
    price_registry_id: null,
    cohort_key: "founding",
    is_design_partner: false,
    provider: "asaas",
    provider_customer_id: null,
    provider_subscription_id: null,
    started_at: iso(40),
    current_period_start: iso(10),
    current_period_end: iso(-20),
    trial_ends_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: iso(40),
    updated_at: iso(10),
    ...over,
  };
}

function small(): AdminData {
  const companies = ["a", "b", "c"].map((id) => ({
    id,
    name: `Empresa ${id}`,
    segment: null,
    owner_id: `o-${id}`,
    created_at: iso(50),
    onboarding_step: "done",
  }));
  return {
    now: NOW,
    companies,
    profiles: [],
    subscriptions: [
      sub({ id: "s1", company_id: "a", plan_key: "essencial", amount_cents: 19_700 }),
      sub({
        id: "s2",
        company_id: "b",
        plan_key: "pro",
        amount_cents: 497_000,
        billing_interval: "year",
      }),
      sub({
        id: "s3",
        company_id: "c",
        plan_key: "pro",
        status: "trialing",
        is_design_partner: true,
        amount_cents: 49_700,
      }),
    ],
    usage: [
      { company_id: "a", kind: "arte", created_at: iso(2), est_cost_usd: 1, plan_key: "essencial" },
      {
        company_id: "b",
        kind: "video_render",
        created_at: iso(3),
        est_cost_usd: 4.295,
        plan_key: "pro",
      },
      {
        company_id: "b",
        kind: "video_render",
        created_at: iso(4),
        est_cost_usd: 4.295,
        plan_key: "pro",
      },
      { company_id: "b", kind: "plano", created_at: iso(5), est_cost_usd: 0.084, plan_key: "pro" },
      { company_id: "c", kind: "arte", created_at: iso(5), est_cost_usd: 2, plan_key: "pro" },
      {
        company_id: "a",
        kind: "arte",
        created_at: iso(45),
        est_cost_usd: 99,
        plan_key: "essencial",
      },
    ],
    purchases: [],
    videoItems: [{ id: "v1", company_id: "b", created_at: iso(3), video_path: "b/v1.mp4" }],
    lots: [
      { company_id: "b", units_remaining: 1, expires_at: iso(-10), source: "plan_grant" },
      { company_id: "b", units_remaining: 5, expires_at: iso(1), source: "plan_grant" },
    ],
    events: [],
    prices: [],
    assumptions: DEFAULT_ASSUMPTIONS,
  };
}

test("MRR counts paying subscriptions only and converts annual plans to a month", () => {
  const data = small();
  assert.equal(isPaying(data.subscriptions[2]!), false, "a design-partner trial pays nothing");
  assert.equal(monthlyBrl(data.subscriptions[1]!), 497_000 / 100 / 12);
  const overview = computeOverview(data);
  assert.ok(Math.abs(overview.mrrBrl - (197 + 4970 / 12)) < 1e-9);
  assert.equal(overview.arrBrl, overview.mrrBrl * 12);
  assert.equal(overview.payingCustomers, 2);
  assert.equal(overview.pilots, 1);
  assert.deepEqual(overview.planMix, { free: 0, essencial: 1, pro: 2 });
});

test("costs are counted over the last 30 days only, split by group, and pilots are an investment", () => {
  const overview = computeOverview(small());
  assert.ok(
    Math.abs(overview.costUsd30 - (1 + 4.295 * 2 + 0.084 + 2)) < 1e-9,
    "the 45-day-old row is excluded",
  );
  assert.ok(Math.abs(overview.costByGroup30.video - 8.59) < 1e-9);
  assert.ok(Math.abs(overview.costByGroup30.images - 3) < 1e-9);
  assert.ok(Math.abs(overview.investmentUsd30 - 2) < 1e-9, "only the pilot's own cost");
});

test("gross margin is net revenue less card fees, paying customers' cost and infrastructure", () => {
  const data = small();
  const o = computeOverview(data);
  const a = DEFAULT_ASSUMPTIONS;
  const net = netRevenueUsd(19_700, "month", a) + netRevenueUsd(497_000, "year", a);
  const fees = feeUsd(19_700, "month", a) + feeUsd(497_000, "year", a);
  const cost = 1 + 4.295 * 2 + 0.084;
  const expected = (net - fees - cost - a.infraUsdPerCompany * 2) / net;
  assert.ok(Math.abs(o.grossMargin! - expected) < 1e-9);
  assert.ok(o.grossProfitUsd < net - fees - cost, "the pilot's cost comes off blended profit");
});

test("render yield divides renders by delivered videos, and balances ignore expired lots", () => {
  const o = computeOverview(small());
  assert.equal(o.renders30, 2);
  assert.equal(o.videosDelivered30, 1);
  assert.equal(o.yield30, 2);
  assert.equal(
    o.videoBalanceUnits,
    1,
    "the 5-unit lot expired yesterday; the 1-unit lot is good for ten more days",
  );
});

test("new and churned MRR and logo churn use a 30-day window", () => {
  const data = small();
  data.subscriptions.push(
    sub({ id: "s4", company_id: "x", started_at: iso(10), amount_cents: 24_700 }),
    sub({
      id: "s5",
      company_id: "y",
      started_at: iso(60),
      status: "canceled",
      canceled_at: iso(5),
      amount_cents: 19_700,
    }),
  );
  const o = computeOverview(data);
  assert.equal(o.newMrrBrl, 247);
  assert.equal(o.churnedMrrBrl, 197);
  // Paying at the start of the window: s1 (40 d), s2 (40 d) and s5 (60 d, canceled later) = 3; one canceled.
  assert.ok(Math.abs(o.logoChurn30! - 1 / 3) < 1e-9);
});

test("the MRR series steps up on the day a customer starts and down on the day one cancels", () => {
  const data = small();
  data.subscriptions.push(
    sub({ id: "s4", company_id: "x", started_at: iso(3), amount_cents: 30_000 }),
  );
  const series = mrrSeries(data, 10);
  assert.equal(series.length, 10);
  assert.equal(series.at(-1)!.customers, 3);
  assert.equal(series.at(-7)!.customers, 2, "before the new customer");
  assert.ok(series.at(-1)!.mrr > series.at(-7)!.mrr);
  const costs = costSeries(data.usage, NOW, 30);
  assert.equal(costs.length, 30);
  assert.ok(
    Math.abs(
      costs.reduce((s, d) => s + d.text + d.images + d.video, 0) - (1 + 4.295 * 2 + 0.084 + 2),
    ) < 1e-9,
  );
});

test("customer rows carry plan, 30-day cost, margin for payers only, and live balance", () => {
  const rows = customerRows(small());
  const b = rows.find((r) => r.companyId === "b")!;
  assert.equal(b.plan, "pro");
  assert.equal(b.renders30, 2);
  assert.equal(b.videosDelivered30, 1);
  assert.equal(b.videoBalance, 1);
  assert.ok(b.margin !== null && b.margin > 0.5);
  const pilot = rows.find((r) => r.companyId === "c")!;
  assert.equal(pilot.margin, null);
  assert.equal(pilot.isDesignPartner, true);
  assert.equal(pilot.mrrBrl, 0);
});

test("the fixture is internally consistent: every figure the panel shows can be derived", () => {
  const data = makeFixtureData();
  const overview = computeOverview(data);
  const customers = customerRows(data);
  assert.equal(customers.length, data.companies.length);
  assert.ok(overview.mrrBrl > 0 && overview.payingCustomers >= 8);
  assert.ok(overview.grossMargin! > 0.4 && overview.grossMargin! < 0.95);
  assert.ok(
    Math.abs(overview.mrrBrl - customers.reduce((s, c) => s + c.mrrBrl, 0)) < 1e-6,
    "per-customer MRR adds up to total MRR",
  );
  assert.ok(
    Math.abs(overview.costUsd30 - customers.reduce((s, c) => s + c.cost30Usd, 0)) < 1e-6,
    "per-customer cost adds up to total cost",
  );
  assert.equal(
    overview.planMix.free + overview.planMix.essencial + overview.planMix.pro,
    data.companies.length,
  );
  assert.ok(ladder(data).some((step) => step.taken > 0));
  const economics = planEconomics(data, customers);
  assert.equal(economics.length, 3);
  assert.ok(economics.find((e) => e.plan === "pro")!.worstMargin! > 0.4);
});

test("alerts follow the pricing plan's scorecard and are sorted by severity", () => {
  const data = small();
  data.subscriptions[0] = sub({ id: "s1", company_id: "a", status: "past_due" });
  data.events = [
    {
      id: "e1",
      provider: "asaas",
      event_id: "x",
      event_type: "PAYMENT_CONFIRMED",
      status: "failed",
      error: "boom",
      received_at: iso(1),
      processed_at: null,
    },
  ];
  const overview = computeOverview(data);
  const list = alerts(data, overview, customerRows(data));
  const ids = list.map((a) => a.id);
  assert.ok(ids.includes("past-due") && ids.includes("events-failed") && ids.includes("no-prices"));
  assert.equal(list[0]!.level, "critical");
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  for (let i = 1; i < list.length; i++) assert.ok(rank[list[i - 1]!.level] <= rank[list[i]!.level]);
  data.usage.push(
    ...Array.from({ length: 6 }, (_, i) => ({
      company_id: "b",
      kind: "video_render",
      created_at: iso(i + 1),
      est_cost_usd: 4.3,
      plan_key: "pro",
    })),
  );
  const cap = alerts(data, computeOverview(data), customerRows(data));
  assert.ok(
    cap.some((a) => a.id === "cap-b"),
    "a Pro client that used every render is flagged",
  );
  assert.ok(
    cap.some((a) => a.id === "yield"),
    "yield above 2.3 is flagged",
  );
});
