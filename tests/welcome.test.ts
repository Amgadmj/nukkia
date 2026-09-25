import { test } from "node:test";
import assert from "node:assert/strict";

// A changed routing rule must fail these tests: completed accounts go to the
// dashboard, while an explicit replay never resets or skips the welcome flow.
const welcome = await import("../src/lib/welcome.ts").catch(() => null);

test("new accounts start with company setup", () => {
  assert.equal(welcome?.welcomeDestination(false, false, false), "company");
});
test("an unfinished diagnostic opens the guided questions", () => {
  assert.equal(welcome?.welcomeDestination(true, false, false), "questions");
});
test("returning accounts land on their dashboard", () => {
  assert.equal(welcome?.welcomeDestination(true, true, false), "dashboard");
});
test("explicit replay preserves a completed account and shows its questions", () => {
  assert.equal(welcome?.welcomeDestination(true, true, true), "questions");
});
