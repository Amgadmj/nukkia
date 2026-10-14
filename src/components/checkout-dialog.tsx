import { useEffect, useState } from "react";
import { Landmark, Loader2, QrCode, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskTaxId, type BillingType } from "@/lib/billing/client";
import { formatBrl } from "@/lib/pricing/entitlements";

const METHODS: { value: BillingType; label: string; hint: string; icon: typeof QrCode }[] = [
  {
    value: "UNDEFINED",
    label: "Escolher na hora de pagar",
    hint: "Pix, cartão ou boleto",
    icon: Landmark,
  },
  { value: "PIX", label: "Pix", hint: "Aprovação imediata", icon: QrCode },
  {
    value: "CREDIT_CARD",
    label: "Cartão de crédito",
    hint: "Cobrança recorrente no cartão",
    icon: CreditCard,
  },
];

/**
 * Collects the two things the payment page needs, a payment method and the
 * CPF or CNPJ for the invoice, and shows exactly what will be charged. The
 * amount shown is informational: the server takes the real price from the
 * registry and the charge the customer approves is the one Asaas shows next.
 */
export function CheckoutDialog({
  open,
  onOpenChange,
  title,
  description,
  amountCents,
  amountSuffix,
  initialTaxId,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  amountCents: number;
  amountSuffix?: string;
  initialTaxId?: string | null;
  busy: boolean;
  error: string | null;
  onConfirm: (input: { billingType: BillingType; cpfCnpj: string | null }) => void;
}) {
  const [billingType, setBillingType] = useState<BillingType>("UNDEFINED");
  const [taxId, setTaxId] = useState("");
  useEffect(() => {
    if (open) setTaxId(maskTaxId(initialTaxId ?? ""));
  }, [open, initialTaxId]);
  const digits = taxId.replace(/\D/g, "");
  const valid = digits.length === 11 || digits.length === 14;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-baseline justify-between rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-2xl font-semibold tabular-nums">
            {formatBrl(amountCents)}
            {amountSuffix ? (
              <span className="ml-1 text-sm font-normal text-muted-foreground">{amountSuffix}</span>
            ) : null}
          </span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkout-tax-id">CPF ou CNPJ da nota</Label>
          <Input
            id="checkout-tax-id"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            value={taxId}
            onChange={(event) => setTaxId(maskTaxId(event.target.value))}
            aria-invalid={taxId.length > 0 && !valid}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Como prefere pagar</legend>
          {METHODS.map((method) => (
            <label
              key={method.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="billing-type"
                className="sr-only"
                checked={billingType === method.value}
                onChange={() => setBillingType(method.value)}
              />
              <method.icon className="size-4 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{method.label}</span>
                <span className="block text-xs text-muted-foreground">{method.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={!valid || busy}
            onClick={() => onConfirm({ billingType, cpfCnpj: digits })}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Continuar para o pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
