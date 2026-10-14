import { useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { adminAction } from "@/lib/admin/data";
import { costGroup, customerRows, sum, type CustomerRow } from "@/lib/admin/metrics";
import type { AdminData } from "@/lib/admin/types";
import { PLANS, QUOTA_KINDS, QUOTA_LABELS } from "@/lib/pricing/catalog";
import { unitCostUsd } from "@/lib/pricing/economics";
import {
  DataTable,
  Empty,
  MarginPill,
  PageHeader,
  PlanPill,
  Panel,
  Pill,
  StatusPill,
  brl,
  dateTime,
  int,
  relativeTime,
  shortDate,
  usd,
  type Column,
} from "../ui";

const ALL = "all";

export function CustomersPage({
  data,
  selectedId,
  onSelect,
}: {
  data: AdminData;
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const rows = useMemo(() => customerRows(data), [data]);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (plan === ALL || r.plan === plan) &&
        (status === ALL || r.status === status) &&
        (!needle ||
          r.name.toLowerCase().includes(needle) ||
          (r.email ?? "").toLowerCase().includes(needle) ||
          (r.segment ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, query, plan, status]);

  const columns: Column<CustomerRow>[] = [
    {
      id: "name",
      header: "Empresa",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.email ?? r.segment ?? "—"}</p>
        </div>
      ),
      className: "min-w-56",
    },
    { id: "plan", header: "Plano", sort: (r) => r.plan, cell: (r) => <PlanPill plan={r.plan} /> },
    {
      id: "status",
      header: "Situação",
      sort: (r) => r.status,
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <StatusPill status={r.status} />
          {r.isDesignPartner ? <Pill tone="accent">Parceiro</Pill> : null}
        </span>
      ),
    },
    {
      id: "mrr",
      header: "MRR",
      align: "right",
      sort: (r) => r.mrrBrl,
      cell: (r) => (r.mrrBrl > 0 ? brl(r.mrrBrl) : "—"),
    },
    {
      id: "cost",
      header: "Custo 30d",
      align: "right",
      sort: (r) => r.cost30Usd,
      cell: (r) => usd(r.cost30Usd),
    },
    {
      id: "margin",
      header: "Margem",
      align: "right",
      sort: (r) => r.margin,
      cell: (r) => <MarginPill value={r.margin} />,
    },
    {
      id: "videos",
      header: "Vídeos 30d",
      align: "right",
      sort: (r) => r.videosDelivered30,
      cell: (r) => `${r.videosDelivered30} (${r.renders30} rend.)`,
    },
    {
      id: "balance",
      header: "Saldo",
      align: "right",
      sort: (r) => r.videoBalance,
      cell: (r) => int(r.videoBalance),
    },
    {
      id: "active",
      header: "Atividade",
      sort: (r) => r.lastActiveAt,
      cell: (r) => (
        <span className="text-muted-foreground">{relativeTime(r.lastActiveAt, data.now)}</span>
      ),
    },
  ];

  const selected = rows.find((r) => r.companyId === selectedId);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cada empresa com plano, custo de servir e saldo de vídeos. Clique em uma linha para conceder plano, vídeos ou cancelar."
      />
      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empresa, e-mail ou área"
              className="pl-8"
              aria-label="Buscar clientes"
            />
          </div>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="w-36" aria-label="Filtrar por plano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os planos</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="essencial">Essencial</SelectItem>
              <SelectItem value="free">Grátis</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as situações</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trialing">Em teste</SelectItem>
              <SelectItem value="past_due">Atrasado</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="free">Grátis</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} de {rows.length}
          </span>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.companyId}
          onRowClick={(r) => onSelect(r.companyId)}
          initialSort={{ id: "mrr", dir: "desc" }}
          empty={
            <Empty
              title="Nenhum cliente com esses filtros"
              hint="Limpe a busca ou escolha outro plano."
            />
          }
        />
      </Panel>
      <CustomerSheet data={data} row={selected} onClose={() => onSelect(undefined)} />
    </>
  );
}

