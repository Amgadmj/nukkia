import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { computeOverview, customerRows, dayKey, sum, type CustomerRow } from "@/lib/admin/metrics";
import type { AdminData } from "@/lib/admin/types";
import { PLAN_KEYS, PLANS, QUOTA_KINDS, QUOTA_LABELS } from "@/lib/pricing/catalog";
import { unitCostUsd } from "@/lib/pricing/economics";
import {
  DataTable,
  Kpi,
  MarginPill,
  PageHeader,
  Panel,
  PlanPill,
  int,
  shortDate,
  usd,
  type Column,
} from "../ui";

const KIND_CONFIG = { cost: { label: "Custo", color: "var(--chart-1)" } } satisfies ChartConfig;
const VIDEO_CONFIG = {
  renders: { label: "Renderizações", color: "var(--chart-3)" },
  delivered: { label: "Vídeos entregues", color: "var(--chart-1)" },
} satisfies ChartConfig;
const DAY = 86_400_000;

export function UsagePage({ data }: { data: AdminData }) {
  const overview = useMemo(() => computeOverview(data), [data]);
  const customers = useMemo(() => customerRows(data), [data]);
  const cutoff = data.now.getTime() - 30 * DAY;

  const byKind = useMemo(() => {
    const recent = data.usage.filter((u) => new Date(u.created_at).getTime() > cutoff);
    return QUOTA_KINDS.map((kind) => {
      const list = recent.filter((u) => u.kind === kind);
      return {
        kind,
        label: QUOTA_LABELS[kind],
        count: list.length,
        cost: sum(list.map((u) => Number(u.est_cost_usd))),
      };
    })
      .filter((k) => k.count > 0)
      .sort((a, b) => b.cost - a.cost);
  }, [data.usage, cutoff]);

  const videoDays = useMemo(() => {
    const days = new Map<string, { date: string; renders: number; delivered: number }>();
    for (let i = 29; i >= 0; i--) {
      const key = dayKey(new Date(data.now.getTime() - i * DAY));
      days.set(key, { date: key, renders: 0, delivered: 0 });
    }
    for (const u of data.usage) {
      // Usage reaches back 90 days; only the last 30 have a bar.
      const bucket = u.kind === "video_render" ? days.get(dayKey(u.created_at)) : undefined;
      if (bucket) bucket.renders += 1;
    }
    for (const v of data.videoItems)
      if (v.video_path) {
        const bucket = days.get(dayKey(v.created_at));
        if (bucket) bucket.delivered += 1;
      }
    return [...days.values()];
  }, [data]);

  const payingCount = Math.max(1, overview.payingCustomers);
  const costPerVideo =
    overview.videosDelivered30 > 0
      ? overview.costByGroup30.video / overview.videosDelivered30
      : null;

  const columns: Column<CustomerRow>[] = [
    {
      id: "name",
      header: "Empresa",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => <span className="font-medium">{r.name}</span>,
      className: "min-w-52",
    },
    { id: "plan", header: "Plano", cell: (r) => <PlanPill plan={r.plan} /> },
    {
      id: "cost",
      header: "Custo 30d",
      align: "right",
      sort: (r) => r.cost30Usd,
      cell: (r) => usd(r.cost30Usd),
    },
    {
      id: "share",
      header: "Do total",
      align: "right",
      sort: (r) => r.cost30Usd,
      cell: (r) =>
        overview.costUsd30 > 0 ? `${((r.cost30Usd / overview.costUsd30) * 100).toFixed(0)}%` : "—",
    },
    {
      id: "renders",
      header: "Renderizações",
      align: "right",
      sort: (r) => r.renders30,
      cell: (r) => int(r.renders30),
    },
    {
      id: "revenue",
      header: "MRR",
      align: "right",
      sort: (r) => r.mrrBrl,
      cell: (r) => (r.mrrBrl > 0 ? `R$ ${r.mrrBrl.toFixed(0)}` : "—"),
    },
    {
      id: "margin",
      header: "Margem",
      align: "right",
      sort: (r) => r.margin,
      cell: (r) => <MarginPill value={r.margin} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Uso e custos"
        description="Onde o custo de servir está indo. Os valores são o custo padrão de cada ação, registrado no momento do uso, não a fatura do fornecedor."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Custo de IA, 30 dias"
          value={usd(overview.costUsd30)}
          hint={`Vídeo ${usd(overview.costByGroup30.video)} · imagens ${usd(overview.costByGroup30.images)} · texto ${usd(overview.costByGroup30.text)}`}
        />
        <Kpi
          label="Custo por cliente pagante"
          value={usd((overview.costUsd30 - overview.investmentUsd30) / payingCount)}
          hint="Só o uso de quem paga"
        />
        <Kpi
          label="Custo de vídeo por vídeo entregue"
          value={costPerVideo === null ? "—" : usd(costPerVideo)}
          hint="Inclui as renderizações descartadas"
        />
        <Kpi
          label="Gratuitos e pilotos"
          value={usd(overview.investmentUsd30)}
          hint="O que gastamos para conquistar clientes"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Custo por tipo de ação" description="Últimos 30 dias, em dólares">
          <ChartContainer config={KIND_CONFIG} className="h-64 w-full">
            <BarChart
              data={byKind}
              layout="vertical"
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `$${v}`}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={130}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) =>
                      `${usd(Number(value))} · ${(item.payload as { count: number }).count} ações`
                    }
                  />
                }
              />
              <Bar
                dataKey="cost"
                fill="var(--color-cost)"
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel
          title="Vídeo: renderizações e entregas"
          description="Quanto mais separadas as barras, pior o rendimento"
        >
          <ChartContainer config={VIDEO_CONFIG} className="h-64 w-full">
            <BarChart data={videoDays} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={(label) => shortDate(String(label))} />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="renders"
                fill="var(--color-renders)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="delivered"
                fill="var(--color-delivered)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </Panel>
      </div>

      <Panel
        title="Clientes por custo"
        description="Quem mais pesa no custo de servir, com a margem de cada um"
        flush
      >
        <DataTable
          columns={columns}
          rows={customers.filter((c) => c.cost30Usd > 0)}
          rowKey={(r) => r.companyId}
          initialSort={{ id: "cost", dir: "desc" }}
          pageSize={10}
        />
      </Panel>

      <Panel
        title="Custo padrão por unidade"
        description="Os valores que o sistema registra a cada ação, nas premissas atuais"
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Ação</th>
                {PLAN_KEYS.map((plan) => (
                  <th key={plan} className="px-3 py-2 text-right font-medium">
                    {PLANS[plan].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {QUOTA_KINDS.map((kind) => (
                <tr key={kind}>
                  <td className="px-5 py-2">{QUOTA_LABELS[kind]}</td>
                  {PLAN_KEYS.map((plan) => (
                    <td
                      key={plan}
                      className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                    >
                      {PLANS[plan].monthly[kind] > 0
                        ? usd(unitCostUsd(kind, plan, data.assumptions))
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
