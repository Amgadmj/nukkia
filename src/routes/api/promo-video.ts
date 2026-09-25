import { createFileRoute } from "@tanstack/react-router";
import { userClientFromRequest } from "@/lib/supabase-request.server";
import { PromoVideoError, readPromoVideoBody, renderPromoVideo } from "@/lib/promo-video.server";

function json(body: unknown, status: number, retry = false) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...(retry ? { "Retry-After": "5" } : {}) },
  });
}

export const Route = createFileRoute("/api/promo-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const client = userClientFromRequest(request);
          if (!client) return json({ code: "UNAUTHENTICATED", message: "Não autenticado" }, 401);
          const { data: auth, error } = await client.auth.getUser();
          if (error || !auth.user)
            return json({ code: "UNAUTHENTICATED", message: "Não autenticado" }, 401);
          const body = await readPromoVideoBody(request);
          if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !("frames" in body)
          )
            return json(
              { code: "INVALID_INPUT", message: "Envie apenas as imagens PNG da peça aprovada." },
              400,
            );
          const bytes = new Uint8Array(
            await renderPromoVideo(body.frames, { signal: request.signal }),
          );
          return new Response(bytes.buffer, {
            headers: {
              "Content-Type": "video/mp4",
              "Content-Disposition": 'attachment; filename="nukkia-video-promocional.mp4"',
              "Content-Length": String(bytes.byteLength),
              "Content-Description":
                "Composition of caller-supplied approved raster frames with fades; no generated scenes or narration.",
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          if (error instanceof PromoVideoError)
            return json(
              { code: error.code, message: error.message },
              error.status,
              error.status === 429,
            );
          return json(
            {
              code: "VIDEO_RENDER_FAILED",
              message: "Não foi possível exportar o vídeo. Tente novamente.",
            },
            500,
          );
        }
      },
    },
  },
});
