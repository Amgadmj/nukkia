import test from "node:test";
import assert from "node:assert/strict";
import * as zod from "zod";
import * as catalog from "../src/lib/pricing/catalog.ts";
import * as economics from "../src/lib/pricing/economics.ts";
import { loadModule } from "./load-module.ts";

type Call = {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string | null };
};

function asaas(
  responses: unknown[],
  env: Record<string, string> = {
    ASAAS_API_KEY: "key",
    ASAAS_ENV: "sandbox",
    ASAAS_WEBHOOK_TOKEN: "shared-secret-token",
  },
) {
  const calls: Call[] = [];
  const mod = loadModule(
    "src/lib/billing/asaas.server.ts",
    {},
    {
      process: { env },
      fetch: async (url: string, init: Call["init"]) => {
        calls.push({ url, init });
        const next = responses.shift();
        if (next instanceof Response) return next;
        return new Response(JSON.stringify(next ?? {}), { status: 200 });
      },
    },
  );
  return { mod, calls };
}

test("webhook token: exact match only, constant-time shape, closed when unset", () => {
  const { mod } = asaas([]);
  assert.equal(mod["webhookTokenValid"]("shared-secret-token"), true);
  assert.equal(mod["webhookTokenValid"]("shared-secret-tokeN"), false);
  assert.equal(mod["webhookTokenValid"]("shared-secret-token-longer"), false);
  assert.equal(mod["webhookTokenValid"](""), false);
  assert.equal(mod["webhookTokenValid"](null), false);
  const unset = asaas([], { ASAAS_API_KEY: "key" });
  assert.equal(
    unset.mod["webhookTokenValid"]("anything"),
    false,
    "no configured token means nothing authenticates",
  );
});

