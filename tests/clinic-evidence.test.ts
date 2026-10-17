import test from "node:test";
import assert from "node:assert/strict";
import { organizationName, visualEvidence, evidenceMarkdown } from "../src/lib/clinic-evidence.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import {
  profileFingerprint,
  profileConfirmed,
  researchSchema,
  toggleContentIntent,
  selectedContentIntents,
  firstPostBrief,
} from "../src/lib/brand-preview.ts";
import { applyResearchToData } from "../src/lib/brand-research.ts";
import { profileSuggestions, mergeProfileSuggestions } from "../src/lib/clinic-evidence.ts";
import { handleBrandPreview } from "../src/lib/brand-preview.server.ts";

test("title supplies a short organization candidate, slogans are rejected", () => {
  assert.equal(
    organizationName("Lab São Paulo | Laboratório de Análises Clínicas"),
    "Lab São Paulo",
  );
  assert.equal(
    organizationName("Aliamos tecnologia a um atendimento humanizado para sua saúde."),
    "",
  );
});

test("a public professional title supplies name and specialty without sending credentials to AI", () => {
  const source = {
    url: "https://draquisyvascular.com.br/",
    title: "Dra. Quisy Storti | Cirurgiã Vascular em Vila Mariana, São Paulo",
    text: "Dra. Quisy Storti | Cirurgiã Vascular em Vila Mariana, São Paulo\nTratamento de varizes, vasinhos e lipedema.",
    fetchedAt: "2026-10-16",
  };
  const suggestions = profileSuggestions(researchSchema.parse({ sources: [source] }));
  assert.equal(suggestions.find((s) => s.field === "name")?.value, "Dra. Quisy Storti");
  assert.equal(suggestions.find((s) => s.field === "segment")?.value, "Cirurgia vascular");
  assert.ok(suggestions.some((s) => s.field === "audience"));
});
test("angiologia-only evidence never crashes vascular suggestions and retains the quote", () => {
  const research = researchSchema.parse({
    sources: [
      {
        url: "https://clinic.example/",
        title: "Clínica Aurora",
        text: "Clínica Aurora\nAngiologia\nAgende sua consulta",
        fetchedAt: "2026-10-16",
      },
    ],
  });
  const suggestions = profileSuggestions(research);
  assert.ok(suggestions.some((item) => item.field === "segment" && item.quote === "Angiologia"));
  assert.ok(suggestions.some((item) => item.field === "audience" && item.quote === "Angiologia"));
});

test("the three profile fields are applied together only after processing", () => {
  const data = demoSchema.parse({
    name: "",
    answers: {},
    brand: { referenceUrl: "https://clinic.example/" },
  });
  const research = researchSchema.parse({
    phase: "synthesizing",
    sources: [
      {
        url: "https://clinic.example/",
        title: "Lab São Paulo | Análises Clínicas",
        text: "Análises clínicas e exames",
        fetchedAt: "2026-10-16",
      },
    ],
  });
  research.suggestions = profileSuggestions(research);
  // The upstream diagnostic profile may arrive before synthesis finishes.
  // It must not bypass the atomic review or supply a model-generated clinic name.
  research.profile = [
    {
      key: "name",
      value: "Síntese Claude",
      sourceUrl: "https://clinic.example/",
      rationale: "",
      basis: "site",
      confidence: "medium",
    },
  ];
  const reference = { url: data.brand.referenceUrl, material: "" };
  const pending = applyResearchToData(data, reference, research);
  assert.equal(pending.name, "");
  assert.equal(pending.segment, "");
  assert.equal(pending.answers.audience, "");
  const ready = applyResearchToData(pending, reference, { ...research, phase: "complete" });
  assert.equal(ready.name, "Lab São Paulo");
  assert.equal(ready.segment, "Análises Clínicas");
  assert.match(ready.answers.audience, /exames/);
  assert.equal(ready.brand.confirmed, false);
  const edited = {
    ...ready,
    name: "Laboratório São Paulo",
    brand: { ...ready.brand, editedFields: ["name"] },
  };
  assert.equal(
    applyResearchToData(edited, reference, { ...research, phase: "complete" }).name,
    "Laboratório São Paulo",
  );
});

