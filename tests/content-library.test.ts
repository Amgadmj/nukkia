import test from "node:test";
import assert from "node:assert/strict";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent } from "../src/lib/brand-preview.ts";
import { prepareHealthOptions } from "../src/lib/health-studio.ts";
import * as library from "../src/lib/content-library.ts";

function fixture() {
  const data = demoSchema.parse({
    name: "Clínica QA",
    segment: "Clínica",
    answers: { offers: "Consulta inicial", audience: "Adultos", goals: "Informar" },
    brand: {
      confirmed: true,
      detail: "Atendimento com horário marcado.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });
  data.brand.creative = composeContent(data, "invite");
  return data;
}
test("legacy workspace gains an empty library without losing the editor", () => {
  assert.deepEqual(fixture().library.items, []);
});
test("saving versions preserves exact text through JSON reload and resumes without rolling back brand context", () => {
  let data = library.saveLibraryVersion(fixture(), "generic");
  const id = data.library.items[0]!.id;
  const first = data.brand.creative!.copy.title;
  data.brand.creative!.copy.title = "Edição humana";
  data = library.saveLibraryVersion(data, "generic", 1);
  data = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.equal(data.library.items[0]!.versions.length, 2);
  data.name = "Nome atual";
  data = library.resumeLibraryVersion(data, id, 1);
  assert.equal(data.name, "Nome atual");
  assert.equal(data.brand.creative!.copy.title, first);
  assert.equal(data.brand.creative!.approved, null);
  assert.equal(data.library.items[0]!.versions[1]!.snapshot.kind, "generic");
});
test("stale save cannot overwrite a newer saved version", () => {
  const data = library.saveLibraryVersion(fixture(), "generic");
  assert.throws(() => library.saveLibraryVersion(data, "generic", 0), /versão/);
  assert.equal(data.library.items[0]!.versions.length, 1);
});
test("duplicate has independent identity and archive is reversible", () => {
  let data = library.saveLibraryVersion(fixture(), "generic");
  const id = data.library.items[0]!.id;
  data = library.duplicateLibraryItem(data, id, 1);
  assert.equal(data.library.items.length, 2);
  assert.notEqual(data.library.items[1]!.id, id);
  data = library.archiveLibraryItem(data, id, true);
  assert.equal(data.library.items[0]!.archived, true);
  assert.equal(library.archiveLibraryItem(data, id, false).library.items[0]!.archived, false);
});
test("planned dates bind to an existing exact version and reject impossible dates", () => {
  const data = library.saveLibraryVersion(fixture(), "generic");
  const id = data.library.items[0]!.id;
  assert.throws(() => library.planLibraryVersion(data, id, 1, "2026-02-30"), /data/);
  assert.throws(() => library.planLibraryVersion(data, id, 9, "2026-10-10"), /Versão/);
  const planned = library.planLibraryVersion(data, id, 1, "2026-10-10");
  assert.deepEqual(planned.library.items[0]!.plan, { date: "2026-10-10", version: 1 });
  assert.equal(planned.library.items[0]!.versions[0]!.snapshot.kind, "generic");
});
test("Health resume preserves selected option and advances revision, never confers review authority", () => {
  let data = fixture();
  data.healthStudio = prepareHealthOptions(data.healthStudio);
  data = library.saveLibraryVersion(data, "health");
  const id = data.library.items[0]!.id;
  const selected = data.healthStudio.selectedOption;
  data.healthStudio.revision = 90;
  data = library.resumeLibraryVersion(data, id, 1);
  assert.equal(data.healthStudio.selectedOption, selected);
  assert.equal(data.healthStudio.revision, 91);
  assert.equal("approved" in data.healthStudio, false);
});
test("empty editors and missing versions are refused without deleting current work", () => {
  const data = demoSchema.parse({ name: "QA", answers: {} });
  assert.throws(() => library.saveLibraryVersion(data, "generic"), /rascunho/);
  assert.throws(() => library.saveLibraryVersion(data, "health"), /rascunho/);
  assert.throws(() => library.resumeLibraryVersion(fixture(), "missing", 1), /encontrad/);
});

test("a new composition can be saved as an independent item even after archiving the active item", () => {
  let data = library.saveLibraryVersion(fixture(), "generic");
  const firstId = data.library.items[0]!.id;
  data = library.archiveLibraryItem(data, firstId, true);
  data.brand.creative!.copy.title = "Segunda peça independente";
  data = library.saveNewLibraryItem(data, "generic");
  assert.equal(data.library.items.length, 2);
  assert.notEqual(data.library.activeGeneric, firstId);
  assert.equal(data.library.items[0]!.versions.length, 1);
  assert.equal(data.library.items[1]!.title, "Segunda peça independente");
});

test("archive and restore preserve the intended date and exact saved version", () => {
  let data = library.saveLibraryVersion(fixture(), "generic");
  const id = data.library.items[0]!.id;
  data = library.planLibraryVersion(data, id, 1, "2026-10-15");
  data = library.archiveLibraryItem(data, id, true);
  assert.throws(() => library.planLibraryVersion(data, id, 1, "2026-10-16"), /Restaure/);
  data = library.archiveLibraryItem(data, id, false);
  assert.deepEqual(data.library.items[0]!.plan, { date: "2026-10-15", version: 1 });
});
