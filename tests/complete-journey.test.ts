import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent, firstPostBrief } from "../src/lib/brand-preview.ts";
import {
  planLibraryVersion,
  saveLibraryVersion,
  resumeLibraryVersion,
} from "../src/lib/content-library.ts";
import {
  configureHealthDraft,
  prepareHealthOptions,
  resolveHealthMaterial,
} from "../src/lib/health-studio.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Ateliê QA",
    segment: "Cerâmica",
    answers: { offers: "Oficina de cerâmica", audience: "Adultos", goals: "Apresentar a oficina" },
    brand: {
      confirmed: true,
      detail: "Oficina acompanhada pela equipe local.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });
test("piece instructions survive reload, drive the composition and leave brand facts intact", () => {
  const data = fixture();
  const next = demoSchema.parse({
    ...data,
    brand: {
      ...data.brand,
      pieceBrief: {
        format: "image",
        idea: "Conheça nossa oficina de sábado",
        goal: "Receber perguntas",
        audience: "Iniciantes",
        constraints: "Sem promessas de resultados",
        ratio: "4:5",
      },
    },
  });
  assert.equal(firstPostBrief(next).goal, "Receber perguntas");
  assert.equal(firstPostBrief(next).audience, "Iniciantes");
  assert.equal(next.answers.goals, data.answers.goals);
  const creative = composeContent(next, "educate");
  assert.equal(creative.copy.title, "Conheça nossa oficina de sábado");
  assert.equal(creative.slides.length, 0);
  assert.deepEqual(
    demoSchema.parse(JSON.parse(JSON.stringify(next))).brand.pieceBrief,
    next.brand.pieceBrief,
  );
});
test("resuming a version restores its piece instructions without rolling back brand facts", () => {
  let data = fixture();
  data = demoSchema.parse({
    ...data,
    brand: {
      ...data.brand,
      pieceBrief: {
        format: "carousel",
        idea: "Ideia original",
        goal: "Informar",
        audience: "Iniciantes",
        constraints: "Sem preços",
        ratio: "4:5",
      },
    },
  });
  data.brand.creative = composeContent(data, "invite");
  data = saveLibraryVersion(data, "generic");
  const id = data.library.items[0]!.id;
  data.brand.pieceBrief!.idea = "Outra ideia";
  data.name = "Marca atual";
  const resumed = resumeLibraryVersion(data, id, 1);
  assert.equal(resumed.brand.pieceBrief!.idea, "Ideia original");
  assert.equal(resumed.name, "Marca atual");
  assert.equal(resumed.brand.creative!.slides.length, 2);
});
test("planning retains an intended channel through saving a newer version and JSON recovery", () => {
  let data = fixture();
  data.brand.creative = composeContent(data, "invite");
  data = saveLibraryVersion(data, "generic");
  const id = data.library.items[0]!.id;
  data = planLibraryVersion(data, id, 1, "2026-10-15", "instagram");
  data.brand.creative!.copy.title = "Versão nova";
  data = saveLibraryVersion(data, "generic");
  const restored = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.library.items[0]!.plan, {
    date: "2026-10-15",
    version: 1,
    channel: "instagram",
  });
});
test("Health examples use the supplied idea before selection and retain it on reload", () => {
  const data = fixture();
  const draft = configureHealthDraft(data.healthStudio, {
    idea: "Como chegar à unidade de exemplo",
  });
  const prepared = prepareHealthOptions(draft);
  assert.equal(prepared.idea, "Como chegar à unidade de exemplo");
  assert.ok(
    prepared.options.every((option) =>
      option.scenes.some((scene) => scene.script.includes(prepared.idea)),
    ),
  );
  assert.equal(
    demoSchema.parse({ ...data, healthStudio: prepared }).healthStudio.idea,
    prepared.idea,
  );
});