test("the Asaas client authenticates with access_token and uses the sandbox unless told otherwise", async () => {
  const { mod, calls } = asaas([{ data: [] }, { id: "cus_1" }]);
  const id = await mod["findOrCreateCustomer"]({
    companyId: "c-1",
    name: "Clínica",
    email: "a@x.test",
    cpfCnpj: "12345678000190",
  });
  assert.equal(id, "cus_1");
  assert.match(
    calls[0]!.url,
    /^https:\/\/api-sandbox\.asaas\.com\/v3\/customers\?externalReference=c-1/,
  );
  assert.equal(calls[0]!.init.headers?.["access_token"], "key");
  assert.equal(calls[0]!.init.headers?.["User-Agent"], "Nukkia/1.0");
  assert.deepEqual(JSON.parse(calls[1]!.init.body ?? "{}"), {
    name: "Clínica",
    email: "a@x.test",
    cpfCnpj: "12345678000190",
    externalReference: "c-1",
    notificationDisabled: false,
  });
  const production = asaas([{ data: [{ id: "cus_9" }] }], {
    ASAAS_API_KEY: "key",
    ASAAS_ENV: "production",
  });
  assert.equal(
    await production.mod["findOrCreateCustomer"]({
      companyId: "c",
      name: "n",
      email: null,
      cpfCnpj: null,
    }),
    "cus_9",
  );
  assert.match(production.calls[0]!.url, /^https:\/\/api\.asaas\.com\/v3\//);
});

test("a subscription is created with the registry amount in reais and the right cycle", async () => {
  const { mod, calls } = asaas([{ id: "sub_1" }]);
  await mod["createSubscription"]({
    customerId: "cus_1",
    amountCents: 49_700,
    interval: "year",
    billingType: "UNDEFINED",
    description: "Nukkia Pro (anual)",
    externalReference: "row-1",
  });
  const body = JSON.parse(calls[0]!.init.body ?? "{}");
  assert.equal(body.value, 497);
  assert.equal(body.cycle, "YEARLY");
  assert.equal(body.billingType, "UNDEFINED");
  assert.equal(body.externalReference, "row-1");
  assert.match(body.nextDueDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("provider errors surface a safe message and never the upstream body", async () => {
  const { mod } = asaas([new Response("SECRET upstream detail", { status: 400 })]);
  await assert.rejects(
    mod["createPayment"]({
      customerId: "c",
      amountCents: 100,
      billingType: "PIX",
      description: "x",
      externalReference: "e",
    }),
    (err: { userMessage: string; status: number }) =>
      !err.userMessage.includes("SECRET") && err.status === 502,
  );
  const missing = asaas([], {});
  await assert.rejects(
    missing.mod["findOrCreateCustomer"]({ companyId: "c", name: "n", email: null, cpfCnpj: null }),
    (err: { status: number }) => err.status === 503,
  );
});

// --- webhook handler with a fake database ----------------------------------

function fakeDb(
  options: {
    insertError?: { code: string; message: string };
    previousStatus?: string;
    rpcResult?: string;
    rpcError?: string;
  } = {},
) {
  const log = { inserts: [] as unknown[], updates: [] as unknown[], rpc: [] as unknown[] };
  const db = {
    from: () => {
      let mode = "";
      const chain: Record<string, unknown> = {
        insert: (row: unknown) => {
          mode = "insert";
          log.inserts.push(row);
          return chain;
        },
        update: (row: unknown) => {
          mode = "update";
          log.updates.push(row);
          return chain;
        },
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (mode === "insert")
            return options.insertError
              ? { data: null, error: options.insertError }
              : { data: { id: "evt-row" }, error: null };
          return {
            data: options.previousStatus ? { status: options.previousStatus } : null,
            error: null,
          };
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return chain;
    },
    rpc: async (name: string, args: unknown) => {
      log.rpc.push({ name, args });
      return options.rpcError
        ? { data: null, error: { message: options.rpcError } }
        : { data: options.rpcResult ?? "activated", error: null };
    },
  };
  return { db, log };
}

const webhook = () =>
  loadModule("src/lib/billing/webhook.server.ts", { zod, "@/integrations/supabase/types": {} });

const paymentEvent = {
  id: "evt_abc",
  event: "PAYMENT_CONFIRMED",
  payment: {
    id: "pay_1",
    subscription: "sub_1",
    externalReference: "row-1",
    confirmedDate: "2026-11-02",
    status: "CONFIRMED",
  },
};

test("a confirmed payment is logged, applied once, and marked processed", async () => {
  const { db, log } = fakeDb();
  const outcome = await webhook()["handleAsaasWebhook"](db, paymentEvent);
  assert.deepEqual({ ...outcome }, { ok: true, result: "activated", duplicate: false });
  assert.equal((log.inserts[0] as Record<string, unknown>)["event_id"], "evt_abc");
  const call = log.rpc[0] as { name: string; args: Record<string, unknown> };
  assert.equal(call.name, "apply_payment_event");
  assert.equal(call.args["_event"], "PAYMENT_CONFIRMED");
  assert.equal(call.args["_provider_subscription_id"], "sub_1");
  assert.equal(call.args["_external_ref"], "row-1");
  assert.match(String(call.args["_paid_at"]), /^2026-11-02T15:00:00/);
  assert.equal((log.updates.at(-1) as Record<string, unknown>)["status"], "processed");
});

test("a replay of a handled event is acknowledged without applying it again", async () => {
  const { db, log } = fakeDb({
    insertError: { code: "23505", message: "duplicate" },
    previousStatus: "processed",
  });
  const outcome = await webhook()["handleAsaasWebhook"](db, paymentEvent);
  assert.deepEqual({ ...outcome }, { ok: true, result: "already_handled", duplicate: true });
  assert.equal(log.rpc.length, 0);
});

test("a replay of a failed event is processed again so retries repair it", async () => {
  const { db, log } = fakeDb({
    insertError: { code: "23505", message: "duplicate" },
    previousStatus: "failed",
  });
  const outcome = await webhook()["handleAsaasWebhook"](db, paymentEvent);
  assert.equal(outcome.ok, true);
  assert.equal(log.rpc.length, 1);
});

test("a processing failure returns 500 so Asaas retries, and records the error", async () => {
  const { db, log } = fakeDb({ rpcError: "boom" });
  const outcome = await webhook()["handleAsaasWebhook"](db, paymentEvent);
  assert.deepEqual({ ...outcome }, { ok: false, status: 500, error: "processing failed" });
  assert.equal((log.updates.at(-1) as Record<string, unknown>)["status"], "failed");
});

test("unknown subscriptions and irrelevant events are stored but settled as ignored", async () => {
  const { db, log } = fakeDb({ rpcResult: "unknown_subscription" });
  assert.equal((await webhook()["handleAsaasWebhook"](db, paymentEvent)).ok, true);
  assert.equal((log.updates.at(-1) as Record<string, unknown>)["status"], "ignored");
});

test("malformed bodies are rejected before touching the database", async () => {
  const { db, log } = fakeDb();
  for (const body of [null, {}, { event: 42 }, "text"]) {
    const outcome = await webhook()["handleAsaasWebhook"](db, body);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.status, 400);
  }
  assert.equal(log.inserts.length, 0);
});

test("event keys prefer Asaas's id and otherwise describe the event", () => {
  const mod = webhook();
  assert.equal(mod["eventKey"]({ id: "evt_1", event: "PAYMENT_OVERDUE" }), "evt_1");
  assert.equal(
    mod["eventKey"]({ event: "PAYMENT_OVERDUE", payment: { id: "pay_9", status: "OVERDUE" } }),
    "PAYMENT_OVERDUE:pay_9:OVERDUE",
  );
});

// --- checkout --------------------------------------------------------------

function checkoutModule(stubs: Record<string, unknown>) {
  return loadModule("src/lib/billing/checkout.server.ts", {
    "@/lib/pricing/catalog": catalog,
    "@/lib/pricing/economics": economics,
    "@/lib/pricing/registry.server": { loadAssumptions: async () => economics.DEFAULT_ASSUMPTIONS },
    "./asaas.server": {
      BillingError: class extends Error {
        userMessage: string;
        status: number;
        constructor(message: string, status = 502) {
          super(message);
          this.userMessage = message;
          this.status = status;
        }
      },
      cancelRemoteSubscription: async () => {},
      createPayment: async () => ({ id: "pay_1", invoiceUrl: "https://pay.test/p" }),
      createSubscription: async () => ({ id: "sub_1" }),
      findOrCreateCustomer: async () => "cus_1",
      firstInvoiceOf: async () => ({ id: "pay_1", invoiceUrl: "https://pay.test/i" }),
      ...stubs,
    },
  });
}

const actor = { userId: "owner-1", email: "o@x.test" };
function checkoutDbs(options: { owner?: string; reserveError?: { code: string } } = {}) {
  const updates: unknown[] = [];
  const user = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "co-1",
              name: "Co",
              owner_id: options.owner ?? "owner-1",
              cnpj: "12.345.678/0001-90",
            },
          }),
        }),
      }),
    }),
  };
  const admin = {
    rpc: async () =>
      options.reserveError
        ? { data: null, error: options.reserveError }
        : { data: { id: "row-1", amount_cents: 49_700, cohort_key: "founding" }, error: null },
    from: () => ({
      update: (row: unknown) => {
        updates.push(row);
        return { eq: async () => ({ error: null }) };
      },
      insert: () => ({
        select: () => ({ maybeSingle: async () => ({ data: { id: "pur-1" }, error: null }) }),
      }),
    }),
  };
  return { user, admin, updates };
}

