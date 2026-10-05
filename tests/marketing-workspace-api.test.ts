import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import * as quickStart from "../src/lib/quick-start.ts";

const companyId = "00000000-0000-4000-8000-000000000001";
const otherCompanyId = "00000000-0000-4000-8000-000000000002";
const ownerId = "00000000-0000-4000-8000-000000000003";
const revision = "00000000-0000-4000-8000-000000000004";
const updatedAt = "2026-09-24T12:00:00.000Z";
const maxBytes = 5_000_000;
const source = readFileSync(
  new URL("../src/routes/api/marketing-workspace.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture() {
  const data = quickStart.demoSchema.parse({
    name: "  Café Local  ",
    segment: "Alimentação",
    onboarded: true,
    answers: { offers: "Café", audience: "Vizinhos", goals: "Fortalecer minha marca" },
    brand: {
      referenceUrl: "https://example.test",
      material: "  Material original\n\n",
      confirmed: true,
      logo: "data:image/png;base64,YQ==",
      photo: "data:image/jpeg;base64,Yg==",
      research: {
        status: "ready",
        logo: "data:image/webp;base64,Yw==",
        logoSource: "https://example.test/logo",
        sources: [
          {
            url: "https://example.test",
            title: "Fonte",
            text: "Texto da fonte\n",
            fetchedAt: updatedAt,
          },
        ],
        suggestions: [
          {
            field: "offers",
            value: "Café",
            quote: "Texto da fonte",
            sourceUrl: "https://example.test",
          },
        ],
      },
      creative: {
        approach: "educate",
        questionKey: "question-context",
        slides: [{ title: "  Título ", body: "" }],
        copy: { title: "  Edição em andamento ", body: "", caption: "  Legenda\n\n" },
        briefKey: "original-context",
        origin: "manual",
        review: "passed",
        reviewNotes: ["Revisado"],
        approved: "approval-fingerprint",
        exported: "approval-fingerprint",
      },
    },
    delivery: {
      draft: "  Texto\n\n",
      draftContext: "context",
      approvedText: "  Texto\n\n",
      approvedContext: "context",
      exportedText: "  Texto\n\n",
    },
  });
  data.answers.offers = "  Café\n\n";
  data.answers.founderStory = "  Uma história ainda em edição.  ";
  return data;
}

type Row = { company_id: string; data: unknown; revision: string; updated_at: string };
function existingRow(data: unknown = fixture()): Row {
  return { company_id: companyId, data, revision, updated_at: updatedAt };
}

function harness(
  options: {
    authenticated?: boolean;
    tokenValid?: boolean;
    authError?: boolean;
    companyOwner?: string;
    companyError?: boolean;
    storageError?: string;
    writeError?: string;
    throws?: boolean;
    saved?: Row;
  } = {},
) {
  let row: Row | null = options.saved ? structuredClone(options.saved) : null;
  const reads: string[] = [];
  const filters: [string, string, unknown][] = [];
  const writes: Row[] = [];
  const attempts: string[] = [];
  const requests: Request[] = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.tokenValid === false ? null : { id: ownerId } },
        error: options.authError ? { message: "expired" } : null,
      }),
    },
    from(table: string) {
      reads.push(table);
      const where: Record<string, unknown> = {};
      let operation = "select";
      let values: Row;
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([table, column, value]);
          where[column] = value;
          return chain;
        },
        insert: (value: Row) => {
          operation = "insert";
          values = structuredClone(value);
          attempts.push(operation);
          return chain;
        },
        update: (value: Row) => {
          operation = "update";
          values = structuredClone(value);
          attempts.push(operation);
          return chain;
        },
        maybeSingle: async () => {
          if (options.throws) throw new Error("unexpected failure");
          if (table === "companies") {
            const visible =
              where.id === companyId &&
              (where.owner_id === undefined ||
                where.owner_id === (options.companyOwner ?? ownerId));
            return {
              data: visible ? { id: companyId } : null,
              error: options.companyError ? { code: "42501" } : null,
            };
          }
          assert.equal(table, "marketing_workspaces");
          const error =
            options.storageError ?? (operation !== "select" ? options.writeError : undefined);
          if (error) return { data: null, error: { code: error } };
          if (operation === "select") {
            return {
              data: row?.company_id === where.company_id ? structuredClone(row) : null,
              error: null,
            };
          }
          if (operation === "insert" && row) return { data: null, error: { code: "23505" } };
          if (
            operation === "update" &&
            (!row || row.company_id !== where.company_id || row.revision !== where.revision)
          ) {
            return { data: null, error: null };
          }
          row = values!;
          writes.push(structuredClone(row));
          return { data: structuredClone(row), error: null };
        },
      };
      return chain;
    },
  };
  const modules: Record<string, unknown> = {
    "@tanstack/react-router": { createFileRoute: () => (config: unknown) => config },
    zod: zod,
    "@/lib/quick-start": quickStart,
    "@/lib/supabase-request.server": {
      userClientFromRequest: (request: Request) => {
        requests.push(request);
        return options.authenticated === false ? null : client;
      },
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    Response,
    URL,
    TextDecoder,
    crypto: globalThis.crypto,
    require: (name: string) => {
      if (!(name in modules)) throw new Error("Unexpected import: " + name);
      return modules[name];
    },
  });
  const route = exports.Route as {
    server: {
      handlers: Record<"GET" | "POST", (context: { request: Request }) => Promise<Response>>;
    };
  };
  const rawPost = (body: BodyInit, headers: HeadersInit = {}) =>
    route.server.handlers.POST({
      request: new Request("https://local.test/api/marketing-workspace", {
        method: "POST",
        body,
        headers,
        duplex: "half",
      } as RequestInit),
    });
  return {
    reads,
    filters,
    writes,
    attempts,
    requests,
    handlers: Object.keys(route.server.handlers),
    row: () => structuredClone(row),
    rawPost,
    get: (id = companyId) =>
      route.server.handlers.GET({
        request: new Request(`https://local.test/api/marketing-workspace?companyId=${id}`),
      }),
    post: (body: unknown) => rawPost(JSON.stringify(body), { "content-type": "application/json" }),
  };
}

