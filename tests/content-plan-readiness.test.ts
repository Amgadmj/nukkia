import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import { contentPlanReady } from "../src/lib/content-readiness.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    answers: {
      offers: "Programa personalizado de exercícios",
      audience: "Adultos que buscam prevenção de lesões",
      goals: "Atrair novos clientes",
    },
    brand: {
      confirmed: true,
      detail: "Atendimento individual por profissionais da equipe.",
      visualStyle: "essential",
      identityConfirmed: false,
    },
  });

test("monthly plan generation requires current context, confirmed identity and a saved kit", () => {
  const data = fixture();
  assert.equal(contentPlanReady(data, true), false);
  data.brand.identityConfirmed = true;
  assert.equal(contentPlanReady(data, false), false);
  assert.equal(contentPlanReady(data, true), true);
  data.answers.audience = "";
  assert.equal(contentPlanReady(data, true), false);
});
