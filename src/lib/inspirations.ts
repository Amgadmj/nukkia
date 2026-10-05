import { inspirationSchema } from "./inspiration-schema.ts";
import { updateBrand } from "./brand-preview.ts";
import type { DemoData } from "./quick-start.ts";
export function addInspiration(data: DemoData): DemoData {
  if (data.inspirations.length >= 20) throw new Error("Limite de 20 referências atingido.");
  return {
    ...data,
    inspirations: [...data.inspirations, inspirationSchema.parse({ id: crypto.randomUUID() })],
  };
}
export function detachInspiration(data: DemoData, id: string): DemoData {
  return {
    ...data,
    brand: updateBrand(data.brand, {
      inspirationBrief: data.brand.inspirationBrief.filter((item) => item.id !== id),
    }),
  };
}
export function editInspiration(
  data: DemoData,
  id: string,
  patch: Partial<
    Pick<
      DemoData["inspirations"][number],
      "title" | "url" | "note" | "permission" | "image" | "source"
    >
  >,
): DemoData {
  const current = data.inspirations.find((item) => item.id === id);
  if (!current) throw new Error("Referência não encontrada.");
  const edited = inspirationSchema.parse({ ...current, ...patch, id });
  if (JSON.stringify(edited) === JSON.stringify(current)) return data;
  const next = detachInspiration(data, id);
  const result = {
    ...next,
    inspirations: data.inspirations.map((item) => (item.id === id ? edited : item)),
  };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 4_800_000)
    throw new Error("Espaço de armazenamento insuficiente. A referência anterior foi preservada.");
  return result;
}
export function attachInspiration(data: DemoData, id: string): DemoData {
  const item = data.inspirations.find((item) => item.id === id);
  let valid = false;
  try {
    const url = new URL(item?.url ?? "");
    valid = url.protocol === "https:" && !url.username && !url.password && !!item?.title.trim();
  } catch {
    /* Keep invalid drafts editable. */
  }
  valid ||= !!(item?.image && item.source.trim() && item.title.trim());
  if (!valid || !item)
    throw new Error("Informe um título e uma fonte HTTPS sem credenciais antes de anexar.");
  const references = data.brand.inspirationBrief.filter((entry) => entry.id !== id);
  if (references.length >= 20)
    throw new Error("Limite de 20 referências anexadas. Desanexe uma antes de continuar.");
  const next = {
    ...data,
    brand: updateBrand(data.brand, { inspirationBrief: [...references, structuredClone(item)] }),
  };
  if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 4_800_000)
    throw new Error("Espaço insuficiente. O briefing anterior foi preservado.");
  return next;
}
export function removeInspiration(data: DemoData, id: string): DemoData {
  return {
    ...detachInspiration(data, id),
    inspirations: data.inspirations.filter((item) => item.id !== id),
  };
}
