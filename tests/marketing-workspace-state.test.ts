import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext as createVmContext, runInContext, runInNewContext } from "node:vm";
import ts from "typescript";
import { webcrypto } from "node:crypto";
import * as zod from "zod";
import * as onboarding from "../src/lib/onboarding.ts";
import * as quickStart from "../src/lib/quick-start.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import type { DemoData } from "../src/lib/quick-start.ts";
import { composeContent, creativeFingerprint } from "../src/lib/brand-preview.ts";

const ownerId = "owner-a";
const companyId = "00000000-0000-4000-8000-000000000001";
const r1 = "00000000-0000-4000-8000-000000000011";
const r2 = "00000000-0000-4000-8000-000000000012";
const r3 = "00000000-0000-4000-8000-000000000013";
const company = { id: companyId, owner_id: ownerId, name: "Seed", segment: null, website: null };
const draft = (name: string) => quickStart.demoSchema.parse({ name, answers: {} });
const cloud = (data: DemoData | null, revision: string | null = data ? r1 : null) => ({
  data,
  revision,
  updatedAt: data ? "2026-09-24T12:00:00.000Z" : null,
});
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
type Element = { type: unknown; props: Record<string, unknown>; key?: string };
type Value = {
  data: DemoData;
  ownerId: string;
  company: typeof company | null;
  sync: string;
  storageAvailable: boolean;
  recoveryAvailable: boolean;
  conflictSource: "browser" | "cloud" | null;
  setData: (value: DemoData | ((current: DemoData) => DemoData)) => void;
  resolveConflict: (choice: "cloud" | "local") => void;
  retrySync: () => void;
};
type Cell = {
  value?: unknown;
  deps?: readonly unknown[];
  cleanup?: (() => void) | undefined;
  effect?: () => void | (() => void);
};

// No DOM renderer is installed. Like welcome-integration, execute the real
// component's hooks/effects with controlled scheduling, dependency cleanup and
// functional state updates. These tests cover behavior, not DOM/React internals.
function driver() {
  const cells: Cell[] = [];
  let cursor = 0;
  let changed = false;
  let mounted = true;
  let subject: () => Element | null;
  let tree: Element | null = null;
  let effects: (() => void)[] = [];
  let lateUpdates = 0;
  const same = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !!a && !!b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState<T>(initial: T | (() => T)) {
      const index = cursor++;
      const cell = (cells[index] ??= {
        value: typeof initial === "function" ? (initial as () => T)() : initial,
      });
      return [
        cell.value,
        (value: T | ((current: T) => T)) => {
          if (!mounted) {
            lateUpdates++;
            return;
          }
          const next =
            typeof value === "function" ? (value as (current: T) => T)(cell.value as T) : value;
          if (!Object.is(next, cell.value)) {
            cell.value = next;
            changed = true;
          }
        },
      ] as const;
    },
    useRef<T>(initial: T) {
      return (cells[cursor++] ??= { value: { current: initial } }).value as { current: T };
    },
    useMemo<T>(fn: () => T, deps?: readonly unknown[]) {
      const index = cursor++;
      if (!cells[index] || !same(cells[index]!.deps, deps)) cells[index] = { value: fn(), deps };
      return cells[index]!.value as T;
    },
    useCallback<T>(fn: T, deps?: readonly unknown[]) {
      return react.useMemo(() => fn, deps);
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const cell = (cells[cursor++] ??= {});
      if (!same(cell.deps, deps)) {
        cell.deps = deps;
        cell.effect = effect;
        effects.push(() => {
          cell.cleanup?.();
          cell.cleanup = effect() || undefined;
        });
      }
    },
  };
  function render() {
    if (!mounted) return tree;
    let passes = 0;
    do {
      assert.ok(++passes < 40, "effects must settle without looping");
      cursor = 0;
      changed = false;
      effects = [];
      tree = subject();
      for (const effect of effects) effect();
    } while (changed);
    return tree;
  }
  return {
    react,
    render,
    get lateUpdates() {
      return lateUpdates;
    },
    mount(fn: () => Element | null) {
      subject = fn;
      return render();
    },
    replayEffects() {
      for (const cell of cells) cell.cleanup?.();
      for (const cell of cells) if (cell.effect) cell.cleanup = cell.effect() || undefined;
      return render();
    },
    prepareRefresh() {
      // Fast Refresh preserves state/refs but reruns memo factories and effects,
      // even when their dependency arrays are unchanged.
      for (const cell of cells) {
        cell.cleanup?.();
        cell.cleanup = undefined;
        cell.deps = undefined;
      }
    },
    unmount() {
      mounted = false;
      for (const cell of cells) cell.cleanup?.();
    },
  };
}

