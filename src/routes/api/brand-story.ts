import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import type { Database } from "@/integrations/supabase/types";
import { userClientFromRequest } from "@/lib/supabase-request.server";
import {
  BRAND_STORY_UNAVAILABLE,
  brandStorySchema,
  isBrandStoryUnavailable,
  type BrandStory,
} from "@/lib/brand-story";

// Local schema extension until the separate migration is activated and types
// are regenerated. All access uses the caller's request-scoped RLS client.
type StoryDatabase = Database & {
  public: {
    Tables: {
      brand_stories: {
        Row: BrandStory & { company_id: string; updated_at: string };
        Insert: BrandStory & { company_id: string };
        Update: Partial<BrandStory>;
        Relationships: [];
      };
    };
  };
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export const Route = createFileRoute("/api/brand-story")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const client = userClientFromRequest(request);
        if (!client) return json({ message: "Não autenticado" }, 401);
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) return json({ message: "Não autenticado" }, 401);

        const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("companyId"));
        if (!id.success) return json({ message: "Empresa inválida" }, 400);
        const { data: company, error: companyError } = await client
          .from("companies")
          .select("id")
          .eq("id", id.data)
          .maybeSingle();
        if (companyError) return json({ message: "Não foi possível consultar a empresa." }, 500);
        if (!company) return json({ message: "Empresa não encontrada" }, 404);

        const { data, error } = await (client as unknown as SupabaseClient<StoryDatabase>)
          .from("brand_stories")
          .select("manifesto, mission, vision, values, updated_at")
          .eq("company_id", id.data)
          .maybeSingle();
        if (error) {
          return isBrandStoryUnavailable(error)
            ? json({ code: "BRAND_STORY_UNAVAILABLE", message: BRAND_STORY_UNAVAILABLE }, 503)
            : json({ message: "Não foi possível carregar a história salva." }, 500);
        }
        if (!data) return json({ story: null, updatedAt: null });
        const parsed = brandStorySchema.safeParse({
          manifesto: data.manifesto,
          mission: data.mission,
          vision: data.vision,
          values: data.values,
        });
        if (!parsed.success)
          return json({ message: "A história salva tem um formato inválido." }, 500);
        return json({ story: parsed.data, updatedAt: data.updated_at });
      },
      POST: async ({ request }) => {
        const client = userClientFromRequest(request);
        if (!client) return json({ message: "Não autenticado" }, 401);
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) return json({ message: "Não autenticado" }, 401);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ message: "Corpo da requisição inválido" }, 400);
        }
        const parsed = z
          .strictObject({
            action: z.literal("save"),
            companyId: z.string().uuid(),
            story: brandStorySchema,
          })
          .safeParse(body);
        if (!parsed.success)
          return json({ message: "Confira o manifesto, missão, visão e valores." }, 400);
        const { companyId, story } = parsed.data;
        const { data: company, error: companyError } = await client
          .from("companies")
          .select("id")
          .eq("id", companyId)
          .maybeSingle();
        if (companyError) return json({ message: "Não foi possível consultar a empresa." }, 500);
        if (!company) return json({ message: "Empresa não encontrada" }, 404);

        const stories = (client as unknown as SupabaseClient<StoryDatabase>).from("brand_stories");
        const { error: availabilityError } = await stories
          .select("company_id")
          .eq("company_id", companyId)
          .maybeSingle();
        if (availabilityError) {
          return isBrandStoryUnavailable(availabilityError)
            ? json({ code: "BRAND_STORY_UNAVAILABLE", message: BRAND_STORY_UNAVAILABLE }, 503)
            : json({ message: "Não foi possível acessar a história salva." }, 500);
        }
        const { data: saved, error } = await stories
          .upsert({ company_id: companyId, ...story }, { onConflict: "company_id" })
          .select("updated_at")
          .single();
        if (error)
          return json(
            { message: "Não foi possível salvar a história. Seu texto continua no editor." },
            500,
          );
        return json({ story, updatedAt: saved.updated_at });
      },
    },
  },
});
