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

const draftSchema = z4.object({
  segmento_sugerido: z4.string(),
  publico_alvo: z4.string(),
  mercado_concorrencia: z4.string(),
  diferenciais_provaveis: z4.string(),
  objetivos_provaveis: z4.string(),
  confianca: z4.enum(["alta", "media", "baixa"]),
});

/**
 * Two-phase onboarding, phase one: from just what the client typed at
 * signup (company name + optionally website/Instagram/LinkedIn — whatever
 * they already gave), draft plausible answers for the diagnostic questions
 * that would otherwise sit blank. The diagnostic form (client-side) shows
 * these as editable, clearly-labeled suggestions; the user corrects instead
 * of typing from scratch, and fills the field AI genuinely cannot infer
 * (segment-specific ethical/regulatory restrictions).
 *
 * IMPORTANT — this does not fetch the given URL/handles. It is the model's
 * own inference from the name/segment/handle strings, explicitly framed to
 * it as a draft to be revised, never asserted as fact. Actually fetching
 * the site/profile for grounding is tracked as a follow-up in
 * docs/ENGINEERING_PLAN.md: it needs the SSRF-hardened fetcher from the
 * security review (private-IP/DNS-rebinding guards, redirect limits, size
 * caps) before any user-supplied URL is fetched server-side — building that
 * fetcher just to skip it here would be exactly the kind of shortcut that
 * review exists to catch.
 */
export const Route = createFileRoute("/api/pesquisa-empresa")({
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
          .select("id, name, segment, employees, website, instagram_handle, linkedin_url")
          .eq("id", parsed.data.companyId)
          .maybeSingle();
        if (!company) return new Response("Empresa não encontrada", { status: 404 });

        if (!company.website && !company.instagram_handle && !company.linkedin_url) {
          return new Response(
            "Informe pelo menos o site, Instagram ou LinkedIn para a IA sugerir respostas.",
            { status: 400 },
          );
        }

        const allowed = await checkAiQuota(supabase, company.id, "pesquisa_empresa");
        if (!allowed) return quotaExceededResponse("pesquisa_empresa");

        let draft: z4.infer<typeof draftSchema>;
        try {
          draft = await generateJson({
            schema: draftSchema,
            instructions:
              "Você ajuda a pré-preencher um formulário de diagnóstico de marketing para uma pequena empresa " +
              "brasileira. Você NÃO tem acesso à internet e não visitou nenhum site ou perfil — trabalhe apenas " +
              "com o nome, segmento e identificadores informados, usando conhecimento geral de mercado sobre " +
              "esse tipo de negócio no Brasil. Gere hipóteses plausíveis e genéricas o suficiente para esse tipo " +
              "de empresa, nunca invente fatos específicos (números, prêmios, avaliações reais) como se fossem " +
              "confirmados. Se o nome/segmento não derem informação suficiente para um campo, responda de forma " +
              "genérica para o segmento e marque confianca como 'baixa'. Responda em português do Brasil, cada " +
              "campo com até 300 caracteres.",
            input: [
              `Nome da empresa: ${company.name}`,
              `Segmento informado: ${company.segment ?? "não informado"}`,
              `Número de funcionários: ${company.employees ?? "não informado"}`,
              `Site informado (não visitado): ${company.website ?? "não informado"}`,
              `Instagram informado (não visitado): ${company.instagram_handle ?? "não informado"}`,
              `LinkedIn informado (não visitado): ${company.linkedin_url ?? "não informado"}`,
            ].join("\n"),
          });
        } catch (err) {
          const message = err instanceof AiError ? err.userMessage : "Erro ao gerar sugestões.";
          if (!(err instanceof AiError))
            console.error("[api/pesquisa-empresa] unexpected error:", err);
          return new Response(message, { status: 502 });
        }

        const research = {
          generated_at: new Date().toISOString(),
          seed: {
            website: company.website,
            instagram_handle: company.instagram_handle,
            linkedin_url: company.linkedin_url,
          },
          draft,
        };

        const { error: updateError } = await supabase
          .from("companies")
          .update({ research })
          .eq("id", company.id);
        if (updateError) {
          console.error("[api/pesquisa-empresa] failed to save research:", updateError.message);
          return new Response("Não foi possível salvar as sugestões.", { status: 500 });
        }

        return Response.json({ ok: true, research });
      },
    },
  },
});
