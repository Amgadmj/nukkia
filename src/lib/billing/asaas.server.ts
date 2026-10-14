/**
 * Asaas (Brazilian payments: Pix, card, boleto) client. Server only.
 *
 * Facts confirmed against docs.asaas.com on 14 Oct 2026:
 *  - the API key goes in the `access_token` header; sandbox is
 *    https://api-sandbox.asaas.com/v3, production https://api.asaas.com/v3;
 *  - POST /subscriptions takes customer, billingType (UNDEFINED, BOLETO,
 *    CREDIT_CARD, PIX), value, nextDueDate, cycle (MONTHLY, YEARLY, ...),
 *    description, externalReference;
 *  - webhooks send the token you configured in the `asaas-access-token`
 *    header and expect an HTTP 2xx.
 * Not confirmed: the exact name of the subscription-level events. The webhook
 * handles SUBSCRIPTION_DELETED and SUBSCRIPTION_INACTIVATED defensively.
 *
 * Error text from Asaas is logged, never sent to the browser.
 */

const BASE_URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
} as const;

const TIMEOUT_MS = 20_000;

export class BillingError extends Error {
  readonly userMessage: string;
  readonly status: number;
  constructor(userMessage: string, status = 502, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.userMessage = userMessage;
    this.status = status;
    this.name = "BillingError";
  }
}

type Config = { baseUrl: string; apiKey: string };

function config(): Config {
  const apiKey = process.env["ASAAS_API_KEY"];
  if (!apiKey) {
    throw new BillingError("Cobrança indisponível no momento.", 503, {
      cause: new Error("ASAAS_API_KEY não configurada"),
    });
  }
  const env = process.env["ASAAS_ENV"] === "production" ? "production" : "sandbox";
  return { baseUrl: BASE_URLS[env], apiKey };
}

export function billingConfigured(): boolean {
  return Boolean(process.env["ASAAS_API_KEY"]);
}

/** Constant-time comparison of the webhook token; false when none is configured. */
export function webhookTokenValid(received: string | null): boolean {
  const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
  if (!expected || !received) return false;
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(received);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function call<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const { baseUrl, apiKey } = config();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
        "User-Agent": "Nukkia/1.0",
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch (err) {
    throw new BillingError("Não foi possível conectar ao serviço de cobrança.", 502, {
      cause: err,
    });
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error("[asaas] request failed", { method, path, status: response.status, detail });
    throw new BillingError(
      response.status === 401
        ? "Cobrança indisponível no momento."
        : "O serviço de cobrança não conseguiu processar o pedido. Confira os dados e tente de novo.",
      response.status === 401 ? 503 : 502,
    );
  }
  return (await response.json()) as T;
}

export type BillingType = "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO";

/** Reuses the customer whose externalReference is our company id, or creates one. */
export async function findOrCreateCustomer(input: {
  companyId: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
}): Promise<string> {
  const found = await call<{ data?: { id: string }[] }>(
    "GET",
    `/customers?externalReference=${encodeURIComponent(input.companyId)}&limit=1`,
  );
  const existing = found.data?.[0];
  if (existing) return existing.id;
  const created = await call<{ id: string }>("POST", "/customers", {
    name: input.name,
    ...(input.email ? { email: input.email } : {}),
    ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
    externalReference: input.companyId,
    notificationDisabled: false,
  });
  return created.id;
}

/** Date in São Paulo as YYYY-MM-DD, plus an optional day offset. */
export function dueDate(offsetDays = 0, now = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

export async function createSubscription(input: {
  customerId: string;
  amountCents: number;
  interval: "month" | "year";
  billingType: BillingType;
  description: string;
  externalReference: string;
}): Promise<{ id: string }> {
  return call<{ id: string }>("POST", "/subscriptions", {
    customer: input.customerId,
    billingType: input.billingType,
    value: input.amountCents / 100,
    nextDueDate: dueDate(0),
    cycle: input.interval === "year" ? "YEARLY" : "MONTHLY",
    description: input.description.slice(0, 500),
    externalReference: input.externalReference,
  });
}

/** The first invoice of a subscription, whose page takes the customer's payment. */
export async function firstInvoiceOf(
  subscriptionId: string,
): Promise<{ id: string; invoiceUrl: string | null } | null> {
  const result = await call<{ data?: { id: string; invoiceUrl?: string | null }[] }>(
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
  );
  const first = result.data?.[0];
  return first ? { id: first.id, invoiceUrl: first.invoiceUrl ?? null } : null;
}

export async function createPayment(input: {
  customerId: string;
  amountCents: number;
  billingType: BillingType;
  description: string;
  externalReference: string;
}): Promise<{ id: string; invoiceUrl: string | null }> {
  const payment = await call<{ id: string; invoiceUrl?: string | null }>("POST", "/payments", {
    customer: input.customerId,
    billingType: input.billingType,
    value: input.amountCents / 100,
    dueDate: dueDate(1),
    description: input.description.slice(0, 500),
    externalReference: input.externalReference,
  });
  return { id: payment.id, invoiceUrl: payment.invoiceUrl ?? null };
}

export async function cancelRemoteSubscription(subscriptionId: string): Promise<void> {
  await call("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}
