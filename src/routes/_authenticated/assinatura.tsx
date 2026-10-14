import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown } from "lucide-react";
import { useState } from "react";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { VideosMeter } from "@/components/videos-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { requestCheckout, type BillingType } from "@/lib/billing/client";
import { COHORTS, PLANS, PURCHASES, type PaidPlanKey } from "@/lib/pricing/catalog";
import { formatBrl } from "@/lib/pricing/entitlements";
import { currentPrice, useEntitlements, usePublicPrices } from "@/lib/use-entitlements";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura | Nukkia" },
      { name: "description", content: "Seu plano, seu uso do mês e como ampliar." },
    ],
  }),
  component: Assinatura,
});

const STATUS: Record<
  string,
  { label: string; tone: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Ativo", tone: "default" },
  trialing: { label: "Em teste", tone: "secondary" },
  pending: { label: "Aguardando pagamento", tone: "outline" },
  past_due: { label: "Pagamento atrasado", tone: "destructive" },
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : null);

function Assinatura() {
  const { company } = useMarketingWorkspace();
  const queryClient = useQueryClient();
  const entitlements = useEntitlements(company?.id);
  const prices = usePublicPrices();
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<PaidPlanKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchases = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["purchases", company?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, sku, status, amount_cents, created_at")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  const data = entitlements.data;
  const subscription = data?.subscription ?? null;
  const interval = annual ? "year" : "month";
  const chosen = selected ? currentPrice(prices.data, selected, interval) : null;

  async function subscribe(input: { billingType: BillingType; cpfCnpj: string | null }) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const result = await requestCheckout({
      kind: "subscription",
      companyId: company!.id,
      plan: selected,
      interval,
      ...input,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message || "Não foi possível iniciar o pagamento.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["entitlements", company!.id] });
    if (result.url) window.location.assign(result.url);
    else setError("A assinatura foi criada. Você receberá o link de pagamento por e-mail.");
  }

  return (
    <div className="workspace-page space-y-6">
      <div className="workspace-page-heading">
        <h1 className="text-3xl font-bold">Assinatura</h1>
        <p className="mt-1 text-muted-foreground">
          Seu plano, o que sobra do mês e como ampliar. Os preços são em reais e iguais para todos
          que veem esta página.
        </p>
      </div>

      <section className="workspace-card" aria-labelledby="plano-atual">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Plano atual
            </p>
            {entitlements.isPending ? (
              <Skeleton className="mt-2 h-8 w-40" />
            ) : (
              <h2 id="plano-atual" className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                {data?.entitlements.planName ?? "Grátis"}
                {subscription ? (
                  <Badge variant={STATUS[subscription.status]?.tone ?? "outline"}>
                    {STATUS[subscription.status]?.label ?? subscription.status}
                  </Badge>
                ) : null}
                {subscription?.isDesignPartner ? (
                  <Badge variant="secondary">
                    <Crown className="size-3" aria-hidden /> Parceiro de design
                  </Badge>
                ) : null}
              </h2>
            )}
            {subscription ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {subscription.status === "trialing" && subscription.trialEndsAt
                  ? `Teste sem cobrança até ${formatDate(subscription.trialEndsAt)}. `
                  : subscription.currentPeriodEnd
                    ? `Renova em ${formatDate(subscription.currentPeriodEnd)}. `
                    : ""}
                Seu preço de {formatBrl(subscription.amountCents)}/
                {subscription.interval === "year" ? "ano" : "mês"} fica travado por 12 meses.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Janela gratuita de 30 dias, com o essencial para começar.
              </p>
            )}
          </div>
        </div>
      </section>

      <VideosMeter />

      <section className="workspace-card" aria-labelledby="uso-mes">
        <h2 id="uso-mes">Uso dos últimos 30 dias</h2>
        {entitlements.isPending ? (
          <Skeleton className="mt-3 h-40 w-full" />
        ) : (
          <ul className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {data?.entitlements.meters
              .filter((meter) => meter.state !== "not_included")
              .map((meter) => (
                <li key={meter.kind}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{meter.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {meter.used} de {meter.limit}
                    </span>
                  </div>
                  <Progress
                    value={meter.fraction * 100}
                    aria-label={`${meter.label}: ${meter.used} de ${meter.limit}`}
                    className={cn(
                      "mt-1.5 h-2",
                      meter.state === "empty" && "[&>div]:bg-destructive",
                    )}
                  />
                </li>
              ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="planos" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="planos" className="text-xl font-semibold">
            Planos
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <span className={cn(!annual && "font-semibold")}>Mensal</span>
            <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Cobrança anual" />
            <span className={cn(annual && "font-semibold")}>Anual · 2 meses grátis</span>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["essencial", "pro"] as const).map((plan) => {
            const price = currentPrice(prices.data, plan, interval);
            const next = prices.data
              ?.filter(
                (p) =>
                  p.plan === plan &&
                  p.interval === interval &&
                  p.amountCents > (price?.amountCents ?? 0),
              )
              .sort((a, b) => a.amountCents - b.amountCents)[0];
            const isCurrent = data?.entitlements.plan === plan && subscription !== null;
            const seatsLeft = price ? price.seats - price.seatsTaken : 0;
            const cohort = COHORTS.find((c) => c.key === price?.cohort);
            return (
              <article
                key={plan}
                className={cn(
                  "workspace-card flex flex-col",
                  plan === "pro" && "border-primary/50 ring-1 ring-primary/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{PLANS[plan].name}</h3>
                  {plan === "pro" ? <Badge>Mais completo</Badge> : null}
                </div>
                <p className="mt-3 flex items-baseline gap-1">
                  {price ? (
                    <>
                      <span className="font-display text-4xl font-semibold tabular-nums">
                        {formatBrl(price.amountCents)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /{annual ? "ano" : "mês"}
                      </span>
                    </>
                  ) : prices.isPending ? (
                    <Skeleton className="h-10 w-32" />
                  ) : (
                    <span className="text-sm text-muted-foreground">Em breve</span>
                  )}
                </p>
                {price && cohort ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cohort.label}: restam {seatsLeft} de {price.seats} vagas neste preço
                    {next ? `. Depois sobe para ${formatBrl(next.amountCents)}.` : "."}
                  </p>
                ) : null}
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {PLANS[plan].promises.map((promise) => (
                    <li key={promise} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {promise}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5"
                  variant={plan === "pro" ? "default" : "outline"}
                  disabled={isCurrent || !price}
                  onClick={() => {
                    setError(null);
                    setSelected(plan);
                  }}
                >
                  {isCurrent ? "Seu plano atual" : `Assinar ${PLANS[plan].name}`}
                </Button>
              </article>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Vídeo extra de 15 segundos: {formatBrl(PURCHASES.video_15s.priceCents)}, em qualquer
          plano. Preços sobem em degraus públicos conforme as vagas se esgotam, e quem já assinou
          mantém o preço por 12 meses.
        </p>
      </section>

      {purchases.data && purchases.data.length > 0 ? (
        <section className="workspace-card" aria-labelledby="compras">
          <h2 id="compras">Compras avulsas</h2>
          <ul className="mt-3 divide-y text-sm">
            {purchases.data.map((purchase) => (
              <li key={purchase.id} className="flex items-center justify-between py-2">
                <span>
                  {purchase.sku === "video_15s"
                    ? PURCHASES.video_15s.label
                    : PURCHASES.film_30s.label}
                  <span className="ml-2 text-muted-foreground">
                    {formatDate(purchase.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatBrl(purchase.amount_cents)}</span>
                  <Badge variant={purchase.status === "paid" ? "default" : "outline"}>
                    {purchase.status === "paid"
                      ? "Pago"
                      : purchase.status === "pending"
                        ? "Aguardando"
                        : purchase.status === "refunded"
                          ? "Estornado"
                          : "Cancelado"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CheckoutDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setError(null);
          }
        }}
        title={selected ? `Assinar ${PLANS[selected].name}` : "Assinar"}
        description={`Plano ${annual ? "anual, pago de uma vez" : "mensal, com cobrança recorrente"}. O valor abaixo fica travado por 12 meses.`}
        amountCents={chosen?.amountCents ?? 0}
        amountSuffix={annual ? "/ano" : "/mês"}
        initialTaxId={company.cnpj}
        busy={busy}
        error={error}
        onConfirm={(input) => void subscribe(input)}
      />
    </div>
  );
}
