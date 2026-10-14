import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { userClientFromRequest } from "@/lib/supabase-request.server";

export type AdminContext = {
  userId: string;
  /** The caller's own client; RLS still applies to it. */
  user: SupabaseClient<Database>;
};

/**
 * Confirms the request comes from a signed-in user with the `admin` role.
 * The role is read with the caller's own token through `has_role`, so a
 * forged request body or header cannot grant it. Every /api/admin route
 * calls this first; only after it succeeds may a route use the service role.
 */
export async function requireAdmin(
  request: Request,
): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: Response }> {
  const user = userClientFromRequest(request);
  if (!user) return { ok: false, response: new Response("Não autenticado", { status: 401 }) };
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: new Response("Não autenticado", { status: 401 }) };
  }
  const { data: isAdmin, error: roleError } = await user.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) {
    return { ok: false, response: new Response("Acesso restrito", { status: 403 }) };
  }
  return { ok: true, ctx: { userId: data.user.id, user } };
}
