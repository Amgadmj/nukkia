import * as art from "../src/lib/post-art.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as preview from "../src/lib/brand-preview.ts";
import * as story from "../src/lib/brand-story.ts";
import * as quick from "../src/lib/quick-start.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";
import * as research from "../src/lib/brand-research.ts";

// Values cross the VM boundary as untyped JSX props, hooks and module exports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuntimeValue = any;
type Element = { type: unknown; props: Record<string, RuntimeValue>; key?: string };
const node = (type: unknown, props: Element["props"], key?: string): Element => ({
  type,
  props,
  key,
});
const nodes = (value: RuntimeValue): Element[] =>
  Array.isArray(value)
    ? value.flatMap(nodes)
    : value?.props
      ? [value, ...nodes(value.props.children)]
      : [];
const text = (value: RuntimeValue): string =>
  Array.isArray(value)
    ? value.map(text).join("")
    : value?.props
      ? text(value.props.children)
      : typeof value === "string"
        ? value
        : "";
const visible = (value: RuntimeValue): Element[] =>
  Array.isArray(value)
    ? value.flatMap(visible)
    : value?.props
      ? [
          value,
          ...(value.type === "details" && !value.props.open
            ? visible(value.props.children?.find((x: Element) => x?.type === "summary"))
            : visible(value.props.children)),
        ]
      : [];

