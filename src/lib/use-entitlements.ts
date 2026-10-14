import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUOTA_KINDS, isPlanKey, type PlanKey, type QuotaKind } from "@/lib/pricing/catalog";
import { buildEntitlements, type Entitlements } from "@/lib/pricing/entitlements";

export type SubscriptionSummary = {
  id: string;
  planKey: PlanKey;
  status: string;
  interval: "month" | "year";
  amountCents: number;
  cohort: string | null;
  isDesignPartner: boolean;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
};

export type EntitlementsData = {
  entitlements: Entitlements;
  subscription: SubscriptionSummary | null;
};

/**
 * Loads the plan, the 30-day usage and the finished-video balance for the
 * signed-in company. Everything is read under the customer's own RLS. The
 * lazy monthly grant runs first so the balance is up to date when it is read.
 */
export function useEntitlements(companyId: string | undefined) {
  return useQuery({
    enabled: Boolean(companyId),
    queryKey: ["entitlements", companyId],
    staleTime: 20_000,
    queryFn: async (): Promise<EntitlementsData> => {
      const id = companyId!;
      await supabase.rpc("ensure_video_grant", { _company_id: id });
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [plan, balance, usage, subscription] = await Promise.all([
        supabase.rpc("company_plan", { _company_id: id }),
        supabase.rpc("video_units_balance", { _company_id: id }),
        supabase.from("ai_usage").select("kind").eq("company_id", id).gte("created_at", since),
        supabase
          .from("subscriptions")
          .select(
            "id, plan_key, status, billing_interval, amount_cents, cohort_key, is_design_partner, current_period_end, trial_ends_at, cancel_at_period_end",
          )
          .eq("company_id", id)
          .in("status", ["pending", "trialing", "active", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const counts: Partial<Record<QuotaKind, number>> = {};
      for (const row of usage.data ?? []) {
        if ((QUOTA_KINDS as readonly string[]).includes(row.kind)) {
          const kind = row.kind as QuotaKind;
          counts[kind] = (counts[kind] ?? 0) + 1;
        }
      }
      const planKey: PlanKey = isPlanKey(plan.data) ? plan.data : "free";
      const sub = subscription.data;
      return {
        entitlements: buildEntitlements({
          plan: planKey,
          usage: counts,
          videoBalance: typeof balance.data === "number" ? balance.data : 0,
        }),
        subscription:
          sub && isPlanKey(sub.plan_key)
            ? {
                id: sub.id,
                planKey: sub.plan_key,
                status: sub.status,
                interval: sub.billing_interval === "year" ? "year" : "month",
                amountCents: sub.amount_cents,
                cohort: sub.cohort_key,
                isDesignPartner: sub.is_design_partner,
                currentPeriodEnd: sub.current_period_end,
                trialEndsAt: sub.trial_ends_at,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              }
            : null,
      };
    },
  });
}

export type PublicPrice = {
  plan: "essencial" | "pro";
  interval: "month" | "year";
  cohort: string;
  amountCents: number;
  seats: number;
  seatsTaken: number;
};

/** The published prices and the seats left at each step. No margins are exposed. */
export function usePublicPrices() {
  return useQuery({
    queryKey: ["public-prices"],
    staleTime: 60_000,
    queryFn: async (): Promise<PublicPrice[]> => {
      const { data, error } = await supabase.rpc("public_price_list");
      if (error) throw error;
      return (data ?? [])
        .filter((row) => row.plan_key === "essencial" || row.plan_key === "pro")
        .map((row) => ({
          plan: row.plan_key as "essencial" | "pro",
          interval: row.billing_interval === "year" ? ("year" as const) : ("month" as const),
          cohort: row.cohort_key,
          amountCents: row.amount_cents,
          seats: row.seats,
          seatsTaken: row.seats_taken,
        }));
    },
  });
}

/** The price a new customer would get now: the cheapest step that still has seats. */
export function currentPrice(
  prices: PublicPrice[] | undefined,
  plan: "essencial" | "pro",
  interval: "month" | "year",
): PublicPrice | null {
  const open = (prices ?? [])
    .filter((p) => p.plan === plan && p.interval === interval && p.seatsTaken < p.seats)
    .sort((a, b) => a.amountCents - b.amountCents);
  return open[0] ?? null;
}
