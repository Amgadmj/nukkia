import { createFileRoute } from "@tanstack/react-router";
import { userClientFromRequest } from "@/lib/supabase-request.server";

/**
 * LGPD self-serve account deletion. Purges storage first (buckets aren't
 * covered by the DB's ON DELETE CASCADE), then deletes the auth user via
 * the admin API, which cascades every DB row (companies.owner_id and
 * profiles.id both REFERENCE auth.users ON DELETE CASCADE — see the first
 * migration — which takes every child table with them).
 *
 * `supabaseAdmin` is dynamically imported, not imported at module scope:
 * this file is a route file and ships to the client bundle; a top-level
 * import of the service-role client would pull it in too (see the warning
 * in src/integrations/supabase/client.server.ts).
 */
export const Route = createFileRoute("/api/conta")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const supabase = userClientFromRequest(request);
        if (!supabase) return new Response("Não autenticado", { status: 401 });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) return new Response("Não autenticado", { status: 401 });
        const userId = userData.user.id;

        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", userId);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        for (const company of companies ?? []) {
          for (const bucket of ["brand-assets", "content-media"] as const) {
            const { data: files } = await supabaseAdmin.storage.from(bucket).list(company.id);
            if (files?.length) {
              const paths = files.map((f) => `${company.id}/${f.name}`);
              const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths);
              if (removeError) {
                console.error(
                  `[api/conta] failed to purge ${bucket}/${company.id}:`,
                  removeError.message,
                );
              }
            }
          }
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.error("[api/conta] failed to delete user:", deleteError.message);
          return new Response("Não foi possível excluir a conta. Tente novamente.", {
            status: 500,
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
