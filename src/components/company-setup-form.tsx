import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";

const empresaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  segment: z.string().trim().max(120).optional().or(z.literal("")),
  employees: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  instagram: z.string().trim().max(100).optional().or(z.literal("")),
  linkedin: z.string().trim().max(200).optional().or(z.literal("")),
});

export function CompanySetupForm({ onCreated }: { onCreated?: () => void }) {
  const navigate = useNavigate();
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
      if (!userData.user) throw new Error("Entre novamente para cadastrar sua empresa.");
      const { data: created, error } = await supabase
        .from("companies")
        .insert({
          owner_id: userData.user.id,
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
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      if (onCreated) onCreated();
      else void navigate({ to: "/diagnostico" });

      // Two-phase onboarding, phase one: if the client already gave us a
      // site or social handle, kick off the AI draft now in the background
      // so the diagnostic form is pre-filled by the time they get there —
      // they only need to confirm/correct instead of typing from scratch.
      if (parsed.data.website || parsed.data.instagram || parsed.data.linkedin) {
        apiFetch("/api/pesquisa-empresa", { companyId: created.id }).catch(() => {
          // best-effort — the diagnostic page also offers a manual retry
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl border-white/10 bg-card">
      <CardHeader>
        <CardTitle className="text-3xl font-semibold">
          Vamos construir o cérebro da sua marca.
        </CardTitle>
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
