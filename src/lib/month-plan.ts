import { briefIssues, identityIssues, identityReady } from "./brand-preview.ts";
import type { DemoData } from "./quick-start.ts";

/** Why "Gerar plano do mês" cannot run yet, in the order the user should fix them. */
export function planBlockers(data: DemoData, hasBrandKit: boolean): string[] {
  const reasons: string[] = [];
  if (!hasBrandKit) reasons.push("Defina a identidade da marca (logo, paleta e tom).");
  reasons.push(...briefIssues(data));
  if (!identityReady(data.brand)) {
    reasons.push(
      identityIssues(data.brand)[0] ?? "Confirme a identidade da marca para liberar o plano.",
    );
  }
  return reasons;
}

export type MonthPlanBuildState = "idle" | "building" | "error";

/**
 * The first plan is built automatically once, when the account is ready and
 * has no plan yet. A failed or already-attempted build is never retried
 * silently: the user retries it, so AI quota is not spent in a loop.
 */
export function shouldAutoBuildPlan(input: {
  blockers: readonly string[];
  itemsLoaded: boolean;
  itemCount: number;
  attempted: boolean;
  state: MonthPlanBuildState;
}) {
  return (
    input.blockers.length === 0 &&
    input.itemsLoaded &&
    input.itemCount === 0 &&
    !input.attempted &&
    input.state === "idle"
  );
}

export const MONTH_PLAN_STEPS = [
  "Lendo o Cérebro da marca",
  "Conferindo a identidade",
  "Planejando as publicações do mês",
  "Escrevendo legendas e chamadas",
] as const;
