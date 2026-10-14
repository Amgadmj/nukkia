import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Sparkles } from "lucide-react";
import { useState } from "react";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestCheckout } from "@/lib/billing/client";
import { PURCHASES } from "@/lib/pricing/catalog";
import { formatBrl, type VideoMeter } from "@/lib/pricing/entitlements";
import { useEntitlements } from "@/lib/use-entitlements";
import { cn } from "@/lib/utils";

const STATE_STYLES: Record<VideoMeter["state"], string> = {
  ok: "border-border",
  low: "border-warning/60 bg-warning/5",
  empty: "border-destructive/50 bg-destructive/5",
  not_included: "border-dashed border-border",
};

/** One pip per finished video the plan grants a month; filled pips are what is left. */
function Pips({ remaining, total }: { remaining: number; total: number }) {
  const count = Math.max(total, remaining, 1);
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: Math.min(count, 8) }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2.5 w-7 rounded-full transition-colors",
            index < remaining ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

/**
 * The meter as pure presentation. It shows the number the customer is
 * charged against, the finished videos left in their balance, and offers the
 * way out when it reaches zero. Our internal render cap is only a footnote.
 */
export function VideosMeterView({
  video,
  onBuy,
  className,
}: {
  video: VideoMeter;
  onBuy: () => void;
  className?: string | undefined;
}) {
  const offer = PURCHASES.video_15s;
  return (
    <section
      aria-label="Vídeos restantes"
      className={cn(
        "rounded-xl border p-4 transition-colors",
        STATE_STYLES[video.state],
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
            <Clapperboard className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-semibold leading-tight">{video.headline}</p>
            <p className="text-xs text-muted-foreground">{video.detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {video.state !== "not_included" ? (
            <Pips remaining={video.remaining} total={video.includedPerMonth} />
          ) : null}
          {video.state === "empty" || video.state === "low" || video.state === "not_included" ? (
            <div className="flex gap-2">
              {video.state === "not_included" ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/assinatura">Ver planos</Link>
                </Button>
              ) : null}
              <Button size="sm" onClick={onBuy}>
                <Sparkles className="size-3.5" aria-hidden />
                Vídeo extra · {formatBrl(offer.priceCents)}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {video.planIncludesVideo ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Uma renderização que falha não desconta nada do seu saldo. Para proteger a qualidade, cada
          mês aceita até {video.renderCap} tentativas ({video.rendersLeft} restantes).
        </p>
      ) : null}
    </section>
  );
}

/** The meter wired to the signed-in company: loads the balance and runs the extra-video checkout. */
export function VideosMeter({ className }: { className?: string }) {
  const { company } = useMarketingWorkspace();
  const queryClient = useQueryClient();
  const query = useEntitlements(company?.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!company) return null;
  if (query.isPending) return <Skeleton className={cn("h-24 w-full rounded-xl", className)} />;
  if (query.isError || !query.data) return null;
  const offer = PURCHASES.video_15s;

  async function buy(input: {
    billingType: "UNDEFINED" | "PIX" | "CREDIT_CARD";
    cpfCnpj: string | null;
  }) {
    setBusy(true);
    setError(null);
    const result = await requestCheckout({
      kind: "purchase",
      companyId: company!.id,
      sku: "video_15s",
      ...input,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message || "Não foi possível iniciar o pagamento.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["entitlements", company!.id] });
    if (result.url) window.location.assign(result.url);
    else setError("A cobrança foi criada. Você receberá o link de pagamento por e-mail.");
  }

  return (
    <>
      <VideosMeterView
        video={query.data.entitlements.video}
        onBuy={() => setOpen(true)}
        className={className}
      />
      <CheckoutDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Comprar vídeo extra"
        description={`${offer.label}. Vale por 12 meses e entra no seu saldo assim que o pagamento é confirmado.`}
        amountCents={offer.priceCents}
        initialTaxId={company.cnpj}
        busy={busy}
        error={error}
        onConfirm={(input) => void buy(input)}
      />
    </>
  );
}
