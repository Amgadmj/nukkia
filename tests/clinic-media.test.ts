import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as media from "../src/lib/clinic-media.ts";
import {
  clinicMediaPrefix,
  clinicMediaPath,
  validateClinicMedia,
} from "../src/lib/clinic-media.ts";

const company = "550e8400-e29b-41d4-a716-446655440000";
const upload = "b47e8400-e29b-41d4-a716-446655440001";
const file = { name: "foto.png", type: "image/png", size: 128 };

test("only supported nonempty media up to the bucket boundary is accepted", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp", "video/mp4"]) {
    assert.equal(validateClinicMedia({ ...file, type, size: 52_428_800 }, true), null);
  }
  for (const size of [0, -1, NaN, Infinity, 52_428_801]) {
    assert.ok(validateClinicMedia({ ...file, size }, true));
  }
  for (const type of ["", "image/svg+xml", "image/gif", "video/quicktime", "text/html"]) {
    assert.ok(validateClinicMedia({ ...file, type }, true));
  }
});

test("upload requires both a selected file and explicit ownership or license confirmation", () => {
  assert.ok(validateClinicMedia(null, true));
  assert.ok(validateClinicMedia(file, false));
  assert.equal(validateClinicMedia(file, true), null);
});

test("company prefix and upload paths stay inside the company's uploads directory", () => {
  assert.equal(clinicMediaPrefix(company), `${company}/uploads`);
  assert.equal(
    clinicMediaPath(company, "../../Foto da clínica 🩺.png", upload),
    `${company}/uploads/${upload}-Foto-da-clinica-.png`,
  );
  assert.notEqual(
    clinicMediaPath(company, file.name, upload),
    clinicMediaPath(company, file.name, company),
  );
  for (const invalid of ["", "../company", `${company}/elsewhere`, "not-a-uuid"]) {
    assert.throws(() => clinicMediaPrefix(invalid));
    assert.throws(() => clinicMediaPath(invalid, file.name, upload));
    assert.throws(() => clinicMediaPath(company, file.name, invalid));
  }
});

test("unsafe, empty and excessive filenames produce bounded safe object names", () => {
  assert.equal(clinicMediaPath(company, "../🩺", upload), `${company}/uploads/${upload}-arquivo`);
  const path = clinicMediaPath(company, `${"a".repeat(500)}.png`, upload);
  assert.ok(path.split("/").at(-1)!.length <= 157);
  assert.match(path, /^[a-zA-Z0-9/._-]+$/);
});

type Props = Record<string, unknown> & {
  onChange: (event: { target: { files?: (typeof file)[]; checked?: boolean } }) => void;
  onSubmit: (event: { preventDefault(): void }) => Promise<void>;
  onClick: () => Promise<void> | void;
};
type Node = { type: unknown; key?: string; props: Props };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness() {
  let cursor = 0;
  let state: unknown[] = [];
  let writes = 0;
  let effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  const pending: (() => void)[] = [];
  const calls: { action: string; args: unknown[] }[] = [];
  const responses: Record<string, unknown> = {
    list: { data: [], error: null },
    upload: { data: { path: "uploaded" }, error: null },
    createSignedUrl: { data: { signedUrl: "https://storage.example/temporary" }, error: null },
  };
  const storage = Object.fromEntries(
    Object.keys(responses).map((action) => [
      action,
      (...args: unknown[]) => {
        calls.push({ action, args });
        return Promise.resolve(responses[action]);
      },
    ]),
  );
  const deps: Record<string, unknown> = {
    "@/lib/clinic-media": media,
    "@/integrations/supabase/client": {
      supabase: {
        storage: {
          from(bucket: string) {
            assert.equal(bucket, "content-media");
            return storage;
          },
        },
      },
    },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/input": { Input: "input" },
    react: {
      useState(initial: unknown) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [
          state[index],
          (value: unknown) => {
            writes++;
            state[index] = typeof value === "function" ? value(state[index]) : value;
          },
        ];
      },
      useRef(initial: unknown) {
        const index = cursor++;
        return (state[index] ??= { current: initial });
      },
      useEffect(effect: () => (() => void) | void, next: unknown[]) {
        const index = cursor++;
        const previous = effects[index];
        if (!previous || next.some((value, i) => value !== previous.deps[i])) {
          pending.push(() => {
            previous?.cleanup?.();
            effects[index] = { deps: next, cleanup: effect() || undefined };
          });
        }
      },
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: object, key?: string) => ({ type, props, key }),
      jsxs: (type: unknown, props: object, key?: string) => ({ type, props, key }),
    },
  };
  const exports = {} as { ClinicMediaLibrary: (props: { companyId: string | undefined }) => Node };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../src/components/clinic-media-library.tsx", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      require: (id: string) => {
        assert.ok(id in deps, `Unexpected dependency: ${id}`);
        return deps[id];
      },
      crypto: { randomUUID: () => upload },
      setTimeout,
      clearTimeout,
    },
  );
  let currentCompany: string | undefined;
  let currentKey: unknown;
  function unmount() {
    effects.forEach((effect) => effect?.cleanup?.());
    effects = [];
    state = [];
  }
  return {
    calls,
    responses,
    unmount,
    writes: () => writes,
    render(id = currentCompany) {
      currentCompany = id;
      const root = exports.ClinicMediaLibrary({ companyId: id });
      if (currentKey !== root.key) {
        unmount();
        currentKey = root.key;
      }
      cursor = 0;
      const result = typeof root.type === "function" ? root.type(root.props) : root;
      pending.splice(0).forEach((run) => run());
      return nodes(result);
    },
  };
}
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function selectAndConfirm(ui: ReturnType<typeof harness>) {
  ui.render()
    .find((n) => n.props.type === "file")!
    .props.onChange({ target: { files: [file] } });
  ui.render()
    .find((n) => n.props.type === "checkbox")!
    .props.onChange({ target: { checked: true } });
}
function submit(ui: ReturnType<typeof harness>) {
  return ui
    .render()
    .find((n) => n.type === "form")!
    .props.onSubmit({ preventDefault() {} });
}

