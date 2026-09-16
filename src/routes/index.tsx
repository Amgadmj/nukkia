import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  Gauge,
  Palette,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NukkiaLogo } from "@/components/nukkia-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nukkia — O cérebro de marketing da sua empresa" },
      {
        name: "description",
        content:
          "Diagnóstico de presença digital, identidade de marca, calendário de publicações e agendamento automático no Instagram e LinkedIn com inteligência artificial.",
      },
      { property: "og:title", content: "Nukkia — O cérebro de marketing da sua empresa" },
      {
        property: "og:description",
        content:
          "Diagnóstico, identidade, conteúdo e publicação automática com IA para clínicas e pequenas empresas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const etapas = [
  {
    icon: BrainCircuit,
    title: "Diagnóstico guiado",
    text: "Conte sobre seu público, mercado e serviços. Conectamos site e redes para entender onde você está.",
  },
  {
    icon: Palette,
    title: "Identidade da marca",
    text: "Envie sua logomarca e escolha entre três propostas de paleta, tipografia e tom de voz.",
  },
  {
    icon: Trophy,
    title: "Trilha de evolução",
    text: "Missões prioritárias com pontos de experiência a cada conquista da sua presença digital.",
  },
  {
    icon: CalendarCheck,
    title: "Calendário e peças",
    text: "Textos, roteiros e artes gerados por IA, aprovados por você e agendados automaticamente.",
  },
  {
    icon: Gauge,
    title: "Resultados na mão",
    text: "Alcance, engajamento, salvamentos, visitas e mensagens em um painel único.",
  },
  {
    icon: Sparkles,
    title: "Sempre no seu tom",
    text: "O cérebro da sua empresa aprende sua identidade uma vez e mantém tudo consistente.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NukkiaLogo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth" search={{ modo: "entrar" }}>
                Entrar
              </Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ modo: "cadastro" }}>
                Criar conta
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16] bg-brand-gradient" />
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-accent" />
              Marketing Intelligence para clínicas e pequenas empresas
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
              O <span className="text-gradient-brand">cérebro de marketing</span> que trabalha pela
              sua empresa todos os dias
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              A Nukkia aprende a identidade do seu negócio, monta o plano de conteúdo, cria as peças
              e publica no Instagram e no LinkedIn — enquanto você cuida dos seus clientes.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/auth" search={{ modo: "cadastro" }}>
                  Começar meu diagnóstico
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to="/auth" search={{ modo: "entrar" }}>
                  Já tenho conta
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <h2 className="text-center text-3xl font-bold">Como funciona</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Uma jornada guiada do primeiro cadastro até os resultados nas redes.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {etapas.map((etapa) => (
              <Card key={etapa.title} className="border-border/70">
                <CardContent className="pt-6">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <etapa.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{etapa.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{etapa.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/60">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center">
            <h2 className="text-3xl font-bold">Pronto para tirar o marketing do improviso?</h2>
            <p className="mt-4 text-muted-foreground">
              Crie sua conta, responda ao diagnóstico e receba seu plano de presença digital.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/auth" search={{ modo: "cadastro" }}>
                Criar minha conta
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <NukkiaLogo />
          <p>© {new Date().getFullYear()} Nukkia. Marketing Intelligence com IA.</p>
        </div>
      </footer>
    </div>
  );
}
