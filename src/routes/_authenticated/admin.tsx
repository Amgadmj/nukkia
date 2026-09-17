import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Nukkia" },
      { name: "description", content: "Visão geral de clientes, diagnósticos e uso de IA." },
    ],
  }),
  component: Admin,
});

type Row = {
  companyId: string;
  name: string;
  segment: string | null;
  ownerEmail: string | null;
  createdAt: string;
  onboardingStep: string;
  latestScore: number | null;
  aiCalls: number;
};

/**
 * Minimal, read-only admin view: RLS does the actual restriction (every
 * table's policy grants admins the same access owns_company() already
 * gives them for their own data — see the "companies owner" and other
 * policies in the first migration), so this queries the same authenticated
 * client every other page uses. No service role, no separate admin API.
 */
function useAdminOverview(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ["admin-overview"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: companies }, { data: profiles }, { data: diagnostics }, { data: usage }] =
        await Promise.all([
          supabase
            .from("companies")
            .select("id, name, segment, owner_id, created_at, onboarding_step")
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("id, email"),
          supabase
            .from("diagnostics")
            .select("company_id, score, created_at")
            .order("created_at", { ascending: false }),
          supabase.from("ai_usage").select("company_id"),
        ]);

      const emailByOwner = new Map((profiles ?? []).map((p) => [p.id, p.email]));
      const latestScoreByCompany = new Map<string, number | null>();
      for (const d of diagnostics ?? []) {
        if (!latestScoreByCompany.has(d.company_id))
          latestScoreByCompany.set(d.company_id, d.score);
      }
      const usageCountByCompany = new Map<string, number>();
      for (const u of usage ?? []) {
        usageCountByCompany.set(u.company_id, (usageCountByCompany.get(u.company_id) ?? 0) + 1);
      }

      return (companies ?? []).map((c) => ({
        companyId: c.id,
        name: c.name,
        segment: c.segment,
        ownerEmail: emailByOwner.get(c.owner_id) ?? null,
        createdAt: c.created_at,
        onboardingStep: c.onboarding_step,
        latestScore: latestScoreByCompany.get(c.id) ?? null,
        aiCalls: usageCountByCompany.get(c.id) ?? 0,
      }));
    },
  });
}

function Admin() {
  const { data: isAdmin, isLoading: checkingRole } = useIsAdmin();
  const { data: rows, isLoading: loadingRows } = useAdminOverview(isAdmin === true);

  if (checkingRole) return <p className="text-muted-foreground">Carregando...</p>;

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">Esta área é exclusiva para a equipe Nukkia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Painel administrativo</h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral de clientes, diagnósticos e uso de IA. Somente leitura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
          <CardDescription>{rows?.length ?? 0} empresas cadastradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Chamadas de IA</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows ?? []).map((row) => (
                    <TableRow key={row.companyId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.segment ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.ownerEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.onboardingStep}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.latestScore != null ? `${row.latestScore}/100` : "—"}
                      </TableCell>
                      <TableCell>{row.aiCalls}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
