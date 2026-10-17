import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { z } from "zod";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { useCompany, useDiagnostic, type Company } from "@/lib/company";
import { apiFetch } from "@/lib/api";
import { demoSchema, type DemoData } from "@/lib/quick-start";
import {
  parseStoredWorkspace,
  retainWorkspaceAchievements,
  recoveryOwnerPrefix,
  seedWorkspace,
  workspaceKey,
  type StoredWorkspace,
} from "@/lib/marketing-workspace";
import {
  MarketingContext,
  activeWorkspaces,
  useMarketingWorkspace,
  type SyncState,
} from "./marketing-context";
// These re-exports retain identity across provider refreshes; the Vite runtime
// regression test checks this boundary without changing consumers' imports.
// eslint-disable-next-line react-refresh/only-export-components
export { useMarketingWorkspace, clearMarketingWorkspace } from "./marketing-context";
import "@/demo.css";
import "@/workspace.css";
import "./workspace-save-status.css";

export function MarketingProvider({
  ownerId,
  children,
  loadingFallback,
}: {
  ownerId: string;
  children: ReactNode;
  loadingFallback?: ReactNode;
}) {
  const company = useCompany();
  // The shared company query can briefly retain the previous account's cache.
  const owned = company.data?.owner_id === ownerId ? company.data : null;
  const diagnostic = useDiagnostic(owned?.id);
  if (company.isLoading || (owned && diagnostic.isLoading))
    return loadingFallback ?? <WorkspaceSkeleton fullPage />;
  // A background query failure must not unmount an existing in-memory draft.
  if ((company.error && !owned) || (company.data && !owned))
    return (
      <div className="workspace-loading">
        <p role="alert">Não foi possível abrir sua empresa.</p>
        <button className="quick-secondary" onClick={() => void company.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <WorkspaceState
      key={workspaceKey(ownerId, owned?.id)}
      ownerId={ownerId}
      company={owned}
      initial={seedWorkspace(owned, diagnostic.data?.answers)}
    >
      {children}
    </WorkspaceState>
  );
}

const revisionSchema = z.string().uuid();
const cloudSchema = z.union([
  z.object({
    data: demoSchema,
    revision: revisionSchema,
    updatedAt: z.string().datetime({ offset: true }),
  }),
  z.object({ data: z.null(), revision: z.null(), updatedAt: z.null() }),
]);
type Cloud = z.infer<typeof cloudSchema>;
type State = {
  stored: StoredWorkspace;
  sync: SyncState;
  remote: Cloud | null;
  storageAvailable: boolean;
  recoveryAvailable: boolean;
  conflictSource: "browser" | "cloud" | null;
  localAlternative: Recovery | null;
  recoveryBase: Record<string, string>;
  syncIssue: string | null;
  cleared: boolean;
};

function preserveAnswers(data: DemoData, original: DemoData): DemoData {
  const answers = { ...data.answers };
  for (const key of Object.keys(answers) as (keyof DemoData["answers"])[]) {
    if (typeof original.answers[key] === "string") answers[key] = original.answers[key];
  }
  return { ...data, answers };
}

function parseCloud(body: unknown): Cloud {
  const parsed = cloudSchema.parse(body);
  return parsed.data === null
    ? parsed
    : {
        ...parsed,
        data: preserveAnswers(parsed.data, (body as { data: DemoData }).data),
      };
}

function sameData(a: DemoData, b: DemoData) {
  return JSON.stringify(a) === JSON.stringify(b);
}

type Recovery = { key: string; id: string; seen: Record<string, string>; stored: StoredWorkspace };
const recoverySchema = z.object({
  id: z.string().uuid(),
  seen: z.record(z.string()),
  stored: z.unknown(),
});
function browserEpoch(ownerId: string) {
  try {
    return window.localStorage.getItem(`${recoveryOwnerPrefix(ownerId)}logout`);
  } catch {
    return undefined;
  }
}
function epochMatches(ownerId: string, expected: string | null) {
  const current = browserEpoch(ownerId);
  return current === undefined || current === expected;
}
function recoveryPresent(key: string | null) {
  if (!key) return true;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    // Blocked reads are not evidence of logout; keep memory editing available.
    return true;
  }
}
function readRecoveries(prefix: string): Recovery[] {
  try {
    const entries: Recovery[] = [];
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith(prefix)) continue;
      try {
        const value = recoverySchema.parse(JSON.parse(window.localStorage.getItem(key)!));
        const stored = parseStoredWorkspace(JSON.stringify(value.stored));
        if (!stored) continue;
        stored.data = preserveAnswers(stored.data, (value.stored as StoredWorkspace).data);
        if (stored.revision !== null && !revisionSchema.safeParse(stored.revision).success)
          continue;
        entries.push({ key, id: value.id, seen: value.seen, stored });
      } catch {
        /* Preserve unreadable originals; never import other scopes. */
      }
    }
    // Each tab owns its own record. A choice supersedes only the exact versions
    // it observed, so a concurrent edit cannot be silently overwritten.
    return entries.filter(
      (entry) =>
        !entries.some((other) => other.key !== entry.key && other.seen[entry.key] === entry.id),
    );
  } catch {
    return [];
  }
}

