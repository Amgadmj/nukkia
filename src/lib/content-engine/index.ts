import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  AiError,
  checkVideoOperation,
  downloadVideoBytes,
  generateImageBase64,
  generateJson,
  startVideoGeneration,
} from "@/lib/ai.server";
import { buildStyleAnchor } from "./style-anchor";
import type {
  BrandKitLike,
  CarouselSlide,
  CompanyLike,
  ContentBrief,
  Storyboard,
  VideoJobStatus,
} from "./types";

export type { CarouselSlide, ContentBrief, Storyboard, VideoJobStatus } from "./types";

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Uploads a generated image to the `content-media` bucket and returns both
 * the storage path (durable, revocable, what should be persisted) and a
 * short-lived signed URL (convenience for immediate rendering). Callers
 * should store the path and re-sign on read once the UI supports it — see
 * the note on content_items.image_path in the migration.
 */
async function uploadGeneratedImage(
  supabase: SupabaseClient<Database>,
  companyId: string,
  contentItemId: string,
  bytes: Uint8Array,
  slideIndex = 0,
): Promise<{ path: string }> {
  const path = `${companyId}/${contentItemId}-${slideIndex}-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("content-media")
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) throw new AiError("Falha ao salvar a arte gerada.");
  return { path };
}

/** Same as uploadGeneratedImage but for a rendered video (mp4). */
async function uploadGeneratedVideo(
  supabase: SupabaseClient<Database>,
  companyId: string,
  contentItemId: string,
  bytes: Uint8Array,
): Promise<{ path: string }> {
  const path = `${companyId}/${contentItemId}-${Date.now()}.mp4`;
  const { error: uploadError } = await supabase.storage
    .from("content-media")
    .upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (uploadError) throw new AiError("Falha ao salvar o vídeo gerado.");
  return { path };
}

function briefLines(company: CompanyLike, item: ContentBrief): string[] {
  return [
    `Tema da publicação: ${item.title}.`,
    `Pilar: ${item.pillar ?? "educacional"}.`,
    item.cta ? `Chamada para ação: ${item.cta}.` : "",
  ].filter(Boolean);
}

/** Single square image — the original /api/arte behavior, generalized. */
export async function generateStaticArt(
  supabase: SupabaseClient<Database>,
  params: {
    company: CompanyLike;
    brandKit: BrandKitLike;
    item: ContentBrief;
    contentItemId: string;
    companyId: string;
  },
): Promise<{ imagePath: string }> {
  const anchor = buildStyleAnchor(params.company, params.brandKit);
  const prompt = [
    anchor,
    "Peça publicitária quadrada para redes sociais.",
    ...briefLines(params.company, params.item),
    `Inclua um título curto em português do Brasil, legível, com no máximo 6 palavras: "${params.item.title.slice(0, 60)}".`,
  ].join(" ");

  const b64 = await generateImageBase64(prompt);
  const { path } = await uploadGeneratedImage(
    supabase,
    params.companyId,
    params.contentItemId,
    base64ToBytes(b64),
  );
  return { imagePath: path };
}

const carouselOutlineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["slides"],
  properties: {
    slides: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "subtitulo"],
        properties: {
          titulo: { type: "string" },
          subtitulo: { type: "string" },
        },
      },
    },
  },
};

/**
 * N-slide carousel (cover → body → CTA), generalizing the AgrosTech carousel
 * pattern: instead of a fixed Pillow template with swapped copy, each slide
 * is rendered through the image gateway with the shared style anchor plus
 * slide-specific copy, so any SME's brand kit drives the same structure.
 */
export async function generateCarousel(
  supabase: SupabaseClient<Database>,
  params: {
    company: CompanyLike;
    brandKit: BrandKitLike;
    item: ContentBrief;
    contentItemId: string;
    companyId: string;
  },
): Promise<{ slides: CarouselSlide[]; coverPath: string }> {
  const outline = await generateJson<{ slides: { titulo: string; subtitulo: string }[] }>({
    schemaName: "carrossel_outline",
    schema: carouselOutlineSchema,
    instructions:
      "Você é redator de carrosséis para Instagram no Brasil. A partir do tema, quebre em 4 a 6 slides: " +
      "o primeiro é a capa (gancho curto), os do meio desenvolvem o assunto, o último traz a chamada para ação. " +
      "Cada título tem no máximo 8 palavras, cada subtítulo no máximo 16 palavras. Responda em português do Brasil.",
    input: [
      `Empresa: ${params.company.name}`,
      `Segmento: ${params.company.segment ?? "não informado"}`,
      `Tema: ${params.item.title}`,
      `Pilar: ${params.item.pillar ?? "educacional"}`,
      `Legenda de apoio: ${params.item.caption ?? "sem legenda"}`,
      `Chamada para ação: ${params.item.cta ?? "saiba mais"}`,
    ].join("\n"),
  });

  const anchor = buildStyleAnchor(params.company, params.brandKit);
  const total = outline.slides.length;
  const slides: CarouselSlide[] = [];

  // Sequential, not Promise.all: gentle on the gateway, and the quota check
  // already ran once for the whole carousel (see api/arte.ts), not per slide.
  for (let i = 0; i < total; i++) {
    const slide = outline.slides[i]!;
    const role =
      i === 0
        ? "Este é o slide de CAPA do carrossel, deve chamar atenção imediatamente."
        : i === total - 1
          ? "Este é o slide FINAL, reforce a chamada para ação de forma sutil."
          : `Este é o slide ${i + 1} de ${total}, desenvolve o assunto.`;
    const prompt = [
      anchor,
      "Slide vertical (4:5) de carrossel para Instagram.",
      role,
      `Texto principal no slide (curto, no máximo 8 palavras): "${slide.titulo}".`,
      slide.subtitulo ? `Texto secundário: "${slide.subtitulo}".` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const b64 = await generateImageBase64(prompt);
    const { path } = await uploadGeneratedImage(
      supabase,
      params.companyId,
      params.contentItemId,
      base64ToBytes(b64),
      i,
    );
    slides.push({ path, order: i });
  }

  const cover = slides[0]!;
  return { slides, coverPath: cover.path };
}

const storyboardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "duracao_total_seg", "shots"],
  properties: {
    titulo: { type: "string" },
    duracao_total_seg: { type: "integer" },
    shots: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ordem", "duracao_seg", "narracao", "visual_descricao"],
        properties: {
          ordem: { type: "integer" },
          duracao_seg: { type: "integer" },
          narracao: { type: "string" },
          visual_descricao: { type: "string" },
        },
      },
    },
  },
};

/**
 * Script + shot list for a short vertical video (reels/stories), in the same
 * 10-second-block shape used by the explainer-video production workflow.
 * This always succeeds and is always persisted — rendering the actual video
 * is a separate, optional step (see renderVideo below) so a missing render
 * provider never loses the creative work.
 */
export async function generateVideoStoryboard(params: {
  company: CompanyLike;
  brandKit: BrandKitLike;
  item: ContentBrief;
}): Promise<Storyboard> {
  const tone = params.brandKit?.tone?.trim() || "profissional e acolhedor";
  return generateJson<Storyboard>({
    schemaName: "video_storyboard",
    schema: storyboardSchema,
    instructions:
      "Você é roteirista de vídeos curtos verticais (Reels/Stories) para pequenas empresas brasileiras. " +
      "Divida o roteiro em blocos de aproximadamente 10 segundos (2 a 6 blocos, 15 a 45 segundos no total). " +
      "Cada bloco tem a narração (o que é dito/legendado) e a descrição visual (o que aparece na tela). " +
      "Responda em português do Brasil, sem promessas de resultado quando o segmento for saúde.",
    input: [
      `Empresa: ${params.company.name}`,
      `Segmento: ${params.company.segment ?? "não informado"}`,
      `Tom de voz: ${tone}`,
      `Tema: ${params.item.title}`,
      `Pilar: ${params.item.pillar ?? "educacional"}`,
      `Legenda de apoio: ${params.item.caption ?? "sem legenda"}`,
      `Chamada para ação: ${params.item.cta ?? "saiba mais"}`,
    ].join("\n"),
  });
}

/**
 * Turns a storyboard into a single Veo prompt. Veo takes one text prompt
 * per generation, not a multi-shot API — this collapses the storyboard's
 * blocks into one continuous scene description rather than attempting to
 * generate and stitch multiple clips (a real multi-shot editor is future
 * scope, not this pass).
 */
function buildVideoPrompt(
  company: CompanyLike,
  brandKit: BrandKitLike,
  storyboard: Storyboard,
): string {
  const anchor = buildStyleAnchor(company, brandKit);
  const scenes = storyboard.shots
    .sort((a, b) => a.ordem - b.ordem)
    .map((shot) => shot.visual_descricao)
    .join(" Em seguida, ");
  return [
    anchor,
    `Vídeo vertical curto para redes sociais, ${storyboard.duracao_total_seg} segundos.`,
    `Sequência: ${scenes}.`,
    "Sem texto sobreposto ilegível, sem marcas d'água.",
  ].join(" ");
}

/**
 * Kicks off a Veo render — an async, long-running operation (minutes), so
 * this returns immediately with the operation name rather than blocking.
 * The caller persists `operationName` (content_items.video_operation) and
 * polls it later via checkVideoRender.
 */
export async function startVideoRender(params: {
  company: CompanyLike;
  brandKit: BrandKitLike;
  storyboard: Storyboard;
  aspectRatio?: "16:9" | "9:16";
}): Promise<{ operationName: string }> {
  const prompt = buildVideoPrompt(params.company, params.brandKit, params.storyboard);
  return startVideoGeneration(prompt, { aspectRatio: params.aspectRatio ?? "9:16" });
}

/**
 * Polls a pending Veo operation. When it's finished successfully, downloads
 * the rendered video and uploads it into `content-media` (same
 * store-the-path-not-a-long-lived-URL pattern as generated images) before
 * returning "ready" — callers persist the result onto the content_items row.
 */
export async function checkVideoRender(
  supabase: SupabaseClient<Database>,
  params: { operationName: string; companyId: string; contentItemId: string },
): Promise<VideoJobStatus> {
  const status = await checkVideoOperation(params.operationName);
  if (!status.done) return { status: "rendering" };
  if ("error" in status) return { status: "failed", error: status.error };

  const bytes = await downloadVideoBytes(status.videoUri);
  const { path } = await uploadGeneratedVideo(
    supabase,
    params.companyId,
    params.contentItemId,
    bytes,
  );
  return { status: "ready", videoPath: path };
}
