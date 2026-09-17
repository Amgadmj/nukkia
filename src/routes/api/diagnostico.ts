import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AiError, generateJson } from "@/lib/ai.server";
import { checkAiQuota, quotaExceededResponse } from "@/lib/quota.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  answers: z.object({
    audience: z.string().max(1000),
    market: z.string().max(1000),
    offers: z.string().max(1000),
    differentials: z.string().max(1000),
    goals: z.string().max(1000),
    website: z.string().max(200),
    instagram: z.string().max(100),
    linkedin: z.string().max(200),
    restrictions: z.string().max(1000).optional(),
  }),
});

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "resumo",
    "pontos_fortes",
    "oportunidades",
    "recomendacoes",
    "pilares",
    "score",
    "missoes",
  ],
  properties: {
    resumo: { type: "string" },
    pontos_fortes: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
    recomendacoes: { type: "array", items: { type: "string" } },
    pilares: { type: "array", items: { type: "string" } },
    score: { type: "integer" },
    missoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "descricao", "categoria", "xp"],
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          categoria: { type: "string" },
          xp: { type: "integer" },
        },
      },
    },
  },
};

type Report = {
  resumo: string;
  pontos_fortes: string[];
  oportunidades: string[];
  recomendacoes: string[];
  pilares: string[];
  score: number;
  missoes: { titulo: string; descricao: string; categoria: string; xp: number }[];
};

export const Route = createFileRoute("/api/diagnostico")({
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

        const { data: company, error } = await supabase
          .from("companies")
          .select("id, name, segment, employees")
          .eq("id", parsed.data.companyId)
          .maybeSingle();
        if (error || !company) return new Response("Empresa não encontrada", { status: 404 });

        const allowed = await checkAiQuota(supabase, company.id, "diagnostico");
        if (!allowed) return quotaExceededResponse("diagnostico");

        const a = parsed.data.answers;
        let report: Report;
        try {
          report = await generateJson<Report>({
            schemaName: "diagnostico_presenca_digital",
            schema: reportSchema,
            // The one client-facing AI artifact worth the extra cost/latency
            // (per the mixed Gemini-tier decision — everything else uses "fast").
            tier: "quality",
            instructions:
              "Você é consultor sênior de marketing digital para pequenas empresas e clínicas no Brasil. Responda sempre em português do Brasil, com linguagem simples e acionável. Máximo de 5 itens por lista, cada item com até 220 caracteres. Gere de 5 a 7 missões prioritárias com XP entre 50 e 200. score é de 0 a 100. Se houver restrições éticas/regulatórias do segmento (ex.: CFM para clínicas, OAB para escritórios de advocacia), respeite-as nas recomendações e nunca sugira promessas de resultado.",
            input: [
              `Empresa: ${company.name}`,
              `Segmento: ${company.segment ?? "não informado"}`,
              `Funcionários: ${company.employees ?? "não informado"}`,
              `Público-alvo: ${a.audience}`,
              `Produtos/serviços: ${a.offers}`,
              `Mercado e concorrência: ${a.market}`,
              `Diferenciais: ${a.differentials}`,
              `Objetivos de 3 meses: ${a.goals}`,
              `Restrições éticas/regulatórias do segmento: ${a.restrictions || "não informado"}`,
              `Site: ${a.website || "não possui"}`,
              `Instagram: ${a.instagram || "não possui"}`,
              `LinkedIn: ${a.linkedin || "não possui"}`,
            ].join("\n"),
          });
        } catch (err) {
          const message = err instanceof AiError ? err.userMessage : "Erro na análise.";
          if (!(err instanceof AiError)) console.error("[api/diagnostico] unexpected error:", err);
          return new Response(message, { status: 502 });
        }

        if (!Array.isArray(report.missoes) || !Array.isArray(report.pontos_fortes)) {
          console.error("[api/diagnostico] AI report shape was unexpected:", report);
          return new Response("A IA retornou uma resposta inesperada. Tente novamente.", {
            status: 502,
          });
        }

        const score = Math.max(0, Math.min(100, Math.round(report.score)));

        const { error: insertError } = await supabase.from("diagnostics").insert({
          company_id: company.id,
          answers: a,
          report,
          score,
          status: "ready",
        });
        if (insertError) {
          console.error("[api/diagnostico] failed to save diagnostic:", insertError.message);
          return new Response("Não foi possível salvar o diagnóstico.", { status: 500 });
        }

        const { data: existing } = await supabase
          .from("missions")
          .select("id")
          .eq("company_id", company.id)
          .limit(1);

        if (!existing?.length) {
          const { error: missionsError } = await supabase.from("missions").insert(
            report.missoes.slice(0, 8).map((m, index) => ({
              company_id: company.id,
              title: m.titulo.slice(0, 160),
              description: m.descricao.slice(0, 500),
              category: m.categoria.slice(0, 60),
              xp: Math.max(10, Math.min(300, Math.round(m.xp))),
              order_index: index,
              status: "pending",
            })),
          );
          if (missionsError) {
            // The diagnostic itself is saved; missions are a bonus feature —
            // log and continue rather than fail the whole request.
            console.error("[api/diagnostico] failed to seed missions:", missionsError.message);
          }
        }

        return Response.json({ ok: true, score });
      },
    },
  },
});
