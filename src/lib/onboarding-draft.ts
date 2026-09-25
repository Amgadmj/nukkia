import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAnswers, type Answers } from "./onboarding";
import {
  acknowledgeDraft,
  contentOf,
  fromRemote,
  normalizeRemote,
  parseLocalDraft,
  reconcileDraft,
  type LocalDraft,
  type RemoteDraft,
} from "./onboarding-draft-state";

const PREFIX = "nukkia-onboarding-v1:";
const EVENT = "nukkia-draft-change";
export const draftKey = (ownerId: string, companyId: string) => `${PREFIX}${ownerId}:${companyId}`;
// Keep edits visible for this session even when storage is blocked or full.
const memory = new Map<string, string | null>();
let generation = 0;

function notify() {
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}
function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, draft: LocalDraft | null): boolean {
  const raw = draft ? JSON.stringify(draft) : null;
  memory.set(key, raw);
  let durable = false;
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
    memory.delete(key);
    durable = true;
  } catch {
    // saveDraft's boolean continues to describe localStorage durability.
  }
  notify();
  return durable;
}

export function useDraft(ownerId = "", companyId = "") {
  const key = draftKey(ownerId, companyId);
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  return useMemo(() => {
    const draft = parseLocalDraft(raw);
    return draft && !draft.deleted ? { answers: draft.answers, step: draft.step } : null;
  }, [raw]);
}

export type DraftSyncStatus = "local" | "syncing" | "synced" | "conflict";
export type DraftSyncState = {
  status: DraftSyncStatus;
  reason: "schema-unavailable" | "unavailable" | null;
  remote: RemoteDraft | null;
};
const LOCAL: DraftSyncState = { status: "local", reason: null, remote: null };
const controllers = new Map<string, DraftSync>();

class DraftSync {
  snapshot = LOCAL;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  constructor(
    readonly ownerId: string,
    readonly companyId: string,
    readonly key: string,
  ) {}

  private report(
    status: DraftSyncStatus,
    reason: DraftSyncState["reason"] = null,
    remote: RemoteDraft | null = null,
  ) {
    this.snapshot = { status, reason, remote };
    notify();
  }
  pause() {
    clearTimeout(this.timer);
    this.pending = false;
    this.report("local");
  }
  schedule() {
    this.report("syncing");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 500);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) {
      this.pending = true;
      return this.running;
    }
    this.running = (async () => {
      // Bound retries under contention; subsequent edits/focus/online can retry.
      for (let attempt = 0; attempt < 4; attempt++) {
        this.pending = false;
        await this.sync(generation);
        if (!this.pending) return;
      }
      this.pending = false;
      this.report("local", "unavailable");
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async request(
    method: "GET" | "POST" | "DELETE",
    runGeneration: number,
    local?: LocalDraft,
  ) {
    const { data, error } = await supabase.auth.getSession();
    if (generation !== runGeneration || error || data.session?.user.id !== this.ownerId)
      throw new Error("unavailable");
    return fetch(`/api/onboarding-draft?companyId=${encodeURIComponent(this.companyId)}`, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      ...(local
        ? {
            body: JSON.stringify({
              companyId: this.companyId,
              baseRevision: local.base?.revision ?? null,
              ...(method === "POST" ? { draft: contentOf(local) } : {}),
            }),
          }
        : {}),
    });
  }
  private async payload(response: Response): Promise<RemoteDraft | null> {
    const body = await response.json();
    if (!response.ok)
      throw new Error(body?.code === "schema-unavailable" ? "schema-unavailable" : "unavailable");
    if (body?.draft === null) return null;
    const remote = normalizeRemote(body?.draft);
    if (!remote) throw new Error("unavailable");
    return remote;
  }
  private async currentOwner(runGeneration: number): Promise<boolean> {
    if (generation !== runGeneration) return false;
    const { data, error } = await supabase.auth.getSession();
    if (generation !== runGeneration) return false;
    if (error || data.session?.user.id !== this.ownerId) {
      this.report("local", "unavailable");
      return false;
    }
    return true;
  }
  private async sync(runGeneration: number) {
    this.report("syncing");
    try {
      // GET first also makes retry after an uncertain write safe.
      const beforeRead = read(this.key);
      const remote = await this.payload(await this.request("GET", runGeneration));
      if (!(await this.currentOwner(runGeneration))) return;
      if (read(this.key) !== beforeRead) {
        this.pending = true;
        return;
      }
      const result = reconcileDraft(parseLocalDraft(beforeRead), remote);
      if (result.action === "conflict") {
        this.report("conflict", null, remote);
        return;
      }
      write(this.key, result.local);
      if (result.action === "synced" || !result.local) {
        this.report("synced");
        return;
      }
      const sent = result.local;
      const response = await this.request(sent.deleted ? "DELETE" : "POST", runGeneration, sent);
      if (generation !== runGeneration) return;
      if (response.status === 409) {
        this.pending = true;
        return;
      }
      const saved = await this.payload(response);
      if (!(await this.currentOwner(runGeneration))) return;
      if (!saved) throw new Error("unavailable");
      const current = parseLocalDraft(read(this.key));
      if (!current) return;
      const next = acknowledgeDraft(current, sent, saved);
      write(this.key, next);
      if (next.dirty) this.pending = true;
      else this.report("synced");
    } catch (error) {
      if (generation !== runGeneration) return;
      this.pending = false;
      this.report(
        "local",
        error instanceof Error && error.message === "schema-unavailable"
          ? "schema-unavailable"
          : "unavailable",
      );
    }
  }
  resolve(choice: "local" | "remote") {
    if (this.snapshot.status !== "conflict") return;
    const local = parseLocalDraft(read(this.key));
    const remote = this.snapshot.remote;
    if (choice === "remote") write(this.key, fromRemote(remote));
    else if (local) write(this.key, { ...local, base: remote, dirty: true });
    void this.flush();
  }
}

