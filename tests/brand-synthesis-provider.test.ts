import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { synthesizeBrand, retryableSynthesisError } from "../src/lib/brand-synthesis.server.ts";
import { researchSchema } from "../src/lib/brand-preview.ts";

// Provider-boundary tests: the SDK client is injected, so nothing leaves the
// machine. They pin the timeout/retry budget, max_tokens and the log contract.
const secret = "Aulas de pilates em pequenos grupos.";
const research = researchSchema.parse({
  status: "ready",
  sources: [
    {
      url: "https://marca.com/servicos",
      title: "Serviços",
      text: secret,
      fetchedAt: "2026-09-24T12:00:00Z",
    },
  ],
});
const message = (stop_reason: string, text: string) =>
  ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text }],
  }) as unknown as Anthropic.Message;
const grounded = JSON.stringify({
  suggestions: [
    {
      field: "offers",
      title: "Pilates em grupo",
      excerptId: "s0-e0",
      value: secret,
      quote: secret,
      sourceId: "s0",
      kind: "fact",
      rationale: "",
      publishedAt: null,
    },
  ],
});
type Call = { max_tokens: number; timeout: number };
function client(outcomes: (() => Anthropic.Message)[]) {
  const calls: Call[] = [];
  return {
    calls,
    messages: {
      create: async (body: { max_tokens: number }, options: { timeout: number }) => {
        calls.push({ max_tokens: body.max_tokens, timeout: options.timeout });
        const next = outcomes.shift();
        if (!next) throw new Error("unexpected call");
        return next();
      },
    },
  };
}
function captureLogs(t: TestContext) {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  return logs;
}
const overloaded = () => {
  throw Anthropic.APIError.generate(
    529,
    { type: "error", error: { type: "overloaded_error", message: secret } },
    secret,
    new Headers(),
  );
};

test("a grounded answer uses a 40s attempt budget and room for eight suggestions", async (t) => {
  captureLogs(t);
  const fake = client([() => message("end_turn", grounded)]);
  const suggestions = await synthesizeBrand(research, new AbortController().signal, {
    client: fake,
  });
  assert.equal(suggestions.length, 1);
  assert.equal(fake.calls[0]?.max_tokens, 6000);
  assert.equal(fake.calls[0]?.timeout, 40_000);
});

test("one retry on overload/5xx/429/connection errors when it fits before the deadline", async (t) => {
  const logs = captureLogs(t);
  const fake = client([overloaded, () => message("end_turn", grounded)]);
  const suggestions = await synthesizeBrand(research, new AbortController().signal, {
    client: fake,
    deadline: Date.now() + 60_000,
  });
  assert.equal(suggestions.length, 1);
  assert.equal(fake.calls.length, 2);
  assert.ok(fake.calls[1]!.timeout <= 40_000);
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0]?.[1], { error: "InternalServerError", status: 529, stop_reason: null });
});

test("no retry when the caller's deadline cannot fit another attempt, or for client errors", async (t) => {
  captureLogs(t);
  const late = client([overloaded, () => message("end_turn", grounded)]);
  await assert.rejects(
    synthesizeBrand(research, new AbortController().signal, {
      client: late,
      deadline: Date.now() + 10_000,
    }),
  );
  assert.equal(late.calls.length, 1);
  assert.ok(late.calls[0]!.timeout <= 10_000, "the attempt never outlives the caller deadline");
  const bad = client([
    () => {
      throw Anthropic.APIError.generate(400, undefined, "bad", new Headers());
    },
    () => message("end_turn", grounded),
  ]);
  await assert.rejects(
    synthesizeBrand(research, new AbortController().signal, {
      client: bad,
      deadline: Date.now() + 60_000,
    }),
  );
  assert.equal(bad.calls.length, 1);
  assert.equal(retryableSynthesisError(new Anthropic.APIConnectionError({})), true);
  assert.equal(
    retryableSynthesisError(Anthropic.APIError.generate(429, undefined, "", new Headers())),
    true,
  );
  assert.equal(retryableSynthesisError(new Anthropic.APIUserAbortError()), false);
  assert.equal(retryableSynthesisError(new Error("other")), false);
});

test("a max_tokens stop fails closed and logs only class, status and stop_reason", async (t) => {
  const logs = captureLogs(t);
  const fake = client([() => message("max_tokens", `{"suggestions":[{"value":"${secret}`)]);
  await assert.rejects(
    synthesizeBrand(research, new AbortController().signal, { client: fake }),
    /synthesis unavailable/,
  );
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0]?.[1], {
    error: "SynthesisUnavailableError:stop-reason",
    status: null,
    stop_reason: "max_tokens",
  });
});

test("provider failures are logged without website text or provider messages", async (t) => {
  const logs = captureLogs(t);
  const fake = client([overloaded]);
  await assert.rejects(synthesizeBrand(research, new AbortController().signal, { client: fake }));
  assert.ok(logs.length >= 1);
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /pilates|overloaded_error/i);
});

test("a caller abort is not retried or logged as a provider failure", async (t) => {
  const logs = captureLogs(t);
  const controller = new AbortController();
  const fake = client([
    () => {
      controller.abort();
      throw new Anthropic.APIUserAbortError();
    },
    () => message("end_turn", grounded),
  ]);
  await assert.rejects(
    synthesizeBrand(research, controller.signal, {
      client: fake,
      deadline: Date.now() + 60_000,
    }),
  );
  assert.equal(fake.calls.length, 1);
  assert.equal(logs.length, 0);
});
