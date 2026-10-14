import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { demoSchema } from "../src/lib/quick-start.ts";
function render(state: Record<string, unknown>, libraryMode = false) {
  const exports: Record<string, (props: Record<string, unknown>) => unknown> = {};
  const deps: Record<string, unknown> = {
    react: {
      useState: (value: unknown) => [value, () => {}],
      useEffect: () => {},
      useRef: (value: unknown) => ({ current: value }),
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    "@tanstack/react-router": { createFileRoute: () => (value: unknown) => value },
    zod: { z: { object: () => ({}), enum: () => ({ catch: () => ({}) }) } },
    "@tanstack/react-query": { useQuery: () => state, useQueryClient: () => ({}) },
    "@/lib/company": {
      useCompany: () => ({ data: { id: "qa-company" } }),
      useBrandKit: () => ({ data: {} }),
    },
    "@/components/workspace-skeleton": { WorkspaceSkeleton: "workspace-skeleton" },
    "@/lib/month-plan": { planBlockers: () => [], shouldAutoBuildPlan: () => false },
    "@/components/month-plan-builder": { MonthPlanBuilder: "month-plan-builder" },
    "@/lib/brand-preview": { briefIssues: () => [], identityReady: () => true },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/routes/_authenticated/conteudo.tsx", import.meta.url), "utf8") +
        "\nexport { Calendario };",
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    { exports, require: (id: string) => deps[id] ?? {} },
  );
  return JSON.stringify(
    exports.Calendario!({
      data: demoSchema.parse({ name: "QA", answers: {} }),
      libraryMode,
      onIdentity() {},
      onContext() {},
    }),
  );
}
test("planner distinguishes loading and read failure from a genuinely empty plan", () => {
  assert.match(render({ isPending: true }), /"type":"workspace-skeleton"/);
  assert.match(render({ isPending: true }), /"layout":"calendar"/);
  assert.match(render({ isError: true, refetch() {} }), /Não foi possível carregar/);
  assert.doesNotMatch(render({ isError: true }), /Nenhuma publicação/);
});

test("library can inspect saved account plan items without a generation action", () => {
  const view = render({ data: [] }, true);
  assert.match(view, /Itens do plano da conta/);
  assert.doesNotMatch(view, /Gerar plano do mês/);
});

test("refetched item cannot approve an older local caption using the new remote revision", () => {
  const exports: Record<string, (props: Record<string, unknown>) => unknown> = {};
  let cursor = 0;
  const state: unknown[] = [];
  const calls: unknown[] = [];
  const ui = new Proxy({}, { get: (_target, name) => String(name) });
  const deps: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [
          state[index],
          (next: unknown) => {
            state[index] = typeof next === "function" ? next(state[index]) : next;
          },
        ];
      },
      useEffect() {},
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    "@tanstack/react-router": { createFileRoute: () => (value: unknown) => value },
    zod: { z: { object: () => ({}), enum: () => ({ catch: () => ({}) }) } },
    "@tanstack/react-query": { useQuery: () => ({ data: null }), useQueryClient: () => ({}) },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/routes/_authenticated/conteudo.tsx", import.meta.url), "utf8") +
        "\nexport { ItemCard };",
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    { exports, require: (id: string) => deps[id] ?? ui },
  );
  type Element = {
    type: unknown;
    props: {
      children?: unknown;
      onChange?: (event: { target: { value: string } }) => void;
      onClick?: () => void;
      disabled?: boolean;
      value?: unknown;
    };
  };
  function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element;
    return [node, ...nodes(node.props.children)];
  }
  const item = {
    id: "qa-item",
    updated_at: "revision-one",
    scheduled_for: "2026-10-05",
    caption: "Original",
    slides: [],
    format: "post",
  };
  function render(item: object) {
    cursor = 0;
    return nodes(
      exports.ItemCard!({
        item,
        companyId: "qa-company",
        onAprovar: (...args: unknown[]) => calls.push(args),
        onGerarArte() {},
        gerandoArte: false,
      }),
    );
  }
  render(item).find((node) => node.type === "Textarea")!.props.onChange!({
    target: { value: "Meu texto local" },
  });
  const after = render({ ...item, updated_at: "revision-two", caption: "Texto de outra aba" });
  const approve = after.find((node) => node.props.children === "Aprovar texto")!;
  assert.equal(approve.props.disabled, true);
  approve.props.onClick!();
  assert.deepEqual(calls, []);
  assert.equal(after.find((node) => node.type === "Textarea")!.props.value, "Meu texto local");
});
