import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

const paymentSchema = z
  .object({
    id: z.string().min(1).max(100),
    subscription: z.string().max(100).nullish(),
    externalReference: z.string().max(200).nullish(),
    paymentDate: z.string().nullish(),
    confirmedDate: z.string().nullish(),
    clientPaymentDate: z.string().nullish(),
    status: z.string().max(60).nullish(),
  })
  .passthrough();

const eventSchema = z
  .object({
    id: z.string().max(200).optional(),
    event: z.string().min(1).max(100),
    payment: paymentSchema.optional(),
    subscription: z
      .object({ id: z.string().max(100), externalReference: z.string().max(200).nullish() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AsaasEvent = z.infer<typeof eventSchema>;

export function parseAsaasEvent(body: unknown): AsaasEvent | null {
  const parsed = eventSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** A stable id for the event: Asaas's own when present, else a hash of what it is about. */
export function eventKey(event: AsaasEvent): string {
  if (event.id) return event.id;
  const about = event.payment?.id ?? event.subscription?.id ?? "none";
  return `${event.event}:${about}:${event.payment?.status ?? ""}`;
}

function paidAt(event: AsaasEvent): string | null {
  const raw =
    event.payment?.confirmedDate ??
    event.payment?.paymentDate ??
    event.payment?.clientPaymentDate ??
    null;
  if (!raw) return null;
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00-03:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type WebhookOutcome =
  { ok: true; result: string; duplicate: boolean } | { ok: false; status: number; error: string };

/**
 * Logs the event (one row per provider event) and applies it through the
 * `apply_payment_event` database function. A replay of an event that was
 * already handled returns success without doing anything; a replay of one that
 * failed is processed again, so Asaas's retries repair transient errors.
 */
export async function handleAsaasWebhook(db: Db, body: unknown): Promise<WebhookOutcome> {
  const event = parseAsaasEvent(body);
  if (!event) return { ok: false, status: 400, error: "invalid event" };
  const key = eventKey(event);

  const inserted = await db
    .from("billing_events")
    .insert({
      provider: "asaas",
      event_id: key,
      event_type: event.event,
      payload: body as Database["public"]["Tables"]["billing_events"]["Insert"]["payload"],
    })
    .select("id")
    .maybeSingle();

  let duplicate = false;
  if (inserted.error) {
    if (inserted.error.code !== "23505") {
      console.error("[billing] could not store webhook event:", inserted.error.message);
      return { ok: false, status: 500, error: "storage unavailable" };
    }
    duplicate = true;
    const { data: previous } = await db
      .from("billing_events")
      .select("status")
      .eq("provider", "asaas")
      .eq("event_id", key)
      .maybeSingle();
    if (previous && (previous.status === "processed" || previous.status === "ignored")) {
      return { ok: true, result: "already_handled", duplicate: true };
    }
  }

  const applied = await db.rpc("apply_payment_event", {
    _event: event.event,
    _payment_id: event.payment?.id ?? "",
    _provider_subscription_id: event.payment?.subscription ?? event.subscription?.id ?? null,
    _external_ref:
      event.payment?.externalReference ?? event.subscription?.externalReference ?? null,
    _paid_at: paidAt(event),
  });

  if (applied.error) {
    console.error("[billing] apply_payment_event failed:", applied.error.message);
    await db
      .from("billing_events")
      .update({ status: "failed", error: applied.error.message.slice(0, 480) })
      .eq("provider", "asaas")
      .eq("event_id", key);
    return { ok: false, status: 500, error: "processing failed" };
  }

  const result = String(applied.data ?? "ignored");
  const settled = result === "ignored" || result.startsWith("unknown");
  await db
    .from("billing_events")
    .update({
      status: settled ? "ignored" : "processed",
      error: result.startsWith("unknown") ? result : null,
      processed_at: new Date().toISOString(),
    })
    .eq("provider", "asaas")
    .eq("event_id", key);
  return { ok: true, result, duplicate };
}