function mount({
  kit = {},
  unavailable = false,
  sync = "saved",
  fetchLogo,
  prepareImage,
  search = {},
}: {
  kit?: Record<string, RuntimeValue>;
  unavailable?: boolean;
  sync?: string;
  fetchLogo?: () => Promise<Response>;
  prepareImage?: (file: File) => Promise<string>;
  search?: Record<string, unknown>;
} = {}) {
  let data = quick.demoSchema.parse({
    name: "Aurora",
    segment: "Pilates",
    answers: { offers: "Aulas individuais", audience: "Adultos", goals: "Atrair clientes" },
    brand: {
      confirmed: true,
      visualStyle: "essential",
      accent: "#112233",
      logo: "data:image/png;base64,YQ==",
      photo: "data:image/png;base64,Yg==",
      detail: "Aulas com acompanhamento próximo.",
    },
  });
  data.brand.creative = {
    ...preview.composeContent(data, "educate"),
    approved: "approved-snapshot",
    exported: "approved-snapshot",
  };
  const original = data;
  const company = { id: "company-a", owner_id: "owner-a", name: "Aurora" };
  const brandKit = {
    company_id: company.id,
    logo_url: "https://assets.example/logo.png",
    palette: { nome: "Aurora", cores: ["#654321", "#FFEEDD"] },
    fonts: { preset: "playfair-inter" },
    tone: "Didático e sereno",
    options: null,
    selected_index: null,
    ...kit,
  };
  const writes: { table: string; value: Record<string, RuntimeValue> }[] = [];
  const navigations: Record<string, unknown>[] = [];
  let workspaceWrites = 0;
  let fetches = 0;
  const states = new Map<string, RuntimeValue[]>();
  let current = "";
  let cursor = 0;
  const slot = (initial: () => RuntimeValue) => {
    const values = states.get(current) ?? [];
    states.set(current, values);
    const index = cursor++;
    if (!(index in values)) values[index] = initial();
    return { values, index };
  };
  const cleanups: (() => void)[] = [];
  const react = {
    useState(initial: RuntimeValue) {
      const { values, index } = slot(() => (typeof initial === "function" ? initial() : initial));
      return [
        values[index],
        (next: RuntimeValue) => {
          values[index] = typeof next === "function" ? next(values[index]) : next;
        },
      ];
    },
    useRef(initial: RuntimeValue) {
      const { values, index } = slot(() => ({ current: initial }));
      return values[index];
    },
    useEffect(effect: () => RuntimeValue) {
      slot(() => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
        return true;
      });
    },
    useMemo: (fn: () => RuntimeValue) => fn(),
  };
  const ui = (names: string[]) =>
    Object.fromEntries(
      names.map((name) => [
        name,
        name === "Button"
          ? "button"
          : name === "Input"
            ? "input"
            : name === "Label"
              ? "label"
              : name,
      ]),
    );
  const modules: Record<string, RuntimeValue> = {
    react,
    "react/jsx-runtime": { jsx: node, jsxs: node },
    "@tanstack/react-router": {
      createFileRoute: () => (options: RuntimeValue) => ({
        ...options,
        useSearch: () => options.validateSearch?.(search) ?? {},
      }),
      useNavigate: () => (options: Record<string, unknown>) => navigations.push(options),
      Link: "a",
    },
    "@tanstack/react-query": {
      useQuery: () => ({ data: { story: null, unavailable }, isLoading: false, isError: false }),
      useQueryClient: () => ({ invalidateQueries() {}, setQueryData() {} }),
    },
    "@/lib/company": {
      useCompany: () => ({ data: company }),
      useBrandKit: () => ({ data: brandKit, isLoading: false, isError: false }),
      useDiagnostic: () => ({ data: null, isLoading: false, isError: false }),
    },
    "@/components/marketing-provider": {
      useMarketingWorkspace: () => ({
        ownerId: "owner-a",
        company,
        data,
        sync,
        setData: (update: RuntimeValue) => {
          workspaceWrites++;
          data = typeof update === "function" ? update(data) : update;
        },
      }),
      WorkspaceSaveStatus: "status",
    },
    "@/lib/onboarding": onboarding,
    "@/lib/marketing-workspace": workspace,
    "@/lib/brand-research": research,
    "@/components/inspiration-board": { InspirationBoard: "inspiration-board" },
    "./brand-onboarding": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "@/components/ui/button": ui(["Button"]),
    "@/components/ui/card": ui(["Card", "CardHeader", "CardContent", "CardDescription"]),
    "@/components/ui/input": ui(["Input"]),
    "@/components/ui/textarea": { Textarea: "textarea" },
    "@/components/ui/label": ui(["Label"]),
    "@/components/ui/select": ui([
      "Select",
      "SelectContent",
      "SelectItem",
      "SelectTrigger",
      "SelectValue",
    ]),
    "@/lib/use-logo-url": { useLogoUrl: (value: string | null) => ({ url: value }) },
    "@/lib/brand-preview": preview,
    "@/lib/brand-story": story,
    "@/lib/quick-start": quick,
    "@/lib/post-art": {
      ...art,
      prepareAsset: async (file: File) => {
        if (prepareImage) return prepareImage(file);
        if (file.type === "image/svg+xml") throw new Error("Use PNG, JPG ou WebP de até 5 MB.");
        return "data:image/png;base64,Yw==";
      },
    },
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
    "@/lib/api": {
      apiFetch: () => {
        throw new Error("Remote API must not run in this test");
      },
    },
    "@/integrations/supabase/client": {
      supabase: {
        from: (table: string) => ({
          upsert: async (value: Record<string, RuntimeValue>) => {
            writes.push({ table, value });
            return { error: null };
          },
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }),
      },
    },
    "lucide-react": new Proxy({}, { get: () => "svg" }),
    sonner: { toast: { success() {}, error() {} } },
  };
  function load(name: string): RuntimeValue {
    if (name === "./brand-direction") return load("@/components/brand-direction");
    if (name in modules) return modules[name];
    assert.ok(name.startsWith("@/"), name);
    const exports = {};
    modules[name] = exports;
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL(`../src/${name.slice(2)}.tsx`, import.meta.url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
      ).outputText,
      {
        exports,
        require: load,
        AbortController,
        File,
        Error,
        FormData: class {
          values: Record<string, string>;
          constructor(values: Record<string, string>) {
            this.values = values;
          }
          get(name: string) {
            return this.values[name] ?? null;
          }
        },
        fetch: async () => {
          fetches++;
          return fetchLogo ? fetchLogo() : new Response(new Blob(["logo"], { type: "image/png" }));
        },
      },
    );
    return exports;
  }
  const route = load("@/routes/_authenticated/marca").Route;
  const Component = route.component;
  function expand(value: RuntimeValue, path: string): RuntimeValue {
    if (Array.isArray(value)) return value.map((child, i) => expand(child, `${path}.${i}`));
    if (!value?.props) return value;
    if (typeof value.type === "function") {
      current = `${path}:${value.type.name}:${value.key ?? ""}`;
      cursor = 0;
      return expand(value.type(value.props), `${path}.render`);
    }
    return {
      ...value,
      props: { ...value.props, children: expand(value.props.children, `${path}.children`) },
    };
  }
  return {
    render: () => expand(node(Component, {}), "root"),
    data: () => data,
    original,
    kit: brandKit,
    writes,
    navigations,
    route,
    workspaceWrites: () => workspaceWrites,
    fetches: () => fetches,
    replaceData: (next: typeof data) => {
      data = next;
    },
    unmount: () => cleanups.forEach((fn) => fn()),
  };
}

