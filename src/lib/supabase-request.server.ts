import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Cliente Supabase autenticado como o usuário que fez a requisição (RLS
 * aplicada). A validade do token era deixada inteiramente para a API do
 * banco (uma consulta com token inválido simplesmente não retornava
 * linhas), o que faz um token expirado parecer "não encontrado" em vez de
 * "não autenticado". Um JWT bem formado é exigido aqui só como filtro
 * barato; a verificação real (assinatura, expiração) continua nas políticas
 * de RLS, que são a fonte de verdade de qualquer forma.
 */
export function userClientFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return null;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    console.error("[supabase-request] missing SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY");
    return null;
  }

  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
