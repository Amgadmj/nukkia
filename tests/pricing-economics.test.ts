import test from "node:test";
import assert from "node:assert/strict";
import {
  COHORTS,
  LAUNCH_PRICES,
  PLANS,
  PLAN_KEYS,
  PURCHASES,
  QUOTA_KINDS,
  type PaidPlanKey,
} from "../src/lib/pricing/catalog.ts";
import {
  ALARM_MARGIN,
  DEFAULT_ASSUMPTIONS as A,
  HARD_FLOOR,
  TARGET_MARGIN,
  checkPrice,
  checkPurchasePrice,
  feeUsd,
  minPriceCents,
  netRevenueUsd,
  planCost,
  planMargin,
  purchaseCostUsd,
  renderUsd,
} from "../src/lib/pricing/economics.ts";

const near = (actual: number, expected: number, tolerance = 0.005) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

test("daily caps never exceed monthly caps and every plan defines every kind", () => {
  for (const key of PLAN_KEYS) {
    for (const kind of QUOTA_KINDS) {
      assert.ok(PLANS[key].monthly[kind] >= 0, `${key}.${kind} monthly`);
      assert.ok(
        PLANS[key].daily[kind] <= PLANS[key].monthly[kind],
        `${key}.${kind} daily <= monthly`,
      );
    }
  }
});

test("Free has no video; Pro's render cap equals two kept clips at the assumed yield", () => {
  assert.equal(PLANS.free.monthly.video_render, 0);
  assert.equal(PLANS.essencial.monthly.video_render, 0);
  assert.equal(PLANS.pro.monthly.video_render, PLANS.pro.includedVideos * A.videoYield);
});

test("one render costs 68.5 credits at $0.0627, about $4.30", () => {
  near(renderUsd(A), 4.295, 0.001);
});

test("revenue arithmetic matches the pricing plan: R$197 nets $35.61 after 6% tax", () => {
  near(netRevenueUsd(19_700, "month", A), 35.61, 0.01);
  near(feeUsd(19_700, "month", A), 1.59, 0.01);
});

test("Essencial clears the target by a wide margin at the founding price", () => {
  const result = planMargin("essencial", 19_700, "month", A, "worst");
  assert.ok(result.margin > 0.8 && result.margin < 0.9, `margin ${result.margin}`);
});

test("Pro at R$497 is above the alarm line but below target at today's yield", () => {
  const check = checkPrice({ plan: "pro", amountCents: 49_700, interval: "month" }, A);
  assert.equal(check.level, "below_target");
  assert.ok(check.allowed);
  assert.ok(check.worstMargin > ALARM_MARGIN && check.worstMargin < TARGET_MARGIN);
});

test("Pro reaches the target once yield improves to 1.8", () => {
  const check = checkPrice(
    { plan: "pro", amountCents: 49_700, interval: "month" },
    { ...A, videoYield: 1.8 },
  );
  assert.equal(check.level, "ok");
  assert.ok(check.expectedMargin >= TARGET_MARGIN);
});

test("a price below the hard floor is blocked and reports the lowest allowed price", () => {
  const check = checkPrice({ plan: "pro", amountCents: 29_900, interval: "month" }, A);
  assert.equal(check.level, "blocked");
  assert.equal(check.allowed, false);
  assert.ok(check.floorMinCents > 29_900);
  assert.match(check.messages.join(" "), /piso de 40,0%/);
});

test("the floor price is exactly where the worst-case margin hits 40%", () => {
  for (const plan of ["essencial", "pro"] as const) {
    for (const interval of ["month", "year"] as const) {
      const cents = minPriceCents(plan, HARD_FLOOR, interval, A, "worst");
      const margin = planMargin(plan, cents, interval, A, "worst").margin;
      near(margin, HARD_FLOOR, 0.001);
      const below = planMargin(plan, cents - 100, interval, A, "worst").margin;
      assert.ok(
        below < HARD_FLOOR,
        `${plan} ${interval} one real below the floor must fall under 40%`,
      );
    }
  }
});

test("margin rises monotonically with price", () => {
  let previous = -Infinity;
  for (let cents = 20_000; cents <= 100_000; cents += 5_000) {
    const margin = planMargin("pro", cents, "month", A, "worst").margin;
    assert.ok(margin > previous);
    previous = margin;
  }
});

test("a worse dollar lowers margin; R$6.00 keeps Pro above the hard floor", () => {
  const base = planMargin("pro", 49_700, "month", A, "worst").margin;
  const stressed = planMargin("pro", 49_700, "month", { ...A, fxBrlPerUsd: 6 }, "worst").margin;
  assert.ok(stressed < base);
  assert.ok(stressed > HARD_FLOOR);
});

test("every launch price clears the hard floor and annual is ten monthly payments", () => {
  for (const row of LAUNCH_PRICES) {
    const check = checkPrice(
      { plan: row.plan, amountCents: row.amountCents, interval: row.interval },
      A,
    );
    assert.ok(check.allowed, `${row.plan} ${row.interval} ${row.cohort} is blocked`);
  }
  for (const row of LAUNCH_PRICES.filter((r) => r.interval === "year")) {
    const monthly = LAUNCH_PRICES.find(
      (r) => r.interval === "month" && r.plan === row.plan && r.cohort === row.cohort,
    );
    assert.equal(row.amountCents, (monthly?.amountCents ?? 0) * 10);
  }
});

test("prices rise with each cohort and cohort seats follow the public ladder", () => {
  assert.deepEqual(
    COHORTS.map((c) => c.seats),
    [10, 15, 25],
  );
  for (const plan of ["essencial", "pro"] as PaidPlanKey[]) {
    const prices = COHORTS.map(
      (c) =>
        LAUNCH_PRICES.find((r) => r.plan === plan && r.interval === "month" && r.cohort === c.key)
          ?.amountCents ?? 0,
    );
    assert.ok(prices[0]! < prices[1]! && prices[1]! < prices[2]!);
  }
});

test("the annual Pro founding price only reaches the alarm band, never the block", () => {
  const check = checkPrice({ plan: "pro", amountCents: 497_000, interval: "year" }, A);
  assert.equal(check.allowed, true);
  assert.equal(check.level, "alarm");
});

test("extra 15-second video: R$179 passes the target; the 30-second film stays gated", () => {
  const video = checkPurchasePrice("video_15s", PURCHASES.video_15s.priceCents, A);
  assert.equal(video.level, "ok");
  assert.ok(video.margin > 0.6);
  assert.equal(PURCHASES.film_30s.purchasable, false);
  const film = checkPurchasePrice("film_30s", PURCHASES.film_30s.priceCents, A);
  assert.ok(film.allowed);
  near(purchaseCostUsd("film_30s", A), 24.58, 0.01);
});

test("worst-case cost lines add up to the plan total", () => {
  const cost = planCost("pro", A, "worst");
  const sum = cost.lines.reduce((acc, line) => acc + line.totalUsd, 0) + cost.infraUsd;
  near(sum, cost.totalUsd, 1e-9);
  assert.ok(cost.videoUsd > cost.aiUsd, "video dominates Pro's cost");
});
