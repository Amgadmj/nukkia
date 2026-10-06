import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { demoSchema, type DemoData } from "@/lib/quick-start";
import { userClientFromRequest } from "@/lib/supabase-request.server";

// Additive local typing until the migration is activated and types regenerated.
type WorkspaceRow = {
  company_id: string;
  data: Json;
  revision: string;
  updated_at: string;
};
type WorkspaceDatabase = Database & {
  public: {
    Tables: {
      marketing_workspaces: {
        Row: WorkspaceRow;
        Insert: WorkspaceRow;
        Update: Partial<WorkspaceRow>;
        Relationships: [];
      };
    };
  };
};

const MAX_BODY_BYTES = 5_000_000;
const columns = "data, revision, updated_at";
const companyIdSchema = z.string().uuid();
const saveSchema = z
  .object({
    companyId: companyIdSchema,
    data: z.unknown(),
    expectedRevision: z.string().uuid().nullable(),
  })
  .strict();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function storageFailure(error: { code?: string }) {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") {
    return json(
      {
        code: "WORKSPACE_UNAVAILABLE",
        message: "O espaço de marketing ainda não está disponível.",
      },
      503,
    );
  }
  return json({ message: "Não foi possível acessar o espaço de marketing." }, 500);
}

function parseWorkspace(input: unknown) {
  const parsed = demoSchema.safeParse(input);
  if (parsed.success) {
    // demoSchema validates and supplies defaults, but answersSchema trims text.
    // Persist the user's original edits for known answer keys, including whitespace.
    const original = (input as DemoData).answers;
    for (const key of Object.keys(parsed.data.answers) as (keyof DemoData["answers"])[]) {
      if (typeof original[key] === "string") parsed.data.answers[key] = original[key];
    }
  }
  return parsed;
}

function payload(row: Pick<WorkspaceRow, "data" | "revision" | "updated_at"> | null) {
  if (!row) return json({ data: null, revision: null, updatedAt: null });
  const parsed = parseWorkspace(row.data);
  if (!parsed.success) return json({ message: "O espaço salvo tem um formato inválido." }, 500);
  return json({ data: parsed.data, revision: row.revision, updatedAt: row.updated_at });
}

class BodyTooLarge extends Error {}

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new BodyTooLarge();
  if (!request.body) throw new SyntaxError("Empty body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLarge();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

async function handleRequest(request: Request): Promise<Response> {
  try {
    const client = userClientFromRequest(request);
    if (!client) return json({ message: "Não autenticado" }, 401);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return json({ message: "Não autenticado" }, 401);

    let companyId: string;
    let mutation: { data: DemoData; expectedRevision: string | null } | null = null;
    if (request.method === "GET") {
      const id = companyIdSchema.safeParse(new URL(request.url).searchParams.get("companyId"));
      if (!id.success) return json({ message: "Empresa inválida" }, 400);
      companyId = id.data;
    } else {
      let body: unknown;
      try {
        body = await readBody(request);
      } catch (error) {
        return error instanceof BodyTooLarge
          ? json({ message: "O espaço excede o limite de 5 MB." }, 413)
          : json({ message: "Corpo da requisição inválido" }, 400);
      }
      const input = saveSchema.safeParse(body);
      if (!input.success) return json({ message: "Dados do espaço inválidos" }, 400);
      const data = parseWorkspace(input.data.data);
      if (!data.success) return json({ message: "Dados do espaço inválidos" }, 400);
      if (
        input.data.expectedRevision !== null &&
        (input.data.data as Record<string, unknown>)["workspaceSchemaVersion"] !== 3
      )
        return json(
          {
            code: "WORKSPACE_UPGRADE_REQUIRED",
            message: "Atualize a página antes de salvar. Seu rascunho local foi preservado.",
          },
          426,
        );
      companyId = input.data.companyId;
      mutation = { data: data.data, expectedRevision: input.data.expectedRevision };
    }

    const { data: company, error: companyError } = await client
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .eq("owner_id", auth.user.id)
      .maybeSingle();
    if (companyError) return json({ message: "Não foi possível consultar a empresa." }, 500);
    if (!company) return json({ message: "Empresa não encontrada" }, 404);

    // Same request-scoped client and user JWT; the table also enforces owner-only RLS.
    const db = client as unknown as SupabaseClient<WorkspaceDatabase>;
    if (!mutation) {
      const { data, error } = await db
        .from("marketing_workspaces")
        .select(columns)
        .eq("company_id", companyId)
        .maybeSingle();
      return error ? storageFailure(error) : payload(data);
    }

    const values = {
      company_id: companyId,
      data: mutation.data,
      revision: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
    };
    // Unique insert or atomic compare-and-swap: never upsert or retry over a newer revision.
    const result =
      mutation.expectedRevision === null
        ? await db.from("marketing_workspaces").insert(values).select(columns).maybeSingle()
        : await db
            .from("marketing_workspaces")
            .update(values)
            .eq("company_id", companyId)
            .eq("revision", mutation.expectedRevision)
            .select(columns)
            .maybeSingle();
    if (result.error?.code === "23505" || (!result.error && !result.data)) {
      return json(
        {
          code: "WORKSPACE_CONFLICT",
          message: "O espaço foi alterado. Recarregue antes de salvar.",
        },
        409,
      );
    }
    return result.error ? storageFailure(result.error) : payload(result.data);
  } catch {
    return json({ message: "Não foi possível acessar o espaço de marketing." }, 500);
  }
}

export const Route = createFileRoute("/api/marketing-workspace")({
  server: {
    handlers: {
      GET: ({ request }) => handleRequest(request),
      POST: ({ request }) => handleRequest(request),
    },
  },
});
