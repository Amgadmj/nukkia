import { useQueryClient } from "@tanstack/react-query";
import { Plus, Rocket, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminAction } from "@/lib/admin/data";
import { ladder, type LadderStep } from "@/lib/admin/metrics";
import type { AdminData } from "@/lib/admin/types";
import { COHORTS, PAID_PLAN_KEYS, PLANS, type PaidPlanKey } from "@/lib/pricing/catalog";
import {
  ALARM_MARGIN,
  HARD_FLOOR,
  TARGET_MARGIN,
  checkPrice,
  type Assumptions,
} from "@/lib/pricing/economics";
import {
  DataTable,
  Empty,
  MarginPill,
  PageHeader,
  Panel,
  Pill,
  PlanPill,
  StatusPill,
  brl,
  pct,
  shortDate,
  type Column,
} from "../ui";

const FIELDS: { key: keyof Assumptions; label: string; hint: string; step: string }[] = [
  {
    key: "fxBrlPerUsd",
    label: "Dólar (R$ por US$)",
    hint: "Converte custos em dólar para reais",
    step: "0.01",
  },
  {
    key: "taxRate",
    label: "Imposto sobre a receita",
    hint: "Simples Nacional, 0,06 = 6% (confirmado)",
    step: "0.001",
  },
  {
    key: "cardFeePct",
    label: "Taxa de cartão (%)",
    hint: "0,0399 = 3,99% (estimativa)",
    step: "0.0001",
  },
  {
    key: "cardFeeFixedBrl",
    label: "Taxa fixa por cobrança (R$)",
    hint: "Estimativa",
    step: "0.01",
  },
  {
    key: "infraUsdPerCompany",
    label: "Infraestrutura por empresa (US$/mês)",
    hint: "Banco de dados, armazenamento e funções",
    step: "0.1",
  },
  {
    key: "usdPerCredit",
    label: "Preço do crédito (US$)",
    hint: "Higgsfield, pagamento por uso",
    step: "0.0001",
  },
  {
    key: "renderCredits",
    label: "Créditos por renderização",
    hint: "15 s em 720p mais ampliação",
    step: "0.5",
  },
  {
    key: "videoYield",
    label: "Rendimento de vídeo",
    hint: "Renderizações por vídeo mantido (meta 1,8)",
    step: "0.1",
  },
];

