import test from "node:test";
import assert from "node:assert/strict";
import * as calendar from "../src/lib/content-calendar.ts";
import {
  calendarDays,
  localCalendarDate,
  plannedForDay,
  plannedTitle,
  shiftCalendarDay,
  shiftCalendarMonth,
} from "../src/lib/content-calendar.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent, CONTENT_APPROACHES } from "../src/lib/brand-preview.ts";
import {
  saveLibraryVersion,
  duplicateLibraryItem,
  planLibraryVersion,
  archiveLibraryItem,
} from "../src/lib/content-library.ts";

function fixture() {
  const data = demoSchema.parse({
    name: "Clínica QA",
    answers: { offers: "Apresentação da equipe", audience: "Pessoas conhecendo a clínica" },
    brand: {
      detail: "Atendimento com hora marcada.",
      pieceBrief: { idea: "Conheça nossa equipe", format: "carousel" },
    },
  });
  data.brand.creative = composeContent(data, "invite");
  return saveLibraryVersion(data, "generic");
}
test("calendar move validates the saved plan and preserves date-only legacy fields", () => {
  let data = fixture();
  const id = data.library.items[0]!.id;
  data = planLibraryVersion(data, id, 1, "2026-10-15");
  const before = JSON.stringify(data);
  assert.deepEqual(calendar.calendarPlanMove(data.library.items, id, "2026-10-20"), {
    date: "2026-10-20",
    version: 1,
  });
  for (const date of ["2026-02-30", "bad", "", "2026-10-15"])
    assert.equal(calendar.calendarPlanMove(data.library.items, id, date), null);
  assert.equal(calendar.calendarPlanMove(data.library.items, "unknown", "2026-10-20"), null);
  assert.equal(JSON.stringify(data), before);
});
test("calendar aligns Monday through Sunday across leap years and year boundaries", () => {
  const days = calendarDays("2028-02");
  assert.equal(days.length, 42);
  assert.equal(new Set(days).size, 42);
  assert.equal(days[0], "2028-01-31");
  assert.ok(days.includes("2028-02-29"));
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarDay("2028-03-01", -1), "2028-02-29");
  assert.equal(localCalendarDate(new Date(2026, 0, 1, 0, 10)), "2026-01-01");
});
test("planning preserves an exact snapshot, time and timezone across edits and reload", () => {
  let data = fixture();
  const id = data.library.items[0]!.id;
  data = planLibraryVersion(data, id, 1, "2026-10-15", "instagram", {
    time: "09:30",
    timezone: "America/Sao_Paulo",
  });
  data.brand.creative!.copy.title = "New unsaved draft";
  data = saveLibraryVersion(data, "generic");
  data = planLibraryVersion(data, id, 1, "2026-10-16", "whatsapp");
  const restored = demoSchema.parse(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.library.items[0]!.plan, {
    date: "2026-10-16",
    version: 1,
    channel: "whatsapp",
    time: "09:30",
    timezone: "America/Sao_Paulo",
  });
  assert.equal(plannedTitle(restored.library.items[0]!), "Conheça nossa equipe");
  assert.equal(restored.library.items[0]!.versions.length, 2);
  const cleared = planLibraryVersion(restored, id, 1, "2026-10-16", undefined, { time: "" });
  assert.equal(cleared.library.items[0]!.plan!.time, undefined);
  assert.equal(planLibraryVersion(cleared, id, 1, "").library.items[0]!.plan, null);
});
test("same-day bubbles sort by local clock, retain date-only legacy items and exclude archives", () => {
  let data = fixture();
  const first = data.library.items[0]!.id;
  data = duplicateLibraryItem(data, first, 1);
  const second = data.library.items[1]!.id;
  data = duplicateLibraryItem(data, first, 1);
  const third = data.library.items[2]!.id;
  data = planLibraryVersion(data, first, 1, "2026-10-15");
  data = planLibraryVersion(data, second, 1, "2026-10-15", "instagram", {
    time: "14:00",
    timezone: "America/Sao_Paulo",
  });
  data = planLibraryVersion(data, third, 1, "2026-10-15", "instagram", {
    time: "08:00",
    timezone: "America/Sao_Paulo",
  });
  assert.deepEqual(
    plannedForDay(data.library.items, "2026-10-15").map((i) => i.id),
    [third, second, first],
  );
  data = archiveLibraryItem(data, third, true);
  assert.deepEqual(
    plannedForDay(data.library.items, "2026-10-15").map((i) => i.id),
    [second, first],
  );
  assert.equal(plannedForDay(data.library.items, "2026-10-16").length, 0);
  assert.equal(duplicateLibraryItem(data, second, 1).library.items.at(-1)!.plan, null);
});
test("invalid clocks and zones cannot corrupt saved plans", () => {
  const data = fixture();
  const id = data.library.items[0]!.id;
  const before = JSON.stringify(data);
  for (const time of ["25:00", "12:60", "9:30"])
    assert.throws(
      () => planLibraryVersion(data, id, 1, "2026-10-15", "instagram", { time, timezone: "UTC" }),
      /horário/,
    );
  assert.throws(
    () =>
      planLibraryVersion(data, id, 1, "2026-10-15", undefined, {
        time: "10:00",
        timezone: "Mars/Olympus",
      }),
    /fuso/,
  );
  assert.throws(
    () => planLibraryVersion(data, id, 1, "2026-10-15", undefined, { time: "10:00" }),
    /fuso/,
  );
  assert.equal(JSON.stringify(data), before);
});
test("six approaches preserve format and confirmed detail with distinct new editorial treatments", () => {
  const data = fixture();
  const before = JSON.stringify(data);
  assert.equal(CONTENT_APPROACHES.length, 6);
  const titles = new Set<string>();
  for (const approach of CONTENT_APPROACHES) {
    const creative = composeContent(data, approach.id);
    assert.equal(creative.approach, approach.id);
    assert.equal(creative.slides.length, 2);
    assert.ok(creative.copy.caption.includes(data.brand.detail));
    titles.add(creative.copy.title);
    assert.equal(
      demoSchema.parse({
        ...data,
        brand: { ...data.brand, creative, preferredApproach: approach.id },
      }).brand.preferredApproach,
      approach.id,
    );
  }
  assert.ok(titles.size >= 4);
  assert.equal(JSON.stringify(data), before);
});
