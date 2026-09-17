import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * onboarding_step was written correctly at every transition
 * (painel → diagnostico → marca → missions) since the very first pass, but
 * nothing ever read it — the app was 8 tabs with no sense of "what's next"
 * (UI/UX review's #1 recommendation). This is that missing piece: a single
 * step indicator plus a "continue" card, not a full wizard that forces
 * linear navigation — every page stays directly reachable from the top nav
 * either way.
 */
const STEPS = [
  { key: "diagnostic", to: "/diagnostico", label: "Diagnóstico", cta: "Responder o diagnóstico" },
  { key: "brand", to: "/marca", label: "Identidade", cta: "Definir a identidade da marca" },
  { key: "missions", to: "/trilha", label: "Trilha", cta: "Ver suas missões" },
  { key: "content", to: "/conteudo", label: "Conteúdo", cta: "Gerar o plano de conteúdo" },
] as const;

export function OnboardingProgress({ step }: { step: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  // An unrecognized/legacy value or the final step: nothing actionable to
  // highlight, so don't render a stale "next step" card.
  if (currentIndex === -1) return null;

  const current = STEPS[currentIndex]!;

  return (
    <Card className="surface-glow">
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {STEPS.map((s, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary",
                    !done && !active && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    active ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {index < STEPS.length - 1 && (
                  <span className="mx-1 h-px w-4 bg-border sm:w-6" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
        <Link
          to={current.to}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {current.cta}
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
