import { test } from "node:test";
import * as research from "../src/lib/brand-research.ts";
import * as sources from "../src/lib/brand-sources.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as quick from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as onboarding from "../src/lib/onboarding.ts";
import * as workspace from "../src/lib/marketing-workspace.ts";

function fixture() {
  const data = quick.demoSchema.parse({
    name: "Aurora",
    segment: "Pilates",
    answers: {
      website: "https://old.example",
      instagram: "@aurora",
      offers: "Aulas de pilates",
      audience: "Adultos",
      goals: "Atrair novos clientes",
    },
    brand: {
      confirmed: true,
      referenceUrl: "https://old.example",
      detail: "Turmas pequenas com acompanhamento próximo.",
      research: {
        status: "ready",
        sources: [
          {
            url: "https://old.example",
            title: "Site antigo",
            text: "Material antigo",
            fetchedAt: "2026-09-24",
          },
        ],
      },
    },
  });
  data.brand.creative = preview.composeContent(data, "invite");
  const fingerprint = preview.creativeFingerprint(data);
  data.brand.creative.approved = fingerprint;
  data.brand.creative.exported = fingerprint;
  return data;
}

test("Brain site edit aligns the reference, clears old research and approvals, and preserves answers and copy", () => {
  const original = fixture();
  const next = quick.changeDemoContext(original, {
    answers: { ...original.answers, website: "https://new.example" },
  });
  assert.equal(next.brand.referenceUrl, "https://new.example");
  assert.deepEqual(next.brand.research, preview.researchSchema.parse({}));
  assert.deepEqual(next.answers, { ...original.answers, website: "https://new.example" });
  assert.equal(next.brand.confirmed, original.brand.confirmed);
  assert.equal(next.brand.detail, original.brand.detail);
  assert.deepEqual(next.brand.creative?.copy, original.brand.creative?.copy);
  assert.equal(next.brand.creative?.approved, null);
  assert.equal(next.brand.creative?.exported, null);
  assert.equal(original.brand.referenceUrl, "https://old.example");
  const late = preview.applyBrandResearch(
    next.brand,
    { url: original.brand.referenceUrl, material: original.brand.material },
    original.brand.research,
  );
  assert.equal(late, next.brand);
});

test("repairing a legacy reference mismatch still invalidates approval for a normalized answer", () => {
  const original = fixture();
  original.answers.website = "https://new.example";
  const next = quick.changeDemoContext(original, {
    answers: { ...original.answers, website: " https://new.example " },
  });
  assert.equal(next.brand.referenceUrl.trim(), "https://new.example");
  assert.deepEqual(next.brand.research.sources, []);
  assert.equal(next.brand.creative?.approved, null);
  assert.equal(next.brand.creative?.exported, null);
});

test("clearing and reverting a website never revives old research or approval", () => {
  const original = fixture();
  const cleared = quick.changeDemoContext(original, {
    answers: { ...original.answers, website: "" },
  });
  assert.equal(cleared.brand.referenceUrl, "");
  assert.deepEqual(cleared.brand.research.sources, []);
  const reverted = quick.changeDemoContext(cleared, { answers: original.answers });
  assert.equal(reverted.brand.referenceUrl, original.answers.website);
  assert.deepEqual(reverted.brand.research.sources, []);
  assert.equal(preview.creativeStatus(reverted).approved, false);
});

test("unrelated answer edits preserve research and an existing longer reference", () => {
  const original = fixture();
  original.brand.referenceUrl = "https://example.com/" + "a".repeat(220);
  const next = quick.changeDemoContext(original, {
    answers: { ...original.answers, instagram: "@new" },
  });
  assert.equal(next.brand.referenceUrl, original.brand.referenceUrl);
  assert.equal(next.brand.research, original.brand.research);
  assert.equal(next.brand.creative?.approved, null);
  const unchanged = quick.changeDemoContext(original, { answers: { ...original.answers } });
  assert.equal(unchanged.brand, original.brand);
});

type Element = { type: unknown; props: Record<string, unknown> };
const jsx = {
  jsx: (type: unknown, props: Element["props"]) => ({ type, props }),
  jsxs: (type: unknown, props: Element["props"]) => ({ type, props }),
};
function nodes(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...nodes(element.props.children)];
}
function load(file: string, stubs: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(output, {
    exports,
    URL,
    require: (id: string) => {
      if (id === "react/jsx-runtime") return jsx;
      if (id === "@/components/workspace-skeleton")
        return { WorkspaceSkeleton: "workspace-skeleton" };
      if (!(id in stubs)) throw new Error(`Unexpected import: ${id}`);
      return stubs[id];
    },
  });
  return exports;
}

