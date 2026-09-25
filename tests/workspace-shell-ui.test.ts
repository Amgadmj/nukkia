import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import * as workspace from "../src/lib/marketing-workspace.ts";

const require = createRequire(import.meta.url);
const cache = new Map<string, Record<string, React.ComponentType<Record<string, unknown>>>>();
function component(file: string) {
  if (cache.has(file)) return cache.get(file)!;
  const module = { exports: {} as Record<string, React.ComponentType<Record<string, unknown>>> };
  cache.set(file, module.exports);
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => {
        if (id.endsWith(".css")) return {};
        if (id === "@/lib/marketing-workspace") return workspace;
        if (id === "@/lib/utils") return component("lib/utils.ts");
        if (id.startsWith("./")) return component(`components/${id.slice(2)}.tsx`);
        return require(id);
      },
    },
  );
  return module.exports;
}
const { WorkspaceShell } = component("components/workspace-shell.tsx");
const { ThemeProvider, themeInitScript } = component(
  "components/theme-provider.tsx",
) as typeof import("../src/components/theme-provider.tsx");
function shell(extra: Record<string, unknown> = {}) {
  return load(
    renderToStaticMarkup(
      React.createElement(
        ThemeProvider!,
        null,
        React.createElement(WorkspaceShell!, {
          name: "Movitta",
          section: "painel",
          onSection() {},
          xp: 40,
          completed: 2,
          children: React.createElement("h1", null, "Meu painel"),
          ...extra,
        }),
      ),
    ),
  );
}

test("progress uses the supplied total and defaults to five stages", () => {
  const supplied = shell({ completed: 4, total: 7 });
  assert.match(supplied(".workspace-level-card").first().text(), /4 de 7 etapas/);
  assert.equal(supplied(".workspace-top-progress small").text(), "4/7");
  const defaults = shell();
  assert.match(defaults(".workspace-level-card").first().text(), /2 de 5 etapas/);
  assert.equal(defaults(".workspace-top-progress small").text(), "2/5");
});

test("the shell leaves the page title to the main content", () => {
  const $ = shell();
  assert.equal($("h1").filter((_, element) => $(element).text() === "Meu painel").length, 1);
  assert.equal($(".workspace-topbar > span").length, 0);
  assert.equal(shell({ section: "redes" })(".workspace-topbar > span").length, 0);
});

test("workspace defaults to dark and offers named footer controls", () => {
  const $ = shell();
  assert.equal($(".workspace-shell").hasClass("dark"), false);
  const footer = $(".workspace-sidebar .workspace-sidebar-bottom");
  assert.equal(footer.find('button[aria-label="Ativar tema claro"]').length, 1);
  assert.equal(footer.find('button[aria-label="Notificações"]').length, 1);
  assert.equal(footer.find('button[aria-label="Notificações"]').attr("aria-haspopup"), "dialog");
});

test("a new browser opens in dark mode while an explicit light preference is preserved", () => {
  const classes = new Set<string>();
  runInNewContext(themeInitScript, {
    localStorage: { getItem: () => null },
    window: { matchMedia: () => ({ matches: false }) },
    document: { documentElement: { classList: { add: (value: string) => classes.add(value) } } },
  });
  assert.equal(classes.has("dark"), true);

  classes.clear();
  runInNewContext(themeInitScript, {
    localStorage: { getItem: () => "light" },
    window: { matchMedia: () => ({ matches: true }) },
    document: { documentElement: { classList: { add: (value: string) => classes.add(value) } } },
  });
  assert.equal(classes.has("dark"), false);
});

test("notifications render only supplied notices inside a labelled, initially closed dialog", () => {
  const $ = shell({
    notifications: [
      {
        id: "review",
        title: "Revise sua identidade",
        description: "Sua referência mudou.",
        section: "marca",
      },
    ],
  });
  const trigger = $('.workspace-sidebar button[aria-label="Notificações"]');
  const panel = $(`dialog[id="${trigger.attr("aria-controls")}"]`);
  assert.equal(panel.length, 1);
  assert.equal(panel.attr("open"), undefined);
  assert.equal(trigger.attr("aria-expanded"), "false");
  assert.equal($(`[id="${panel.attr("aria-labelledby")}"]`).text(), "Notificações");
  assert.equal(panel.find(".workspace-notice").length, 1);
  assert.match(panel.find(".workspace-notice").text(), /Revise sua identidade/);
  assert.match(panel.find(".workspace-notice").text(), /Sua referência mudou/);
  assert.equal(panel.find('button[aria-label="Fechar notificações"]').length, 1);
  assert.equal(panel.text().includes("Nenhuma notificação"), false);
});

test("empty notifications have an honest empty state and no badge", () => {
  const $ = shell();
  assert.match($(".workspace-notifications").text(), /Nenhuma notificação por enquanto\./);
  assert.equal($(".workspace-notice").length, 0);
  assert.equal($('.workspace-sidebar button[aria-label="Notificações"] small').length, 0);
});

test("navigation exposes the current page, mobile drawer relationship, and focusable skip target", () => {
  const $ = shell({ section: "cerebro" });
  const current = $('.workspace-sidebar nav button[aria-current="page"]');
  assert.equal(current.attr("aria-label"), "Cérebro da marca");
  assert.equal(current.find("svg.lucide-brain").length, 1);
  const trigger = $(".workspace-mobile-trigger");
  assert.equal(
    $(`dialog[id="${trigger.attr("aria-controls")}"]`).attr("aria-label"),
    "Menu Nukkia",
  );
  assert.equal($("main").attr("tabindex"), "-1");
  assert.equal($(".workspace-skip-link").attr("href"), `#${$("main").attr("id")}`);
});

test("logo uses the official image as a monochrome symbol with no JPG tile", () => {
  const $ = shell();
  const logo = $(".workspace-sidebar .workspace-brand-button");
  assert.equal(logo.find('img[src="/nukkia-official.jpg"]').length, 1);
  assert.equal(logo.find(".nukkia-logo-mark").length, 1);
  assert.equal(logo.find(".bg-white, .rounded-lg, .text-primary").length, 0);
  assert.match(logo.text(), /nukkia/);
});