const source = readFileSync(
  new URL("../src/components/marketing-provider.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

// Use the installed Vite React plugin's real boundary check, without a browser
// or refresh timers. This catches incompatible exports that would invalidate
// consumers instead of retaining the mounted provider during Fast Refresh.
const refreshCompiled = ts.transpileModule(
  readFileSync(
    new URL("../node_modules/@vitejs/plugin-react/dist/refresh-runtime.js", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function loadContextModule(modules: Record<string, unknown>, globals: object = {}) {
  if (!("./marketing-context" in modules)) {
    const exports = {};
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL("../src/components/marketing-context.ts", import.meta.url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
      ).outputText,
      {
        ...globals,
        exports,
        require: (name: string) => {
          assert.ok(name in modules, `Unexpected context dependency ${name}`);
          return modules[name];
        },
      },
    );
    modules["./marketing-context"] = exports;
  }
  return modules["./marketing-context"];
}

function text(node: unknown): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "props" in node)
    return text((node as Element).props.children);
  return "";
}

function harness(
  t: TestContext,
  options: {
    cached?: workspace.StoredWorkspace;
    noCompany?: boolean;
    storageFails?: boolean;
    browser?: Record<string, string>;
    localFails?: boolean;
    localWriteFails?: boolean;
  } = {},
) {
  let hooks = driver();
  const drivers = [hooks];
  let currentOwner = ownerId;
  let currentCompany: typeof company | null = options.noCompany ? null : company;
  let companyError: Error | null = null;
  let diagnosticError: Error | null = null;
  let context: Value | null = null;
  let providedContext: unknown;
  let childKey: string | undefined;
  let child: Element | null = null;
  let alive = true;
  const values: Record<string, string> = {};
  const sessionStorage = Object.defineProperties(values, {
    getItem: { value: (key: string) => values[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        if (storageFails) throw new Error("quota");
        values[key] = value;
      },
    },
    removeItem: {
      value: (key: string) => {
        delete values[key];
      },
    },
  });
  let storageFails = options.storageFails ?? false;
  const listeners = new Map<string, Set<(event: { key: string | null }) => void>>();
  const localStorage =
    options.browser &&
    new Proxy(
      {},
      {
        ownKeys: () => Object.keys(options.browser!),
        getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
        get: (_, name) => {
          if (name === "getItem")
            return (key: string) => {
              if (options.localFails || storageFails) throw new Error("blocked");
              return options.browser![key] ?? null;
            };
          if (name === "setItem")
            return (key: string, value: string) => {
              if (options.localFails || options.localWriteFails || storageFails)
                throw new Error("quota");
              options.browser![key] = value;
            };
          if (name === "removeItem")
            return (key: string) => {
              delete options.browser![key];
            };
          return undefined;
        },
      },
    );
  if (options.cached)
    values[workspace.workspaceKey(ownerId, currentCompany?.id)] = JSON.stringify(options.cached);
  let now = 0;
  let timerId = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const requests: {
    path: string;
    body: { companyId: string; data: DemoData; expectedRevision: string | null } | undefined;
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
  }[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>, key?: string) => ({
    type,
    props,
    key,
  });
  const react = new Proxy(
    {
      createContext: (initial: unknown) => ({ Provider: {}, initial }),
      useContext: (token: { Provider: unknown; initial: unknown }) =>
        token.Provider === providedContext ? context : token.initial,
    },
    {
      get(target, name) {
        return name in target
          ? target[name as keyof typeof target]
          : hooks.react[name as keyof typeof hooks.react];
      },
    },
  );
  const modules: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    zod,
    "./brand-loading": { BrandLoading: "brand-loading" },
    "./workspace-skeleton": { WorkspaceSkeleton: "workspace-skeleton" },
    "@/lib/company": {
      useCompany: () => ({
        data: currentCompany,
        isLoading: false,
        error: companyError,
        refetch: async () => {},
      }),
      useDiagnostic: () => ({
        data: null,
        isLoading: false,
        error: diagnosticError,
        refetch: async () => {},
      }),
    },
    "@/lib/quick-start": quickStart,
    "@/lib/marketing-workspace": workspace,
    "@/lib/api": {
      apiFetch: (path: string, body?: unknown) =>
        new Promise<Response>((resolve, reject) => {
          requests.push({
            path,
            body: structuredClone(body) as (typeof requests)[number]["body"],
            resolve,
            reject,
          });
        }),
    },
    "@/demo.css": {},
    "@/workspace.css": {},
    "./workspace-save-status.css": {},
  };
  const environment = {
    console,
    Response,
    URL,
    Event,
    crypto: webcrypto,
    window: {
      sessionStorage,
      localStorage,
      addEventListener: (type: string, fn: (event: { key: string | null }) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (event: { key: string | null }) => void) =>
        listeners.get(type)?.delete(fn),
      setTimeout: (run: () => void, delay: number) => {
        const id = ++timerId;
        timers.set(id, { at: now + delay, run });
        return id;
      },
      clearTimeout: (id: number) => timers.delete(id),
    },
    require: (name: string) => {
      if (name === "./marketing-context") return loadContextModule(modules, environment);
      assert.ok(name in modules, `Unexpected dependency ${name}`);
      return modules[name];
    },
  };
  type ProviderModule = {
    MarketingProvider: (props: { ownerId: string; children: null }) => Element;
    WorkspaceSaveStatus: () => Element;
    clearMarketingWorkspace: () => void;
    useMarketingWorkspace: () => Value;
  };
  // Refresh's component detection compares Object.prototype identities. Run
  // the runtime and all provider versions in one realm, like the browser.
  const realm = createVmContext({
    ...environment,
    exports: {},
    setTimeout: () => 1,
    clearTimeout() {},
  });
  runInContext(`(function(exports) { ${refreshCompiled}\n})(exports)`, realm);
  const validateRefresh = realm.exports.validateRefreshBoundaryAndEnqueueUpdate as (
    id: string,
    previous: object,
    next: object,
  ) => string | undefined;
  function evaluateProvider() {
    const exports = {};
    realm.exports = exports;
    runInContext(`(function(exports) { ${compiled}\n})(exports)`, realm);
    return exports as ProviderModule;
  }
  let api = evaluateProvider();
  function render() {
    if (!alive) return;
    const next = api.MarketingProvider({ ownerId: currentOwner, children: null });
    if (typeof next.type !== "function") {
      if (child) hooks.unmount();
      child = null;
      context = null;
      return;
    }
    if (child && next.key !== childKey) {
      hooks.unmount();
      hooks = driver();
      drivers.push(hooks);
      child = null;
    }
    childKey = next.key;
    const fresh = !child;
    child = next;
    const component = () =>
      (child!.type as (props: Record<string, unknown>) => Element | null)(child!.props);
    const tree = fresh ? hooks.mount(component) : hooks.render();
    context = tree ? (tree.props.value as Value) : null;
    providedContext = tree?.type;
  }
  async function settle() {
    for (let i = 0; i < 5; i++) {
      await tick();
      render();
    }
  }
  render();
  t.after(() => {
    if (alive) hooks.unmount();
    alive = false;
  });
  return {
    requests,
    values,
    storageEvent(key: string | null = null) {
      for (const fn of listeners.get("storage") ?? []) fn({ key });
      render();
    },
    settle,
    render,
    value: () => {
      assert.ok(context, "workspace must be mounted");
      return context;
    },
    hasWorkspace: () => context !== null,
    status: () => text(api.WorkspaceSaveStatus()),
    statusTree: () => api.WorkspaceSaveStatus(),
    validateRefresh,
    refreshModule: (replayEffects = false) => {
      const previous = api;
      api = evaluateProvider();
      if (replayEffects) {
        hooks.prepareRefresh();
        render();
      }
      return { previous, next: api };
    },
    async reply(index: number, body: unknown, status = 200) {
      assert.ok(requests[index], `request ${index} exists`);
      requests[index]!.resolve(Response.json(body, { status }));
      await settle();
    },
    async fail(index: number) {
      requests[index]!.reject(new Error("offline"));
      await settle();
    },
    async advance(ms = 700) {
      const end = now + ms;
      while (true) {
        const entry = [...timers]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        timers.delete(entry[0]);
        now = entry[1].at;
        entry[1].run();
        await settle();
      }
      now = end;
      await settle();
    },
    edit(name: string) {
      assert.ok(context);
      context.setData((data) => ({ ...data, name }));
      render();
    },
    switchTo(owner: string, nextCompany: typeof company | null) {
      currentOwner = owner;
      currentCompany = nextCompany;
      render();
    },
    storageFails(value: boolean) {
      storageFails = value;
    },
    localFails(value: boolean) {
      options.localFails = value;
    },
    localWriteFails(value: boolean) {
      options.localWriteFails = value;
    },
    companyFails() {
      companyError = new Error("company refresh failed");
      render();
    },
    diagnosticFails() {
      diagnosticError = new Error("diagnostic failed");
      render();
    },
    clear: () => {
      api.clearMarketingWorkspace();
      render();
    },
    replay: () => {
      hooks.replayEffects();
      render();
    },
    unmount: () => {
      hooks.unmount();
      alive = false;
      context = null;
    },
    lateUpdates: () => drivers.reduce((count, item) => count + item.lateUpdates, 0),
  };
}

test("a new authenticated tab restores this company's browser recovery without claiming a cloud save", async (t) => {
  const browser = {};
  const first = harness(t, { browser });
  await first.fail(0);
  first.edit("Cross-tab original");
  const original = structuredClone(first.value().data);
  first.unmount();
  const next = harness(t, { browser });
  await next.fail(0);
  assert.deepEqual(structuredClone(next.value().data), original);
  assert.equal(next.value().recoveryAvailable, true);
  assert.match(next.status(), /neste navegador/);
  assert.doesNotMatch(next.status(), /Salvo na conta/);
});

test("matching recovery acknowledgements do not turn the first edit into a conflict", async (t) => {
  for (const deliverStorageEvent of [true, false]) {
    const browser: Record<string, string> = {};
    const first = harness(t, { browser });
    await first.reply(0, cloud(draft("Shared saved document"), r1));
    const second = harness(t, { browser });
    await second.reply(0, cloud(draft("Shared saved document"), r1));
    if (deliverStorageEvent) first.storageEvent();
    assert.equal(first.value().sync, "saved");
    assert.equal(second.value().sync, "saved");
    first.edit("Only the first tab edited");
    assert.equal(first.value().sync, "ready");
    await first.advance();
    assert.equal(
      first.requests.length,
      2,
      "one ordinary edit must POST rather than request conflict resolution",
    );
    assert.equal(first.requests[1]!.body!.data.name, "Only the first tab edited");
    assert.equal(first.requests[1]!.body!.expectedRevision, r1);
  }
});

test("quota failure writing a logout marker cannot skip cleanup or let a delayed tab recreate recovery", async (t) => {
  const browser: Record<string, string> = {};
  const first = harness(t, { browser });
  await first.fail(0);
  first.edit("Private recovery to delete");
  const second = harness(t, { browser });
  await second.reply(0, cloud(null));
  second.edit("Pending private save");
  await second.advance();
  const pendingSave = second.requests.findIndex((request) => !!request.body);
  assert.ok(pendingSave >= 0);
  const staleSetter = second.value().setData;
  const unrelated = `${workspace.recoveryOwnerPrefix("owner-b")}other:record`;
  browser[unrelated] = "Unrelated owner original";
  first.localWriteFails(true);
  first.clear();
  assert.equal(first.hasWorkspace(), false);
  assert.deepEqual(Object.keys(first.values), []);
  assert.ok(
    !Object.keys(browser).some((key) => key.startsWith(workspace.recoveryOwnerPrefix(ownerId))),
    "cleanup must run even if both marker attempts throw",
  );
  assert.equal(browser[unrelated], "Unrelated owner original");
  // Other tabs can process a network completion before their storage event.
  await second.reply(pendingSave, cloud(draft("Pending private save"), r2));
  staleSetter(draft("Must never recreate"));
  second.render();
  second.replay();
  assert.ok(
    !Object.keys(browser).some((key) => key.startsWith(workspace.recoveryOwnerPrefix(ownerId))),
    "late callbacks/effect replay must not recreate deleted recovery",
  );
  second.storageEvent();
  assert.equal(second.hasWorkspace(), false);
  assert.deepEqual(Object.keys(second.values), []);
});

test("a recovered dirty draft cannot overwrite a newer remote revision without a choice", async (t) => {
  const browser = {};
  const first = harness(t, {
    browser,
    cached: { data: draft("Local original"), revision: r1, dirty: true },
  });
  await first.fail(0);
  first.unmount();
  const next = harness(t, { browser });
  await next.reply(0, cloud(draft("Newer remote"), r2));
  assert.equal(next.value().data.name, "Local original");
  assert.equal(next.value().sync, "conflict");
  await next.advance();
  assert.equal(next.requests.length, 1);
  next.value().resolveConflict("local");
  next.render();
  await next.advance();
  assert.equal(next.requests[1]!.body!.expectedRevision, r2);
});

test("divergent tabs preserve both originals and require explicit local recovery resolution", async (t) => {
  const browser: Record<string, string> = {};
  const first = harness(t, { browser });
  await first.fail(0);
  first.edit("First draft");
  const second = harness(t, { browser });
  await second.fail(0);
  second.edit("Second draft");
  first.edit("Concurrent first draft");
  first.storageEvent();
  second.storageEvent();
  assert.equal(first.value().sync, "conflict");
  assert.equal(second.value().sync, "conflict");
  assert.equal(first.value().conflictSource, "browser");
  assert.ok(Object.values(browser).some((raw) => raw.includes("Second draft")));
  assert.ok(Object.values(browser).some((raw) => raw.includes("Concurrent first draft")));
  const third = harness(t, { browser });
  await third.fail(0);
  assert.equal(third.value().sync, "conflict");
  first.value().resolveConflict("local");
  first.render();
  await first.fail(1);
  const resolved = harness(t, { browser });
  await resolved.fail(0);
  assert.equal(resolved.value().data.name, "Concurrent first draft");
  assert.equal(resolved.value().sync, "local");
  assert.ok(
    Object.values(browser).some((raw) => raw.includes("Second draft")),
    "choosing does not delete the other original",
  );
});

test("choosing the other browser or cloud version preserves the current recovery original", async (t) => {
  for (const source of ["browser", "cloud"] as const) {
    const browser: Record<string, string> = {};
    const current = harness(t, {
      browser,
      cached: { data: draft("Original not discarded"), revision: r1, dirty: true },
    });
    if (source === "cloud") await current.reply(0, cloud(draft("Chosen alternative"), r2));
    else {
      await current.fail(0);
      const other = harness(t, { browser });
      await other.fail(0);
      other.edit("Chosen alternative");
      current.storageEvent();
    }
    assert.equal(current.value().sync, "conflict");
    current.value().resolveConflict("cloud");
    current.render();
    assert.equal(current.value().data.name, "Chosen alternative");
    assert.ok(
      Object.values(browser).some((raw) => raw.includes("Original not discarded")),
      "explicit version choice keeps the replaced original recoverable",
    );
  }
});

test("logout removes only the active owner's recovery and prevents other tabs resurrecting it", async (t) => {
  const browser: Record<string, string> = {};
  const first = harness(t, { browser });
  await first.fail(0);
  first.edit("Owner A private");
  const otherTab = harness(t, { browser });
  await otherTab.fail(0);
  const otherOwner = harness(t, { browser, noCompany: true });
  otherOwner.switchTo("owner-b", { ...company, owner_id: "owner-b", name: "B" });
  await otherOwner.fail(0);
  otherOwner.edit("Owner B private");
  const staleSetter = otherTab.value().setData;
  first.clear();
  otherTab.storageEvent();
  staleSetter(draft("Must not resurrect"));
  otherTab.render();
  assert.equal(otherTab.hasWorkspace(), false);
  assert.ok(!Object.values(browser).some((raw) => /Owner A private|Must not resurrect/.test(raw)));
  assert.ok(Object.values(browser).some((raw) => raw.includes("Owner B private")));
  const freshA = harness(t, { browser });
  await freshA.fail(0);
  assert.equal(freshA.value().data.name, "Seed");
});

test("legacy session recovery imports only the current scope and survives blocked durable storage honestly", async (t) => {
  const browser: Record<string, string> = {};
  const h = harness(t, {
    browser,
    localFails: true,
    cached: { data: draft("Legacy original"), revision: null, dirty: true },
  });
  h.values[workspace.workspaceKey("other-owner", companyId)] = JSON.stringify({
    data: draft("Unrelated"),
    revision: null,
    dirty: true,
  });
  await h.fail(0);
  assert.equal(h.value().data.name, "Legacy original");
  assert.equal(h.value().recoveryAvailable, false);
  assert.match(h.status(), /Somente nesta aba/);
  assert.equal(Object.keys(browser).length, 0);
  assert.ok(h.values[workspace.workspaceKey("other-owner", companyId)]);
});

test("an approved legacy tab remains authoritative when a new tab already saved an empty recovery", async (t) => {
  const browser: Record<string, string> = {};
  const emptyTab = harness(t, { browser });
  await emptyTab.fail(0);
  const original = quickStart.demoSchema.parse({
    name: "Original approved brand",
    segment: "Fisioterapia",
    onboarded: true,
    answers: {
      offers: "Consulta individual",
      audience: "Pessoas da região",
      goals: "Receber mais agendamentos",
    },
    brand: {
      confirmed: true,
      detail: "Acompanhamento individual com a equipe.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });
  original.brand.creative = composeContent(original, "educate");
  original.brand.creative.approved = creativeFingerprint(original);
  original.brand.creative.exported = creativeFingerprint(original);
  assert.equal(workspace.journeyProgress(original).xp, 120);
  const originalTab = harness(t, {
    browser,
    cached: { data: original, revision: null, dirty: true },
  });
  assert.equal(
    workspace.journeyProgress(originalTab.value().data).xp,
    120,
    "restore precedes async account read",
  );
  assert.equal(originalTab.value().data.onboarded, true);
  assert.equal(originalTab.value().sync, "conflict");
  await originalTab.fail(0);
  originalTab.refreshModule(true);
  await originalTab.fail(1);
  assert.deepEqual(structuredClone(originalTab.value().data), structuredClone(original));
  assert.equal(workspace.journeyProgress(originalTab.value().data).completed, 5);
});

test("losing access to localStorage after an earlier logout still permits memory/session edits", async (t) => {
  const browser: Record<string, string> = {};
  const old = harness(t, { browser });
  old.clear();
  const current = harness(t, { browser });
  await current.fail(0);
  current.localFails(true);
  current.edit("Keep typing despite storage access failure");
  assert.equal(current.value().data.name, "Keep typing despite storage access failure");
  assert.equal(current.value().recoveryAvailable, false);
  assert.match(current.status(), /Somente nesta aba/);
});

test("a refreshed consumer still reads the mounted provider's memory-only draft", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.fail(0);
  h.edit("Unsaved memory-only work");
  const before = h.value();
  const { next } = h.refreshModule();
  assert.doesNotThrow(() => next.useMarketingWorkspace());
  assert.equal(next.useMarketingWorkspace(), before);
  assert.match(h.status(), /memória/);
});

test("repeated provider module refreshes retain context for existing consumers and keep edits", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.fail(0);
  h.edit("Keep this work");
  const { previous } = h.refreshModule();
  for (let iteration = 0; iteration < 3; iteration++) {
    h.refreshModule();
    h.render();
    assert.doesNotThrow(() => previous.useMarketingWorkspace());
    assert.equal(previous.useMarketingWorkspace().data.name, "Keep this work");
    assert.equal(previous.useMarketingWorkspace(), h.value());
    assert.deepEqual(
      Object.keys(h.values),
      [],
      "no storage exists to mask a remount or lost draft",
    );
  }
});

test("provider exports remain a valid Vite Fast Refresh boundary after module evaluation", (t) => {
  const h = harness(t);
  const { previous, next } = h.refreshModule();
  assert.equal(h.validateRefresh("marketing-provider.tsx", previous, next), undefined);
});

test("logout from a refreshed module still revokes the mounted save queue and pending responses", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(null));
  h.edit("Private draft");
  await h.advance();
  const { next } = h.refreshModule();
  next.clearMarketingWorkspace();
  h.render();
  assert.equal(h.hasWorkspace(), false);
  await h.reply(1, {}, 409);
  await h.advance();
  assert.equal(h.requests.length, 2, "revoked save must not fetch or persist after logout");
  assert.deepEqual(Object.keys(h.values), []);
});

