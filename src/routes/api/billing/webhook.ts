import { createFileRoute } from "@tanstack/react-router";
import { webhookTokenValid } from "@/lib/billing/asaas.server";
import { handleAsaasWebhook } from "@/lib/billing/webhook.server";

/**
 * Asaas payment webhook. Authenticated by the shared token Asaas sends in the
 * `asaas-access-token` header (constant-time compare); no user session exists
 * here. The service-role client is imported inside the handler because route
 * files ship to the browser bundle.
 *
 * Responds 2xx for anything stored and understood, including events we ignore,
 * so Asaas's queue never pauses over a harmless event. It responds 5xx only
 * when processing failed, which makes Asaas retry; the retry is safe because
 * `billing_events` is unique per provider event.
 */
export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!webhookTokenValid(request.headers.get("asaas-access-token"))) {
          return new Response("Não autorizado", { status: 401 });
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Corpo inválido", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const outcome = await handleAsaasWebhook(supabaseAdmin, body);
        if (!outcome.ok) return new Response(outcome.error, { status: outcome.status });
        return Response.json({ ok: true, result: outcome.result, duplicate: outcome.duplicate });
      },
    },
  },
});
