import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { useCompany, useDiagnostic } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico | Nukkia" },
      {
        name: "description",
        content: "Responda sobre público, mercado e serviços e receba seu relatório de presença digital.",
      },
      { property: "og:title", content: "Diagnóstico | Nukkia" },
      { property: "og:description", content: "Relatório de presença digital gerado por IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Diagnostico,
});

type Report = {
  resumo: string;
  pontos_fortes: string[];
  oportunidades: string[];
  recomendacoes: string[];
  pilares: string[];
};

function Diagnostico() {
  const { data: company } = useCompany();
  const { data: diagnostic } = useDiagnostic(company?.id);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const report = (diagnostic?.report ?? null) as Report | null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;
    const form = new FormData(event.currentTarget);
    const answers = {
      audience: String(form.get("audience") ?? "").slice(0, 1000),
      market: String(form.get("market") ?? "").slice(0, 1000),
      offers: String(form.get("offers") ?? "").slice(0, 1000),
      differentials: String(form.get("differentials") ?? "").slice(0, 1000),
      goals: String(form.get("goals") ?? "").slice(0, 1000),
      website: String(form.get("website") ?? "").slice(0, 200),
      instagram: String(form.get("instagram") ?? "").slice(0, 100),
      linkedin: String(form.get("linkedin") ?? "").slice(0, 200),
    };

    if (!answers.audience || !answers.offers) {
      toast.error("Conte pelo menos sobre seu público e seus serviços.");
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from("companies")
        .update({
          website: answers.website || null,
          instagram_handle: answers.instagram || null,
          linkedin_url: answers.linkedin || null,
          onboarding_step: "brand",
        })
        .eq("id", company.id);

      const response = await apiFetch("/api/diagnostico", { companyId: company.id, company: company.name, answers });
      if (!response.ok) {
        const text = await response.text();
        toast.error(`Não foi possível gerar o relatório. ${text.slice(0, 120)}`);
        return;
      }
      toast.success("Relatório pronto!");
      queryClient.invalidateQueries({ queryKey: ["diagnostic", company.id] });
      queryClient.invalidateQueries({ queryKey: ["missions", company.id] });
    } finally {
      setLoading(false);
    }
  }

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  const previous = (diagnostic?.answers ?? {}) as Record<string, string>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Diagnóstico da sua presença digital</CardTitle>
          <CardDescription>
            Quanto mais detalhe, mais preciso o plano que a Nukkia vai montar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="audience">Quem é seu público-alvo?</Label>
              <Textarea id="audience" name="audience" maxLength={1000} defaultValue={previous['audience']} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offers">Quais produtos ou serviços você vende?</Label>
              <Textarea id="offers" name="offers" maxLength={1000} defaultValue={previous['offers']} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="market">Como é o seu mercado e concorrência?</Label>
              <Textarea id="market" name="market" maxLength={1000} defaultValue={previous['market']} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="differentials">Quais são seus diferenciais?</Label>
              <Textarea
                id="differentials"
                name="differentials"
                maxLength={1000}
                defaultValue={previous['differentials']}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">O que você quer alcançar nos próximos 3 meses?</Label>
              <Textarea id="goals" name="goals" maxLength={1000} defaultValue={previous['goals']} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="website">Site</Label>
                <Input id="website" name="website" maxLength={200} defaultValue={company.website ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  name="instagram"
                  placeholder="@suaempresa"
                  maxLength={100}
                  defaultValue={company.instagram_handle ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input id="linkedin" name="linkedin" maxLength={200} defaultValue={company.linkedin_url ?? ""} />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              <Sparkles className="size-4" />
              {loading ? "Analisando..." : "Gerar meu relatório"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relatório</CardTitle>
          <CardDescription>
            {diagnostic?.score != null
              ? `Sua presença digital hoje: ${diagnostic.score}/100`
              : "Responda ao formulário para receber sua análise."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!report && <p className="text-sm text-muted-foreground">Nenhum relatório ainda.</p>}
          {report && (
            <>
              <p className="text-sm leading-relaxed">{report.resumo}</p>
              <Section title="Pontos fortes" items={report.pontos_fortes} />
              <Section title="Oportunidades" items={report.oportunidades} />
              <Section title="Recomendações" items={report.recomendacoes} />
              {report.pilares?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Pilares de conteúdo</p>
                  <div className="flex flex-wrap gap-2">
                    {report.pilares.map((p) => (
                      <Badge key={p} variant="secondary">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
