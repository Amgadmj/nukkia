import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ImageIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { useBrandKit, useCompany } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/conteudo")({
  head: () => ({
    meta: [
      { title: "Calendário de conteúdo | Nukkia" },
      {
        name: "description",
        content: "Planejamento mensal de posts, textos aprovados e peças geradas por IA.",
      },
      { property: "og:title", content: "Calendário de conteúdo | Nukkia" },
      { property: "og:description", content: "Seu mês de publicações planejado pela Nukkia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conteudo,
});

type ContentItem = {
  id: string;
  scheduled_for: string;
  channel: string;
  format: string;
  pillar: string | null;
  title: string;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  image_url: string | null;
  status: string;
};

function Conteudo() {
  const { data: company } = useCompany();
  const { data: brandKit } = useBrandKit(company?.id);
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const [gerandoArte, setGerandoArte] = useState<string | null>(null);

  const { data: itens } = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["content-items", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("company_id", company!.id)
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });

  async function gerarPlano() {
    if (!company) return;
    setGerando(true);
    try {
      const response = await apiFetch("/api/plano", { companyId: company.id });
      if (!response.ok) {
        toast.error(`Não foi possível gerar o plano. ${(await response.text()).slice(0, 120)}`);
        return;
      }
      toast.success("Calendário do mês criado!");
      queryClient.invalidateQueries({ queryKey: ["content-items", company.id] });
    } finally {
      setGerando(false);
    }
  }

  async function aprovar(item: ContentItem, caption: string) {
    const { error } = await supabase
      .from("content_items")
      .update({ caption, status: "approved" })
      .eq("id", item.id);
    if (error) {
      toast.error("Não foi possível aprovar o texto.");
      return;
    }
    toast.success("Texto aprovado!");
    queryClient.invalidateQueries({ queryKey: ["content-items", company!.id] });
  }

  async function gerarArte(item: ContentItem) {
    setGerandoArte(item.id);
    try {
      const response = await apiFetch("/api/arte", { contentItemId: item.id, companyId: company!.id });
      if (!response.ok) {
        toast.error(`Não foi possível gerar a arte. ${(await response.text()).slice(0, 120)}`);
        return;
      }
      toast.success("Arte gerada!");
      queryClient.invalidateQueries({ queryKey: ["content-items", company!.id] });
    } finally {
      setGerandoArte(null);
    }
  }

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendário de conteúdo</h1>
          <p className="mt-1 text-muted-foreground">
            Textos e peças criados no tom da sua marca, prontos para aprovar e agendar.
          </p>
        </div>
        <Button onClick={gerarPlano} disabled={gerando || !brandKit}>
          <Sparkles className="size-4" />
          {gerando ? "Criando plano..." : "Gerar plano do mês"}
        </Button>
      </div>

      {!brandKit && (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          Defina a identidade da sua marca antes de gerar o plano de conteúdo.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(itens ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma publicação planejada ainda.</p>
        )}
        {(itens ?? []).map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onAprovar={aprovar}
            onGerarArte={gerarArte}
            gerandoArte={gerandoArte === item.id}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onAprovar,
  onGerarArte,
  gerandoArte,
}: {
  item: ContentItem;
  onAprovar: (item: ContentItem, caption: string) => void;
  onGerarArte: (item: ContentItem) => void;
  gerandoArte: boolean;
}) {
  const [caption, setCaption] = useState(item.caption ?? "");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {new Date(item.scheduled_for).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {item.channel}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {item.format}
          </Badge>
          {item.status === "approved" && (
            <Badge>
              <CheckCircle2 className="mr-1 size-3" /> Aprovado
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg">{item.title}</CardTitle>
        {item.pillar && <CardDescription>Pilar: {item.pillar}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {item.image_url && (
          <img
            src={item.image_url}
            alt={`Arte da publicação ${item.title}`}
            className="w-full rounded-lg border border-border"
            loading="lazy"
          />
        )}
        <Textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={6}
          maxLength={2200}
        />
        {item.hashtags && <p className="text-xs text-muted-foreground">{item.hashtags}</p>}
        {item.cta && <p className="text-sm font-medium">CTA: {item.cta}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAprovar(item, caption)}>
            Aprovar texto
          </Button>
          <Button size="sm" variant="outline" onClick={() => onGerarArte(item)} disabled={gerandoArte}>
            <ImageIcon className="size-4" />
            {gerandoArte ? "Gerando..." : item.image_url ? "Refazer arte" : "Gerar arte"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
