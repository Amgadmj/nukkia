import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { ContentStudio } from "@/components/content-studio";
import { ContentReadiness } from "@/components/content-readiness";
import { briefIssues, identityReady } from "@/lib/brand-preview";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clapperboard, GalleryHorizontal, ImageIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import type { DemoData } from "@/lib/quick-start";
import { contentPlanReady } from "@/lib/content-readiness";
import { useBrandKit, useCompany } from "@/lib/company";
import type { CarouselSlide, Storyboard } from "@/lib/content-engine/types";

export const Route = createFileRoute("/_authenticated/conteudo")({
  validateSearch: z.object({ aba: z.enum(["peca", "abordagens", "calendario"]).catch("peca") }),
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
  image_path: string | null;
  slides: CarouselSlide[];
  storyboard: Storyboard | null;
  video_operation: string | null;
  video_path: string | null;
  video_error: string | null;
  status: string;
};

const FORMAT_LABEL: Record<string, string> = {
  post: "Gerar arte",
  stories: "Gerar arte",
  artigo: "Gerar arte",
  carrossel: "Gerar carrossel",
  reels: "Gerar roteiro + vídeo",
};

function Conteudo() {
  const { data, setData } = useMarketingWorkspace();
  const { aba } = Route.useSearch();
  const navigate = useNavigate();
  const setView = (view: "peca" | "abordagens" | "calendario") =>
    void navigate({ to: "/conteudo", search: { aba: view } });
  return (
    <div className="space-y-7">
      <div className="workspace-tabs" role="tablist" aria-label="Conteúdo">
        {(
          [
            ["peca", "Minha peça"],
            ["abordagens", "Três abordagens"],
            ["calendario", "Planejamento mensal"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={aba === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {aba === "calendario" ? (
        <Calendario
          data={data}
          onIdentity={() => void navigate({ to: "/marca", search: { retorno: "conteudo" } })}
          onContext={() =>
            void navigate({
              to: "/diagnostico",
              search: { editar: "contexto", retorno: "conteudo" },
            })
          }
        />
      ) : (
        <ContentStudio
          data={data}
          onData={setData}
          onEditBrief={() =>
            void navigate({
              to: "/diagnostico",
              search: { editar: "contexto", retorno: "conteudo" },
            })
          }
          onTrail={() => void navigate({ to: "/trilha" })}
          onIdentity={() => void navigate({ to: "/marca", search: { retorno: "conteudo" } })}
          view={aba}
          onView={setView}
          onVideo={async (frames) => {
            const response = await apiFetch("/api/promo-video", { frames });
            if (!response.ok) {
              const error = (await response.json().catch(() => null)) as {
                message?: unknown;
              } | null;
              throw new Error(
                typeof error?.message === "string"
                  ? error.message.slice(0, 240)
                  : "Não foi possível preparar o vídeo. Tente novamente.",
              );
            }
            return response.blob();
          }}
        />
      )}
    </div>
  );
}

function Calendario({
  data,
  onIdentity,
  onContext,
}: {
  data: DemoData;
  onIdentity: () => void;
  onContext: () => void;
}) {
  const { data: company } = useCompany();
  const { data: brandKit } = useBrandKit(company?.id);
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const [gerandoArte, setGerandoArte] = useState<string | null>(null);
  const planReady = contentPlanReady(data, Boolean(brandKit));

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
      return (data ?? []) as unknown as ContentItem[];
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
      const response = await apiFetch("/api/arte", {
        contentItemId: item.id,
        companyId: company!.id,
      });
      if (!response.ok) {
        toast.error(`Não foi possível gerar a peça. ${(await response.text()).slice(0, 120)}`);
        return;
      }
      toast.success(
        item.format === "reels" ? "Roteiro pronto — gerando o vídeo..." : "Peça gerada!",
      );
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
        <Button onClick={gerarPlano} disabled={gerando || !planReady}>
          <Sparkles className="size-4" />
          {gerando ? "Criando plano..." : "Gerar plano do mês"}
        </Button>
      </div>

      {(briefIssues(data).length > 0 || !identityReady(data.brand)) && (
        <ContentReadiness
          data={data}
          context="calendar"
          onIdentity={onIdentity}
          onContext={onContext}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(itens ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma publicação planejada ainda.</p>
        )}
        {(itens ?? []).map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            companyId={company.id}
            onAprovar={aprovar}
            onGerarArte={gerarArte}
            gerandoArte={gerandoArte === item.id}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Every generated asset is stored as a private-bucket PATH, not a
 * long-lived URL cached in the row — the original design saved a signed
 * URL straight into the database (first a year, briefly a 7-day interim
 * fix), which can't be revoked and eventually breaks. The client signs a
 * fresh, short-lived URL whenever it actually renders something instead.
 */
function useSignedUrl(path: string | null) {
  return useQuery({
    enabled: Boolean(path),
    queryKey: ["signed-url", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("content-media")
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Signs every slide path for one carousel in a single storage call. */
function useCarouselUrls(itemId: string, slides: CarouselSlide[]) {
  const paths = slides.map((s) => s.path);
  return useQuery({
    enabled: paths.length > 0,
    queryKey: ["carousel-urls", itemId, paths],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("content-media")
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      return (data ?? [])
        .map((entry, index) => ({ order: slides[index]!.order, url: entry.signedUrl }))
        .filter((slide): slide is { order: number; url: string } => Boolean(slide.url))
        .sort((a, b) => a.order - b.order);
    },
  });
}

/**
 * Veo rendering takes minutes — /api/arte only kicks the job off, this
 * polls /api/video-status until it's no longer "rendering", then
 * invalidates the content-items list so the row's real video_path/error
 * gets picked up.
 */
function useVideoPolling(companyId: string, item: ContentItem) {
  const queryClient = useQueryClient();
  const pending = item.format === "reels" && Boolean(item.video_operation) && !item.video_path;

  const { data } = useQuery({
    enabled: pending,
    queryKey: ["video-status", item.id],
    queryFn: async () => {
      const response = await apiFetch("/api/video-status", { companyId, contentItemId: item.id });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as { status: string; error?: string };
    },
    refetchInterval: (query) => (query.state.data?.status === "rendering" ? 8000 : false),
  });

  useEffect(() => {
    if (data && data.status !== "rendering") {
      queryClient.invalidateQueries({ queryKey: ["content-items", companyId] });
    }
  }, [data, companyId, queryClient]);

  return pending;
}

function ItemCard({
  item,
  companyId,
  onAprovar,
  onGerarArte,
  gerandoArte,
}: {
  item: ContentItem;
  companyId: string;
  onAprovar: (item: ContentItem, caption: string) => void;
  onGerarArte: (item: ContentItem) => void;
  gerandoArte: boolean;
}) {
  const [caption, setCaption] = useState(item.caption ?? "");
  const { data: carouselUrls } = useCarouselUrls(item.id, item.slides ?? []);
  const { data: imageUrl } = useSignedUrl(item.image_path);
  const { data: videoUrl } = useSignedUrl(item.video_path);
  const rendering = useVideoPolling(companyId, item);
  const hasContent =
    Boolean(item.image_path) || (item.slides?.length ?? 0) > 0 || Boolean(item.storyboard);

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
        {item.format === "carrossel" && (carouselUrls?.length ?? 0) > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {carouselUrls!.map((slide) => (
              <img
                key={slide.order}
                src={slide.url}
                alt={`Slide ${slide.order + 1} de ${item.title}`}
                className="h-40 w-32 shrink-0 rounded-lg border border-border object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {item.format === "reels" && item.storyboard && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clapperboard className="size-4" />
              Roteiro ({item.storyboard.duracao_total_seg}s)
              {rendering && (
                <Badge variant="outline" className="ml-auto animate-pulse text-[10px]">
                  Renderizando vídeo...
                </Badge>
              )}
              {item.video_error && !rendering && (
                <Badge variant="outline" className="ml-auto text-[10px] text-destructive">
                  Falha no vídeo
                </Badge>
              )}
            </div>
            <ol className="space-y-2 text-xs text-muted-foreground">
              {item.storyboard.shots.map((shot) => (
                <li key={shot.ordem}>
                  <span className="font-medium text-foreground">
                    Bloco {shot.ordem} ({shot.duracao_seg}s):
                  </span>{" "}
                  {shot.narracao} — <span className="italic">{shot.visual_descricao}</span>
                </li>
              ))}
            </ol>
            {videoUrl && <video src={videoUrl} controls className="w-full rounded-lg" />}
            {item.video_error && <p className="text-xs text-destructive">{item.video_error}</p>}
          </div>
        )}

        {item.format !== "carrossel" && item.format !== "reels" && imageUrl && (
          <img
            src={imageUrl}
            alt={`Arte da publicação ${item.title}`}
            className="w-full rounded-lg border border-border"
            loading="lazy"
          />
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`caption-${item.id}`} className="sr-only">
            Legenda
          </Label>
          <Textarea
            id={`caption-${item.id}`}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={6}
            maxLength={2200}
          />
        </div>
        {item.hashtags && <p className="text-xs text-muted-foreground">{item.hashtags}</p>}
        {item.cta && <p className="text-sm font-medium">CTA: {item.cta}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAprovar(item, caption)}>
            Aprovar texto
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGerarArte(item)}
            disabled={gerandoArte || rendering}
          >
            {item.format === "carrossel" ? (
              <GalleryHorizontal className="size-4" />
            ) : item.format === "reels" ? (
              <Clapperboard className="size-4" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            {gerandoArte || rendering
              ? "Gerando..."
              : hasContent
                ? `Refazer · ${FORMAT_LABEL[item.format] ?? "Gerar arte"}`
                : (FORMAT_LABEL[item.format] ?? "Gerar arte")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
