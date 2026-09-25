import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";

test("account save status stays in main content when the account/sidebar menu is hidden", () => {
  const status = () => null;
  const shell = () => null;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@tanstack/react-router": {
      Link: "a",
      useNavigate: () => () => {},
      useRouterState: () => "/painel",
    },
    "@tanstack/react-query": { useQueryClient: () => ({}) },
    "lucide-react": { LogOut: "icon", Settings: "icon", ShieldCheck: "icon" },
    "./workspace-shell": { WorkspaceShell: shell },
    "./marketing-provider": {
      WorkspaceSaveStatus: status,
      useMarketingWorkspace: () => ({
        data: demoSchema.parse({ name: "Brand", answers: {} }),
        company: null,
      }),
    },
    "@/lib/marketing-workspace": workspace,
    "@/integrations/supabase/client": {},
    "@/lib/roles": { useIsAdmin: () => ({ data: false }) },
    "@/lib/onboarding-draft": {},
    sonner: {},
  };
  const exports: Record<string, (props: object) => { props: { children: { type: unknown }[] } }> =
    {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      require: (name: string) => {
        assert.ok(name in modules, name);
        return modules[name];
      },
    },
  );
  const tree = exports.AppShell!({ children: "page" });
  assert.ok(
    Array.isArray(tree.props.children) &&
      tree.props.children.some((child) => child?.type === status),
    "status must not be hidden inside accountActions",
  );
});
