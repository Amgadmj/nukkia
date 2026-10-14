import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * The finished-video balance a customer sees as "videos remaining". One unit
 * is one finished 15-second video. A render that fails costs the customer
 * nothing; a unit is used when a render completes and is saved. The database
 * functions do the accounting (see the billing migration); these wrappers
 * make failures non-fatal and keep the callers short.
 */

/** Adds this window's included videos, once per 30-day window. Returns units granted. */
export async function ensureVideoGrant(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("ensure_video_grant", { _company_id: companyId });
  if (error) {
    console.error("[video-units] ensure_video_grant failed:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/** Videos the company can still make. Zero when anything is unavailable (fails closed). */
export async function videoUnitsBalance(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("video_units_balance", { _company_id: companyId });
  if (error) {
    console.error("[video-units] video_units_balance failed:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * Uses one unit for a finished render. Idempotent per `ref`, so polling the
 * same render twice charges once. Returns false when there was no balance;
 * the caller still delivers the video, because the render cost is already spent.
 */
export async function consumeVideoUnit(
  supabase: SupabaseClient<Database>,
  companyId: string,
  ref: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_video_unit", {
    _company_id: companyId,
    _ref: ref.slice(0, 200),
  });
  if (error) {
    console.error("[video-units] consume_video_unit failed:", error.message);
    return false;
  }
  return data === true;
}
