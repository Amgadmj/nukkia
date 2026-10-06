import * as serviceBriefDomain from "../src/lib/service-brief.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as preview from "../src/lib/brand-preview.ts";
import * as art from "../src/lib/post-art.ts";
import * as story from "../src/lib/brand-story.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import * as workspaceLib from "../src/lib/marketing-workspace.ts";
import * as quick from "../src/lib/quick-start.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as research from "../src/lib/brand-research.ts";

type Element = {
  type: unknown;
  props: {
    children?: unknown;
    type?: string;
    onClick?: () => void;
    onChange?: (value: unknown) => void;
    disabled?: boolean;
  };
};
const isElement = (value: unknown): value is Element =>
  !!value && typeof value === "object" && "props" in value;
const nodes = (value: unknown): Element[] =>
  Array.isArray(value)
    ? value.flatMap(nodes)
    : isElement(value)
      ? [value, ...nodes(value.props.children)]
      : [];
const text = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(text).join("")
    : isElement(value)
      ? text(value.props.children)
      : typeof value === "string"
        ? value
        : "";
const react = {
  useState: (initial: unknown) => [initial, () => {}],
  useEffect() {},
  useRef: (initial: unknown) => ({ current: initial }),
  useMemo: (fn: () => unknown) => fn(),
};
function load(file: string, overrides: Record<string, unknown>) {
  const modules: Record<string, unknown> = {
    react,
    "@/lib/service-brief": serviceBriefDomain,
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object) => ({ type, props }),
      jsxs: (type: unknown, props: object) => ({ type, props }),
    },
    "./inspiration-board": { InspirationBoard: "inspiration-board" },
    "@/components/inspiration-board": { InspirationBoard: "inspiration-board" },
    "./workspace-services": { WorkspaceServices: "workspace-services" },
    "lucide-react": {},
    "@/lib/use-logo-url": { useLogoUrl: (value: string | null) => ({ url: value }) },
    "@/lib/brand-preview": preview,
    "@/lib/post-art": art,
    ...overrides,
  };
  const exports: Record<string, (props: Record<string, unknown>) => Element> = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../src/${file}.tsx`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports,
      require: (id: string) => {
        if (!(id in modules)) throw new Error(id);
        return modules[id];
      },
    },
  );
  return exports;
}

test("a warm educational draft always exposes a way to replace its missing photo", () => {
  let data = demoSchema.parse({
    name: "Aurora",
    segment: "Pilates",
    answers: { offers: "Aulas individuais", audience: "Adultos", goals: "Atrair novos clientes" },
    brand: {
      confirmed: true,
      detail: "Turmas pequenas e acompanhamento próximo.",
      visualStyle: "warm",
      photo: "data:image/png;base64,YQ==",
    },
  });
  data.brand.creative = preview.composeContent(data, "educate");
  const component = load("components/first-post-workspace", {
    "./brand-onboarding": {},
    "@/lib/marketing-workspace": workspaceLib,
    "./brand-sources": {},
  }).FirstPostWorkspace;
  const render = () =>
    nodes(
      component({
        data,
        onData: (update: (value: typeof data) => typeof data) => {
          data = update(data);
        },
        onEditBrief() {},
        onChooseApproach() {},
        onTrail() {},
      }),
    );
  render().find((element) => element.type === "button" && text(element) === "Remover foto")!.props
    .onClick!();
  const tree = render();
  const photoControl = tree.find(
    (element) => element.type === "label" && text(element).trim() === "Foto",
  );
  assert.ok(photoControl, "A photo-led carousel must let the user upload a replacement");
  assert.equal(
    nodes(photoControl).filter(
      (element) => element.type === "input" && element.props.type === "file",
    ).length,
    1,
  );
  assert.ok(
    tree.some((element) => element.type === "summary" && text(element).includes("Foto necessária")),
  );
});

test("identity also requests the photo required by a pending photo format", () => {
  const component = load("components/marketing-views", {
    "@/lib/quick-start": quick,
    "@/lib/onboarding": onboarding,
    "@/lib/brand-research": research,
    "@/lib/marketing-workspace": workspaceLib,
    "./brand-onboarding": {},
    "./brand-direction": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "./channel-recommendations": { ChannelRecommendations: "channel-recommendations" },
  }).LocalIdentity;
  let data = demoSchema.parse({
    name: "Aurora",
    answers: {},
    brand: { visualStyle: "essential", preferredApproach: "trust", identityConfirmed: true },
  });
  const render = () =>
    nodes(
      component({
        data,
        onData: (update: (value: typeof data) => typeof data) => {
          data = update(data);
        },
        onContinue() {},
      }),
    );
  let tree = render();
  assert.equal(
    tree.find(
      (element) => element.type === "button" && text(element).includes("Salvar identidade"),
    )!.props.disabled,
    true,
  );
  assert.ok(
    tree.some(
      (element) => element.type === "h2" && text(element).includes("fotografia · necessária"),
    ),
  );
  tree.find(
    (element) =>
      element.type === "button" && text(element).includes("Escolher um formato sem foto"),
  )!.props.onClick!();
  tree = render();
  assert.equal(
    tree.find(
      (element) => element.type === "button" && text(element).includes("Salvar identidade"),
    )!.props.disabled,
    false,
  );
  assert.equal(data.brand.creative, null);
});

for (const sync of ["loading", "conflict", "ready"] as const)
  test(`authenticated identity mutations respect workspace ${sync}`, () => {
    const company = { id: "company-a", name: "Aurora", segment: "Pilates" };
    const modules: Record<string, unknown> = {
      "@tanstack/react-router": {
        createFileRoute: () => (config: Record<string, unknown>) => ({
          ...config,
          useSearch: () => ({}),
        }),
        useNavigate: () => () => {},
        Link: "a",
      },
      "@tanstack/react-query": { useQuery: () => ({ data: null }), useQueryClient: () => ({}) },
      sonner: { toast: {} },
      "@/components/marketing-views": { LocalIdentity: "local-identity" },
      "@/components/brand-identity-settings": { BrandIdentitySettings: "identity-settings" },
      "@/components/marketing-provider": {
        useMarketingWorkspace: () => ({
          company,
          sync,
          data: demoSchema.parse({ name: "Aurora", answers: {} }),
          setData() {},
        }),
        WorkspaceSaveStatus: "save-status",
      },
      "@/components/brand-book": {},
      "@/components/brand-identity-overview": {},
      "@/lib/company": {
        useCompany: () => ({ data: company }),
        useBrandKit: () => ({ data: null }),
        useDiagnostic: () => ({ data: null }),
      },
      "@/lib/api": {},
      "@/integrations/supabase/client": {},
      "@/lib/utils": {},
      "@/lib/brand-story": story,
      "@/lib/marketing-workspace": workspaceLib,
    };
    for (const item of ["button", "card", "input", "textarea", "label", "select"])
      modules[`@/components/ui/${item}`] = {};
    const loaded = load("routes/_authenticated/marca", modules);
    const route = loaded.Route as unknown as { component: () => Element };
    const tree = nodes(route.component());
    assert.equal(
      tree.some((element) => element.type === "identity-settings"),
      sync === "ready",
    );
  });

test("an asset finishing after the identity screen unmounts cannot modify another workspace", async () => {
  let finish: (image: string) => void = () => {};
  const asset = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const cleanups: Array<() => void> = [];
  let writes = 0;
  const component = load("components/marketing-views", {
    react: {
      ...react,
      useEffect: (effect: () => (() => void) | undefined) => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      },
    },
    "@/lib/post-art": { ...art, prepareAsset: () => asset },
    "@/lib/quick-start": quick,
    "@/lib/onboarding": onboarding,
    "@/lib/brand-research": research,
    "@/lib/marketing-workspace": workspaceLib,
    "./brand-onboarding": {},
    "./brand-direction": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "./channel-recommendations": { ChannelRecommendations: "channel-recommendations" },
  }).LocalIdentity;
  const tree = nodes(
    component({
      data: demoSchema.parse({ name: "Aurora", answers: {} }),
      onData: () => {
        writes++;
      },
      onContinue() {},
    }),
  );
  tree.find((element) => element.type === "input" && element.props.type === "file")!.props
    .onChange!({ target: { files: [{}], value: "image.png" } });
  cleanups.forEach((cleanup) => cleanup());
  finish("data:image/png;base64,YQ==");
  await asset;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes, 0);
});

test("demo identity confirmation returns to the chosen content view", () => {
  const calls: string[] = [];
  const component = load("components/demo-workspace", {
    "@/lib/content-library": {},
    "./health-readiness": {},
    "./content-library": {},
    "@/lib/service-catalog-storage": {},
    "./workspace-shell": { WorkspaceShell: "shell" },
    "./marketing-views": { LocalIdentity: "identity" },
    "./content-studio": {},
    "./health-studio": {},
    "./workspace-context-editor": {},
    "@/lib/marketing-workspace": workspaceLib,
  }).DemoWorkspace;
  const tree = nodes(
    component({
      data: demoSchema.parse({ name: "QA", answers: {} }),
      section: "marca",
      contentView: "abordagens",
      editor: { retorno: "conteudo" },
      onSection: (section: string) => calls.push(`section:${section}`),
      onContentView: (view: string) => calls.push(`view:${view}`),
    }),
  );
  const identity = tree.find((node) => node.type === "identity")!;
  (identity.props as unknown as { onContinue: () => void }).onContinue();
  assert.deepEqual(calls, ["view:abordagens"]);
});