test("refresh effect replay preserves a memory-only draft through repeated failed reconciliation", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.fail(0);
  h.edit("Only copy before refresh");
  const staleConsumer = h.refreshModule().previous.useMarketingWorkspace;
  for (let iteration = 0; iteration < 3; iteration++) {
    const before = h.value().data;
    h.refreshModule(true);
    assert.equal(staleConsumer().data, before, "refresh cannot replace the live draft with a seed");
    h.edit(`Latest edit ${iteration}`);
    await h.fail(iteration + 1);
    assert.equal(staleConsumer().data.name, `Latest edit ${iteration}`);
    assert.equal(h.value().sync, "local");
    assert.equal(h.value().storageAvailable, false);
    assert.deepEqual(Object.keys(h.values), []);
  }
  h.clear();
  assert.equal(h.hasWorkspace(), false, "replayed effects still register logout cleanup");
});

test("refresh effect replay retains a debounced draft and leaves only one save timer", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Pending edit");
  h.refreshModule(true);
  await h.reply(1, cloud(draft("Original")));
  await h.advance();
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests[2]!.body!.data.name, "Pending edit");
  assert.equal(h.requests[2]!.body!.expectedRevision, r1);
  await h.reply(2, cloud(draft("Pending edit"), r2));
  await h.advance(10_000);
  assert.equal(h.value().sync, "saved");
  assert.equal(h.requests.length, 3, "refresh must not duplicate the pending write");
});