function restoreCloud(cloud: Cloud, fallback: DemoData): StoredWorkspace {
  if (!cloud.data) return { data: fallback, revision: null, dirty: false };
  // Persisted "loading" is an interrupted job, not a request running in this
  // mounted editor. Reuse the cache parser's recovery and save that correction.
  const restored = parseStoredWorkspace(
    JSON.stringify({ data: cloud.data, revision: cloud.revision, dirty: false }),
  );
  if (!restored) throw new Error("Invalid cloud workspace");
  const data = preserveAnswers(restored.data, cloud.data);
  return { data, revision: cloud.revision, dirty: !sameData(data, cloud.data) };
}

// Only fixed, allowlisted messages reach the UI. Never display a response body
// or a thrown network error: either may contain internal or account details.
class WorkspaceRequestError extends Error {}

async function workspaceResponseError(response: Response) {
  if (response.status === 426)
    return new WorkspaceRequestError(
      "Esta versão do aplicativo precisa ser atualizada antes de sincronizar. Preserve seu rascunho local e atualize a página.",
    );
  if (response.status === 401)
    return new WorkspaceRequestError(
      "Sua sessão não foi reconhecida. Entre na conta em outra aba e tente novamente.",
    );
  if (response.status === 403 || response.status === 404)
    return new WorkspaceRequestError("Não foi possível acessar esta empresa com a conta atual.");
  if (response.status === 413)
    return new WorkspaceRequestError(
      "O rascunho excede o limite de 5 MB. Reduza o tamanho das imagens antes de tentar novamente.",
    );
  if (response.status === 400)
    return new WorkspaceRequestError("A conta não aceitou os dados deste rascunho.");
  if (response.status === 503) {
    const body: unknown = await response.json().catch(() => null);
    if (body && typeof body === "object" && "code" in body && body.code === "WORKSPACE_UNAVAILABLE")
      return new WorkspaceRequestError(
        "O salvamento na conta está indisponível. Tente novamente mais tarde.",
      );
  }
  return new WorkspaceRequestError("Não foi possível sincronizar com a conta. Tente novamente.");
}

function workspaceIssue(error: unknown) {
  return error instanceof WorkspaceRequestError
    ? error.message
    : "Não foi possível sincronizar com a conta. Tente novamente.";
}

