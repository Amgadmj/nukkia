import { apiFetch } from "@/lib/api";

export type BillingType = "UNDEFINED" | "PIX" | "CREDIT_CARD";

export type CheckoutRequest =
  | {
      kind: "subscription";
      companyId: string;
      plan: "essencial" | "pro";
      interval: "month" | "year";
      billingType: BillingType;
      cpfCnpj: string | null;
    }
  | {
      kind: "purchase";
      companyId: string;
      sku: "video_15s";
      billingType: BillingType;
      cpfCnpj: string | null;
    };

export type CheckoutResult =
  { ok: true; url: string | null } | { ok: false; status: number; message: string };

/** Asks the server to open a payment. The server decides the price; this only names the product. */
export async function requestCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  try {
    const response = await apiFetch("/api/billing/checkout", request);
    if (!response.ok) {
      return { ok: false, status: response.status, message: (await response.text()).slice(0, 160) };
    }
    const json = (await response.json()) as {
      checkoutUrl?: string | null;
      invoiceUrl?: string | null;
    };
    return { ok: true, url: json.checkoutUrl ?? json.invoiceUrl ?? null };
  } catch {
    return { ok: false, status: 0, message: "Não foi possível conectar. Tente novamente." };
  }
}

/** Mask for a CPF (11 digits) or CNPJ (14 digits) while typing. */
export function maskTaxId(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