function PublishDialog({
  open,
  onOpenChange,
  assumptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assumptions: Assumptions;
}) {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<PaidPlanKey>("pro");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [cohort, setCohort] = useState<string>("founding");
  const [reais, setReais] = useState("497");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(Number(reais.replace(",", ".")) * 100);
  const valid = Number.isFinite(amountCents) && amountCents >= 100;
  const check = valid ? checkPrice({ plan, amountCents, interval }, assumptions) : null;

  async function publish() {
    setBusy(true);
    setError(null);
    const result = await adminAction({
      action: "publish_price",
      plan,
      interval,
      cohort,
      amountCents,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success("Preço publicado.");
    void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publicar preço</DialogTitle>
          <DialogDescription>
            O preço entra na lista pública e fica imutável. Abaixo do piso de margem o sistema
            recusa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PaidPlanKey)}>
              <SelectTrigger aria-label="Plano">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAID_PLAN_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {PLANS[k].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cobrança</Label>
            <Select value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
              <SelectTrigger aria-label="Cobrança">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Degrau</Label>
            <Select value={cohort} onValueChange={setCohort}>
              <SelectTrigger aria-label="Degrau">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COHORTS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.key} · {c.seats} vagas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="price-reais" className="text-xs">
            Preço em reais
          </Label>
          <Input
            id="price-reais"
            inputMode="decimal"
            value={reais}
            onChange={(e) => setReais(e.target.value.replace(/[^\d,.]/g, ""))}
            className="text-lg tabular-nums"
          />
        </div>
        {check ? (
          <div className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite">
            <div className="flex items-center justify-between">
              <span>Margem no pior caso</span>
              <MarginPill value={check.worstMargin} />
            </div>
            <div className="flex items-center justify-between">
              <span>
                Margem esperada (rendimento {assumptions.videoYield.toString().replace(".", ",")})
              </span>
              <MarginPill value={check.expectedMargin} />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Piso 40% · alarme 55% · meta 60%</span>
              <span className="tabular-nums">
                {brl(check.floorMinCents / 100, true)} · {brl(check.alarmMinCents / 100, true)} ·{" "}
                {brl(check.targetMinCents / 100, true)}
              </span>
            </div>
            {check.messages.map((m) => (
              <p
                key={m}
                className={check.level === "blocked" ? "text-destructive" : "text-muted-foreground"}
              >
                {m}
              </p>
            ))}
            {check.level === "ok" ? (
              <p className="text-muted-foreground">Dentro da meta de margem.</p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void publish()} disabled={busy || !check || !check.allowed}>
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssumptionsForm({ assumptions }: { assumptions: Assumptions }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(assumptions[f.key])])),
  );
  const [busy, setBusy] = useState(false);
  const patch: Partial<Record<string, number>> = {};
  for (const f of FIELDS) {
    const value = Number(draft[f.key]?.replace(",", "."));
    if (Number.isFinite(value) && value !== assumptions[f.key]) patch[f.key] = value;
  }
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    setBusy(true);
    const result = await adminAction({ action: "save_assumptions", patch });
    setBusy(false);
    if (result.ok) {
      toast.success("Premissas salvas. Os próximos preços usam estes valores.");
      void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } else toast.error(result.message);
  }

  return (
    <Panel
      title="Premissas"
      description="Alimentam o piso de margem e as telas de receita. Preços já publicados guardam uma cópia das premissas do dia."
      action={
        <Button size="sm" disabled={!dirty || busy} onClick={() => void save()}>
          <Save className="size-3.5" aria-hidden /> Salvar
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`a-${f.key}`} className="text-xs">
              {f.label}
            </Label>
            <Input
              id={`a-${f.key}`}
              inputMode="decimal"
              step={f.step}
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              className="tabular-nums"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PricingPage({ data }: { data: AdminData }) {
  const queryClient = useQueryClient();
  const steps = useMemo(() => ladder(data), [data]);
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    setSeeding(true);
    const result = await adminAction({ action: "seed_prices" });
    setSeeding(false);
    if (result.ok) {
      const body = result.body as
        { published?: number; skipped?: number; blocked?: string[] } | undefined;
      toast.success(
        `${body?.published ?? 0} preços publicados, ${body?.skipped ?? 0} já existiam.`,
      );
      if (body?.blocked?.length)
        toast.error(`${body.blocked.length} ficaram abaixo do piso e foram recusados.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } else toast.error(result.message);
  }

  const columns: Column<LadderStep>[] = [
    { id: "plan", header: "Plano", sort: (s) => s.plan, cell: (s) => <PlanPill plan={s.plan} /> },
    {
      id: "interval",
      header: "Cobrança",
      cell: (s) => (s.interval === "year" ? "Anual" : "Mensal"),
    },
    { id: "cohort", header: "Degrau", cell: (s) => <Pill>{s.cohort}</Pill> },
    {
      id: "price",
      header: "Preço",
      align: "right",
      sort: (s) => s.amountCents,
      cell: (s) => <strong>{brl(s.amountCents / 100, true)}</strong>,
    },
    { id: "seats", header: "Vagas", align: "right", cell: (s) => `${s.taken}/${s.seats}` },
    {
      id: "worst",
      header: "Margem, pior caso",
      align: "right",
      sort: (s) => s.worstMargin,
      cell: (s) => <MarginPill value={s.worstMargin} />,
    },
    {
      id: "expected",
      header: "Margem esperada",
      align: "right",
      sort: (s) => s.expectedMargin,
      cell: (s) => <MarginPill value={s.expectedMargin} />,
    },
    { id: "status", header: "Situação", cell: (s) => <StatusPill status={s.status} /> },
    {
      id: "created",
      header: "Publicado",
      cell: (s) => (
        <span className="text-muted-foreground">
          {shortDate(data.prices.find((p) => p.id === s.priceId)?.created_at ?? data.now)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Preços"
        description={`O registro público de preços. Todo preço passa pelo piso de margem (${pct(HARD_FLOOR, 0)}), com alarme em ${pct(ALARM_MARGIN, 0)} e meta de ${pct(TARGET_MARGIN, 0)}. Preços vendidos nunca são editados: o degrau seguinte é um novo preço.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void seed()} disabled={seeding}>
              <Rocket className="size-3.5" aria-hidden /> Publicar preços de lançamento
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> Novo preço
            </Button>
          </>
        }
      />
      <Panel flush>
        <DataTable
          columns={columns}
          rows={steps}
          rowKey={(s) => s.priceId}
          pageSize={14}
          initialSort={{ id: "plan", dir: "asc" }}
          empty={
            <Empty
              title="Nenhum preço publicado"
              hint="Use “Publicar preços de lançamento” para criar os 12 preços do plano (Essencial e Pro, mensal e anual, em três degraus)."
            />
          }
        />
      </Panel>
      <AssumptionsForm key={JSON.stringify(data.assumptions)} assumptions={data.assumptions} />
      <PublishDialog open={open} onOpenChange={setOpen} assumptions={data.assumptions} />
    </>
  );
}
