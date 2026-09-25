import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { answersSchema, normalizeAnswers } from "@/lib/onboarding";
import { userClientFromRequest } from "@/lib/supabase-request.server";

// Local additive typing until generated database types are refreshed after activation.
type DraftRow = {
  company_id: string;
  owner_id: string;
  draft: Json | null;
  revision: string;
  updated_at: string;
};
type DraftDatabase = Database & {
  public: {
    Tables: {
      onboarding_drafts: {
        Row: DraftRow;
        Insert: Omit<DraftRow, "updated_at">;
        Update: Partial<DraftRow>;
        Relationships: [];
      };
    };
  };
};
const identitySchema = z.object({ companyId: z.string().uuid() });
const mutationSchema = identitySchema.extend({ baseRevision: z.string().uuid().nullable() });
const draftSchema = z.object({
  version: z.literal(1),
  // Validate limits without trimming/replacing the user's in-progress text.
  answers: z
    .record(z.string().max(1000))
    .refine((value) => Object.keys(value).length <= 40 && answersSchema.safeParse(value).success)
    .transform(normalizeAnswers),
  step: z.number().int().min(0).max(4),
});
const saveSchema = mutationSchema.extend({ draft: draftSchema });
const columns = "company_id, owner_id, draft, revision, updated_at";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
function failure(error: { code?: string }) {
  const missing = error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204";
  return json({ code: missing ? "schema-unavailable" : "unavailable" }, 503);
}
function payload(row: DraftRow | null) {
  return {
    draft: row ? { draft: row.draft, revision: row.revision, updatedAt: row.updated_at } : null,
  };
}

export async function handleDraftRequest(request: Request): Promise<Response> {
  try {
    const supabase = userClientFromRequest(request);
    if (!supabase) return json({ code: "unauthenticated" }, 401);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ code: "unauthenticated" }, 401);

    let input: unknown;
    try {
      input =
        request.method === "GET"
          ? { companyId: new URL(request.url).searchParams.get("companyId") }
          : await request.json();
    } catch {
      return json({ code: "invalid-input" }, 400);
    }
    const parsed = (request.method === "GET" ? identitySchema : mutationSchema).safeParse(input);
    if (!parsed.success) return json({ code: "invalid-input" }, 400);
    const companyId = parsed.data.companyId;
    const ownerId = auth.user.id;
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (companyError) return failure(companyError);
    if (!company) return json({ code: "not-found" }, 404);

    // This is the same request-scoped client, with the caller's JWT and RLS.
    const db = supabase as unknown as SupabaseClient<DraftDatabase>;
    if (request.method === "GET") {
      const { data, error } = await db
        .from("onboarding_drafts")
        .select(columns)
        .eq("company_id", companyId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      return error ? failure(error) : json(payload(data));
    }
    const mutation = mutationSchema.parse(input);
    const saved = request.method === "POST" ? saveSchema.safeParse(input) : null;
    if (saved && !saved.success) return json({ code: "invalid-input" }, 400);
    if (request.method !== "POST" && request.method !== "DELETE")
      return json({ code: "method-not-allowed" }, 405);
    const values = {
      company_id: companyId,
      owner_id: ownerId,
      draft: saved?.success ? saved.data.draft : null,
      revision: crypto.randomUUID(),
    };
    // Compare-and-swap, never upsert: stale writes cannot silently replace newer drafts.
    const result =
      mutation.baseRevision === null
        ? await db.from("onboarding_drafts").insert(values).select(columns).maybeSingle()
        : await db
            .from("onboarding_drafts")
            .update(values)
            .eq("company_id", companyId)
            .eq("owner_id", ownerId)
            .eq("revision", mutation.baseRevision)
            .select(columns)
            .maybeSingle();
    if (result.error && result.error.code !== "23505") return failure(result.error);
    if (result.error || !result.data) return json({ code: "conflict" }, 409);
    return json(payload(result.data));
  } catch {
    return json({ code: "unavailable" }, 503);
  }
}

export const Route = createFileRoute("/api/onboarding-draft")({
  server: {
    handlers: {
      GET: ({ request }) => handleDraftRequest(request),
      POST: ({ request }) => handleDraftRequest(request),
      DELETE: ({ request }) => handleDraftRequest(request),
    },
  },
});