test("missing or malformed company never accesses storage", () => {
  const ui = harness();
  ui.render();
  ui.render("../other");
  assert.equal(ui.calls.length, 0);
  ui.unmount();
});

test("listing is private, company scoped, paginated and never requests preview URLs automatically", async () => {
  const ui = harness();
  ui.responses.list = {
    data: Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      name: `photo-${i}.png`,
      metadata: { mimetype: "image/png" },
    })),
    error: null,
  };
  ui.render(company);
  ui.responses.list = {
    data: [{ id: "last", name: "last.mp4", metadata: { mimetype: "video/mp4" } }],
    error: null,
  };
  await settle();
  assert.deepEqual(
    ui.calls.map((call) => [
      call.action,
      call.args[0],
      (call.args[1] as { offset: number }).offset,
    ]),
    [
      ["list", `${company}/uploads`, 0],
      ["list", `${company}/uploads`, 100],
    ],
  );
  assert.equal(ui.render().filter((n) => n.type === "li").length, 101);
  ui.unmount();
});

test("bucket errors remain visible rather than presenting an empty successful library", async () => {
  const ui = harness();
  ui.responses.list = { data: null, error: { message: "Bucket not found" } };
  ui.render(company);
  await settle();
  assert.ok(ui.render().some((n) => n.props.role === "alert"));
  assert.equal(ui.render().filter((n) => n.type === "li").length, 0);
  ui.unmount();
});

test("upload validates consent, refuses double submissions and never overwrites", async () => {
  const ui = harness();
  ui.render(company);
  await settle();
  await submit(ui);
  assert.equal(ui.calls.filter((c) => c.action === "upload").length, 0);
  selectAndConfirm(ui);
  const pending = deferred();
  ui.responses.upload = pending.promise;
  const first = submit(ui);
  await submit(ui);
  const request = ui.calls.find((c) => c.action === "upload")!;
  assert.equal(ui.calls.filter((c) => c.action === "upload").length, 1);
  assert.equal(request.args[0], `${company}/uploads/${upload}-foto.png`);
  assert.equal((request.args[2] as { upsert: boolean }).upsert, false);
  assert.equal((request.args[2] as { contentType: string }).contentType, "image/png");
  pending.resolve({ data: { path: request.args[0] }, error: null });
  await first;
  assert.equal(ui.render().find((n) => n.props.type === "checkbox")!.props.checked, false);
  ui.unmount();
});

