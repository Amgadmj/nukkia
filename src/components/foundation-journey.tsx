import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Lock,
  Trophy,
  Circle,
  BrainCircuit,
  Globe2,
  CalendarDays,
  MousePointer2,
  MessagesSquare,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAPTERS, hasAnswer } from "@/lib/onboarding";
import { useFoundation } from "@/lib/use-foundation";
import { cn } from "@/lib/utils";

const phases = [
  {
    name: "Fundação",
    level: "Iniciante",
    icon: BrainCircuit,
    description: "Conheça seu negócio. Dê uma direção à sua marca.",
    tasks: [],
  },
  {
    name: "Presença digital",
    level: "Explorador",
    icon: Globe2,
    description: "Uma presença consistente em cada ponto de contato.",
    tasks: [
      "Jornada integrada de redes sociais",
      "Otimização do Perfil da Empresa no Google",
      "Padronização do WhatsApp Business",
    ],
  },
  {
    name: "Conteúdo em escala",
    level: "Criador",
    icon: CalendarDays,
    description: "Transforme sua estratégia em uma rotina de criação.",
    tasks: [
      "Missões de planejamento e aprovação",
      "Calendário integrado de 30 dias",
      "Agendamento e métricas como conquistas",
    ],
  },
  {
    name: "Conversão",
    level: "Estrategista",
    icon: MousePointer2,
    description: "Crie caminhos mais claros entre interesse e compra.",
    tasks: [
      "Landing pages e SEO",
      "Formulários e chamadas para ação",
      "Portfólio e apresentação comercial",
    ],
  },
  {
    name: "Relacionamento",
    level: "Mestre de vendas",
    icon: MessagesSquare,
    description: "Mantenha conversas que aproximam e geram valor.",
    tasks: ["Agente de atendimento com IA", "Integração com CRM", "Campanhas de relacionamento"],
  },
  {
    name: "Escala",
    level: "Lenda do mercado",
    icon: TrendingUp,
    description: "Aprenda com os resultados e amplie o que funciona.",
    tasks: ["Pixels e Google Analytics", "Campanhas de tráfego pago", "ROI e atribuição por UTMs"],
  },
];

