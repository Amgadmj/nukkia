import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as quick from "../src/lib/quick-start.ts";
import * as preview from "../src/lib/brand-preview.ts";
import * as research from "../src/lib/brand-research.ts";
import * as sources from "../src/lib/brand-sources.ts";
import * as onboarding from "../src/lib/onboarding.ts";

const seed = () => {
  const data = quick.demoSchema.parse({
    name: "Aurora",
    segment: "Pilates",
    answers: { audience: "Adultos", website: "https://aurora.com" },
    brand: {
      referenceUrl: "https://aurora.com",
      confirmed: true,
      siteAuthorized: true,
      aiAuthorized: true,
      research: {
        status: "ready",
        sources: [
          {
            url: "https://aurora.com",
            title: "Aurora",
            text: "Aulas de pilates",
            fetchedAt: "2026-09-24",
          },
        ],
        discoveredLinks: [{ url: "https://instagram.com/old", foundOn: "https://aurora.com" }],
      },
    },
  });
  data.brand.referencesConfirmed = "aurora.com|https://instagram.com/old";
  return data;
};

test("editing a social handle preserves its platform and discards tracking parameters", () => {
  assert.equal(typeof sources.editedSourceIdentity, "function");
  for (const [original, value, expected] of [
    ["https://instagram.com/old", "@aurora", "https://instagram.com/aurora"],
    ["https://tiktok.com/@old", "aurora", "https://tiktok.com/@aurora"],
    ["https://linkedin.com/company/old", "@aurora", "https://linkedin.com/company/aurora"],
    ["https://facebook.com/profile.php?id=123", "@aurora", "https://facebook.com/aurora"],
    [
      "https://instagram.com/old",
      "https://facebook.com/aurora?ref=123",
      "https://facebook.com/aurora",
    ],
    ["https://aurora.com", "newsite.com/about", "https://newsite.com/"],
  ])
    assert.equal(sources.editedSourceIdentity(original, value)?.url, expected);
  for (const value of [
    "",
    "javascript:alert(1)",
    "http://example.com",
    "https://127.0.0.1",
    "https://user:pass@example.com",
    "not a handle",
    "https://instagram.com/p/123",
  ])
    assert.equal(sources.editedSourceIdentity("https://instagram.com/old", value), null, value);
});

test("replacing a reference invalidates confirmation without laundering old evidence", () => {
  assert.equal(typeof research.replaceBrandReference, "function");
  const data = seed();
  data.brand.research.sources.push({
    url: "https://instagram.com/old",
    title: "Old",
    text: "Old claims",
    fetchedAt: "2026-09-24",
  });
  data.brand.research.suggestions.push(
    preview.suggestionSchema.parse({
      field: "detail",
      value: "Old claims",
      sourceUrl: "https://instagram.com/old",
      quote: "Old claims",
    }),
  );
  const result = research.replaceBrandReference(data, "https://instagram.com/old", "@new");
  assert.ok(result.data);
  assert.equal(result.data.brand.referencesConfirmed, "");
  assert.equal(result.data.brand.confirmed, false);
  assert.deepEqual(result.data.brand.extraLinks, ["https://instagram.com/new"]);
  assert.deepEqual(result.data.brand.excludedReferences, ["https://instagram.com/old"]);
  assert.equal(research.allowedSuggestions(result.data).length, 0);
  assert.equal(
    sources
      .groupBrandSources(result.data.brand.research, result.data.brand.extraLinks)
      .find((x) => x.label === "@new")?.pages.length,
    0,
  );
  assert.equal(data.brand.referencesConfirmed, "aurora.com|https://instagram.com/old");
});

