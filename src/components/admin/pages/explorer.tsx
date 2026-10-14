import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { isFixtureMode } from "@/lib/admin/fixture-mode";
import { Empty, PageHeader, Panel, int } from "../ui";

/** Tables an admin may browse. Secrets (`social_account_secrets`) are deliberately absent. */
const TABLES: { name: string; label: string; order: string | null }[] = [
  { name: "companies", label: "Empresas", order: "created_at" },
  { name: "profiles", label: "Perfis", order: "created_at" },
  { name: "subscriptions", label: "Assinaturas", order: "created_at" },
  { name: "purchases", label: "Compras", order: "created_at" },
  { name: "billing_events", label: "Eventos de cobrança", order: "received_at" },
  { name: "price_registry", label: "Registro de preços", order: "created_at" },
  { name: "pricing_assumptions", label: "Premissas de preço", order: null },
  { name: "plan_entitlements", label: "Direitos por plano", order: null },
  { name: "video_unit_lots", label: "Vídeos: lotes", order: "created_at" },
  { name: "video_unit_events", label: "Vídeos: movimentos", order: "created_at" },
  { name: "ai_usage", label: "Uso de IA", order: "created_at" },
  { name: "content_items", label: "Peças de conteúdo", order: "created_at" },
  { name: "content_plans", label: "Planos de conteúdo", order: "created_at" },
  { name: "diagnostics", label: "Diagnósticos", order: "created_at" },
  { name: "brand_kits", label: "Kits de marca", order: "created_at" },
  { name: "brand_stories", label: "Histórias de marca", order: "created_at" },
  { name: "marketing_workspaces", label: "Workspaces", order: "updated_at" },
  { name: "onboarding_drafts", label: "Rascunhos de onboarding", order: "updated_at" },
  { name: "missions", label: "Missões", order: "created_at" },
  { name: "user_progress", label: "Progresso", order: null },
  { name: "social_accounts", label: "Contas sociais", order: "created_at" },
  { name: "scheduled_posts", label: "Publicações agendadas", order: "created_at" },
  { name: "metrics_snapshots", label: "Métricas", order: "created_at" },
  { name: "user_roles", label: "Papéis", order: "created_at" },
];

type Row = Record<string, unknown>;
type Loose = {
  from: (table: string) => {
    select: (columns: string, options: { count: "exact" }) => LooseQuery;
  };
};
type LooseQuery = {
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  ilike: (column: string, pattern: string) => LooseQuery;
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null; count: number | null }>;
};

const PAGE = 25;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toCsv(rows: Row[], columns: string[]): string {
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => escape(cellText(r[c]))).join(",")),
  ].join("\n");
}

export function ExplorerPage() {
  const [table, setTable] = useState(TABLES[0]!.name);
  const [page, setPage] = useState(0);
  const [column, setColumn] = useState<string>("");
  const [needle, setNeedle] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const meta = TABLES.find((t) => t.name === table)!;
  const fixtures = isFixtureMode();

  const query = useQuery({
    enabled: !fixtures,
    queryKey: ["admin-explorer", table, page, column, needle],
    placeholderData: (previous) => previous,
    queryFn: async () => {
      let q = (supabase as unknown as Loose).from(table).select("*", { count: "exact" });
      if (meta.order) q = q.order(meta.order, { ascending: false });
      if (column && needle.trim()) q = q.ilike(column, `%${needle.trim()}%`);
      const { data, error, count } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const columns = useMemo(() => {
    const keys: string[] = [];
    for (const row of rows)
      for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
    return keys;
  }, [rows]);
  const textColumns = columns.filter((c) => rows.some((r) => typeof r[c] === "string"));
  const total = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  function download() {
    const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${table}-pagina-${page + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Dados"
        description="Navegue pelas tabelas do banco, só para leitura. Você vê o que a sua permissão de administrador enxerga; segredos de contas sociais não aparecem."
      />
      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select
            value={table}
            onValueChange={(next) => {
              setTable(next);
              setPage(0);
              setColumn("");
              setNeedle("");
            }}
          >
            <SelectTrigger className="w-60" aria-label="Tabela">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLES.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.label}{" "}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{t.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={column || "none"}
            onValueChange={(v) => {
              setColumn(v === "none" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Coluna do filtro">
              <SelectValue placeholder="Filtrar coluna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem filtro</SelectItem>
              {textColumns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {column ? (
            <Input
              value={needle}
              onChange={(e) => {
                setNeedle(e.target.value);
                setPage(0);
              }}
              placeholder="contém…"
              className="w-48"
              aria-label="Valor do filtro"
            />
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {fixtures ? "Modo de exemplo" : `${int(total)} linhas`}
          </span>
          <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
            <Download className="size-3.5" aria-hidden /> CSV da página
          </Button>
        </div>

        {fixtures ? (
          <Empty
            title="O explorador lê o banco real"
            hint="No modo de exemplo não há banco conectado. Abra o painel logado como administrador para navegar pelas tabelas."
          />
        ) : query.isError ? (
          <Empty
            title="Não foi possível ler esta tabela"
            hint={query.error instanceof Error ? query.error.message : undefined}
          />
        ) : rows.length === 0 && !query.isFetching ? (
          <Empty title="Nenhuma linha" hint="A tabela está vazia ou o filtro não encontrou nada." />
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c} className="h-9 whitespace-nowrap font-mono text-xs">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow
                    key={String(row["id"] ?? index)}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
                    onClick={() => setOpen(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setOpen(row);
                    }}
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c}
                        className="max-w-64 truncate py-2 font-mono text-xs"
                        title={cellText(row[c])}
                      >
                        {row[c] === null ? (
                          <span className="text-muted-foreground">null</span>
                        ) : (
                          cellText(row[c])
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!fixtures && total > PAGE ? (
          <footer className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              Página {page + 1} de {pages}
            </span>
            <span className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                disabled={page >= pages - 1}
                onClick={() => setPage(page + 1)}
                aria-label="Próxima página"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </span>
          </footer>
        ) : null}
      </Panel>

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="px-6 pb-4 pt-6 pr-12">
            <SheetTitle>{meta.label}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {table}
              {open && open["id"] ? ` · ${String(open["id"])}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-8">
            <Button
              variant="outline"
              size="sm"
              className="mb-3"
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(open, null, 2));
                toast.success("JSON copiado.");
              }}
            >
              <Copy className="size-3.5" aria-hidden /> Copiar JSON
            </Button>
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(open, null, 2)}
            </pre>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
