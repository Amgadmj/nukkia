import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandIdentitySettings } from "@/components/brand-identity-settings";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Check, Image, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandBook } from "@/components/brand-book";
import { useMarketingWorkspace } from "@/components/marketing-provider";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useBrandKit, useCompany, useDiagnostic, type Company } from "@/lib/company";
import { cn } from "@/lib/utils";
import { updateBrand, type BrandPreview } from "@/lib/brand-preview";
import { WORKSPACE_NAV, type WorkspaceSection } from "@/lib/marketing-workspace";
import { prepareAsset } from "@/lib/post-art";
import {
  BRAND_STORY_UNAVAILABLE,
  brandFonts,
  brandPalette,
  brandStorySchema,
  savedBrandStorySchema,
  type BrandStory,
  type SavedBrandStory,
} from "@/lib/brand-story";

export const Route = createFileRoute("/_authenticated/marca")({
  validateSearch: (search: Record<string, unknown>): { retorno?: WorkspaceSection } => {
    const origin = WORKSPACE_NAV.find((section) => section.id === search["retorno"]);
    return origin ? { retorno: origin.id } : {};
  },
  head: () => ({
    meta: [
      { title: "Identidade da marca | Nukkia" },
      {
        name: "description",
        content: "Envie sua logomarca e escolha paleta, tipografia e tom de voz da sua marca.",
      },
      { property: "og:title", content: "Identidade da marca | Nukkia" },
      { property: "og:description", content: "Design system da sua marca em minutos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Marca,
});

export type PaletteOption = { nome: string; cores: string[]; justificativa?: string };

// Starter choices for a company without saved options. AI generation is
// explicit only: visiting /marca must never spend quota or write brand data.
const FALLBACK_PALETTES: PaletteOption[] = [
  { nome: "Confiança Clínica", cores: ["#0F3D6E", "#2E8BC0", "#B1D4E0", "#F5F9FC"] },
  { nome: "Energia Moderna", cores: ["#2A0845", "#3B82F6", "#06B6D4", "#F8FAFC"] },
  { nome: "Acolhimento Natural", cores: ["#2F4F3E", "#7BA88B", "#E4C58B", "#FBF7F0"] },
];

const fontesOpcoes = [
  { id: "sora-manrope", label: "Sora + Manrope (moderna e tecnológica)" },
  { id: "playfair-inter", label: "Playfair Display + Inter (elegante)" },
  { id: "poppins-lato", label: "Poppins + Lato (amigável)" },
];

const tons = [
  "Profissional e acolhedor",
  "Técnico e direto",
  "Inspirador e próximo",
  "Descontraído e leve",
];

type BrandKit = Tables<"brand_kits">;

function Marca() {
  const navigate = useNavigate();
  const { retorno } = Route.useSearch();
  const origin = WORKSPACE_NAV.find((section) => section.id === (retorno ?? "conteudo"))!;
  const returnSearch = origin.id === "conteudo" ? { aba: "peca" as const } : {};
  const workspace = useMarketingWorkspace();
  const { data: company } = useCompany();
  const {
    data: brandKit,
    isLoading: brandKitLoading,
    isError: brandKitError,
  } = useBrandKit(company?.id);
  const {
    data: diagnostic,
    isLoading: diagnosticLoading,
    isError: diagnosticError,
  } = useDiagnostic(company?.id);
  const storyQuery = useQuery({
    queryKey: ["brand-story", company?.id],
    enabled: Boolean(company?.id),
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await apiFetch(`/api/brand-story?companyId=${company!.id}`, undefined, {
        method: "GET",
      });
      const payload = await response.json();
      if (response.status === 503 && payload?.code === "BRAND_STORY_UNAVAILABLE") {
        return { story: null, updatedAt: null, unavailable: true };
      }
      if (!response.ok) throw new Error("Não foi possível carregar a história salva.");
      return { ...savedBrandStorySchema.parse(payload), unavailable: false };
    },
  });
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const applyRequest = useRef<AbortController | null>(null);
  const latest = useRef({ workspace, brandKit, company });
  latest.current = { workspace, brandKit, company };
  useEffect(() => () => applyRequest.current?.abort(), []);

  const logoUrl = brandKit?.logo_url ?? null;
  const savedFontsLabel = brandFonts(brandKit?.fonts).label;
  const savedAccent = brandPalette(brandKit?.palette).colors[0];
  const workspaceReady =
    workspace.company?.id === company?.id &&
    workspace.sync !== "loading" &&
    workspace.sync !== "conflict";

  async function applyIdentity() {
    if (
      applyRequest.current ||
      !company ||
      !workspaceReady ||
      brandKitLoading ||
      brandKitError ||
      (!savedAccent && !logoUrl)
    )
      return;

    const controller = new AbortController();
    applyRequest.current = controller;
    const original = latest.current;
    setApplying(true);
    setApplyError(null);
    try {
      const patch: Partial<BrandPreview> = savedAccent ? { accent: savedAccent } : {};
      if (logoUrl) {
        // The account kit already stores a signed URL. Retrieve it only on
        // explicit apply; never place a remote URL in the raster-only workspace.
        const response = await fetch(logoUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(
            "Não foi possível carregar o logo salvo. O link pode ter expirado; envie o logo novamente e tente aplicar.",
          );
        }
        const blob = await response.blob();
        patch.logo = await prepareAsset(
          new File([blob], "logo-da-marca", { type: blob.type }),
          true,
        );
        patch.assetSource = "Logo do kit de identidade da conta";
      }
      if (controller.signal.aborted) return;
      const current = latest.current;
      if (
        current.workspace.ownerId !== original.workspace.ownerId ||
        current.company?.id !== original.company?.id ||
        current.workspace.company?.id !== original.workspace.company?.id ||
        current.workspace.data.brand !== original.workspace.data.brand ||
        current.brandKit !== original.brandKit ||
        current.workspace.sync === "loading" ||
        current.workspace.sync === "conflict"
      ) {
        throw new Error(
          "A peça ou a identidade mudou durante a preparação. Confira a versão atual e aplique novamente.",
        );
      }
      workspace.setData((data) =>
        data.brand === original.workspace.data.brand
          ? { ...data, brand: updateBrand(data.brand, patch) }
          : data,
      );
      toast.success("Identidade aplicada à sua peça. Revise novamente antes de baixar.");
    } catch (error) {
      if (!controller.signal.aborted) {
        setApplyError(
          `${error instanceof Error ? error.message : "Não foi possível aplicar a identidade."} Sua peça foi mantida.`,
        );
      }
    } finally {
      if (applyRequest.current === controller) {
        applyRequest.current = null;
        if (!controller.signal.aborted) setApplying(false);
      }
    }
  }

  async function handleLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !company) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Envie um arquivo de até 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const path = `${company.id}/logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) {
        toast.error("Falha ao enviar a logomarca.");
        return;
      }
      const { data } = await supabase.storage
        .from("brand-assets")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      const { error: saveError } = await supabase.from("brand_kits").upsert(
        {
          company_id: company.id,
          logo_url: data?.signedUrl ?? null,
          selected_index: brandKit?.selected_index ?? null,
          palette: brandKit?.palette ?? null,
          fonts: brandKit?.fonts ?? null,
          tone: brandKit?.tone ?? null,
        },
        { onConflict: "company_id" },
      );
      if (saveError) {
        toast.error("Não foi possível salvar a logomarca.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["brand-kit", company.id] });
      toast.success("Logomarca enviada!");
    } finally {
      setUploading(false);
    }
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Identidade</h1>
        <p className="text-muted-foreground">
          Cadastre sua empresa no painel para salvar um kit de identidade na conta.
        </p>
        <Button variant="outline" asChild>
          <Link to={origin.to} search={returnSearch}>
            Voltar para {origin.label}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Button variant="outline" asChild>
        <Link to={origin.to} search={returnSearch}>
          Voltar para {origin.label}
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Identidade</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Kit da marca: logo, cores, tipografia e tom de voz salvos na conta. Peças existentes
            mantêm seus ajustes até você aplicar o kit.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="#logo">
            <Image className="size-4" /> {logoUrl ? "Revisar logo" : "Adicionar logo"}
          </a>
        </Button>
      </div>

      <nav
        aria-label="Seções da identidade"
        className="flex flex-wrap gap-1 border-b border-border pb-3"
      >
        {[
          { href: "#logo", label: "Logo" },
          { href: "#cores", label: "Cores e tipografia" },
          { href: "#voz", label: "Tom de voz" },
          { href: "#historia", label: "História" },
          { href: "#brandbook", label: "BrandBook" },
        ].map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="logo" aria-labelledby="logo-title" className="scroll-mt-24 space-y-4">
        <h2 id="logo-title" className="text-base font-semibold">
          Da marca
        </h2>
        <Card className="shadow-none">
          <CardHeader>
            <h3 className="text-sm font-semibold">Logo e materiais salvos</h3>
            <CardDescription>
              Logo do kit da conta. Substituir aqui mantém os materiais da peça atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[12rem_1fr]">
            <div className="flex h-36 w-full items-center justify-center rounded-xl border border-border bg-muted p-5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logomarca de ${company.name} salva no kit da conta`}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {brandKitLoading
                    ? "Carregando logo…"
                    : brandKitError
                      ? "Logo indisponível"
                      : "Nenhum logo salvo"}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Cores salvas</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {brandPalette(brandKit?.palette).colors.length
                      ? brandPalette(brandKit?.palette).colors.map((color) => (
                          <span
                            key={color}
                            className="inline-flex items-center gap-1.5 font-mono text-xs"
                          >
                            <span
                              aria-hidden="true"
                              className="size-4 rounded border border-border"
                              style={{ backgroundColor: color }}
                            />
                            {color}
                          </span>
                        ))
                      : brandKitLoading
                        ? "Carregando…"
                        : brandKitError
                          ? "Indisponíveis"
                          : "Não definidas"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tipografia salva</dt>
                  <dd className="mt-1">
                    {brandKitLoading
                      ? "Carregando…"
                      : brandKitError
                        ? "Indisponível"
                        : savedFontsLabel === "Não informada" && brandKit?.fonts
                          ? "Tipografia personalizada salva"
                          : savedFontsLabel}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Tom de voz salvo</dt>
                  <dd className="mt-1">
                    {brandKitLoading
                      ? "Carregando…"
                      : brandKitError
                        ? "Indisponível"
                        : brandKit?.tone || "Não definido"}
                  </dd>
                </div>
              </dl>
              <div className="space-y-2">
                <Label htmlFor="brand-logo-file">
                  {logoUrl ? "Substituir logo" : "Adicionar logo"}
                </Label>
                <Input
                  id="brand-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogo}
                  disabled={uploading || applying || brandKitLoading || brandKitError}
                />
                <p role="status" className="text-xs text-muted-foreground">
                  <Upload className="mr-1 inline size-3" />
                  {uploading ? "Enviando…" : "PNG, JPG, WebP ou SVG · até 5 MB. Salvo ao enviar."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5">
          <div className="max-w-xl space-y-1.5">
            <p className="text-sm font-medium">Aplicar kit à peça atual</p>
            <p id="apply-identity-help" className="text-xs leading-relaxed text-muted-foreground">
              Aplica o logo salvo e a primeira cor da paleta como destaque. Itens ausentes mantêm os
              recursos atuais. Alterações pedem uma nova aprovação da peça.
            </p>
            <p className="text-xs text-muted-foreground">
              Para a peça, use logo PNG, JPG ou WebP de até 5 MB. SVG continua disponível no
              BrandBook.
            </p>
          </div>
          <Button
            type="button"
            onClick={applyIdentity}
            aria-describedby="apply-identity-help"
            className="h-auto min-h-10 whitespace-normal text-left"
            disabled={
              applying ||
              uploading ||
              brandKitLoading ||
              brandKitError ||
              !workspaceReady ||
              (!savedAccent && !logoUrl)
            }
          >
            {applying ? "Aplicando identidade…" : "Aplicar identidade à minha peça"}
          </Button>
          {!workspaceReady && (
            <p role="status" className="w-full text-xs text-muted-foreground">
              Aguarde o carregamento da peça ou resolva o conflito de versões antes de aplicar.
            </p>
          )}
          {applyError && (
            <p role="alert" className="w-full text-sm text-destructive">
              {applyError}
            </p>
          )}
        </div>
      </section>

      {/* Keyed on the load state so this only ever mounts (and reads its
          useState initial values) once brandKit has actually loaded — the
          previous version seeded state/defaultValue from `brandKit` while
          it was still undefined, so a returning user saw the hardcoded
          defaults and saving overwrote their real saved choices. */}
      {brandKitLoading ? (
        <p className="text-sm text-muted-foreground">Carregando identidade salva...</p>
      ) : brandKitError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar a identidade salva. Recarregue a página para tentar novamente.
        </p>
      ) : (
        <IdentityForm
          key={`kit:${workspace.ownerId}:${company.id}`}
          company={company}
          brandKit={brandKit ?? null}
          logoUrl={logoUrl}
        />
      )}
      {workspaceReady && (
        <BrandIdentitySettings
          key={`piece:${workspace.ownerId}:${company.id}`}
          data={workspace.data}
          onData={workspace.setData}
          savedAccent={savedAccent}
          onContinue={() => void navigate({ to: origin.to, search: returnSearch })}
        />
      )}
      <Card id="historia" className="scroll-mt-24 shadow-none">
        <CardHeader>
          <h2 className="text-base font-semibold">História da marca</h2>
          <CardDescription>
            {storyQuery.isLoading
              ? "Verificando a história salva..."
              : storyQuery.data?.unavailable
                ? BRAND_STORY_UNAVAILABLE
                : storyQuery.isError
                  ? "Não foi possível carregar a história salva. Recarregue a página para tentar novamente."
                  : "Manifesto, missão, visão e valores: escreva com suas palavras e revise os fatos antes de salvar."}
          </CardDescription>
        </CardHeader>
        {storyQuery.data && !storyQuery.data.unavailable && !storyQuery.isError && (
          <CardContent>
            <StoryEditor
              key={company.id}
              companyId={company.id}
              savedStory={storyQuery.data.story}
              onSaved={(saved) =>
                queryClient.setQueryData(["brand-story", company.id], {
                  ...saved,
                  unavailable: false,
                })
              }
            />
          </CardContent>
        )}
      </Card>
      <details id="brandbook" className="scroll-mt-24 rounded-xl border border-border bg-card">
        <summary className="cursor-pointer rounded-xl px-5 py-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <BookOpen aria-hidden="true" className="mr-2 inline size-4" />
          BrandBook · prévia e download
        </summary>
        <div className="border-t border-border p-3 sm:p-5">
          {brandKitLoading || diagnosticLoading || storyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados do BrandBook...</p>
          ) : diagnosticError || brandKitError || storyQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar todos os dados salvos para o BrandBook. Recarregue a página
              para tentar novamente.
            </p>
          ) : (
            <BrandBook
              input={{
                company,
                diagnosticAnswers: diagnostic?.answers,
                brandKit: brandKit ?? null,
                story: storyQuery.data?.story ?? null,
              }}
            />
          )}
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-sm font-medium">Configuração da marca</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Acompanhe o que já foi salvo e o que falta revisar.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={origin.to} search={returnSearch}>
            Voltar para {origin.label}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StoryEditor({
  companyId,
  savedStory,
  onSaved,
}: {
  companyId: string;
  savedStory: BrandStory | null;
  onSaved: (saved: SavedBrandStory) => void;
}) {
  const [draft, setDraft] = useState({
    manifesto: savedStory?.manifesto ?? "",
    mission: savedStory?.mission ?? "",
    vision: savedStory?.vision ?? "",
    valuesText: savedStory?.values.join("\n") ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = brandStorySchema.safeParse({
      manifesto: draft.manifesto,
      mission: draft.mission,
      vision: draft.vision,
      values: draft.valuesText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      setError(
        "Preencha manifesto, missão e visão, e de 1 a 8 valores com até 300 caracteres cada.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch("/api/brand-story", {
        action: "save",
        companyId,
        story: parsed.data,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(
          typeof payload?.message === "string"
            ? payload.message
            : "Não foi possível salvar a história.",
        );
        return;
      }
      const saved = savedBrandStorySchema.parse(payload);
      onSaved(saved);
      setDraft({ ...parsed.data, valuesText: parsed.data.values.join("\n") });
      setDirty(false);
      toast.success("História da marca salva!");
    } catch {
      setError("Não foi possível salvar a história. Seu texto continua no editor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
      {(
        [
          { key: "manifesto", label: "Manifesto", max: 4000, rows: 6 },
          { key: "mission", label: "Missão", max: 1000, rows: 3 },
          { key: "vision", label: "Visão", max: 1000, rows: 3 },
        ] as const
      ).map(({ key, label, max, rows }) => (
        <div key={key} className={cn("space-y-2", key === "manifesto" && "sm:col-span-2")}>
          <Label htmlFor={`brand-story-${key}`}>{label}</Label>
          <Textarea
            id={`brand-story-${key}`}
            value={draft[key]}
            required
            maxLength={max}
            rows={rows}
            disabled={saving}
            onChange={(event) => {
              setDraft({ ...draft, [key]: event.target.value });
              setDirty(true);
            }}
          />
        </div>
      ))}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="brand-story-values">Valores</Label>
        <Textarea
          id="brand-story-values"
          value={draft.valuesText}
          required
          rows={5}
          maxLength={2408}
          disabled={saving}
          aria-describedby="brand-story-values-help"
          onChange={(event) => {
            setDraft({ ...draft, valuesText: event.target.value });
            setDirty(true);
          }}
        />
        <p id="brand-story-values-help" className="text-xs text-muted-foreground">
          Um valor por linha, com uma prática concreta. Até 8 valores e 300 caracteres por valor.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 sm:col-span-2">
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Salvando..." : "Salvar história"}
        </Button>
        <p role="status" className="text-xs text-muted-foreground">
          {dirty
            ? "Alterações ainda não salvas."
            : savedStory
              ? "História salva no BrandBook."
              : "Sua história ainda não foi salva."}
        </p>
      </div>
    </form>
  );
}

function IdentityForm({
  company,
  brandKit,
  logoUrl,
}: {
  company: Company;
  brandKit: BrandKit | null;
  logoUrl: string | null;
}) {
  const queryClient = useQueryClient();
  const savedOptions = (brandKit?.options as unknown as PaletteOption[] | null) ?? null;
  const savedPalette = brandPalette(brandKit?.palette);
  const choices = savedOptions?.length ? savedOptions : FALLBACK_PALETTES;
  const matching = choices.findIndex(
    (option) => JSON.stringify(option.cores) === JSON.stringify(savedPalette.colors),
  );
  const includeSaved = savedPalette.colors.length > 0 && matching < 0;
  const [options, setOptions] = useState<PaletteOption[]>(
    includeSaved
      ? [{ nome: savedPalette.name || "Paleta salva", cores: savedPalette.colors }, ...choices]
      : choices,
  );
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<number>(
    includeSaved
      ? 0
      : matching >= 0
        ? matching
        : Math.min(Math.max(brandKit?.selected_index ?? 0, 0), choices.length - 1),
  );
  const [saving, setSaving] = useState(false);
  const savedFontPreset = (brandKit?.fonts as { preset?: string } | null)?.preset;
  const fontChoice = fontesOpcoes.some((font) => font.id === savedFontPreset)
    ? savedFontPreset!
    : brandKit?.fonts
      ? "saved-fonts"
      : "sora-manrope";
  async function gerarPaletas() {
    setGenerating(true);
    try {
      const response = await apiFetch("/api/paleta", { companyId: company.id });
      if (!response.ok) {
        const message = await response.text();
        toast.error(message || "Não foi possível gerar novas paletas.");
        return;
      }
      const { paletas: novas } = (await response.json()) as { paletas: PaletteOption[] };
      setOptions(novas);
      setSelected(0);
      toast.success("Novas paletas geradas pela IA!");
    } catch {
      toast.error("Não foi possível gerar novas paletas.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fonts = String(form.get("fonts") ?? fontChoice);
    setSaving(true);
    try {
      const paleta = options[selected] ?? options[0]!;
      const { error } = await supabase.from("brand_kits").upsert(
        {
          company_id: company.id,
          options,
          logo_url: logoUrl,
          selected_index: selected,
          palette:
            JSON.stringify(paleta.cores) === JSON.stringify(savedPalette.colors)
              ? brandKit!.palette
              : paleta,
          fonts: fonts === fontChoice && brandKit?.fonts ? brandKit.fonts : { preset: fonts },
          tone: String(form.get("tone") ?? tons[0]),
        },
        { onConflict: "company_id" },
      );
      if (error) {
        toast.error("Não foi possível salvar a identidade.");
        return;
      }
      await supabase
        .from("companies")
        .update({ onboarding_step: "missions" })
        .eq("id", company.id)
        .eq("onboarding_step", "brand");
      queryClient.invalidateQueries({ queryKey: ["brand-kit", company.id] });
      toast.success("Identidade salva!");
      queryClient.invalidateQueries({ queryKey: ["company"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving || generating} className="min-w-0 space-y-8">
        <section
          id="cores"
          aria-labelledby="colors-title"
          className="scroll-mt-52 space-y-4 sm:scroll-mt-40"
        >
          <div>
            <h2 id="colors-title" className="text-base font-semibold">
              Cores e tipografia
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Uma direção visual para reconhecer sua marca em cada peça.
            </p>
          </div>
          <Card className="shadow-none">
            <CardHeader className="flex flex-col items-start justify-between gap-4 space-y-0 sm:flex-row">
              <div>
                <h3 className="text-sm font-semibold">Paleta de cores</h3>
                <CardDescription>
                  {generating
                    ? "Gerando três direções para o seu segmento..."
                    : "Escolha uma combinação e salve no kit da marca. A peça atual mantém suas cores."}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={gerarPaletas}
                disabled={generating}
              >
                <Sparkles className="mr-1.5 size-3.5" />
                {generating ? "Gerando..." : "Sugerir com IA"}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-3">
              {options.map((paleta, index) => (
                <button
                  type="button"
                  key={`${paleta.nome}-${index}`}
                  onClick={() => setSelected(index)}
                  aria-pressed={selected === index}
                  disabled={generating}
                  className={cn(
                    "min-w-0 overflow-hidden rounded-xl border bg-background/40 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                    selected === index
                      ? "border-primary/70 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50",
                    generating && "opacity-60",
                  )}
                >
                  <div className="mb-4 flex overflow-hidden rounded-lg">
                    {paleta.cores.map((cor, corIndex) => (
                      <span
                        key={`${cor}-${corIndex}`}
                        title={cor}
                        className="h-16 min-w-0 flex-1 border-y border-white/10"
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{paleta.nome}</span>
                    {selected === index && <Check className="size-4 shrink-0 text-primary" />}
                  </div>
                  <p className="mt-2 break-words font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {paleta.cores.join(" · ")}
                  </p>
                  {paleta.justificativa && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {paleta.justificativa}
                    </p>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Tipografia</h3>
              <CardDescription>Uma combinação para títulos e textos da marca.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="brand-fonts" className="sr-only">
                Combinação de fontes
              </Label>
              <Select name="fonts" defaultValue={fontChoice}>
                <SelectTrigger
                  id="brand-fonts"
                  className="h-auto min-h-11 w-full max-w-lg text-left [&>span]:whitespace-normal"
                >
                  <SelectValue placeholder="Escolha a combinação" />
                </SelectTrigger>
                <SelectContent>
                  {fontChoice === "saved-fonts" && (
                    <SelectItem value="saved-fonts">Tipografia personalizada salva</SelectItem>
                  )}
                  {fontesOpcoes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </section>
        <section
          id="voz"
          aria-labelledby="voice-title"
          className="scroll-mt-52 space-y-4 sm:scroll-mt-40"
        >
          <div>
            <h2 id="voice-title" className="text-base font-semibold">
              Voz da marca
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A maneira de conversar com quem você quer alcançar.
            </p>
          </div>
          <Card className="shadow-none">
            <CardHeader>
              <h3 className="text-sm font-semibold">Tom de voz</h3>
              <CardDescription>Escolha o tom que representa sua marca.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="brand-tone" className="sr-only">
                Tom de voz
              </Label>
              <Select name="tone" defaultValue={brandKit?.tone ?? tons[0]!}>
                <SelectTrigger
                  id="brand-tone"
                  className="h-auto min-h-11 w-full max-w-lg text-left [&>span]:whitespace-normal"
                >
                  <SelectValue placeholder="Escolha o tom" />
                </SelectTrigger>
                <SelectContent>
                  {brandKit?.tone && !tons.includes(brandKit.tone) && (
                    <SelectItem value={brandKit.tone}>{brandKit.tone}</SelectItem>
                  )}
                  {tons.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar identidade"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Salva paleta, tipografia e tom de voz no BrandBook.
          </p>
        </div>
      </fieldset>
    </form>
  );
}