export function FoundationCard() {
  const f = useFoundation();
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-card">
      <div className="flex flex-col justify-between gap-8 p-6 sm:flex-row sm:items-center lg:p-8">
        <div className="max-w-xl">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Trophy className="size-4" />
            Fase 01 · Fundação
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-[30px]">
            {f.progress.complete
              ? "Sua base está pronta. Vamos criar?"
              : "Seu marketing começa a ganhar forma."}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            {f.progress.complete
              ? "Você reuniu o contexto, o diagnóstico e a identidade. Leve essa base para seu primeiro plano de conteúdo."
              : "Cada resposta conecta uma nova parte do seu negócio. Transforme o que você sabe em uma estratégia que pode colocar em prática."}
          </p>
          <Button asChild className="mt-6 h-11 rounded-lg">
            <Link to={f.next.to}>
              {f.next.label}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-3">
          <div
            className="relative flex size-28 items-center justify-center rounded-full sm:size-36"
            style={{
              background: `conic-gradient(var(--primary) ${f.progress.percent}%, #252a32 0)`,
            }}
          >
            <div className="absolute inset-[5px] rounded-full bg-card" />
            <div className="relative text-center">
              <span className="text-3xl font-semibold tabular-nums sm:text-4xl">
                {f.progress.percent}
                <span className="ml-0.5 text-base text-muted-foreground">%</span>
              </span>
            </div>
          </div>
          <p className="max-w-28 text-xs leading-5 text-muted-foreground sm:text-center">
            da fundação da sua marca
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/8 border-t border-white/8 text-xs sm:grid-cols-4">
        {[
          { label: "Empresa", done: Boolean(f.company) },
          { label: "Diagnóstico", done: f.reportCurrent },
          { label: "Logomarca", done: f.logo },
          { label: "Identidade", done: f.identity },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 px-5 py-4">
            {item.done ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : (
              <Circle className="size-3.5 text-muted-foreground" />
            )}
            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function JourneyMap({ compact = false }: { compact?: boolean }) {
  const f = useFoundation();
  if (compact)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {phases.map((phase, i) => (
          <div
            key={phase.name}
            className={cn(
              "rounded-xl border p-4",
              i === 0 ? "border-primary/30 bg-primary/5" : "border-white/8 bg-card",
            )}
          >
            <div className="mb-5 flex items-center justify-between">
              <phase.icon
                className={cn("size-5", i === 0 ? "text-primary" : "text-muted-foreground")}
              />
              {i === 0 ? (
                <span className="text-[10px] text-primary">
                  {f.progress.complete ? "Pronta" : "Em curso"}
                </span>
              ) : (
                <Lock className="size-3 text-muted-foreground" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">FASE 0{i + 1}</p>
            <p className="mt-1.5 text-xs font-semibold">{phase.name}</p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {i === 0 ? phase.level : "Em breve"}
            </p>
          </div>
        ))}
      </div>
    );
  const checkpoints = [
    {
      title: "Cadastrar sua empresa",
      description: "Seu ponto de partida",
      done: Boolean(f.company),
      to: "/painel",
    },
    ...CHAPTERS.map((chapter, i) => ({
      title: chapter.title,
      description: chapter.outcome,
      done:
        chapter.questions.filter((q) => q.required).length > 0
          ? chapter.questions.filter((q) => q.required).every((q) => hasAnswer(f.answers[q.key]))
          : chapter.questions.some((q) => hasAnswer(f.answers[q.key])),
      to: "/diagnostico",
      chapter: i,
      optional: i === 0 || i === 3,
    })),
    {
      title: "Gerar seu diagnóstico",
      description: "Relatório e missões personalizados, salvos na plataforma",
      done: f.reportCurrent,
      to: "/diagnostico",
    },
    {
      title: "Importar sua logomarca",
      description: "O símbolo que representa seu negócio",
      done: f.logo,
      to: "/marca",
    },
    {
      title: "Definir sua identidade",
      description: "Paleta, tipografia e tom de voz",
      done: f.identity,
      to: "/marca",
    },
  ];
  return (
    <ol className="space-y-5">
      {phases.map((phase, index) => (
        <li
          key={phase.name}
          className={cn(
            "overflow-hidden rounded-2xl border",
            index === 0 ? "border-primary/25 bg-card" : "border-white/8 bg-card/60",
          )}
        >
          <div className="flex items-start gap-4 p-5 sm:p-6">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border",
                index === 0
                  ? "border-primary/20 bg-primary/8 text-primary"
                  : "border-white/8 text-muted-foreground",
              )}
            >
              <phase.icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Fase 0{index + 1} · {phase.level}
                </p>
                {index > 0 && (
                  <span className="flex items-center gap-1.5 rounded-md border border-white/8 px-2 py-1 text-[10px] text-muted-foreground">
                    <Lock className="size-3" />
                    Em breve
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-semibold">{phase.name}</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{phase.description}</p>
            </div>
          </div>
          {index === 0 ? (
            <div className="border-t border-white/8 px-5 sm:px-6">
              <ul className="divide-y divide-white/6">
                {checkpoints.map((item) => (
                  <li key={item.title} className="flex items-center gap-3 py-4">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        item.done
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                          : "border-white/15 text-muted-foreground",
                      )}
                    >
                      {item.done ? <Check className="size-3.5" /> : <Circle className="size-2" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {item.title}
                        {"optional" in item && item.optional && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            Complementar
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <Link
                      to={item.to}
                      search={
                        "chapter" in item
                          ? { etapa: item.chapter }
                          : item.to === "/diagnostico" && f.ready
                            ? { relatorio: true }
                            : {}
                      }
                      aria-label={`${item.done ? "Revisar" : "Abrir"} ${item.title}`}
                      className="flex min-h-10 shrink-0 items-center gap-2 text-xs text-primary"
                    >
                      {item.done ? "Revisar" : "Abrir"}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mb-5 mt-2 rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <Trophy
                    className={cn(
                      "size-4",
                      f.progress.complete ? "text-amber-300" : "text-muted-foreground",
                    )}
                  />
                  {f.progress.complete
                    ? "Conquista: Identidade pronta"
                    : "Sua próxima conquista: Identidade pronta"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {f.draft
                    ? "As respostas em rascunho ainda não atualizam seu relatório. Gere o diagnóstico para usar a nova versão. "
                    : ""}
                  Seu BrandBook reúne os dados já salvos da marca na seção Identidade.
                </p>
                <Link
                  to="/marca"
                  className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs text-primary"
                >
                  Revisar meu BrandBook
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="border-t border-white/6 px-6 py-4">
              <ul className="grid gap-3 sm:grid-cols-3">
                {phase.tasks.map((task) => (
                  <li
                    key={task}
                    className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                  >
                    <Lock className="mt-1 size-3 shrink-0 opacity-50" />
                    {task}
                  </li>
                ))}
              </ul>
              {index === 1 || index === 2 ? (
                <p className="mt-4 text-[11px] text-muted-foreground">
                  {index === 1
                    ? "As ferramentas atuais continuam disponíveis em Canais."
                    : "O plano e os textos já podem ser criados em Conteúdo. As conquistas desta fase chegam depois."}
                </p>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