test("editing the official site clears old research and consent while preserving user-written answers", () => {
  assert.equal(typeof research.replaceBrandReference, "function");
  const data = seed();
  const result = research.replaceBrandReference(data, "aurora.com", "https://newsite.com");
  assert.ok(result.data);
  assert.equal(result.data.brand.referenceUrl, "https://newsite.com/");
  assert.equal(result.data.answers.website, "https://newsite.com/");
  assert.equal(result.data.brand.siteAuthorized, false);
  assert.equal(result.data.brand.aiAuthorized, false);
  assert.equal(result.data.brand.referencesConfirmed, "");
  assert.equal(result.data.brand.confirmed, false);
  assert.deepEqual(result.data.brand.research, preview.researchSchema.parse({}));
  assert.equal(result.data.answers.audience, "Adultos");
  const late = research.applyResearchToData(
    result.data,
    { url: "https://aurora.com", material: "" },
    data.brand.research,
  );
  assert.equal(late, result.data);
});

test("correcting the official hostname to www saves the URL and requires fresh authorization", () => {
  const result = research.replaceBrandReference(seed(), "aurora.com", "https://www.aurora.com");
  assert.ok(result.data);
  assert.equal(result.data.brand.referenceUrl, "https://www.aurora.com/");
  assert.equal(result.data.brand.siteAuthorized, false);
  assert.equal(result.data.brand.aiAuthorized, false);
  assert.equal(result.data.brand.research.sources.length, 0);
});

test("replacing a site clears untouched autofill but preserves user edits for fresh synthesis", () => {
  const data = seed();
  data.brand.suggestedFields = ["name", "segment", "audience"];
  data.brand.editedFields = ["segment"];
  const result = research.replaceBrandReference(data, "aurora.com", "https://newsite.com");
  assert.ok(result.data);
  assert.equal(result.data.name, "");
  assert.equal(result.data.answers.audience, "");
  assert.equal(result.data.segment, "Pilates");
  assert.deepEqual(result.data.brand.suggestedFields, []);
});

