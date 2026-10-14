/**
 * Server-side access to the pricing assumptions and the price registry.
 * Writes use the service role (called only from admin API routes after an
 * admin check); reads accept any client the caller already holds.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { COHORTS, LAUNCH_PRICES, type CohortKey, type PaidPlanKey } from "./catalog.ts";
import { ASSUMPTION_COLUMNS, assumptionsFromRow } from "./assumptions.ts";
import {
  DEFAULT_ASSUMPTIONS,
  checkPrice,
  type Assumptions,
  type Interval,
  type PriceCheck,
} from "./economics.ts";

export type Db = SupabaseClient<Database>;

type AssumptionUpdate = Database["public"]["Tables"]["pricing_assumptions"]["Update"];

/** Reads the single assumptions row; falls back to the code defaults when it is unavailable. */
export async function loadAssumptions(db: Db): Promise<Assumptions> {
  const { data, error } = await db
    .from("pricing_assumptions")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_ASSUMPTIONS;
  return assumptionsFromRow(data);
}

export async function saveAssumptions(
  db: Db,
  patch: { [K in keyof Assumptions]?: number | undefined },
  userId: string,
): Promise<{ ok: true; assumptions: Assumptions } | { ok: false; error: string }> {
  const update: AssumptionUpdate = { updated_by: userId, updated_at: new Date().toISOString() };
  for (const key of Object.keys(patch) as (keyof Assumptions)[]) {
    const value = patch[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      Object.assign(update, { [ASSUMPTION_COLUMNS[key]]: value });
    }
  }
  const { data, error } = await db
    .from("pricing_assumptions")
    .update(update)
    .eq("id", 1)
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar as premissas." };
  return { ok: true, assumptions: assumptionsFromRow(data) };
}

export type PublishInput = {
  plan: PaidPlanKey;
  interval: Interval;
  cohort: CohortKey;
  amountCents: number;
};

export type PublishResult =
  | { ok: true; check: PriceCheck; id: string }
  | { ok: false; check: PriceCheck | null; error: string };

/**
 * Publishes a price. The margin floor is decided here, in code, from the
 * current assumptions; the database repeats it as a CHECK. A published row
 * with customers on it is never replaced: add a new cohort step instead.
 */
export async function publishPrice(
  db: Db,
  input: PublishInput,
  userId: string,
): Promise<PublishResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return {
      ok: false,
      check: null,
      error: "Informe um valor inteiro em centavos, maior que zero.",
    };
  }
  const cohort = COHORTS.find((c) => c.key === input.cohort);
  if (!cohort) return { ok: false, check: null, error: "Degrau desconhecido." };

  const assumptions = await loadAssumptions(db);
  const check = checkPrice(
    { plan: input.plan, amountCents: input.amountCents, interval: input.interval },
    assumptions,
  );
  if (!check.allowed) {
    return { ok: false, check, error: check.messages[0] ?? "Preço abaixo do piso de margem." };
  }

  const { data: existing } = await db
    .from("price_registry")
    .select("id")
    .eq("plan_key", input.plan)
    .eq("billing_interval", input.interval)
    .eq("cohort_key", input.cohort)
    .eq("status", "published")
    .maybeSingle();
  if (existing) {
    const { data: taken } = await db.rpc("price_seats_taken", { _price_id: existing.id });
    if ((taken ?? 0) > 0) {
      return {
        ok: false,
        check,
        error: "Este degrau já tem clientes. Publique um novo degrau em vez de alterar o preço.",
      };
    }
    const { error: retireError } = await db
      .from("price_registry")
      .update({ status: "retired", retired_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (retireError)
      return { ok: false, check, error: "Não foi possível aposentar o preço anterior." };
  }

  const { data, error } = await db
    .from("price_registry")
    .insert({
      plan_key: input.plan,
      billing_interval: input.interval,
      cohort_key: input.cohort,
      amount_cents: input.amountCents,
      floor_min_cents: Math.max(1, check.floorMinCents),
      seats: cohort.seats,
      status: "published",
      worst_margin: round4(check.worstMargin),
      expected_margin: round4(check.expectedMargin),
      assumptions:
        assumptions as unknown as Database["public"]["Tables"]["price_registry"]["Row"]["assumptions"],
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, check, error: "Não foi possível publicar o preço." };
  return { ok: true, check, id: data.id };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Publishes any launch price that is not yet published. Idempotent. */
export async function seedLaunchPrices(
  db: Db,
  userId: string,
): Promise<{ published: number; skipped: number; blocked: string[] }> {
  const { data: current } = await db
    .from("price_registry")
    .select("plan_key, billing_interval, cohort_key")
    .eq("status", "published");
  const have = new Set(
    (current ?? []).map((r) => `${r.plan_key}|${r.billing_interval}|${r.cohort_key}`),
  );
  let published = 0;
  let skipped = 0;
  const blocked: string[] = [];
  for (const row of LAUNCH_PRICES) {
    if (have.has(`${row.plan}|${row.interval}|${row.cohort}`)) {
      skipped += 1;
      continue;
    }
    const result = await publishPrice(
      db,
      { plan: row.plan, interval: row.interval, cohort: row.cohort, amountCents: row.amountCents },
      userId,
    );
    if (result.ok) published += 1;
    else blocked.push(`${row.plan} ${row.interval} ${row.cohort}: ${result.error}`);
  }
  return { published, skipped, blocked };
}
