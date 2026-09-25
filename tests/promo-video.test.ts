import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { deflateSync } from "node:zlib";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const encoder = new TextEncoder();
const BODY_LIMIT = 8 * 1024 * 1024;
const PNG_LIMIT = 2_000_000;
const mp4Stub = Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");
type VideoError = Error & { code: string; status: number };
type Renderer = {
  decodePromoFrames: (frames: unknown) => Buffer[];
  renderPromoVideo: (
    frames: unknown,
    options?: { signal?: AbortSignal; ffmpegPath?: string },
  ) => Promise<Uint8Array>;
  PromoVideoError: new (code: string, status: number, message: string) => VideoError;
};

function chunk(type: string, data: Buffer) {
  const content = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  content.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}

// Generate a real 2x2 RGB PNG without image packages or network fixtures.
function png(rgb = [220, 40, 30], width = 2, height = 2) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from([0, ...rgb, ...rgb, 0, ...rgb, ...rgb]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const dataUrl = (bytes = png()) => `data:image/png;base64,${bytes.toString("base64")}`;

function loadModule(
  file: string,
  modules: Record<string, unknown>,
  globals: Record<string, unknown> = {},
) {
  const url = new URL(`../src/${file}`, import.meta.url);
  assert.ok(existsSync(url), `Missing implementation: ${file}`);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    Buffer,
    Response,
    TextDecoder,
    Uint8Array,
    AbortSignal,
    setTimeout,
    clearTimeout,
    process: { env: {} },
    ...globals,
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  return exports;
}

function renderer(overrides: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  return loadModule(
    "lib/promo-video.server.ts",
    {
      "node:fs/promises": fs,
      "node:path": path,
      "node:os": os,
      "node:child_process": childProcess,
      ...overrides,
    },
    globals,
  ) as unknown as Renderer;
}

function endpoint(
  options: {
    authenticated?: boolean;
    user?: boolean;
    authError?: boolean;
    renderError?: VideoError;
  } = {},
) {
  const real = renderer();
  const renders: unknown[] = [];
  const requests: Request[] = [];
  const api = loadModule("routes/api/promo-video.ts", {
    "@tanstack/react-router": { createFileRoute: () => (config: unknown) => config },
    "@/lib/supabase-request.server": {
      userClientFromRequest: (request: Request) => {
        requests.push(request);
        return options.authenticated === false
          ? null
          : {
              auth: {
                getUser: async () => ({
                  data: { user: options.user === false ? null : { id: "owner" } },
                  error: options.authError ? { message: "Expired" } : null,
                }),
              },
            };
      },
    },
    "@/lib/promo-video.server": {
      ...real,
      renderPromoVideo: async (frames: unknown) => {
        real.decodePromoFrames(frames);
        renders.push(frames);
        if (options.renderError)
          throw new real.PromoVideoError(
            options.renderError.code,
            options.renderError.status,
            options.renderError.message,
          );
        return mp4Stub;
      },
    },
  }) as {
    Route: { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } };
  };
  const send = (body: BodyInit, headers: HeadersInit = {}) =>
    api.Route.server.handlers.POST({
      request: new Request("https://local.test/api/promo-video", {
        method: "POST",
        body,
        headers,
        duplex: "half",
      } as RequestInit),
    });
  return { renders, requests, send, post: (body: unknown) => send(JSON.stringify(body)) };
}

test("authenticated POST returns the MP4 attachment and identifies raster composition", async () => {
  const h = endpoint();
  const response = await h.post({ frames: [dataUrl()] });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="nukkia-video-promocional.mp4"',
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-description") ?? "", /raster/i);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), mp4Stub);
  assert.equal(h.renders.length, 1);
  assert.equal(h.requests.length, 1);
});