async function requestWorkspace(companyId: string, mutation?: StoredWorkspace) {
  let timer: number | undefined;
  // apiFetch has no AbortSignal API. Timeout means the write outcome is unknown;
  // retry must GET and reconcile before any further compare-and-swap write.
  try {
    return await Promise.race([
      (async () => {
        const response = mutation
          ? await apiFetch("/api/marketing-workspace", {
              companyId,
              data: mutation.data,
              expectedRevision: mutation.revision,
            })
          : await apiFetch(`/api/marketing-workspace?companyId=${companyId}`, undefined, {
              method: "GET",
            });
        if (mutation && response.status === 409) return { conflict: true as const };
        if (!response.ok) throw await workspaceResponseError(response);
        return { conflict: false as const, cloud: parseCloud(await response.json()) };
      })(),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () =>
            reject(
              new WorkspaceRequestError(
                "O tempo de espera terminou sem confirmação. Tente sincronizar novamente.",
              ),
            ),
          20_000,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

function WorkspaceState({
  ownerId,
  company,
  initial,
  children,
}: {
  ownerId: string;
  company: Company | null;
  initial: DemoData;
  children: ReactNode;
}) {
  const key = workspaceKey(ownerId, company?.id);
  const companyId = company?.id;
  const recoveryPrefix = `${recoveryOwnerPrefix(ownerId)}${encodeURIComponent(companyId || "new")}:`;
  const writer = useRef<string>(`${recoveryPrefix}${crypto.randomUUID()}`);
  const epoch = useRef(browserEpoch(ownerId) ?? null);
  const [state, setState] = useState<State>(() => {
    let stored: StoredWorkspace = { data: initial, revision: null, dirty: false };
    let storageAvailable = true;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw && browserEpoch(ownerId) === undefined)
        epoch.current = JSON.parse(raw).logoutEpoch ?? null;
      const parsed =
        raw && (JSON.parse(raw).logoutEpoch ?? null) === epoch.current
          ? parseStoredWorkspace(raw)
          : null;
      if (parsed) {
        const original = JSON.parse(raw!).data as DemoData;
        stored = {
          ...parsed,
          data: preserveAnswers(parsed.data, original),
          dirty: parsed.dirty || original.brand?.research?.status === "loading",
        };
        if (stored.revision !== null && !revisionSchema.safeParse(stored.revision).success)
          stored = { ...stored, revision: null, dirty: true };
      }
    } catch {
      storageAvailable = false;
    }
    const recoveries = readRecoveries(recoveryPrefix);
    // A legacy tab draft is an original too: never replace it just because
    // another tab wrote more recently. Only import this authenticated scope.
    if (
      !stored.dirty &&
      stored.revision === null &&
      sameData(stored.data, initial) &&
      recoveries[0]
    )
      stored = recoveries[0].stored;
    const matches = recoveries.filter((entry) => sameData(entry.stored.data, stored.data));
    const alternative =
      recoveries.find((entry) => !sameData(entry.stored.data, stored.data)) ?? null;
    return {
      stored,
      sync: alternative ? "conflict" : company ? "loading" : "local",
      remote: null,
      storageAvailable,
      recoveryAvailable: matches.length > 0,
      conflictSource: alternative ? "browser" : null,
      localAlternative: alternative,
      recoveryBase: Object.fromEntries(matches.map((entry) => [entry.key, entry.id])),
      syncIssue: null,
      cleared: false,
    };
  });
  const latest = useRef(state);
  const recoveryBase = useRef(state.recoveryBase);
  // Recovery records are only removed on logout/explicit browser clearing.
  // Their disappearance also revokes a tab when quota prevented a logout marker.
  const recoveryWitness = useRef<string | null>(null);
  const lifetime = useRef({ active: true, revoked: false, generation: 0 });
  const saveTimer = useRef<number | undefined>(undefined);
  const [readAttempt, setReadAttempt] = useState(0);

  const persist = useCallback(
    (next: State): State => {
      const stored = next.stored;
      let sessionAvailable = false;
      try {
        window.sessionStorage.setItem(
          key,
          JSON.stringify({ ...stored, logoutEpoch: epoch.current }),
        );
        sessionAvailable = true;
      } catch {
        /* Browser recovery can still succeed independently. */
      }
      let recoveryAvailable = false;
      const recoveries = readRecoveries(recoveryPrefix);
      let alternative = next.localAlternative;
      for (const entry of recoveries) {
        if (entry.key === writer.current || recoveryBase.current[entry.key] === entry.id) continue;
        if (
          sameData(entry.stored.data, stored.data) ||
          sameData(entry.stored.data, latest.current.stored.data)
        )
          recoveryBase.current[entry.key] = entry.id;
        else alternative ??= entry;
      }
      try {
        const id = crypto.randomUUID();
        window.localStorage.setItem(
          writer.current,
          JSON.stringify({ id, seen: recoveryBase.current, stored }),
        );
        recoveryBase.current[writer.current] = id;
        recoveryWitness.current = writer.current;
        recoveryAvailable = true;
      } catch {
        /* Keep the session/memory original and disclose its limits. */
      }
      return {
        ...next,
        storageAvailable: sessionAvailable || recoveryAvailable,
        recoveryAvailable,
        ...(alternative
          ? { sync: "conflict", conflictSource: "browser", localAlternative: alternative }
          : {}),
      };
    },
    [key, recoveryPrefix],
  );
  const publish = useCallback(
    (next: State) => {
      if (!lifetime.current.active || lifetime.current.revoked) return;
      if (!epochMatches(ownerId, epoch.current) || !recoveryPresent(recoveryWitness.current))
        return;
      if (next.stored !== latest.current.stored) next = persist(next);
      if (next.conflictSource === "browser") next = { ...next, sync: "conflict" };
      // Update the authoritative snapshot synchronously: async completions and
      // consecutive setters must see edits even before React commits a render.
      latest.current = next;
      setState(next);
    },
    [persist, ownerId],
  );

  useEffect(() => {
    const life = lifetime.current;
    if (life.revoked) return;
    life.active = true;
    function clear() {
      life.revoked = true;
      life.generation++;
      window.clearTimeout(saveTimer.current);
      const empty: State = {
        stored: { data: seedWorkspace(), revision: null, dirty: false },
        sync: "local",
        remote: null,
        storageAvailable: true,
        recoveryAvailable: false,
        conflictSource: null,
        localAlternative: null,
        recoveryBase: {},
        syncIssue: null,
        cleared: true,
      };
      latest.current = empty;
      setState(empty);
    }
    const entry = { ownerId, clear };
    activeWorkspaces.add(entry);
    function storageChanged() {
      if (!epochMatches(ownerId, epoch.current) || !recoveryPresent(recoveryWitness.current)) {
        clear();
        try {
          window.sessionStorage.removeItem(key);
        } catch {
          /* Already revoked. */
        }
        return;
      }
      let alternative: Recovery | undefined;
      for (const item of readRecoveries(recoveryPrefix)) {
        if (item.key === writer.current || recoveryBase.current[item.key] === item.id) continue;
        if (sameData(item.stored.data, latest.current.stored.data))
          recoveryBase.current[item.key] = item.id;
        else alternative ??= item;
      }
      if (alternative)
        publish({
          ...latest.current,
          sync: "conflict",
          conflictSource: "browser",
          localAlternative: alternative,
        });
    }
    window.addEventListener("storage", storageChanged);
    if (epochMatches(ownerId, epoch.current) && recoveryPresent(recoveryWitness.current))
      publish(persist(latest.current));
    else clear();
    return () => {
      life.active = false;
      life.generation++;
      window.clearTimeout(saveTimer.current);
      activeWorkspaces.delete(entry);
      window.removeEventListener("storage", storageChanged);
    };
  }, [persist, publish, key, ownerId, recoveryPrefix]);

  const isCurrent = useCallback(
    (generation: number) => {
      const life = lifetime.current;
      return (
        life.active &&
        !life.revoked &&
        life.generation === generation &&
        epochMatches(ownerId, epoch.current) &&
        recoveryPresent(recoveryWitness.current)
      );
    },
    [ownerId],
  );

  const reconcile = useCallback(
    (cloud: Cloud, forceConflict = false) => {
      if (latest.current.conflictSource === "browser") return;
      const current = { ...latest.current, syncIssue: null };
      const local = current.stored;
      if (cloud.data && sameData(local.data, cloud.data)) {
        // Recover a response lost after the server committed the same document.
        publish({
          ...current,
          stored: { ...local, revision: cloud.revision, dirty: false },
          remote: null,
          sync: "saved",
        });
      } else if (
        forceConflict ||
        (local.dirty && local.revision !== cloud.revision) ||
        (!cloud.data && local.revision !== null)
      ) {
        publish({ ...current, remote: cloud, sync: "conflict", conflictSource: "cloud" });
      } else if (local.dirty) {
        publish({ ...current, remote: null, sync: "ready" });
      } else if (cloud.data) {
        const stored = restoreCloud(cloud, local.data);
        publish({
          ...current,
          stored,
          remote: null,
          sync: stored.dirty ? "ready" : "saved",
        });
      } else {
        publish({ ...current, remote: null, sync: "ready" });
      }
    },
    [publish],
  );

  useEffect(() => {
    const life = lifetime.current;
    if (!companyId || life.revoked) return;
    const generation = ++life.generation;
    void requestWorkspace(companyId)
      .then((result) => {
        if (!isCurrent(generation)) return;
        if (result.conflict) throw new Error("Invalid read response");
        reconcile(result.cloud);
      })
      .catch((error: unknown) => {
        if (isCurrent(generation))
          publish({
            ...latest.current,
            sync: "local",
            remote: null,
            syncIssue: workspaceIssue(error),
          });
      });
    return () => {
      life.generation++;
    };
  }, [companyId, readAttempt, isCurrent, publish, reconcile]);

  useEffect(() => {
    if (!companyId || !state.stored.dirty || state.sync !== "ready" || lifetime.current.revoked)
      return;
    const generation = lifetime.current.generation;
    saveTimer.current = window.setTimeout(() => {
      if (!isCurrent(generation) || latest.current.sync !== "ready") return;
      const snapshot = latest.current.stored;
      publish({ ...latest.current, sync: "saving" });
      void requestWorkspace(companyId, snapshot)
        .then(async (result) => {
          if (!isCurrent(generation)) return;
          if (result.conflict) {
            const read = await requestWorkspace(companyId);
            if (!isCurrent(generation)) return;
            if (read.conflict) throw new Error("Invalid read response");
            reconcile(read.cloud, true);
            return;
          }
          if (
            !result.cloud.data ||
            result.cloud.revision === snapshot.revision ||
            !sameData(result.cloud.data, snapshot.data)
          )
            throw new Error("Invalid save acknowledgement");
          const current = latest.current;
          const dirty = current.stored.data !== snapshot.data;
          publish({
            ...current,
            stored: { ...current.stored, revision: result.cloud.revision, dirty },
            remote: null,
            sync: dirty ? "ready" : "saved",
            syncIssue: null,
          });
        })
        .catch((error: unknown) => {
          if (isCurrent(generation))
            publish({
              ...latest.current,
              sync: "local",
              remote: null,
              syncIssue: workspaceIssue(error),
            });
        });
    }, 700);
    return () => window.clearTimeout(saveTimer.current);
  }, [companyId, state.stored, state.sync, isCurrent, publish, reconcile]);

  const setData = useCallback<Dispatch<SetStateAction<DemoData>>>(
    (value) => {
      if (!lifetime.current.active || lifetime.current.revoked) return;
      const current = latest.current;
      const data = typeof value === "function" ? value(current.stored.data) : value;
      if (data === current.stored.data) return;
      publish({
        ...current,
        stored: {
          ...current.stored,
          data: retainWorkspaceAchievements(current.stored.data, data),
          dirty: true,
        },
        sync: current.sync === "saved" ? "ready" : current.sync,
      });
    },
    [publish],
  );

  function resolveConflict(choice: "cloud" | "local") {
    const current = latest.current;
    if (current.sync === "conflict" && current.localAlternative) {
      const alternative = current.localAlternative;
      recoveryBase.current[alternative.key] = alternative.id;
      // Keep the replaced branch on disk. Only the new record supersedes it.
      writer.current = `${recoveryPrefix}${crypto.randomUUID()}`;
      publish({
        ...current,
        stored: { ...(choice === "cloud" ? alternative.stored : current.stored) },
        localAlternative: null,
        conflictSource: null,
        remote: null,
        sync: companyId ? "loading" : "local",
        syncIssue: null,
      });
      if (companyId) setReadAttempt((attempt) => attempt + 1);
      return;
    }
    if (current.sync !== "conflict" || !current.remote) return;
    writer.current = `${recoveryPrefix}${crypto.randomUUID()}`;
    const cloud = current.remote;
    const stored =
      choice === "cloud"
        ? restoreCloud(cloud, initial)
        : { ...current.stored, revision: cloud.revision, dirty: true };
    publish({
      ...current,
      stored,
      remote: null,
      conflictSource: null,
      sync: choice === "cloud" && cloud.data && !stored.dirty ? "saved" : "ready",
    });
  }
  function retrySync() {
    if (
      !companyId ||
      latest.current.sync !== "local" ||
      !lifetime.current.active ||
      lifetime.current.revoked
    )
      return;
    publish({ ...latest.current, sync: "loading", remote: null, syncIssue: null });
    setReadAttempt((attempt) => attempt + 1);
  }
  if (state.cleared) return null;
  return (
    <MarketingContext.Provider
      value={{
        data: state.stored.data,
        setData,
        company,
        ownerId,
        sync: state.sync,
        storageAvailable: state.storageAvailable,
        recoveryAvailable: state.recoveryAvailable,
        conflictSource: state.conflictSource,
        pendingSave: state.stored.dirty,
        syncIssue: state.syncIssue,
        resolveConflict,
        retrySync,
      }}
    >
      {children}
    </MarketingContext.Provider>
  );
}

export function WorkspaceSaveStatus() {
  const {
    sync,
    company,
    storageAvailable,
    recoveryAvailable,
    conflictSource,
    pendingSave,
    syncIssue,
    resolveConflict,
    retrySync,
  } = useMarketingWorkspace();
  // The "saved" state is the normal case and needs no indicator; only
  // saving, local-only and conflict states stay visible so risk is not hidden.
  if (sync === "saved") return null;
  const saving = sync === "saving" || sync === "loading" || (sync === "ready" && pendingSave);
  const memoryOnly = !storageAvailable;
  const label =
    sync === "conflict"
      ? "Revisar conflito"
      : saving
        ? "Salvando"
        : recoveryAvailable
          ? "Salvo neste navegador"
          : "Somente nesta aba";
  const message =
    sync === "conflict"
      ? conflictSource === "browser"
        ? "Há outra cópia neste navegador. Escolha qual continuar; nenhuma será apagada por esta escolha."
        : "Há outra versão na sua conta. Escolha qual continuar."
      : sync === "loading"
        ? "Verificando a versão da conta antes de salvar."
        : saving
          ? "Aguardando confirmação do salvamento na conta."
          : syncIssue || "Alterações ainda não salvas na conta.";
  return (
    <div className="workspace-save-indicator" data-state={sync}>
      <details className="workspace-save-disclosure">
        <summary className="workspace-save-pill" aria-label={label}>
          <span role="status" aria-live="polite" aria-atomic={true}>
            {label}
          </span>
        </summary>
        <div className="workspace-save-panel">
          <p>{message}</p>
          {recoveryAvailable && (
            <p>
              Cópia de recuperação neste navegador, não na conta. Disponível entre abas deste
              perfil; sair da conta ou limpar os dados do navegador remove esta cópia.
            </p>
          )}
          {storageAvailable && !recoveryAvailable && (
            <p>Rascunho guardado nesta aba. Fechar a aba pode apagar esta cópia.</p>
          )}
          {sync === "local" && company && (
            <button type="button" onClick={retrySync}>
              Tentar sincronizar novamente
            </button>
          )}
          {sync === "conflict" && (
            <div className="workspace-save-actions">
              <p>
                {conflictSource === "browser"
                  ? "Usar a outra cópia muda o rascunho aberto. As cópias originais são preservadas até sair da conta."
                  : "Usar a versão da conta substitui o rascunho desta aba."}
              </p>
              <button type="button" onClick={() => resolveConflict("cloud")}>
                {conflictSource === "browser"
                  ? "Usar outra cópia do navegador"
                  : "Usar versão da conta"}
              </button>
              <button type="button" onClick={() => resolveConflict("local")}>
                Manter minha versão desta aba
              </button>
            </div>
          )}
        </div>
      </details>
      {memoryOnly && (
        <p className="workspace-save-warning" role="alert">
          Rascunho apenas em memória. Não feche nem recarregue esta aba: suas alterações podem ser
          perdidas até salvar na conta.
        </p>
      )}
    </div>
  );
}