test("identity shows one page heading and the saved logo before disclosed piece adjustments", () => {
  const ui = mount();
  const tree = ui.render();
  assert.deepEqual(
    visible(tree)
      .filter((x) => x.type === "h1")
      .map(text),
    ["Identidade"],
  );
  assert.ok(visible(tree).some((x) => x.type === "img" && x.props.src === ui.kit.logo_url));
  const adjustments = nodes(tree).find(
    (x) =>
      x.type === "details" &&
      text(x.props.children?.find((child: Element) => child?.type === "summary")).includes(
        "Ajustes desta peça",
      ),
  );
  assert.ok(adjustments, "Piece controls belong to a disclosure");
  assert.ok(!adjustments.props.open);
  assert.equal(ui.data(), ui.original);
  assert.equal(ui.workspaceWrites(), 0);
  assert.equal(ui.fetches(), 0);
  assert.deepEqual(ui.writes, []);
});

test("IdentityForm returns one form root rather than fragment siblings", () => {
  const file = ts.createSourceFile(
    "marca.tsx",
    readFileSync(new URL("../src/routes/_authenticated/marca.tsx", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = file.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "IdentityForm",
  );
  assert.ok(declaration?.body);
  const returns = declaration.body.statements.filter(ts.isReturnStatement);
  assert.equal(returns.length, 1);
  let root = returns[0].expression;
  assert.ok(root);
  while (ts.isParenthesizedExpression(root)) root = root.expression;
  assert.ok(ts.isJsxElement(root), "IdentityForm must own one DOM root, not a fragment or array");
  assert.equal(root.openingElement.tagName.getText(file), "form");
  assert.equal(root.closingElement.tagName.getText(file), "form");
});

test("saved kit and piece settings have unique keys as rendered siblings", () => {
  const ui = mount({ search: { retorno: "conteudo" } });
  const children = ui.route.component().props.children as Element[];
  const keyed = children.filter((child) => child?.key != null);
  assert.ok(keyed.length >= 2, "Both kit and piece settings must be mounted");
  const keys = keyed.map((child) => child.key);
  assert.equal(
    new Set(keys).size,
    keys.length,
    "Sibling keys must not alias the kit and piece settings",
  );
});

test("identity rerenders keep both kit regions and its single submit button inside one form", () => {
  const ui = mount({ search: { retorno: "conteudo" } });
  for (let render = 0; render < 3; render++) {
    const tree = nodes(ui.render());
    const kitForms = tree.filter(
      (element) =>
        element.type === "form" && nodes(element).some((child) => child.props.name === "fonts"),
    );
    assert.equal(kitForms.length, 1);
    const form = kitForms[0];
    assert.equal(typeof form.props.onSubmit, "function");
    assert.equal(nodes(form).filter((element) => element.type === "form").length, 1);
    for (const id of ["cores", "voz"]) {
      assert.equal(
        tree.filter((element) => element.type === "section" && element.props.id === id).length,
        1,
      );
      assert.equal(nodes(form).filter((element) => element.props.id === id).length, 1);
    }
    const saves = tree.filter(
      (element) => element.type === "button" && text(element) === "Salvar identidade",
    );
    assert.equal(saves.length, 1);
    assert.equal(saves[0].props.type, "submit");
    assert.ok(nodes(form).includes(saves[0]));
    nodes(form)
      .find((element) => element.type === "button" && element.props["aria-pressed"] === false)!
      .props.onClick();
  }
  assert.equal(ui.data(), ui.original);
  assert.equal(ui.workspaceWrites(), 0);
  assert.deepEqual(ui.writes, []);
});

test("saved palette survives a tone-only save even when legacy kit has no options", async () => {
  const ui = mount();
  const tree = ui.render();
  assert.ok(
    nodes(tree).some((x) => x.props["aria-pressed"] === true && text(x).includes("#654321")),
    "Saved colors, not starter colors, must be selected",
  );
  const form = nodes(tree).find(
    (x) => x.type === "form" && nodes(x).some((child) => child.props.name === "fonts"),
  )!;
  await form.props.onSubmit({
    preventDefault() {},
    currentTarget: { fonts: "playfair-inter", tone: "Técnico e direto" },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(ui.writes[0].value.palette)), {
    nome: "Aurora",
    cores: ["#654321", "#FFEEDD"],
  });
  assert.equal(ui.writes[0].value.logo_url, ui.kit.logo_url);
  assert.equal(ui.data(), ui.original);
});

test("custom saved tone stays selectable and brandbook is a secondary disclosure", () => {
  const tree = mount().render();
  assert.ok(
    nodes(tree).some((x) => x.type === "SelectItem" && x.props.value === "Didático e sereno"),
  );
  assert.ok(
    nodes(tree).some(
      (x) =>
        x.type === "details" && !x.props.open && nodes(x).some((child) => child.type === "iframe"),
    ),
  );
  assert.ok(!visible(tree).some((x) => x.type === "iframe"));
});

test("explicit kit apply updates assets and revokes approval while preserving creative copy and photos", async () => {
  const ui = mount();
  await nodes(ui.render())
    .find((x) => x.type === "button" && text(x).includes("Aplicar identidade à minha peça"))!
    .props.onClick();
  assert.equal(ui.data().brand.accent, "#654321");
  assert.equal(ui.data().brand.logo, "data:image/png;base64,Yw==");
  assert.equal(ui.data().brand.photo, ui.original.brand.photo);
  assert.equal(ui.data().brand.creative?.copy, ui.original.brand.creative?.copy);
  assert.equal(ui.data().brand.creative?.approved, null);
  assert.equal(ui.data().brand.creative?.exported, null);
  assert.equal(ui.original.brand.creative?.approved, "approved-snapshot");
  assert.deepEqual(ui.writes, []);
});

test("late logo application cannot overwrite a piece edited during preparation", async () => {
  let finish!: (response: Response) => void;
  const ui = mount({
    fetchLogo: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const applying = nodes(ui.render())
    .find((x) => x.type === "button" && text(x).includes("Aplicar identidade à minha peça"))!
    .props.onClick();
  const changed = {
    ...ui.data(),
    brand: preview.updateBrand(ui.data().brand, { accent: "#ABCDEF" }),
  };
  ui.replaceData(changed);
  ui.render();
  finish(new Response(new Blob(["logo"], { type: "image/png" })));
  await applying;
  assert.equal(ui.data(), changed);
  assert.equal(ui.workspaceWrites(), 0);
  assert.ok(
    nodes(ui.render()).some(
      (x) => x.props.role === "alert" && text(x).includes("Sua peça foi mantida"),
    ),
  );
});

test("unsupported saved SVG leaves current creative intact and explains the format limitation", async () => {
  const ui = mount({
    fetchLogo: async () => new Response(new Blob(["<svg/>"], { type: "image/svg+xml" })),
  });
  await nodes(ui.render())
    .find((x) => x.type === "button" && text(x).includes("Aplicar identidade à minha peça"))!
    .props.onClick();
  assert.equal(ui.data(), ui.original);
  assert.ok(
    nodes(ui.render()).some(
      (x) => x.props.role === "alert" && text(x).includes("PNG, JPG ou WebP"),
    ),
  );
});

test("story unavailability remains truthful without blocking saved kit or exposing a save form", () => {
  const tree = mount({ unavailable: true }).render();
  assert.ok(text(tree).includes(story.BRAND_STORY_UNAVAILABLE));
  assert.ok(!nodes(tree).some((x) => x.props.id === "brand-story-manifesto"));
  assert.ok(
    visible(tree).some(
      (x) => x.type === "img" && x.props.src === "https://assets.example/logo.png",
    ),
  );
});

test("conflicting workspace blocks applying the kit", () => {
  const ui = mount({ sync: "conflict" });
  const action = nodes(ui.render()).find(
    (x) => x.type === "button" && text(x).includes("Aplicar identidade à minha peça"),
  )!;
  assert.equal(action.props.disabled, true);
  action.props.onClick();
  assert.equal(ui.workspaceWrites(), 0);
  assert.equal(ui.fetches(), 0);
});

test("piece color adjustment remains available inside disclosure and invalidates only the piece", () => {
  const ui = mount();
  const disclosure = nodes(ui.render()).find(
    (x) => x.type === "details" && text(x).includes("Ajustes desta peça"),
  );
  assert.ok(disclosure);
  const color = nodes(disclosure).find((x) => x.type === "input" && x.props.type === "color");
  assert.ok(color);
  color.props.onChange({ target: { value: "#ABCDEF" } });
  assert.equal(ui.data().brand.accent, "#ABCDEF");
  assert.equal(ui.data().brand.creative?.approved, null);
  assert.equal(ui.data().brand.creative?.copy, ui.original.brand.creative?.copy);
  assert.deepEqual(ui.writes, []);
});

test("saving tone preserves custom fonts instead of replacing them with a starter preset", async () => {
  const fonts = { heading: "Brand Serif", body: "Brand Sans" };
  const ui = mount({ kit: { fonts } });
  const tree = ui.render();
  const select = nodes(tree).find((x) => x.type === "Select" && x.props.name === "fonts")!;
  assert.ok(
    nodes(select).some(
      (x) =>
        x.type === "SelectItem" &&
        x.props.value === select.props.defaultValue &&
        text(x).includes("salva"),
    ),
  );
  const form = nodes(tree).find((x) => x.type === "form" && nodes(x).includes(select))!;
  await form.props.onSubmit({
    preventDefault() {},
    currentTarget: { fonts: select.props.defaultValue, tone: "Técnico e direto" },
  });
  assert.deepEqual(ui.writes[0].value.fonts, fonts);
  assert.equal(ui.data(), ui.original);
});

test("piece style changes invalidate approval and missing required photo blocks confirmation", () => {
  const ui = mount();
  ui.replaceData({ ...ui.data(), brand: { ...ui.data().brand, photo: "" } });
  nodes(ui.render())
    .find((x) => x.props.id === "piece-visual-style")!
    .props.onChange({ target: { value: "warm" } });
  assert.equal(ui.data().brand.visualStyle, "warm");
  assert.equal(ui.data().brand.creative?.approved, null);
  const tree = ui.render();
  assert.ok(nodes(tree).some((x) => x.props.role === "status" && text(x).includes("foto")));
  assert.equal(
    nodes(tree).find((x) => x.type === "button" && text(x).includes("Confirmar ajustes"))!.props
      .disabled,
    true,
  );
});

test("a pending piece upload cannot write after leaving identity", async () => {
  let finish!: (asset: string) => void;
  const asset = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const ui = mount({ prepareImage: () => asset });
  nodes(ui.render())
    .find((x) => x.props.id === "piece-photo")!
    .props.onChange({
      target: {
        files: [new File(["photo"], "photo.png", { type: "image/png" })],
        value: "photo.png",
      },
    });
  ui.unmount();
  finish("data:image/png;base64,Yw==");
  await asset;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.data(), ui.original);
  assert.equal(ui.workspaceWrites(), 0);
});

test("identity search accepts only workspace section IDs as optional return origins", () => {
  const { route } = mount();
  assert.equal(typeof route.validateSearch, "function");
  for (const retorno of ["painel", "trilha", "conteudo", "cerebro", "marca", "redes", "metricas"]) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(route.validateSearch({ retorno, ignored: "value" }))),
      { retorno },
    );
  }
  for (const retorno of [
    undefined,
    null,
    "",
    "https://example.com",
    "//example.com",
    "/painel",
    "javascript:alert(1)",
    "constructor",
    ["painel"],
    { to: "painel" },
    123,
  ]) {
    assert.deepEqual(JSON.parse(JSON.stringify(route.validateSearch({ retorno }))), {});
  }
});

