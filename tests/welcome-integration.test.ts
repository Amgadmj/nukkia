import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { QueryClient, QueryObserver, type QueryObserverOptions } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import * as zod from "zod";
import * as onboarding from "../src/lib/onboarding.ts";

type Element = { type: unknown; props: Record<string, unknown> };
type Component = () => Element | null;
type Cell = {
  value?: unknown;
  deps?: readonly unknown[] | undefined;
  cleanup?: (() => void) | undefined;
};
type Session = { user: { id: string }; access_token: string };
type AuthListener = (event: string, session: Session | null) => void;
type Navigation = { to?: string; search?: Record<string, unknown>; replace?: boolean };
type RouteModule = { Route: { options: { component: Component } } };
type DraftModule = { draftKey: (ownerId: string, companyId: string) => string };
type WizardModule = { DiagnosticWizard: (props: Record<string, unknown>) => Element };
type ProviderModule = {
  MarketingProvider: (props: { ownerId: string; children: Element | null }) => Element;
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

// The project has no DOM/test renderer. Execute the real component bodies with
// a deterministic hook/effect driver, including dependency checks, cleanup,
// functional updates and external-store notifications. This does not test DOM
// layout or React scheduling; it tests the production effects and handlers.
function hookDriver() {
  const cells: Cell[] = [];
  let cursor = 0;
  let changed = false;
  let effects: (() => void)[] = [];
  let component: Component;
  let tree: Element | null;
  const same = (a?: readonly unknown[], b?: readonly unknown[]) =>
    Boolean(a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i])));
  const react = {
    createContext<T>(value: T) {
      return { Provider: "context-provider", value };
    },
    useContext<T>(context: { value: T }) {
      return context.value;
    },
    useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
      const index = cursor++;
      if (!cells[index])
        cells[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial };
      const cell = cells[index]!;
      return [
        cell.value as T,
        (value) => {
          const next =
            typeof value === "function" ? (value as (previous: T) => T)(cell.value as T) : value;
          if (!Object.is(next, cell.value)) {
            cell.value = next;
            changed = true;
          }
        },
      ];
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      return (cells[index] ??= { value: { current: initial } }).value as { current: T };
    },
    useMemo<T>(factory: () => T, deps?: readonly unknown[]): T {
      const index = cursor++;
      if (!cells[index] || !same(cells[index]!.deps, deps)) {
        cells[index] = { value: factory(), deps };
      }
      return cells[index]!.value as T;
    },
    useCallback<T>(callback: T, deps?: readonly unknown[]) {
      return react.useMemo(() => callback, deps);
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = cursor++;
      const cell = (cells[index] ??= {});
      if (!same(cell.deps, deps)) {
        cell.deps = deps;
        effects.push(() => {
          cell.cleanup?.();
          cell.cleanup = effect() || undefined;
        });
      }
    },
    useSyncExternalStore<T>(subscribe: (callback: () => void) => () => void, read: () => T) {
      const ref = react.useRef({ read, value: read() });
      ref.current = { read, value: read() };
      react.useEffect(() => {
        const check = () => {
          if (!Object.is(ref.current.value, ref.current.read())) changed = true;
        };
        const unsubscribe = subscribe(check);
        check();
        return unsubscribe;
      }, [subscribe]);
      return ref.current.value;
    },
  };
  function render() {
    let passes = 0;
    do {
      assert.ok(++passes < 30, "component effects must settle without a render loop");
      cursor = 0;
      changed = false;
      effects = [];
      tree = component();
      for (const effect of effects) effect();
    } while (changed);
    return tree;
  }
  return {
    react,
    mount(subject: Component) {
      component = subject;
      return render();
    },
    render,
    get tree() {
      return tree;
    },
    async settle() {
      for (let i = 0; i < 4; i++) {
        await tick();
        render();
      }
    },
    unmount() {
      for (const cell of cells) cell.cleanup?.();
    },
  };
}

function find(node: unknown, predicate: (node: Element) => boolean): Element | undefined {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = find(child, predicate);
      if (result) return result;
    }
    return;
  }
  if (!("type" in node) || !("props" in node)) return;
  const element = node as Element;
  if (predicate(element)) return element;
  return find(element.props.children, predicate);
}