test("refresh during a save keeps newer memory edits and requires explicit conflict recovery", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.reply(0, cloud(draft("Original")));
  h.edit("In-flight snapshot");
  await h.advance();
  h.edit("Newer unsaved edit");
  const oldConsumer = h.refreshModule(true).previous.useMarketingWorkspace;
  await h.reply(1, cloud(draft("In-flight snapshot"), r2));
  assert.equal(
    oldConsumer().data.name,
    "Newer unsaved edit",
    "obsolete acknowledgement cannot replace it",
  );
  await h.reply(2, cloud(draft("Other tab"), r3));
  assert.equal(h.value().sync, "conflict");
  h.refreshModule(true);
  await h.reply(3, cloud(draft("Other tab"), r3));
  await h.advance();
  assert.equal(oldConsumer().data.name, "Newer unsaved edit");
  assert.equal(h.value().sync, "conflict");
  assert.equal(h.requests.length, 4, "refresh must not silently resolve or overwrite a conflict");
  h.value().resolveConflict("local");
  h.render();
  await h.advance();
  assert.equal(h.requests[4]!.body!.data.name, "Newer unsaved edit");
  assert.equal(h.requests[4]!.body!.expectedRevision, r3);
  h.clear();
  await h.reply(4, {}, 409);
  assert.equal(h.hasWorkspace(), false);
  assert.equal(h.requests.length, 5, "logout still cancels post-refresh continuations");
  assert.deepEqual(Object.keys(h.values), []);
});

test("workspace setters retain earned XP on edits without retaining current content approval", async (t) => {
  for (const functional of [true, false]) {
    const data = quickStart.demoSchema.parse({
      name: "Movitta",
      segment: "Fisioterapia",
      onboarded: true,
      answers: {
        offers: "Programa de exercícios",
        audience: "Adultos",
        goals: "Atrair novos clientes",
      },
      brand: {
        confirmed: true,
        detail: "Acompanhamento individual com a equipe.",
        visualStyle: "essential",
        identityConfirmed: true,
      },
    });
    data.brand.creative = composeContent(data, "educate");
    data.brand.creative.approved = creativeFingerprint(data);
    data.brand.creative.exported = creativeFingerprint(data);
    const h = harness(t);
    await h.reply(0, cloud(data));
    assert.equal(workspace.journeyProgress(h.value().data).xp, 120);
    h.value().setData((current) => current);
    h.render();
    assert.equal(h.value().sync, "saved", "no-op setter must not dirty the workspace");
    const edit = (current: DemoData) => ({
      ...current,
      brand: {
        ...current.brand,
        creative: {
          ...current.brand.creative!,
          copy: { ...current.brand.creative!.copy, title: "Uma alteração que precisa de revisão" },
        },
      },
    });
    h.value().setData(functional ? edit : edit(h.value().data));
    h.render();
    const progress = workspace.journeyProgress(h.value().data);
    assert.equal(progress.xp, 120, "earned milestones survive the edit");
    assert.equal(progress.approved, false, "historical XP is not approval of new content");
    assert.equal(progress.exported, false);
    const restored = workspace.parseStoredWorkspace(
      h.values[workspace.workspaceKey(ownerId, companyId)]!,
    );
    assert.ok(restored);
    assert.equal(workspace.journeyProgress(restored.data).xp, 120);
    assert.equal(h.value().sync, "ready");
  }
});

test("save disclosure distinguishes checking, unsaved seed, queued edits and acknowledged saves", async (t) => {
  const h = harness(t);
  const label = () => text(findElement(h.statusTree(), "summary")).trim();
  assert.equal(label(), "Salvando");
  assert.equal(findElement(h.statusTree(), "summary")!.props["aria-label"], "Salvando");
  const disclosure = findElement(h.statusTree(), "details");
  assert.ok(disclosure, "the status must offer a native keyboard-accessible disclosure");
  assert.ok(!disclosure.props.open, "details are collapsed by default");
  const live = findElement(h.statusTree(), "span", (node) => node.props.role === "status");
  assert.ok(live, "status changes must be announced without including action buttons");
  assert.equal(live.props["aria-atomic"], true);
  await h.reply(0, cloud(null));
  assert.equal(label(), "Somente nesta aba", "an untouched seed has never been cloud-saved");
  h.edit("Queued");
  assert.equal(label(), "Salvando", "debounced edits must not claim they are already saved");
  await h.advance();
  assert.equal(label(), "Salvando");
  await h.reply(1, cloud(draft("Queued"), r1));
  assert.equal(h.statusTree(), null, "an acknowledged save shows no indicator");
  h.edit("Newer");
  assert.equal(label(), "Salvando");
});

test("retry stays inside the disclosure and rereads before resuming writes", async (t) => {
  const h = harness(t);
  await h.fail(0);
  h.edit("Preserve my draft");
  const tree = h.statusTree();
  assert.equal(text(findElement(tree, "summary")).trim(), "Somente nesta aba");
  const details = findElement(tree, "details");
  assert.ok(details);
  assert.equal(findElement(findElement(tree, "summary"), "button"), undefined);
  const retry = findElement(details, "button", (node) => /Tentar/.test(text(node)));
  assert.ok(retry);
  (retry.props.onClick as () => void)();
  h.render();
  assert.equal(h.requests[1]!.body, undefined);
  await h.reply(1, cloud(null));
  await h.advance();
  assert.equal(h.requests[2]!.body!.data.name, "Preserve my draft");
});

test("conflict actions stay inside the disclosure and preserve explicit version choice", async (t) => {
  for (const choice of ["cloud", "local"] as const) {
    const h = harness(t, { cached: { data: draft("My version"), revision: r1, dirty: true } });
    await h.reply(0, cloud(draft("Other version"), r2));
    const tree = h.statusTree();
    assert.equal(text(findElement(tree, "summary")).trim(), "Revisar conflito");
    const details = findElement(tree, "details");
    assert.ok(details);
    await h.advance();
    assert.equal(h.requests.length, 1, "disclosure cannot resolve the conflict implicitly");
    const action = findElement(details, "button", (node) =>
      text(node).includes(choice === "cloud" ? "Usar versão da conta" : "Manter minha versão"),
    );
    assert.ok(action);
    (action.props.onClick as () => void)();
    h.render();
    assert.equal(h.value().data.name, choice === "cloud" ? "Other version" : "My version");
    await h.advance();
    if (choice === "local") assert.equal(h.requests[1]!.body!.expectedRevision, r2);
    else assert.equal(h.requests.length, 1);
  }
});

test("memory-only loss warning remains visible outside collapsed details until cloud acknowledgement", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.reply(0, cloud(null));
  h.edit("Only copy");
  const tree = h.statusTree();
  const warning = findElement(tree, "p", (node) => node.props.role === "alert");
  assert.ok(warning);
  assert.match(text(warning), /memória/);
  assert.match(text(warning), /recarreg|fech/);
  assert.equal(
    findElement(findElement(tree, "details"), "p", (node) => node === warning),
    undefined,
  );
  await h.advance();
  await h.reply(1, cloud(draft("Only copy"), r1));
  assert.equal(h.statusTree(), null);
  assert.equal(
    findElement(h.statusTree(), "p", (node) => node.props.role === "alert"),
    undefined,
  );
  assert.match(h.status(), /Cópia nesta aba indisponível/);
});

