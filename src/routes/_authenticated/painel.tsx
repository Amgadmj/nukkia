import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, BrainCircuit, CalendarDays, Palette, Share2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { useCompany, useDiagnostic, useMissions, useProgress } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel | Nukkia" },
      { name: "description", content: "Visão geral da presença digital da sua empresa." },
      { property: "og:title", content: "Painel | Nukkia" },
      { property: "og:description", content: "Visão geral da presença digital da sua empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

const empresaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  segment: z.string().trim().max(120).optional().or(z.literal("")),
  employees: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  instagram: z.string().trim().max(100).optional().or(z.literal("")),
  linkedin: z.string().trim().max(200).optional().or(z.literal("")),
});

function Painel() {
  const { data: company, isLoading } = useCompany();

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!company) return <CadastroEmpresa />;

  return <Overview companyId={company.id} companyName={company.name} />;
}

function CadastroEmpresa() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = empresaSchema.safeParse({
      name: form.get("name"),
      cnpj: form.get("cnpj"),
      segment: form.get("segment"),
      employees: form.get("employees"),
      website: form.get("website"),
      instagram: form.get("instagram"),
      linkedin: form.get("linkedin"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados.");
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from("companies")
        .insert({
          owner_id: userData.user!.id,
          name: parsed.data.name,
          cnpj: parsed.data.cnpj || null,
          segment: parsed.data.segment || null,
          employees: parsed.data.employees || null,
          website: parsed.data.website || null,
          instagram_handle: parsed.data.instagram || null,
          linkedin_url: parsed.data.linkedin || null,
          onboarding_step: "diagnostic",
        })
        .select("id")
        .single();
      if (error || !created) {
        toast.error("Não foi possível salvar a empresa.");
        return;
      }
      toast.success("Empresa cadastrada! Vamos ao diagnóstico.");
      queryClient.invalidateQueries({ queryKey: ["company"] });

      // Two-phase onboarding, phase one: if the client already gave us a
      // site or social handle, kick off the AI draft now in the background
      // so the diagnostic form is pre-filled by the time they get there —
      // they only need to confirm/correct instead of typing from scratch.
      if (parsed.data.website || parsed.data.instagram || parsed.data.linkedin) {
        apiFetch("/api/pesquisa-empresa", { companyId: created.id }).catch(() => {
          // best-effort — the diagnostic page also offers a manual retry
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Cadastre sua empresa</CardTitle>
        <CardDescription>
          Esses dados alimentam o cérebro da Nukkia e personalizam todo o seu plano.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome da empresa</Label>
            <Input id="name" name="name" maxLength={120} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" name="cnpj" placeholder="00.000.000/0001-00" maxLength={20} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment">Segmento</Label>
            <Input id="segment" name="segment" placeholder="Clínica odontológica" maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employees">Número de funcionários</Label>
            <Input id="employees" name="employees" placeholder="1 a 10" maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Site (opcional)</Label>
            <Input id="website" name="website" placeholder="https://" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram (opcional)</Label>
            <Input id="instagram" name="instagram" placeholder="@suaempresa" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn (opcional)</Label>
            <Input
              id="linkedin"
              name="linkedin"
              placeholder="https://linkedin.com/company/..."
              maxLength={200}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Com o site ou uma rede social, a Nukkia já adianta um rascunho do seu diagnóstico — você
            só revisa e ajusta.
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Overview({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { data: diagnostic } = useDiagnostic(companyId);
  const { data: progress } = useProgress(companyId);
  const { data: missions } = useMissions(companyId);

  const xp = progress?.xp ?? 0;
  const level = progress?.level ?? 1;
  const nextLevelXp = level * 500;
  const done = (missions ?? []).filter((m) => m.status === "done").length;

  const atalhos = [
    {
      to: "/diagnostico",
      icon: BrainCircuit,
      title: "Diagnóstico",
      desc: diagnostic ? "Revise suas respostas e o relatório" : "Responda e receba seu relatório",
    },
    { to: "/marca", icon: Palette, title: "Identidade", desc: "Logo, paleta, fontes e tom de voz" },
    { to: "/trilha", icon: Trophy, title: "Trilha", desc: "Missões prioritárias e XP" },
    { to: "/conteudo", icon: CalendarDays, title: "Conteúdo", desc: "Calendário e peças do mês" },
    { to: "/redes", icon: Share2, title: "Redes", desc: "Conecte Instagram e LinkedIn" },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Olá, {companyName}</h1>
        <p className="mt-1 text-muted-foreground">
          Veja o estado da sua presença digital e o próximo passo da sua trilha.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Nível</CardDescription>
            <CardTitle className="text-3xl">{level}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(100, (xp / nextLevelXp) * 100)} />
            <p className="mt-2 text-xs text-muted-foreground">
              {xp} XP de {nextLevelXp} para o próximo nível
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missões concluídas</CardDescription>
            <CardTitle className="text-3xl">
              {done}/{missions?.length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/trilha">Ver trilha</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Presença digital</CardDescription>
            <CardTitle className="text-3xl">
              {diagnostic?.score != null ? `${diagnostic.score}/100` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/diagnostico">{diagnostic ? "Ver relatório" : "Fazer diagnóstico"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {atalhos.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="flex items-start gap-4 pt-6">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
