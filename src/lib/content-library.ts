import { z } from "zod";
import { brandPreviewSchema, creativeStatus, firstPostBrief } from "./brand-preview.ts";
import { healthStudioSchema } from "./health-studio.ts";
import type { DemoData } from "./quick-start.ts";

const snapshotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("generic"),
    brand: brandPreviewSchema,
    name: z.string().max(120),
    segment: z.string().max(120),
    offer: z.string().max(1000),
    audience: z.string().max(1000),
    goal: z.string().max(1000),
    approved: z.boolean(),
  }),
  z.object({ kind: z.literal("health"), draft: healthStudioSchema }),
]);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
export const planningChannelSchema = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "whatsapp",
  "website",
  "undecided",
]);
export type PlanningChannel = z.infer<typeof planningChannelSchema>;
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timezoneSchema = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
const itemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(120),
  kind: z.enum(["generic", "health"]),
  archived: z.boolean().default(false),
  plan: z
    .object({
      date: dateSchema,
      version: z.number().int().positive(),
      channel: planningChannelSchema.optional(),
      time: timeSchema.optional(),
      timezone: timezoneSchema.optional(),
    })
    .refine((plan) => !plan.time || Boolean(plan.timezone), "Escolha o fuso horário.")
    .nullable()
    .default(null),
  versions: z
    .array(
      z.object({
        version: z.number().int().positive(),
        savedAt: z.string().datetime(),
        snapshot: snapshotSchema,
      }),
    )
    .min(1)
    .max(20),
});
export const contentLibrarySchema = z
  .object({
    items: z.array(itemSchema).max(30).default([]),
    activeGeneric: z.string().uuid().nullable().default(null),
    activeHealth: z.string().uuid().nullable().default(null),
  })
  .default({});
export type LibraryItem = z.infer<typeof itemSchema>;
export type LibraryKind = LibraryItem["kind"];

