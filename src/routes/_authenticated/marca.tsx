import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBrandKit, useCompany } from "@/lib/company";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marca")({
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

const paletas = [
  {
    nome: "Confiança Clínica",
    cores: ["#0F3D6E", "#2E8BC0", "#B1D4E0", "#F5F9FC"],
  },
  {
    nome: "Energia Moderna",
    cores: ["#2A0845", "#3B82F6", "#06B6D4", "#F8FAFC"],
  },
  {
    nome: "Acolhimento Natural",
    cores: ["#2F4F3E", "#7BA88B", "#E4C58B", "#FBF7F0"],
  },
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

function Marca() {
  const { data: company } = useCompany();
  const { data: brandKit } = useBrandKit(company?.id);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number>(brandKit?.selected_index ?? 1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const logoUrl = (brandKit?.logo_url as string | null) ?? null;

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
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      await saveKit({ logo_url: data?.signedUrl ?? null });
      toast.success("Logomarca enviada!");
    } finally {
      setUploading(false);
    }
  }

  async function saveKit(patch: Record<string, unknown>) {
    if (!company) return;
    const payload = {
      company_id: company.id,
      options: paletas,
      logo_url: logoUrl,
      ...brandKitFields(),
      ...patch,
    };
    const { error } = await supabase
      .from("brand_kits")
      .upsert(payload, { onConflict: "company_id" });
    if (error) {
      toast.error("Não foi possível salvar a identidade.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["brand-kit", company.id] });
  }

  function brandKitFields() {
    return {
      selected_index: brandKit?.selected_index ?? null,
      palette: brandKit?.palette ?? null,
      fonts: brandKit?.fonts ?? null,
      tone: brandKit?.tone ?? null,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await saveKit({
        selected_index: selected,
        palette: paletas[selected],
        fonts: { preset: String(form.get("fonts") ?? "sora-manrope") },
        tone: String(form.get("tone") ?? tons[0]),
      });
      await supabase.from("companies").update({ onboarding_step: "missions" }).eq("id", company!.id);
      toast.success("Identidade salva!");
    } finally {
      setSaving(false);
    }
  }

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Identidade da marca</h1>
        <p className="mt-1 text-muted-foreground">
          Sua logomarca, paleta, tipografia e tom de voz guiam todas as peças geradas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logomarca</CardTitle>
          <CardDescription>PNG, JPG ou SVG de até 5 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logomarca da empresa"
              className="h-20 w-auto rounded-lg border border-border bg-card p-2"
            />
          ) : (
            <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
          <div>
            <Label htmlFor="logo" className="sr-only">
              Enviar logomarca
            </Label>
            <Input id="logo" type="file" accept="image/*" onChange={handleLogo} disabled={uploading} />
            <p className="mt-2 text-xs text-muted-foreground">
              <Upload className="mr-1 inline size-3" />
              {uploading ? "Enviando..." : "Escolha o arquivo da sua marca"}
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Escolha sua paleta</CardTitle>
            <CardDescription>Três direções sugeridas para o seu segmento.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {paletas.map((paleta, index) => (
              <button
                type="button"
                key={paleta.nome}
                onClick={() => setSelected(index)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  selected === index ? "border-primary ring-2 ring-primary/30" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{paleta.nome}</span>
                  {selected === index && <Check className="size-4 text-primary" />}
                </div>
                <div className="mt-3 flex gap-1.5">
                  {paleta.cores.map((cor) => (
                    <span
                      key={cor}
                      className="size-8 rounded-md border border-border"
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tipografia</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                name="fonts"
                defaultValue={
                  ((brandKit?.fonts as { preset?: string } | null)?.preset) ?? "sora-manrope"
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a combinação" />
                </SelectTrigger>
                <SelectContent>
                  {fontesOpcoes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tom de voz</CardTitle>
            </CardHeader>
            <CardContent>
              <Select name="tone" defaultValue={(brandKit?.tone as string | null) ?? tons[0]!}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o tom" />
                </SelectTrigger>
                <SelectContent>
                  {tons.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar identidade"}
        </Button>
      </form>
    </div>
  );
}
