import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sources(path)
      : /\.(tsx?|css|html)$/.test(name)
        ? [path]
        : [];
  });
}

test("no page shows the Estúdio de Saúde label", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  for (const file of sources(root)) {
    const text = readFileSync(file, "utf8").normalize("NFC").toLocaleLowerCase("pt-BR");
    assert.doesNotMatch(text, /est[úu]dio de sa[úu]de/, file);
  }
});

test("video script tab does not render the save-version card", () => {
  for (const [file, view] of [
    ["../src/routes/_authenticated/conteudo.tsx", "aba"],
    ["../src/components/demo-workspace.tsx", "contentView"],
  ]) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    const guard = text.slice(0, text.indexOf("<SaveToLibrary"));
    assert.ok(guard.trimEnd().endsWith(`{${view} === "peca" && (`), file);
  }
});