test("checkout bills only the owner, takes the amount from the reserved price and returns the invoice page", async () => {
  const mod = checkoutModule({});
  const dbs = checkoutDbs();
  const result = await mod["startSubscriptionCheckout"](
    dbs,
    { companyId: "co-1", plan: "pro", interval: "month", billingType: "UNDEFINED", cpfCnpj: null },
    actor,
  );
  assert.deepEqual(
    { ...result },
    { checkoutUrl: "https://pay.test/i", amountCents: 49_700, cohort: "founding" },
  );
  await assert.rejects(
    mod["startSubscriptionCheckout"](
      checkoutDbs({ owner: "someone-else" }),
      {
        companyId: "co-1",
        plan: "pro",
        interval: "month",
        billingType: "UNDEFINED",
        cpfCnpj: null,
      },
      actor,
    ),
    (err: { status: number }) => err.status === 404,
  );
});

test("a failure after the reservation cancels it so it never holds a seat", async () => {
  const mod = checkoutModule({
    createSubscription: async () => {
      throw new Error("asaas down");
    },
  });
  const dbs = checkoutDbs();
  await assert.rejects(
    mod["startSubscriptionCheckout"](
      dbs,
      { companyId: "co-1", plan: "pro", interval: "month", billingType: "PIX", cpfCnpj: null },
      actor,
    ),
    /asaas down/,
  );
  assert.ok(dbs.updates.some((u) => (u as Record<string, unknown>)["status"] === "canceled"));
});

