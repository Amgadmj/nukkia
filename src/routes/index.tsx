import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import landingCss from "../landing.css?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nukkia — Seu marketing começa pela sua história" },
      {
        name: "description",
        content: "Reúna o que define sua marca e transforme esse contexto em conteúdo com direção.",
      },
      { property: "og:title", content: "Nukkia — Seu marketing começa pela sua história" },
      {
        property: "og:description",
        content: "Reúna o que define sua marca e transforme esse contexto em conteúdo com direção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="nukkia-landing">
      <a href="#conteudo" className="landing-skip">
        Ir para o conteúdo
      </a>
      <header className="landing-header landing-container">
        <Link to="/" aria-label="Nukkia — início" className="landing-home">
          <NukkiaLogo />
        </Link>
        <nav aria-label="Acesso à Nukkia" className="landing-nav">
          <ThemeToggle />
          <Link to="/auth" search={{ modo: "entrar" }} className="landing-nav-link">
            Entrar
          </Link>
          <Link
            to="/auth"
            search={{ modo: "cadastro" }}
            className="landing-button landing-button-outline"
          >
            Criar conta
          </Link>
        </nav>
      </header>

      <main id="conteudo" tabIndex={-1}>
        <section className="landing-hero landing-container" aria-labelledby="landing-title">
          <div className="landing-intro">
            <p className="landing-eyebrow">Marketing com contexto</p>
            <h1 id="landing-title">
              Seu negócio tem história. <span>Seu marketing precisa conhecê-la.</span>
            </h1>
            <p className="landing-lead">
              Reúna o que define sua marca e transforme esse contexto em conteúdo com direção.
            </p>
            <div className="landing-actions">
              <Link to="/demo" className="landing-button landing-button-primary">
                Conhecer a Nukkia <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link to="/auth" search={{ modo: "cadastro" }} className="landing-text-link">
                Criar minha conta
              </Link>
            </div>
            <p className="landing-note">Explore a demonstração antes de começar.</p>
          </div>

          <figure className="landing-preview" aria-labelledby="preview-caption">
            <figcaption id="preview-caption">
              <span className="landing-preview-dot" aria-hidden="true" />
              Da marca ao conteúdo · Exemplo conceitual
            </figcaption>
            <div className="landing-product">
              <div className="landing-product-topline">
                <span>Seu espaço de marca</span>
                <span className="landing-status">Em construção</span>
              </div>
              <div className="landing-product-heading">
                <p className="landing-eyebrow">Ateliê Aurora · Marca fictícia</p>
                <h2>
                  O cuidado está
                  <br />
                  nos detalhes.
                </h2>
                <p>Uma história que orienta o que dizer.</p>
              </div>
              <dl className="landing-brand-notes">
                <div>
                  <dt>Essência</dt>
                  <dd>Cerâmica feita à mão para os pequenos rituais de casa.</dd>
                </div>
                <div>
                  <dt>Tom de voz</dt>
                  <dd>Próximo, sensível e sem excessos.</dd>
                </div>
              </dl>
              <div className="landing-draft">
                <div className="landing-draft-heading">
                  <span>Uma direção para o conteúdo</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </div>
                <p className="landing-draft-title">O tempo de fazer à mão.</p>
                <p>
                  Entre o barro e a sua mesa, há escolhas que merecem ser contadas. Conheça o
                  processo por trás de cada peça.
                </p>
                <div className="landing-draft-footer">
                  <span>Bastidores do ateliê</span>
                  <span>Rascunho · Para revisão</span>
                </div>
              </div>
            </div>
            <p className="landing-preview-note">
              Conteúdo ilustrativo. A história e as escolhas da sua marca dão a direção.
            </p>
          </figure>
        </section>

        <section className="landing-method landing-container" aria-labelledby="method-title">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Uma base para criar</p>
            <h2 id="method-title">
              Antes do próximo post,
              <br />o que faz sua marca ser sua.
            </h2>
            <p>
              Sua história, seu público e seu jeito de trabalhar se tornam referências para
              construir uma comunicação coerente.
            </p>
          </div>
          <div className="landing-principles">
            <article>
              <h3>Comece pela história</h3>
              <p>Reúna o que você oferece, para quem e o cuidado que diferencia seu negócio.</p>
            </article>
            <article>
              <h3>Dê forma à marca</h3>
              <p>
                Organize referências, identidade visual e tom de voz em uma base que você pode
                revisar.
              </p>
            </article>
            <article>
              <h3>Crie com direção</h3>
              <p>
                Explore ideias e prepare rascunhos a partir desse contexto. A decisão final é sua.
              </p>
            </article>
          </div>
        </section>

        <section
          className="landing-invitation landing-container"
          aria-labelledby="invitation-title"
        >
          <div>
            <p className="landing-eyebrow">O próximo passo</p>
            <h2 id="invitation-title">Dê contexto à sua próxima ideia.</h2>
            <p>Veja como a Nukkia aproxima a história da sua marca do conteúdo que você cria.</p>
          </div>
          <Link to="/demo" className="landing-button landing-button-primary">
            Conhecer a Nukkia <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <NukkiaLogo />
        <p>© {new Date().getFullYear()} Nukkia. Marketing com contexto.</p>
      </footer>
    </div>
  );
}