test("invalid edits and missing references leave the workspace unchanged", () => {
  assert.equal(typeof research.replaceBrandReference, "function");
  const data = seed();
  for (const [key, url] of [
    ["https://instagram.com/old", "http://localhost"],
    ["missing.com", "https://newsite.com"],
  ]) {
    const result = research.replaceBrandReference(data, key, url);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
  assert.equal(data.brand.referencesConfirmed, "aurora.com|https://instagram.com/old");
});

test("repeated manual edits replace the prior URL instead of consuming additional link slots", () => {
  assert.equal(typeof research.replaceBrandReference, "function");
  const data = seed();
  data.brand.extraLinks = Array.from({ length: 12 }, (_, i) => `https://partner${i}.com/`);
  let result = research.replaceBrandReference(data, "partner0.com", "https://newsite.com");
  assert.ok(result.data);
  assert.equal(result.data.brand.extraLinks.length, 12);
  result = research.replaceBrandReference(result.data, "newsite.com", "https://another.com");
  assert.ok(result.data);
  assert.equal(result.data.brand.extraLinks.length, 12);
  assert.equal(result.data.brand.extraLinks.includes("https://newsite.com/"), false);
  assert.deepEqual(result.data.brand.excludedReferences, ["partner0.com", "newsite.com"]);
});

test("cross-platform manual replacement excludes the old legacy profile from Channels", () => {
  const data = seed();
  data.answers.instagram = "@old";
  data.brand.research = preview.researchSchema.parse({});
  data.brand.extraLinks = ["https://instagram.com/old"];
  data.brand.excludedReferences = ["removed.example"];
  const before = JSON.stringify(data);
  const result = research.replaceBrandReference(
    data,
    "https://instagram.com/old",
    "https://linkedin.com/company/aurora",
  );
  assert.ok(result.data);
  assert.deepEqual(result.data.brand.excludedReferences, [
    "removed.example",
    "https://instagram.com/old",
  ]);
  assert.equal(result.data.brand.referencesConfirmed, "");
  const channels = sources.projectChannelReferences(result.data);
  assert.equal(
    channels.some((channel) => channel.provider === "instagram"),
    false,
  );
  assert.ok(channels.some((channel) => channel.value === "https://linkedin.com/company/aurora"));
  assert.equal(result.data.answers.instagram, "@old");
  assert.equal(JSON.stringify(data), before);
});

test("manual replacement fills the last exclusion slot without dropping previous exclusions", () => {
  const data = seed();
  data.brand.extraLinks = ["https://instagram.com/manual"];
  data.brand.excludedReferences = Array.from({ length: 23 }, (_, i) => `removed${i}.example`);
  const result = research.replaceBrandReference(
    data,
    "https://instagram.com/manual",
    "https://linkedin.com/company/aurora",
  );
  assert.ok(result.data);
  assert.deepEqual(result.data.brand.excludedReferences, [
    ...data.brand.excludedReferences,
    "https://instagram.com/manual",
  ]);
  assert.equal(quick.demoSchema.safeParse(result.data).success, true);
});

test("manual replacement at exclusion capacity rejects the edit without mutating saved state", () => {
  const data = seed();
  data.brand.extraLinks = ["https://instagram.com/manual"];
  data.brand.excludedReferences = Array.from({ length: 24 }, (_, i) => `removed${i}.example`);
  const before = JSON.stringify(data);
  const result = research.replaceBrandReference(
    data,
    "https://instagram.com/manual",
    "https://linkedin.com/company/aurora",
  );
  assert.ok(result.error);
  assert.equal(result.data, undefined);
  assert.equal(JSON.stringify(data), before);
});

type Element = {
  type: unknown;
  props: Record<string, unknown> & {
    onChange: (event: unknown) => void;
    onSubmit: (event: unknown) => void;
    editor: {
      onStart: (source: sources.SourceIdentity | null) => void;
      onChange: (value: string) => void;
      onSave: () => void;
      onCancel: () => void;
    };
  };
};
function nodes(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...nodes(element.props.children)];
}
function mount(initial = seed(), step = 1) {
  let data = initial;
  let currentStep = step;
  let cursor = 0;
  const cells: unknown[] = [];
  let effectCursor = 0;
  let changed = false;
  const dependencies: unknown[][] = [];
  const effects: (() => void)[] = [];
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object) => ({ type, props }),
      jsxs: (type: unknown, props: object) => ({ type, props }),
    },
    react: {
      useState: (initial: unknown) => {
        const i = cursor++;
        if (!(i in cells)) cells[i] = initial;
        return [
          cells[i],
          (value: unknown) => {
            if (value !== cells[i]) changed = true;
            cells[i] = value;
          },
        ];
      },
      useRef: () => ({ current: null }),
      useEffect(fn: () => void, deps: unknown[]) {
        const i = effectCursor++;
        if (!dependencies[i] || deps.some((value, j) => value !== dependencies[i][j])) {
          dependencies[i] = deps;
          effects.push(fn);
        }
      },
      useLayoutEffect() {},
    },
    "lucide-react": {},
    "./quick-start-flow": {},
    "./brand-direction": {},
    "./brand-sources": { BrandSources: "BrandSources" },
    "./research-suggestions": {},
    "@/lib/brand-research": research,
    "@/lib/brand-sources": sources,
    "@/lib/quick-start": quick,
    "@/lib/brand-preview": preview,
    "@/lib/onboarding": onboarding,
  };
  const exports: Record<string, (props: Record<string, unknown>) => unknown> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/brand-onboarding.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      window: { setTimeout: () => 1, clearTimeout() {}, scrollTo() {} },
      matchMedia: () => ({ matches: false }),
      require: (id: string) => {
        if (!(id in modules)) throw new Error(id);
        return modules[id];
      },
    },
  );
  const render = () => {
    cursor = 0;
    effectCursor = 0;
    changed = false;
    const tree = nodes(
      exports.BrandOnboarding({
        step: currentStep,
        data,
        onData: (update: quick.DemoData | ((data: quick.DemoData) => quick.DemoData)) => {
          data = typeof update === "function" ? update(data) : update;
        },
        onStep: (value: number) => {
          currentStep = value;
        },
        onResearch() {},
      }),
    );
    while (effects.length) effects.shift()!();
    return changed ? render() : tree;
  };
  return {
    render,
    data: () => data,
    step: () => currentStep,
    setStep: (value: number) => {
      currentStep = value;
    },
  };
}
const submitButton = (tree: Element[]) =>
  tree.find((x) => x.type === "button" && x.props.type === "submit")!;