function harness(t: TestContext) {
  const hooks = hookDriver();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const events = new EventTarget();
  const storedValues: Record<string, string> = {};
  const storage = Object.defineProperties(storedValues, {
    getItem: { value: (key: string) => storedValues[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        storedValues[key] = value;
      },
    },
    removeItem: {
      value: (key: string) => {
        delete storedValues[key];
      },
    },
  }) as unknown as Pick<Storage, "getItem" | "setItem" | "removeItem">;
  const authListeners = new Set<AuthListener>();
  const navigations: Navigation[] = [];
  const user = { id: "owner" };
  const requests: { table: string; companyId: string | null }[] = [];
  let companyFails = false;
  let marketingClears = 0;
  const supabase = createClient("https://welcome-test.invalid", "test-only", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1)!;
        const companyId = url.searchParams.get("company_id");
        requests.push({ table, companyId });
        if (table === "companies" && companyFails) {
          // A non-retryable response keeps the SDK's own backoff out of this
          // test; recovery is explicitly driven by the page's retry button.
          return Response.json({ message: "Company read failure" }, { status: 400 });
        }
        if (table === "diagnostics" && companyId === "eq.undefined") {
          return Response.json(
            { code: "22P02", message: "Invalid company UUID: undefined" },
            { status: 400 },
          );
        }
        assert.ok(table === "companies" || table === "diagnostics", `Unexpected table: ${table}`);
        return Response.json([]);
      },
    },
  });
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({
      data: { session: { user, access_token: "test-only" } },
      error: null,
    }),
    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    },
  };
  const navigate = async (options: Navigation) => {
    navigations.push(options);
  };
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  const reactQuery = {
    useQueryClient: () => queryClient,
    useQuery(options: QueryObserverOptions) {
      // Real query functions and QueryObserver state, including manual refetch of
      // disabled queries. Only React's subscription glue is replaced.
      const observer = hooks.react.useMemo(
        () => new QueryObserver(queryClient, options),
        [JSON.stringify(options.queryKey)],
      );
      const subscribe = hooks.react.useMemo(() => observer.subscribe.bind(observer), [observer]);
      hooks.react.useEffect(() => {
        observer.setOptions(options);
      }, [observer, options.enabled]);
      return hooks.react.useSyncExternalStore(subscribe, () => observer.getCurrentResult());
    },
  };
  const modules: Record<string, unknown> = {
    react: hooks.react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@tanstack/react-query": reactQuery,
    "@tanstack/react-router": {
      createFileRoute: () => (options: unknown) => ({
        options,
        useSearch: () => ({}),
        useRouteContext: () => ({ user }),
      }),
      useNavigate: () => navigate,
      useRouterState: <T>({
        select,
      }: {
        select: (state: { location: { pathname: string } }) => T;
      }) => select({ location: { pathname: "/boas-vindas" } }),
      useRouter: () => ({ navigate, invalidate: async () => {} }),
      Outlet: "outlet",
      Link: "a",
      redirect: (options: unknown) => options,
    },
    "@/integrations/supabase/client": { supabase: { auth, from: supabase.from.bind(supabase) } },
    "@/lib/api": {
      apiFetch: () => {
        throw new Error("Unexpected API request");
      },
    },
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
    "@/components/app-shell": { AppShell: "app-shell" },
    // Layout tests exercise the authentication boundary, not its child provider.
    // Provider query behavior is exercised by loading its real module below.
    "@/components/marketing-provider": {
      MarketingProvider: "marketing-provider",
      clearMarketingWorkspace: () => {
        marketingClears++;
      },
    },
    "@/components/company-setup-form": { CompanySetupForm: "company-setup" },
    "lucide-react": new Proxy({}, { get: (_, name) => `icon-${String(name)}` }),
    sonner: { toast: { success() {}, info() {}, error() {} } },
    zod,
  };
  const loaded = new Map<string, Record<string, unknown>>();
  // The VM is a dynamic module boundary; callers declare the exports they use.
  function load<T extends object = Record<string, unknown>>(path: string): T {
    const url = new URL(path, new URL("../src/", import.meta.url));
    if (!/\.tsx?$/.test(url.pathname)) {
      url.pathname += existsSync(new URL(url.href + ".ts")) ? ".ts" : ".tsx";
    }
    if (loaded.has(url.href)) return loaded.get(url.href) as T;
    const exports = {};
    loaded.set(url.href, exports);
    const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    runInNewContext(compiled, {
      exports,
      require(name: string) {
        if (name in modules) return modules[name];
        if (name.endsWith(".css")) return {};
        if (name.startsWith("@/components/ui/"))
          return new Proxy({}, { get: (_, key) => String(key).toLowerCase() });
        if (name.startsWith("@/")) return load(name.slice(2));
        if (name.startsWith(".")) return load(new URL(name, url).href);
        throw new Error(`Unstubbed dependency: ${name}`);
      },
      window: {
        localStorage: storage,
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
        scrollTo() {},
      },
      Event,
      AbortSignal,
      Response,
      URL,
      console,
      requestAnimationFrame: (callback: () => void) => callback(),
      // Draft debounce is irrelevant here. Sync requests fail locally, with no
      // real timers or network; a server acknowledgement is injected below.
      setTimeout: () => 1,
      clearTimeout() {},
      fetch: async () => Response.json({ code: "schema-unavailable" }, { status: 503 }),
    });
    return exports as T;
  }
  t.after(() => {
    hooks.unmount();
    queryClient.clear();
  });
  return {
    hooks,
    load,
    queryClient,
    storage,
    requests,
    navigations,
    marketingClears: () => marketingClears,
    setCompanyFailure(value: boolean) {
      companyFails = value;
    },
    emitAuth(event: string, session: Session | null) {
      for (const callback of [...authListeners]) callback(event, session);
    },
    storageChanged() {
      events.dispatchEvent(new Event("storage"));
    },
  };
}

