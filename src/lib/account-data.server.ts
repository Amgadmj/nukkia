// User-scoped export metadata only: provider tokens and file bytes are excluded.
const COMPANY_TABLES = [
  "diagnostics",
  "brand_kits",
  "missions",
  "user_progress",
  "content_plans",
  "content_items",
  "social_accounts",
  "metrics_snapshots",
  "scheduled_posts",
  "ai_usage",
  "marketing_workspaces",
  "onboarding_drafts",
  "brand_stories",
] as const;
export type AccountTable = (typeof COMPANY_TABLES)[number] | "profiles" | "companies";
type Row = Record<string, unknown>;
type Read = (
  table: AccountTable,
  field: string,
  values: string[],
  offset: number,
  limit: number,
) => Promise<{ data: Row[] | null; error: unknown }>;
export async function collectAccountData(ownerId: string, read: Read) {
  const records: Partial<Record<AccountTable, Row[]>> = {};
  const unavailable: AccountTable[] = [];
  async function collect(table: AccountTable, field: string, values: string[]) {
    const rows: Row[] = [];
    try {
      if (values.length)
        for (let offset = 0; ; offset += 500) {
          const result = await read(table, field, values, offset, 500);
          if (result.error || !result.data) throw new Error("Read unavailable");
          rows.push(...result.data);
          if (result.data.length < 500) break;
        }
      records[table] = rows;
    } catch {
      unavailable.push(table);
    }
  }
  await collect("companies", "owner_id", [ownerId]);
  if (!records.companies)
    throw new Error("Não foi possível consultar suas empresas. Tente novamente.");
  await collect("profiles", "id", [ownerId]);
  const ids = records.companies
    .map((row) => row["id"])
    .filter((id): id is string => typeof id === "string");
  await Promise.all(COMPANY_TABLES.map((table) => collect(table, "company_id", ids)));
  return { complete: unavailable.length === 0, unavailable, records };
}

type StorageEntry = { name: string; id: string | null };
export async function purgeStorageTree(
  storage: {
    list: (
      prefix: string,
      offset: number,
    ) => Promise<{ data: StorageEntry[] | null; error: unknown }>;
    remove: (paths: string[]) => Promise<{ error: unknown }>;
  },
  root: string,
) {
  const paths: string[] = [];
  async function scan(prefix: string, depth: number) {
    if (depth > 20) throw new Error("Não foi possível concluir a lista de arquivos.");
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.list(prefix, offset);
      if (error || !data)
        throw new Error("Não foi possível listar os arquivos. A conta foi preservada.");
      for (const entry of data) {
        if (!entry.name || entry.name.includes("/") || entry.name === "." || entry.name === "..")
          throw new Error("Caminho de arquivo inválido.");
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) await scan(path, depth + 1);
        else paths.push(path);
      }
      if (data.length < 100) break;
    }
  }
  // Inventory first: deleting while paginating would shift offsets and skip files.
  await scan(root, 0);
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await storage.remove(paths.slice(offset, offset + 100));
    if (error)
      throw new Error(
        "Alguns arquivos não foram removidos. A conta foi preservada para tentar novamente.",
      );
  }
  return paths.length;
}
export async function deleteOwnedAccount(actions: {
  companies: () => Promise<string[]>;
  purge: (companyId: string, bucket: "brand-assets" | "content-media") => Promise<unknown>;
  deleteUser: () => Promise<unknown>;
}) {
  for (const companyId of await actions.companies()) {
    await actions.purge(companyId, "brand-assets");
    await actions.purge(companyId, "content-media");
  }
  await actions.deleteUser();
}
