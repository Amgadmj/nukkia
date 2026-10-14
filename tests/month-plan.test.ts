import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import { planBlockers, shouldAutoBuildPlan } from "../src/lib/month-plan.ts";

const data = () =>
  demoSchema.parse({
    name: "Jardim Studio",
    segment: "Pilates",
    answers: {
      offers: "Aulas de pilates",
      audience: "Pessoas que buscam movimento",
      goals: "Atrair novos clientes",
    },
  });

test("without a brand kit the identity is the first reason", () => {
  const reasons = planBlockers(data(), false);
  assert.match(reasons[0]!, /identidade/i);
});

test("identity is confirmed only after a visual style is chosen", () => {
  const reasons = planBlockers(data(), true);
  assert.ok(reasons.length > 0);
});

const ready = {
  blockers: [] as string[],
  itemsLoaded: true,
  itemCount: 0,
  attempted: false,
  state: "idle" as const,
};

test("builds automatically only once, for a ready account with no plan", () => {
  assert.equal(shouldAutoBuildPlan(ready), true);
  assert.equal(shouldAutoBuildPlan({ ...ready, blockers: ["falta logo"] }), false);
  assert.equal(shouldAutoBuildPlan({ ...ready, itemsLoaded: false }), false);
  assert.equal(shouldAutoBuildPlan({ ...ready, itemCount: 3 }), false);
  assert.equal(shouldAutoBuildPlan({ ...ready, attempted: true }), false);
  assert.equal(shouldAutoBuildPlan({ ...ready, state: "building" }), false);
  assert.equal(shouldAutoBuildPlan({ ...ready, state: "error" }), false);
});