function CustomerSheet({
  data,
  row,
  onClose,
}: {
  data: AdminData;
  row: CustomerRow | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [units, setUnits] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const details = useMemo(() => {
    if (!row) return null;
    const sub = data.subscriptions.find(
      (s) =>
        s.company_id === row.companyId &&
        ["pending", "trialing", "active", "past_due"].includes(s.status),
    );
    const cutoff = data.now.getTime() - 30 * 86_400_000;
    const usage = data.usage.filter(
      (u) => u.company_id === row.companyId && new Date(u.created_at).getTime() > cutoff,
    );
    const byKind = QUOTA_KINDS.map((kind) => {
      const list = usage.filter((u) => u.kind === kind);
      return { kind, count: list.length, cost: sum(list.map((u) => Number(u.est_cost_usd))) };
    }).filter((k) => k.count > 0);
    const purchases = data.purchases.filter((p) => p.company_id === row.companyId);
    return { sub, byKind, purchases };
  }, [data, row]);

  async function run(label: string, action: Parameters<typeof adminAction>[0]) {
    setBusy(label);
    const result = await adminAction(action);
    setBusy(null);
    if (result.ok) {
      toast.success("Feito.");
      void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {row && details ? (
          <>
            <SheetHeader className="px-6 pb-4 pt-6 pr-12">
              <SheetTitle>{row.name}</SheetTitle>
              <SheetDescription>
                {row.email ?? "Sem e-mail"} · {row.segment ?? "Área não informada"} · cliente desde{" "}
                {shortDate(row.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-6 pb-8">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Plano", <PlanPill key="p" plan={row.plan} />],
                  ["Situação", <StatusPill key="s" status={row.status} />],
                  ["MRR", row.mrrBrl > 0 ? brl(row.mrrBrl) : "—"],
                  ["Margem 30d", <MarginPill key="m" value={row.margin} />],
                  ["Custo 30d", usd(row.cost30Usd)],
                  ["Saldo de vídeos", int(row.videoBalance)],
                  ["Vídeos entregues 30d", int(row.videosDelivered30)],
                  ["Renderizações 30d", int(row.renders30)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Assinatura</h3>
                {details.sub ? (
                  <div className="space-y-1.5 rounded-lg border p-3 text-sm">
                    <p>
                      {PLANS[details.sub.plan_key as "pro"]?.name ?? details.sub.plan_key} ·{" "}
                      {brl(details.sub.amount_cents / 100)} /{" "}
                      {details.sub.billing_interval === "year" ? "ano" : "mês"}
                      {details.sub.cohort_key ? ` · degrau ${details.sub.cohort_key}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {details.sub.trial_ends_at
                        ? `Teste até ${shortDate(details.sub.trial_ends_at)}. `
                        : ""}
                      {details.sub.current_period_end
                        ? `Período até ${shortDate(details.sub.current_period_end)}. `
                        : ""}
                      {details.sub.provider_subscription_id
                        ? `Asaas ${details.sub.provider_subscription_id}`
                        : "Sem cobrança no Asaas"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={busy !== null}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Cancelar a assinatura de ${row.name}? Isso encerra o plano agora.`,
                          )
                        ) {
                          void run("cancel", {
                            action: "cancel_subscription",
                            subscriptionId: details.sub!.id,
                          });
                        }
                      }}
                    >
                      Cancelar assinatura
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-sm">
                    <p className="text-muted-foreground">
                      Sem assinatura. Conceda um teste do Pro para um parceiro de design, travado no
                      preço de fundador.
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("partner", {
                          action: "design_partner",
                          companyId: row.companyId,
                          plan: "pro",
                          trialDays: 90,
                        })
                      }
                    >
                      <UserPlus className="size-3.5" aria-hidden /> Conceder Pro por 90 dias
                    </Button>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Conceder vídeos</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor="grant-units" className="text-xs">
                      Quantidade
                    </Label>
                    <Input
                      id="grant-units"
                      inputMode="numeric"
                      className="w-20"
                      value={units}
                      onChange={(e) => setUnits(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    />
                  </div>
                  <div className="min-w-40 flex-1">
                    <Label htmlFor="grant-reason" className="text-xs">
                      Motivo (fica registrado)
                    </Label>
                    <Input
                      id="grant-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="ex.: compensação por vídeo com defeito"
                      maxLength={120}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy !== null || Number(units) < 1 || reason.trim().length < 3}
                    onClick={() =>
                      void run("grant", {
                        action: "grant_videos",
                        companyId: row.companyId,
                        units: Number(units),
                        reason: reason.trim(),
                      })
                    }
                  >
                    Conceder
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Os vídeos concedidos valem por 90 dias.
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Uso e custo, 30 dias</h3>
                {details.byKind.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma ação no período.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {details.byKind.map((k) => (
                        <tr key={k.kind}>
                          <td className="py-1.5">{QUOTA_LABELS[k.kind]}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                            {k.count}×
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{usd(k.cost)}</td>
                          <td className="w-8 py-1.5 text-right text-[10px] text-muted-foreground">
                            {costGroup(k.kind) === "video"
                              ? "vídeo"
                              : costGroup(k.kind) === "images"
                                ? "img"
                                : "txt"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {details.purchases.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Compras avulsas</h3>
                  <ul className="divide-y text-sm">
                    {details.purchases.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-1.5">
                        <span>
                          {p.sku === "video_15s" ? "Vídeo extra" : "Filme 30 s"} ·{" "}
                          {dateTime(p.created_at)}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{brl(p.amount_cents / 100)}</span>
                          <StatusPill status={p.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Custo de referência de um render de vídeo no plano Pro:{" "}
                {usd(unitCostUsd("video_render", "pro", data.assumptions))}.
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
