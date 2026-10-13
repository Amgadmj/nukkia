import { supabase } from "@/integrations/supabase/client";

export async function apiFetch(
  path: string,
  body?: unknown,
  options?: { method?: "POST" | "DELETE" | "GET"; signal?: AbortSignal },
) {
  const { data } = await supabase.auth.getSession();
  return fetch(path, {
    method: options?.method ?? "POST",
    signal: options?.signal ?? null,
    headers: {
      "Content-Type": "application/json",
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
}