test("model slogans cannot override the deterministic name in the complete API result", async () => {
  const response = await handleBrandPreview(
    new Request("http://localhost:8080/api/brand-preview", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({
        action: "research",
        url: "https://clinic.example/",
        material: "",
        stream: true,
        siteAuthorized: true,
        aiAuthorized: true,
      }),
    }),
    true,
    {
      collect: async () =>
        researchSchema.parse({
          status: "ready",
          sources: [
            {
              url: "https://clinic.example/",
              title: "Lab São Paulo | Análises Clínicas",
              organizationName: "Lab São Paulo",
              text: "Serviços de exames e atendimento personalizado para a sua saúde.",
              fetchedAt: "2026-10-16",
            },
          ],
        }),
      synthesize: async () => [
        {
          field: "name",
          value: "Serviços de exames e atendimento personalizado",
          quote: "Serviços de exames e atendimento personalizado",
          sourceUrl: "https://clinic.example/",
          title: "",
          kind: "fact",
          origin: "ai",
          rationale: "",
          foundAt: "",
          publishedAt: null,
          confidence: "high",
          validity: "unconfirmed",
        },
      ],
    },
  );
  const frames = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line).research);
  const final = researchSchema.parse(frames.at(-1));
  assert.equal(final.phase, "complete");
  assert.deepEqual(
    final.suggestions.filter((s) => s.field === "name").map((s) => s.value),
    ["Lab São Paulo"],
  );
  assert.match(final.evidenceMarkdown!, /https:\/\/clinic.example/);
});
test("profile confirmation is tied to the exact human reviewed values", () => {
  const data = demoSchema.parse({
    name: "Lab São Paulo",
    segment: "Análises clínicas",
    answers: { audience: "Pessoas de Belo Horizonte" },
    brand: { confirmed: true },
  });
  data.brand.profileConfirmation = profileFingerprint(data);
  assert.equal(profileConfirmed(data), true);
  data.name = "Outro laboratório";
  assert.equal(profileConfirmed(data), false);
});
test("a niche model audience cannot replace the clinic-wide audience hypothesis", () => {
  const research = researchSchema.parse({
    sources: [
      {
        url: "https://clinic.example/",
        title: "Clínica São Paulo",
        text: "Exames e acompanhamento preventivo de saúde.",
        fetchedAt: "2026-10-16",
      },
    ],
    suggestions: [
      {
        field: "audience",
        value: "Mulheres na menopausa",
        quote: "Cuidados na menopausa",
        sourceUrl: "https://clinic.example/",
        origin: "ai",
        kind: "opportunity",
      },
    ],
  });
  const merged = mergeProfileSuggestions(research, research.suggestions);
  assert.deepEqual(
    merged.filter((item) => item.field === "audience").map((item) => item.value),
    ["Pessoas que buscam exames e acompanhamento preventivo de saúde"],
  );
});
test("an unrecognized site name stays empty rather than accepting a diagnostic model slogan", () => {
  const data = demoSchema.parse({
    name: "",
    answers: {},
    brand: { referenceUrl: "https://clinic.example/" },
  });
  const research = researchSchema.parse({
    phase: "complete",
    sources: [
      {
        url: "https://clinic.example/",
        title: "Home",
        text: "Cuidados de saúde",
        fetchedAt: "2026-10-16",
      },
    ],
    profile: [
      {
        key: "name",
        value: "Síntese Claude",
        basis: "inferred",
        rationale: "Modelo inferiu um nome",
      },
    ],
  });
  const result = applyResearchToData(
    data,
    { url: data.brand.referenceUrl, material: "" },
    research,
  );
  assert.equal(result.name, "");
  assert.equal(profileConfirmed(result), false);
});
test("multiple content intentions survive reload and reach the creative brief", () => {
  let data = demoSchema.parse({
    name: "Clínica de teste",
    segment: "Análises clínicas",
    answers: { audience: "Adultos da região" },
  });
  data.brand = { ...data.brand, ...toggleContentIntent(data.brand, "explain") };
  data.brand = { ...data.brand, ...toggleContentIntent(data.brand, "booking") };
  data = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(selectedContentIntents(data.brand), ["explain", "booking"]);
  assert.match(firstPostBrief(data).constraints ?? "", /Explicar serviços/);
  assert.match(firstPostBrief(data).constraints ?? "", /Convidar para agendar/);
  data.brand = { ...data.brand, ...toggleContentIntent(data.brand, "explain") };
  assert.deepEqual(selectedContentIntents(data.brand), ["booking"]);
});
test("piece-specific constraints preserve the ordered content priorities", () => {
  const data = demoSchema.parse({
    name: "Clínica QA",
    answers: {},
    brand: {
      contentIntents: ["trust", "explain"],
      pieceBrief: {
        idea: "Prevenção",
        audience: "Adultos",
        goal: "Educar",
        constraints: "Não prometer resultados",
        format: "image",
      },
    },
  });
  const constraints = firstPostBrief(data).constraints ?? "";
  assert.match(constraints, /1\. Fortalecer Marca; 2\. Explicar serviços/);
  assert.match(constraints, /Não prometer resultados/);
});
test("visual CSS evidence and Markdown retain source attribution", () => {
  const visual = visualEvidence(
    "a{color:#123;background:#112233;font-family:'Inter',sans-serif}",
    "https://clinic.example/style.css",
  );
  assert.equal(visual.colors[0]?.value, "#112233");
  assert.equal(visual.fonts[0]?.value, "Inter");
  const markdown = evidenceMarkdown(
    researchSchema.parse({
      sources: [
        {
          url: "https://clinic.example/",
          title: "Clínica",
          text: "Análises clínicas",
          fetchedAt: "2026-10-16",
        },
      ],
      visualEvidence: visual,
    }),
  );
  assert.match(markdown, /https:\/\/clinic.example\/style.css/);
  assert.match(markdown, /Análises clínicas/);
});
