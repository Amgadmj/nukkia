import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod4 from "zod/v4";

test("static art passes the saved caption's offer conditions to the image provider", async () => {
  let prompt = "";
  let uploaded: Uint8Array | undefined;
  const modules: Record<string, unknown> = {
    "zod/v4": zod4,
    "./style-anchor": { buildStyleAnchor: () => "Paleta da marca: #112233." },
    "@/lib/ai.server": {
      AiError: class extends Error {},
      generateImageBase64: async (value: string) => {
        prompt = value;
        return "AQID";
      },
    },
  };
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/lib/content-engine/index.ts", import.meta.url), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      },
    ).outputText,
    {
      exports,
      atob,
      require(name: string) {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
      },
      fetch: () => {
        throw new Error("Network forbidden in content-engine tests");
      },
    },
  );
  const storage = {
    storage: {
      from: () => ({
        upload: async (_path: string, bytes: Uint8Array) => {
          uploaded = bytes;
          return { error: null };
        },
      }),
    },
  };
  await exports.generateStaticArt(storage, {
    company: { name: "Jardim", segment: "Pilates" },
    brandKit: null,
    item: {
      title: "Venha conhecer",
      format: "post",
      caption: "Aula individual às terças. Vagas limitadas a quatro participantes.",
      cta: "Consulte os horários.",
    },
    companyId: "company",
    contentItemId: "item",
  });
  assert.ok(prompt.includes("Aula individual às terças. Vagas limitadas a quatro participantes."));
  assert.ok(prompt.includes("Consulte os horários."));
  assert.deepEqual(Array.from(uploaded ?? []), [1, 2, 3]);
});

for (const [label, b64, ext, contentType] of [
  [
    "JPEG (Gemini 3.x)",
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]).toString("base64"),
    "jpg",
    "image/jpeg",
  ],
  ["PNG", Buffer.from("89504e470d0a1a0a", "hex").toString("base64"), "png", "image/png"],
  ["unknown bytes", "AQID", "png", "image/png"],
] as const) {
  test(`generated ${label} art is stored with a matching extension and content type`, async () => {
    const uploads: { path: string; contentType: string }[] = [];
    const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    const modules: Record<string, unknown> = {
      "zod/v4": zod4,
      "./style-anchor": { buildStyleAnchor: () => "" },
      "@/lib/ai.server": { AiError: class extends Error {}, generateImageBase64: async () => b64 },
    };
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL("../src/lib/content-engine/index.ts", import.meta.url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } },
      ).outputText,
      {
        exports,
        atob,
        require: (name: string) => modules[name],
        fetch: () => {
          throw new Error("Network forbidden in content-engine tests");
        },
      },
    );
    await exports.generateStaticArt(
      {
        storage: {
          from: () => ({
            upload: async (path: string, _bytes: Uint8Array, options: { contentType: string }) => {
              uploads.push({ path, contentType: options.contentType });
              return { error: null };
            },
          }),
        },
      },
      {
        company: { name: "Jardim", segment: "Pilates" },
        brandKit: null,
        item: { title: "Venha", format: "post", caption: "", cta: "" },
        companyId: "company",
        contentItemId: "item",
      },
    );
    assert.equal(uploads.length, 1);
    assert.match(uploads[0]!.path, /^company\/item-0-\d+\.[a-z]+$/);
    assert.equal(uploads[0]!.path.split(".").at(-1), ext);
    assert.equal(uploads[0]!.contentType, contentType);
  });
}
