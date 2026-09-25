import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import * as zod4 from "zod/v4";
import * as onboarding from "../src/lib/onboarding.ts";

// Exercise the actual route handler with in-memory boundaries: no shared
// Supabase writes, no API credentials and no paid AI calls in this suite.
const source = readFileSync(new URL("../src/routes/api/diagnostico.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function harness(
  options: {
    aiFails?: boolean;
    insertFails?: boolean;
    authenticated?: boolean;
    companyExists?: boolean;
  } = {},
) {
  const writes: { table: string; values: Record<string, unknown> }[] = [];
  let prompt = "";
  const db = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data:
            options.companyExists === false
              ? null
              : {
                  id: "00000000-0000-4000-8000-000000000001",
                  name: "Empresa de teste",
                  segment: "Serviços",
                  employees: "2",
                },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
        insert: async (values: Record<string, unknown>) => {
          if (options.insertFails && table === "diagnostics")
            return { error: { message: "write failed" } };
          writes.push({ table, values });
          return { error: null };
        },
        update: (values: Record<string, unknown>) => {
          writes.push({ table, values });
          return chain;
        },
      };
      return chain;
    },
  };
  class AiError extends Error {
    userMessage = "Falha de teste";
  }
  const modules: Record<string, unknown> = {
    "@tanstack/react-router": { createFileRoute: () => (config: unknown) => config },
    zod: zod,
    "zod/v4": zod4,
    "@/lib/onboarding": onboarding,
    "@/lib/ai.server": {
      AiError,
      generateJson: async ({ input }: { input: string }) => {
        prompt = input;
        if (options.aiFails) throw new AiError();
        return {
          resumo: "Relatório de teste",
          pontos_fortes: [],
          oportunidades: [],
          recomendacoes: [],
          pilares: [],
          score: 63,
          missoes: [
            { titulo: "Missão de teste", descricao: "Descrição", categoria: "Fundação", xp: 50 },
          ],
        };
      },
    },
    "@/lib/quota.server": {
      checkAiQuota: async () => true,
      quotaExceededResponse: () => new Response("quota", { status: 429 }),
    },
    "@/lib/supabase-request.server": {
      userClientFromRequest: () => (options.authenticated === false ? null : db),
    },
  };
  const moduleExports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports: moduleExports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error("Unexpected import: " + name);
      return modules[name];
    },
    Response,
    console: { error: () => {} },
  });
  const route = moduleExports["Route"] as {
    server: { handlers: { POST: (context: { request: Request }) => Promise<Response> } };
  };
  return {
    writes,
    prompt: () => prompt,
    post: (answers: unknown) =>
      route.server.handlers.POST({
        request: new Request("http://local.test/api/diagnostico", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ companyId: "00000000-0000-4000-8000-000000000001", answers }),
        }),
      }),
  };
}

test("expanded diagnostic passes through AI and persistence before advancing", async () => {
  const h = harness();
  const answers = {
    audience: "Empresas",
    offers: "Serviços",
    problems: "Processos lentos",
    city: "Recife",
    goals: "Crescer",
    challenge: "Alcance",
    purpose: "Simplificar",
    googleBusiness: "Não tenho",
  };
  const response = await h.post(answers);
  assert.equal(response.status, 200);
  for (const value of ["Recife", "Processos lentos", "Simplificar", "Não tenho"])
    assert.ok(h.prompt().includes(value));
  const saved = h.writes.find((w) => w.table === "diagnostics");
  assert.equal((saved?.values["answers"] as Record<string, string>)["city"], "Recife");
  assert.equal(saved?.values["status"], "ready");
  const reportIndex = h.writes.findIndex((w) => w.table === "diagnostics");
  const advanceIndex = h.writes.findIndex((w) => w.values["onboarding_step"] === "brand");
  assert.ok(advanceIndex > reportIndex);
});
test("AI failure never advances onboarding or persists a partial report", async () => {
  const h = harness({ aiFails: true });
  assert.equal((await h.post({ audience: "Empresas", offers: "Serviços" })).status, 502);
  assert.deepEqual(h.writes, []);
});
test("database failure never advances onboarding", async () => {
  const h = harness({ insertFails: true });
  assert.equal((await h.post({ audience: "Empresas", offers: "Serviços" })).status, 500);
  assert.deepEqual(h.writes, []);
});
test("invalid input, signed-out requests and inaccessible companies cannot write", async () => {
  const invalid = harness();
  assert.equal((await invalid.post({ audience: "  ", offers: "Serviços" })).status, 400);
  assert.deepEqual(invalid.writes, []);
  const signedOut = harness({ authenticated: false });
  assert.equal((await signedOut.post({ audience: "Empresas", offers: "Serviços" })).status, 401);
  assert.deepEqual(signedOut.writes, []);
  const missing = harness({ companyExists: false });
  assert.equal((await missing.post({ audience: "Empresas", offers: "Serviços" })).status, 404);
  assert.deepEqual(missing.writes, []);
});
