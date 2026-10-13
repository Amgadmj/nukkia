import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);

function harness(env: Record<string, string>, body: unknown) {
  const requests: { url: string; body: unknown }[] = [];
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
      process: { env: { GEMINI_API_KEY: "test-key", ...env } },
      console: { error: () => {}, warn: () => {} },
      fetch: async (url: string, init: { body: string }) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return new Response(JSON.stringify(body), { status: 200 });
      },
    },
  );
  return { exports, requests };
}

// Shape returned by Gemini 3.x image models: optional interim "thought"
// images, thought signatures, then the final render.
const gemini3Response = {
  candidates: [
    {
      content: {
        role: "model",
        parts: [
          { text: "Planning the composition", thought: true },
          { inlineData: { mimeType: "image/png", data: "VGhvdWdodA==" }, thought: true },
          {
            inlineData: { mimeType: "image/jpeg", data: "RmluYWw=" },
            thoughtSignature: "sig",
          },
        ],
      },
      finishReason: "STOP",
    },
  ],
};

test("image generation defaults to gemini-3.1-flash-image (2.5 shuts down 2026-10-02)", async () => {
  const h = harness({}, gemini3Response);
  await h.exports.generateImageBase64!("prompt");
  assert.equal(h.requests.length, 1);
  assert.match(h.requests[0]!.url, /\/models\/gemini-3\.1-flash-image:generateContent$/);
  assert.deepEqual((h.requests[0]!.body as { generationConfig: unknown }).generationConfig, {
    responseModalities: ["IMAGE"],
  });
});

test("GEMINI_IMAGE_MODEL still overrides the default", async () => {
  const h = harness({ GEMINI_IMAGE_MODEL: "gemini-3-pro-image" }, gemini3Response);
  await h.exports.generateImageBase64!("prompt");
  assert.match(h.requests[0]!.url, /\/models\/gemini-3-pro-image:generateContent$/);
});

test("the final image is returned, never an interim thought image", async () => {
  const h = harness({}, gemini3Response);
  assert.equal(await h.exports.generateImageBase64!("prompt"), "RmluYWw=");
});

test("a 2.5-style single inlineData part still works", async () => {
  const h = harness(
    {},
    { candidates: [{ content: { parts: [{ inlineData: { data: "UE5H" } }] } }] },
  );
  assert.equal(await h.exports.generateImageBase64!("prompt"), "UE5H");
});

test("a text-only response is a user-safe error", async () => {
  const h = harness({}, { candidates: [{ content: { parts: [{ text: "no image" }] } }] });
  await assert.rejects(h.exports.generateImageBase64!("prompt"), /não retornou imagem/);
});