test("safe response classifications explain recovery without exposing server messages or guessing a migration", async (t) => {
  const cases = [
    { status: 401, code: undefined, expected: /sessão não foi reconhecida/ },
    { status: 400, code: undefined, expected: /não aceitou os dados/ },
    { status: 403, code: undefined, expected: /acessar esta empresa/ },
    { status: 404, code: undefined, expected: /acessar esta empresa/ },
    { status: 413, code: undefined, expected: /limite de 5 MB/ },
    {
      status: 503,
      code: "WORKSPACE_UNAVAILABLE",
      expected: /salvamento na conta está indisponível/,
    },
    { status: 503, code: "UNKNOWN", expected: /Não foi possível sincronizar/ },
    { status: 500, code: "WORKSPACE_UNAVAILABLE", expected: /Não foi possível sincronizar/ },
  ];
  for (const { status, code, expected } of cases) {
    const h = harness(t);
    await h.reply(0, { code, message: "PRIVATE_SERVER_DETAIL", details: "SECRET" }, status);
    assert.equal(text(findElement(h.statusTree(), "summary")).trim(), "Somente nesta aba");
    assert.match(h.status(), expected);
    assert.doesNotMatch(h.status(), /PRIVATE_SERVER_DETAIL|SECRET|migração|42P01/);
    h.value().retrySync();
    h.render();
    await h.reply(1, cloud(draft("Recovered"), r1));
    assert.doesNotMatch(h.status(), expected, "successful retry clears the previous reason");
  }
});

test("save failures and timeouts expose safe reasons without losing queued edits", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Too large");
  await h.advance();
  await h.reply(1, { message: "PRIVATE_SERVER_DETAIL" }, 413);
  assert.match(h.status(), /limite de 5 MB/);
  assert.equal(h.value().data.name, "Too large");
  h.value().retrySync();
  h.render();
  await h.advance(20_000);
  assert.match(h.status(), /tempo de espera/);
  assert.equal(h.value().data.name, "Too large");
});

test("workspace without a company stays tab-only and offers no unusable retry", (t) => {
  const h = harness(t, { noCompany: true });
  assert.equal(text(findElement(h.statusTree(), "summary")).trim(), "Somente nesta aba");
  assert.equal(findElement(h.statusTree(), "button"), undefined);
  assert.equal(h.requests.length, 0);
});

test("empty cloud starts ready but never claims a seed is cloud-saved", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(null));
  assert.equal(h.value().sync, "ready");
  assert.doesNotMatch(h.status(), /Salvo na conta/);
  await h.advance();
  assert.equal(h.requests.length, 1);
});

test("edits immediately leave saved status, debounce and preserve events and whitespace", async (t) => {
  const data = draft("Saved");
  data.answers.offers = "  Original\n";
  data.events = [{ type: "started", at: "2026-09-24T12:00:00.000Z", fingerprint: "" }];
  const h = harness(t);
  await h.reply(0, cloud(data));
  assert.equal(h.value().sync, "saved");
  assert.equal(h.value().data.answers.offers, data.answers.offers);
  h.edit("First");
  h.edit("Last");
  assert.equal(h.value().sync, "ready");
  assert.doesNotMatch(h.status(), /Salvo na conta/);
  await h.advance(699);
  assert.equal(h.requests.length, 1);
  await h.advance(1);
  assert.equal(h.requests[1]!.body!.data.name, "Last");
  assert.equal(h.requests[1]!.body!.expectedRevision, r1);
  assert.deepEqual(h.requests[1]!.body!.data.events, data.events);
  assert.equal(h.requests[1]!.body!.data.answers.offers, data.answers.offers);
});

test("a slow initial GET cannot replace local edits, and exposes a new-revision conflict", async (t) => {
  const h = harness(t);
  h.edit("Local edit");
  await h.reply(0, cloud(draft("Other tab"), r2));
  assert.equal(h.value().data.name, "Local edit");
  assert.equal(h.value().sync, "conflict");
  await h.advance();
  assert.equal(h.requests.length, 1);
  h.value().resolveConflict("local");
  h.render();
  await h.advance();
  assert.equal(h.requests[1]!.body!.expectedRevision, r2);
  assert.equal(h.requests[1]!.body!.data.name, "Local edit");
});

test("dirty local state at the same revision resumes saving instead of conflicting", async (t) => {
  const h = harness(t, { cached: { data: draft("Unsaved"), revision: r1, dirty: true } });
  await h.reply(0, cloud(draft("Original")));
  assert.equal(h.value().data.name, "Unsaved");
  assert.equal(h.value().sync, "ready");
  await h.advance();
  assert.equal(h.requests[1]!.body!.expectedRevision, r1);
});

test("save acknowledgements retain newer edits and queue one save using the returned revision", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Snapshot");
  await h.advance();
  h.edit("Newer");
  await h.advance();
  assert.equal(h.requests.length, 2, "only one save may be in flight");
  await h.reply(1, cloud(draft("Snapshot"), r2));
  assert.equal(h.value().data.name, "Newer");
  assert.equal(h.value().sync, "ready");
  await h.advance();
  assert.equal(h.requests[2]!.body!.expectedRevision, r2);
  assert.equal(h.requests[2]!.body!.data.name, "Newer");
  await h.reply(2, cloud(draft("Newer"), r3));
  assert.equal(h.value().sync, "saved");
  assert.equal(JSON.parse(h.values[workspace.workspaceKey(ownerId, companyId)]!).dirty, false);
});

test("409 rereads cloud while preserving edits made during both pending requests", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Snapshot");
  await h.advance();
  await h.reply(1, {}, 409);
  h.edit("Latest");
  await h.reply(2, cloud(draft("External"), r2));
  assert.equal(h.value().data.name, "Latest");
  assert.equal(h.value().sync, "conflict");
  h.value().resolveConflict("cloud");
  h.render();
  assert.equal(h.value().data.name, "External");
  assert.equal(h.value().sync, "saved");
  await h.advance();
  assert.equal(h.requests.length, 3);
});

test("deleted cloud snapshot can be explicitly accepted or recreated with a null base", async (t) => {
  for (const choice of ["cloud", "local"] as const) {
    const h = harness(t, { cached: { data: draft("Cached"), revision: r1, dirty: true } });
    await h.reply(0, cloud(null));
    assert.equal(h.value().sync, "conflict");
    h.value().resolveConflict(choice);
    h.render();
    assert.equal(h.value().sync, "ready");
    await h.advance();
    if (choice === "cloud") {
      assert.equal(h.value().data.name, "Seed");
      assert.equal(h.requests.length, 1);
    } else assert.equal(h.requests[1]!.body!.expectedRevision, null);
  }
});

test("failed saves retry through GET and recover a committed-but-unacknowledged snapshot", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Saved before disconnect");
  await h.advance();
  await h.fail(1);
  assert.equal(h.value().sync, "local");
  assert.match(h.status(), /Tentar/);
  h.value().retrySync();
  h.render();
  assert.equal(h.requests[2]!.body, undefined, "retry must reconcile before writing");
  await h.reply(2, cloud(draft("Saved before disconnect"), r2));
  assert.equal(h.value().sync, "saved");
  await h.advance();
  assert.equal(h.requests.length, 3);
});

test("failed initial reads can retry without losing edits and resume the save queue", async (t) => {
  const h = harness(t);
  await h.reply(0, { code: "WORKSPACE_UNAVAILABLE" }, 503);
  h.edit("Offline work");
  await h.advance();
  assert.equal(h.requests.length, 1);
  h.value().retrySync();
  h.render();
  await h.reply(1, cloud(null));
  await h.advance();
  assert.equal(h.requests[2]!.body!.data.name, "Offline work");
  assert.equal(h.requests[2]!.body!.expectedRevision, null);
});

test("malformed GET or save envelopes cannot mark data saved or poison its revision", async (t) => {
  for (const invalid of [
    { data: draft("Bad"), revision: "bad", updatedAt: "bad" },
    cloud(null, r2),
    {},
  ]) {
    const h = harness(t);
    await h.reply(0, invalid);
    assert.equal(h.value().sync, "local");
    assert.equal(h.value().data.name, "Seed");
  }
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Keep me");
  await h.advance();
  await h.reply(1, { revision: r2 });
  assert.equal(h.value().sync, "local");
  assert.equal(h.value().data.name, "Keep me");
  assert.equal(JSON.parse(h.values[workspace.workspaceKey(ownerId, companyId)]!).revision, r1);
});

test("failed or malformed 409 reads cannot offer a destructive conflict resolution", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Keep me");
  await h.advance();
  await h.reply(1, {}, 409);
  await h.reply(2, { data: null, revision: r2, updatedAt: null });
  assert.equal(h.value().sync, "local");
  h.value().resolveConflict("local");
  h.render();
  await h.advance();
  assert.equal(h.requests.length, 3);
  assert.equal(h.value().data.name, "Keep me");
});

test("a stalled request times out; a late result cannot overwrite a retried read", async (t) => {
  const h = harness(t);
  h.edit("Local");
  await h.advance(30_000);
  assert.equal(h.value().sync, "local");
  h.value().retrySync();
  h.render();
  await h.reply(1, cloud(null));
  await h.reply(0, cloud(draft("Late"), r3));
  assert.equal(h.value().data.name, "Local");
  assert.equal(h.value().sync, "ready");
});