function saveBody(data = fixture(), expectedRevision: string | null = null) {
  return { companyId, data, expectedRevision };
}

test("GET returns an empty workspace or the complete saved draft, privately and without writes", async () => {
  const empty = harness();
  assert.deepEqual(empty.handlers, ["GET", "POST"]);
  const response = await empty.get();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: null, revision: null, updatedAt: null });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(empty.attempts, []);
  const full = harness({ saved: existingRow() });
  assert.deepEqual(await (await full.get()).json(), { data: fixture(), revision, updatedAt });
  assert.deepEqual(full.filters, [
    ["companies", "id", companyId],
    ["companies", "owner_id", ownerId],
    ["marketing_workspaces", "company_id", companyId],
  ]);
  assert.equal(full.requests.length, 1);
});

test("GET and POST require a valid authenticated session before touching tables", async () => {
  for (const options of [{ authenticated: false }, { tokenValid: false }, { authError: true }]) {
    const h = harness(options);
    assert.equal((await h.get()).status, 401);
    assert.equal((await h.post(saveBody())).status, 401);
    assert.deepEqual(h.reads, []);
    assert.deepEqual(h.attempts, []);
  }
});

test("even a caller able to see another owner's company cannot read or save its workspace", async () => {
  const h = harness({ companyOwner: "another-owner", saved: existingRow() });
  assert.equal((await h.get()).status, 404);
  assert.equal((await h.post(saveBody())).status, 404);
  assert.equal((await h.post(saveBody(fixture(), revision))).status, 404);
  assert.deepEqual(h.reads, ["companies", "companies", "companies"]);
  assert.deepEqual(h.attempts, []);
  assert.deepEqual(h.row(), existingRow());
  const missing = harness();
  assert.equal((await missing.get(otherCompanyId)).status, 404);
  assert.equal((await missing.post({ ...saveBody(), companyId: otherCompanyId })).status, 404);
});

