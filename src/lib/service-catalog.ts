import { inspirationSchema } from "./inspiration-schema.ts";
import type { z } from "zod";
export type ServiceStatus = "draft" | "confirmed" | "archived";
export type Service = {
  id: string;
  title: string;
  summary: string;
  audience: string;
  cta: string;
  conditions: string;
  validUntil: string;
  conditionsConfirmed: boolean;
  source: string;
  material: string;
  visualMaterial?: z.infer<typeof inspirationSchema> | null;
  status: ServiceStatus;
};
export type ServiceCatalog = {
  version: 1;
  scope: string;
  logoutEpoch: string | null;
  revision: string;
  items: Service[];
  selectedId: string | null;
};
const limits = {
  title: 120,
  summary: 2000,
  audience: 500,
  cta: 200,
  conditions: 1000,
  validUntil: 10,
  source: 1000,
  material: 1000,
};
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Dados do serviço inválidos.");
  return value as Record<string, unknown>;
}
export function validateService(value: unknown): Service {
  const input = record(value);
  if (
    !identifier(input["id"]) ||
    !["draft", "confirmed", "archived"].includes(String(input["status"])) ||
    typeof input["conditionsConfirmed"] !== "boolean"
  )
    throw Error("Dados do serviço inválidos.");
  const fields: Record<string, string> = {};
  for (const [key, limit] of Object.entries(limits)) {
    const v = input[key];
    if (typeof v !== "string" || v.length > limit) throw Error("Revise os campos do serviço.");
    fields[key] = v;
  }
  if (!fields["title"]?.trim()) throw Error("Informe o nome do serviço.");
  if (
    fields["validUntil"] &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(fields["validUntil"]) ||
      new Date(fields["validUntil"] + "T00:00:00Z").toISOString().slice(0, 10) !==
        fields["validUntil"])
  )
    throw Error("Informe uma data de validade válida.");
  return {
    ...fields,
    ...(input["visualMaterial"]
      ? { visualMaterial: inspirationSchema.parse(input["visualMaterial"]) }
      : {}),
    id: input["id"],
    status: input["status"],
    conditionsConfirmed: input["conditionsConfirmed"],
  } as Service;
}
export function emptyService(): Service {
  return {
    id: crypto.randomUUID(),
    title: "",
    summary: "",
    audience: "",
    cta: "",
    conditions: "",
    validUntil: "",
    conditionsConfirmed: false,
    source: "Informado pela equipe",
    material: "",
    status: "draft",
  };
}
export function emptyCatalog(scope: string): ServiceCatalog {
  return {
    version: 1,
    scope,
    logoutEpoch: null,
    revision: crypto.randomUUID(),
    items: [],
    selectedId: null,
  };
}
export function parseCatalog(raw: string, scope: string): ServiceCatalog {
  if (raw.length > 4_800_000) throw Error("Catálogo muito grande.");
  const value = record(JSON.parse(raw));
  if (
    (value["logoutEpoch"] !== null && !identifier(value["logoutEpoch"])) ||
    value["version"] !== 1 ||
    value["scope"] !== scope ||
    !identifier(value["revision"]) ||
    !Array.isArray(value["items"]) ||
    value["items"].length > 100
  )
    throw Error("Catálogo inválido.");
  const items = value["items"].map(validateService);
  if (new Set(items.map((i) => i.id)).size !== items.length) throw Error("Serviços duplicados.");
  if (
    value["selectedId"] !== null &&
    (!identifier(value["selectedId"]) ||
      !items.some((i) => i.id === value["selectedId"] && i.status !== "archived"))
  )
    throw Error("Seleção inválida.");
  return {
    version: 1,
    scope,
    logoutEpoch: value["logoutEpoch"] as string | null,
    revision: value["revision"],
    items,
    selectedId: value["selectedId"] as string | null,
  };
}
export function putService(catalog: ServiceCatalog, value: Service): ServiceCatalog {
  const item = validateService(value);
  const exists = catalog.items.some((i) => i.id === item.id);
  if (!exists && catalog.items.length >= 100) throw Error("Este catálogo aceita até 100 serviços.");
  const items = exists
    ? catalog.items.map((i) => (i.id === item.id ? item : i))
    : [...catalog.items, item];
  return {
    ...catalog,
    items,
    selectedId:
      item.status === "archived" && catalog.selectedId === item.id ? null : catalog.selectedId,
  };
}
export function setServiceStatus(catalog: ServiceCatalog, id: string, status: ServiceStatus) {
  const item = catalog.items.find((i) => i.id === id);
  if (!item) throw Error("Serviço não encontrado.");
  return putService(catalog, { ...item, status });
}
export function selectService(catalog: ServiceCatalog, id: string | null): ServiceCatalog {
  if (id !== null && !catalog.items.some((i) => i.id === id && i.status !== "archived"))
    throw Error("Escolha um serviço ativo.");
  return { ...catalog, selectedId: id };
}
