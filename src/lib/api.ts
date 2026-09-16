import { supabase } from "@/integrations/supabase/client";

export async function apiFetch(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  return fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
