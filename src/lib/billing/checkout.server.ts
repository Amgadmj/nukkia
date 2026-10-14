import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PLANS, PURCHASES, type PaidPlanKey, type PurchaseSku } from "@/lib/pricing/catalog";
import { checkPurchasePrice } from "@/lib/pricing/economics";
import { loadAssumptions } from "@/lib/pricing/registry.server";
import {
  BillingError,
  cancelRemoteSubscription,
  createPayment,
  createSubscription,
  findOrCreateCustomer,
  firstInvoiceOf,
  type BillingType,
} from "./asaas.server";

type Db = SupabaseClient<Database>;

export type CheckoutActor = { userId: string; email: string | null };

/** Keeps only digits and accepts a CPF (11) or CNPJ (14); anything else is dropped. */
export function normalizeTaxId(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

async function ownedCompany(user: Db, companyId: string, actor: CheckoutActor) {
  const { data } = await user
    .from("companies")
    .select("id, name, owner_id, cnpj")
    .eq("id", companyId)
    .maybeSingle();
  // Admins can read every company, but only the owner may be billed.
  if (!data || data.owner_id !== actor.userId) {
    throw new BillingError("Empresa não encontrada.", 404);
  }
  return data;
}

/** Waits briefly for Asaas to generate the first invoice of a new subscription. */
async function awaitFirstInvoice(subscriptionId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const invoice = await firstInvoiceOf(subscriptionId);
    if (invoice?.invoiceUrl) return invoice;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return null;
}

/**
 * Reserves the cheapest published price with a seat left, creates the Asaas
 * customer and subscription, and returns the first invoice's payment page.
 * If anything fails after the reservation, the reservation is cancelled so it
 * never holds a seat.
 */
export async function startSubscriptionCheckout(
  deps: { user: Db; admin: Db },
  input: {
    companyId: string;
    plan: PaidPlanKey;
    interval: "month" | "year";
    billingType: BillingType;
    cpfCnpj: string | null;
  },
  actor: CheckoutActor,
): Promise<{ checkoutUrl: string | null; amountCents: number; cohort: string | null }> {
  const company = await ownedCompany(deps.user, input.companyId, actor);
  const taxId = normalizeTaxId(input.cpfCnpj) ?? normalizeTaxId(company.cnpj);
  if (!taxId) {
    throw new BillingError("Informe o CPF ou CNPJ para emitir a cobrança.", 422);
  }

  const reserved = await deps.admin.rpc("reserve_subscription", {
    _company_id: company.id,
    _plan_key: input.plan,
    _interval: input.interval,
  });
  if (reserved.error || !reserved.data) {
    const code = reserved.error?.code;
    throw new BillingError(
      code === "P0001"
        ? "Esta empresa já tem uma assinatura ativa."
        : code === "P0002"
          ? "Este plano ainda não está disponível para contratação."
          : "Não foi possível iniciar a contratação.",
      409,
    );
  }
  const subscription = reserved.data;

  let remoteId: string | null = null;
  try {
    const customerId = await findOrCreateCustomer({
      companyId: company.id,
      name: company.name,
      email: actor.email,
      cpfCnpj: taxId,
    });
    const remote = await createSubscription({
      customerId,
      amountCents: subscription.amount_cents,
      interval: input.interval,
      billingType: input.billingType,
      description: `Nukkia ${PLANS[input.plan].name} (${input.interval === "year" ? "anual" : "mensal"})`,
      externalReference: subscription.id,
    });
    remoteId = remote.id;
    const { error } = await deps.admin
      .from("subscriptions")
      .update({ provider_customer_id: customerId, provider_subscription_id: remote.id })
      .eq("id", subscription.id);
    if (error)
      throw new BillingError("Não foi possível registrar a assinatura.", 500, { cause: error });
    const invoice = await awaitFirstInvoice(remote.id);
    return {
      checkoutUrl: invoice?.invoiceUrl ?? null,
      amountCents: subscription.amount_cents,
      cohort: subscription.cohort_key,
    };
  } catch (err) {
    await deps.admin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", subscription.id);
    if (remoteId) await cancelRemoteSubscription(remoteId).catch(() => undefined);
    throw err;
  }
}

/** An extra finished video bought outside the plan. The price is checked against the margin floor first. */
export async function startPurchase(
  deps: { user: Db; admin: Db },
  input: {
    companyId: string;
    sku: PurchaseSku;
    billingType: BillingType;
    cpfCnpj: string | null;
  },
  actor: CheckoutActor,
): Promise<{ invoiceUrl: string | null; amountCents: number }> {
  const offer = PURCHASES[input.sku];
  if (!offer.purchasable) throw new BillingError("Este produto ainda não está disponível.", 409);

  const assumptions = await loadAssumptions(deps.admin);
  if (!checkPurchasePrice(input.sku, offer.priceCents, assumptions).allowed) {
    console.error("[billing] purchase price is below the margin floor", { sku: input.sku });
    throw new BillingError("Este produto está indisponível no momento.", 503);
  }

  const company = await ownedCompany(deps.user, input.companyId, actor);
  const taxId = normalizeTaxId(input.cpfCnpj) ?? normalizeTaxId(company.cnpj);
  if (!taxId) throw new BillingError("Informe o CPF ou CNPJ para emitir a cobrança.", 422);

  const { data: purchase, error } = await deps.admin
    .from("purchases")
    .insert({
      company_id: company.id,
      sku: input.sku,
      units: offer.units,
      amount_cents: offer.priceCents,
    })
    .select("id")
    .maybeSingle();
  if (error || !purchase) throw new BillingError("Não foi possível iniciar a compra.", 500);

  try {
    const customerId = await findOrCreateCustomer({
      companyId: company.id,
      name: company.name,
      email: actor.email,
      cpfCnpj: taxId,
    });
    const payment = await createPayment({
      customerId,
      amountCents: offer.priceCents,
      billingType: input.billingType,
      description: `Nukkia: ${offer.label}`,
      externalReference: `purchase:${purchase.id}`,
    });
    await deps.admin
      .from("purchases")
      .update({ provider_payment_id: payment.id, invoice_url: payment.invoiceUrl })
      .eq("id", purchase.id);
    return { invoiceUrl: payment.invoiceUrl, amountCents: offer.priceCents };
  } catch (err) {
    await deps.admin.from("purchases").update({ status: "canceled" }).eq("id", purchase.id);
    throw err;
  }
}
