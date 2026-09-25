import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { Company } from "@/lib/company";
import type { DemoData } from "@/lib/quick-start";
import { WORKSPACE_PREFIX, recoveryOwnerPrefix } from "@/lib/marketing-workspace";

export type SyncState = "loading" | "ready" | "saving" | "saved" | "local" | "conflict";
type Context = {
  data: DemoData;
  setData: Dispatch<SetStateAction<DemoData>>;
  company: Company | null;
  ownerId: string;
  sync: SyncState;
  storageAvailable: boolean;
  recoveryAvailable: boolean;
  conflictSource: "browser" | "cloud" | null;
  pendingSave: boolean;
  syncIssue: string | null;
  resolveConflict: (choice: "cloud" | "local") => void;
  retrySync: () => void;
};

// Keep shared identities outside the component refresh boundary. Refreshing the
// provider must not disconnect existing consumers or forget active save queues.
export const MarketingContext = createContext<Context | null>(null);
export const activeWorkspaces = new Set<{ ownerId: string; clear: () => void }>();

export function useMarketingWorkspace() {
  const value = useContext(MarketingContext);
  if (!value) throw new Error("MarketingWorkspace requires its authenticated provider");
  return value;
}

export function clearMarketingWorkspace(ownerId?: string) {
  // Revoke before clearing storage, including before React unmounts.
  const owners = new Set(ownerId ? [ownerId] : [...activeWorkspaces].map((entry) => entry.ownerId));
  for (const entry of activeWorkspaces) if (owners.has(entry.ownerId)) entry.clear();
  for (const owner of owners) {
    try {
      for (const key of Object.keys(window.sessionStorage))
        if (key.startsWith(`${WORKSPACE_PREFIX}${owner}:`)) window.sessionStorage.removeItem(key);
    } catch {
      /* Memory has already been revoked. */
    }
    const prefix = recoveryOwnerPrefix(owner);
    const logoutKey = `${prefix}logout`;
    const markLogout = () => {
      try {
        window.localStorage.setItem(logoutKey, crypto.randomUUID());
        return true;
      } catch {
        return false;
      }
    };
    // Revoke peers early if possible, but never make deletion depend on a write.
    const marked = markLogout();
    try {
      for (const key of Object.keys(window.localStorage))
        if (key.startsWith(prefix) && key !== logoutKey) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            /* Continue attempting cleanup of the remaining own records. */
          }
        }
    } catch {
      /* Storage may be blocked; never undo memory revocation. */
    }
    // Deletion normally frees enough quota. If writes remain unavailable,
    // remove the old marker; peers also detect deletion of their own recovery.
    if (!marked && !markLogout()) {
      try {
        window.localStorage.removeItem(logoutKey);
      } catch {
        /* Already revoked locally; no recovery data is recreated. */
      }
    }
  }
}
