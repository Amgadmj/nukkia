import { deleteOwnedAccount, purgeStorageTree } from "@/lib/account-data.server";
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

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await deleteOwnedAccount({
            companies: async () => {
              const { data, error } = await supabase
                .from("companies")
                .select("id")
                .eq("owner_id", userId);
              if (error || !data) throw new Error("Owned company query unavailable");
              return data.map((company) => company.id);
            },
            purge: async (companyId, bucket) => {
              const storage = supabaseAdmin.storage.from(bucket);
              return purgeStorageTree(
                {
                  list: async (prefix, offset) =>
                    storage.list(prefix, {
                      limit: 100,
                      offset,
                      sortBy: { column: "name", order: "asc" },
                    }),
                  remove: async (paths) => storage.remove(paths),
                },
                companyId,
              );
            },
            deleteUser: async () => {
              const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
              if (error) throw new Error("Account removal unavailable");
            },
          });
        } catch {
          return Response.json(
            {
              message:
                "A exclusão não foi concluída. A conta foi preservada; alguns arquivos podem já ter sido removidos. Tente novamente para concluir.",
            },
            { status: 503 },
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});
