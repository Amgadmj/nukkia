import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BillingError, billingConfigured } from "@/lib/billing/asaas.server";
import { startPurchase, startSubscriptionCheckout } from "@/lib/billing/checkout.server";
import { PAID_PLAN_KEYS, PURCHASE_SKUS } from "@/lib/pricing/catalog";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const billingType = z.enum(["UNDEFINED", "PIX", "CREDIT_CARD", "BOLETO"]).default("UNDEFINED");

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("subscription"),
    companyId: z.string().uuid(),
    plan: z.enum(PAID_PLAN_KEYS),
    interval: z.enum(["month", "year"]),
    billingType,
    cpfCnpj: z.string().max(30).nullish(),
  }),
  z.object({
    kind: z.literal("purchase"),
    companyId: z.string().uuid(),
    sku: z.enum(PURCHASE_SKUS),
    billingType,
    cpfCnpj: z.string().max(30).nullish(),
  }),
]);

/**
 * Starts a payment: a plan subscription or an extra-video purchase. The
 * browser gets back the Asaas payment page to open. The price is never taken
 * from the request: it comes from the price registry (plans) or the catalog
 * (purchases), after the margin check.
 */
export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = userClientFromRequest(request);
        if (!user) return new Response("Não autenticado", { status: 401 });
        const { data: userData, error: userError } = await user.auth.getUser();
        if (userError || !userData.user) return new Response("Não autenticado", { status: 401 });

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Corpo da requisição inválido", { status: 400 });
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });
        if (!billingConfigured())
          return new Response("Cobrança indisponível no momento.", { status: 503 });

        const actor = { userId: userData.user.id, email: userData.user.email ?? null };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const deps = { user, admin: supabaseAdmin };
          if (parsed.data.kind === "subscription") {
            const result = await startSubscriptionCheckout(
              deps,
              {
                companyId: parsed.data.companyId,
                plan: parsed.data.plan,
                interval: parsed.data.interval,
                billingType: parsed.data.billingType,
                cpfCnpj: parsed.data.cpfCnpj ?? null,
              },
              actor,
            );
            return Response.json({ ok: true, ...result });
          }
          const result = await startPurchase(
            deps,
            {
              companyId: parsed.data.companyId,
              sku: parsed.data.sku,
              billingType: parsed.data.billingType,
              cpfCnpj: parsed.data.cpfCnpj ?? null,
            },
            actor,
          );
          return Response.json({ ok: true, ...result });
        } catch (err) {
          if (err instanceof BillingError)
            return new Response(err.userMessage, { status: err.status });
          console.error("[api/billing/checkout] unexpected failure");
          return new Response("Não foi possível iniciar a cobrança.", { status: 500 });
        }
      },
    },
  },
});
