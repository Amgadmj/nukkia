import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import * as brandStory from "../src/lib/brand-story.ts";

test("brandbook renders unchanged logos on both surfaces, mockups and escaped slogan proposals", () => {
  const html = brandStory.buildBrandBookDocument({
    company: { name: "<Aurora>", segment: "Pilates", website: null },
    diagnosticAnswers: { offers: "Aulas <script>ruins</script>", audience: "Adultos" },
    brandKit: { logo_url: "https://example.com/logo.png", palette: null, fonts: null, tone: null },
    story: null,
  });
  assert.match(html, /Superfície clara/);
  assert.match(html, /Superfície escura/);
  assert.match(html, /Cartão de visita/);
  assert.match(html, /Slogans · propostas/);
  assert.match(html, /Aulas &lt;script&gt;ruins&lt;\/script&gt; para Adultos/);
  assert.match(html, /Aulas &lt;script&gt;ruins&lt;\/script&gt;/);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("filter:"));
  assert.ok((html.match(/src="https:\/\/example.com\/logo.png"/g) ?? []).length >= 4);
});

test("story candidates use supplied answers without inventing missing intentions", () => {
  const candidate = brandStory.brandStoryCandidates({
    company: { name: "Aurora", segment: null, website: null },
    diagnosticAnswers: { offers: "Aulas individuais", audience: "Adultos" },
    brandKit: null,
    story: null,
  });
  assert.match(candidate.manifesto, /Aulas individuais/);
  assert.match(candidate.mission, /Adultos/);
  assert.equal(candidate.vision, "");
  assert.deepEqual(candidate.values, []);
});

test("HTML download uses the preview document, safe filename, and releases its object URL", async () => {
  const source = readFileSync(new URL("../src/components/brand-book.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let downloaded: Blob | undefined;
  const revoked: string[] = [];
  const deferred: (() => void)[] = [];
  let clicks = 0;
  let removed = false;
  const link = {
    href: "",
    download: "",
    click: () => {
      clicks++;
    },
    remove: () => {
      removed = true;
    },
  };
  const modules: Record<string, unknown> = {
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useRef: () => ({ current: null }),
      useState: (value: unknown) => [value, () => {}],
    },
    "react/jsx-runtime": jsx,
    "lucide-react": { Download: "svg", Printer: "svg" },
    sonner: {
      toast: {
        error: (message: string) => {
          throw new Error(message);
        },
      },
    },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/card": {
      Card: "div",
      CardContent: "div",
      CardDescription: "p",
      CardHeader: "div",
      CardTitle: "h2",
    },
    "@/lib/brand-story": brandStory,
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error("Unexpected import: " + name);
      return modules[name];
    },
    Blob,
    URL: {
      createObjectURL: (blob: Blob) => {
        downloaded = blob;
        return "blob:brandbook";
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    },
    window: {
      document: { createElement: () => link, body: { append: () => {} } },
      setTimeout: (callback: () => void) => {
        deferred.push(callback);
        return 1;
      },
    },
  });
  const input: brandStory.BrandBookInput = {
    company: { name: "../Clínica & Cia", segment: "Saúde", website: null },
    diagnosticAnswers: { audience: "Famílias locais" },
    brandKit: null,
    story: null,
  };
  const component = exports["BrandBook"] as (props: {
    input: brandStory.BrandBookInput;
  }) => unknown;
  const nodes: { type: unknown; props: Record<string, unknown> }[] = [];
  function visit(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === "object" && "props" in node) {
      const element = node as { type: unknown; props: Record<string, unknown> };
      nodes.push(element);
      visit(element.props["children"]);
    }
  }
  visit(component({ input }));
  const button = nodes.find(
    (node) =>
      node.type === "button" && JSON.stringify(node.props["children"]).includes("Baixar HTML"),
  );
  assert.ok(button);
  (button.props["onClick"] as () => void)();
  assert.equal(clicks, 1);
  assert.equal(link.download, "brandbook-clinica-cia.html");
  assert.equal(link.href, "blob:brandbook");
  assert.ok(downloaded);
  assert.equal(downloaded.type, "text/html;charset=utf-8");
  const html = await downloaded.text();
  assert.equal(html, nodes.find((node) => node.type === "iframe")?.props["srcDoc"]);
  assert.ok(html.includes("Clínica &amp; Cia"));
  assert.equal(removed, true);
  assert.deepEqual(revoked, []);
  deferred.forEach((callback) => callback());
  assert.deepEqual(revoked, ["blob:brandbook"]);
});
