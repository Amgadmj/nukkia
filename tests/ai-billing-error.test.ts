import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);

function harness() {
  const logs: unknown[][] = [];
  let calls = 0;
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL("../src/lib/ai.server.ts", import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText,
    {
      exports,
      require,
      AbortSignal,
      Response,
      setTimeout,
      process: { env: { GEMINI_API_KEY: "secret-test-key" } },
      console: { error: (...args: unknown[]) => logs.push(args), warn: () => {} },
      fetch: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            error: { code: 402, message: "secret-test-key: prepaid credits depleted" },
          }),
          { status: 402 },
        );
      },
    },
  );
  return { exports, logs, calls: () => calls };
}
for (const name of ["generateImageBase64", "startVideoGeneration"] as const) {
  test(`${name} identifies depleted credits without retrying or logging provider response secrets`, async () => {
    const h = harness();
    await assert.rejects(h.exports[name]!("a test"), /créditos.*Google/i);
    assert.equal(h.calls(), 1);
    assert.doesNotMatch(JSON.stringify(h.logs), /secret-test-key/);
    assert.match(JSON.stringify(h.logs), /402/);
  });
}
