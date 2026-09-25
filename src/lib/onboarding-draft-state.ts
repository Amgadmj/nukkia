import { normalizeAnswers, type AnswerKey, type Answers } from "./onboarding.ts";

export type DraftContent = { version: 1; answers: Answers; step: number };
export type RemoteDraft = { revision: string; draft: DraftContent | null; updatedAt: string };
export type LocalDraft = DraftContent & {
  updatedAt: number | null;
  base: RemoteDraft | null;
  dirty: boolean;
  deleted: boolean;
};

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeDraft(value: unknown): DraftContent | null {
  if (!object(value) || value["version"] !== 1 || !object(value["answers"])) return null;
  const step = value["step"];
  return {
    version: 1,
    answers: normalizeAnswers(value["answers"]),
    step: typeof step === "number" && Number.isInteger(step) && step >= 0 && step < 5 ? step : 0,
  };
}

export function normalizeRemote(value: unknown): RemoteDraft | null {
  if (!object(value) || typeof value["revision"] !== "string" || !value["revision"]) return null;
  const draft = value["draft"] === null ? null : normalizeDraft(value["draft"]);
  if (value["draft"] !== null && !draft) return null;
  if (typeof value["updatedAt"] !== "string") return null;
  return { revision: value["revision"], draft, updatedAt: value["updatedAt"] };
}

/** Legacy v1 drafts have unknown age; never pretend they were saved just now. */
export function parseLocalDraft(raw: string | null): LocalDraft | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    const draft = normalizeDraft(value);
    if (!draft || !object(value)) return null;
    const base = normalizeRemote(value["base"]);
    const updatedAt = value["updatedAt"];
    return {
      ...draft,
      updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : null,
      base,
      dirty: value["dirty"] !== false || !base,
      deleted: value["deleted"] === true,
    };
  } catch {
    return null;
  }
}

export function contentOf(local: LocalDraft | null): DraftContent | null {
  return local && !local.deleted ? { version: 1, answers: local.answers, step: local.step } : null;
}

export function sameDraft(a: DraftContent | null, b: DraftContent | null): boolean {
  return a === null || b === null
    ? a === b
    : a.step === b.step &&
        (Object.keys(a.answers) as AnswerKey[]).every((key) => a.answers[key] === b.answers[key]);
}

export function fromRemote(remote: RemoteDraft | null): LocalDraft | null {
  if (!remote) return null;
  return {
    ...(remote.draft ?? { version: 1, answers: normalizeAnswers({}), step: 0 }),
    updatedAt: null,
    base: remote,
    dirty: false,
    deleted: remote.draft === null,
  };
}

export type Reconciliation = {
  action: "synced" | "push" | "conflict";
  local: LocalDraft | null;
};

/** Three-way merge; timestamps are informational, never a cross-device ordering clock. */
export function reconcileDraft(
  local: LocalDraft | null,
  remote: RemoteDraft | null,
): Reconciliation {
  if (local?.deleted && local.dirty && !remote) {
    return { action: "push", local: { ...local, base: null } };
  }
  if (!local || !local.dirty || sameDraft(contentOf(local), remote?.draft ?? null)) {
    return { action: "synced", local: fromRemote(remote) };
  }
  if ((local.base?.revision ?? null) === (remote?.revision ?? null)) {
    return { action: "push", local };
  }
  const base = local.base?.draft;
  if (local.deleted || !base || !remote?.draft) return { action: "conflict", local };

  const answers = { ...remote.draft.answers };
  for (const key of Object.keys(answers) as AnswerKey[]) {
    const changedHere = local.answers[key] !== base.answers[key];
    const changedThere = remote.draft.answers[key] !== base.answers[key];
    if (changedHere && changedThere && local.answers[key] !== remote.draft.answers[key]) {
      return { action: "conflict", local };
    }
    if (changedHere) answers[key] = local.answers[key];
  }
  const merged: LocalDraft = {
    ...local,
    answers,
    step: local.step !== base.step ? local.step : remote.draft.step,
    base: remote,
  };
  return sameDraft(contentOf(merged), remote.draft)
    ? { action: "synced", local: fromRemote(remote) }
    : { action: "push", local: merged };
}

/** A save acknowledgement advances the base, while retaining edits made in flight. */
export function acknowledgeDraft(
  current: LocalDraft,
  sent: LocalDraft,
  remote: RemoteDraft,
): LocalDraft {
  return {
    ...current,
    base: remote,
    dirty: !sameDraft(contentOf(current), contentOf(sent)),
  };
}
