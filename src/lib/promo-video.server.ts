import { spawn } from "node:child_process";
import { access, constants, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

// Requires a Node server, writable temporary storage and ffmpeg with libx264.
// Binary resolution order: explicit option, FFMPEG_PATH, `ffmpeg` on PATH,
// then the `ffmpeg-static` npm package (the only option on Vercel, whose
// functions have no system ffmpeg — vite.config.ts traces it into the
// server bundle). No remote inputs.
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_PNG_BYTES = 2_000_000;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 8_000_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_CONCURRENT = 2; // Per Node process; excess jobs are rejected, not queued.
const PROCESS_TIMEOUT_MS = 60_000;
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
let activeRenders = 0;

export class PromoVideoError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "PromoVideoError";
    this.code = code;
    this.status = status;
  }
}

function invalidFrames(): never {
  throw new PromoVideoError("INVALID_FRAMES", 400, "Envie de uma a três imagens PNG válidas.");
}
function tooLarge(): never {
  throw new PromoVideoError(
    "VIDEO_INPUT_TOO_LARGE",
    413,
    "As imagens excedem o limite da exportação.",
  );
}
function cancelled() {
  return new PromoVideoError("VIDEO_CANCELLED", 499, "A exportação foi cancelada.");
}

export async function readPromoVideoBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) tooLarge();
  if (request.signal.aborted) throw cancelled();
  if (!request.body) throw new PromoVideoError("INVALID_INPUT", 400, "Requisição inválida.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        tooLarge();
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof PromoVideoError) throw error;
    if (request.signal.aborted) throw cancelled();
    throw new PromoVideoError("INVALID_INPUT", 400, "Requisição inválida.");
  } finally {
    reader.releaseLock();
  }
}

