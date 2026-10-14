import { Check, Loader2, TriangleAlert } from "lucide-react";
import { MONTH_PLAN_STEPS } from "@/lib/month-plan";

/**
 * Shown while the first month plan is generated. The plan comes from a single
 * request, so only what is actually known is shown as done: the two inputs are
 * read before the request starts; the rest finishes together when it returns.
 */
export function MonthPlanBuilder({
  state,
  error,
  onRetry,
}: {
  state: "building" | "error";
  error?: string;
  onRetry: () => void;
}) {
  if (state === "error")
    return (
      <section role="alert" className="workspace-card">
        <h2 className="flex items-center gap-2">
          <TriangleAlert size={20} aria-hidden="true" /> Não foi possível montar seu mês
        </h2>
        <p>{error || "Tente novamente. Seu Cérebro da marca continua salvo."}</p>
        <button className="quick-primary" type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </section>
    );
  return (
    <section role="status" aria-live="polite" className="workspace-card">
      <h2>Montando seu mês…</h2>
      <p>
        Usamos o seu Cérebro da marca para sugerir as publicações. Tudo chega como sugestão para
        você revisar e aprovar. Pode levar cerca de um minuto.
      </p>
      <ul className="mt-4 space-y-2">
        {MONTH_PLAN_STEPS.map((step, index) => {
          const done = index < 2;
          return (
            <li key={step} className="flex items-center gap-2 text-sm" data-complete={done}>
              {done ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              )}
              {step}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
