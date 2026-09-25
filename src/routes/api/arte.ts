import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AiError } from "@/lib/ai.server";
import {
  generateCarousel,
  generateStaticArt,
  generateVideoStoryboard,
  startVideoRender,
} from "@/lib/content-engine";
import type { BrandKitLike } from "@/lib/content-engine/types";
import { checkAiQuota, quotaExceededResponse } from "@/lib/quota.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});

const failures = {
  "image-generation": [502, "Não foi possível gerar a imagem."],
  "image-save": [500, "Não foi possível salvar a imagem gerada."],
  "carousel-generation": [502, "Não foi possível gerar o carrossel."],
  "carousel-save": [500, "Não foi possível salvar o carrossel gerado."],
  "storyboard-generation": [502, "Não foi possível gerar o roteiro."],
  "storyboard-save": [500, "Não foi possível salvar o roteiro. O vídeo não foi iniciado."],
  "video-quota": [503, "O roteiro foi salvo, mas não foi possível verificar o limite de vídeo."],
  "video-start": [502, "O roteiro foi salvo, mas não foi possível iniciar o vídeo."],
  "video-operation-save": [
    500,
    "O vídeo foi iniciado, mas não foi possível registrar sua operação.",
  ],
} as const;

function failure(stage: keyof typeof failures, error?: unknown) {
  const [status, message] = failures[stage];
  // Log only the fixed stage; exceptions can contain prompts, keys or DB details.
  console.error(`[api/arte] ${stage} failed`);
  return new Response(message + (error instanceof AiError ? ` ${error.userMessage}` : ""), {
    status,
  });
}

export const Route = createFileRoute("/api/arte")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = userClientFromRequest(request);
        if (!supabase) return new Response("Não autenticado", { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Corpo da requisição inválido", { status: 400 });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { data: item } = await supabase
          .from("content_items")
          .select("id, company_id, title, caption, format, pillar, cta")
          .eq("id", parsed.data.contentItemId)
          .maybeSingle();
        if (!item || item.company_id !== parsed.data.companyId) {
          return new Response("Publicação não encontrada", { status: 404 });
        }

        const { data: company } = await supabase
          .from("companies")
          .select("name, segment")
          .eq("id", item.company_id)
          .maybeSingle();
        if (!company) return new Response("Empresa não encontrada", { status: 404 });

        const { data: brandKitRow } = await supabase
          .from("brand_kits")
          .select("palette, tone, fonts")
          .eq("company_id", item.company_id)
          .maybeSingle();
        // The DB stores palette/fonts as generic Json; the content engine
        // expects their known shape (BrandKitLike). Cast once at the
        // boundary rather than sprinkling `as` through every call site.
        const brandKit = brandKitRow as unknown as BrandKitLike;

        // Which quota bucket depends on the format — a carousel/video costs
        // more than a single image, so each has its own daily/monthly cap
        // (src/lib/quota.server.ts), but every branch below spends exactly
        // one unit regardless of how many images it produces internally.
        const kind =
          item.format === "carrossel"
            ? "carrossel"
            : item.format === "reels"
              ? "video_storyboard"
              : "arte";
        const allowed = await checkAiQuota(supabase, item.company_id, kind);
        if (!allowed) return quotaExceededResponse(kind);

        const brief = {
          title: item.title,
          format: item.format,
          pillar: item.pillar,
          caption: item.caption,
          cta: item.cta,
        };

        let stage: keyof typeof failures = "image-generation";
        try {
          if (item.format === "carrossel") {
            stage = "carousel-generation";
            const { slides, coverPath } = await generateCarousel(supabase, {
              company,
              brandKit,
              item: brief,
              contentItemId: item.id,
              companyId: item.company_id,
            });
            stage = "carousel-save";
            const { data: saved, error } = await supabase
              .from("content_items")
              .update({ slides, image_path: coverPath })
              .eq("id", item.id)
              .select("id")
              .maybeSingle();
            if (error || !saved) return failure(stage);
            return Response.json({ ok: true, format: "carrossel", slides: slides.length });
          }

          if (item.format === "reels") {
            stage = "storyboard-generation";
            const storyboard = await generateVideoStoryboard({ company, brandKit, item: brief });

            stage = "storyboard-save";
            const { data: savedStoryboard, error: storyboardError } = await supabase
              .from("content_items")
              .update({ storyboard })
              .eq("id", item.id)
              .select("id")
              .maybeSingle();
            if (storyboardError || !savedStoryboard) return failure(stage);

            // Kicking off the actual Veo render spends a second, separate
            // quota unit from the storyboard generation above — video
            // rendering is materially more expensive than a text call.
            stage = "video-quota";
            const renderAllowed = await checkAiQuota(supabase, item.company_id, "video_render");
            if (!renderAllowed) return quotaExceededResponse("video_render");

            stage = "video-start";
            const { operationName } = await startVideoRender({ company, brandKit, storyboard });
            stage = "video-operation-save";
            const { data: savedOperation, error: operationError } = await supabase
              .from("content_items")
              .update({
                video_operation: operationName,
                video_error: null,
                video_path: null,
              })
              .eq("id", item.id)
              .select("id")
              .maybeSingle();
            if (operationError || !savedOperation) return failure(stage);
            return Response.json({ ok: true, format: "reels", status: "rendering" });
          }

          const { imagePath } = await generateStaticArt(supabase, {
            company,
            brandKit,
            item: brief,
            contentItemId: item.id,
            companyId: item.company_id,
          });
          stage = "image-save";
          const { data: saved, error } = await supabase
            .from("content_items")
            .update({ image_path: imagePath })
            .eq("id", item.id)
            .select("id")
            .maybeSingle();
          if (error || !saved) return failure(stage);
          return Response.json({ ok: true, format: item.format });
        } catch (err) {
          return failure(stage, err);
        }
      },
    },
  },
});