const submit = (tree: Element[]) =>
  tree.find((x) => x.type === "form")!.props.onSubmit({ preventDefault() {} });

test("Confirmar minha marca is disabled until references are confirmed, including direct submission", () => {
  const initial = seed();
  initial.brand.referencesConfirmed = "";
  const ui = mount(initial);
  let tree = ui.render();
  assert.equal(submitButton(tree).props.disabled, true);
  submit(tree);
  assert.equal(ui.step(), 1);
  tree
    .find((x) => x.type === "input" && x.props.type === "checkbox")!
    .props.onChange({ target: { checked: true } });
  tree = ui.render();
  assert.equal(submitButton(tree).props.disabled, false);
  submit(tree);
  assert.equal(ui.step(), 2);
});

test("unsaved reference edits cannot bypass confirmation and cancel preserves the original", () => {
  const ui = mount();
  let tree = ui.render();
  const editor = tree.find((x) => x.type === "BrandSources")!.props.editor;
  assert.ok(editor);
  editor.onStart(sources.sourceIdentity("https://instagram.com/old"));
  tree = ui.render();
  assert.equal(submitButton(tree).props.disabled, true);
  submit(tree);
  assert.equal(ui.step(), 1);
  tree.find((x) => x.type === "BrandSources")!.props.editor.onCancel();
  assert.equal(submitButton(ui.render()).props.disabled, false);
  assert.equal(ui.data().brand.referencesConfirmed, "aurora.com|https://instagram.com/old");
});

test("leaving and revisiting context cancels pending edits instead of leaving an invisible blocker", () => {
  const ui = mount();
  ui.render()
    .find((x) => x.type === "BrandSources")!
    .props.editor.onStart(sources.sourceIdentity("https://instagram.com/old"));
  assert.equal(submitButton(ui.render()).props.disabled, true);
  ui.setStep(0);
  ui.render();
  ui.setStep(1);
  assert.equal(submitButton(ui.render()).props.disabled, false);
});

test("a refreshed source list cannot leave an editor for a vanished reference blocking manual entry", () => {
  const ui = mount();
  ui.render()
    .find((x) => x.type === "BrandSources")!
    .props.editor.onStart(sources.sourceIdentity("https://instagram.com/old"));
  ui.data().brand.research = preview.researchSchema.parse({});
  assert.equal(submitButton(ui.render()).props.disabled, false);
});

test("saving an inline edit updates the visible identity and requires fresh confirmation", () => {
  const ui = mount();
  const editor = () => ui.render().find((x) => x.type === "BrandSources")!.props.editor;
  assert.ok(editor());
  editor().onStart(sources.sourceIdentity("https://instagram.com/old"));
  editor().onChange("@new");
  editor().onSave();
  assert.equal(ui.data().brand.referencesConfirmed, "");
  assert.deepEqual([...ui.data().brand.extraLinks], ["https://instagram.com/new"]);
  assert.equal(submitButton(ui.render()).props.disabled, true);
});

test("saving a replacement official site returns to authorization before any new analysis", () => {
  const ui = mount();
  const editor = () => ui.render().find((x) => x.type === "BrandSources")!.props.editor;
  assert.ok(editor());
  editor().onStart(sources.sourceIdentity("https://aurora.com"));
  editor().onChange("newsite.com");
  editor().onSave();
  assert.equal(ui.step(), 0);
  assert.equal(ui.data().brand.aiAuthorized, false);
});

test("manual onboarding without references does not require a nonexistent link confirmation", () => {
  const data = seed();
  data.brand.research = preview.researchSchema.parse({});
  data.brand.referenceUrl = "";
  data.brand.referencesConfirmed = "";
  const ui = mount(data);
  assert.equal(submitButton(ui.render()).props.disabled, false);
  submit(ui.render());
  assert.equal(ui.step(), 2);
});