for (const [retorno, to] of [
  ["painel", "/painel"],
  ["trilha", "/trilha"],
  ["conteudo", "/conteudo"],
  [undefined, "/conteudo"],
  ["https://example.com", "/conteudo"],
] as const) {
  test(`confirming piece adjustments returns to ${retorno ?? "the compatible default"}`, () => {
    const ui = mount({ search: { retorno } });
    const tree = ui.render();
    assert.equal(ui.data(), ui.original);
    nodes(tree)
      .find((x) => x.type === "button" && text(x).includes("Confirmar ajustes"))!
      .props.onClick();
    assert.deepEqual(JSON.parse(JSON.stringify(ui.navigations)), [
      { to, search: to === "/conteudo" ? { aba: "peca" } : {} },
    ]);
    assert.equal(ui.data().brand.identityConfirmed, true);
    assert.equal(ui.data().brand.logo, ui.original.brand.logo);
    assert.equal(ui.data().brand.accent, ui.original.brand.accent);
    assert.equal(ui.data().brand.creative, ui.original.brand.creative);
    assert.equal(ui.fetches(), 0);
    assert.deepEqual(ui.writes, []);
  });
}

for (const retorno of ["painel", "trilha", "conteudo"] as const) {
  test(`saving the kit keeps an explicit return to ${retorno} without applying or confirming the piece`, async () => {
    const ui = mount({ search: { retorno } });
    const form = nodes(ui.render()).find(
      (x) => x.type === "form" && nodes(x).some((child) => child.props.name === "fonts"),
    )!;
    await form.props.onSubmit({
      preventDefault() {},
      currentTarget: { fonts: "playfair-inter", tone: "Técnico e direto" },
    });
    const back = visible(ui.render()).find(
      (x) => x.type === "a" && text(x).includes("Voltar") && x.props.to === `/${retorno}`,
    );
    assert.ok(back, "Saved kit must leave a visible return link to the URL origin");
    assert.deepEqual(
      JSON.parse(JSON.stringify(back.props.search)),
      retorno === "conteudo" ? { aba: "peca" } : {},
    );
    assert.equal(ui.writes.length, 1);
    assert.equal(ui.data(), ui.original);
    assert.equal(ui.data().brand.identityConfirmed, false);
    assert.equal(ui.fetches(), 0);
    assert.deepEqual(ui.navigations, []);
  });
}

test("identity returns to the originating piece briefing after confirmation", () => {
  const ui = mount({ search: { retorno: "conteudo", origemConteudo: "briefing" } });
  nodes(ui.render())
    .find((x) => x.type === "button" && text(x).includes("Confirmar ajustes"))!
    .props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.navigations)), [
    { to: "/conteudo", search: { aba: "briefing" } },
  ]);
});
