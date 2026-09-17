import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AiError } from "@/lib/ai.server";
import {
  generateCarousel,
  generateStaticArt,
  generateVideoStoryboard,
  renderVideo,
} from "@/lib/content-engine";
import type { BrandKitLike } from "@/lib/content-engine/types";
import { checkAiQuota, quotaExceededResponse } from "@/lib/quota.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});

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

        try {
          if (item.format === "carrossel") {
            const { slides, coverPath, coverUrl } = await generateCarousel(supabase, {
              company,
              brandKit,
              item: brief,
              contentItemId: item.id,
              companyId: item.company_id,
            });
            await supabase
              .from("content_items")
              .update({ slides, image_path: coverPath, image_url: coverUrl })
              .eq("id", item.id);
            return Response.json({ ok: true, format: "carrossel", slides: slides.length });
          }

          if (item.format === "reels") {
            const storyboard = await generateVideoStoryboard({ company, brandKit, item: brief });
            const rendered = await renderVideo(storyboard);
            await supabase
              .from("content_items")
              .update({
                storyboard,
                video_url: rendered.status === "rendered" ? rendered.videoUrl : null,
              })
              .eq("id", item.id);
            return Response.json({ ok: true, format: "reels", status: rendered.status });
          }

          const { imagePath, imageUrl } = await generateStaticArt(supabase, {
            company,
            brandKit,
            item: brief,
            contentItemId: item.id,
            companyId: item.company_id,
          });
          await supabase
            .from("content_items")
            .update({ image_path: imagePath, image_url: imageUrl })
            .eq("id", item.id);
          return Response.json({ ok: true, format: item.format, url: imageUrl });
        } catch (err) {
          const message = err instanceof AiError ? err.userMessage : "Erro ao gerar a peça.";
          if (!(err instanceof AiError)) console.error("[api/arte] unexpected error:", err);
          return new Response(message, { status: 502 });
        }
      },
    },
  },
});