export function decodePromoFrames(frames: unknown): Buffer[] {
  if (!Array.isArray(frames) || frames.length < 1 || frames.length > 3) invalidFrames();
  return frames.map((frame: unknown) => {
    const prefix = "data:image/png;base64,";
    if (typeof frame !== "string" || !frame.startsWith(prefix)) invalidFrames();
    const encoded = frame.slice(prefix.length);
    if (encoded.length > Math.ceil(MAX_PNG_BYTES / 3) * 4) tooLarge();
    if (!encoded.length || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
      invalidFrames();
    const png = Buffer.from(encoded, "base64");
    if (png.length > MAX_PNG_BYTES) tooLarge();
    if (
      png.toString("base64") !== encoded ||
      png.length < 45 ||
      !png.subarray(0, 8).equals(PNG_SIGNATURE)
    )
      invalidFrames();
    if (png.readUInt32BE(8) !== 13 || png.toString("ascii", 12, 16) !== "IHDR") invalidFrames();
    const width = png.readUInt32BE(16),
      height = png.readUInt32BE(20);
    if (
      !width ||
      !height ||
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION ||
      width * height > MAX_PIXELS
    )
      invalidFrames();
    // Canvas exports are 8-bit PNGs. Bound decoder allocations before ffmpeg.
    if (
      png[24] !== 8 ||
      ![0, 2, 3, 4, 6].includes(png[25]!) ||
      png[26] !== 0 ||
      png[27] !== 0 ||
      png[28]! > 1
    )
      invalidFrames();
    const chunks = [PNG_SIGNATURE];
    let offset = 8,
      count = 0,
      hasPixels = false,
      ended = false;
    while (offset + 12 <= png.length && ++count <= 4096) {
      const size = png.readUInt32BE(offset);
      const end = offset + 12 + size;
      if (end > png.length) invalidFrames();
      const type = png.toString("ascii", offset + 4, offset + 8);
      if (!/^[A-Za-z]{4}$/.test(type) || ["acTL", "fcTL", "fdAT"].includes(type)) invalidFrames();
      if (type === "IHDR" && offset !== 8) invalidFrames();
      if (type === "IDAT" && size > 0) hasPixels = true;
      if (type === "IEND") {
        if (size !== 0 || end !== png.length || !hasPixels) invalidFrames();
        ended = true;
      }
      if (["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(type))
        chunks.push(png.subarray(offset, end));
      else if (type[0] === type[0]!.toUpperCase()) invalidFrames();
      // Strip optional metadata (including compressed profiles/text) without
      // inflating it. Only the supplied pixels enter the image decoder.
      offset = end;
      if (ended) break;
    }
    if (!ended) invalidFrames();
    return Buffer.concat(chunks);
  });
}

async function isExecutable(file: string) {
  try {
    await access(file, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function ffmpegOnPath() {
  const dirs = (process.env["PATH"] || process.env["Path"] || "").split(delimiter).filter(Boolean);
  const exts =
    process.platform === "win32"
      ? (process.env["PATHEXT"] || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
      : [""];
  for (const dir of dirs)
    for (const ext of exts) if (await isExecutable(join(dir, `ffmpeg${ext}`))) return true;
  return false;
}

async function ffmpegStaticPath(): Promise<string | undefined> {
  try {
    const mod: unknown = await import("ffmpeg-static");
    const binary =
      typeof mod === "string" ? mod : (mod as { default?: unknown } | null | undefined)?.default;
    // null on unsupported platforms; missing file if its install script was skipped.
    if (typeof binary === "string" && binary && (await isExecutable(binary))) return binary;
  } catch {
    // Package absent or unloadable in this runtime; fall through.
  }
  return undefined;
}

let resolvedFallback: Promise<string> | undefined;
/** Exported for scripts/tests. The fallback part is memoized per process. */
export function resolveFfmpegCommand(explicit?: string): Promise<string> {
  const configured = explicit || process.env["FFMPEG_PATH"];
  if (configured) return Promise.resolve(configured);
  resolvedFallback ??= (async () =>
    (await ffmpegOnPath()) ? "ffmpeg" : ((await ffmpegStaticPath()) ?? "ffmpeg"))();
  return resolvedFallback;
}

async function runFfmpeg(command: string, args: string[], signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: "ignore", windowsHide: true });
    let failure: PromoVideoError | undefined;
    const stop = (error: PromoVideoError) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const onAbort = () => stop(cancelled());
    const timer = setTimeout(
      () =>
        stop(
          new PromoVideoError(
            "VIDEO_TIMEOUT",
            504,
            "A exportação demorou demais. Tente novamente.",
          ),
        ),
      PROCESS_TIMEOUT_MS,
    );
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    child.once("error", () => {
      cleanup();
      reject(
        new PromoVideoError(
          "VIDEO_UNAVAILABLE",
          503,
          "A exportação de vídeo não está disponível neste servidor.",
        ),
      );
    });
    // Wait for close after a kill so files are never removed while still in use.
    child.once("close", (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new PromoVideoError(
            "VIDEO_RENDER_FAILED",
            500,
            "Não foi possível compor o vídeo com estas imagens.",
          ),
        );
      else resolve();
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

/** Compose caller-supplied, already approved rasters; no AI scenes, copy or audio.
 * Approval is a caller-side prerequisite, not something PNG bytes can prove.
 */
export async function renderPromoVideo(
  frames: unknown,
  options: { signal?: AbortSignal; ffmpegPath?: string } = {},
): Promise<Uint8Array> {
  if (options.signal?.aborted) throw cancelled();
  if (activeRenders >= MAX_CONCURRENT)
    throw new PromoVideoError(
      "VIDEO_BUSY",
      429,
      "Há outras exportações em andamento. Tente novamente em instantes.",
    );
  activeRenders++;
  let directory: string | undefined;
  try {
    const images = decodePromoFrames(frames);
    directory = await mkdtemp(join(tmpdir(), "nukkia-promo-"));
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-filter_complex_threads",
      "1",
    ];
    for (const [index, png] of images.entries()) {
      const input = join(directory, `frame-${index}.png`);
      await writeFile(input, png, { flag: "wx", mode: 0o600 });
      args.push(
        "-threads",
        "1",
        "-protocol_whitelist",
        "file",
        "-f",
        "image2",
        "-pattern_type",
        "none",
        "-loop",
        "1",
        "-framerate",
        "24",
        "-t",
        "4",
        "-c:v",
        "png",
        "-i",
        input,
      );
    }
    const filters = images.map(
      (_, index) =>
        `[${index}:v]scale=720:900:force_original_aspect_ratio=decrease,pad=720:900:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,format=yuv420p,trim=duration=4,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.4,fade=t=out:st=3.6:d=0.4[v${index}]`,
    );
    filters.push(
      `${images.map((_, index) => `[v${index}]`).join("")}concat=n=${images.length}:v=1:a=0[out]`,
    );
    const output = join(directory, "video.mp4");
    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[out]",
      "-an",
      "-c:v",
      "libx264",
      "-threads",
      "2",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-maxrate",
      "3M",
      "-bufsize",
      "6M",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "24",
      "-t",
      String(images.length * 4),
      "-movflags",
      "+faststart",
      "-map_metadata",
      "-1",
      "-metadata",
      "comment=Composition of supplied approved raster frames with fades; no generated scenes or narration.",
      "-fs",
      String(MAX_OUTPUT_BYTES),
      output,
    );
    await runFfmpeg(await resolveFfmpegCommand(options.ffmpegPath), args, options.signal);
    if (options.signal?.aborted) throw cancelled();
    const size = (await stat(output)).size;
    if (size < 16 || size >= MAX_OUTPUT_BYTES)
      throw new PromoVideoError(
        "VIDEO_RENDER_FAILED",
        500,
        "O vídeo não pôde ser concluído dentro dos limites da exportação.",
      );
    const video = await readFile(output);
    if (video.toString("ascii", 4, 8) !== "ftyp")
      throw new PromoVideoError("VIDEO_RENDER_FAILED", 500, "O vídeo gerado é inválido.");
    return video;
  } finally {
    try {
      // This path comes only from mkdtemp above, never from a request or env var.
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      activeRenders--;
    }
  }
}
