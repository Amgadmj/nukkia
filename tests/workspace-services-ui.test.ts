import * as serviceBriefDomain from "../src/lib/service-brief.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as catalog from "../src/lib/service-catalog.ts";
import * as storage from "../src/lib/service-catalog-storage.ts";
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function render(scope?: storage.CatalogScope, raw: string | null = null) {
  const exported: Record<string, unknown> = {};
  const writes: string[] = [];
  const dependencies: Record<string, unknown> = {
    react: React,
    "./material-input": { MaterialInput: "material-input" },
    "@tanstack/react-router": { useBlocker() {} },
    "@/lib/service-brief": serviceBriefDomain,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "lucide-react": require("lucide-react"),
    "./marketing-context": { activeWorkspaces: new Set() },
    "@/lib/service-catalog": catalog,
    "@/lib/service-catalog-storage": storage,
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/workspace-services.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports: exported,
      require: (id: string) => {
        if (!(id in dependencies)) throw Error(id);
        return dependencies[id];
      },
      window: { localStorage: { getItem: () => raw, setItem: (key: string) => writes.push(key) } },
      crypto: globalThis.crypto,
    },
  );
  const html = renderToStaticMarkup(React.createElement(exported["WorkspaceServices"], { scope }));
  return { html, writes };
}
test("missing company disables catalog instead of displaying fictional data", () => {
  const { html } = render();
  assert.match(html, /Selecione sua empresa/);
  assert.doesNotMatch(html, /Novo serviço/);
});
test("empty demo identifies local fictional storage and create action", () => {
  const { html, writes } = render({ kind: "demo" });
  assert.match(html, /Demonstração/);
  assert.match(html, /Criar primeiro serviço/);
  assert.match(html, /apenas neste navegador/);
  assert.deepEqual(writes, []);
});
test("stored detail distinguishes draft and pending conditions, without importing material", () => {
  const scope = { kind: "demo" } as const;
  let c = catalog.emptyCatalog(storage.catalogScopeKey(scope));
  const item = {
    ...catalog.emptyService(),
    title: "Consulta",
    source: "Equipe",
    material: "Referência autorizada",
  };
  c = catalog.putService(c, item);
  const { html } = render(scope, JSON.stringify(c));
  assert.match(html, /Consulta/);
  assert.match(html, /Rascunho/);
  assert.match(html, /Condições ainda não confirmadas/);
  assert.match(html, /Referência autorizada/);
  assert.match(html, /Selecionar serviço/);
});
test("corrupt persisted data is preserved at mount and reset is explicit", () => {
  const { html, writes } = render({ kind: "demo" }, "{broken");
  assert.match(html, /Eles foram preservados/);
  assert.match(html, /Redefinir catálogo/);
  assert.deepEqual(writes, []);
});
