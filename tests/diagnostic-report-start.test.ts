import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../src/components/diagnostic-report-start.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
type ReportStartProps = {
  missing: { chapter: number; count: number }[];
  generating: boolean;
  error: string;
  onGenerate: () => void;
  onResume: (chapter: number) => void;
};
const componentModule = {
  exports: {} as Record<string, React.ComponentType<ReportStartProps>>,
};
runInNewContext(compiled, {
  module: componentModule,
  exports: componentModule.exports,
  require,
});
const { DiagnosticReportStart } = componentModule.exports;

test("report entry explains missing answers instead of opening the final chapter", () => {
  let resumed = -1;
  const html = renderToStaticMarkup(
    React.createElement(DiagnosticReportStart, {
      missing: [{ chapter: 1, count: 2 }],
      generating: false,
      error: "",
      onGenerate() {},
      onResume(chapter: number) {
        resumed = chapter;
      },
    }),
  );
  const $ = load(html);
  assert.match($("main, section, div").first().text(), /2 respostas/);
  assert.equal($("button").text(), "Completar diagnóstico");
  const button = React.createElement(DiagnosticReportStart, {
    missing: [{ chapter: 1, count: 2 }],
    generating: false,
    error: "",
    onGenerate() {},
    onResume(chapter: number) {
      resumed = chapter;
    },
  }).props;
  button.onResume(1);
  assert.equal(resumed, 1);
});

test("complete answers expose one explicit analysis action", () => {
  const html = renderToStaticMarkup(
    React.createElement(DiagnosticReportStart, {
      missing: [],
      generating: false,
      error: "",
      onGenerate() {},
      onResume() {},
    }),
  );
  const $ = load(html);
  assert.equal($("button").text(), "Gerar minha análise");
  assert.match($.text(), /prioridades de marketing/);
});
