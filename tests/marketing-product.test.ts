import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent, creativeFingerprint, updateBrand } from "../src/lib/brand-preview.ts";
import {
  seedWorkspace,
  workspaceKey,
  recordWorkspaceEvent,
  firstValueMinutes,
  nextWorkspaceAction,
  parseStoredWorkspace,
} from "../src/lib/marketing-workspace.ts";

const fixture = () =>
  demoSchema.parse({
    name: "Estúdio Aurora",
    segment: "Pilates",
    answers: {
      offers: "Aulas de pilates",
      audience: "Adultos que procuram movimento",
      goals: "Atrair novos clientes",
    },
    brand: { confirmed: true, detail: "Turmas de até quatro pessoas com acompanhamento próximo." },
  });

test("legacy company values cannot prevent the workspace from mounting", () => {
  const data = seedWorkspace({
    name: "A".repeat(200),
    segment: "B".repeat(200),
    website: "https://brand.example/" + "a".repeat(400),
  });
  assert.ok(data.name.length <= 120);
  assert.ok(data.segment.length <= 120);
  assert.ok(data.answers.website.length <= 200);
  assert.equal(data.brand.confirmed, false);
  assert.equal(data.brand.creative, null);
});

test("draft recovery keeps account and company scopes distinct and recovers interrupted research", () => {
  assert.notEqual(workspaceKey("a", "x"), workspaceKey("b", "x"));
  assert.notEqual(workspaceKey("a", "x"), workspaceKey("a", "y"));
  const data = fixture();
  data.brand.research.status = "loading";
  const saved = parseStoredWorkspace(JSON.stringify({ data, revision: "r1", dirty: true }));
  assert.equal(saved?.data.name, "Estúdio Aurora");
  assert.equal(saved?.data.brand.research.status, "unavailable");
  assert.equal(saved?.dirty, true);
  assert.equal(saved?.revision, "r1");
  assert.equal(parseStoredWorkspace("broken json"), null);
});

test("first value needs observed start, matching approval and export; repeated clicks do not award events", () => {
  let data = fixture();
  data.brand.creative = composeContent(data, "educate");
  assert.equal(firstValueMinutes(data), null);
  data = recordWorkspaceEvent(data, "started", "2026-09-24T12:00:00.000Z");
  assert.equal(recordWorkspaceEvent(data, "started").events.length, 1);
  assert.equal(recordWorkspaceEvent(data, "approved").events.length, 1);
  data.brand.creative!.approved = creativeFingerprint(data);
  data = recordWorkspaceEvent(data, "approved", "2026-09-24T12:03:00.000Z");
  assert.equal(firstValueMinutes(data), null);
  data.brand.creative!.exported = creativeFingerprint(data);
  data = recordWorkspaceEvent(data, "exported", "2026-09-24T12:04:30.000Z");
  assert.equal(firstValueMinutes(data), 4.5);
  assert.equal(recordWorkspaceEvent(data, "exported").events.length, 3);
  const unobserved = { ...data, events: data.events.filter((event) => event.type !== "started") };
  assert.equal(firstValueMinutes(unobserved), null);
  const mismatch = {
    ...data,
    events: data.events.map((event) =>
      event.type === "approved" ? { ...event, fingerprint: "different-version" } : event,
    ),
  };
  assert.equal(firstValueMinutes(mismatch), null);
});

test("next action follows actual delivery status and returns to review after a visual edit", () => {
  const data = fixture();
  assert.equal(nextWorkspaceAction(demoSchema.parse({ name: "", answers: {} })).section, "cerebro");
  data.brand.creative = composeContent(data, "educate");
  assert.equal(nextWorkspaceAction(data).label, "Revisar minha peça");
  data.brand.creative.approved = creativeFingerprint(data);
  assert.equal(nextWorkspaceAction(data).label, "Baixar arte e legenda");
  data.brand.creative.exported = creativeFingerprint(data);
  assert.equal(nextWorkspaceAction(data).section, "trilha");
  data.brand = updateBrand(data.brand, { accent: "#112233" });
  assert.equal(nextWorkspaceAction(data).label, "Revisar minha peça");
});
