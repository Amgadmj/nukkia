import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as workspace from "../src/lib/marketing-workspace.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import { workspaceLoadingLayout } from "../src/lib/workspace-loading.ts";

type Element = { type: string; props: Record<string, unknown> };
test("app shell waits for initial data, preserves mounted content during refresh, and links calendar", () => {
  let sync = "loading";
  let shown = false;
  const effects: (() => void)[] = [];
  const navigations: unknown[] = [];
  const jsx = (type: string, props: Record<string, unknown>): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useState: () => [
        shown,
        (next: boolean) => {
          shown = next;
        },
      ],
      useEffect: (effect: () => void) => {
        effects.push(effect);
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@tanstack/react-router": {
      useNavigate: () => (value: unknown) => {
        navigations.push(value);
      },
      useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
        select({ location: { pathname: "/conteudo", search: { aba: "planejamento" } } }),
      Link: "a",
    },
    "@tanstack/react-query": { useQueryClient: () => ({}) },
    "./workspace-shell": { WorkspaceShell: "workspace-shell" },
    "./workspace-skeleton": { WorkspaceSkeleton: "workspace-skeleton" },
    "./marketing-provider": {
      useMarketingWorkspace: () => ({
        data: demoSchema.parse({ name: "QA", answers: {} }),
        company: null,
        sync,
      }),
      WorkspaceSaveStatus: "save-status",
    },
    "@/lib/workspace-loading": { workspaceLoadingLayout },
    "@/lib/marketing-workspace": workspace,
    "@/lib/roles": { useIsAdmin: () => ({ data: false }) },
    "@/integrations/supabase/client": {},
    "@/lib/onboarding-draft": {},
    "lucide-react": { LogOut: "icon", Settings: "icon", ShieldCheck: "icon" },
    sonner: {},
  };
  const exports: { AppShell?: (props: { children: Element }) => Element } = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      require: (id: string) => {
        assert.ok(id in modules, id);
        return modules[id];
      },
    },
  );
  const editor: Element = { type: "editor", props: { draft: "Preserve this draft" } };
  function render() {
    const tree = exports.AppShell!({ children: editor });
    effects.splice(0).forEach((effect) => effect());
    return tree;
  }
  const loading = render();
  const content = (tree: Element) => (tree.props.children as Element[])[1]!;
  assert.equal(content(loading).type, "workspace-skeleton");
  assert.equal(content(loading).props.layout, "calendar");
  assert.equal(loading.props.calendarActive, true);
  (loading.props.onCalendar as () => void)();
  assert.equal(
    JSON.stringify(navigations),
    JSON.stringify([{ to: "/conteudo", search: { aba: "planejamento" } }]),
  );
  sync = "ready";
  assert.equal(content(render()), editor);
  sync = "loading";
  assert.equal(
    content(render()),
    editor,
    "background refresh must not unmount an editor or its draft",
  );
});