function controller(ownerId: string, companyId: string) {
  const key = draftKey(ownerId, companyId);
  let sync = controllers.get(key);
  if (!sync) {
    sync = new DraftSync(ownerId, companyId, key);
    controllers.set(key, sync);
  }
  return sync;
}

/** Mount once in the wizard. Local writes remain synchronous; cloud writes are debounced. */
export function useDraftSync(ownerId = "", companyId = "") {
  const key = draftKey(ownerId, companyId);
  const snapshot = useSyncExternalStore(
    subscribe,
    () => controllers.get(key)?.snapshot ?? LOCAL,
    () => LOCAL,
  );
  useEffect(() => {
    if (!ownerId || !companyId) return;
    const sync = controller(ownerId, companyId);
    const retry = () => void sync.flush();
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) retry();
    };
    retry();
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    window.addEventListener("storage", onStorage);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== ownerId)) {
        generation++;
        for (const entry of controllers.values()) entry.pause();
      }
    });
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      window.removeEventListener("storage", onStorage);
      data.subscription.unsubscribe();
      // Queued completion/deletion must survive wizard navigation.
    };
  }, [ownerId, companyId, key]);
  return {
    ...snapshot,
    retry: () => controller(ownerId, companyId).flush(),
    resolveConflict: (choice: "local" | "remote") => controller(ownerId, companyId).resolve(choice),
  };
}

export function saveDraft(
  ownerId: string,
  companyId: string,
  answers: Answers,
  step: number,
): boolean {
  const key = draftKey(ownerId, companyId);
  const previous = parseLocalDraft(read(key));
  const durable = write(key, {
    version: 1,
    answers,
    step,
    updatedAt: Date.now(),
    base: previous?.base ?? null,
    dirty: true,
    deleted: false,
  });
  controllers.get(key)?.schedule();
  return durable;
}

/** Successful diagnostic completion only. A tombstone prevents stale devices resurrecting it. */
export async function removeDraft(ownerId: string, companyId: string): Promise<boolean> {
  const key = draftKey(ownerId, companyId);
  const previous = parseLocalDraft(read(key));
  write(key, {
    version: 1,
    answers: normalizeAnswers({}),
    step: 0,
    base: previous?.base ?? null,
    updatedAt: Date.now(),
    dirty: true,
    deleted: true,
  });
  const sync = controller(ownerId, companyId);
  await sync.flush();
  return sync.snapshot.status === "synced" && !parseLocalDraft(read(key))?.dirty;
}

/** Signout cleanup is deliberately local-only; it never queues DELETE requests. */
export function clearOnboardingDrafts() {
  generation++;
  for (const sync of controllers.values()) sync.pause();
  const keys = new Set([...memory.keys(), ...controllers.keys()]);
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(PREFIX)) keys.add(key);
  } catch {
    /* storage unavailable */
  }
  for (const key of keys) write(key, null);
  notify();
}
