import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const luminance = (hex: string) => {
  const channels = hex.match(/\w\w/g)!.map((value) => {
    const c = parseInt(value, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
};
for (const theme of [":root", ".dark"]) {
  test(`Atlantic ${theme} reading and action pairs meet normal-text contrast`, () => {
    const block = css.slice(css.indexOf(`${theme} {`)).split("}")[0]!;
    const color = (name: string) => {
      const value = block.match(new RegExp(`--nukkia-${name}: (#[0-9a-f]{6});`))?.[1];
      assert.ok(value, `missing Atlantic ${name}`);
      return luminance(value.slice(1));
    };
    for (const [fg, bg] of [
      ["text", "bg"],
      ["muted", "surface"],
      ["on-action", "action"],
    ]) {
      const a = color(fg!),
        b = color(bg!);
      assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${fg}/${bg}`);
    }
  });
}
test("application theme layers contain no legacy purple brand literals", () => {
  for (const file of ["styles.css", "workspace.css", "studio.css", "landing.css"]) {
    assert.doesNotMatch(
      readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"),
      /#(?:18005f|08071a|100d2b|17133a|6150c6|8778bf)/i,
    );
  }
});

test("legacy onboarding fields cannot force a dark background over the chosen theme", () => {
  const demo = readFileSync(new URL("../src/demo.css", import.meta.url), "utf8");
  const field = demo.slice(demo.indexOf(".quick-demo .quick-input {")).split("}")[0]!;
  assert.doesNotMatch(field, /background:[^;]+!important/);
  assert.match(field, /background: var\(--nukkia-surface\)/);
});

test("authentication follows the selected theme and uses the shared primary action", () => {
  const auth = readFileSync(new URL("../src/routes/auth.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(auth, /nukkia-workspace dark/);
  assert.doesNotMatch(auth, /bg-white font-semibold text-zinc-950/);
  assert.match(auth, /bg-primary font-semibold text-primary-foreground/);
});
