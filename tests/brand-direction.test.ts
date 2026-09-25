import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import { nextWorkspaceAction, parseStoredWorkspace } from "../src/lib/marketing-workspace.ts";
import { postSvg } from "../src/lib/post-art.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    answers: {
      offers: "Programa personalizado de exercícios",
      audience: "Adultos que procuram movimento",
      goals: "Atrair novos clientes",
    },
    brand: { confirmed: true, detail: "Acompanhamento individual por profissionais da equipe." },
  });

test("finishing onboarding stores direction without generating content or claiming delivery", () => {
  assert.equal(typeof preview.completeBrandOnboarding, "function");
  const data = preview.completeBrandOnboarding(fixture(), "essential");
  assert.equal(data.onboarded, true);
  assert.equal(data.brand.visualStyle, "essential");
  assert.equal(data.brand.creative, null);
  assert.equal(data.brand.identityConfirmed, false);
  assert.equal(preview.creativeStatus(data).xp, 20);
  assert.equal(nextWorkspaceAction(data).section, "marca");
});

test("replaying onboarding preserves an edited draft and never silently recomposes it", () => {
  assert.equal(typeof preview.completeBrandOnboarding, "function");
  const data = fixture();
  data.brand.creative = preview.composeContent(data, "invite");
  data.brand.creative.copy.title = "Meu título cuidadosamente revisado";
  const next = preview.completeBrandOnboarding(data, "dynamic");
  assert.deepEqual(next.brand.creative?.copy, data.brand.creative.copy);
  assert.equal(next.brand.creative?.approach, "invite");
  assert.deepEqual(data.brand.creative.copy.title, "Meu título cuidadosamente revisado");
});

test("style selection survives storage and photo requirements follow the actual style", () => {
  assert.equal(typeof preview.identityIssues, "function");
  const data = demoSchema.parse({
    ...fixture(),
    brand: { ...fixture().brand, visualStyle: "warm", identityConfirmed: true },
  });
  const saved = parseStoredWorkspace(JSON.stringify({ data, revision: null, dirty: true }));
  assert.equal(saved?.data.brand.visualStyle, "warm");
  assert.equal(preview.identityIssues(data.brand).length, 1);
  assert.equal(nextWorkspaceAction(data).section, "marca");
  data.brand.photo = "data:image/png;base64,YQ==";
  assert.deepEqual(preview.identityIssues(data.brand), []);
  assert.equal(nextWorkspaceAction(data).section, "conteudo");
  data.brand.photo = "";
  data.brand.visualStyle = "essential";
  assert.deepEqual(preview.identityIssues(data.brand), []);
});

test("reviewing a different style requires identity confirmation again", () => {
  const data = demoSchema.parse({
    ...fixture(),
    brand: { ...fixture().brand, visualStyle: "essential", identityConfirmed: true },
  });
  const brand = preview.updateBrand(data.brand, { visualStyle: "warm" });
  assert.equal(brand.identityConfirmed, false);
});

test("selected styles change exported art and approval fingerprint", () => {
  const data = fixture();
  data.brand.creative = preview.composeContent(data, "invite");
  const outputs = ["essential", "warm", "dynamic"].map((visualStyle) => {
    const styled = demoSchema.parse({
      ...data,
      brand: { ...data.brand, visualStyle, photo: "data:image/png;base64,YQ==" },
    });
    return {
      svg: postSvg(preview.firstPostBrief(styled), styled.brand.creative!.copy, styled.brand),
      fingerprint: preview.creativeFingerprint(styled),
    };
  });
  assert.equal(new Set(outputs.map((output) => output.svg)).size, 3);
  assert.equal(new Set(outputs.map((output) => output.fingerprint)).size, 3);
});

test("a photo-led style cannot be approved without a photo even for an educational approach", () => {
  const data = demoSchema.parse({
    ...fixture(),
    brand: { ...fixture().brand, visualStyle: "warm" },
  });
  data.brand.creative = preview.composeContent(data, "educate");
  assert.ok(preview.creativeIssues(data).some((issue) => issue.includes("foto")));
});