test("quota failure preserves memory, permits cloud saving and reports cloud success truthfully", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.reply(0, cloud(null));
  h.edit("Memory only");
  assert.equal(h.value().storageAvailable, false);
  assert.match(h.status(), /memória/);
  await h.advance();
  await h.reply(1, cloud(draft("Memory only"), r1));
  assert.equal(h.value().sync, "saved");
  assert.equal(h.status(), "");
  h.storageFails(false);
  h.edit("Backup recovered");
  assert.equal(h.value().storageAvailable, true);
});

test("owner/company switches isolate drafts and ignore old request completions", async (t) => {
  const h = harness(t);
  h.edit("Private A");
  h.switchTo("owner-b", {
    ...company,
    id: "00000000-0000-4000-8000-000000000002",
    owner_id: "owner-b",
    name: "B",
  });
  assert.equal(h.value().data.name, "B");
  await h.reply(0, cloud(draft("Private cloud A")));
  assert.equal(h.value().data.name, "B");
  await h.reply(1, cloud(null));
  h.edit("Private B");
  await h.advance();
  assert.equal(h.requests[2]!.body!.companyId, "00000000-0000-4000-8000-000000000002");
  assert.equal(
    JSON.parse(h.values[workspace.workspaceKey(ownerId, companyId)]!).data.name,
    "Private A",
  );
  assert.equal(h.lateUpdates(), 0);
});

test("a cached company belonging to another owner is never exposed or fetched", (t) => {
  const h = harness(t, { noCompany: true });
  h.switchTo("owner-b", company);
  assert.equal(h.hasWorkspace(), false);
  assert.equal(h.requests.length, 0);
});

test("logout synchronously cancels queued saves and prevents cache resurrection", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(null));
  h.edit("Private");
  const oldSetter = h.value().setData;
  h.clear();
  oldSetter(draft("Late child edit"));
  h.render();
  await h.advance();
  assert.equal(h.hasWorkspace(), false);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(Object.keys(h.values), []);
});

test("logout during a save ignores its 409 without starting a follow-up GET", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(null));
  h.edit("Private");
  await h.advance();
  h.clear();
  await h.reply(1, {}, 409);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(Object.keys(h.values), []);
  assert.equal(h.hasWorkspace(), false);
});

test("unmount during a save ignores success and conflict responses", async (t) => {
  for (const status of [200, 409]) {
    const h = harness(t);
    await h.reply(0, cloud(null));
    h.edit("Snapshot");
    await h.advance();
    h.unmount();
    await h.reply(1, cloud(draft("Snapshot")), status);
    assert.equal(h.lateUpdates(), 0);
    assert.equal(h.requests.length, 2);
  }
});

test("effect replay discards obsolete GET results and keeps one save queue", async (t) => {
  const h = harness(t);
  h.replay();
  assert.equal(h.requests.length, 2);
  h.edit("Local");
  await h.reply(1, cloud(null));
  await h.reply(0, cloud(draft("Obsolete")));
  assert.equal(h.value().data.name, "Local");
  await h.advance();
  assert.equal(h.requests.length, 3);
});

test("company refetch errors retain a mounted draft even when browser storage is unavailable", async (t) => {
  const h = harness(t, { storageFails: true });
  await h.reply(0, cloud(null));
  h.edit("Only in memory");
  h.companyFails();
  assert.equal(h.hasWorkspace(), true);
  assert.equal(h.value().data.name, "Only in memory");
});

test("a 409 followed by the same base revision does not spin in an automatic save loop", async (t) => {
  const h = harness(t);
  await h.reply(0, cloud(draft("Original")));
  h.edit("Local");
  await h.advance();
  await h.reply(1, {}, 409);
  await h.reply(2, cloud(draft("Original")));
  assert.equal(h.value().sync, "conflict");
  await h.advance(10_000);
  assert.equal(h.requests.length, 3);
});

test("interrupted research is recovered from both cloud and session storage without losing content", async (t) => {
  const data = draft("Interrupted");
  data.answers.offers = "  Keep whitespace\n";
  data.brand.research.status = "loading";
  for (const cached of [undefined, { data, revision: r1, dirty: false }]) {
    const h = harness(t, cached ? { cached } : {});
    await h.reply(0, cloud(data));
    assert.equal(h.value().data.brand.research.status, "unavailable");
    assert.equal(h.value().data.answers.offers, data.answers.offers);
    assert.equal(h.value().sync, "ready");
    await h.advance();
    assert.equal(h.requests[1]!.body!.expectedRevision, r1);
    assert.equal(h.requests[1]!.body!.data.brand.research.status, "unavailable");
  }
});

test("effect replay after logout cannot recreate even an empty session cache", async (t) => {
  const h = harness(t);
  h.clear();
  h.replay();
  await h.reply(0, cloud(draft("Private")));
  assert.deepEqual(Object.keys(h.values), []);
  assert.equal(h.hasWorkspace(), false);
  assert.equal(h.requests.length, 1);
});