function bounded(data: DemoData): DemoData {
  contentLibrarySchema.parse(data.library);
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 4_800_000)
    throw new Error(
      "O espaço está próximo do limite de armazenamento. Esta versão não foi adicionada; seu rascunho foi preservado.",
    );
  return data;
}
function itemFor(data: DemoData, id: string) {
  const item = data.library.items.find((item) => item.id === id);
  if (!item) throw new Error("Item não encontrado nesta biblioteca.");
  return item;
}
export function libraryVersion(data: DemoData, id: string, version: number) {
  const saved = itemFor(data, id).versions.find((saved) => saved.version === version);
  if (!saved) throw new Error("Versão não encontrada.");
  return saved;
}
export function saveLibraryVersion(
  data: DemoData,
  kind: LibraryKind,
  expectedVersion?: number,
): DemoData {
  const key = kind === "generic" ? "activeGeneric" : "activeHealth";
  const active = data.library.items.find((item) => item.id === data.library[key]);
  if (active?.archived) throw new Error("Restaure o item arquivado antes de salvar uma versão.");
  if (expectedVersion !== undefined && (active?.versions.length ?? 0) !== expectedVersion)
    throw new Error("A versão mudou. Confira a biblioteca antes de salvar novamente.");
  if (active && active.versions.length >= 20)
    throw new Error("Limite de 20 versões atingido. Duplique o item para continuar.");
  if (!active && data.library.items.length >= 30)
    throw new Error("Limite de 30 itens atingido. Seu rascunho foi preservado.");
  if (kind === "generic" ? !data.brand.creative : !data.healthStudio.selectedOption)
    throw new Error("Prepare e escolha um rascunho antes de salvar na biblioteca.");
  const snapshot = snapshotSchema.parse(
    kind === "generic"
      ? {
          kind,
          brand: data.brand,
          name: data.name,
          segment: data.segment,
          offer: firstPostBrief(data).offer,
          audience: firstPostBrief(data).audience,
          goal: data.answers.goals,
          approved: creativeStatus(data).approved,
        }
      : { kind, draft: data.healthStudio },
  );
  const option = data.healthStudio.options.find(
    (option) => option.id === data.healthStudio.selectedOption,
  );
  const item: LibraryItem = {
    id: active?.id ?? crypto.randomUUID(),
    title: (kind === "generic"
      ? data.brand.creative!.copy.title
      : (option?.title ?? "Roteiro")
    ).slice(0, 120),
    kind,
    archived: false,
    plan: active?.plan ?? null,
    versions: [
      ...(active?.versions ?? []),
      { version: (active?.versions.length ?? 0) + 1, savedAt: new Date().toISOString(), snapshot },
    ],
  };
  return bounded({
    ...data,
    library: {
      ...data.library,
      [key]: item.id,
      items: active
        ? data.library.items.map((current) => (current.id === item.id ? item : current))
        : [...data.library.items, item],
    },
  });
}
export function resumeLibraryVersion(data: DemoData, id: string, version: number): DemoData {
  const item = itemFor(data, id);
  if (item.archived) throw new Error("Restaure o item arquivado antes de editar.");
  const { snapshot } = libraryVersion(data, id, version);
  if (snapshot.kind === "generic") {
    const creative = snapshot.brand.creative;
    if (!creative) throw new Error("Esta versão não contém um rascunho.");
    // Resume text, never roll the company's current identity/context back.
    return {
      ...data,
      library: { ...data.library, activeGeneric: id },
      brand: {
        ...data.brand,
        pieceBrief: structuredClone(snapshot.brand.pieceBrief),
        creative: {
          ...structuredClone(creative),
          approved: null,
          exported: null,
          review: "needs-review",
        },
      },
    };
  }
  return {
    ...data,
    library: { ...data.library, activeHealth: id },
    healthStudio: {
      ...structuredClone(snapshot.draft),
      revision: data.healthStudio.revision + 1,
      past: [],
      future: [],
    },
  };
}
export function duplicateLibraryItem(data: DemoData, id: string, version: number): DemoData {
  if (data.library.items.length >= 30) throw new Error("Limite de 30 itens atingido.");
  const original = itemFor(data, id);
  const saved = structuredClone(libraryVersion(data, id, version));
  if (saved.snapshot.kind === "generic") {
    saved.snapshot.approved = false;
    if (saved.snapshot.brand.creative) {
      saved.snapshot.brand.creative.approved = null;
      saved.snapshot.brand.creative.exported = null;
    }
  }
  const copy: LibraryItem = {
    ...original,
    id: crypto.randomUUID(),
    title: `${original.title.slice(0, 110)} (cópia)`,
    archived: false,
    plan: null,
    versions: [{ ...saved, version: 1, savedAt: new Date().toISOString() }],
  };
  return bounded({ ...data, library: { ...data.library, items: [...data.library.items, copy] } });
}
export function archiveLibraryItem(data: DemoData, id: string, archived: boolean): DemoData {
  itemFor(data, id);
  return {
    ...data,
    library: {
      ...data.library,
      items: data.library.items.map((item) => (item.id === id ? { ...item, archived } : item)),
    },
  };
}
export function planLibraryVersion(
  data: DemoData,
  id: string,
  version: number,
  date: string,
  channel?: PlanningChannel,
  timing?: { time?: string; timezone?: string },
): DemoData {
  const item = itemFor(data, id);
  if (item.archived) throw new Error("Restaure o item antes de planejar.");
  libraryVersion(data, id, version);
  if (channel !== undefined) planningChannelSchema.parse(channel);
  const intendedChannel = channel ?? item.plan?.channel;
  const time = timing?.time ?? item.plan?.time;
  const timezone = timing?.timezone ?? item.plan?.timezone;
  if (time && !timeSchema.safeParse(time).success) throw new Error("Informe um horário válido.");
  if ((time && !timezone) || (timezone && !timezoneSchema.safeParse(timezone).success))
    throw new Error("Escolha um fuso horário válido.");
  if (date && !dateSchema.safeParse(date).success) throw new Error("Informe uma data válida.");
  return {
    ...data,
    library: {
      ...data.library,
      items: data.library.items.map((item) =>
        item.id === id
          ? {
              ...item,
              plan: date
                ? {
                    date,
                    version,
                    ...(intendedChannel ? { channel: intendedChannel } : {}),
                    ...(time ? { time } : {}),
                    ...(timezone ? { timezone } : {}),
                  }
                : null,
            }
          : item,
      ),
    },
  };
}

export function saveNewLibraryItem(data: DemoData, kind: LibraryKind): DemoData {
  const key = kind === "generic" ? "activeGeneric" : "activeHealth";
  return saveLibraryVersion({ ...data, library: { ...data.library, [key]: null } }, kind, 0);
}