test("uploaded inspiration retains pixels and source in immutable saved snapshots", async () => {
  const { addInspiration, editInspiration, attachInspiration } =
    await import("../src/lib/inspirations.ts");
  let data = addInspiration(fixture());
  const id = data.inspirations[0]!.id;
  data = editInspiration(data, id, {
    title: "Material QA",
    image: "data:image/png;base64,AAAA",
    source: "Arquivo sintético local",
    permission: "own",
  });
  data = attachInspiration(data, id);
  data.brand.creative = composeContent(data, "invite");
  data = saveLibraryVersion(data, "generic");
  const restored = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.brand.inspirationBrief[0]!.image, "data:image/png;base64,AAAA");
  assert.equal(restored.brand.inspirationBrief[0]!.source, "Arquivo sintético local");
});
test("scene material stays with its scene after reorder and undo", async () => {
  const { changeHealthScene, undoHealthEdit } = await import("../src/lib/health-studio.ts");
  let draft = prepareHealthOptions(fixture().healthStudio);
  const id = draft.options[0]!.scenes[0]!.id;
  const material = {
    id: crypto.randomUUID(),
    title: "Foto QA",
    image: "data:image/png;base64,AAAA",
    source: "Local QA",
    permission: "own",
  };
  draft = changeHealthScene(
    draft,
    { type: "material", sceneId: id, value: material },
    draft.revision,
  );
  draft = changeHealthScene(draft, { type: "move", sceneId: id, offset: 1 }, draft.revision);
  assert.equal(
    resolveHealthMaterial(draft, draft.options[0]!.scenes[1]!.material)!.image,
    material.image,
  );
  assert.equal(undoHealthEdit(draft).options[0]!.scenes[0]!.material!.source, "Local QA");
});
test("service material is retained by catalog parsing and explicit briefing application", async () => {
  const { emptyService, emptyCatalog, putService, parseCatalog } =
    await import("../src/lib/service-catalog.ts");
  const { applyServiceToBrief } = await import("../src/lib/service-brief.ts");
  const material = {
    id: crypto.randomUUID(),
    title: "Oficina QA",
    image: "data:image/png;base64,AAAA",
    source: "Sintético local",
    permission: "own" as const,
    url: "",
    note: "",
  };
  const service = {
    ...emptyService(),
    title: "Oficina QA",
    summary: "Acompanhamento da equipe local.",
    audience: "Iniciantes",
    conditionsConfirmed: true,
    status: "confirmed" as const,
    visualMaterial: material,
  };
  const catalog = putService(emptyCatalog("qa"), service);
  const restored = parseCatalog(JSON.stringify(catalog), "qa");
  assert.deepEqual(restored.items[0]!.visualMaterial, material);
  const next = applyServiceToBrief(fixture(), restored.items[0]!, restored.revision, "2026-10-05");
  assert.deepEqual(next.brand.serviceBrief!.visualMaterial, material);
  assert.equal(next.answers.offers, fixture().answers.offers);
});
test("Health briefing material reaches each first scene without granting output authority", () => {
  const material = {
    id: crypto.randomUUID(),
    title: "Fonte QA",
    image: "data:image/png;base64,AAAA",
    source: "Fictício local",
    permission: "own" as const,
    url: "",
    note: "",
  };
  const draft = configureHealthDraft(fixture().healthStudio, { material });
  const options = prepareHealthOptions(draft);
  assert.ok(
    options.options.every(
      (option) =>
        resolveHealthMaterial(options, option.scenes[0]!.material)?.image === material.image,
    ),
  );
  assert.equal("approved" in options, false);
});
test("creative validation follows the chosen format independently of message intention", async () => {
  const { creativeIssues } = await import("../src/lib/brand-preview.ts");
  const data = demoSchema.parse({
    ...fixture(),
    brand: { ...fixture().brand, pieceBrief: { format: "image", idea: "Oficina de sábado" } },
  });
  data.brand.creative = composeContent(data, "educate");
  assert.deepEqual(creativeIssues(data), []);
  data.brand.pieceBrief!.format = "carousel";
  data.brand.creative = composeContent(data, "invite");
  data.brand.creative.slides[1]!.body = "";
  assert.ok(creativeIssues(data).some((issue) => issue.includes("três páginas")));
});
test("context navigation retains a validated creation return view", async () => {
  const { contextSearch } = await import("../src/lib/marketing-workspace.ts");
  assert.equal(
    contextSearch({ editar: "contexto", retorno: "conteudo", origemConteudo: "briefing" })
      .origemConteudo,
    "briefing",
  );
  assert.equal(
    contextSearch({
      editar: "contexto",
      retorno: "conteudo",
      origemConteudo: "https://example.com",
    }).origemConteudo,
    undefined,
  );
});
test("a Health image remains editable through twenty edits without duplicating pixels in history", async () => {
  const health = await import("../src/lib/health-studio.ts");
  const image = "data:image/png;base64," + "A".repeat(500000);
  const material = {
    id: crypto.randomUUID(),
    title: "QA",
    image,
    source: "Synthétique",
    permission: "own" as const,
    url: "",
    note: "",
  };
  let draft = health.prepareHealthOptions(
    health.configureHealthDraft(fixture().healthStudio, { material }),
  );
  const id = draft.options[0]!.scenes[0]!.id;
  for (let i = 0; i < 20; i++)
    draft = health.changeHealthScene(
      draft,
      { type: "script", sceneId: id, value: `Texte QA ${i}` },
      draft.revision,
    );
  assert.ok(
    JSON.stringify(draft).length < 1_000_000,
    "history must not serialize the same pixels for every keystroke",
  );
  draft = health.healthStudioSchema.parse(JSON.parse(JSON.stringify(draft)));
  const undone = health.undoHealthEdit(draft);
  assert.equal(undone.options[0]!.scenes[0]!.script, "Texte QA 18");
  assert.equal(
    health.resolveHealthMaterial(undone, undone.options[0]!.scenes[0]!.material)!.image,
    image,
  );
});
test("the reference limit rejects a twenty-first attachment before changing the workspace", async () => {
  const refs = await import("../src/lib/inspirations.ts");
  let data = fixture();
  data.brand.inspirationBrief = Array.from({ length: 20 }, (_, i) => ({
    ...materialForTest(),
    title: `Reference ${i}`,
  }));
  data = refs.addInspiration(data);
  const id = data.inspirations[0]!.id;
  data = refs.editInspiration(data, id, { title: "Autre", url: "https://example.com" });
  const before = JSON.stringify(data);
  assert.throws(() => refs.attachInspiration(data, id), /20/);
  assert.equal(JSON.stringify(data), before);
  function materialForTest() {
    return {
      id: crypto.randomUUID(),
      title: "Reference",
      image: "",
      source: "",
      note: "",
      url: "https://example.com",
      permission: "unknown" as const,
    };
  }
});
test("Health material revisions with the same reference id remain distinct through undo and redo", async () => {
  const health = await import("../src/lib/health-studio.ts");
  const material = {
    id: crypto.randomUUID(),
    title: "QA",
    image: "data:image/png;base64,AAAA",
    source: "QA",
    permission: "own" as const,
    url: "",
    note: "",
  };
  let draft = health.prepareHealthOptions(
    health.configureHealthDraft(fixture().healthStudio, { material }),
  );
  const id = draft.options[0]!.scenes[0]!.id;
  draft = health.changeHealthScene(
    draft,
    { type: "material", sceneId: id, value: { ...material, image: "data:image/png;base64,BBBB" } },
    draft.revision,
  );
  const older = health.undoHealthEdit(draft);
  assert.equal(
    health.resolveHealthMaterial(older, older.options[0]!.scenes[0]!.material)!.image,
    material.image,
  );
  const newer = health.redoHealthEdit(older);
  assert.equal(
    health.resolveHealthMaterial(newer, newer.options[0]!.scenes[0]!.material)!.image,
    "data:image/png;base64,BBBB",
  );
});
