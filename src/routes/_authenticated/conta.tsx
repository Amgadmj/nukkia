import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Sua conta | Nukkia" },
      { name: "description", content: "Privacidade, dados e exclusão de conta." },
    ],
  }),
  component: Conta,
});

function Conta() {
  const navigate = useNavigate();
  const [excluindo, setExcluindo] = useState(false);
  const [exportando, setExportando] = useState(false);

  async function exportarDados() {
    setExportando(true);
    try {
      const response = await apiFetch("/api/exportar-dados", undefined, { method: "GET" });
      if (!response.ok) {
        toast.error("Não foi possível exportar seus dados. Tente novamente.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nukkia-dados.json";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  async function excluirConta() {
    setExcluindo(true);
    try {
      const response = await apiFetch("/api/conta", undefined, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Não foi possível excluir a conta. Tente novamente.");
        return;
      }
      await supabase.auth.signOut();
      toast.success("Conta excluída.");
      navigate({ to: "/auth", search: { modo: "entrar" } });
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sua conta</h1>
        <p className="mt-1 text-muted-foreground">Privacidade e controle sobre seus dados.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Seus dados
          </CardTitle>
          <CardDescription>
            Guardamos os dados da sua empresa, diagnósticos, identidade de marca e conteúdo gerado
            para operar a plataforma. Textos e peças são processados por provedores de IA fora do
            Brasil — veja detalhes na{" "}
            <Link to="/privacidade" className="underline">
              política de privacidade
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={exportarDados} disabled={exportando}>
            <Download className="size-4" />
            {exportando ? "Exportando..." : "Exportar meus dados (JSON)"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" /> Excluir conta
          </CardTitle>
          <CardDescription>
            Remove permanentemente sua conta, empresa, diagnósticos, identidade de marca e peças
            geradas, incluindo arquivos enviados. Essa ação não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={excluindo}>
                {excluindo ? "Excluindo..." : "Excluir minha conta"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir sua conta permanentemente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os seus dados na Nukkia serão apagados, incluindo empresa, diagnósticos,
                  identidade de marca, missões e peças geradas. Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={excluirConta}>
                  Excluir permanentemente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
