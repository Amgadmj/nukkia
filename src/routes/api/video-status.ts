import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AiError } from "@/lib/ai.server";
import { checkVideoRender } from "@/lib/content-engine";
import { userClientFromRequest } from "@/lib/supabase-request.server";
import { consumeVideoUnit } from "@/lib/video-units.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});

const failedVideoMessage = "Não foi possível gerar o vídeo. Tente novamente.";
function saveFailure() {
  console.error("[api/video-status] video-status-save failed");
  return new Response("Não foi possível salvar o estado do vídeo. Tente verificar novamente.", {
    status: 500,
  });
}

/**
 * Polls a pending Veo render. Veo generation takes minutes — well beyond
 * any single request's budget — so /api/arte only ever kicks the job off;
 * the client (conteudo.tsx) calls this on an interval until it gets back
 * something other than "rendering".
 */
export const Route = createFileRoute("/api/video-status")({
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
          .select("id, company_id, video_operation, video_path")
          .eq("id", parsed.data.contentItemId)
          .maybeSingle();
        if (!item || item.company_id !== parsed.data.companyId) {
          return new Response("Publicação não encontrada", { status: 404 });
        }

        if (item.video_path) return Response.json({ status: "ready" });
        const operationName = item.video_operation;
        if (!operationName) return Response.json({ status: "none" });

        let saving = false;
        try {
          const result = await checkVideoRender(supabase, {
            operationName,
            companyId: item.company_id,
            contentItemId: item.id,
          });

          if (result.status === "rendering") return Response.json({ status: "rendering" });

          if (result.status === "ready") {
            saving = true;
            const { data: saved, error } = await supabase
              .from("content_items")
              .update({ video_path: result.videoPath, video_operation: null, video_error: null })
              .eq("id", item.id)
              .select("id")
              .maybeSingle();
            if (error || !saved) return saveFailure();
            // A finished video uses one unit of the customer's balance. The
            // ref is the render's operation, so polling twice charges once.
            // If the balance ran out meanwhile the video is still delivered:
            // the render cost is already spent.
            await consumeVideoUnit(supabase, item.company_id, `render:${operationName}`);
            return Response.json({ status: "ready" });
          }

          saving = true;
          const { data: saved, error } = await supabase
            .from("content_items")
            .update({ video_operation: null, video_error: failedVideoMessage })
            .eq("id", item.id)
            .select("id")
            .maybeSingle();
          if (error || !saved) return saveFailure();
          return Response.json({ status: "failed", error: failedVideoMessage });
        } catch (err) {
          if (saving) return saveFailure();
          const message =
            "Não foi possível verificar o vídeo." +
            (err instanceof AiError ? ` ${err.userMessage}` : "");
          console.error("[api/video-status] video-poll failed");
          return new Response(message, { status: 502 });
        }
      },
    },
  },
});