test("onboarding site input keeps both representations within the answer schema", () => {
  let data = fixture();
  const component = load("../src/components/brand-onboarding.tsx", {
    react: {
      useState: (value: unknown) => [value, () => {}],
      useRef: () => ({ current: null }),
      useEffect() {},
      useLayoutEffect() {},
    },
    "lucide-react": {},
    "./quick-start-flow": {},
    "./brand-direction": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "@/lib/brand-research": research,
    "@/lib/brand-sources": sources,
    "@/lib/quick-start": quick,
    "@/lib/brand-preview": preview,
    "@/lib/onboarding": onboarding,
  }).BrandOnboarding as (props: Record<string, unknown>) => Element;
  const tree = component({
    step: 0,
    data,
    onData: (update: (value: quick.DemoData) => quick.DemoData) => {
      data = update(data);
    },
    onStep() {},
    onResearch() {},
  });
  const input = nodes(tree).find(
    (node) => node.type === "input" && node.props.inputMode === "url",
  )!;
  assert.equal(input.props.maxLength, 200);
  const website = "https://example.com/" + "a".repeat(240);
  (input.props.onChange as (event: unknown) => void)({ target: { value: website } });
  assert.equal(data.answers.website, website.slice(0, 200));
  assert.equal(data.brand.referenceUrl, data.answers.website);
  assert.equal(quick.demoSchema.safeParse(data).success, true);
  assert.deepEqual(data.brand.research.sources, []);
  assert.equal(data.answers.offers, fixture().answers.offers);
  assert.equal(data.brand.creative?.approved, null);
});

test("Channels reads workspace links including blanks and opens the new Brain or onboarding", () => {
  const data = fixture();
  data.answers.website = "https://new.example";
  data.answers.instagram = "";
  data.answers.linkedin = "https://linkedin.com/company/new";
  let company: Record<string, string> | null = {
    id: "company",
    website: "https://old.example",
    instagram_handle: "@old",
  };
  const loaded = load("../src/routes/_authenticated/redes.tsx", {
    "@tanstack/react-router": {
      createFileRoute: () => (options: Record<string, unknown>) => ({
        ...options,
        useNavigate: () => () => {},
      }),
      Link: "Link",
    },
    "@tanstack/react-query": { useQuery: () => ({ data: [], isPending: false, isError: false }) },
    "@/components/channel-overview": { ChannelOverview: "ChannelOverview" },
    "@/components/channel-recommendations": {
      ChannelRecommendations: "ChannelRecommendations",
    },
    "@/lib/marketing-workspace": workspace,
    "@/lib/brand-sources": sources,
    "@/components/ui/button": { Button: "Button" },
    "@/integrations/supabase/client": { supabase: {} },
    "@/lib/company": { useCompany: () => ({ data: company, isPending: false, isError: false }) },
    "@/components/marketing-provider": {
      useMarketingWorkspace: () => ({ data, company, sync: "ready" }),
    },
  });
  const render = (loaded.Route as { component: () => Element }).component;
  const tree = render();
  const channels = tree.props.company as Record<string, string>;
  assert.equal(channels.website, data.answers.website);
  assert.equal(channels.instagram_handle, "");
  assert.equal(channels.linkedin_url, data.answers.linkedin);
  const edit = tree.props.action as Element;
  assert.equal(edit.props.to, "/diagnostico");
  assert.equal((edit.props.search as Record<string, unknown> | undefined)?.etapa, undefined);
  assert.equal((edit.props.search as Record<string, unknown>).editar, "contexto");
  assert.equal((edit.props.search as Record<string, unknown>).retorno, "redes");
  company = null;
  const registration = nodes(render()).find((node) => node.type === "Link")!;
  assert.equal(registration.props.to, "/boas-vindas");
});

function channelView(data: quick.DemoData) {
  const company = { id: "company" };
  const loaded = load("../src/routes/_authenticated/redes.tsx", {
    "@tanstack/react-router": {
      createFileRoute: () => (options: Record<string, unknown>) => ({
        ...options,
        useNavigate: () => () => {},
      }),
      Link: "Link",
    },
    // Do not execute the remote queries. The route and its public-link view run unchanged.
    "@tanstack/react-query": { useQuery: () => ({ data: [], isPending: false, isError: false }) },
    "@/components/channel-overview": { ChannelOverview: "ChannelOverview" },
    "@/components/channel-recommendations": {
      ChannelRecommendations: "ChannelRecommendations",
    },
    "@/lib/marketing-workspace": workspace,
    "@/lib/brand-sources": sources,
    "@/components/ui/button": { Button: "Button" },
    "@/integrations/supabase/client": { supabase: {} },
    "@/lib/company": { useCompany: () => ({ data: company, isPending: false, isError: false }) },
    "@/components/marketing-provider": {
      useMarketingWorkspace: () => ({ data, company, sync: "ready" }),
    },
  });
  const route = (loaded.Route as { component: () => Element }).component();
  const view = load("../src/components/channel-overview.tsx", {
    "lucide-react": {},
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/badge": { Badge: "Badge" },
  }).ChannelOverview as (props: Element["props"]) => Element;
  return view(route.props);
}

function content(value: unknown): string {
  if (Array.isArray(value)) return value.map(content).join(" ");
  if (value && typeof value === "object" && "props" in value)
    return content((value as Element).props.children);
  return typeof value === "string" ? value : "";
}

function publicLinks(tree: Element) {
  return nodes(tree)
    .filter((node) => node.type === "a")
    .map((node) => node.props.href);
}

