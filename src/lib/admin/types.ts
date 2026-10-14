import type { Tables } from "@/integrations/supabase/types";
import type { Assumptions } from "@/lib/pricing/economics";

export type CompanyRow = Pick<
  Tables<"companies">,
  "id" | "name" | "segment" | "owner_id" | "created_at" | "onboarding_step"
>;
export type ProfileRow = Pick<Tables<"profiles">, "id" | "email" | "full_name">;
export type SubscriptionRow = Tables<"subscriptions">;
export type PurchaseRow = Tables<"purchases">;
export type BillingEventRow = Omit<Tables<"billing_events">, "payload">;
export type PriceRow = Tables<"price_registry">;
export type UsageRow = Pick<
  Tables<"ai_usage">,
  "company_id" | "kind" | "created_at" | "est_cost_usd" | "plan_key"
>;
/** A reels content item: a video request, finished when `video_path` is set. */
export type VideoItemRow = Pick<
  Tables<"content_items">,
  "id" | "company_id" | "created_at" | "video_path"
>;
export type LotRow = Pick<
  Tables<"video_unit_lots">,
  "company_id" | "units_remaining" | "expires_at" | "source"
>;

export type AdminData = {
  /** The instant the snapshot was taken; every window is measured back from here. */
  now: Date;
  companies: CompanyRow[];
  profiles: ProfileRow[];
  subscriptions: SubscriptionRow[];
  usage: UsageRow[];
  purchases: PurchaseRow[];
  videoItems: VideoItemRow[];
  lots: LotRow[];
  events: BillingEventRow[];
  prices: PriceRow[];
  assumptions: Assumptions;
};

export type CostGroup = "text" | "images" | "video";

export type AlertLevel = "critical" | "warning" | "info";

export type AdminAlert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  /** Admin route to open for the fix, when there is one. */
  href?: "/admin/precos" | "/admin/cobrancas" | "/admin/clientes" | "/admin/uso" | "/admin/receita";
};
