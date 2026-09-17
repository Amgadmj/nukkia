import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { userClientFromRequest } from "@/lib/supabase-request.server";

type ExportableTable =
  | "diagnostics"
  | "brand_kits"
  | "missions"
  | "user_progress"
  | "content_plans"
  | "content_items"
  | "social_accounts";

async function byCompany(
  supabase: SupabaseClient<Database>,
  table: ExportableTable,
  companyIds: string[],
): Promise<Record<string, unknown>[]> {
  if (companyIds.length === 0) return [];
  const { data } = await supabase.from(table).select("*").in("company_id", companyIds);
  return data ?? [];
}

/**
 * LGPD Art. 18 data portability: every row tied to the caller's company/
 * companies, as one JSON file. Same identity pattern as DELETE /api/conta —
 * the caller's own token, RLS does the actual scoping (every table here is
 * `owns_company(company_id)`-gated), so this can only ever return the
 * requester's own data.
 */
export const Route = createFileRoute("/api/exportar-dados")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const supabase = userClientFromRequest(request);
        if (!supabase) return new Response("Não autenticado", { status: 401 });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) return new Response("Não autenticado", { status: 401 });

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userData.user.id)
          .maybeSingle();

        const { data: companies } = await supabase
          .from("companies")
          .select("*")
          .eq("owner_id", userData.user.id);

        const companyIds = (companies ?? []).map((c) => c.id);

        const [
          diagnostics,
          brandKits,
          missions,
          progress,
          contentPlans,
          contentItems,
          socialAccounts,
        ] = await Promise.all([
          byCompany(supabase, "diagnostics", companyIds),
          byCompany(supabase, "brand_kits", companyIds),
          byCompany(supabase, "missions", companyIds),
          byCompany(supabase, "user_progress", companyIds),
          byCompany(supabase, "content_plans", companyIds),
          byCompany(supabase, "content_items", companyIds),
          byCompany(supabase, "social_accounts", companyIds), // provider/username/status only — tokens live server-only
        ]);

        const payload = {
          exported_at: new Date().toISOString(),
          account: { id: userData.user.id, email: userData.user.email },
          profile,
          companies,
          diagnostics,
          brand_kits: brandKits,
          missions,
          user_progress: progress,
          content_plans: contentPlans,
          content_items: contentItems,
          social_accounts: socialAccounts,
        };

        return new Response(JSON.stringify(payload, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="nukkia-dados-${userData.user.id}.json"`,
          },
        });
      },
    },
  },
});
