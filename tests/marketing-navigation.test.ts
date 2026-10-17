import * as serviceBriefDomain from "../src/lib/service-brief.ts";
import test from "node:test";
import * as research from "../src/lib/brand-research.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as react from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import * as quick from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import * as art from "../src/lib/post-art.ts";

function journey(onCalendar?: () => void) {
  const module = { exports: {} as Record<string, react.ComponentType<Record<string, unknown>>> };
  const dependencies: Record<string, unknown> = {
    "@tanstack/react-router": { useBlocker() {} },
    react,
    "@/lib/service-brief": serviceBriefDomain,
    "react/jsx-runtime": jsx,
    "./inspiration-board": { InspirationBoard: "inspiration-board" },
    "@/components/inspiration-board": { InspirationBoard: "inspiration-board" },
    "./workspace-services": { WorkspaceServices: "workspace-services" },
    "lucide-react": icons,
    "@/lib/quick-start": quick,
    "@/lib/brand-preview": preview,
    "@/lib/onboarding": onboarding,
    "@/lib/marketing-workspace": workspace,
    "@/lib/post-art": art,
    "./brand-onboarding": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "./brand-direction": {},
    "./channel-recommendations": { ChannelRecommendations: "channel-recommendations" },
    "@/lib/brand-research": research,
  };
  const source = readFileSync(
    new URL("../src/components/marketing-views.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (id: string) => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return renderToStaticMarkup(
    react.createElement(module.exports.DeliveryJourney!, {
      data: workspace.seedWorkspace(),
      onSection: () => {},
      onCalendar,
    }),
  );
}

test("journey does not promise a calendar when the host has no calendar destination", () => {
  assert.equal(journey().includes("publicação automática conectada"), false);
  assert.equal(journey().includes("Planejar a data de publicação"), true);
});
test("journey exposes existing planning when its host supplies a calendar destination", () => {
  assert.equal(journey(() => {}).includes("Planejar a data de publicação"), true);
});