test("reservation errors map to clear messages and a tax id is required", async () => {
  const mod = checkoutModule({});
  const live = checkoutDbs({ reserveError: { code: "P0001" } });
  await assert.rejects(
    mod["startSubscriptionCheckout"](
      live,
      {
        companyId: "co-1",
        plan: "pro",
        interval: "month",
        billingType: "UNDEFINED",
        cpfCnpj: null,
      },
      actor,
    ),
    /já tem uma assinatura/,
  );
  const noPrice = checkoutDbs({ reserveError: { code: "P0002" } });
  await assert.rejects(
    mod["startSubscriptionCheckout"](
      noPrice,
      {
        companyId: "co-1",
        plan: "pro",
        interval: "month",
        billingType: "UNDEFINED",
        cpfCnpj: null,
      },
      actor,
    ),
    /ainda não está disponível/,
  );
  const noTaxId = checkoutDbs();
  noTaxId.user.from = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { id: "co-1", name: "Co", owner_id: "owner-1", cnpj: null },
        }),
      }),
    }),
  });
  await assert.rejects(
    mod["startSubscriptionCheckout"](
      noTaxId,
      {
        companyId: "co-1",
        plan: "pro",
        interval: "month",
        billingType: "UNDEFINED",
        cpfCnpj: "123",
      },
      actor,
    ),
    (err: { status: number }) => err.status === 422,
  );
  assert.equal(mod["normalizeTaxId"]("123.456.789-09"), "12345678909");
  assert.equal(mod["normalizeTaxId"]("12.345.678/0001-90"), "12345678000190");
  assert.equal(mod["normalizeTaxId"]("12345"), null);
});

test("the 30-second film cannot be bought until it opens; an extra video can", async () => {
  const mod = checkoutModule({});
  await assert.rejects(
    mod["startPurchase"](
      checkoutDbs(),
      { companyId: "co-1", sku: "film_30s", billingType: "PIX", cpfCnpj: null },
      actor,
    ),
    /ainda não está disponível/,
  );
  const ok = await mod["startPurchase"](
    checkoutDbs(),
    { companyId: "co-1", sku: "video_15s", billingType: "PIX", cpfCnpj: null },
    actor,
  );
  assert.deepEqual({ ...ok }, { invoiceUrl: "https://pay.test/p", amountCents: 17_900 });
});

test("a purchase below the margin floor is refused before any charge is created", async () => {
  const hostile = { ...economics.DEFAULT_ASSUMPTIONS, usdPerCredit: 1 };
  const mod = loadModule("src/lib/billing/checkout.server.ts", {
    "@/lib/pricing/catalog": catalog,
    "@/lib/pricing/economics": economics,
    "@/lib/pricing/registry.server": { loadAssumptions: async () => hostile },
    "./asaas.server": {
      BillingError: class extends Error {
        userMessage = "";
        status = 0;
        constructor(m: string, s = 502) {
          super(m);
          this.userMessage = m;
          this.status = s;
        }
      },
      createPayment: async () => {
        throw new Error("must not be called");
      },
      findOrCreateCustomer: async () => "cus",
    },
  });
  await assert.rejects(
    mod["startPurchase"](
      checkoutDbs(),
      { companyId: "co-1", sku: "video_15s", billingType: "PIX", cpfCnpj: null },
      actor,
    ),
    (err: { status: number }) => err.status === 503,
  );
});