test("authentication is verified before reading the request body or invoking composition", async () => {
  for (const options of [{ authenticated: false }, { user: false }, { authError: true }]) {
    let reads = 0;
    const body = new ReadableStream(
      {
        pull(controller) {
          reads++;
          controller.enqueue(encoder.encode("{}"));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const h = endpoint(options);
    assert.equal((await h.send(body)).status, 401);
    assert.equal(reads, 0);
    assert.equal(h.renders.length, 0);
  }
});

test("invalid JSON/envelopes and frame counts cannot start rendering", async () => {
  const h = endpoint();
  assert.equal((await h.send("{")).status, 400);
  for (const body of [
    null,
    [],
    {},
    { frames: [] },
    { frames: [dataUrl(), dataUrl(), dataUrl(), dataUrl()] },
    { frames: "https://example.test/image.png" },
    { frames: [dataUrl()], prompt: "Invent copy" },
  ]) {
    assert.equal((await h.post(body)).status, 400);
  }
  assert.equal(h.renders.length, 0);
});

test("PNG validation rejects remote URLs, malformed base64, signatures, dimensions, truncation and animation", () => {
  const api = renderer();
  const animated = Buffer.concat([
    png().subarray(0, 33),
    chunk("acTL", Buffer.from([0, 0, 0, 2, 0, 0, 0, 0])),
    png().subarray(33),
  ]);
  for (const input of [
    "https://example.test/frame.png",
    "file:///tmp/frame.png",
    "data:image/jpeg;base64,YQ==",
    "data:image/png;base64,@@@@",
    "data:image/png;base64,YQ==",
    dataUrl(png([1, 2, 3], 0)),
    dataUrl(png([1, 2, 3], 4097)),
    dataUrl(png([1, 2, 3], 4000, 4000)),
    dataUrl(png().subarray(0, 33)),
    dataUrl(animated),
  ]) {
    assert.throws(
      () => api.decodePromoFrames([input]),
      (error: unknown) => (error as VideoError).status === 400,
    );
  }
  for (const count of [1, 2, 3])
    assert.equal(api.decodePromoFrames(Array(count).fill(dataUrl())).length, count);
});

test("decoded PNG size is limited before subprocess work", async () => {
  const oversized = dataUrl(Buffer.concat([png(), Buffer.alloc(PNG_LIMIT)]));
  assert.throws(
    () => renderer().decodePromoFrames([oversized]),
    (error: unknown) => (error as VideoError).status === 413,
  );
  const h = endpoint();
  assert.equal((await h.post({ frames: [oversized] })).status, 413);
  assert.equal(h.renders.length, 0);
});

test("body limit counts actual UTF-8 bytes with absent or false Content-Length", async () => {
  const h = endpoint();
  assert.equal((await h.send("{}", { "content-length": String(BODY_LIMIT + 1) })).status, 413);
  const body = JSON.stringify({ frames: ["é".repeat(BODY_LIMIT / 2)] });
  assert.ok(body.length < BODY_LIMIT);
  assert.equal((await h.send(body)).status, 413);
  assert.equal((await h.send(body, { "content-length": "1" })).status, 413);
  assert.equal(h.renders.length, 0);
  const valid = JSON.stringify({ frames: [dataUrl()] });
  assert.equal(
    (await h.send(valid + " ".repeat(BODY_LIMIT - Buffer.byteLength(valid)))).status,
    200,
  );
});

test("oversized streaming bodies are cancelled at the limit", async () => {
  let reads = 0,
    cancelled = false;
  const body = new ReadableStream(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(1024 * 1024).fill(32));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  assert.equal((await endpoint().send(body)).status, 413);
  assert.equal(reads, 9);
  assert.equal(cancelled, true);
});

async function processHarness(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nukkia-video-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobs: {
    child: EventEmitter & { kill: (signal: string) => boolean };
    command: string;
    args: string[];
    options: { shell?: boolean };
    kills: string[];
  }[] = [];
  const timers: { run: () => void; ms: number; active: boolean }[] = [];
  const api = renderer(
    {
      "node:os": { tmpdir: () => root },
      "node:child_process": {
        spawn(command: string, args: string[], options: { shell?: boolean }) {
          const kills: string[] = [];
          const child = Object.assign(new EventEmitter(), {
            kill(signal: string) {
              kills.push(signal);
              setImmediate(() => child.emit("close", null, signal));
              return true;
            },
          });
          jobs.push({ child, command, args, options, kills });
          return child;
        },
      },
    },
    {
      setTimeout: (run: () => void, ms: number) => {
        const timer = { run, ms, active: true };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer: { active: boolean }) => {
        timer.active = false;
      },
    },
  );
  return {
    api,
    root,
    jobs,
    timers,
    async waitJobs(count: number) {
      for (let i = 0; i < 100 && jobs.length < count; i++)
        await new Promise((resolve) => setImmediate(resolve));
      assert.equal(jobs.length, count);
    },
    async finish(index = 0) {
      const job = jobs[index]!;
      await fs.writeFile(job.args.at(-1)!, mp4Stub);
      job.child.emit("close", 0, null);
    },
  };
}

test("renderer bounds concurrency, uses argument arrays without a shell, and removes only its directories", async (t) => {
  const h = await processHarness(t);
  const keep = path.join(h.root, "unrelated.txt");
  await fs.writeFile(keep, "keep");
  const a = h.api.renderPromoVideo([dataUrl()]);
  const b = h.api.renderPromoVideo([dataUrl()]);
  await h.waitJobs(2);
  await assert.rejects(
    h.api.renderPromoVideo([dataUrl()]),
    (error: unknown) => (error as VideoError).code === "VIDEO_BUSY",
  );
  assert.equal(h.jobs[0]!.options.shell, false);
  assert.equal(h.jobs[0]!.command, "ffmpeg");
  assert.equal(h.jobs[0]!.args.includes("-nostdin"), true);
  assert.equal(h.jobs[0]!.args.includes("file"), true, "restrict input protocols to local files");
  await h.finish(0);
  await h.finish(1);
  await Promise.all([a, b]);
  assert.deepEqual(await fs.readdir(h.root), ["unrelated.txt"]);
  assert.equal(await fs.readFile(keep, "utf8"), "keep");
  const next = h.api.renderPromoVideo([dataUrl()]);
  await h.waitJobs(3);
  await h.finish(2);
  await next;
});

test("renderer kills at 60 seconds, waits for exit and cleans up on timeout", async (t) => {
  const h = await processHarness(t);
  const result = h.api.renderPromoVideo([dataUrl()]);
  const rejection = assert.rejects(
    result,
    (error: unknown) => (error as VideoError).code === "VIDEO_TIMEOUT",
  );
  await h.waitJobs(1);
  assert.equal(h.timers[0]!.ms, 60_000);
  h.timers[0]!.run();
  await rejection;
  assert.deepEqual(h.jobs[0]!.kills, ["SIGKILL"]);
  assert.deepEqual(await fs.readdir(h.root), []);
});

test("abort and spawn/encoder failure release resources without leaking filesystem details", async (t) => {
  const h = await processHarness(t);
  const controller = new AbortController();
  const result = h.api.renderPromoVideo([dataUrl()], { signal: controller.signal });
  const rejection = assert.rejects(
    result,
    (error: unknown) => (error as VideoError).code === "VIDEO_CANCELLED",
  );
  await h.waitJobs(1);
  controller.abort();
  await rejection;
  assert.deepEqual(h.jobs[0]!.kills, ["SIGKILL"]);
  const missing = h.api.renderPromoVideo([dataUrl()]);
  const unavailable = assert.rejects(
    missing,
    (error: unknown) => (error as VideoError).code === "VIDEO_UNAVAILABLE",
  );
  await h.waitJobs(2);
  h.jobs[1]!.child.emit(
    "error",
    Object.assign(new Error("/secret/ffmpeg missing"), { code: "ENOENT" }),
  );
  await unavailable;
  const failed = h.api.renderPromoVideo([dataUrl()]);
  const failedCheck = assert.rejects(
    failed,
    (error: unknown) => (error as VideoError).code === "VIDEO_RENDER_FAILED",
  );
  await h.waitJobs(3);
  h.jobs[2]!.child.emit("close", 1, null);
  await failedCheck;
  assert.deepEqual(await fs.readdir(h.root), []);
});

test("endpoint returns actionable busy/unavailable/timeout responses", async () => {
  const { PromoVideoError } = renderer();
  for (const [code, status] of [
    ["VIDEO_BUSY", 429],
    ["VIDEO_UNAVAILABLE", 503],
    ["VIDEO_TIMEOUT", 504],
  ] as const) {
    const h = endpoint({ renderError: new PromoVideoError(code, status, "Export unavailable") });
    const response = await h.post({ frames: [dataUrl()] });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    if (status === 429) assert.ok(response.headers.get("retry-after"));
  }
});

const ffmpeg =
  process.env.FFMPEG_PATH ||
  (existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");
const ffprobe =
  process.env.FFPROBE_PATH ||
  (existsSync("/opt/homebrew/bin/ffprobe") ? "/opt/homebrew/bin/ffprobe" : "ffprobe");
let binariesAvailable = true;
try {
  execFileSync(ffmpeg, ["-version"], { stdio: "ignore", timeout: 5000 });
  execFileSync(ffprobe, ["-version"], { stdio: "ignore", timeout: 5000 });
} catch {
  binariesAvailable = false;
}

test(
  "real tiny PNGs produce playable H264 MP4 with ordered frames, fades and faststart",
  { skip: !binariesAvailable, timeout: 60_000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nukkia-video-real-test-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const api = renderer({ "node:os": { tmpdir: () => root } });
    for (const count of [1, 3]) {
      const images = [
        dataUrl(png([220, 40, 30])),
        dataUrl(png([30, 210, 40])),
        dataUrl(png([30, 40, 220])),
      ].slice(0, count);
      const bytes = Buffer.from(await api.renderPromoVideo(images, { ffmpegPath: ffmpeg }));
      assert.deepEqual(
        await fs.readdir(root),
        [],
        "renderer must remove its temporary files before returning",
      );
      const output = path.join(root, "verified.mp4");
      await fs.writeFile(output, bytes);
      const probe = JSON.parse(
        execFileSync(
          ffprobe,
          ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", output],
          { encoding: "utf8", timeout: 20_000 },
        ),
      );
      assert.equal(probe.streams.length, 1, "there is no invented narration/audio");
      const video = probe.streams[0];
      assert.equal(video.codec_name, "h264");
      assert.equal(video.pix_fmt, "yuv420p");
      assert.equal(video.width, 720);
      assert.equal(video.height, 900);
      assert.equal(Number(video.nb_read_frames), count * 4 * 24);
      assert.ok(Math.abs(Number(probe.format.duration) - count * 4) < 0.1);
      assert.ok(
        bytes.indexOf(Buffer.from("moov")) < bytes.indexOf(Buffer.from("mdat")),
        "faststart metadata precedes media",
      );
      const pixelAt = (at: string) =>
        execFileSync(
          ffmpeg,
          [
            "-v",
            "error",
            "-ss",
            at,
            "-i",
            output,
            "-frames:v",
            "1",
            "-vf",
            "scale=1:1",
            "-pix_fmt",
            "rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { timeout: 10_000 },
        );
      assert.ok(
        [...pixelAt("0")].every((v) => v < 20),
        "starts with a fade from black",
      );
      const middle = pixelAt("2");
      assert.ok(middle[0]! > middle[1]! + 80, "first supplied red frame is visible");
      if (count === 3) {
        const second = pixelAt("6");
        assert.ok(second[1]! > second[0]! + 80, "second supplied green frame stays in order");
      }
      await fs.rm(output);
    }
  },
);
