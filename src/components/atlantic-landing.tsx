import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Layers,
  CalendarDays,
  FileText,
  PenLine,
  ShieldCheck,
  Library,
  Brain,
  Play,
} from "lucide-react";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const stages = [
  {
    id: "contexto",
    label: "Contexto",
    icon: Brain,
    title: "Começa com o que torna sua clínica única.",
    description:
      "Reúna público, serviços e identidade. Um ponto de partida que acompanha cada conteúdo.",
    detail: "Clínica Horizonte",
    tag: "Contexto da marca",
    lines: [
      "Público · Pessoas conhecendo a clínica",
      "Mensagem · Atendimento e equipe",
      "Tom · Claro, próximo e informativo",
    ],
  },
  {
    id: "editor",
    label: "Criação",
    icon: PenLine,
    title: "Uma ideia. Diferentes formas de contar.",
    description:
      "Compare abordagens e ajuste a arte, as páginas e a legenda. A palavra final continua com você.",
    detail: "Conheça nossa equipe",
    tag: "Carrossel · 3 páginas",
    lines: [
      "Abertura · Apresente a equipe",
      "Conteúdo · Explique como funciona",
      "Encerramento · Oriente o próximo passo",
    ],
  },
  {
    id: "biblioteca",
    label: "Biblioteca",
    icon: Library,
    title: "Seu trabalho continua de onde parou.",
    description:
      "Guarde versões, retome uma peça e crie uma cópia. O que você salvou continua disponível para comparar.",
    detail: "Apresentação da clínica",
    tag: "Biblioteca · Exemplo fictício",
    lines: [
      "Versão 2 · Texto revisado",
      "Versão 1 · Primeira proposta",
      "Cópia · Uma nova direção",
    ],
  },
  {
    id: "planejamento",
    label: "Planejamento",
    icon: CalendarDays,
    title: "Dê ao mês uma visão de conjunto.",
    description:
      "Escolha a versão, a data e o canal pretendidos. Organize a próxima entrega com clareza.",
    detail: "Seu próximo conteúdo",
    tag: "Outubro · Planejamento ilustrativo",
    lines: [
      "20 out · Conheça nossa equipe",
      "Instagram · Versão 2",
      "Data de intenção · Publicação manual",
    ],
  },
];
const faqs = [
  [
    "O que posso experimentar agora?",
    "O contexto da marca, as opções de conteúdo, o editor, a biblioteca de versões e o planejamento. O estúdio de saúde também permite editar roteiros e visualizar cenas em cartões de texto.",
  ],
  [
    "A Nukkia publica por mim?",
    "Neste fluxo, você revisa a peça e prepara a entrega. As datas do planejamento são intenções; nenhum conteúdo é enviado para as redes sociais por esta demonstração.",
  ],
  [
    "Posso usar a identidade da minha clínica?",
    "Sim. Você pode ajustar o estilo, a cor e os materiais da sua marca. A identidade da Nukkia organiza a interface; as suas peças usam a identidade que você confirmar.",
  ],
  [
    "Como funciona a revisão de conteúdo de saúde?",
    "Os exemplos são rascunhos. Fatos, fontes, permissões de imagem e regras aplicáveis precisam ser conferidos por quem tem responsabilidade pelo conteúdo. A prévia não certifica conformidade ou aprovação profissional.",
  ],
  [
    "Preciso de uma conta para conhecer?",
    "Você pode explorar a demonstração local sem conta, usando informações fictícias. Os rascunhos da demonstração ficam nesta sessão do navegador; ela não comprova sincronização entre dispositivos.",
  ],
];
function DemoLink({
  children,
  className = "atl-button",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to="/demo" search={{ passo: 0 }} className={className}>
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  );
}
export function AtlanticLanding() {
  const [active, setActive] = useState(0);
  const stage = stages[active]!;
  return (
    <div className="atl-landing">
      <a className="atl-skip" href="#proposta-conteudo">
        Ir para o conteúdo
      </a>
      <header className="atl-nav atl-container">
        <Link to="/" aria-label="Nukkia — início">
          <NukkiaLogo />
        </Link>
        <nav aria-label="Conheça a Nukkia">
          <a href="#como-funciona">Como funciona</a>
          <a href="#para-sua-clinica">Para sua clínica</a>
          <a href="#perguntas">Perguntas</a>
        </nav>
        <div className="atl-nav-actions">
          <ThemeToggle />
          <Link to="/auth" search={{ modo: "entrar" }}>
            Entrar
          </Link>
          <DemoLink className="atl-button atl-nav-cta">Explorar</DemoLink>
        </div>
      </header>
      <main id="proposta-conteudo" tabIndex={-1}>
        <section className="atl-hero atl-container" aria-labelledby="atl-title">
          <div className="atl-hero-copy">
            <h1 id="atl-title">
              O cuidado é seu.
              <br />
              <em>A próxima ideia, da Nukkia.</em>
            </h1>
            <p className="atl-lead">
              Da identidade da sua clínica ao conteúdo revisado e ao planejamento do mês. Um espaço
              para criar, guardar e continuar.
            </p>
            <div className="atl-actions">
              <DemoLink>Conhecer a Nukkia</DemoLink>
              <a className="atl-text-link" href="#como-funciona">
                <Play size={15} aria-hidden="true" />
                Veja o caminho
              </a>
            </div>
          </div>
          <figure
            className="atl-hero-stage"
            aria-label="Exemplo ilustrativo de conteúdo conectado ao contexto da clínica"
          >
            <div className="atl-orbit" aria-hidden="true" />
            <div className="atl-context-float">
              <Brain size={19} />
              <div>
                <span>Cérebro da marca</span>
                <strong>A sua identidade, presente.</strong>
              </div>
              <Check size={16} />
            </div>
            <div className="atl-art-card">
              <div className="atl-art-top">
                <span>CLÍNICA HORIZONTE</span>
                <ArrowUpRight size={18} />
              </div>
              <div className="atl-arch" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="atl-art-copy">
                <span>ANTES DA PRIMEIRA CONSULTA</span>
                <strong>
                  Conheça
                  <br />
                  quem cuida
                  <br />
                  de você.
                </strong>
                <p>Equipe, espaço e atendimento.</p>
              </div>
              <div className="atl-art-bottom">
                <span>Carrossel · Exemplo fictício</span>
                <span>1 / 3</span>
              </div>
            </div>
            <div className="atl-version-float">
              <span className="atl-icon-tile">
                <Layers size={18} />
              </span>
              <div>
                <strong>Texto revisado</strong>
                <span>Versão 2 · Na biblioteca</span>
              </div>
            </div>
            <div className="atl-plan-float">
              <span className="atl-date">
                <small>OUT</small>20
              </span>
              <div>
                <strong>Apresentação da equipe</strong>
                <span>Instagram · Data pretendida</span>
              </div>
              <CalendarDays size={17} />
            </div>
            <figcaption>Da sua ideia à próxima entrega · Exemplo ilustrativo</figcaption>
          </figure>
        </section>
        <div className="atl-flow-strip">
          <div className="atl-container">
            <span>Uma rotina de conteúdo conectada.</span>
            <span>
              <Brain />
              Contexto
            </span>
            <ChevronRight />
            <span>
              <PenLine />
              Criação
            </span>
            <ChevronRight />
            <span>
              <Library />
              Biblioteca
            </span>
            <ChevronRight />
            <span>
              <CalendarDays />
              Planejamento
            </span>
          </div>
        </div>
        <section
          className="atl-section atl-container"
          id="como-funciona"
          aria-labelledby="atl-journey-title"
        >
          <div className="atl-section-heading">
            <p className="atl-eyebrow">DO PRIMEIRO RASCUNHO AO PRÓXIMO MÊS</p>
            <h2 id="atl-journey-title">
              As peças se conectam.
              <br />
              <em>O trabalho continua.</em>
            </h2>
            <p>Explore um exemplo do caminho que seu conteúdo percorre na Nukkia.</p>
          </div>
          <div className="atl-demo">
            <div className="atl-demo-tabs" role="tablist" aria-label="Explore a jornada">
              {stages.map((item, i) => (
                <button
                  key={item.id}
                  id={`atl-tab-${item.id}`}
                  role="tab"
                  aria-selected={active === i}
                  aria-controls="atl-stage-panel"
                  tabIndex={active === i ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowRight"
                        ? (active + 1) % stages.length
                        : event.key === "ArrowLeft"
                          ? (active + stages.length - 1) % stages.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? stages.length - 1
                              : null;
                    if (next !== null) {
                      event.preventDefault();
                      setActive(next);
                      document.getElementById(`atl-tab-${stages[next]!.id}`)?.focus();
                    }
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              ))}
            </div>
            <div
              className="atl-demo-panel"
              id="atl-stage-panel"
              role="tabpanel"
              aria-labelledby={`atl-tab-${stage.id}`}
              tabIndex={0}
            >
              <div className="atl-demo-copy">
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
                <DemoLink className="atl-text-link">Experimentar o fluxo</DemoLink>
              </div>
              <div className="atl-demo-window">
                <div className="atl-window-bar">
                  <span>
                    <NukkiaLogo compact /> {stage.label}
                  </span>
                  <small>CLÍNICA FICTÍCIA</small>
                </div>
                <div className="atl-window-content">
                  <span className="atl-eyebrow">{stage.tag}</span>
                  <h4>{stage.detail}</h4>
                  {stage.lines.map((line, i) => (
                    <div key={line} className="atl-preview-row">
                      <span className="atl-preview-mark">
                        {active === 3 ? (
                          <CalendarDays size={16} />
                        ) : i === 0 ? (
                          <Check size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className="atl-section atl-health"
          id="para-sua-clinica"
          aria-labelledby="atl-health-title"
        >
          <div className="atl-container atl-health-grid">
            <div>
              <p className="atl-eyebrow">PENSADA PARA CLÍNICAS E PROFISSIONAIS</p>
              <h2 id="atl-health-title">
                Comunicar faz parte
                <br />
                da relação de cuidado.
              </h2>
              <p className="atl-lead">
                Apresente seu trabalho com a mesma atenção que dedica ao atendimento.
              </p>
              <div className="atl-editorial-note">
                <ShieldCheck size={23} />
                <p>
                  Você conhece sua prática.
                  <br />
                  <strong>A revisão continua nas suas mãos.</strong>
                </p>
              </div>
            </div>
            <div className="atl-benefits">
              <article>
                <span>
                  <Brain />
                </span>
                <div>
                  <h3>Seu contexto, sem começar do zero.</h3>
                  <p>
                    Serviços, público e direção visual acompanham a criação para manter a
                    comunicação consistente.
                  </p>
                </div>
              </article>
              <article>
                <span>
                  <PenLine />
                </span>
                <div>
                  <h3>Espaço para ajustar cada palavra.</h3>
                  <p>
                    Revise textos, páginas e roteiros antes de usar. Hipóteses e exemplos continuam
                    editáveis.
                  </p>
                </div>
              </article>
              <article>
                <span>
                  <Library />
                </span>
                <div>
                  <h3>Uma biblioteca que preserva o percurso.</h3>
                  <p>
                    Compare versões, duplique uma ideia e planeje a entrega certa para o momento
                    certo.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="atl-section atl-container" aria-labelledby="atl-formats-title">
          <div className="atl-section-heading atl-heading-row">
            <div>
              <p className="atl-eyebrow">O QUE SUA CLÍNICA PODE CONTAR</p>
              <h2 id="atl-formats-title">Mais clareza em cada formato.</h2>
            </div>
            <p>
              Exemplos de direção criativa.
              <br />
              Seu conteúdo é revisado por você.
            </p>
          </div>
          <div className="atl-formats">
            <article className="atl-format atl-format-image">
              <div className="atl-format-art">
                <span>APRESENTE SUA CLÍNICA</span>
                <strong>
                  Um espaço
                  <br />
                  para conhecer
                  <br />
                  de perto.
                </strong>
                <div className="atl-mini-arch" />
              </div>
              <div className="atl-format-label">
                <div>
                  <h3>Imagem + legenda</h3>
                  <p>Uma mensagem, com a sua identidade.</p>
                </div>
                <ArrowUpRight />
              </div>
            </article>
            <article className="atl-format atl-format-carousel">
              <div className="atl-format-art">
                <span>ORIENTE O PRÓXIMO PASSO</span>
                <div className="atl-mini-pages">
                  <span>
                    Antes
                    <br />
                    da consulta<small>1 / 3</small>
                  </span>
                  <span>
                    O que
                    <br />
                    preparar<small>2 / 3</small>
                  </span>
                  <span>
                    Como
                    <br />
                    chegar<small>3 / 3</small>
                  </span>
                </div>
              </div>
              <div className="atl-format-label">
                <div>
                  <h3>Carrossel</h3>
                  <p>Organize a informação em páginas.</p>
                </div>
                <Layers />
              </div>
            </article>
            <article className="atl-format atl-format-script">
              <div className="atl-format-art">
                <span>DÊ VOZ AO SEU TRABALHO</span>
                <strong>
                  Uma apresentação.
                  <br />
                  Cena por cena.
                </strong>
                <div className="atl-mini-timeline">
                  <span />
                  <span />
                  <span />
                  <Play size={14} />
                </div>
              </div>
              <div className="atl-format-label">
                <div>
                  <h3>Roteiro em cenas</h3>
                  <p>Prévia textual, sem vídeo renderizado.</p>
                </div>
                <FileText />
              </div>
            </article>
          </div>
        </section>
        <section
          className="atl-section atl-container atl-faq"
          id="perguntas"
          aria-labelledby="atl-faq-title"
        >
          <div>
            <p className="atl-eyebrow">ANTES DE COMEÇAR</p>
            <h2 id="atl-faq-title">Vamos esclarecer.</h2>
            <p>O que funciona hoje e como você participa.</p>
          </div>
          <div>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="atl-final atl-container">
          <div>
            <p className="atl-eyebrow">COMECE COM UMA IDEIA</p>
            <h2>
              O próximo conteúdo da sua clínica
              <br />
              pode começar aqui.
            </h2>
            <p>Conheça o caminho. Ajuste à sua marca. Continue no seu ritmo de trabalho.</p>
          </div>
          <DemoLink>Explorar a demonstração</DemoLink>
        </section>
      </main>
      <footer className="atl-footer atl-container">
        <NukkiaLogo />
        <p>Conteúdo para clínicas. Com contexto e revisão.</p>
        <div>
          <Link to="/auth" search={{ modo: "cadastro" }}>
            Criar conta <ArrowRight size={14} />
          </Link>
          <Link to="/auth" search={{ modo: "entrar" }}>
            Entrar
          </Link>
        </div>
        <small>Nukkia · Conteúdo para saúde</small>
      </footer>
    </div>
  );
}
