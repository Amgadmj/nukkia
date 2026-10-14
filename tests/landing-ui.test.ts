import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as router from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";

// Render the actual route, shared components and router links. Only Vite's
// stylesheet URL import needs an adapter for the existing Node test runner.
const require = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const cache = new Map<string, { exports: Record<string, unknown> }>();
function loadModule(filename: string): Record<string, unknown> {
  const cached = cache.get(filename);
  if (cached) return cached.exports;
  const module = { exports: {} as Record<string, unknown> };
  cache.set(filename, module);
  runInNewContext(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => {
        if (id.endsWith(".css?url")) return { default: "/assets/landing.css" };
        if (id === "@tanstack/react-router") return router;
        if (!id.startsWith("@/") && !id.startsWith(".")) return require(id);
        const base = id.startsWith("@/")
          ? resolve(sourceRoot, id.slice(2))
          : resolve(dirname(filename), id);
        const path = [base, `${base}.tsx`, `${base}.ts`].find(existsSync);
        assert.ok(path, `Cannot resolve ${id}`);
        return loadModule(path);
      },
    },
    { filename },
  );
  return module.exports;
}

const { Route } = loadModule(resolve(sourceRoot, "routes/index.tsx")) as {
  Route: router.AnyRoute;
};
const root = router.createRootRoute();
Route.update({ path: "/", getParentRoute: () => root });
const appRouter = router.createRouter({
  routeTree: root.addChildren([Route]),
  history: router.createMemoryHistory({ initialEntries: ["/"] }),
});
await appRouter.load();
const $ = load(
  renderToStaticMarkup(
    React.createElement(
      router.RouterContextProvider,
      { router: appRouter },
      React.createElement(Route.options.component as React.ComponentType),
    ),
  ),
);

test("landing introduces the health studio under Nukkia with one clear main heading", () => {
  assert.equal($("h1").length, 1);
  assert.equal(
    $("h1").text().replace(/\s+/g, " ").trim(),
    "O cuidado é seu.A próxima ideia, da Nukkia.",
  );
  assert.ok(
    $("main")
      .text()
      .includes("Da identidade da sua clínica ao conteúdo revisado e ao planejamento do mês."),
  );
});

test("the hero discovery CTA opens the demo and signup and login keep distinct destinations", () => {
  const cta = $("main a").first();
  assert.equal(cta.text().trim(), "Conhecer a Nukkia");
  const destination = new URL(cta.attr("href")!, "https://nukkia.test");
  assert.equal(destination.pathname, "/demo");
  assert.equal(destination.searchParams.get("passo"), "0");
  const signup = $("footer a").filter((_, el) => $(el).text().trim() === "Criar conta");
  const login = $("header a").filter((_, el) => $(el).text().trim() === "Entrar");
  assert.equal(signup.attr("href"), "/auth?modo=cadastro");
  assert.equal(login.attr("href"), "/auth?modo=entrar");
  assert.equal($("footer a[href='/auth?modo=cadastro']").length > 0, true);
});

test("product preview visibly identifies fictional illustrative content and editorial review", () => {
  const figure = $("main figure");
  assert.equal(figure.length, 1);
  assert.match(figure.find("figcaption").text(), /exemplo ilustrativo/i);
  assert.match(figure.text(), /Exemplo fictício/i);

  assert.match(figure.text(), /revisado/i);
  assert.equal(figure.find("button, a, [role='button']").length, 0);
});

test("visible claims and page metadata do not promise publishing or integrated metrics", () => {
  const head = Route.options.head!({} as never) as { meta: Record<string, string>[] };
  // Sourced market statistics live only in [data-proof]; the rest of the page must stay number-free.
  const claims = `${$("body").clone().find("[data-proof]").remove().end().text()} ${JSON.stringify(head.meta)}`;
  assert.doesNotMatch(
    claims,
    /publica(?:ção|ções|r)? autom[aá]tic|agendad[oa]s? automaticamente|publica no Instagram|alcance, engajamento|\d+\s*%/i,
  );
  assert.match(head.meta.find((item) => item.name === "description")!.content!, /contexto/);
  // The header shows the logo mark only (no wordmark); the brand stays in the accessible name.
  assert.match($("header a").first().attr("aria-label") ?? "", /nukkia/i);
  assert.doesNotMatch($("header").text(), /nukkia/i);
  assert.doesNotMatch($("header").text(), /nukkia\s+health/i);
});

test("keyboard navigation has a working skip target and a labeled theme control", () => {
  const skip = $("a").first();
  assert.equal(skip.text().trim(), "Ir para o conteúdo");
  assert.equal(skip.attr("href"), "#proposta-conteudo");
  assert.equal($("main#proposta-conteudo[tabindex='-1']").length, 1);
  assert.equal($("header nav[aria-label]").length, 1);
  assert.equal($("header button[aria-label='Ativar tema claro']").length, 1);
});

test("market statistics are sourced, dated, and kept separate from Nukkia results", () => {
  const proof = $("[data-proof]");
  const stats = proof.find("dt");
  assert.equal(stats.length, 4);
  proof.find("div").each((_, el) => {
    const link = $(el).find("a");
    assert.match(link.text(), /^Fonte: .*(20\d\d)/);
    assert.match(link.attr("href") ?? "", /^https:\/\/(cetic\.br|agenciasebrae\.com\.br)\//);
  });
  const section = $("#atl-proof-title").closest("section");
  assert.match(section.text(), /não resultados da Nukkia/i);
  const chart = $(".atl-pulse-card");
  assert.match(chart.text(), /Exemplo ilustrativo/i);
  assert.match(chart.text(), /dados fictícios/i);
  assert.doesNotMatch(chart.text(), /\d+\s*%/);
});
