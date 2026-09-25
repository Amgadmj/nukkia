import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import * as icons from "lucide-react";
import * as preview from "../src/lib/brand-preview.ts";
import { demoSchema } from "../src/lib/quick-start.ts";

const require = createRequire(import.meta.url);
const exports: Record<string, React.ComponentType<Record<string, unknown>>> = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../src/components/content-readiness.tsx", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText,
  {
    exports,
    require: (id: string) => {
      if (id === "react/jsx-runtime") return require("react/jsx-runtime");
      if (id === "lucide-react") return icons;
      if (id === "@/lib/brand-preview") return preview;
      throw new Error(id);
    },
  },
);

const ContentReadiness = exports.ContentReadiness!;
const incomplete = demoSchema.parse({
  name: "Movitta",
  segment: "Fisioterapia",
  answers: {
    offers: "Programa personalizado de exercícios",
    audience: "Adultos que buscam prevenção de lesões",
    goals: "Atrair novos clientes",
  },
  brand: {
    confirmed: true,
    detail: "Atendimento individual por profissionais da equipe.",
    visualStyle: "essential",
    identityConfirmed: false,
  },
});

test("piece readiness names the unfinished identity and the exact next action", () => {
  const $ = load(
    renderToStaticMarkup(
      React.createElement(ContentReadiness, {
        data: incomplete,
        context: "piece",
        onIdentity() {},
      }),
    ),
  );
  assert.equal($("h2").text(), "Finalize sua identidade");
  assert.match($.text(), /Direção visual/);
  assert.match($.text(), /Logo da marca/);
  assert.match($.text(), /Foto própria/);
  assert.equal($("button").text().trim(), "Finalizar identidade");
});

test("calendar readiness explains why identity work improves future suggestions", () => {
  const $ = load(
    renderToStaticMarkup(
      React.createElement(ContentReadiness, {
        data: incomplete,
        context: "calendar",
        onIdentity() {},
      }),
    ),
  );
  assert.match($.text(), /planejamento mais preciso/i);
  assert.match($.text(), /Finalize sua identidade/);
});