test("insert preserves answers, sources, images, creative approvals and delivery, and generates a UUID", async () => {
  const h = harness();
  const body = saveBody();
  const before = structuredClone(body);
  const response = await h.post(body);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const saved = await response.json();
  assert.deepEqual(saved.data, body.data);
  assert.match(
    saved.revision,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
  assert.deepEqual(h.writes, [
    {
      company_id: companyId,
      data: body.data,
      revision: saved.revision,
      updated_at: saved.updatedAt,
    },
  ]);
  assert.deepEqual(await (await h.get()).json(), saved);
  assert.deepEqual(body, before);
});

test("matching revision updates exactly one company and rotates the revision", async () => {
  const h = harness({ saved: existingRow() });
  const data = fixture();
  data.brand.creative!.copy.caption = "  Nova edição\n";
  const result = await h.post(saveBody(data, revision));
  assert.equal(result.status, 200);
  const saved = await result.json();
  assert.deepEqual(saved.data, data);
  assert.notEqual(saved.revision, revision);
  assert.notEqual(saved.updatedAt, updatedAt);
  assert.deepEqual(h.attempts, ["update"]);
  assert.ok(
    h.filters.some(
      ([table, key, value]) =>
        table === "marketing_workspaces" && key === "revision" && value === revision,
    ),
  );
  assert.ok(
    h.filters.some(
      ([table, key, value]) =>
        table === "marketing_workspaces" && key === "company_id" && value === companyId,
    ),
  );
});

test("duplicate inserts, stale revisions and updates to absent rows conflict without overwrite", async () => {
  for (const expectedRevision of [null, otherCompanyId]) {
    const h = harness({ saved: existingRow() });
    const response = await h.post(saveBody(fixture(), expectedRevision));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "WORKSPACE_CONFLICT");
    assert.deepEqual(h.row(), existingRow());
    assert.deepEqual(h.writes, []);
    assert.equal(h.attempts.length, 1);
  }
  const absent = harness();
  assert.equal((await absent.post(saveBody(fixture(), revision))).status, 409);
  assert.equal(absent.row(), null);
});

test("concurrent insert and update callers have one winner per base revision", async () => {
  for (const initial of [undefined, existingRow()]) {
    const h = harness(initial ? { saved: initial } : {});
    const a = fixture();
    const b = fixture();
    a.name = "Primeiro";
    b.name = "Segundo";
    const results = await Promise.all([
      h.post(saveBody(a, initial?.revision ?? null)),
      h.post(saveBody(b, initial?.revision ?? null)),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = await results.find((r) => r.status === 200)!.json();
    assert.deepEqual(h.row()?.data, winner.data);
    assert.equal(h.writes.length, 1);
  }
});

test("missing table/schema reports WORKSPACE_UNAVAILABLE on GET, insert and update", async () => {
  for (const code of ["42P01", "PGRST205", "PGRST204"]) {
    const h = harness({ storageError: code });
    for (const response of [
      await h.get(),
      await h.post(saveBody()),
      await h.post(saveBody(fixture(), revision)),
    ]) {
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "WORKSPACE_UNAVAILABLE");
    }
    assert.deepEqual(h.writes, []);
  }
});

test("other storage/authz failures and malformed stored data never appear as an empty workspace", async () => {
  for (const options of [{ storageError: "42501" }, { companyError: true }, { throws: true }]) {
    const h = harness(options);
    for (const response of [await h.get(), await h.post(saveBody())]) {
      assert.equal(response.status, 500);
      assert.equal((await response.json()).code, undefined);
    }
    assert.deepEqual(h.writes, []);
  }
  const h = harness({ saved: existingRow(), writeError: "42501" });
  assert.equal((await h.post(saveBody(fixture(), revision))).status, 500);
  assert.deepEqual(h.row(), existingRow());
  assert.equal((await harness({ saved: existingRow({ name: 123 }) }).get()).status, 500);
});

test("malformed JSON, IDs, revisions and demo data are rejected before queries or writes", async () => {
  const h = harness();
  assert.equal((await h.get("bad-id")).status, 400);
  assert.equal((await h.get("")).status, 400);
  assert.equal((await h.rawPost("{")).status, 400);
  assert.equal((await h.rawPost("")).status, 400);
  for (const body of [
    null,
    [],
    {},
    { ...saveBody(), companyId: "invalid" },
    { companyId, data: fixture() },
    { ...saveBody(), expectedRevision: "invalid" },
    { ...saveBody(), expectedRevision: 1 },
    { ...saveBody(), data: null },
    { ...saveBody(), data: { ...fixture(), name: "x".repeat(121) } },
    { ...saveBody(), data: { ...fixture(), answers: { offers: 12 } } },
    { ...saveBody(), data: { ...fixture(), brand: { creative: { copy: 1 } } } },
    { ...saveBody(), revision },
    { ...saveBody(), owner_id: ownerId },
  ])
    assert.equal((await h.post(body)).status, 400);
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.attempts, []);
});

