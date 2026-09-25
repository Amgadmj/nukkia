import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answersSchema,
  chapterMissing,
  diagnosticMatchesAnswers,
  diagnosticPrompt,
  foundationProgress,
  normalizeAnswers,
} from "../src/lib/onboarding.ts";

test("legacy answers remain intact while new fields default to empty", () => {
  const answers = answersSchema.parse({
    audience: "Famílias",
    offers: "Consultas",
    restrictions: "Normas locais",
  });
  assert.equal(answers.audience, "Famílias");
  assert.equal(answers.restrictions, "Normas locais");
  assert.equal(answers.city, "");
});
test("optional fields do not block and essential whitespace is not completion", () => {
  const answers = normalizeAnswers({ offers: "  ", audience: "Famílias" });
  assert.equal(chapterMissing(0, answers).length, 0);
  assert.deepEqual(
    chapterMissing(1, answers).map((q) => q.key),
    ["offers", "problems"],
  );
  assert.equal(chapterMissing(2, answers).length, 0);
});
test("visiting a page or having an onboarding step cannot grant artifact completion", () => {
  const p = foundationProgress({
    company: true,
    answers: normalizeAnswers({}),
    diagnostic: false,
    logo: false,
    identity: false,
  });
  assert.equal(p.percent, 10);
  assert.equal(p.complete, false);
});
test("complete foundation needs all essential answers and real saved outputs", () => {
  const answers = normalizeAnswers({
    offers: "Serviços",
    problems: "Demora",
    audience: "Empresas",
    goals: "Crescer",
    challenge: "Alcance",
  });
  const base = { company: true, answers, diagnostic: true, logo: true, identity: true };
  assert.equal(foundationProgress(base).percent, 100);
  assert.equal(foundationProgress({ ...base, diagnostic: false }).percent, 80);
  assert.equal(foundationProgress({ ...base, logo: false }).complete, false);
  const pending = foundationProgress({ ...base, pendingReportUpdate: true });
  assert.equal(pending.percent, 99);
  assert.equal(pending.complete, false);
});
test("expanded answers reach the diagnostic prompt and limits are enforced", () => {
  const answers = answersSchema.parse({
    city: "Recife",
    objections: "Prazo",
    purpose: "Simplificar",
    googleBusiness: "Não tenho",
  });
  const prompt = diagnosticPrompt(answers);
  for (const value of ["Recife", "Prazo", "Simplificar", "Não tenho"])
    assert.ok(prompt.includes(value));
  assert.equal(answersSchema.safeParse({ goals: "a".repeat(1001) }).success, false);
  assert.equal(answersSchema.safeParse({ city: 5 }).success, false);
});

test("unsent draft answers cannot claim a current generated report", () => {
  const saved = { audience: "Famílias", offers: "Serviços" };
  assert.equal(diagnosticMatchesAnswers(saved, normalizeAnswers(saved)), true);
  assert.equal(
    diagnosticMatchesAnswers(saved, normalizeAnswers({ ...saved, challenge: "Crescer" })),
    false,
  );
  assert.equal(
    diagnosticMatchesAnswers(saved, normalizeAnswers({ ...saved, audience: " Famílias " })),
    true,
  );
});