const onboardingCompiled = ts.transpileModule(
  readFileSync(new URL("../src/components/account-onboarding.tsx", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function findElement(
  node: unknown,
  type: string,
  predicate: (node: Element) => boolean = () => true,
): Element | undefined {
  if (Array.isArray(node))
    return node.map((child) => findElement(child, type, predicate)).find(Boolean);
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as Element;
  return element.type === type && predicate(element)
    ? element
    : findElement(element.props.children, type, predicate);
}

function onboardingHarness(
  t: TestContext,
  options: {
    sync?: string;
    company?: boolean;
    storageFails?: boolean;
    replay?: boolean;
    holdInvalidation?: boolean;
    onboarded?: boolean;
  } = {},
) {
  const hooks = driver();
  let mounted = true;
  let tree: Element | null = null;
  let storageFails = options.storageFails ?? false;
  const values: Record<string, string> = {};
  const edits: DemoData[] = [];
  const navigations: unknown[] = [];
  const invalidations: unknown[] = [];
  const resolutions: string[] = [];
  let retries = 0;
  const listeners = new Set<(event: string, session: { user: { id: string } } | null) => void>();
  const companyRequests: {
    operation: string;
    values: unknown;
    filters: [string, unknown][];
    resolve: (result: unknown) => void;
  }[] = [];
  const apiRequests: {
    body: { companyId: string; data: DemoData; expectedRevision: string | null };
    resolve: (response: Pick<Response, "ok" | "status" | "json">) => void;
  }[] = [];
  const transitionTimers = new Map<number, () => void>();
  let transitionTimerId = 0;
  let finishInvalidation: (() => void) | undefined;
  const value = {
    data: { ...draft("Onboarding draft"), onboarded: options.onboarded ?? false },
    company: options.company ? company : null,
    ownerId,
    sync: options.sync ?? (options.company ? "ready" : "local"),
    storageAvailable: !options.storageFails,
    retrySync() {
      retries++;
      value.sync = "loading";
    },
    resolveConflict(choice: string) {
      resolutions.push(choice);
      value.sync = "ready";
    },
    setData(next: DemoData | ((current: DemoData) => DemoData)) {
      value.data = typeof next === "function" ? next(value.data) : next;
      edits.push(structuredClone(value.data));
    },
  };
  const navigate = (to: unknown) => {
    navigations.push(structuredClone(to));
    return Promise.resolve();
  };
  const queryClient = {
    invalidateQueries: (query: unknown) => {
      invalidations.push(query);
      return options.holdInvalidation
        ? new Promise<void>((resolve) => {
            finishInvalidation = resolve;
          })
        : Promise.resolve();
    },
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      ...hooks.react,
      createContext: () => ({ Provider: "provider" }),
      useContext: () => value,
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    zod,
    "./brand-loading": { BrandLoading: "brand-loading" },
    "./workspace-skeleton": { WorkspaceSkeleton: "workspace-skeleton" },
    "@tanstack/react-router": { useNavigate: () => navigate },
    "@tanstack/react-query": { useQueryClient: () => queryClient },
    "./brand-onboarding": { BrandOnboarding: "brand-onboarding" },
    "./quick-start-flow": { OnboardingMark: "onboarding-mark" },
    "./marketing-provider": { useMarketingWorkspace: () => value },
    "@/lib/marketing-workspace": workspace,
    "@/lib/quick-start": quickStart,
    "@/lib/company": {},
    "@/demo.css": {},
    "@/workspace.css": {},
    "./workspace-save-status.css": {},
    "@/lib/onboarding": onboarding,
    "@/lib/use-brand-research": { useBrandResearch: () => ({ research() {}, cancel() {} }) },
    "@/lib/api": {
      apiFetch: (path: string, body: unknown) => {
        assert.equal(path, "/api/marketing-workspace");
        return new Promise((resolve) => {
          apiRequests.push({
            body: structuredClone(body) as (typeof apiRequests)[number]["body"],
            resolve,
          });
        });
      },
    },
    "@/integrations/supabase/client": {
      supabase: {
        auth: {
          onAuthStateChange: (
            callback: (event: string, session: { user: { id: string } } | null) => void,
          ) => {
            listeners.add(callback);
            return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
          },
        },
        from(table: string) {
          assert.equal(table, "companies");
          let operation = "";
          let input: unknown;
          const filters: [string, unknown][] = [];
          const chain = {
            insert(data: unknown) {
              operation = "insert";
              input = structuredClone(data);
              return chain;
            },
            update(data: unknown) {
              operation = "update";
              input = structuredClone(data);
              return chain;
            },
            eq(key: string, val: unknown) {
              filters.push([key, val]);
              return chain;
            },
            select: () => chain,
            single: () =>
              new Promise((resolve) => {
                companyRequests.push({ operation, values: input, filters, resolve });
              }),
          };
          return chain;
        },
      },
    },
  };
  const statusExports: Record<string, unknown> = {};
  const requireModule = (name: string) => {
    if (name === "./marketing-context") return loadContextModule(modules);
    assert.ok(name in modules, `Unexpected dependency ${name}`);
    return modules[name];
  };
  runInNewContext(compiled, { exports: statusExports, require: requireModule });
  const WorkspaceSaveStatus = statusExports.WorkspaceSaveStatus as () => Element;
  modules["./marketing-provider"] = { useMarketingWorkspace: () => value, WorkspaceSaveStatus };
  const exports: Record<string, unknown> = {};
  runInNewContext(onboardingCompiled, {
    exports,
    console,
    window: {
      matchMedia: () => ({ matches: false }),
      setTimeout: (callback: () => void) => {
        const id = ++transitionTimerId;
        transitionTimers.set(id, callback);
        return id;
      },
      clearTimeout: (id: number) => transitionTimers.delete(id),
      sessionStorage: {
        setItem(key: string, raw: string) {
          if (storageFails) throw new Error("Storage unavailable");
          values[key] = raw;
        },
        getItem: (key: string) => values[key] ?? null,
      },
    },
    require: requireModule,
  });
  const { AccountOnboarding } = exports as {
    AccountOnboarding: (props: { replay: boolean }) => Element;
  };
  const render = () => {
    if (mounted) tree = hooks.render();
  };
  async function settle() {
    for (let i = 0; i < 5; i++) {
      await tick();
      render();
    }
  }
  function renderStatus(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(renderStatus);
    if (!node || typeof node !== "object" || !("props" in node)) return node;
    const element = node as Element;
    if (element.type === WorkspaceSaveStatus) return WorkspaceSaveStatus();
    return {
      ...element,
      props: { ...element.props, children: renderStatus(element.props.children) },
    };
  }
  tree = hooks.mount(
    () => renderStatus(AccountOnboarding({ replay: options.replay ?? false })) as Element,
  );
  t.after(() => {
    if (mounted) hooks.unmount();
    mounted = false;
  });
  return {
    value,
    edits,
    values,
    navigations,
    invalidations,
    companyRequests,
    apiRequests,
    settle,
    render,
    status: () => text(tree),
    isBrandLoading: () => Boolean(findElement(tree, "brand-loading")),
    finishTransition() {
      const pending = [...transitionTimers.values()];
      transitionTimers.clear();
      pending.forEach((run) => run());
      render();
    },
    resolutions,
    retries: () => retries,
    canEdit: () => Boolean(findElement(tree, "brand-onboarding")?.props.onData),
    click(label: string) {
      const button = findElement(tree, "button", (node) => text(node) === label);
      assert.ok(button, `onboarding must expose ${label}`);
      (button.props.onClick as () => void)();
      render();
    },
    complete(twice = false) {
      const child = findElement(tree, "brand-onboarding");
      assert.ok(child);
      const completed = { ...value.data, onboarded: true };
      // BrandOnboarding calls onData and onComplete in the same submit event.
      (child.props.onData as (data: DemoData) => void)(completed);
      const finish = child.props.onComplete as (data: DemoData) => void;
      finish(completed);
      if (twice) finish(completed);
      render();
    },
    async companyReply(index = 0, error = false) {
      assert.ok(companyRequests[index]);
      companyRequests[index]!.resolve(
        error
          ? { data: null, error: { message: "Failed" } }
          : { data: { id: companyId }, error: null },
      );
      await settle();
    },
    async apiReply(index = 0, status = 200, body?: unknown) {
      assert.ok(apiRequests[index]);
      apiRequests[index]!.resolve(
        Response.json(body ?? cloud(apiRequests[index]!.body.data), { status }),
      );
      await settle();
    },
    storageFails: (fails: boolean) => {
      storageFails = fails;
    },
    auth(event = "SIGNED_OUT", id?: string) {
      for (const callback of listeners) callback(event, id ? { user: { id } } : null);
      for (const key of Object.keys(values)) delete values[key];
      render();
    },
    async invalidateReply() {
      finishInvalidation?.();
      await settle();
    },
    unmount() {
      hooks.unmount();
      mounted = false;
    },
    lateUpdates: () => hooks.lateUpdates,
  };
}

test("onboarding waits for cloud readiness before recording started or redirecting a returning account", async (t) => {
  const h = onboardingHarness(t, { company: true, sync: "loading" });
  assert.equal(h.edits.length, 0, "initial analytics must not dirty the loading seed");
  h.value.data = { ...draft("Returning account"), onboarded: true };
  h.value.sync = "saved";
  await h.settle();
  assert.equal(h.edits.length, 0);
  assert.equal(h.canEdit(), false, "returning accounts must never flash profile questions");
  assert.equal(h.isBrandLoading(), true);
  assert.equal(h.navigations.length, 0, "keep the centered logo before entering the dashboard");
  h.finishTransition();
  assert.deepEqual(h.navigations, [{ to: "/painel", replace: true }]);
});

test("onboarding waits out conflicts and records entry only once when ready, including replay", async (t) => {
  const h = onboardingHarness(t, { company: true, sync: "conflict", replay: true });
  assert.equal(h.edits.length, 0);
  h.value.data = { ...draft("Replay"), onboarded: true };
  h.value.sync = "saved";
  await h.settle();
  h.value.sync = "saving";
  await h.settle();
  h.value.sync = "saved";
  await h.settle();
  assert.equal(h.value.data.events.filter((event) => event.type === "started").length, 1);
  assert.equal(h.navigations.length, 0);
});

test("new company draft is durable under its company key before the workspace POST resolves", async (t) => {
  const h = onboardingHarness(t);
  h.value.data.answers.offers = "  Preserve this offer\n";
  h.complete();
  await h.companyReply();
  const raw = h.values[workspace.workspaceKey(ownerId, companyId)];
  assert.ok(raw, "reload must recover the newly created company's in-flight draft");
  const saved = JSON.parse(raw);
  assert.equal(saved.data.onboarded, true);
  assert.equal(saved.data.answers.offers, "  Preserve this offer\n");
  assert.equal(saved.data.events[0].type, "started");
  assert.equal(saved.dirty, true);
  assert.equal(saved.revision, null);
  assert.equal(h.apiRequests.length, 1);
  assert.equal(h.navigations.length, 0);
});

test("cloud acknowledgement completes onboarding despite blocked browser storage", async (t) => {
  const h = onboardingHarness(t, { storageFails: true });
  h.complete();
  await h.companyReply();
  await h.apiReply();
  assert.equal(h.invalidations.length, 1);
  assert.deepEqual(h.navigations, [{ to: "/painel" }]);
  assert.doesNotMatch(h.status(), /não conseguiu guardar/);
});

test("missing migration hands off a dirty draft that the real provider restores after remount", async (t) => {
  const h = onboardingHarness(t);
  h.value.data.answers.offers = "  Offline offer\n";
  h.complete();
  await h.companyReply();
  await h.apiReply(0, 503, { code: "WORKSPACE_UNAVAILABLE" });
  assert.equal(h.invalidations.length, 1);
  assert.equal(h.navigations.length, 1);
  const cached = JSON.parse(h.values[workspace.workspaceKey(ownerId, companyId)]!);
  assert.equal(cached.dirty, true);
  assert.equal(cached.revision, null);
  h.unmount();
  const restored = harness(t, { cached });
  await restored.reply(0, { code: "WORKSPACE_UNAVAILABLE" }, 503);
  assert.equal(restored.value().data.onboarded, true);
  assert.equal(restored.value().data.answers.offers, "  Offline offer\n");
  assert.equal(restored.value().data.events[0]!.type, "started");
  assert.equal(restored.value().sync, "local");
});

test("failure of both stores keeps the editor in memory and retry reuses the created company", async (t) => {
  const h = onboardingHarness(t, { storageFails: true });
  h.complete();
  await h.companyReply();
  await h.apiReply(0, 503, { code: "WORKSPACE_UNAVAILABLE" });
  assert.equal(h.navigations.length, 0);
  assert.equal(h.invalidations.length, 0);
  assert.match(h.status(), /Mantenha esta página aberta/);
  assert.equal(h.value.data.onboarded, true);
  h.storageFails(false);
  h.complete();
  assert.equal(h.companyRequests[1]!.operation, "update");
  assert.ok(
    h.companyRequests[1]!.filters.some(([column, value]) => column === "id" && value === companyId),
  );
  await h.companyReply(1);
  await h.apiReply(1, 503, { code: "WORKSPACE_UNAVAILABLE" });
  assert.equal(h.navigations.length, 1);
  assert.equal(JSON.parse(h.values[workspace.workspaceKey(ownerId, companyId)]!).dirty, true);
});

test("duplicate completion in one render starts only one company mutation", async (t) => {
  const h = onboardingHarness(t);
  h.complete(true);
  assert.equal(h.companyRequests.length, 1);
  await h.companyReply(0, true);
  assert.equal(h.navigations.length, 0);
  h.complete();
  assert.equal(h.companyRequests.length, 2, "failure releases the synchronous lock");
});

test("logout or account switch during company creation cannot start a workspace save", async (t) => {
  for (const [event, id] of [
    ["SIGNED_OUT", undefined],
    ["SIGNED_IN", "owner-b"],
    ["INITIAL_SESSION", undefined],
  ] as const) {
    const h = onboardingHarness(t);
    h.complete();
    h.auth(event, id);
    await h.companyReply();
    assert.equal(h.apiRequests.length, 0);
    assert.equal(h.invalidations.length, 0);
    assert.equal(h.navigations.length, 0);
    assert.deepEqual(Object.keys(h.values), []);
  }
});

test("logout during workspace save cannot recreate cleared storage or navigate", async (t) => {
  const h = onboardingHarness(t);
  h.complete();
  await h.companyReply();
  h.auth();
  await h.apiReply();
  assert.deepEqual(Object.keys(h.values), []);
  assert.equal(h.navigations.length, 0);
  assert.equal(h.invalidations.length, 0);
});

test("unmount during either write cancels all remaining continuations", async (t) => {
  for (const phase of ["company", "workspace"] as const) {
    const h = onboardingHarness(t);
    h.complete();
    if (phase === "workspace") await h.companyReply();
    h.unmount();
    if (phase === "company") await h.companyReply();
    else await h.apiReply();
    assert.equal(h.apiRequests.length, phase === "company" ? 0 : 1);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.invalidations.length, 0);
    assert.equal(h.lateUpdates(), 0);
  }
});

test("logout during response JSON parsing or query invalidation suppresses later side effects", async (t) => {
  const h = onboardingHarness(t);
  h.complete();
  await h.companyReply();
  let resolveJson!: (body: unknown) => void;
  h.apiRequests[0]!.resolve({
    ok: true,
    status: 200,
    json: () =>
      new Promise((resolve) => {
        resolveJson = resolve;
      }),
  });
  await h.settle();
  h.auth();
  resolveJson(cloud(h.apiRequests[0]!.body.data));
  await h.settle();
  assert.deepEqual(Object.keys(h.values), []);
  assert.equal(h.invalidations.length, 0);
  const pending = onboardingHarness(t, { holdInvalidation: true });
  pending.complete();
  await pending.companyReply();
  await pending.apiReply();
  assert.equal(pending.invalidations.length, 1);
  assert.equal(pending.navigations.length, 0);
  pending.auth();
  await pending.invalidateReply();
  assert.equal(pending.navigations.length, 0);
});

test("malformed cloud acknowledgement cannot discard a memory-only draft", async (t) => {
  const h = onboardingHarness(t, { storageFails: true });
  h.complete();
  await h.companyReply();
  await h.apiReply(0, 200, { revision: r1 });
  assert.equal(h.invalidations.length, 0);
  assert.equal(h.navigations.length, 0);
  assert.match(h.status(), /Mantenha esta página aberta/);
});

test("same-owner auth refresh does not cancel an active completion", async (t) => {
  const h = onboardingHarness(t);
  h.complete();
  h.auth("TOKEN_REFRESHED", ownerId);
  await h.companyReply();
  await h.apiReply();
  assert.equal(h.navigations.length, 1);
  assert.equal(JSON.parse(h.values[workspace.workspaceKey(ownerId, companyId)]!).revision, r1);
});

test("an onboarded local draft without a company remains in company onboarding", async (t) => {
  const h = onboardingHarness(t, { onboarded: true });
  await h.settle();
  assert.equal(h.navigations.length, 0);
  h.complete();
  assert.equal(h.companyRequests[0]!.operation, "insert");
});

test("fullscreen onboarding resolves conflicts without showing save-status clutter", (t) => {
  const conflict = onboardingHarness(t, { company: true, sync: "conflict" });
  assert.equal(
    conflict.canEdit(),
    false,
    "conflict must remove editable inputs, not only disable submit",
  );
  assert.equal(conflict.companyRequests.length, 0);
  conflict.click("Usar versão da conta");
  assert.deepEqual(conflict.resolutions, ["cloud"]);
  assert.equal(conflict.canEdit(), true);
  conflict.value.sync = "conflict";
  conflict.render();
  conflict.click("Manter minha versão desta aba");
  assert.deepEqual(conflict.resolutions, ["cloud", "local"]);
  const offline = onboardingHarness(t, { company: true, sync: "local" });
  assert.equal(offline.canEdit(), true);
  assert.doesNotMatch(offline.status(), /Somente nesta aba|Tentar sincronizar novamente/);
  assert.equal(offline.retries(), 0);
});

test("company insert and update use the canonical answer website, including explicit clearing", (t) => {
  for (const existing of [false, true]) {
    for (const website of ["https://canonical.example", ""]) {
      const h = onboardingHarness(t, { company: existing });
      h.value.data.answers.website = website;
      h.value.data.brand.referenceUrl = "https://legacy-mismatch.example";
      h.complete();
      const request = h.companyRequests[0]!;
      assert.equal(request.operation, existing ? "update" : "insert");
      assert.equal(
        (request.values as { website: string | null }).website,
        website ? onboarding.normalizeWebsite(website) : null,
      );
    }
  }
});

test("initial cloud loading exposes no form edits and restores the form when ready", async (t) => {
  const h = onboardingHarness(t, { company: true, sync: "loading" });
  assert.equal(h.canEdit(), false);
  assert.equal(h.edits.length, 0);
  assert.equal(h.isBrandLoading(), true);
  assert.doesNotMatch(h.status(), /Salvando|Somente nesta aba/);
  h.value.sync = "ready";
  await h.settle();
  assert.equal(h.canEdit(), true);
});

test("returning-account transition cannot navigate after logout or an account change", async (t) => {
  for (const event of ["SIGNED_OUT", "SIGNED_IN"]) {
    const h = onboardingHarness(t, { company: true, onboarded: true });
    await h.settle();
    assert.equal(h.isBrandLoading(), true);
    h.auth(event, event === "SIGNED_IN" ? "another-owner" : undefined);
    h.finishTransition();
    assert.equal(h.navigations.length, 0);
  }
});

test("a conflict interrupts the returning-account transition without discarding either version", async (t) => {
  const h = onboardingHarness(t, { company: true, onboarded: true });
  await h.settle();
  h.value.sync = "conflict";
  h.render();
  h.finishTransition();
  assert.equal(h.navigations.length, 0);
  assert.equal(h.isBrandLoading(), false);
  assert.match(h.status(), /As duas versões foram preservadas/);
  h.click("Usar versão da conta");
  await h.settle();
  assert.equal(h.isBrandLoading(), true);
  h.finishTransition();
  assert.equal(h.navigations.length, 1);
});

test("explicit onboarding replay keeps the questions for a configured account", async (t) => {
  const h = onboardingHarness(t, { company: true, onboarded: true, replay: true });
  await h.settle();
  h.finishTransition();
  assert.equal(h.canEdit(), true);
  assert.equal(h.isBrandLoading(), false);
  assert.equal(h.navigations.length, 0);
});
