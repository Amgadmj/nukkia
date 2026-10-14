import { Link } from "@tanstack/react-router";
import { AlertTriangle, CircleCheck, Info, OctagonAlert } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PLANS } from "@/lib/pricing/catalog";
import {
  alerts,
  computeOverview,
  costSeries,
  customerRows,
  ladder,
  mrrSeries,
} from "@/lib/admin/metrics";
import type { AdminAlert, AdminData } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import {
  Empty,
  Kpi,
  PageHeader,
  Panel,
  PlanPill,
  StatusPill,
  brl,
  dateTime,
  int,
  pct,
  shortDate,
  usd,
} from "../ui";

const MRR_CONFIG = {
  mrr: { label: "Receita recorrente", color: "var(--chart-1)" },
} satisfies ChartConfig;
const COST_CONFIG = {
  text: { label: "Texto", color: "var(--chart-3)" },
  images: { label: "Imagens", color: "var(--chart-2)" },
  video: { label: "Vídeo", color: "var(--chart-1)" },
} satisfies ChartConfig;

const ALERT_ICON = { critical: OctagonAlert, warning: AlertTriangle, info: Info } as const;
const ALERT_TONE = {
  critical: "text-destructive",
  warning: "text-[color-mix(in_oklab,var(--warning),var(--foreground)_55%)]",
  info: "text-muted-foreground",
} as const;

