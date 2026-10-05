import { emptyCatalog, parseCatalog, type ServiceCatalog } from "./service-catalog.ts";
export type CatalogScope =
  { kind: "demo" } | { kind: "account"; ownerId: string; companyId: string };
export type CatalogStorage = Pick<Storage, "getItem" | "setItem"> &
  Partial<Pick<Storage, "removeItem">>;
export type CatalogSnapshot = {
  catalog: ServiceCatalog;
  raw: string | null;
  logout: string | null;
  issue: "corrupt" | "unavailable" | "revoked" | null;
};
export type CatalogSave =
  | { kind: "saved"; snapshot: CatalogSnapshot }
  | { kind: "conflict" | "corrupt" | "unavailable" | "revoked" };
export function catalogScopeKey(scope: CatalogScope): string {
  if (scope.kind === "demo") return "nukkia:demo-services:v1";
  if (scope.kind !== "account" || !scope.ownerId?.trim() || !scope.companyId?.trim())
    throw Error("Selecione sua empresa para abrir os serviços.");
  return `nukkia:workspace-recovery:v1:${encodeURIComponent(scope.ownerId)}:${encodeURIComponent(scope.companyId)}:services`;
}
export function catalogLogoutKey(scope: CatalogScope) {
  catalogScopeKey(scope);
  return scope.kind === "account"
    ? `nukkia:workspace-recovery:v1:${encodeURIComponent(scope.ownerId)}:logout`
    : null;
}
export function readCatalog(storage: CatalogStorage, scope: CatalogScope): CatalogSnapshot {
  const key = catalogScopeKey(scope),
    logoutKey = catalogLogoutKey(scope);
  let raw: string | null = null,
    logout: string | null = null;
  try {
    logout = logoutKey ? storage.getItem(logoutKey) : null;
    raw = storage.getItem(key);
    if (logoutKey && storage.getItem(logoutKey) !== logout)
      throw Error("Sessão alterada durante a leitura.");
  } catch {
    return { catalog: emptyCatalog(key), raw, logout, issue: "unavailable" };
  }
  if (raw === null) return { catalog: emptyCatalog(key), raw, logout, issue: null };
  try {
    const catalog = parseCatalog(raw, key);
    if (logoutKey && catalog.logoutEpoch !== logout)
      return { catalog: emptyCatalog(key), raw, logout, issue: "revoked" };
    return { catalog, raw, logout, issue: null };
  } catch {
    return { catalog: emptyCatalog(key), raw, logout, issue: "corrupt" };
  }
}
function write(
  storage: CatalogStorage,
  scope: CatalogScope,
  baseline: CatalogSnapshot,
  draft: ServiceCatalog,
  explicitReset: boolean,
): CatalogSave {
  const key = catalogScopeKey(scope),
    logoutKey = catalogLogoutKey(scope);
  if (baseline.issue === "unavailable" || baseline.issue === "revoked")
    return { kind: baseline.issue };
  try {
    if (logoutKey && storage.getItem(logoutKey) !== baseline.logout) return { kind: "revoked" };
    if (storage.getItem(key) !== baseline.raw) return { kind: "conflict" };
    if (baseline.issue === "corrupt" && !explicitReset) return { kind: "corrupt" };
    const catalog = parseCatalog(
      JSON.stringify({ ...draft, logoutEpoch: baseline.logout, revision: crypto.randomUUID() }),
      key,
    );
    const raw = JSON.stringify(catalog);
    storage.setItem(key, raw);
    if (logoutKey && storage.getItem(logoutKey) !== baseline.logout) {
      // Logout does not take the catalog lock. Detect it after writing; remove
      // only our exact stale bytes. Payload epoch also blocks stale reopen.
      if (storage.getItem(key) === raw) storage.removeItem?.(key);
      return { kind: "revoked" };
    }
    return { kind: "saved", snapshot: { catalog, raw, logout: baseline.logout, issue: null } };
  } catch {
    return { kind: "unavailable" };
  }
}
// UI callers serialize writes with a shared Web Lock; this comparison also
// refuses stale snapshots and revoked sessions at the persistence boundary.
export function saveCatalog(
  storage: CatalogStorage,
  scope: CatalogScope,
  baseline: CatalogSnapshot,
  draft: ServiceCatalog,
): CatalogSave {
  return write(storage, scope, baseline, draft, false);
}
export function resetCatalog(
  storage: CatalogStorage,
  scope: CatalogScope,
  baseline: CatalogSnapshot,
): CatalogSave {
  return write(storage, scope, baseline, emptyCatalog(catalogScopeKey(scope)), true);
}
