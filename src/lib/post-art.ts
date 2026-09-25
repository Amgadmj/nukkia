import { zipSync, strToU8 } from "fflate";
import {
  CTA_OPTIONS,
  type BrandPreview,
  type FirstPostBrief,
  type PostCopy,
  type ContentApproach,
} from "./brand-preview.ts";

export const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
export function wrapCopy(value: string, width: number): string[] {
  const words = value
    .trim()
    .split(/\s+/)
    .flatMap((word) =>
      word.length > width ? (word.match(new RegExp(`.{1,${width}}`, "gu")) ?? []) : [word],
    );
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && last.length + word.length + 1 <= width) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}
const raster = (value: string) =>
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
export function postSvg(
  brief: FirstPostBrief,
  copy: PostCopy,
  brand: Pick<BrandPreview, "accent" | "logo" | "photo"> &
    Partial<Pick<BrandPreview, "visualStyle">>,
  layout: { approach: ContentApproach; page: number; total: number } = {
    approach: "invite",
    page: 1,
    total: 1,
  },
) {
  const accent = /^#[a-fA-F0-9]{6}$/.test(brand.accent) ? brand.accent : "#395D51";
  const photo = raster(brand.photo),
    logo = raster(brand.logo);
  const style = brand.visualStyle;
  const dynamic = style === "dynamic";
  const background = dynamic ? "#111318" : style === "warm" ? "#f2e6dc" : "#f5f3ed";
  const ink = dynamic ? "#f7f6f2" : "#1c2822";
  const secondary = dynamic ? "#c4cad2" : "#53615a";
  const font = style === "warm" ? "Georgia,serif" : "Arial,sans-serif";
  const photoLed = layout.approach === "trust" || style === "warm";
  const title = wrapCopy(copy.title.slice(0, 78), 24);
  const body = wrapCopy(copy.body.slice(0, 180), photoLed ? 40 : 48);
  const titleSize = Math.min(62, 920 / (Math.max(1, ...title.map((line) => line.length)) * 0.95));
  const effectiveTitleSize = photoLed ? Math.min(titleSize, 38) : titleSize;
  const readableBodySize = Math.min(
    photoLed ? 26 : 30,
    920 / (Math.max(1, ...body.map((line) => line.length)) * 0.95),
  );
  // Reserve readable text first; a long valid draft gets a smaller photo,
  // never a tiny-font export that merely fits inside the canvas.
  const titleY = photoLed
    ? Math.min(
        870,
        1160 - title.length * effectiveTitleSize * 1.25 - 28 - body.length * readableBodySize * 1.5,
      )
    : 290;
  const photoHeight = photoLed ? titleY - 320 : 330;
  const bodyY = titleY + title.length * effectiveTitleSize * 1.25 + 28;
  const bodySize = photoLed
    ? readableBodySize
    : Math.min(readableBodySize, (790 - bodyY) / Math.max(1, body.length * 1.5));
  const brandName = wrapCopy(brief.name, logo ? 45 : 65);
  const brandSize = Math.min(
    24,
    (logo ? 710 : 950) / (Math.max(1, ...brandName.map((line) => line.length)) * 0.95),
  );
  const textLines = (lines: string[], x: number, y: number, lineHeight: number) =>
    lines
      .map((line, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${escapeXml(line)}</tspan>`)
      .join("");
  const cta = CTA_OPTIONS.find((option) => option.value === brief.action)!.copy;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><clipPath id="photo"><rect x="60" y="${photoLed ? 240 : 820}" width="960" height="${photoHeight}" rx="26"/></clipPath></defs>
  <rect width="1080" height="1350" fill="${background}"/>
  <rect x="0" width="14" height="1350" fill="${accent}"/>
  ${logo ? `<rect x="60" y="58" width="208" height="100" rx="12" fill="white"/><image href="${logo}" x="70" y="68" width="188" height="80" preserveAspectRatio="xMidYMid meet"/>` : ""}
  <text font-family="Arial,sans-serif" font-size="${brandSize}" font-weight="600" fill="${ink}">${textLines(brandName, logo ? 300 : 64, 100, brandSize * 1.4)}</text>
  <path d="M64 205H1016" stroke="#cccfc7"/>
  <text font-family="${font}" font-size="${effectiveTitleSize}" letter-spacing="-2" font-weight="700" fill="${ink}">${textLines(title, 60, titleY, effectiveTitleSize * 1.25)}</text>
  <text font-family="Arial,sans-serif" font-size="${bodySize}" fill="${secondary}">${textLines(body, 64, bodyY, bodySize * 1.5)}</text>
  ${
    photoLed
      ? `<rect x="60" y="240" width="960" height="${photoHeight}" rx="26" fill="${accent}"/>${photo ? `<image href="${photo}" x="60" y="240" width="960" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>` : `<text x="540" y="${250 + photoHeight / 2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="white">Adicione uma foto da marca</text>`}`
      : dynamic
        ? `<path d="M60 900 1020 800V1060L60 1160Z" fill="${accent}"/><path d="M130 1030H420m-70-70 70 70-70 70" stroke="white" stroke-width="8" fill="none"/><text x="900" y="1000" text-anchor="end" font-family="Arial,sans-serif" font-size="96" font-weight="700" fill="white">0${layout.page}</text>`
        : style === "essential"
          ? `<path d="M64 880H1016" stroke="${accent}" stroke-width="2"/><text x="64" y="1070" font-family="Georgia,serif" font-size="130" fill="${accent}">0${layout.page}</text><text x="1016" y="1070" text-anchor="end" font-family="Arial,sans-serif" font-size="24" fill="${ink}">/ 0${layout.total}</text>`
          : layout.approach === "educate"
            ? `<rect x="60" y="820" width="960" height="330" rx="26" fill="${accent}"/><text x="116" y="1018" font-family="Arial,sans-serif" font-size="112" fill="white">0${layout.page}</text><text x="850" y="1080" font-family="Arial,sans-serif" font-size="28" fill="white">/ 0${layout.total}</text>`
            : photo
              ? `<image href="${photo}" x="60" y="820" width="960" height="330" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>`
              : `<rect x="60" y="820" width="960" height="330" rx="26" fill="${accent}"/><circle cx="850" cy="983" r="128" fill="none" stroke="#ffffff" opacity=".23" stroke-width="2"/><circle cx="850" cy="983" r="81" fill="none" stroke="#ffffff" opacity=".3" stroke-width="2"/><path d="M116 986h110m-36-36 36 36-36 36" stroke="white" stroke-width="4" fill="none"/>`
  }
  <text x="64" y="1230" font-family="Arial,sans-serif" font-size="29" font-weight="600" fill="${ink}">${escapeXml(cta)}</text>
  <path d="M966 1218h42m-14-14 14 14-14 14" stroke="${ink}" stroke-width="3" fill="none"/>
  </svg>`;
}
export const svgUrl = (svg: string) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
export async function renderPng(svg: string): Promise<Uint8Array> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não foi possível renderizar a imagem."));
    image.src = svgUrl(svg);
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Falha ao exportar a arte."))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
export function publicationZip(png: Uint8Array | Uint8Array[], caption: string, sources: string[]) {
  const images = Array.isArray(png)
    ? Object.fromEntries(
        png.map((bytes, index) => [
          png.length === 1
            ? "publicacao.png"
            : `publicacao-${String(index + 1).padStart(2, "0")}.png`,
          bytes,
        ]),
      )
    : { "publicacao.png": png };
  return zipSync({
    ...images,
    "legenda.txt": strToU8(caption),
    "referencias.txt": strToU8(
      ["Contexto confirmado pelo usuário. Revise antes de publicar.", ...sources].join("\n"),
    ),
  });
}
export async function prepareAsset(file: File, logo: boolean): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5_000_000)
    throw new Error("Use PNG, JPG ou WebP de até 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não conseguimos abrir esta imagem."));
      image.src = url;
    });
    const scale = Math.min(1, (logo ? 512 : 1200) / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL(logo ? "image/png" : "image/jpeg", 0.85);
    if (data.length > 1_500_000) throw new Error("Escolha uma imagem menor para esta prévia.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
