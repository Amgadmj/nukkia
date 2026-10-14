import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bootDatabase, rejects, type Harness } from "./sql-harness.ts";
import { PLANS } from "../src/lib/pricing/catalog.ts";

const OWNER_A = "00000000-0000-4000-8000-0000000000a1";
const OWNER_B = "00000000-0000-4000-8000-0000000000b2";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const COMPANY_A = "00000000-0000-4000-8000-00000000c0a1";
const COMPANY_B = "00000000-0000-4000-8000-00000000c0b2";
const ASSUMPTIONS = JSON.stringify({ fxBrlPerUsd: 5.2 });

async function seed(): Promise<Harness> {
  const h = await bootDatabase();
  await h.db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER_A}', 'a@x.test'), ('${OWNER_B}', 'b@x.test'), ('${ADMIN}', 'admin@x.test');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${ADMIN}', 'admin');
    INSERT INTO public.companies (id, owner_id, name) VALUES ('${COMPANY_A}', '${OWNER_A}', 'A Co'), ('${COMPANY_B}', '${OWNER_B}', 'B Co');
  `);
  return h;
}

const price = (cohort: string, cents: number, seats: number, floor = 33_919) =>
  `INSERT INTO price_registry (plan_key, billing_interval, cohort_key, amount_cents, floor_min_cents, seats, assumptions)
   VALUES ('pro', 'month', '${cohort}', ${cents}, ${floor}, ${seats}, '${ASSUMPTIONS}')`;

test("entitlements in SQL match the catalog in code", async () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261014120000_billing_quotas_pricing.sql", import.meta.url),
    "utf8",
  );
  const block =
    /INSERT INTO public\.plan_entitlements[\s\S]*?VALUES\s*([\s\S]*?);/.exec(sql)?.[1] ?? "";
  const parsed = [...block.matchAll(/\('(\w+)',\s*(\d+)\)/g)].map(
    (m) => [m[1], Number(m[2])] as const,
  );
  assert.equal(parsed.length, 3);
  for (const [plan, videos] of parsed) {
    assert.equal(
      PLANS[plan as keyof typeof PLANS].includedVideos,
      videos,
      `${plan} included videos`,
    );
  }
});

test("the price registry refuses a price below its floor and never edits history", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  await rejects(h.service(price("early", 30_000, 15)), /price_registry_above_floor/);
  await rejects(h.service("UPDATE price_registry SET amount_cents = 1"), /immutable/);
  await h.service("UPDATE price_registry SET status = 'retired', retired_at = now()");
  assert.equal((await h.service("SELECT status FROM price_registry"))[0]?.["status"], "retired");
});

test("customers see published prices and seats but never margins; admins see the registry", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  assert.equal((await h.as(OWNER_A, "SELECT * FROM price_registry")).length, 0);
  assert.equal((await h.as(ADMIN, "SELECT * FROM price_registry")).length, 1);
  const publicRows = await h.anon("SELECT * FROM public_price_list()");
  assert.equal(publicRows.length, 1);
  assert.ok(!("floor_min_cents" in publicRows[0]!) && !("worst_margin" in publicRows[0]!));
  await rejects(h.anon("SELECT * FROM price_registry"), /permission denied/);
});

test("checkout takes the cheapest price with a seat left, then moves up the ladder", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 1));
  await h.service(price("early", 59_700, 5));
  const first = await h.service(
    `SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`,
  );
  assert.equal(first[0]?.["amount_cents"], 49_700);
  await h.service(
    `UPDATE subscriptions SET status = 'active', started_at = now() WHERE company_id = '${COMPANY_A}'`,
  );
  const second = await h.service(
    `SELECT * FROM reserve_subscription('${COMPANY_B}', 'pro', 'month')`,
  );
  assert.equal(second[0]?.["amount_cents"], 59_700);
  assert.equal(second[0]?.["cohort_key"], "early");
  await rejects(
    h.service(`SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`),
    /already has a live subscription/,
  );
  const other = "00000000-0000-4000-8000-00000000c0c3";
  await h.db.exec(
    `INSERT INTO companies (id, owner_id, name) VALUES ('${other}', '${OWNER_B}', 'C Co')`,
  );
  await rejects(
    h.service(`SELECT * FROM reserve_subscription('${other}', 'pro', 'year')`),
    /no published price/,
  );
});

test("a customer cannot write billing tables or reserve a subscription", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  await rejects(
    h.as(
      OWNER_A,
      `INSERT INTO subscriptions (company_id, plan_key, status, billing_interval, amount_cents)
       VALUES ('${COMPANY_A}', 'pro', 'active', 'month', 0)`,
    ),
    /permission denied/,
  );
  await rejects(
    h.as(OWNER_A, `SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`),
    /permission denied/,
  );
  await rejects(
    h.as(OWNER_A, `SELECT grant_video_units('${COMPANY_A}', 99, 'admin', 'x', null)`),
    /permission denied/,
  );
});

test("subscriptions are visible to their owner and to admins only", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  await h.service(`SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`);
  assert.equal((await h.as(OWNER_A, "SELECT * FROM subscriptions")).length, 1);
  assert.equal((await h.as(OWNER_B, "SELECT * FROM subscriptions")).length, 0);
  assert.equal((await h.as(ADMIN, "SELECT * FROM subscriptions")).length, 1);
});

test("company_plan follows status, trial expiry and the 7-day past-due grace", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  await h.service(`SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`);
  const plan = async (company: string) =>
    (await h.as(OWNER_A, `SELECT company_plan('${company}') AS p`))[0]?.["p"];
  assert.equal(await plan(COMPANY_A), "free", "pending is not entitled");
  await h.service(
    `UPDATE subscriptions SET status = 'active', started_at = now() WHERE company_id = '${COMPANY_A}'`,
  );
  assert.equal(await plan(COMPANY_A), "pro");
  assert.equal(await plan(COMPANY_B), "free", "someone else's company reads as free");
  await h.service(
    `UPDATE subscriptions SET status = 'trialing', trial_ends_at = now() - interval '1 day'`,
  );
  assert.equal(await plan(COMPANY_A), "free", "expired trial");
  await h.service(
    `UPDATE subscriptions SET status = 'past_due', current_period_end = now() - interval '3 days', trial_ends_at = null`,
  );
  assert.equal(await plan(COMPANY_A), "pro", "inside the grace period");
  await h.service(`UPDATE subscriptions SET current_period_end = now() - interval '9 days'`);
  assert.equal(await plan(COMPANY_A), "free", "grace period over");
});

test("consume_ai_quota enforces daily and monthly caps, ownership and the zero cap, and books cost", async () => {
  const h = await seed();
  const take = async (
    company: string,
    kind: string,
    daily: number,
    monthly: number,
    plan: string,
  ) =>
    (
      await h.as(
        OWNER_A,
        `SELECT consume_ai_quota('${company}', '${kind}', ${daily}, ${monthly}, 0.0871, '${plan}') AS ok`,
      )
    )[0]?.["ok"];
  assert.equal(await take(COMPANY_A, "arte", 2, 3, "pro"), true);
  assert.equal(await take(COMPANY_A, "arte", 2, 3, "pro"), true);
  assert.equal(await take(COMPANY_A, "arte", 2, 3, "pro"), false, "daily cap");
  assert.equal(await take(COMPANY_B, "arte", 2, 3, "pro"), false, "not the owner");
  assert.equal(await take(COMPANY_A, "video_render", 0, 0, "free"), false, "a zero cap blocks");
  const usage = await h.service(
    `SELECT count(*)::int AS n, sum(est_cost_usd)::float8 AS cost FROM ai_usage WHERE company_id = '${COMPANY_A}'`,
  );
  assert.equal(usage[0]?.["n"], 2);
  assert.ok(Math.abs(Number(usage[0]?.["cost"]) - 0.1742) < 1e-9);
});

test("the video balance grants once per window, consumes once per ref, and expires with rollover", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  await h.service(`SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`);
  await h.service(
    `UPDATE subscriptions SET status = 'active', started_at = now() WHERE company_id = '${COMPANY_A}'`,
  );
  const one = async (sql: string) => Object.values((await h.as(OWNER_A, sql))[0] ?? {})[0];

  assert.equal(await one(`SELECT video_units_balance('${COMPANY_A}')`), 0);
  assert.equal(await one(`SELECT ensure_video_grant('${COMPANY_A}')`), 2);
  assert.equal(
    await one(`SELECT ensure_video_grant('${COMPANY_A}')`),
    0,
    "second call in the window grants nothing",
  );
  assert.equal(await one(`SELECT video_units_balance('${COMPANY_A}')`), 2);

  assert.equal(await one(`SELECT consume_video_unit('${COMPANY_A}', 'item-1')`), true);
  assert.equal(
    await one(`SELECT consume_video_unit('${COMPANY_A}', 'item-1')`),
    true,
    "same ref charges once",
  );
  assert.equal(await one(`SELECT video_units_balance('${COMPANY_A}')`), 1);
  assert.equal(await one(`SELECT consume_video_unit('${COMPANY_A}', 'item-2')`), true);
  assert.equal(
    await one(`SELECT consume_video_unit('${COMPANY_A}', 'item-3')`),
    false,
    "no balance left",
  );
  assert.equal(
    (await h.as(OWNER_B, `SELECT consume_video_unit('${COMPANY_A}', 'x') AS ok`))[0]?.["ok"],
    false,
  );

  await h.service(`SELECT grant_video_units('${COMPANY_A}', 1, 'purchase', 'pay:1', null)`);
  assert.equal(await one(`SELECT video_units_balance('${COMPANY_A}')`), 1);
  await h.service(
    `UPDATE video_unit_lots SET expires_at = now() - interval '1 day' WHERE source = 'plan_grant'`,
  );
  assert.equal(
    await one(`SELECT video_units_balance('${COMPANY_A}')`),
    1,
    "expired lots stop counting",
  );
  await h.service(
    `UPDATE subscriptions SET started_at = now() - interval '35 days' WHERE company_id = '${COMPANY_A}'`,
  );
  assert.equal(
    await one(`SELECT ensure_video_grant('${COMPANY_A}')`),
    2,
    "the next 30-day window grants again",
  );
});

test("the webhook log keeps one row per provider event and hides itself from customers", async () => {
  const h = await seed();
  const insert = `INSERT INTO billing_events (event_id, event_type, payload) VALUES ('evt_1', 'PAYMENT_CONFIRMED', '{}')`;
  await h.service(insert);
  await rejects(h.service(insert), /duplicate key/);
  assert.equal((await h.as(OWNER_A, "SELECT * FROM billing_events")).length, 0);
  assert.equal((await h.as(ADMIN, "SELECT * FROM billing_events")).length, 1);
});

async function activeProSubscription(h: Harness, providerId = "sub_test_1") {
  await h.service(price("founding", 49_700, 10));
  await h.service(`SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'month')`);
  await h.service(
    `UPDATE subscriptions SET provider_subscription_id = '${providerId}' WHERE company_id = '${COMPANY_A}'`,
  );
}
const event = (name: string, extra = "NULL, NULL", paidAt = "now()") =>
  `SELECT apply_payment_event('${name}', 'pay_1', ${extra.split(",")[0]}, ${extra.split(",")[1]}, ${paidAt}) AS r`;

test("a confirmed payment activates the subscription, grants videos once, and replays are harmless", async () => {
  const h = await seed();
  await activeProSubscription(h);
  const first = await h.service(event("PAYMENT_CONFIRMED", "'sub_test_1', NULL"));
  assert.equal(first[0]?.["r"], "activated");
  const sub = (
    await h.service(
      `SELECT status, started_at, current_period_start, current_period_end FROM subscriptions`,
    )
  )[0]!;
  assert.equal(sub["status"], "active");
  assert.ok(sub["started_at"] && sub["current_period_end"]);
  const days =
    (new Date(String(sub["current_period_end"])).getTime() -
      new Date(String(sub["current_period_start"])).getTime()) /
    86_400_000;
  assert.ok(days >= 28 && days <= 31, `a monthly period is about a month, got ${days} days`);
  assert.equal((await h.service(`SELECT video_units_balance('${COMPANY_A}') AS b`))[0]?.["b"], 2);

  const replay = await h.service(event("PAYMENT_RECEIVED", "'sub_test_1', NULL"));
  assert.equal(replay[0]?.["r"], "activated");
  assert.equal(
    (await h.service(`SELECT video_units_balance('${COMPANY_A}') AS b`))[0]?.["b"],
    2,
    "no second grant",
  );
  assert.equal((await h.service(`SELECT count(*)::int AS n FROM video_unit_lots`))[0]?.["n"], 1);
});

test("an annual payment sets a one-year period", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  await h.service(
    `INSERT INTO price_registry (plan_key, billing_interval, cohort_key, amount_cents, floor_min_cents, seats, assumptions)
     VALUES ('pro', 'year', 'founding', 497000, 400000, 10, '${ASSUMPTIONS}')`,
  );
  await h.service(`SELECT * FROM reserve_subscription('${COMPANY_A}', 'pro', 'year')`);
  await h.service(`UPDATE subscriptions SET provider_subscription_id = 'sub_year'`);
  await h.service(event("PAYMENT_CONFIRMED", "'sub_year', NULL"));
  const row = (
    await h.service(
      `SELECT extract(day FROM (current_period_end - current_period_start))::int AS days FROM subscriptions`,
    )
  )[0]!;
  assert.ok(Number(row["days"]) >= 365 && Number(row["days"]) <= 366);
});

test("overdue moves an active subscription to past_due and a later payment restores it", async () => {
  const h = await seed();
  await activeProSubscription(h);
  await h.service(event("PAYMENT_CONFIRMED", "'sub_test_1', NULL", "now() - interval '40 days'"));
  assert.equal(
    (await h.service(event("PAYMENT_OVERDUE", "'sub_test_1', NULL")))[0]?.["r"],
    "past_due",
  );
  assert.equal((await h.service(`SELECT status FROM subscriptions`))[0]?.["status"], "past_due");
  await h.service(event("PAYMENT_CONFIRMED", "'sub_test_1', NULL"));
  assert.equal((await h.service(`SELECT status FROM subscriptions`))[0]?.["status"], "active");
});

test("a refund cancels the subscription and nothing revives it", async () => {
  const h = await seed();
  await activeProSubscription(h);
  await h.service(event("PAYMENT_CONFIRMED", "'sub_test_1', NULL"));
  assert.equal(
    (await h.service(event("PAYMENT_REFUNDED", "'sub_test_1', NULL")))[0]?.["r"],
    "canceled",
  );
  assert.equal(
    (await h.service(event("PAYMENT_CONFIRMED", "'sub_test_1', NULL")))[0]?.["r"],
    "ignored",
  );
  assert.equal((await h.service(`SELECT status FROM subscriptions`))[0]?.["status"], "canceled");
  assert.equal(
    (await h.service(event("PAYMENT_CONFIRMED", "'sub_nobody', NULL")))[0]?.["r"],
    "unknown_subscription",
  );
});

test("a paid extra video adds one unit that lasts a year; a refund removes it", async () => {
  const h = await seed();
  await h.service(
    `INSERT INTO purchases (id, company_id, sku, units, amount_cents)
     VALUES ('00000000-0000-4000-8000-0000000000f1', '${COMPANY_A}', 'video_15s', 1, 17900)`,
  );
  const ref = "'purchase:00000000-0000-4000-8000-0000000000f1'";
  assert.equal(
    (await h.service(event("PAYMENT_CONFIRMED", `NULL, ${ref}`)))[0]?.["r"],
    "purchase_paid",
  );
  assert.equal((await h.service(event("PAYMENT_CONFIRMED", `NULL, ${ref}`)))[0]?.["r"], "ignored");
  assert.equal((await h.service(`SELECT video_units_balance('${COMPANY_A}') AS b`))[0]?.["b"], 1);
  assert.equal(
    (await h.service(event("PAYMENT_REFUNDED", `NULL, ${ref}`)))[0]?.["r"],
    "purchase_refunded",
  );
  assert.equal((await h.service(`SELECT video_units_balance('${COMPANY_A}') AS b`))[0]?.["b"], 0);
  await rejects(h.as(OWNER_A, event("PAYMENT_CONFIRMED", `NULL, ${ref}`)), /permission denied/);
});

test("a design partner trials a paid plan at the founding price, gets the videos, and expires back to free", async () => {
  const h = await seed();
  await h.service(price("founding", 49_700, 10));
  const row = (
    await h.service(`SELECT * FROM grant_design_partner('${COMPANY_A}', 'pro', 90)`)
  )[0]!;
  assert.equal(row["status"], "trialing");
  assert.equal(row["is_design_partner"], true);
  assert.equal(row["amount_cents"], 49_700);
  const plan = async () =>
    (await h.as(OWNER_A, `SELECT company_plan('${COMPANY_A}') AS p`))[0]?.["p"];
  assert.equal(await plan(), "pro");
  assert.equal(
    (await h.as(OWNER_A, `SELECT video_units_balance('${COMPANY_A}') AS b`))[0]?.["b"],
    2,
  );
  await rejects(
    h.service(`SELECT * FROM grant_design_partner('${COMPANY_A}', 'pro', 90)`),
    /already has a live subscription/,
  );
  await rejects(
    h.as(OWNER_A, `SELECT * FROM grant_design_partner('${COMPANY_B}', 'pro', 90)`),
    /permission denied/,
  );
  await h.service(`UPDATE subscriptions SET trial_ends_at = now() - interval '1 day'`);
  assert.equal(await plan(), "free");
  assert.equal(
    (await h.service(`SELECT price_seats_taken(id) AS n FROM price_registry`))[0]?.["n"],
    1,
    "a trial holds a founding seat",
  );
});
