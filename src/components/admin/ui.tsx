import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ALARM_MARGIN, HARD_FLOOR, TARGET_MARGIN } from "@/lib/pricing/economics";
import { cn } from "@/lib/utils";

// --- Formatting -------------------------------------------------------------

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlWhole = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const intFmt = new Intl.NumberFormat("pt-BR");
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const brl = (value: number, whole = false) => (whole ? brlWhole : brlFmt).format(value);
export const usd = (value: number) => usdFmt.format(value);
export const int = (value: number) => intFmt.format(value);
export const pct = (value: number | null, digits = 1) =>
  value === null ? "—" : `${(value * 100).toFixed(digits).replace(".", ",")}%`;
export const shortDate = (iso: string | Date) =>
  dateFmt.format(new Date(iso)).replace(" de ", " ").replace(".", "");
export const dateTime = (iso: string | Date) =>
  dateTimeFmt.format(new Date(iso)).replace(" de ", " ").replace(".", "");

export function relativeTime(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

// --- Layout -----------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  flush,
}: {
  title?: string | undefined;
  description?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  /** Remove body padding, for tables that go edge to edge. */
  flush?: boolean | undefined;
}) {
  return (
    <section className={cn("rounded-xl border bg-card text-card-foreground", className)}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "p-5")}>{children}</div>
    </section>
  );
}

export function Empty({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string | undefined;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="text-muted-foreground">
        {icon ?? <SearchX className="size-6" aria-hidden />}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LoadingGrid({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

// --- Badges -----------------------------------------------------------------

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_55%)]",
  warn: "bg-warning/20 text-[color-mix(in_oklab,var(--warning),var(--foreground)_60%)]",
  bad: "bg-destructive/12 text-destructive",
  info: "bg-chart-3/15 text-[color-mix(in_oklab,var(--chart-3),var(--foreground)_40%)]",
  accent: "bg-primary/12 text-primary",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MarginPill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const tone: Tone =
    value < HARD_FLOOR
      ? "bad"
      : value < ALARM_MARGIN
        ? "warn"
        : value < TARGET_MARGIN
          ? "info"
          : "good";
  return <Pill tone={tone}>{pct(value)}</Pill>;
}

const STATUS_TONE: Record<string, [Tone, string]> = {
  active: ["good", "Ativo"],
  trialing: ["accent", "Em teste"],
  pending: ["neutral", "Pendente"],
  past_due: ["warn", "Atrasado"],
  canceled: ["bad", "Cancelado"],
  free: ["neutral", "Grátis"],
  processed: ["good", "Processado"],
  ignored: ["neutral", "Ignorado"],
  received: ["info", "Recebido"],
  failed: ["bad", "Falhou"],
  paid: ["good", "Pago"],
  refunded: ["warn", "Estornado"],
  published: ["good", "Publicado"],
  retired: ["neutral", "Aposentado"],
  draft: ["neutral", "Rascunho"],
};

export function StatusPill({ status }: { status: string }) {
  const [tone, label] = STATUS_TONE[status] ?? (["neutral", status] as [Tone, string]);
  return <Pill tone={tone}>{label}</Pill>;
}

export const PLAN_LABEL: Record<string, string> = {
  free: "Grátis",
  essencial: "Essencial",
  pro: "Pro",
};

export function PlanPill({ plan }: { plan: string }) {
  return (
    <Pill tone={plan === "pro" ? "accent" : plan === "essencial" ? "info" : "neutral"}>
      {PLAN_LABEL[plan] ?? plan}
    </Pill>
  );
}

// --- KPI card ---------------------------------------------------------------

const SPARK_CONFIG = { v: { label: "valor", color: "var(--chart-1)" } } satisfies ChartConfig;

export function Kpi({
  label,
  value,
  hint,
  tone,
  series,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "good" | "warn" | "bad" | undefined;
  series?: number[] | undefined;
  className?: string | undefined;
}) {
  const data = useMemo(() => (series ?? []).map((v, i) => ({ i, v })), [series]);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4",
        data.length > 1 && "pb-11",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-[color-mix(in_oklab,var(--warning),var(--foreground)_60%)]",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {data.length > 1 ? (
        <ChartContainer
          config={SPARK_CONFIG}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full opacity-60"
        >
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--color-v)"
              fill="var(--color-v)"
              fillOpacity={0.12}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : null}
    </div>
  );
}

// --- Data table ---------------------------------------------------------------

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => string | number | null;
  align?: "right";
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  initialSort,
  pageSize = 12,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { id: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const column = columns.find((c) => c.id === sort?.id);
    if (!column?.sort || !sort) return rows;
    const get = column.sort;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * dir;
    });
  }, [rows, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);

  if (rows.length === 0) return <>{empty ?? <Empty title="Nada por aqui ainda" />}</>;

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <TableHead
                    key={column.id}
                    aria-sort={
                      active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      "h-9 whitespace-nowrap text-xs",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                          column.align === "right" && "flex-row-reverse",
                        )}
                        onClick={() =>
                          setSort(
                            active && sort?.dir === "desc"
                              ? { id: column.id, dir: "asc" }
                              : { id: column.id, dir: "desc" },
                          )
                        }
                      >
                        {column.header}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow
                key={rowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  onRowClick &&
                    "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter") onRowClick(row);
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      "py-2.5 text-sm",
                      column.align === "right" && "text-right tabular-nums",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 ? (
        <footer className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            {current * pageSize + 1} a {Math.min((current + 1) * pageSize, sorted.length)} de{" "}
            {sorted.length}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              className="rounded-md border px-2 py-1 hover:bg-muted disabled:opacity-40"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-md border px-2 py-1 hover:bg-muted disabled:opacity-40"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              Próxima
            </button>
          </span>
        </footer>
      ) : null}
    </div>
  );
}