test("demoSchema supplies defaults for a partial draft", async () => {
  const h = harness();
  const response = await h.post({
    companyId,
    expectedRevision: null,
    data: { name: "", answers: {} },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await response.json()).data,
    quickStart.demoSchema.parse({ name: "", answers: {} }),
  );
});

test("5 MB is enforced by bytes even with missing or misleading Content-Length", async () => {
  const h = harness();
  assert.equal((await h.rawPost("{}", { "content-length": String(maxBytes + 1) })).status, 413);
  const data = fixture();
  data.delivery.draftContext = "é".repeat(2_500_000);
  const body = JSON.stringify(saveBody(data));
  assert.ok(body.length < maxBytes);
  assert.ok(Buffer.byteLength(body) > maxBytes);
  assert.equal((await h.rawPost(body)).status, 413);
  assert.equal((await h.rawPost(body, { "content-length": "1" })).status, 413);
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.writes, []);
});

test("streamed oversized requests are cancelled as soon as the byte limit is crossed", async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(1_000_000).fill(32));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const h = harness();
  assert.equal((await h.rawPost(stream)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(pulls, 6);
  assert.deepEqual(h.reads, []);
});

test("exactly 5 MB and the schema's three inline images are accepted intact", async () => {
  const data = fixture();
  const prefix = "data:image/png;base64,";
  const image = prefix + "A".repeat(1_500_000 - prefix.length);
  data.brand.logo = image;
  data.brand.photo = image;
  data.brand.research.logo = image;
  data.delivery.draftContext = "";
  const spare = maxBytes - Buffer.byteLength(JSON.stringify(saveBody(data)));
  assert.ok(spare > 0);
  data.delivery.draftContext = " ".repeat(spare);
  const body = JSON.stringify(saveBody(data));
  assert.equal(Buffer.byteLength(body), maxBytes);
  const h = harness();
  const response = await h.rawPost(body);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, data);
});

test("older writers cannot silently erase the extended library and inspiration document", async () => {
  const h = harness({ saved: existingRow() });
  const input = JSON.parse(JSON.stringify(fixture()));
  delete input.workspaceSchemaVersion;
  const response = await h.post(saveBody(input, revision));
  assert.equal(response.status, 426);
  assert.deepEqual(h.attempts, []);
  assert.deepEqual(h.row(), existingRow());
});

test("version-two writers cannot strip new piece instructions, media or planning channels", async () => {
  const h = harness({ saved: existingRow() });
  const input = JSON.parse(JSON.stringify(fixture()));
  input.workspaceSchemaVersion = 2;
  const response = await h.post(saveBody(input, revision));
  assert.equal(response.status, 426);
  assert.deepEqual(h.attempts, []);
  assert.deepEqual(h.row(), existingRow());
});
