import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Whether the signed-in user has the `admin` role. Reads `user_roles`
 * directly with the user's own client — no service role, no RPC — RLS's
 * "users read own roles" policy already lets a user see their own row, and
 * that's the only row this ever needs.
 */
export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
