import test from "node:test";
import assert from "node:assert/strict";
import { prepareEvidence, validateSynthesis } from "../src/lib/brand-research.ts";
import { extractPage } from "../src/lib/public-site.server.ts";

const source = (text: string) => ({
  url: "https://marca.com/servicos",
  title: "Serviços",
  text,
  fetchedAt: "2026-09-24T12:00:00Z",
});
const candidate = (patch: Record<string, unknown> = {}) => ({
  field: "offers",
  value: "Aulas de pilates",
  quote: "Aulas de pilates em pequenos grupos.",
  sourceId: "s0",
  kind: "fact",
  rationale: "Trecho da página de serviços.",
  publishedAt: null,
  ...patch,
});
const validate = (text: string, patch: Record<string, unknown> = {}) =>
  validateSynthesis({ suggestions: [candidate(patch)] }, [source(text)]);

test("patient name, age and cancer narrative never enter provider evidence after extraction", () => {
  const page = extractPage(
    "<h1>Casos clínicos</h1><p>Maria Silva, 42 anos, iniciou fisioterapia após diagnóstico de câncer de mama.</p>",
    "https://marca.com/casos",
  );
  assert.deepEqual(prepareEvidence([source(page.text)]), []);
});

test("a Pilates quotation cannot substantiate swimming lessons as a fact", () => {
  assert.deepEqual(
    validate("Aulas de pilates em pequenos grupos.", { value: "Aulas de natação" }),
    [],
  );
});

test("a session duration cannot substantiate the same number as a discount", () => {
  assert.deepEqual(
    validate("Plano mensal com sessões de 90 minutos.", {
      value: "90% de desconto",
      quote: "Plano mensal com sessões de 90 minutos.",
    }),
    [],
  );
});

for (const text of [
  "Maria Silva recomenda nossas aulas de pilates.",
  "João da Silva conhece nossos serviços.",
  "Érica Gonçalves frequenta aulas em grupo.",
  "MARIA SILVA participa de aulas de pilates.",
  "Clínica Maria Silva oferece serviços de fisioterapia.",
]) {
  test(`ambiguous personal names stay local: ${text}`, () => {
    assert.deepEqual(prepareEvidence([source(text)]), []);
  });
}

for (const text of [
  "Aos 42 anos, participa das aulas em grupo.",
  "A criança de 18 meses faz fisioterapia.",
  "Diagnóstico de câncer e plano de fisioterapia individual.",
  "O prontuário registra sessões de fisioterapia.",
  "Tenho depressão e faço aulas de pilates.",
  "Minha recuperação começou com a fisioterapia.",
  "Nome: maria silva, curso de pilates.",
  "Responsável: ana, agendamento de fisioterapia.",
  "Data de nascimento: 1990, aulas de pilates.",
]) {
  test(`clinical and person data stay local: ${text}`, () => {
    assert.deepEqual(prepareEvidence([source(text)]), []);
  });
}

test("personal sections stay local until an explicit corporate heading resumes the content", () => {
  const evidence = prepareEvidence([
    source(
      "Casos clínicos\nFisioterapia em grupos pequenos.\nNome:\nAtendimento individual às terças.\nNossos Serviços\nAulas de pilates em pequenos grupos.",
    ),
  ]);
  assert.deepEqual(evidence, [
    { id: "s0", text: "Nossos Serviços\nAulas de pilates em pequenos grupos." },
  ]);
});

test("corporate headings, brand labels and literal business descriptions survive minimization", () => {
  assert.deepEqual(
    prepareEvidence([
      source(
        "Quem Somos\nMarca Jardim\nNossos Serviços\nAulas de Pilates em pequenos grupos.\nPreços e Planos\nPlano mensal com sessões de 90 minutos.\nPerguntas Frequentes",
      ),
    ]),
    [
      {
        id: "s0",
        text: "Quem Somos\nMarca Jardim\nNossos Serviços\nAulas de Pilates em pequenos grupos.\nPreços e Planos\nPlano mensal com sessões de 90 minutos.\nPerguntas Frequentes",
      },
    ],
  );
});

