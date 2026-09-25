import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_VERSION } from "@/lib/consent";

const searchSchema = z.object({
  modo: z.enum(["entrar", "cadastro"]).catch("entrar"),
  inicio: z.enum(["onboarding"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar na Nukkia" },
      { name: "description", content: "Acesse a plataforma Nukkia ou crie sua conta gratuita." },
      { property: "og:title", content: "Entrar na Nukkia" },
      { property: "og:description", content: "Acesse a plataforma Nukkia ou crie sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const cadastroSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().min(8, "Informe um telefone válido").max(30),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres").max(72),
  consent: z.literal("on", {
    message: "Aceite os termos e a política de privacidade para continuar.",
  }),
});

function AuthPage() {
  const { modo, inicio } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    // An explicit welcome replay keeps the login form visible even if the
    // shared account already has a session. Normal visits resume automatically.
    if (inicio === "onboarding") return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !submitting.current) void navigate({ to: "/boas-vindas" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        !submitting.current &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION")
      ) {
        queryClient.clear();
        void navigate({ to: "/boas-vindas" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, inicio, queryClient]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setLoading(true);
    try {
      if (modo === "cadastro") {
        const parsed = cadastroSchema.safeParse({
          fullName: form.get("fullName"),
          email: form.get("email"),
          phone: form.get("phone"),
          password: form.get("password"),
          consent: form.get("consent"),
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: parsed.data.fullName,
              phone: parsed.data.phone,
              consent_version: CONSENT_VERSION,
            },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          setSent(true);
          toast.success("Conta criada! Confirme seu e-mail para entrar.");
          return;
        }
        queryClient.clear();
        void navigate({ to: "/boas-vindas", search: { rever: inicio === "onboarding" } });
      } else {
        const email = String(form.get("email") ?? "").trim();
        const password = String(form.get("password") ?? "");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error("E-mail ou senha incorretos.");
          return;
        }
        queryClient.clear();
        void navigate({ to: "/boas-vindas", search: { rever: inicio === "onboarding" } });
      }
    } catch {
      toast.error("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="nukkia-workspace dark flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/">
          <NukkiaLogo />
        </Link>
        <span className="text-xs text-muted-foreground">Marketing intelligence</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md rounded-3xl border-white/10 bg-card p-2 shadow-none">
          <CardHeader>
            <CardTitle className="text-3xl font-semibold leading-tight">
              {modo === "cadastro"
                ? "O próximo capítulo da sua marca."
                : "Seu próximo nível começa aqui."}
            </CardTitle>
            <CardDescription>
              {modo === "cadastro"
                ? "Crie sua conta e transforme o que sabe sobre seu negócio em direção para crescer."
                : "Entre para continuar construindo o cérebro de marketing da sua empresa."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs
              value={modo}
              onValueChange={(value) =>
                navigate({ to: "/auth", search: { modo: value as "entrar" | "cadastro", inicio } })
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="cadastro">Criar conta</TabsTrigger>
              </TabsList>
            </Tabs>

            {sent ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                Enviamos um e-mail de confirmação. Clique no link para ativar sua conta e voltar
                para a plataforma.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {modo === "cadastro" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome completo</Label>
                      <Input id="fullName" name="fullName" maxLength={120} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="(11) 99999-0000"
                        maxLength={30}
                        required
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" maxLength={255} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={72}
                    required
                  />
                </div>
                {modo === "cadastro" && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="consent"
                      name="consent"
                      checked={consent}
                      onCheckedChange={(value) => setConsent(value === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="consent"
                      className="text-xs font-normal leading-snug text-muted-foreground"
                    >
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" className="underline">
                        termos de uso
                      </Link>{" "}
                      e a{" "}
                      <Link to="/privacidade" target="_blank" className="underline">
                        política de privacidade
                      </Link>
                      .
                    </Label>
                  </div>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-white font-semibold text-zinc-950 hover:bg-white/90"
                  disabled={loading || (modo === "cadastro" && !consent)}
                >
                  {loading ? "Aguarde..." : modo === "cadastro" ? "Criar conta" : "Entrar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
