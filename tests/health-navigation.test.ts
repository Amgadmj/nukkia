import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { defaultParseSearch } from "@tanstack/react-router";
import * as workspace from "../src/lib/marketing-workspace.ts";
import { demoSchema } from "../src/lib/quick-start.ts";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
}
function execute(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { exports, require: (id: string) => dependencies[id] ?? {} },
  );
  return exports;
}
const { Route } = execute("routes/demo.tsx", {
  zod: { z },
  "@tanstack/react-router": { createFileRoute: () => (options: unknown) => options },
}) as {
  Route: { validateSearch: z.ZodType<{ vista: string; editar?: string; retorno?: string }> };
};
const data = demoSchema.parse({ name: "A saved clinic", answers: {} });
const { DemoWorkspace } = execute("components/demo-workspace.tsx", {
  react: { useState: (value: unknown) => [value, () => {}] },
  "react/jsx-runtime": {
    jsx: (type: unknown, props: object) => ({ type, props }),
    jsxs: (type: unknown, props: object) => ({ type, props }),
  },
  "./workspace-shell": { WorkspaceShell: "shell" },
  "./marketing-views": { LocalResults: "local-results" },
  "./health-studio": { HealthStudio: "health-studio" },
  "./content-studio": { ContentStudio: "content-studio" },
  "./workspace-context-editor": { WorkspaceContextEditor: "context-editor" },
  "@/lib/marketing-workspace": workspace,
}) as { DemoWorkspace: (props: Record<string, unknown>) => Element };

function render(search: string) {
  const query = Route.validateSearch.parse(defaultParseSearch(search));
  return {
    query,
    tree: nodes(
      DemoWorkspace({
        data,
        section: "conteudo",
        contentView: query.vista,
        onContentView: () => {},
        onSection: () => {},
      }),
    ),
  };
}

test("opening the demo Content destination and reloading enters Health directly", () => {
  for (let reload = 0; reload < 2; reload++) {
    const app = render("?passo=6&aba=conteudo");
    assert.equal(app.query.vista, "saude");
    assert.equal(app.tree.filter((node) => node.type === "health-studio").length, 1);
    assert.equal(app.tree.filter((node) => node.type === "content-studio").length, 0);
  }
});
test("explicit legacy content views remain accessible and invalid views fall back to Health", () => {
  for (const view of ["peca", "abordagens"]) {
    const app = render(`?passo=6&aba=conteudo&vista=${view}`);
    assert.equal(app.query.vista, view);
    const studio = app.tree.find((node) => node.type === "content-studio");
    assert.ok(studio);
    assert.equal(studio.props.view, view);
  }
  assert.equal(render("?passo=6&aba=conteudo&vista=unknown").query.vista, "saude");
});
test("the operator's existing context URL still edits context without resetting its return path", () => {
  const query = Route.validateSearch.parse(
    defaultParseSearch("?passo=6&aba=cerebro&editar=contexto&retorno=conteudo"),
  );
  assert.equal(query.editar, "contexto");
  assert.equal(query.retorno, "conteudo");
  assert.equal(data.name, "A saved clinic");
});

test("results continuation opens the generic piece rather than the previous Health tab", () => {
  const calls: string[] = [];
  const tree = nodes(
    DemoWorkspace({
      data,
      section: "metricas",
      contentView: "saude",
      onContentView: (view: string) => calls.push(`view:${view}`),
      onSection: (section: string) => calls.push(`section:${section}`),
    }),
  );
  const results = tree.find((node) => node.type === "local-results")!;
  (results.props.onSection as (section: string) => void)("conteudo");
  assert.deepEqual(calls, ["view:peca"]);
  calls.length = 0;
  (results.props.onSection as (section: string) => void)("cerebro");
  assert.deepEqual(calls, ["section:cerebro"]);
});
