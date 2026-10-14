/**
 * What a company can do right now, shaped for display. Pure: the page loads
 * the plan, the usage counts and the video balance, and this turns them into
 * the meters the customer sees.
 */
import { PLANS, QUOTA_KINDS, QUOTA_LABELS, type PlanKey, type QuotaKind } from "./catalog.ts";

export type QuotaMeter = {
  kind: QuotaKind;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  /** 0 to 1, how much of the allowance is used. */
  fraction: number;
  state: "ok" | "low" | "empty" | "not_included";
};

export type VideoMeter = {
  /** Finished videos the company can still make. */
  remaining: number;
  /** Finished videos the plan grants each month. */
  includedPerMonth: number;
  /** Whether the plan includes AI video at all. */
  planIncludesVideo: boolean;
  /** Renders left before the technical cap for the month. */
  rendersLeft: number;
  renderCap: number;
  state: "ok" | "low" | "empty" | "not_included";
  headline: string;
  detail: string;
};

export type Entitlements = {
  plan: PlanKey;
  planName: string;
  meters: QuotaMeter[];
  video: VideoMeter;
};

function meterState(used: number, limit: number): QuotaMeter["state"] {
  if (limit <= 0) return "not_included";
  if (used >= limit) return "empty";
  return used / limit >= 0.8 ? "low" : "ok";
}

export function buildEntitlements(input: {
  plan: PlanKey;
  /** Counts of metered actions in the last 30 days, by kind. */
  usage: Partial<Record<QuotaKind, number>>;
  /** Result of video_units_balance. */
  videoBalance: number;
}): Entitlements {
  const def = PLANS[input.plan];
  const meters: QuotaMeter[] = QUOTA_KINDS.map((kind) => {
    const limit = def.monthly[kind];
    const used = input.usage[kind] ?? 0;
    return {
      kind,
      label: QUOTA_LABELS[kind],
      used,
      limit,
      remaining: Math.max(0, limit - used),
      fraction: limit > 0 ? Math.min(1, used / limit) : 0,
      state: meterState(used, limit),
    };
  });

  const renderCap = def.monthly.video_render;
  const rendersUsed = input.usage.video_render ?? 0;
  const planIncludesVideo = def.includedVideos > 0;
  const remaining = Math.max(0, input.videoBalance);

  let state: VideoMeter["state"];
  let headline: string;
  let detail: string;
  if (!planIncludesVideo && remaining === 0) {
    state = "not_included";
    headline = "Vídeo com IA está no plano Pro";
    detail = "Você também pode comprar um vídeo extra, sem trocar de plano.";
  } else if (remaining === 0) {
    state = "empty";
    headline = "Sem vídeos restantes";
    detail = "Seus vídeos renovam a cada 30 dias. Compre um extra para continuar agora.";
  } else {
    state = remaining <= 1 && def.includedVideos > 1 ? "low" : "ok";
    headline = remaining === 1 ? "1 vídeo restante" : `${remaining} vídeos restantes`;
    detail =
      def.includedVideos > 0
        ? `O plano inclui ${def.includedVideos} por mês. Vídeos não usados valem por mais um mês.`
        : "Vídeos comprados valem por 12 meses.";
  }

  return {
    plan: input.plan,
    planName: def.name,
    meters,
    video: {
      remaining,
      includedPerMonth: def.includedVideos,
      planIncludesVideo,
      rendersLeft: Math.max(0, renderCap - rendersUsed),
      renderCap,
      state,
      headline,
      detail,
    },
  };
}

/** Formats centavos as Brazilian reais, for example 19700 becomes "R$ 197". */
export function formatBrl(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(reais) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
