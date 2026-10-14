import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminData, BillingEventRow, PurchaseRow, SubscriptionRow } from "@/lib/admin/types";
import { PLANS, type PlanKey } from "@/lib/pricing/catalog";
import {
  DataTable,
  Empty,
  Kpi,
  PageHeader,
  Panel,
  Pill,
  PlanPill,
  StatusPill,
  brl,
  dateTime,
  int,
  relativeTime,
  type Column,
} from "../ui";

export function BillingPage({ data }: { data: AdminData }) {
  const names = useMemo(() => new Map(data.companies.map((c) => [c.id, c.name])), [data.companies]);
  const [eventStatus, setEventStatus] = useState("all");
  const events = useMemo(
    () => data.events.filter((e) => eventStatus === "all" || e.status === eventStatus),
    [data.events, eventStatus],
  );

  const eventCols: Column<BillingEventRow>[] = [
    {
      id: "type",
      header: "Evento",
      sort: (e) => e.event_type,
      cell: (e) => <span className="font-mono text-xs">{e.event_type}</span>,
    },
    {
      id: "status",
      header: "Situação",
      sort: (e) => e.status,
      cell: (e) => <StatusPill status={e.status} />,
    },
    {
      id: "received",
      header: "Recebido",
      sort: (e) => e.received_at,
      cell: (e) => (
        <span title={dateTime(e.received_at)}>{relativeTime(e.received_at, data.now)}</span>
      ),
    },
    {
      id: "id",
      header: "ID do evento",
      cell: (e) => <span className="font-mono text-xs text-muted-foreground">{e.event_id}</span>,
    },
    {
      id: "error",
      header: "Erro",
      cell: (e) =>
        e.error ? (
          <span className="text-destructive">{e.error}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "min-w-48",
    },
  ];
  const subCols: Column<SubscriptionRow>[] = [
    {
      id: "company",
      header: "Empresa",
      sort: (s) => (names.get(s.company_id) ?? "").toLowerCase(),
      cell: (s) => <span className="font-medium">{names.get(s.company_id) ?? s.company_id}</span>,
      className: "min-w-48",
    },
    { id: "plan", header: "Plano", cell: (s) => <PlanPill plan={s.plan_key} /> },
    {
      id: "status",
      header: "Situação",
      sort: (s) => s.status,
      cell: (s) => (
        <span className="flex items-center gap-1.5">
          <StatusPill status={s.status} />
          {s.is_design_partner ? <Pill tone="accent">Parceiro</Pill> : null}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Valor",
      align: "right",
      sort: (s) => s.amount_cents / (s.billing_interval === "year" ? 12 : 1),
      cell: (s) =>
        `${brl(s.amount_cents / 100, true)}/${s.billing_interval === "year" ? "ano" : "mês"}`,
    },
    { id: "cohort", header: "Degrau", cell: (s) => s.cohort_key ?? "—" },
    {
      id: "period",
      header: "Período até",
      sort: (s) => s.current_period_end ?? s.trial_ends_at,
      cell: (s) =>
        (s.current_period_end ?? s.trial_ends_at)
          ? dateTime(s.current_period_end ?? s.trial_ends_at!)
          : "—",
    },
    {
      id: "asaas",
      header: "Asaas",
      cell: (s) => (
        <span className="font-mono text-xs text-muted-foreground">
          {s.provider_subscription_id ?? "—"}
        </span>
      ),
    },
  ];
  const purchaseCols: Column<PurchaseRow>[] = [
    {
      id: "company",
      header: "Empresa",
      cell: (p) => <span className="font-medium">{names.get(p.company_id) ?? p.company_id}</span>,
      className: "min-w-48",
    },
    {
      id: "sku",
      header: "Produto",
      cell: (p) => (p.sku === "video_15s" ? "Vídeo extra de 15 s" : "Filme de 30 s"),
    },
    {
      id: "amount",
      header: "Valor",
      align: "right",
      sort: (p) => p.amount_cents,
      cell: (p) => brl(p.amount_cents / 100),
    },
    { id: "status", header: "Situação", cell: (p) => <StatusPill status={p.status} /> },
    {
      id: "created",
      header: "Criada",
      sort: (p) => p.created_at,
      cell: (p) => dateTime(p.created_at),
    },
  ];

  const failed = data.events.filter((e) => e.status === "failed").length;
  const pastDue = data.subscriptions.filter((s) => s.status === "past_due").length;
  const pending = data.subscriptions.filter((s) => s.status === "pending").length;
  const planCount = (plan: PlanKey) =>
    data.subscriptions.filter(
      (s) => s.plan_key === plan && ["active", "past_due", "trialing"].includes(s.status),
    ).length;

  return (
    <>
      <PageHeader
        title="Cobranças"
        description="Webhooks do Asaas, assinaturas e compras avulsas. Um evento que falha é refeito pelo Asaas; se continuar falhando, aparece aqui em vermelho."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Eventos que falharam"
          value={int(failed)}
          tone={failed > 0 ? "bad" : undefined}
          hint={`${int(data.events.length)} eventos recentes`}
        />
        <Kpi
          label="Pagamentos atrasados"
          value={int(pastDue)}
          tone={pastDue > 0 ? "warn" : undefined}
          hint="Carência de 7 dias"
        />
        <Kpi label="Aguardando pagamento" value={int(pending)} hint="Checkouts abertos" />
        <Kpi
          label="Assinaturas vivas"
          value={int(planCount("essencial") + planCount("pro"))}
          hint={`${planCount("pro")} ${PLANS.pro.name} · ${planCount("essencial")} ${PLANS.essencial.name}`}
        />
      </div>
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="subs">Assinaturas</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <Panel flush>
            <div className="flex items-center gap-2 border-b p-3">
              <Select value={eventStatus} onValueChange={setEventStatus}>
                <SelectTrigger className="w-44" aria-label="Filtrar eventos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="failed">Falharam</SelectItem>
                  <SelectItem value="processed">Processados</SelectItem>
                  <SelectItem value="ignored">Ignorados</SelectItem>
                  <SelectItem value="received">Recebidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DataTable
              columns={eventCols}
              rows={events}
              rowKey={(e) => e.id}
              initialSort={{ id: "received", dir: "desc" }}
              empty={
                <Empty
                  title="Nenhum evento"
                  hint="Quando o Asaas enviar o primeiro webhook, ele aparece aqui."
                />
              }
            />
          </Panel>
        </TabsContent>
        <TabsContent value="subs">
          <Panel flush>
            <DataTable
              columns={subCols}
              rows={data.subscriptions}
              rowKey={(s) => s.id}
              initialSort={{ id: "amount", dir: "desc" }}
              empty={<Empty title="Nenhuma assinatura ainda" />}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="purchases">
          <Panel flush>
            <DataTable
              columns={purchaseCols}
              rows={data.purchases}
              rowKey={(p) => p.id}
              initialSort={{ id: "created", dir: "desc" }}
              empty={<Empty title="Nenhuma compra avulsa" />}
            />
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
