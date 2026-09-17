import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Per-company AI usage caps. Deliberately generous for a paid/demo account
 * today (no plan-tier system yet) but finite — closes the "loop /api/arte
 * forever on a free account" cost hole (AI-1 in the security review).
 * Tune here; the DB function takes the numbers as arguments, no migration
 * needed to change them.
 */
export const AI_LIMITS = {
  diagnostico: { daily: 10, monthly: 20 },
  plano: { daily: 10, monthly: 10 },
  arte: { daily: 20, monthly: 150 },
  carrossel: { daily: 20, monthly: 60 },
  video_storyboard: { daily: 10, monthly: 60 },
  video_render: { daily: 5, monthly: 20 },
  pesquisa_empresa: { daily: 15, monthly: 60 },
} as const satisfies Record<string, { daily: number; monthly: number }>;

export type AiUsageKind = keyof typeof AI_LIMITS;

/**
 * Atomically checks the company's usage against its cap and records this
 * call in the same transaction (see check_and_record_ai_usage in
 * supabase/migrations/20260916210100_p1_security_and_features.sql).
 * Returns false when the company is over quota — callers should respond
 * with 429, never fall through and call the AI anyway.
 */
export async function checkAiQuota(
  supabase: SupabaseClient<Database>,
  companyId: string,
  kind: AiUsageKind,
): Promise<boolean> {
  const limits = AI_LIMITS[kind];
  const { data, error } = await supabase.rpc("check_and_record_ai_usage", {
    _company_id: companyId,
    _kind: kind,
    _daily_limit: limits.daily,
    _monthly_limit: limits.monthly,
  });
  if (error) {
    console.error(`[quota] check_and_record_ai_usage failed for ${kind}:`, error.message);
    // Fail closed: if we can't verify quota, don't spend money.
    return false;
  }
  return data === true;
}

export function quotaExceededResponse(kind: AiUsageKind): Response {
  const limits = AI_LIMITS[kind];
  return new Response(
    `Limite de uso atingido para esta função (máx. ${limits.daily}/dia). Tente novamente mais tarde.`,
    { status: 429 },
  );
}