test("preview is signed only on click and can be closed", async () => {
  const ui = harness();
  ui.responses.list = {
    data: [{ id: "photo", name: "photo.png", metadata: { mimetype: "image/png" } }],
    error: null,
  };
  ui.render(company);
  await settle();
  await ui
    .render()
    .find((n) => n.type === "button" && n.props.children === "Visualizar")!
    .props.onClick();
  const request = ui.calls.find((c) => c.action === "createSignedUrl")!;
  assert.deepEqual(request.args, [`${company}/uploads/photo.png`, 60]);
  assert.ok(
    ui
      .render()
      .some((n) => n.type === "img" && n.props.src === "https://storage.example/temporary"),
  );
  ui.render()
    .find((n) => n.type === "button" && n.props.children === "Fechar prévia")!
    .props.onClick();
  assert.equal(ui.render().filter((n) => n.type === "img").length, 0);
  ui.unmount();
});

test("company switch discards consent, files, previews and late upload results", async () => {
  const ui = harness();
  ui.render(company);
  await settle();
  selectAndConfirm(ui);
  const pending = deferred();
  ui.responses.upload = pending.promise;
  const first = submit(ui);
  ui.render(upload);
  await settle();
  const before = ui.calls.length;
  pending.resolve({ data: { path: "old" }, error: null });
  await first;
  assert.equal(ui.calls.length, before, "late upload must not refresh the new company");
  assert.equal(ui.render().find((n) => n.props.type === "checkbox")!.props.checked, false);
  assert.equal(
    ui.render().find((n) => n.type === "button" && n.props.children === "Enviar arquivo")!.props
      .disabled,
    true,
  );
  ui.unmount();
});

test("unmounted list and preview requests cannot update state", async () => {
  const listing = harness();
  const pendingList = deferred();
  listing.responses.list = pendingList.promise;
  listing.render(company);
  listing.unmount();
  const listWrites = listing.writes();
  pendingList.resolve({
    data: [{ id: "old", name: "old.png", metadata: { mimetype: "image/png" } }],
    error: null,
  });
  await settle();
  assert.equal(listing.writes(), listWrites);

  const previewing = harness();
  previewing.responses.list = {
    data: [{ id: "photo", name: "photo.png", metadata: { mimetype: "image/png" } }],
    error: null,
  };
  previewing.render(company);
  await settle();
  const pendingPreview = deferred();
  previewing.responses.createSignedUrl = pendingPreview.promise;
  const preview = previewing
    .render()
    .find((n) => n.props.children === "Visualizar")!
    .props.onClick();
  previewing.unmount();
  const previewWrites = previewing.writes();
  pendingPreview.resolve({
    data: { signedUrl: "https://storage.example/old-company" },
    error: null,
  });
  await preview;
  assert.equal(previewing.writes(), previewWrites);
});

test("file replacement resets consent and failed upload preserves selected material for retry", async () => {
  const ui = harness();
  ui.render(company);
  await settle();
  selectAndConfirm(ui);
  ui.render()
    .find((n) => n.props.type === "file")!
    .props.onChange({ target: { files: [{ ...file, name: "replacement.png" }] } });
  assert.equal(ui.render().find((n) => n.props.type === "checkbox")!.props.checked, false);
  await submit(ui);
  assert.equal(ui.calls.filter((c) => c.action === "upload").length, 0);
  ui.render()
    .find((n) => n.props.type === "checkbox")!
    .props.onChange({ target: { checked: true } });
  ui.responses.upload = { data: null, error: { message: "Bucket not found" } };
  await submit(ui);
  assert.ok(ui.render().some((n) => n.props.role === "alert"));
  assert.equal(
    ui.render().find((n) => n.props.children === "Enviar arquivo")!.props.disabled,
    false,
  );
  ui.unmount();
});

test("preview failures show an error and closing a pending preview prevents late display", async () => {
  const ui = harness();
  ui.responses.list = {
    data: [{ id: "photo", name: "photo.png", metadata: { mimetype: "image/png" } }],
    error: null,
  };
  ui.render(company);
  await settle();
  ui.responses.createSignedUrl = { data: null, error: { message: "Denied" } };
  await ui
    .render()
    .find((n) => n.props.children === "Visualizar")!
    .props.onClick();
  assert.ok(ui.render().some((n) => n.props.role === "alert"));
  const pending = deferred();
  ui.responses.createSignedUrl = pending.promise;
  const opening = ui
    .render()
    .find((n) => n.props.children === "Visualizar")!
    .props.onClick();
  ui.render()
    .find((n) => n.props.children === "Fechar prévia")!
    .props.onClick();
  pending.resolve({ data: { signedUrl: "https://storage.example/late" }, error: null });
  await opening;
  assert.equal(ui.render().filter((n) => n.type === "img").length, 0);
  ui.unmount();
});
