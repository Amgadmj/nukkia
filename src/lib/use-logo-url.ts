import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ownedLogoPath } from "./logo-reference";
export function useLogoUrl(value: string | null, companyId?: string) {
  const path = companyId
    ? ownedLogoPath(value, import.meta.env["VITE_SUPABASE_URL"] ?? "", companyId)
    : null;
  const query = useQuery({
    queryKey: ["brand-logo-url", companyId, path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("brand-assets")
        .createSignedUrl(path!, 3600);
      if (error || !data?.signedUrl) throw new Error("Logo indisponível");
      return data.signedUrl;
    },
  });
  return {
    url: path ? (query.data ?? null) : value,
    error: Boolean(path && query.isError),
    loading: Boolean(path && query.isPending),
    retry: query.refetch,
  };
}