test("manual material remains local and removed sources do not shift provider source IDs", () => {
  const evidence = prepareEvidence([
    { ...source("Aulas de pilates em grupos pequenos."), url: "material:fornecido" },
    source("Maria Silva recomenda nossas aulas de pilates."),
    source("Aulas de pilates em pequenos grupos."),
  ]);
  assert.deepEqual(evidence, [{ id: "s2", text: "Aulas de pilates em pequenos grupos." }]);
});

test("literal facts retain their original source and collection date", () => {
  const result = validate("Aulas de pilates em pequenos grupos.");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.value, "Aulas de pilates");
  assert.equal(result[0]?.sourceUrl, "https://marca.com/servicos");
  assert.equal(result[0]?.foundAt, "2026-09-24T12:00:00Z");
  assert.equal(result[0]?.kind, "fact");
  assert.equal(result[0]?.confidence, "high");
  assert.equal(result[0]?.validity, "unconfirmed");
});

for (const field of ["name", "segment", "detail", "faq"]) {
  test(`unsupported ${field} facts are rejected even when a real quotation exists`, () => {
    assert.deepEqual(
      validate("Aulas de pilates em pequenos grupos.", {
        field,
        value: "Atendimento exclusivo na sua casa",
      }),
      [],
    );
  });
}

for (const field of ["offers", "detail"]) {
  test(`${field} cannot invent attributes by labeling them an opportunity`, () => {
    assert.deepEqual(
      validate("Aulas de pilates em pequenos grupos.", {
        field,
        kind: "opportunity",
        value: "Aulas de natação individuais",
        rationale: "Uma oportunidade a validar com a marca.",
      }),
      [],
    );
  });
}

test("audience inference is explicitly a low-confidence hypothesis, never a fact", () => {
  const result = validate("Aulas de pilates em pequenos grupos.", {
    field: "audience",
    value: "Pessoas interessadas em aulas em grupo",
    rationale: "O formato em grupos pode interessar a esse público.",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "opportunity");
  assert.equal(result[0]?.confidence, "low");
  assert.match(result[0]?.rationale ?? "", /Hipótese a validar/);
  assert.equal(result[0]?.validity, "unconfirmed");
});

test("inference without an explanation is rejected", () => {
  assert.deepEqual(
    validate("Aulas de pilates em pequenos grupos.", {
      field: "audience",
      value: "Pessoas interessadas em aulas em grupo",
      rationale: "",
    }),
    [],
  );
});

for (const patch of [
  { value: "Público interessado em 90% de desconto" },
  { value: "Público para sessões de 9 minutos" },
  { value: "Público para sessões de 90 horas" },
  { value: "Público interessado em planos de R$ 90" },
  { value: "Público interessado em planos", rationale: "Pode atrair público com 90% de desconto." },
]) {
  test(`inferences cannot reuse numeric tokens with new units: ${JSON.stringify(patch)}`, () => {
    assert.deepEqual(
      validate("Plano mensal com sessões de 90 minutos.", {
        field: "audience",
        kind: "opportunity",
        quote: "Plano mensal com sessões de 90 minutos.",
        rationale: "O formato pode interessar a esse público.",
        ...patch,
      }),
      [],
    );
  });
}

test("an opportunity can reuse an actual number-unit pair without claiming it is confirmed", () => {
  const result = validate("Plano mensal com sessões de 90 minutos.", {
    field: "audience",
    kind: "opportunity",
    value: "Pessoas que procuram sessões de 90 minutos",
    quote: "Plano mensal com sessões de 90 minutos.",
    rationale: "A duração pode ser relevante para esse público.",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "opportunity");
  assert.equal(result[0]?.confidence, "low");
});

test("literal discounts retain their units, historical date and unconfirmed validity", () => {
  const result = validate("Promoção de março de 2026: 10% de desconto.", {
    value: "10% de desconto",
    quote: "Promoção de março de 2026: 10% de desconto.",
    publishedAt: "março de 2026",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "past-campaign");
  assert.equal(result[0]?.publishedAt, "março de 2026");
  assert.equal(result[0]?.validity, "unconfirmed");
});

test("a literal substring cannot hide a different discount inside a larger number", () => {
  assert.deepEqual(
    validate("Promoção de março de 2026: 90% de desconto.", {
      value: "0% de desconto",
      quote: "Promoção de março de 2026: 90% de desconto.",
    }),
    [],
  );
});
