import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateJson } from "@/lib/ai.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  postsPorSemana: z.number().int().min(1).max(14).nullable().optional(),
});

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["publicacoes"],
  properties: {
    publicacoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dia", "canal", "formato", "pilar", "titulo", "legenda", "hashtags", "cta"],
        properties: {
          dia: { type: "integer" },
          canal: { type: "string", enum: ["instagram", "linkedin"] },
          formato: { type: "string", enum: ["post", "carrossel", "reels", "stories", "artigo"] },
          pilar: { type: "string" },
          titulo: { type: "string" },
          legenda: { type: "string" },
          hashtags: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
  },
};

type Plan = {
  publicacoes: {
    dia: number;
    canal: string;
    formato: string;
    pilar: string;
    titulo: string;
    legenda: string;
    hashtags: string;
    cta: string;
  }[];
};

export const Route = createFileRoute("/api/plano")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = userClientFromRequest(request);
        if (!supabase) return new Response("Não autenticado", { status: 401 });

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { data: company } = await supabase
          .from("companies")
          .select("id, name, segment")
          .eq("id", parsed.data.companyId)
          .maybeSingle();
        if (!company) return new Response("Empresa não encontrada", { status: 404 });

        const { data: brandKit } = await supabase
          .from("brand_kits")
          .select("tone, palette")
          .eq("company_id", company.id)
          .maybeSingle();

        const { data: diagnostic } = await supabase
          .from("diagnostics")
          .select("report")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const report = (diagnostic?.report ?? {}) as { pilares?: string[]; resumo?: string };
        const frequencia = parsed.data.postsPorSemana ?? 3;

        let plan: Plan;
        try {
          plan = await generateJson<Plan>({
            schemaName: "plano_mensal_conteudo",
            schema: planSchema,
            instructions:
              "Você é estrategista de conteúdo para pequenas empresas brasileiras. Responda em português do Brasil. Crie o plano do próximo mês com 12 publicações no máximo, distribuídas entre os dias 1 e 28. Legendas de até 700 caracteres, hashtags em uma linha só, CTA curto. Nada de promessas de resultado em saúde.",
            input: [
              `Empresa: ${company.name}`,
              `Segmento: ${company.segment ?? "não informado"}`,
              `Tom de voz: ${brandKit?.tone ?? "profissional e acolhedor"}`,
              `Pilares: ${(report.pilares ?? []).join(", ") || "educacional, bastidores, prova social, oferta"}`,
              `Resumo do diagnóstico: ${report.resumo ?? "sem diagnóstico"}`,
              `Frequência desejada: ${frequencia} publicações por semana`,
            ].join("\n"),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro ao planejar";
          return new Response(message, { status: 502 });
        }

        const hoje = new Date();
        const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));

        const { data: planRow } = await supabase
          .from("content_plans")
          .insert({
            company_id: company.id,
            month: base.toISOString().slice(0, 10),
            frequency: { por_semana: frequencia },
            status: "draft",
          })
          .select("id")
          .maybeSingle();

        const rows = plan.publicacoes.slice(0, 12).map((p) => {
          const dia = Math.max(1, Math.min(28, p.dia));
          const data = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia, 13, 0, 0));
          return {
            company_id: company.id,
            plan_id: planRow?.id ?? null,
            scheduled_for: data.toISOString(),
            channel: p.canal,
            format: p.formato,
            pillar: p.pilar.slice(0, 80),
            title: p.titulo.slice(0, 160),
            caption: p.legenda.slice(0, 2000),
            hashtags: p.hashtags.slice(0, 400),
            cta: p.cta.slice(0, 160),
            status: "draft",
          };
        });

        const { error } = await supabase.from("content_items").insert(rows);
        if (error) return new Response("Falha ao salvar o plano", { status: 500 });

        return Response.json({ ok: true, total: rows.length });
      },
    },
  },
});
