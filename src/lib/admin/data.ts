import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { assumptionsFromRow } from "@/lib/pricing/assumptions";
import { DEFAULT_ASSUMPTIONS } from "@/lib/pricing/economics";
import { isFixtureMode } from "./fixture-mode";
import { makeFixtureData } from "./fixtures";
import type { AdminData } from "./types";

const PAGE = 1000;
const MAX_ROWS = 25_000;
const WINDOW_DAYS = 90;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every row of a query in pages of 1,000, up to a safety cap. */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * Loads the snapshot the admin panel computes everything from. Every read is
 * made with the signed-in admin's own session, so row-level security, not this
 * code, decides what is visible. The last 90 days of usage and video items are
 * enough for every chart; older rows stay in the database.
 */
export async function loadAdminData(): Promise<AdminData> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const [
    companies,
    profiles,
    subscriptions,
    usage,
    purchases,
    videoItems,
    lots,
    events,
    prices,
    assumptions,
  ] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("companies")
        .select("id, name, segment, owner_id, created_at, onboarding_step")
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    fetchAll((a, b) => supabase.from("profiles").select("id, email, full_name").range(a, b)),
    fetchAll((a, b) =>
      supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("ai_usage")
        .select("company_id, kind, created_at, est_cost_usd, plan_key")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from("purchases").select("*").order("created_at", { ascending: false }).range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("content_items")
        .select("id, company_id, created_at, video_path")
        .eq("format", "reels")
        .gte("created_at", since)
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("video_unit_lots")
        .select("company_id, units_remaining, expires_at, source")
        .gt("units_remaining", 0)
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("billing_events")
        .select("id, provider, event_id, event_type, status, error, received_at, processed_at")
        .order("received_at", { ascending: false })
        .range(a, Math.min(b, 199)),
    ),
    fetchAll((a, b) =>
      supabase
        .from("price_registry")
        .select("*")
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    supabase.from("pricing_assumptions").select("*").eq("id", 1).maybeSingle(),
  ]);
  return {
    now: new Date(),
    companies,
    profiles,
    subscriptions,
    usage: usage.map((u) => ({ ...u, est_cost_usd: Number(u.est_cost_usd) })),
    purchases,
    videoItems,
    lots,
    events,
    prices,
    assumptions: assumptions.data ? assumptionsFromRow(assumptions.data) : DEFAULT_ASSUMPTIONS,
  };
}

export function useAdminData() {
  return useQuery({
    queryKey: ["admin-data", isFixtureMode()],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AdminData> =>
      isFixtureMode() ? makeFixtureData() : loadAdminData(),
  });
}

export type AdminAction =
  | {
      action: "publish_price";
      plan: "essencial" | "pro";
      interval: "month" | "year";
      cohort: string;
      amountCents: number;
    }
  | { action: "seed_prices" }
  | { action: "save_assumptions"; patch: Partial<Record<string, number>> }
  | { action: "grant_videos"; companyId: string; units: number; reason: string }
  | { action: "design_partner"; companyId: string; plan: "essencial" | "pro"; trialDays: number }
  | { action: "cancel_subscription"; subscriptionId: string };

export type AdminResult = { ok: boolean; message: string; body?: unknown };

/** Sends an admin write. The server re-checks the admin role and every margin rule. */
export async function adminAction(action: AdminAction): Promise<AdminResult> {
  if (isFixtureMode()) return { ok: false, message: "Modo de exemplo: nenhuma alteração é salva." };
  try {
    const response = await apiFetch("/api/admin/billing", action);
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* plain-text error */
    }
    if (!response.ok) {
      const error =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : text;
      return { ok: false, message: error.slice(0, 200) || "Não foi possível concluir.", body };
    }
    return { ok: true, message: "Pronto.", body };
  } catch {
    return { ok: false, message: "Não foi possível conectar. Tente novamente." };
  }
}
