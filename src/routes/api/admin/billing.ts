import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { cancelRemoteSubscription } from "@/lib/billing/asaas.server";
import { COHORTS, PAID_PLAN_KEYS, type CohortKey } from "@/lib/pricing/catalog";
import { publishPrice, saveAssumptions, seedLaunchPrices } from "@/lib/pricing/registry.server";

const cohortKeys = COHORTS.map((c) => c.key) as [CohortKey, ...CohortKey[]];

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("publish_price"),
    plan: z.enum(PAID_PLAN_KEYS),
    interval: z.enum(["month", "year"]),
    cohort: z.enum(cohortKeys),
    amountCents: z.number().int().min(100).max(50_000_000),
  }),
  z.object({ action: z.literal("seed_prices") }),
  z.object({
    action: z.literal("save_assumptions"),
    patch: z
      .object({
        fxBrlPerUsd: z.number().min(1).max(20),
        taxRate: z.number().min(0).max(0.4),
        cardFeePct: z.number().min(0).max(0.15),
        cardFeeFixedBrl: z.number().min(0).max(10),
        infraUsdPerCompany: z.number().min(0).max(50),
        usdPerCredit: z.number().min(0.001).max(1),
        renderCredits: z.number().min(1).max(1000),
        videoYield: z.number().min(1).max(10),
      })
      .partial(),
  }),
  z.object({
    action: z.literal("grant_videos"),
    companyId: z.string().uuid(),
    units: z.number().int().min(1).max(20),
    reason: z.string().trim().min(3).max(120),
  }),
  z.object({
    action: z.literal("design_partner"),
    companyId: z.string().uuid(),
    plan: z.enum(PAID_PLAN_KEYS),
    trialDays: z.number().int().min(1).max(365).default(90),
  }),
  z.object({ action: z.literal("cancel_subscription"), subscriptionId: z.string().uuid() }),
]);

/**
 * Admin-only writes that move money or entitlements. Reads happen in the
 * browser under RLS; anything that changes prices, assumptions, grants or a
 * subscription comes here, after `requireAdmin` has verified the role.
 */
export const Route = createFileRoute("/api/admin/billing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdmin(request);
        if (!auth.ok) return auth.response;
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Corpo da requisição inválido", { status: 400 });
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });
        const body = parsed.data;
        const { userId } = auth.ctx;
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

        try {
          switch (body.action) {
            case "publish_price": {
              const result = await publishPrice(
                db,
                {
                  plan: body.plan,
                  interval: body.interval,
                  cohort: body.cohort,
                  amountCents: body.amountCents,
                },
                userId,
              );
              return Response.json(result, { status: result.ok ? 200 : 422 });
            }
            case "seed_prices":
              return Response.json({ ok: true, ...(await seedLaunchPrices(db, userId)) });
            case "save_assumptions": {
              const result = await saveAssumptions(db, body.patch, userId);
              return Response.json(result, { status: result.ok ? 200 : 500 });
            }
            case "grant_videos": {
              const ref = `admin:${crypto.randomUUID()}`;
              const expires = new Date(Date.now() + 90 * 86_400_000).toISOString();
              const { error } = await db.rpc("grant_video_units", {
                _company_id: body.companyId,
                _units: body.units,
                _source: "admin",
                _ref: ref,
                _expires_at: expires,
              });
              if (error)
                return new Response("Não foi possível conceder os vídeos.", { status: 500 });
              console.info("[admin] video units granted", {
                by: userId,
                company: body.companyId,
                units: body.units,
                reason: body.reason,
              });
              return Response.json({ ok: true });
            }
            case "design_partner": {
              const { data, error } = await db.rpc("grant_design_partner", {
                _company_id: body.companyId,
                _plan_key: body.plan,
                _trial_days: body.trialDays,
              });
              if (error || !data) {
                return new Response(
                  error?.code === "P0001"
                    ? "Esta empresa já tem uma assinatura ativa."
                    : error?.code === "P0002"
                      ? "Publique os preços de lançamento antes."
                      : "Não foi possível conceder o plano.",
                  { status: error?.code ? 409 : 500 },
                );
              }
              return Response.json({ ok: true, subscriptionId: data.id });
            }
            case "cancel_subscription": {
              const { data: sub } = await db
                .from("subscriptions")
                .select("id, provider_subscription_id")
                .eq("id", body.subscriptionId)
                .maybeSingle();
              if (!sub) return new Response("Assinatura não encontrada.", { status: 404 });
              if (sub.provider_subscription_id) {
                await cancelRemoteSubscription(sub.provider_subscription_id).catch(() => undefined);
              }
              const { error } = await db
                .from("subscriptions")
                .update({ status: "canceled", canceled_at: new Date().toISOString() })
                .eq("id", sub.id);
              if (error) return new Response("Não foi possível cancelar.", { status: 500 });
              return Response.json({ ok: true });
            }
          }
        } catch {
          console.error("[api/admin/billing] unexpected failure");
          return new Response("Não foi possível concluir a operação.", { status: 500 });
        }
      },
    },
  },
});
