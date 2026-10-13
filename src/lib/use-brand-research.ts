import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { recoverResearch, researchSchema } from "./brand-preview";
import { applyResearchToData } from "./brand-research";
import type { DemoData } from "./quick-start";
import { apiFetch } from "./api";

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
    void apiFetch(
      "/api/brand-preview",
      {
        action: "research",
        url,
        material,
        stream: true,
        siteAuthorized: data.brand.siteAuthorized,
        aiAuthorized: data.brand.aiAuthorized,
      },
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            typeof body?.message === "string"
              ? body.message.slice(0, 500)
              : "A leitura não está disponível agora.",
          );
        }
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
                message:
                  error instanceof Error &&
                  !["unavailable", "interrupted research", "oversized research"].includes(
                    error.message,
                  )
                    ? error.message.slice(0, 500)
                    : "A leitura da referência não está disponível agora. Continue com suas respostas ou cole o material da marca.",
              }),
            ),
          );
      });
  }
  return { research, cancel };
}
