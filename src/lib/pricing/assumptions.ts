/** Client-safe mapping between the `pricing_assumptions` row and the economics inputs. */
import type { Database } from "@/integrations/supabase/types";
import type { Assumptions } from "./economics.ts";

export type AssumptionRow = Database["public"]["Tables"]["pricing_assumptions"]["Row"];

export function assumptionsFromRow(row: AssumptionRow): Assumptions {
  return {
    fxBrlPerUsd: Number(row.fx_brl_per_usd),
    taxRate: Number(row.tax_rate),
    cardFeePct: Number(row.card_fee_pct),
    cardFeeFixedBrl: Number(row.card_fee_fixed_brl),
    infraUsdPerCompany: Number(row.infra_usd_per_company),
    usdPerCredit: Number(row.usd_per_credit),
    renderCredits: Number(row.render_credits),
    videoYield: Number(row.video_yield),
  };
}

export const ASSUMPTION_COLUMNS: Record<keyof Assumptions, keyof AssumptionRow> = {
  fxBrlPerUsd: "fx_brl_per_usd",
  taxRate: "tax_rate",
  cardFeePct: "card_fee_pct",
  cardFeeFixedBrl: "card_fee_fixed_brl",
  infraUsdPerCompany: "infra_usd_per_company",
  usdPerCredit: "usd_per_credit",
  renderCredits: "render_credits",
  videoYield: "video_yield",
};
