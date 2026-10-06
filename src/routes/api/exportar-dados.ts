import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClientFromRequest } from "@/lib/supabase-request.server";
import { collectAccountData } from "@/lib/account-data.server";

export const Route = createFileRoute("/api/exportar-dados")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const client = userClientFromRequest(request);
        if (!client) return new Response("Não autenticado", { status: 401 });
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) return new Response("Não autenticado", { status: 401 });
        try {
          // Same user JWT and RLS, including stores not yet present in generated DB types.
          const db = client as SupabaseClient;
          const result = await collectAccountData(
            data.user.id,
            async (table, field, values, offset, limit) => {
              const { data, error } = await db
                .from(table)
                .select("*")
                .in(field, values)
                .order(
                  [
                    "marketing_workspaces",
                    "onboarding_drafts",
                    "brand_stories",
                    "user_progress",
                  ].includes(table)
                    ? "company_id"
                    : "id",
                  { ascending: true },
                )
                .range(offset, offset + limit - 1);
              return { data, error };
            },
          );
          const payload = {
            exported_at: new Date().toISOString(),
            account: { id: data.user.id, email: data.user.email },
            ...result.records,
            export_status: {
              complete: result.complete,
              unavailable: result.unavailable,
              scope:
                "Registros das empresas de sua propriedade. Arquivos binários, cópias de provedores externos e catálogos locais do navegador não estão incluídos.",
            },
          };
          return new Response(JSON.stringify(payload, null, 2), {
            status: result.complete ? 200 : 206,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, no-store",
              "Content-Disposition": 'attachment; filename="nukkia-dados.json"',
            },
          });
        } catch {
          return Response.json(
            {
              message: "Não foi possível consultar suas empresas. A exportação não foi concluída.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
