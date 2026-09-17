import { createFileRoute, Link } from "@tanstack/react-router";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CONSENT_VERSION } from "@/lib/consent";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso | Nukkia" },
      { name: "description", content: "Condições de uso da plataforma Nukkia." },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/">
          <NukkiaLogo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pb-16 text-sm leading-relaxed text-foreground">
        <div>
          <h1 className="text-2xl font-bold">Termos de uso</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Versão {CONSENT_VERSION} · primeira versão publicada — recomendamos revisão jurídica
            antes de tratá-la como documento final.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">O serviço</h2>
          <p>
            A Nukkia é uma plataforma de marketing assistido por IA para pequenas e médias empresas
            no Brasil: diagnóstico de presença digital, identidade de marca, planejamento de
            conteúdo e geração de peças (imagens, carrosséis e roteiros de vídeo). A conexão e
            publicação automática em redes sociais está em construção e pode não estar disponível
            para todos os canais.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Conteúdo gerado por IA</h2>
          <p>
            Textos, roteiros e imagens são gerados por modelos de inteligência artificial a partir
            das informações que você fornece. Você é responsável por revisar e aprovar qualquer peça
            antes de publicá-la — a Nukkia não garante a exatidão factual, adequação legal ou
            regulatória (incluindo normas de conselhos profissionais como CFM ou OAB) do conteúdo
            gerado, e recomenda revisão humana em segmentos regulados.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Uso aceitável e limites</h2>
          <p>
            O uso das funções de IA está sujeito a limites diários e mensais por conta, para manter
            o serviço sustentável para todos os clientes. Não é permitido usar a plataforma para
            gerar conteúdo ilegal, enganoso ou que infrinja direitos de terceiros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Sua conta</h2>
          <p>
            Você é responsável por manter a confidencialidade da sua senha. Você pode excluir sua
            conta a qualquer momento na página Conta, o que remove permanentemente seus dados — veja
            a{" "}
            <Link to="/privacidade" className="underline">
              política de privacidade
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contato</h2>
          <p>Dúvidas sobre estes termos: contato@nukkia.com.br</p>
        </section>
      </main>
    </div>
  );
}
