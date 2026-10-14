import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import { computeOverview, customerRows, planEconomics } from "@/lib/admin/metrics";
import type { AdminData } from "@/lib/admin/types";
import { LAUNCH_PRICES, PLANS, PURCHASES, type PaidPlanKey } from "@/lib/pricing/catalog";
import {
  checkPrice,
  checkPurchasePrice,
  planCost,
  purchaseCostUsd,
  type Assumptions,
} from "@/lib/pricing/economics";
import {
  DataTable,
  MarginPill,
  PageHeader,
  Panel,
  PlanPill,
  Kpi,
  brl,
  pct,
  usd,
  type Column,
} from "../ui";

const MOVE_CONFIG = { value: { label: "MRR", color: "var(--chart-1)" } } satisfies ChartConfig;

type PlanRow = {
  plan: PaidPlanKey;
  priceCents: number;
  worst: number;
  expected: number;
  worstCost: number;
  floor: number;
  target: number;
  level: string;
};

function Control({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <Slider
        className="mt-3"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
        aria-label={label}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Revenue, the money in and out, and a what-if panel that reprices every plan live. */
export function RevenuePage({ data }: { data: AdminData }) {
  const base = data.assumptions;
  const [yieldValue, setYield] = useState(base.videoYield);
  const [fx, setFx] = useState(base.fxBrlPerUsd);
  const [credit, setCredit] = useState(base.usdPerCredit);
  const a: Assumptions = { ...base, videoYield: yieldValue, fxBrlPerUsd: fx, usdPerCredit: credit };
  const changed =
    yieldValue !== base.videoYield || fx !== base.fxBrlPerUsd || credit !== base.usdPerCredit;

  const overview = useMemo(() => computeOverview(data), [data]);
  const economics = useMemo(() => planEconomics(data, customerRows(data)), [data]);

  // The price each paid plan is sold at today: the cheapest published monthly step.
  const rows: PlanRow[] = (["essencial", "pro"] as const).map((plan) => {
    const published = data.prices.filter(
      (p) => p.status === "published" && p.plan_key === plan && p.billing_interval === "month",
    );
    const fallback = LAUNCH_PRICES.find(
      (p) => p.plan === plan && p.interval === "month" && p.cohort === "founding",
    )!.amountCents;
    const priceCents = published.length
      ? Math.min(...published.map((p) => p.amount_cents))
      : fallback;
    const check = checkPrice({ plan, amountCents: priceCents, interval: "month" }, a);
    return {
      plan,
      priceCents,
      worst: check.worstMargin,
      expected: check.expectedMargin,
      worstCost: planCost(plan, a, "worst").totalUsd,
      floor: check.floorMinCents,
      target: check.targetMinCents,
      level: check.level,
    };
  });

  const columns: Column<PlanRow>[] = [
    { id: "plan", header: "Plano", cell: (r) => <PlanPill plan={r.plan} /> },
    {
      id: "price",
      header: "Preço hoje",
      align: "right",
      cell: (r) => brl(r.priceCents / 100, true),
    },
    { id: "cost", header: "Custo no pior caso", align: "right", cell: (r) => usd(r.worstCost) },
    {
      id: "worst",
      header: "Margem no pior caso",
      align: "right",
      cell: (r) => <MarginPill value={r.worst} />,
    },
    {
      id: "expected",
      header: "Margem esperada",
      align: "right",
      cell: (r) => <MarginPill value={r.expected} />,
    },
    {
      id: "actual",
      header: "Margem real, 30 d",
      align: "right",
      cell: (r) => (
        <MarginPill value={economics.find((e) => e.plan === r.plan)?.actualMargin ?? null} />
      ),
    },
    { id: "floor", header: "Piso (40%)", align: "right", cell: (r) => brl(r.floor / 100, true) },
    {
      id: "target",
      header: "Para a meta (60%)",
      align: "right",
      cell: (r) => brl(r.target / 100, true),
    },
  ];

  const purchases = (["video_15s", "film_30s"] as const).map((sku) => {
    const check = checkPurchasePrice(sku, PURCHASES[sku].priceCents, a);
    return {
      sku,
      label: PURCHASES[sku].label,
      price: PURCHASES[sku].priceCents,
      cost: purchaseCostUsd(sku, a),
      margin: check.margin,
      open: PURCHASES[sku].purchasable,
    };
  });

  const movement = [
    { name: "Novo", value: overview.newMrrBrl },
    { name: "Cancelado", value: -overview.churnedMrrBrl },
    { name: "Líquido", value: overview.newMrrBrl - overview.churnedMrrBrl },
  ];

  return (
    <>
      <PageHeader
        title="Receita e margem"
        description="Quanto entra, quanto custa servir e o que acontece com a margem se o rendimento de vídeo, o dólar ou o preço do crédito mudarem."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="MRR"
          value={brl(overview.mrrBrl, true)}
          hint={`${overview.payingCustomers} pagantes`}
        />
        <Kpi
          label="Receita líquida mensal"
          value={usd(overview.netMrrUsd)}
          hint="Depois do imposto, em dólares"
        />
        <Kpi
          label="Lucro bruto, 30 dias"
          value={usd(overview.grossProfitUsd)}
          tone={overview.grossProfitUsd < 0 ? "bad" : undefined}
          hint="Já desconta gratuitos e pilotos"
        />
        <Kpi
          label="Churn de clientes, 30 dias"
          value={pct(overview.logoChurn30)}
          hint={overview.logoChurn30 === null ? "Sem base de 30 dias" : "Meta: até 5%"}
          tone={overview.logoChurn30 !== null && overview.logoChurn30 > 0.07 ? "bad" : undefined}
        />
      </div>

      <Panel
        title="Economia de cada plano"
        description={
          changed
            ? "Calculada com os valores simulados abaixo, não com as premissas salvas."
            : "Calculada com as premissas salvas em Preços."
        }
        flush
      >
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.plan} pageSize={10} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="E se…"
          description="Mexa nos controles e veja a margem de cada plano mudar. Nada é salvo."
          className="xl:col-span-2"
          action={
            <Button
              variant="ghost"
              size="sm"
              disabled={!changed}
              onClick={() => {
                setYield(base.videoYield);
                setFx(base.fxBrlPerUsd);
                setCredit(base.usdPerCredit);
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden /> Restaurar
            </Button>
          }
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <Control
              label="Rendimento de vídeo"
              hint={`Renderizações por vídeo mantido. Meta 1,8; hoje ${base.videoYield.toString().replace(".", ",")}.`}
              value={yieldValue}
              min={1}
              max={4}
              step={0.1}
              format={(v) => v.toFixed(1).replace(".", ",")}
              onChange={setYield}
            />
            <Control
              label="Dólar"
              hint={`Reais por dólar. Premissa salva: ${base.fxBrlPerUsd.toFixed(2).replace(".", ",")}.`}
              value={fx}
              min={4.5}
              max={7}
              step={0.05}
              format={(v) => `R$ ${v.toFixed(2).replace(".", ",")}`}
              onChange={setFx}
            />
            <Control
              label="Preço do crédito"
              hint={`Dólares por crédito Higgsfield. Salvo: ${base.usdPerCredit}.`}
              value={credit}
              min={0.03}
              max={0.1}
              step={0.0005}
              format={(v) => `$ ${v.toFixed(4)}`}
              onChange={setCredit}
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {purchases.map((p) => (
              <div
                key={p.sku}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {brl(p.price / 100, true)} · custo {usd(p.cost)}
                    {p.open ? "" : " · ainda fechado"}
                  </p>
                </div>
                <MarginPill value={p.margin} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Movimento do MRR" description="Últimos 30 dias, em reais">
          <ChartContainer config={MOVE_CONFIG} className="h-56 w-full">
            <BarChart data={movement} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v: number) => brl(v, true)}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => brl(Number(value))} />}
              />
              <Bar dataKey="value" radius={[4, 4, 4, 4]} isAnimationActive={false}>
                {movement.map((m) => (
                  <Cell
                    key={m.name}
                    fill={
                      m.name === "Cancelado"
                        ? "var(--destructive)"
                        : m.name === "Líquido"
                          ? "var(--chart-3)"
                          : "var(--chart-1)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="mt-2 text-xs text-muted-foreground">
            Plano Pro: {PLANS.pro.includedVideos} vídeos incluídos e teto de{" "}
            {PLANS.pro.monthly.video_render} renderizações por mês.
          </p>
        </Panel>
      </div>
    </>
  );
}
