import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
// generateJson's schema must be a zod/v4 schema — see the note in ai.server.ts.
import { z as z4 } from "zod/v4";
import { AiError, generateJson } from "@/lib/ai.server";
import { checkAiQuota, quotaExceededResponse } from "@/lib/quota.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
});

const hexColor = z4
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar em formato hexadecimal (#RRGGBB)");

const paletteSchema = z4.object({
  paletas: z4
    .array(
      z4.object({
        nome: z4.string(),
        cores: z4.array(hexColor).length(4),
        justificativa: z4.string(),
      }),
    )
    .length(3),
});

/**
 * Replaces the old hardcoded 3-option palette list on /marca. Instead of
 * every company choosing between the same three fixed color sets
 * ("Confiança Clínica" / "Energia Moderna" / "Acolhimento Natural"
 * regardless of who they are), Claude proposes 3 palettes tailored to this
 * specific company's segment — reusing the onboarding research draft's
 * inferred segment when available, since that's already a richer signal
 * than the raw text field the user typed. Same shape the client already
 * knew how to render (buildStyleAnchor in content-engine reads
 * palette.cores/palette.nome either way), just generated instead of static.
 */
export const Route = createFileRoute("/api/paleta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = userClientFromRequest(request);
        if (!supabase) return new Response("Não autenticado", { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Corpo da requisição inválido", { status: 400 });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { data: company } = await supabase
          .from("companies")
          .select("id, name, segment, research")
          .eq("id", parsed.data.companyId)
          .maybeSingle();
        if (!company) return new Response("Empresa não encontrada", { status: 404 });

        const allowed = await checkAiQuota(supabase, company.id, "paleta");
        if (!allowed) return quotaExceededResponse("paleta");

        const research = company.research as { draft?: { segmento_sugerido?: string } } | null;

        let result: z4.infer<typeof paletteSchema>;
        try {
          result = await generateJson({
            schema: paletteSchema,
            instructions:
              "Você é diretor de arte especializado em identidade visual para pequenas empresas " +
              "brasileiras. Sugira exatamente 3 paletas de cores, claramente distintas entre si, " +
              "cada uma com exatamente 4 cores em formato hexadecimal (#RRGGBB): uma cor principal " +
              "de marca, uma de destaque/ação, uma de apoio e uma neutra clara para fundo. Garanta " +
              "contraste suficiente para uso em peças de redes sociais e legibilidade de texto sobre " +
              "essas cores. Cada paleta tem um nome curto e evocativo (até 4 palavras) e uma " +
              "justificativa objetiva de até 140 caracteres explicando por que combina com o " +
              "segmento informado. Responda em português do Brasil.",
            input: [
              `Empresa: ${company.name}`,
              `Segmento informado: ${company.segment ?? "não informado"}`,
              `Segmento sugerido pela pesquisa da IA (se disponível): ${
                research?.draft?.segmento_sugerido ?? "não disponível"
              }`,
            ].join("\n"),
          });
        } catch (err) {
          const message = err instanceof AiError ? err.userMessage : "Erro ao gerar paletas.";
          if (!(err instanceof AiError)) console.error("[api/paleta] unexpected error:", err);
          return new Response(message, { status: 502 });
        }

        // Persist as the brand kit's current option set so a page reload
        // doesn't re-spend a quota unit. Only `options` is written here —
        // Supabase upsert only touches the columns given, so an existing
        // logo/palette/tone/fonts selection is left untouched.
        const { error: upsertError } = await supabase
          .from("brand_kits")
          .upsert(
            { company_id: company.id, options: result.paletas },
            { onConflict: "company_id" },
          );
        if (upsertError) {
          console.error("[api/paleta] failed to save palette options:", upsertError.message);
          return new Response("Não foi possível salvar as paletas geradas.", { status: 500 });
        }

        return Response.json({ ok: true, paletas: result.paletas });
      },
    },
  },
});
