import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import {
  useCompany,
  useDiagnostic,
  type Company,
  type CompanyResearch,
  type CompanyResearchDraft,
} from "@/lib/company";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico | Nukkia" },
      {
        name: "description",
        content:
          "Responda sobre público, mercado e serviços e receba seu relatório de presença digital.",
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

type FieldKey = "audience" | "offers" | "market" | "differentials" | "goals" | "restrictions";

const FIELD_LABELS: Record<FieldKey, string> = {
  audience: "Quem é seu público-alvo?",
  offers: "Quais produtos ou serviços você vende?",
  market: "Como é o seu mercado e concorrência?",
  differentials: "Quais são seus diferenciais?",
  goals: "O que você quer alcançar nos próximos 3 meses?",
  restrictions:
    "Há restrições éticas ou regulatórias do seu segmento? (ex.: normas do CFM para clínicas, da OAB para escritórios de advocacia)",
};

function draftToFields(draft: CompanyResearchDraft | undefined): Partial<Record<FieldKey, string>> {
  if (!draft) return {};
  return {
    audience: draft.publico_alvo,
    market: draft.mercado_concorrencia,
    differentials: draft.diferenciais_provaveis,
    goals: draft.objetivos_provaveis,
  };
}

function Diagnostico() {
  const { data: company, isLoading: companyLoading } = useCompany();
  const { data: diagnostic, isLoading: diagnosticLoading } = useDiagnostic(company?.id);

  if (!company) {
    return companyLoading ? (
      <p className="text-muted-foreground">Carregando...</p>
    ) : (
      <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>
    );
  }

  if (diagnosticLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  const report = (diagnostic?.report ?? null) as Report | null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DiagnosticoForm
        company={company}
        previousAnswers={(diagnostic?.answers ?? null) as Record<string, string> | null}
        score={diagnostic?.score ?? null}
      />

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

/**
 * Only mounts once company/diagnostic have actually loaded (see Diagnostico
 * above) — the previous version read `defaultValue={previous[...]}` and
 * `defaultValue={company.website}` while those queries were still in
 * flight, so a returning user saw blank fields and saving overwrote their
 * real answers with empty strings.
 */
function DiagnosticoForm({
  company,
  previousAnswers,
  score,
}: {
  company: Company;
  previousAnswers: Record<string, string> | null;
  score: number | null;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [pesquisando, setPesquisando] = useState(false);

  const initialDraft = draftToFields(company.research?.draft);
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    audience: previousAnswers?.["audience"] ?? initialDraft.audience ?? "",
    offers: previousAnswers?.["offers"] ?? "",
    market: previousAnswers?.["market"] ?? initialDraft.market ?? "",
    differentials: previousAnswers?.["differentials"] ?? initialDraft.differentials ?? "",
    goals: previousAnswers?.["goals"] ?? initialDraft.goals ?? "",
    restrictions: previousAnswers?.["restrictions"] ?? "",
  });
  const [aiFilled, setAiFilled] = useState<Set<FieldKey>>(
    () => new Set(previousAnswers ? [] : (Object.keys(initialDraft) as FieldKey[])),
  );

  const podeSugerir = Boolean(company.website || company.instagram_handle || company.linkedin_url);

  function updateField(key: FieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setAiFilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function sugerirComIA() {
    setPesquisando(true);
    try {
      const response = await apiFetch("/api/pesquisa-empresa", { companyId: company.id });
      if (!response.ok) {
        toast.error(`Não foi possível gerar sugestões. ${(await response.text()).slice(0, 120)}`);
        return;
      }
      const { research } = (await response.json()) as { research: CompanyResearch };
      const draft = draftToFields(research.draft);
      setFields((prev) => ({ ...prev, ...draft }) as Record<FieldKey, string>);
      setAiFilled(new Set(Object.keys(draft) as FieldKey[]));
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Sugestões da IA aplicadas — revise antes de enviar.");
    } finally {
      setPesquisando(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answers = {
      audience: fields.audience.slice(0, 1000),
      market: fields.market.slice(0, 1000),
      offers: fields.offers.slice(0, 1000),
      differentials: fields.differentials.slice(0, 1000),
      goals: fields.goals.slice(0, 1000),
      restrictions: fields.restrictions.slice(0, 1000),
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
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          website: answers.website || null,
          instagram_handle: answers.instagram || null,
          linkedin_url: answers.linkedin || null,
          onboarding_step: "brand",
        })
        .eq("id", company.id);
      if (updateError) {
        toast.error("Não foi possível salvar os dados da empresa.");
        return;
      }

      const response = await apiFetch("/api/diagnostico", { companyId: company.id, answers });
      if (!response.ok) {
        toast.error(`Não foi possível gerar o relatório. ${(await response.text()).slice(0, 120)}`);
        return;
      }
      toast.success("Relatório pronto!");
      queryClient.invalidateQueries({ queryKey: ["diagnostic", company.id] });
      queryClient.invalidateQueries({ queryKey: ["missions", company.id] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Diagnóstico da sua presença digital</CardTitle>
            <CardDescription>
              Quanto mais detalhe, mais preciso o plano que a Nukkia vai montar.
            </CardDescription>
          </div>
          {podeSugerir && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sugerirComIA}
              disabled={pesquisando}
            >
              <Wand2 className="size-4" />
              {pesquisando ? "Analisando..." : "Sugerir com IA"}
            </Button>
          )}
        </div>
        {score != null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Você já tem um relatório (score {score}/100). Enviar de novo gera uma nova análise.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {(
            [
              ["audience", true],
              ["offers", true],
              ["market", false],
              ["differentials", false],
              ["goals", false],
              ["restrictions", false],
            ] as [FieldKey, boolean][]
          ).map(([key, required]) => (
            <div className="space-y-2" key={key}>
              <div className="flex items-center gap-2">
                <Label htmlFor={key}>{FIELD_LABELS[key]}</Label>
                {aiFilled.has(key) && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Sparkles className="size-3" /> Sugestão da IA — revise
                  </Badge>
                )}
              </div>
              <Textarea
                id={key}
                name={key}
                maxLength={1000}
                value={fields[key]}
                onChange={(event) => updateField(key, event.target.value)}
                required={required}
              />
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="website">Site</Label>
              <Input
                id="website"
                name="website"
                maxLength={200}
                defaultValue={company.website ?? ""}
              />
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
              <Input
                id="linkedin"
                name="linkedin"
                maxLength={200}
                defaultValue={company.linkedin_url ?? ""}
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <Sparkles className="size-4" />
            {loading ? "Analisando..." : "Gerar meu relatório"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