test("metadata-only draft acknowledgement preserves an explicit etapa in DiagnosticWizard", async (t) => {
  const h = harness(t);
  const draftApi = h.load<DraftModule>("lib/onboarding-draft.ts");
  const key = draftApi.draftKey("owner", "company");
  const content = {
    version: 1,
    answers: onboarding.normalizeAnswers({ offers: "Saved offer" }),
    step: 1,
  };
  h.storage.setItem(
    key,
    JSON.stringify({ ...content, updatedAt: 1, base: null, dirty: true, deleted: false }),
  );
  const { DiagnosticWizard } = h.load<WizardModule>("components/diagnostic-wizard.tsx");
  const chapter = () =>
    find(h.hooks.tree, (node) => node.props?.["aria-current"] === "step")?.props["aria-label"];
  h.hooks.mount(() =>
    DiagnosticWizard({
      company: { id: "company", owner_id: "owner", research: {} },
      previousAnswers: null,
      initialStep: 3,
      onComplete() {},
    }),
  );
  await h.hooks.settle();
  assert.equal(chapter(), "Etapa 4: A jornada de compra", "explicit etapa must win at mount");
  // Only acknowledgement metadata changes. The actual useDraft hook publishes
  // a new object because the serialized local record changed.
  h.storage.setItem(
    key,
    JSON.stringify({
      ...content,
      updatedAt: 1,
      dirty: false,
      deleted: false,
      base: { revision: "saved-1", draft: content, updatedAt: "2026-09-24T12:00:00Z" },
    }),
  );
  h.storageChanged();
  await h.hooks.settle();
  assert.equal(
    chapter(),
    "Etapa 4: A jornada de compra",
    "sync acknowledgement must not override explicit etapa=3",
  );
});

test("workspace diagnostic review ignores older onboarding drafts and returns edits to the workspace", async (t) => {
  const h = harness(t);
  const draftApi = h.load<DraftModule>("lib/onboarding-draft.ts");
  const key = draftApi.draftKey("owner", "company");
  h.storage.setItem(
    key,
    JSON.stringify({
      version: 1,
      answers: onboarding.normalizeAnswers({ offers: "Old onboarding offer" }),
      step: 1,
      updatedAt: 1,
      base: null,
      dirty: true,
      deleted: false,
    }),
  );
  const { DiagnosticWizard } = h.load<WizardModule>("components/diagnostic-wizard.tsx");
  let answers = onboarding.normalizeAnswers({ offers: "New workspace offer" });
  const onAnswersChange = (next: typeof answers) => {
    answers = next;
  };
  h.hooks.mount(() =>
    DiagnosticWizard({
      company: { id: "company", owner_id: "owner", research: {} },
      previousAnswers: answers,
      initialStep: 1,
      onComplete() {},
      onAnswersChange,
    }),
  );
  await h.hooks.settle();
  const offer = () => find(h.hooks.tree, (node) => node.props.id === "offers")!;
  assert.equal(offer().props.value, "New workspace offer");
  (offer().props.onChange as (event: unknown) => void)({
    target: { value: "Reviewed workspace offer" },
  });
  h.storageChanged();
  await h.hooks.settle();
  assert.equal(answers.offers, "Reviewed workspace offer");
  assert.equal(offer().props.value, "Reviewed workspace offer");
  assert.match(
    h.storage.getItem(key)!,
    /Old onboarding offer/,
    "the unrelated older draft is preserved, not overwritten",
  );
});

