import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { recoverResearch, researchSchema } from "./brand-preview";
import { applyResearchToData } from "./brand-research";
import type { DemoData } from "./quick-start";
import { supabase } from "@/integrations/supabase/client";

const UNAVAILABLE_MESSAGE =
  "A leitura da referência não está disponível agora. Continue com suas respostas ou cole o material da marca.";
// The public /demo has no session: reading a site needs an account, but manual
// answers and pasted material keep working without it.
const SIGNED_OUT_MESSAGE =
  "Entre na sua conta para ler o site automaticamente. Você pode continuar preenchendo manualmente ou colar o material da marca.";
const RATE_LIMITED_MESSAGE =
  "Há uma leitura em andamento. Aguarde um instante e tente novamente, ou continue manualmente.";
class ReadingRefused extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super("reading refused");
    this.userMessage = userMessage;
  }
}
async function accessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function useBrandResearch(data: DemoData, setData: Dispatch<SetStateAction<DemoData>>) {
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (request.current && !request.current.signal.aborted) {
      request.current.abort();
      setData((current) => ({
        ...current,
        brand: { ...current.brand, research: recoverResearch(current.brand.research) },
      }));
    }
  }, [
    data.brand.referenceUrl,
    data.brand.material,
    data.brand.siteAuthorized,
    data.brand.aiAuthorized,
    setData,
  ]);
  const cancel = () => request.current?.abort();
  function research() {
    cancel();
    const controller = new AbortController();
    request.current = controller;
    const url = data.brand.referenceUrl,
      material = data.brand.material;
    if (!url.trim() && !material.trim()) return;
    setData((current) => ({
      ...current,
      brand: { ...current.brand, research: researchSchema.parse({ status: "loading" }) },
    }));
    void accessToken()
      .then((token) => {
        controller.signal.throwIfAborted();
        return fetch("/api/brand-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: "research",
            url,
            material,
            stream: true,
            siteAuthorized: data.brand.siteAuthorized,
            aiAuthorized: data.brand.aiAuthorized,
          }),
          signal: controller.signal,
        });
      })
      .then(async (response) => {
        if (response.status === 401) throw new ReadingRefused(SIGNED_OUT_MESSAGE);
        if (response.status === 429) throw new ReadingRefused(RATE_LIMITED_MESSAGE);
        if (!response.ok) throw new Error("unavailable");
        if (!response.body) throw new Error("unavailable");
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "",
          completed = false;
        try {
          while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            if (buffer.length > 2000000) throw new Error("oversized research");
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            if (done && buffer.trim()) lines.push(buffer);
            for (const line of lines)
              if (line.trim()) {
                const result = researchSchema.parse(JSON.parse(line).research);
                completed = result.phase === "complete";
                if (!controller.signal.aborted)
                  setData((current) => applyResearchToData(current, { url, material }, result));
              }
            if (done) break;
          }
          if (!completed && !controller.signal.aborted) throw new Error("interrupted research");
        } finally {
          reader.releaseLock();
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setData((current) =>
            applyResearchToData(
              current,
              { url, material },
              researchSchema.parse({
                ...current.brand.research,
                status: current.brand.research.sources.length ? "ready" : "unavailable",
                phase: "complete",
                message: error instanceof ReadingRefused ? error.userMessage : UNAVAILABLE_MESSAGE,
              }),
            ),
          );
      });
  }
  return { research, cancel };
}
