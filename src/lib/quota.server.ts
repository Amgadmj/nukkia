import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  PLANS,
  QUOTA_LABELS,
  isPlanKey,
  type PlanKey,
  type QuotaKind,
} from "@/lib/pricing/catalog";
import { DEFAULT_ASSUMPTIONS, unitCostUsd, type Assumptions } from "@/lib/pricing/economics";
import { loadAssumptions } from "@/lib/pricing/registry.server";

/**
 * Per-plan AI quotas. The caps live in the catalog (src/lib/pricing/catalog.ts)
 * and the database function only counts: it takes the limits as arguments,
 * serializes concurrent calls for a company, and books the standard cost of
 * each action so the admin panel can show real gross margin.
 */
export type AiUsageKind = QuotaKind;

/** The plan a company is entitled to now. Any failure reads as the free plan. */
export async function companyPlan(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<PlanKey> {
  const { data, error } = await supabase.rpc("company_plan", { _company_id: companyId });
  if (error || !isPlanKey(data)) {
    if (error) console.error("[quota] company_plan failed:", error.message);
    return "free";
  }
  return data;
}

let cachedAssumptions: { value: Assumptions; at: number } | undefined;
const ASSUMPTIONS_TTL_MS = 60_000;

/**
 * Assumptions for costing, read with the service role because customers cannot
 * read the table. Cached for a minute; falls back to the code defaults.
 */
async function costingAssumptions(): Promise<Assumptions> {
  const now = Date.now();
  if (cachedAssumptions && now - cachedAssumptions.at < ASSUMPTIONS_TTL_MS) {
    return cachedAssumptions.value;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = await loadAssumptions(supabaseAdmin);
    cachedAssumptions = { value, at: now };
    return value;
  } catch {
    return DEFAULT_ASSUMPTIONS;
  }
}

/** Test hook: forget the cached assumptions. */
export function resetAssumptionsCache() {
  cachedAssumptions = undefined;
}

/**
 * Atomically checks the company's plan limits and records this call, with its
 * standard cost, in one transaction. Returns false when the company is over
 * quota or its plan has no allowance for this action: callers must respond
 * with 429 and never fall through to the AI call. Fails closed.
 */
export async function checkAiQuota(
  supabase: SupabaseClient<Database>,
  companyId: string,
  kind: AiUsageKind,
): Promise<boolean> {
  const plan = await companyPlan(supabase, companyId);
  const monthly = PLANS[plan].monthly[kind];
  const daily = PLANS[plan].daily[kind];
  if (monthly <= 0 || daily <= 0) return false;

  const assumptions = await costingAssumptions();
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    _company_id: companyId,
    _kind: kind,
    _daily_limit: daily,
    _monthly_limit: monthly,
    _est_cost_usd: Math.round(unitCostUsd(kind, plan, assumptions) * 10_000) / 10_000,
    _plan_key: plan,
  });
  if (error) {
    console.error(`[quota] consume_ai_quota failed for ${kind}:`, error.message);
    return false;
  }
  return data === true;
}

/**
 * A customer-facing 429 naming the allowance that ran out. It covers both
 * cases, a used-up cap and a plan without the feature, and points to the
 * Assinatura page where the plan can change.
 */
export function quotaExceededResponse(kind: AiUsageKind): Response {
  const label = QUOTA_LABELS[kind].toLowerCase();
  return new Response(
    `Seu plano não tem mais ${label} disponíveis agora. A cota renova em até 30 dias; para ampliar, veja Assinatura.`,
    { status: 429 },
  );
}