test("Channels displays every confirmed added profile without inventing authorization", () => {
  const data = fixture();
  data.answers.instagram = "";
  data.brand.extraLinks = ["https://instagram.com/aurora", "https://facebook.com/aurora"];
  data.brand.referencesConfirmed = sources.brandReferencesFingerprint(data.brand);
  const before = JSON.stringify(data);
  const tree = channelView(data);
  assert.ok(publicLinks(tree).includes("https://instagram.com/aurora"));
  assert.ok(publicLinks(tree).includes("https://facebook.com/aurora"));
  assert.match(content(tree), /Link confirmado pela marca/);
  assert.match(content(tree), /Não conectado/);
  assert.doesNotMatch(content(tree), /Conexão registrada/);
  assert.equal(JSON.stringify(data), before);
});

test("Channels uses an edited manual profile instead of its stale legacy answer", () => {
  const original = fixture();
  original.brand.extraLinks = ["https://instagram.com/aurora"];
  const result = research.replaceBrandReference(
    original,
    "https://instagram.com/aurora",
    "@aurora.nova",
  );
  assert.ok(result.data);
  result.data.brand.referencesConfirmed = sources.brandReferencesFingerprint(result.data.brand);
  const tree = channelView(result.data);
  assert.ok(publicLinks(tree).includes("https://instagram.com/aurora.nova"));
  assert.ok(!publicLinks(tree).some((href) => String(href).replace(/\/$/, "").endsWith("/aurora")));
});

test("Channels excludes removed references even when legacy answers still contain them", () => {
  const data = fixture();
  data.brand.extraLinks = ["https://instagram.com/aurora"];
  data.brand.excludedReferences = ["old.example", "https://instagram.com/aurora"];
  const tree = channelView(data);
  assert.deepEqual(publicLinks(tree), []);
});

test("Channels keeps discovered references unconfirmed and preserves legacy-only profiles", () => {
  const data = fixture();
  data.answers.linkedin = "https://linkedin.com/company/aurora";
  data.brand.research.discoveredLinks = [
    {
      url: "https://instagram.com/found.profile",
      foundOn: "https://old.example",
    },
  ];
  const tree = channelView(data);
  assert.ok(publicLinks(tree).includes("https://instagram.com/found.profile"));
  assert.ok(publicLinks(tree).includes("https://linkedin.com/company/aurora"));
  assert.match(content(tree), /Link identificado/);
  assert.doesNotMatch(content(tree), /Link confirmado pela marca/);
});

test("adding a second website preserves the primary site when no research is saved", () => {
  const data = fixture();
  data.brand.research = preview.researchSchema.parse({});
  data.brand.extraLinks = ["https://other.example"];
  const links = publicLinks(channelView(data));
  assert.ok(links.includes("https://old.example/"));
  assert.ok(links.includes("https://other.example/"));
});

test("exclusions match a legacy handle without a manual reference", () => {
  const data = fixture();
  data.answers.instagram = "@AURORA";
  data.brand.excludedReferences = ["https://instagram.com/aurora"];
  assert.ok(!publicLinks(channelView(data)).some((href) => String(href).includes("instagram.com")));
});

test("no-website path preserves human copy, revokes old approval and retains the Instagram step after reload", () => {
  let data = fixture();
  let step = 0;
  const component = load("../src/components/brand-onboarding.tsx", {
    react: {
      useState: (value: unknown) => [value, () => {}],
      useRef: () => ({ current: null }),
      useEffect() {},
      useLayoutEffect() {},
    },
    "lucide-react": {},
    "./quick-start-flow": {},
    "./brand-direction": {},
    "./brand-sources": {},
    "./research-suggestions": {},
    "@/lib/brand-research": research,
    "@/lib/brand-sources": sources,
    "@/lib/quick-start": quick,
    "@/lib/brand-preview": preview,
    "@/lib/onboarding": onboarding,
  }).BrandOnboarding as (props: Record<string, unknown>) => Element;
  const render = () =>
    nodes(
      component({
        step,
        data,
        onData: (update: (value: quick.DemoData) => quick.DemoData) => {
          data = update(data);
        },
        onStep: (value: number) => {
          step = value;
        },
        onResearch() {},
      }),
    );
  (render().find((n) => n.props.children === "Não tenho site")!.props.onClick as () => void)();
  assert.equal(data.brand.creative?.approved, null);
  assert.deepEqual(data.brand.creative?.copy, fixture().brand.creative?.copy);
  assert.equal(data.answers.website, "");
  assert.equal(data.brand.referenceUrl, "");
  data = quick.demoSchema.parse(JSON.parse(JSON.stringify(data)));
  const input = render().find((n) => n.props.placeholder === "@suaclinica")!;
  assert.ok(input);
  (input.props.onChange as (event: unknown) => void)({
    target: { value: "instagram.com/aurora.qa/" },
  });
  (render().find((n) => n.type === "form")!.props.onSubmit as (event: unknown) => void)({
    preventDefault() {},
  });
  assert.equal(data.answers.instagram, "@aurora.qa");
  assert.ok(data.brand.extraLinks.includes("https://instagram.com/aurora.qa"));
  assert.equal(step, 1);
});