function AlertRow({ alert }: { alert: AdminAlert }) {
  const Icon = ALERT_ICON[alert.level];
  const body = (
    <div className="flex gap-3 px-5 py-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ALERT_TONE[alert.level])} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{alert.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
      </div>
    </div>
  );
  return alert.href ? (
    <Link
      to={alert.href}
      className="block transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function OverviewPage({ data }: { data: AdminData }) {
  const o = useMemo(() => computeOverview(data), [data]);
  const customers = useMemo(() => customerRows(data), [data]);
  const mrr = useMemo(() => mrrSeries(data, 90), [data]);
  const costs = useMemo(() => costSeries(data.usage, data.now, 30), [data]);
  const list = useMemo(() => alerts(data, o, customers), [data, o, customers]);
  const steps = useMemo(
    () => ladder(data).filter((s) => s.interval === "month" && s.status === "published"),
    [data],
  );

  const marginTone =
    o.grossMargin === null
      ? undefined
      : o.grossMargin < 0.4
        ? "bad"
        : o.grossMargin < 0.55
          ? "warn"
          : undefined;
  const mrrDelta = mrr.length > 30 ? mrr.at(-1)!.mrr - mrr.at(-31)!.mrr : 0;
  const mix = (["pro", "essencial", "free"] as const).map((plan) => ({
    plan,
    count: o.planMix[plan],
  }));
  const topMix = Math.max(1, ...mix.map((m) => m.count));

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Receita, custo de servir e saúde da cobrança, calculados dos dados reais. O custo usa o valor padrão de cada ação, não a fatura do fornecedor."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          label="Receita recorrente (MRR)"
          value={brl(o.mrrBrl, true)}
          hint={`${mrrDelta >= 0 ? "+" : "−"}${brl(Math.abs(mrrDelta), true)} em 30 dias`}
          series={mrr.slice(-45).map((p) => p.mrr)}
        />
        <Kpi
          label="Receita anualizada (ARR)"
          value={brl(o.arrBrl, true)}
          hint={`${int(o.payingCustomers)} ${o.payingCustomers === 1 ? "cliente pagante" : "clientes pagantes"}`}
        />
        <Kpi
          label="Margem bruta, 30 dias"
          value={pct(o.grossMargin)}
          tone={marginTone}
          hint={o.grossMargin === null ? "Sem receita ainda" : `Meta 60% · alarme 55% · piso 40%`}
        />
        <Kpi
          label="Custo de IA, 30 dias"
          value={usd(o.costUsd30)}
          hint={`Gratuitos e pilotos: ${usd(o.investmentUsd30)}`}
          series={costs.map((c) => c.text + c.images + c.video)}
        />
        <Kpi
          label="Rendimento de vídeo"
          value={o.yield30 === null ? "—" : o.yield30.toFixed(1).replace(".", ",")}
          tone={
            o.yield30 !== null && o.yield30 > 3
              ? "bad"
              : o.yield30 !== null && o.yield30 > 2.3
                ? "warn"
                : undefined
          }
          hint={`${int(o.renders30)} renderizações para ${int(o.videosDelivered30)} vídeos · meta 1,8`}
        />
        <Kpi
          label="Empresas"
          value={int(o.totalCompanies)}
          hint={`${int(o.pilots)} pilotos · ${int(o.freeCompanies)} no gratuito`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Receita recorrente"
          description="Últimos 90 dias, só clientes pagantes"
          className="xl:col-span-2"
        >
          <ChartContainer config={MRR_CONFIG} className="h-64 w-full">
            <AreaChart data={mrr} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrr-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-mrr)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-mrr)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(v: number) => brl(v, true)}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => shortDate(String(label))}
                    formatter={(value) => brl(Number(value))}
                  />
                }
              />
              <Area
                dataKey="mrr"
                type="stepAfter"
                stroke="var(--color-mrr)"
                strokeWidth={2}
                fill="url(#mrr-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </Panel>

        <Panel
          title="Atenção"
          description={
            list.length
              ? `${list.length} ${list.length === 1 ? "ponto" : "pontos"} do placar`
              : "O placar do plano de preços"
          }
          flush
        >
          {list.length === 0 ? (
            <Empty
              icon={<CircleCheck className="size-6 text-success" aria-hidden />}
              title="Tudo dentro das metas"
              hint="Nenhum gatilho do plano de preços foi acionado."
            />
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {list.map((alert) => (
                <li key={alert.id}>
                  <AlertRow alert={alert} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Custo de servir por dia"
          description="Últimos 30 dias, em dólares, valor padrão por ação"
          className="xl:col-span-2"
        >
          <ChartContainer config={COST_CONFIG} className="h-60 w-full">
            <BarChart data={costs} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v}`}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => shortDate(String(label))}
                    formatter={(value) => usd(Number(value))}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="text" stackId="c" fill="var(--color-text)" isAnimationActive={false} />
              <Bar
                dataKey="images"
                stackId="c"
                fill="var(--color-images)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="video"
                stackId="c"
                fill="var(--color-video)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel title="Planos" description="Empresas por plano ativo agora">
          <ul className="space-y-3">
            {mix.map((m) => (
              <li key={m.plan}>
                <div className="flex items-center justify-between text-sm">
                  <PlanPill plan={m.plan} />
                  <span className="tabular-nums">{m.count}</span>
                </div>
                <Progress
                  value={(m.count / topMix) * 100}
                  className="mt-1.5 h-1.5"
                  aria-label={`${PLANS[m.plan].name}: ${m.count}`}
                />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Degraus de preço"
          description="Vagas vendidas em cada degrau público, cobrança mensal"
        >
          {steps.length === 0 ? (
            <Empty
              title="Nenhum preço publicado"
              hint="Publique os preços de lançamento em Preços."
            />
          ) : (
            <ul className="space-y-4">
              {steps.map((step) => (
                <li key={step.priceId}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <PlanPill plan={step.plan} />
                      <span className="text-muted-foreground">{step.cohort}</span>
                    </span>
                    <span className="tabular-nums">
                      <strong>{brl(step.amountCents / 100, true)}</strong>
                      <span className="ml-2 text-muted-foreground">
                        {step.taken}/{step.seats} vagas
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={(step.taken / step.seats) * 100}
                    className="mt-1.5 h-1.5"
                    aria-label={`${step.taken} de ${step.seats} vagas vendidas`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Últimos eventos de cobrança" description="Webhooks do Asaas" flush>
          {data.events.length === 0 ? (
            <Empty
              title="Nenhum evento ainda"
              hint="Os pagamentos aparecem aqui assim que o webhook receber o primeiro."
            />
          ) : (
            <ul className="divide-y">
              {data.events.slice(0, 6).map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-mono text-xs">{event.event_type}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {dateTime(event.received_at)}
                    </span>
                    <StatusPill status={event.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
