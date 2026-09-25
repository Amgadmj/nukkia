import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as onboarding from "../src/lib/onboarding.ts";
import * as state from "../src/lib/onboarding-draft-state.ts";

const compiled = ts.transpileModule(
  readFileSync(new URL("../src/lib/onboarding-draft.ts", import.meta.url), "utf8"),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const cloudDraft = (revision: string, offers: string): state.RemoteDraft => ({
  revision,
  draft: { version: 1, answers: onboarding.normalizeAnswers({ offers }), step: 1 },
  updatedAt: "2026-09-24T12:00:00Z",
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function harness(initial: state.RemoteDraft | null = null) {
  let cloud = initial;
  let user: string | null = "owner";
  let revision = 0;
  let mountEffects = false;
  let storageFails = false;
  let missingSchema = false;
  let authChanged: (event: string, session: unknown) => void = () => {};
  let hold: {
    method: string;
    started: ReturnType<typeof deferred<void>>;
    gate: ReturnType<typeof deferred<void>>;
  } | null = null;
  const requests: string[] = [];
  const storage: Record<string, string> = {};
  const localStorage = new Proxy(storage, {
    get(target, name) {
      if (name === "getItem")
        return (key: string) => {
          if (storageFails) throw Error("blocked");
          return target[key] ?? null;
        };
      if (name === "setItem")
        return (key: string, value: string) => {
          if (storageFails) throw Error("blocked");
          target[key] = value;
        };
      if (name === "removeItem")
        return (key: string) => {
          if (storageFails) throw Error("blocked");
          delete target[key];
        };
      return Reflect.get(target, name);
    },
  });
  const events = new EventTarget();
  const modules: Record<string, unknown> = {
    react: {
      useMemo: (factory: () => unknown) => factory(),
      useEffect: (effect: () => void) => {
        if (mountEffects) effect();
      },
      useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
    },
    "./onboarding": onboarding,
    "./onboarding-draft-state": state,
    "@/integrations/supabase/client": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: user ? { user: { id: user }, access_token: "test-only" } : null },
            error: null,
          }),
          onAuthStateChange: (callback: typeof authChanged) => {
            authChanged = callback;
            return { data: { subscription: { unsubscribe() {} } } };
          },
        },
      },
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
    window: {
      localStorage,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    },
    Event,
    AbortSignal,
    // Debounce timers are advanced explicitly by retry() in these tests.
    setTimeout: () => 1,
    clearTimeout() {},
    fetch: async (_url: string, init: { method: string; body?: string }) => {
      requests.push(init.method);
      if (missingSchema) return Response.json({ code: "schema-unavailable" }, { status: 503 });
      if (init.method !== "GET") {
        const body = JSON.parse(init.body!);
        if (body.baseRevision !== (cloud?.revision ?? null))
          return Response.json({ code: "conflict" }, { status: 409 });
        cloud = {
          revision: `saved-${++revision}`,
          draft: init.method === "DELETE" ? null : body.draft,
          updatedAt: "2026-09-24T12:00:00Z",
        };
      }
      const response = Response.json({ draft: cloud });
      if (hold?.method === init.method) {
        const pending = hold;
        hold = null;
        pending.started.resolve();
        await pending.gate.promise;
      }
      return response;
    },
  });
  const api = exports as unknown as typeof import("../src/lib/onboarding-draft.ts");
  const sync = () => api.useDraftSync("owner", "company");
  return {
    api,
    requests,
    sync,
    cloud: () => cloud,
    setCloud: (value: state.RemoteDraft) => {
      cloud = value;
    },
    local: () => api.useDraft("owner", "company"),
    save: (offers: string) =>
      api.saveDraft("owner", "company", onboarding.normalizeAnswers({ offers }), 1),
    mount: () => {
      mountEffects = true;
      sync();
      mountEffects = false;
    },
    block(method: string) {
      const started = deferred<void>();
      const gate = deferred<void>();
      hold = { method, started, gate };
      return { started: started.promise, release: () => gate.resolve() };
    },
    setUser(value: string | null) {
      user = value;
      authChanged(value ? "SIGNED_IN" : "SIGNED_OUT", value ? { user: { id: value } } : null);
    },
    failStorage: () => {
      storageFails = true;
    },
    missingSchema: () => {
      missingSchema = true;
    },
  };
}

test("late GET cannot replace a new local edit", async () => {
  const h = harness(cloudDraft("remote", "Cloud"));
  const read = h.block("GET");
  h.mount();
  await read.started;
  h.save("New local");
  read.release();
  await tick();
  assert.equal(h.local()?.answers.offers, "New local");
  assert.equal(h.cloud()?.draft?.answers.offers, "Cloud");
  assert.equal(h.sync().status, "conflict");
});
test("late POST acknowledgement preserves and subsequently uploads newer edits", async () => {
  const h = harness();
  h.mount();
  await tick();
  h.save("First");
  const write = h.block("POST");
  const pending = h.sync().retry();
  await write.started;
  h.save("Second");
  write.release();
  await pending;
  assert.equal(h.local()?.answers.offers, "Second");
  assert.equal(h.cloud()?.draft?.answers.offers, "Second");
  assert.equal(h.sync().status, "synced");
});
test("awaited completion drains pending writes before confirming cloud deletion", async () => {
  const h = harness();
  h.mount();
  await tick();
  h.save("Answer");
  const write = h.block("POST");
  const pending = h.sync().retry();
  await write.started;
  let finished = false;
  const cleanup = h.api.removeDraft("owner", "company").then((value) => {
    finished = true;
    return value;
  });
  await tick();
  assert.equal(finished, false);
  assert.equal(h.local(), null);
  write.release();
  assert.equal(await cleanup, true);
  await pending;
  assert.equal(h.cloud()?.draft, null);
  assert.ok(h.requests.includes("DELETE"));
});
test("account switch and signout cleanup discard late reads without cloud deletion", async () => {
  for (const nextUser of [null, "other-owner"]) {
    const h = harness(cloudDraft("remote", "Private answer"));
    const read = h.block("GET");
    h.mount();
    await read.started;
    h.setUser(nextUser);
    h.api.clearOnboardingDrafts();
    read.release();
    await tick();
    assert.equal(h.local(), null);
    assert.equal(h.sync().status, "local");
    assert.deepEqual(h.requests, ["GET"]);
    assert.equal(h.cloud()?.draft?.answers.offers, "Private answer");
  }
});
test("missing schema and blocked storage keep safe, accurately reported local fallback", async () => {
  const h = harness();
  h.missingSchema();
  h.mount();
  await tick();
  assert.equal(h.sync().status, "local");
  assert.equal(h.sync().reason, "schema-unavailable");
  assert.equal(h.save("Local only"), true);
  await h.sync().retry();
  assert.equal(h.local()?.answers.offers, "Local only");
  h.failStorage();
  assert.equal(h.save("Memory only"), false);
  assert.equal(h.local()?.answers.offers, "Memory only");
  assert.equal(await h.api.removeDraft("owner", "company"), false);
});
