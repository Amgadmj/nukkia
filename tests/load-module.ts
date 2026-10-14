/**
 * Loads one TypeScript source file in an isolated VM context with its imports
 * replaced by the given modules, the same technique the other API tests use.
 * Unknown imports and any unmocked global fail closed.
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export function loadModule(
  relativePath: string,
  modules: Record<string, unknown>,
  globals: Record<string, unknown> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name: string) {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
      },
      Response,
      URL,
      TextEncoder,
      AbortSignal,
      Intl,
      console: { error: () => {}, warn: () => {}, info: () => {}, log: () => {} },
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      ...globals,
    },
  );
  return exports;
}
