import { createFileRoute, Link } from "@tanstack/react-router";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CONSENT_VERSION } from "@/lib/consent";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade | Nukkia" },
      {
        name: "description",
        content: "Como a Nukkia trata os dados da sua empresa e da sua conta.",
      },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
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
          <h1 className="text-2xl font-bold">Política de privacidade</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Versão {CONSENT_VERSION} · primeira versão publicada, escrita para ser honesta e
            específica sobre o que fazemos hoje — recomendamos revisão jurídica antes de tratá-la
            como documento final.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">O que coletamos</h2>
          <p>
            Ao criar uma conta: nome, e-mail, telefone e senha (ou seu login do Google). Ao
            cadastrar sua empresa: nome, CNPJ, segmento, número de funcionários, site e perfis de
            redes sociais. Ao usar o diagnóstico: suas respostas sobre público, mercado, produtos e
            objetivos. Ao usar a identidade de marca: sua logomarca e as escolhas de paleta,
            tipografia e tom de voz.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Para que usamos e onde é processado</h2>
          <p>
            Usamos esses dados para gerar seu diagnóstico, plano de conteúdo e peças visuais, e para
            operar sua conta. Os textos e imagens são gerados por modelos de inteligência artificial
            de terceiros, processados fora do Brasil — hoje via um provedor de infraestrutura de IA
            que roteia para modelos de linguagem e imagem. Não enviamos essas informações para
            treinar modelos de terceiros além do necessário para gerar sua resposta.
          </p>
          <p>
            <strong>Recomendação:</strong> evite incluir dados de pacientes, clientes ou terceiros
            identificáveis nas respostas do diagnóstico — descreva seu público e serviços em termos
            gerais.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Com quem compartilhamos</h2>
          <p>
            Com o provedor de banco de dados e autenticação que hospeda a plataforma, e com o
            provedor de IA usado para gerar diagnósticos, planos e artes. Não vendemos seus dados.
            Quando a conexão com Instagram/LinkedIn estiver disponível, os tokens de acesso ficam em
            uma tabela isolada, acessível apenas pelos processos internos de publicação — nunca pelo
            seu navegador ou por outros usuários.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Seus direitos (LGPD)</h2>
          <p>
            Você pode excluir sua conta e todos os dados associados a qualquer momento, na página{" "}
            <Link to="/conta" className="underline">
              Conta
            </Link>{" "}
            — isso remove empresa, diagnósticos, identidade de marca, missões e arquivos enviados de
            forma permanente. Para correção de dados ou exportação, entre em contato pelo e-mail
            abaixo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contato</h2>
          <p>Dúvidas sobre privacidade ou seus dados: privacidade@nukkia.com.br</p>
        </section>
      </main>
    </div>
  );
}
