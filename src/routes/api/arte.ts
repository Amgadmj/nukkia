import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateImageBase64 } from "@/lib/ai.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});

export const Route = createFileRoute("/api/arte")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = userClientFromRequest(request);
        if (!supabase) return new Response("Não autenticado", { status: 401 });

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { data: item } = await supabase
          .from("content_items")
          .select("id, company_id, title, caption, format, pillar")
          .eq("id", parsed.data.contentItemId)
          .maybeSingle();
        if (!item || item.company_id !== parsed.data.companyId) {
          return new Response("Publicação não encontrada", { status: 404 });
        }

        const { data: company } = await supabase
          .from("companies")
          .select("name, segment")
          .eq("id", item.company_id)
          .maybeSingle();

        const { data: brandKit } = await supabase
          .from("brand_kits")
          .select("palette, tone")
          .eq("company_id", item.company_id)
          .maybeSingle();

        const palette = (brandKit?.palette ?? null) as { cores?: string[]; nome?: string } | null;
        const cores = palette?.cores?.join(", ") ?? "#2A0845, #3B82F6, #06B6D4, #F8FAFC";

        const prompt = [
          `Peça publicitária quadrada para redes sociais da empresa ${company?.name ?? ""}.`,
          `Segmento: ${company?.segment ?? "serviços"}.`,
          `Tema da publicação: ${item.title}.`,
          `Formato: ${item.format}. Pilar: ${item.pillar ?? "educacional"}.`,
          `Use exatamente esta paleta de cores: ${cores}.`,
          `Estilo: design profissional, limpo, moderno, com bastante respiro, gradientes sutis e composição centrada.`,
          `Inclua um título curto em português do Brasil, legível, com no máximo 6 palavras: "${item.title.slice(0, 60)}".`,
          `Sem marcas d'água, sem textos sem sentido, sem rostos distorcidos.`,
        ].join(" ");

        let b64: string;
        try {
          b64 = await generateImageBase64(prompt);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Erro na arte", { status: 502 });
        }

        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const path = `${item.company_id}/${item.id}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from("content-media")
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (uploadError) return new Response("Falha ao salvar a arte", { status: 500 });

        const { data: signed } = await supabase.storage
          .from("content-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = signed?.signedUrl;
        if (!url) return new Response("Falha ao publicar a arte", { status: 500 });

        await supabase.from("content_items").update({ image_url: url }).eq("id", item.id);

        return Response.json({ ok: true, url });
      },
    },
  },
});
