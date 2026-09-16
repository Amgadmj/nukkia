import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Instagram, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/redes")({
  head: () => ({
    meta: [
      { title: "Redes conectadas | Nukkia" },
      {
        name: "description",
        content: "Conecte Instagram e LinkedIn para publicar automaticamente e acompanhar métricas.",
      },
      { property: "og:title", content: "Redes conectadas | Nukkia" },
      { property: "og:description", content: "Publicação automática no Instagram e LinkedIn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Redes,
});

function Redes() {
  const { data: company } = useCompany();
  const { data: accounts } = useQuery({
    enabled: Boolean(company?.id),
    queryKey: ["social-accounts", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("provider, username, status")
        .eq("company_id", company!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const status = (provider: string) =>
    accounts?.find((a) => a.provider === provider)?.status ?? "disconnected";

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Redes sociais</h1>
        <p className="mt-1 text-muted-foreground">
          Conecte seus perfis para a Nukkia publicar e trazer as métricas automaticamente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="size-5" /> Instagram
            </CardTitle>
            <CardDescription>
              Publicação de feed, carrossel e reels, além de alcance, engajamento e visitas ao perfil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={status("instagram") === "connected" ? "default" : "secondary"}>
              {status("instagram") === "connected" ? "Conectado" : "Não conectado"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Para conectar seu Instagram profissional precisamos das credenciais do aplicativo Meta
              da sua empresa. Assim que você enviar, habilitamos a publicação automática.
            </p>
            <Button variant="outline" disabled>
              Aguardando credenciais Meta
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="size-5" /> LinkedIn
            </CardTitle>
            <CardDescription>
              Publicação na página da empresa e acompanhamento de impressões e engajamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={status("linkedin") === "connected" ? "default" : "secondary"}>
              {status("linkedin") === "connected" ? "Conectado" : "Não conectado"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              A conexão do LinkedIn é autorizada uma única vez pelo responsável da página. Peça a
              liberação no chat da Nukkia para ativar.
            </p>
            <Button variant="outline" disabled>
              Autorização pendente
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
