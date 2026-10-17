import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function renderWithScrapling(
  url: string,
  resources: Record<string, { mime: string; body: string }>,
  signal: AbortSignal,
): Promise<string | null> {
  const python = process.env["SCRAPLING_PYTHON"];
  if (!python?.startsWith("/") || process.env["SCRAPLING_RENDER"] !== "1")
    return Promise.resolve(null);
  const input = JSON.stringify({ url, resources });
  if (Buffer.byteLength(input) > 4_000_000) return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(
      python,
      [fileURLToPath(new URL("../../scripts/scrapling/render.py", import.meta.url))],
      { stdio: ["pipe", "pipe", "ignore"], env: { PATH: process.env["PATH"] }, signal },
    );
    let output = "";
    const timer = setTimeout(() => child.kill(), 8000);
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.length > 2_000_000) child.kill();
    });
    child.stdin.on("error", () => {});
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const html: unknown = JSON.parse(output).html;
        resolve(
          code === 0 && typeof html === "string" && Buffer.byteLength(html) <= 1_000_000
            ? html
            : null,
        );
      } catch {
        resolve(null);
      }
    });
    child.stdin.end(input);
  });
}

/** Explicit optional local Python worker; URLs and credentials never enter Python. */
export function parseWithScrapling(html: string, signal: AbortSignal): Promise<string | null> {
  const python = process.env["SCRAPLING_PYTHON"];
  if (!python || !python.startsWith("/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(
      python,
      [fileURLToPath(new URL("../../scripts/scrapling/parse.py", import.meta.url))],
      {
        stdio: ["pipe", "pipe", "ignore"],
        env: { PATH: process.env["PATH"] },
        signal,
      },
    );
    let output = "";
    const timer = setTimeout(() => child.kill(), 3000);
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.length > 100000) child.kill();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.stdin.on("error", () => {
      /* Worker exit: use the existing parser. */
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const parsed: unknown = JSON.parse(output);
        const text = (parsed as { text?: unknown })?.text;
        resolve(code === 0 && typeof text === "string" && text.length <= 10000 ? text : null);
      } catch {
        resolve(null);
      }
    });
    child.stdin.end(html);
  });
}

/** Raster logo palette, computed locally. Optional Pillow dependency. */
export function logoPalette(bytes: Buffer, signal: AbortSignal): Promise<string[]> {
  const python = process.env["SCRAPLING_PYTHON"];
  if (!python?.startsWith("/")) return Promise.resolve([]);
  return new Promise((resolve) => {
    const child = spawn(
      python,
      [fileURLToPath(new URL("../../scripts/scrapling/parse.py", import.meta.url)), "--palette"],
      { stdio: ["pipe", "pipe", "ignore"], env: { PATH: process.env["PATH"] }, signal },
    );
    let output = "";
    const timer = setTimeout(() => child.kill(), 3000);
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.length > 10000) child.kill();
    });
    child.stdin.on("error", () => {});
    child.on("error", () => {
      clearTimeout(timer);
      resolve([]);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const colors: unknown = JSON.parse(output).colors;
        resolve(
          code === 0 && Array.isArray(colors)
            ? colors
                .filter((v): v is string => typeof v === "string" && /^#[a-f\d]{6}$/i.test(v))
                .slice(0, 6)
            : [],
        );
      } catch {
        resolve([]);
      }
    });
    child.stdin.end(bytes.toString("base64"));
  });
}
