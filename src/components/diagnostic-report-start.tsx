import { BrainCircuit, Loader2 } from "lucide-react";

export function DiagnosticReportStart({
  missing,
  generating,
  error,
  onGenerate,
  onResume,
}: {
  missing: { chapter: number; count: number }[];
  generating: boolean;
  error: string;
  onGenerate: () => void;
  onResume: (chapter: number) => void;
}) {
  const missingCount = missing.reduce((total, item) => total + item.count, 0);
  const firstMissing = missing[0]?.chapter ?? 0;
  return (
    <section className="mx-auto max-w-[760px] rounded-2xl border border-border bg-card/50 p-7 sm:p-10">
      <BrainCircuit className="mb-6 size-8 text-primary" aria-hidden="true" />
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Análise da marca
      </p>
      {missingCount ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Complete o contexto antes de gerar a análise.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Faltam {missingCount} {missingCount === 1 ? "resposta" : "respostas"} para transformar
            seu diagnóstico em prioridades de marketing.
          </p>
          <button
            type="button"
            className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
            onClick={() => onResume(firstMissing)}
          >
            Completar diagnóstico
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Transforme suas respostas em prioridades.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            A Nukkia vai organizar seu contexto em prioridades de marketing, oportunidades e
            próximos passos. Você poderá revisar tudo antes de aplicar.
          </p>
          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-destructive/30 p-4 text-sm">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={generating}
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            onClick={onGenerate}
          >
            {generating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {generating ? "Gerando análise…" : "Gerar minha análise"}
          </button>
        </>
      )}
    </section>
  );
}
