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

test("landing introduces brand context with the approved single main heading", () => {
  assert.equal($("h1").length, 1);
  assert.equal(
    $("h1").text().replace(/\s+/g, " ").trim(),
    "Seu negócio tem história. Seu marketing precisa conhecê-la.",
  );
  assert.ok(
    $("main")
      .text()
      .includes("Reúna o que define sua marca e transforme esse contexto em conteúdo com direção."),
  );
});

test("the hero discovery CTA opens the demo and signup and login keep distinct destinations", () => {
  const cta = $("main a").first();
  assert.equal(cta.text().trim(), "Conhecer a Nukkia");
  assert.equal(cta.attr("href"), "/demo");
  const signup = $("header a").filter((_, el) => $(el).text().trim() === "Criar conta");
  const login = $("header a").filter((_, el) => $(el).text().trim() === "Entrar");
  assert.equal(signup.attr("href"), "/auth?modo=cadastro");
  assert.equal(login.attr("href"), "/auth?modo=entrar");
  assert.equal($("main a[href='/auth?modo=cadastro']").length > 0, true);
});

test("product preview visibly identifies fictional illustrative content and editorial review", () => {
  const figure = $("main figure");
  assert.equal(figure.length, 1);
  assert.match(figure.find("figcaption").text(), /exemplo conceitual/i);
  assert.match(figure.text(), /marca fictícia/i);
  assert.match(figure.text(), /rascunho/i);
  assert.match(figure.text(), /revisão/i);
  assert.equal(figure.find("button, a, [role='button']").length, 0);
});

test("visible claims and page metadata do not promise publishing or integrated metrics", () => {
  const head = Route.options.head!({} as never) as { meta: Record<string, string>[] };
  const claims = `${$("body").text()} ${JSON.stringify(head.meta)}`;
  assert.doesNotMatch(
    claims,
    /publica(?:ção|ções|r)? autom[aá]tic|agendad[oa]s? automaticamente|publica no Instagram|alcance, engajamento|\d+\s*%/i,
  );
  assert.match(head.meta.find((item) => item.name === "description")!.content!, /contexto/);
});

test("keyboard navigation has a working skip target and a labeled theme control", () => {
  const skip = $("a").first();
  assert.equal(skip.text().trim(), "Ir para o conteúdo");
  assert.equal(skip.attr("href"), "#conteudo");
  assert.equal($("main#conteudo[tabindex='-1']").length, 1);
  assert.equal($("header nav[aria-label]").length, 1);
  assert.equal($("header button[aria-label='Ativar tema claro']").length, 1);
});
