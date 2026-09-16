import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateJson } from "@/lib/ai.server";
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
  }),
});

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "pontos_fortes", "oportunidades", "recomendacoes", "pilares", "score", "missoes"],
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

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { data: company, error } = await supabase
          .from("companies")
          .select("id, name, segment, employees")
          .eq("id", parsed.data.companyId)
          .maybeSingle();
        if (error || !company) return new Response("Empresa não encontrada", { status: 404 });

        const a = parsed.data.answers;
        let report: Report;
        try {
          report = await generateJson<Report>({
            schemaName: "diagnostico_presenca_digital",
            schema: reportSchema,
            instructions:
              "Você é consultor sênior de marketing digital para pequenas empresas e clínicas no Brasil. Responda sempre em português do Brasil, com linguagem simples e acionável. Máximo de 5 itens por lista, cada item com até 220 caracteres. Gere de 5 a 7 missões prioritárias com XP entre 50 e 200. score é de 0 a 100.",
            input: [
              `Empresa: ${company.name}`,
              `Segmento: ${company.segment ?? "não informado"}`,
              `Funcionários: ${company.employees ?? "não informado"}`,
              `Público-alvo: ${a.audience}`,
              `Produtos/serviços: ${a.offers}`,
              `Mercado e concorrência: ${a.market}`,
              `Diferenciais: ${a.differentials}`,
              `Objetivos de 3 meses: ${a.goals}`,
              `Site: ${a.website || "não possui"}`,
              `Instagram: ${a.instagram || "não possui"}`,
              `LinkedIn: ${a.linkedin || "não possui"}`,
            ].join("\n"),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro na análise";
          return new Response(message, { status: 502 });
        }

        const score = Math.max(0, Math.min(100, Math.round(report.score)));

        await supabase.from("diagnostics").insert({
          company_id: company.id,
          answers: a,
          report,
          score,
          status: "ready",
        });

        const { data: existing } = await supabase
          .from("missions")
          .select("id")
          .eq("company_id", company.id)
          .limit(1);

        if (!existing?.length) {
          await supabase.from("missions").insert(
            report.missoes.slice(0, 8).map((m, index) => ({
              company_id: company.id,
              title: m.titulo.slice(0, 160),
              description: m.descricao.slice(0, 500),
              category: m.categoria.slice(0, 60),
              xp: Math.max(10, Math.min(300, Math.round(m.xp))),
              order_index: index,
              status: "todo",
            })),
          );
          await supabase
            .from("user_progress")
            .upsert({ company_id: company.id }, { onConflict: "company_id" });
        }

        return Response.json({ ok: true, score });
      },
    },
  },
});
