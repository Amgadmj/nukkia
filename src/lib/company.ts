import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  employees: string | null;
  website: string | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  onboarding_step: string;
};

export function useCompany() {
  return useQuery({
    queryKey: ["company"],
    queryFn: async (): Promise<Company | null> => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Company | null) ?? null;
    },
  });
}

export function useDiagnostic(companyId?: string) {
  return useQuery({
    enabled: Boolean(companyId),
    queryKey: ["diagnostic", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostics")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useBrandKit(companyId?: string) {
  return useQuery({
    enabled: Boolean(companyId),
    queryKey: ["brand-kit", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_kits")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProgress(companyId?: string) {
  return useQuery({
    enabled: Boolean(companyId),
    queryKey: ["progress", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_progress")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMissions(companyId?: string) {
  return useQuery({
    enabled: Boolean(companyId),
    queryKey: ["missions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("company_id", companyId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