for (const { event, session, label } of [
  { event: "SIGNED_OUT", session: null, label: "SIGNED_OUT" },
  {
    event: "SIGNED_IN",
    session: { user: { id: "another-owner" }, access_token: "test-only" },
    label: "an account change",
  },
])
  test(`full-screen layout hides private content, clears state and redirects on ${label}`, async (t) => {
    const h = harness(t);
    const draftApi = h.load<DraftModule>("lib/onboarding-draft.ts");
    const key = draftApi.draftKey("owner", "company");
    h.storage.setItem(
      key,
      JSON.stringify({ version: 1, answers: { offers: "Private answer" }, step: 1 }),
    );
    h.queryClient.setQueryData(["company"], { id: "company", name: "Private company" });
    h.queryClient.setQueryData(["diagnostic", "company"], { report: "Private report" });
    const { Route } = h.load<RouteModule>("routes/_authenticated/route.tsx");
    h.hooks.mount(() => Route.options.component());
    assert.equal(
      find(h.hooks.tree, (node) => node.type === "app-shell"),
      undefined,
    );
    assert.ok(find(h.hooks.tree, (node) => node.type === "outlet"));
    assert.equal(
      find(h.hooks.tree, (node) => node.type === "marketing-provider")?.props.ownerId,
      "owner",
    );
    h.emitAuth("SIGNED_IN", { user: { id: "owner" }, access_token: "test-only" });
    h.hooks.render();
    assert.ok(
      find(h.hooks.tree, (node) => node.type === "outlet"),
      "same-account events must retain private content",
    );
    assert.equal(h.queryClient.getQueryCache().getAll().length, 2);
    assert.equal(h.marketingClears(), 0, "same-account events retain workspace state");
    h.emitAuth(event, session);
    h.hooks.render();
    assert.equal(
      find(h.hooks.tree, (node) => node.type === "outlet"),
      undefined,
      "private outlet must disappear before redirect navigation completes",
    );
    await h.hooks.settle();
    assert.equal(h.marketingClears(), 1, "logout/account switch must clear the workspace boundary");
    assert.deepEqual(
      {
        cachedQueries: h.queryClient.getQueryCache().getAll().length,
        draft: h.storage.getItem(key),
        destination: h.navigations.at(-1)?.to ?? null,
        mode: h.navigations.at(-1)?.search?.modo ?? null,
      },
      { cachedQueries: 0, draft: null, destination: "/auth", mode: "entrar" },
    );
  });

test("MarketingProvider company retry never fetches diagnostics without a company id", async (t) => {
  const h = harness(t);
  h.setCompanyFailure(true);
  const { MarketingProvider } = h.load<ProviderModule>("components/marketing-provider.tsx");
  h.hooks.mount(() =>
    MarketingProvider({ ownerId: "owner", children: { type: "welcome-child", props: {} } }),
  );
  await h.hooks.settle();
  assert.ok(find(h.hooks.tree, (node) => node.props?.role === "alert"));
  assert.equal(h.requests.filter((request) => request.table === "diagnostics").length, 0);
  const retry = find(
    h.hooks.tree,
    (node) => node.type === "button" && node.props.children === "Tentar novamente",
  );
  assert.ok(retry, "company-load failure must expose a retry action");
  assert.ok(typeof retry.props.onClick === "function");
  h.setCompanyFailure(false);
  await retry.props.onClick();
  await h.hooks.settle();
  assert.ok(
    h.requests.filter((request) => request.table === "companies").length >= 2,
    "retry must reread the company",
  );
  assert.deepEqual(
    h.requests.filter((request) => request.table === "diagnostics"),
    [],
    "retry must not force a disabled diagnostic query",
  );
  assert.equal(
    find(h.hooks.tree, (node) => node.props?.role === "alert"),
    undefined,
  );
  assert.ok(
    find(h.hooks.tree, (node) => node.props?.company === null),
    "new account must enter the welcome/setup experience",
  );
  assert.ok(find(h.hooks.tree, (node) => node.type === "welcome-child"));
});

test("MarketingProvider ignores cached disabled-diagnostic errors when the account has no company", async (t) => {
  const h = harness(t);
  await h.queryClient
    .fetchQuery({
      queryKey: ["diagnostic", undefined],
      queryFn: async () => {
        throw new Error("Old invalid company UUID: undefined");
      },
    })
    .catch(() => {});
  h.queryClient.setQueryData(["company"], null);
  const { MarketingProvider } = h.load<ProviderModule>("components/marketing-provider.tsx");
  h.hooks.mount(() =>
    MarketingProvider({ ownerId: "owner", children: { type: "welcome-child", props: {} } }),
  );
  await h.hooks.settle();
  assert.equal(
    h.queryClient.getQueryState(["diagnostic", undefined])?.status,
    "error",
    "fixture must retain the disabled-query error",
  );
  assert.equal(
    find(h.hooks.tree, (node) => node.props?.role === "alert"),
    undefined,
    "an irrelevant disabled-query error must not block company setup",
  );
  assert.ok(
    find(h.hooks.tree, (node) => node.props?.company === null),
    "new account must enter the welcome/setup experience",
  );
  assert.equal(h.requests.filter((request) => request.table === "diagnostics").length, 0);
  assert.ok(find(h.hooks.tree, (node) => node.type === "welcome-child"));
});
