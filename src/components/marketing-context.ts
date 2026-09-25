import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { Company } from "@/lib/company";
import type { DemoData } from "@/lib/quick-start";
import { WORKSPACE_PREFIX } from "@/lib/marketing-workspace";

export type SyncState = "loading" | "ready" | "saving" | "saved" | "local" | "conflict";
type Context = {
  data: DemoData;
  setData: Dispatch<SetStateAction<DemoData>>;
  company: Company | null;
  ownerId: string;
  sync: SyncState;
  storageAvailable: boolean;
  pendingSave: boolean;
  syncIssue: string | null;
  resolveConflict: (choice: "cloud" | "local") => void;
  retrySync: () => void;
};

// Keep shared identities outside the component refresh boundary. Refreshing the
// provider must not disconnect existing consumers or forget active save queues.
export const MarketingContext = createContext<Context | null>(null);
export const activeWorkspaces = new Set<() => void>();

export function useMarketingWorkspace() {
  const value = useContext(MarketingContext);
  if (!value) throw new Error("MarketingWorkspace requires its authenticated provider");
  return value;
}

export function clearMarketingWorkspace() {
  // Revoke before clearing storage, including before React unmounts.
  for (const clear of activeWorkspaces) clear();
  try {
    for (const key of Object.keys(window.sessionStorage))
      if (key.startsWith(WORKSPACE_PREFIX)) window.sessionStorage.removeItem(key);
  } catch {
    /* Memory and request lifetimes have already been cleared. */
  }
}
