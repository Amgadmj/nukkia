import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
// generateJson's schema must be a zod/v4 schema — see the note in ai.server.ts.
import { z as z4 } from "zod/v4";
import { AiError, generateJson } from "@/lib/ai.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { demoSchema } from "@/lib/quick-start";
import { briefIssues, firstPostBrief } from "@/lib/brand-preview";
import { checkAiQuota, quotaExceededResponse } from "@/lib/quota.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  postsPorSemana: z.number().int().min(1).max(14).nullable().optional(),
});

// Additive read typing while generated database types lack this existing table.
type WorkspaceDatabase = Database & {
  public: {
    Tables: {
      marketing_workspaces: {
        Row: { company_id: string; data: Json };
        Insert: { company_id: string; data: Json };
        Update: { company_id?: string; data?: Json };
        Relationships: [];
      };
    };
  };
};

const planSchema = z4.object({
  publicacoes: z4.array(
    z4.object({
      dia: z4.number().int(),
      canal: z4.enum(["instagram", "linkedin"]),
      formato: z4.enum(["post", "carrossel", "reels", "stories", "artigo"]),
      pilar: z4.string(),
      titulo: z4.string(),
      legenda: z4.string(),
      hashtags: z4.string(),
      cta: z4.string(),
    }),
  ),
});

export const Route = createFileRoute("/api/plano")({
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
          .select("id, name, segment")
          .eq("id", parsed.data.companyId)
          .maybeSingle();
        if (!company) return new Response("Empresa não encontrada", { status: 404 });

        const { data: brandKit } = await supabase
          .from("brand_kits")
          .select("tone")
          .eq("company_id", company.id)
          .maybeSingle();
        if (!brandKit) {
          return new Response("Defina a identidade da marca antes de gerar o plano.", {
            status: 409,
          });
        }

        const workspaceClient = supabase as unknown as SupabaseClient<WorkspaceDatabase>;
        const { data: workspace, error: workspaceError } = await workspaceClient
          .from("marketing_workspaces")
          .select("data")
          .eq("company_id", company.id)
          .maybeSingle();
        if (workspaceError) {
          console.error("[api/plano] workspace-read failed");
          return new Response(
            "Não foi possível carregar o contexto atual da marca. Tente novamente.",
            {
              status: 503,
            },
          );
        }

        let context: string[];
        if (workspace) {
          const current = demoSchema.safeParse(workspace.data);
          if (!current.success || briefIssues(current.data).length) {
            return new Response(
              "Revise e confirme o contexto atual da marca antes de gerar o plano.",
              {
                status: 409,
              },
            );
          }
          const brief = firstPostBrief(current.data);
          context = [
            `Empresa: ${brief.name}`,
            `Segmento: ${brief.segment}`,
            `Oferta confirmada: ${brief.offer}`,
            `Público confirmado: ${brief.audience}`,
            `Objetivo confirmado: ${brief.goal}`,
            `Detalhe confirmado: ${brief.detail}`,
            `Ação desejada: ${brief.action}`,
            `Destino da ação: ${brief.destination}`,
            ...(current.data.brand.customerQuestion.trim()
              ? [
                  `Dúvida informada: ${current.data.brand.customerQuestion}`,
                  `Resposta informada: ${current.data.brand.questionAnswer}`,
                ]
              : []),
          ];
        } else {
          // Only a successful lookup with no row permits legacy context.
          const { data: diagnostic, error: diagnosticError } = await supabase
            .from("diagnostics")
            .select("report")
            .eq("company_id", company.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (diagnosticError) {
            console.error("[api/plano] legacy-context-read failed");
            return new Response("Não foi possível carregar o contexto anterior da marca.", {
              status: 503,
            });
          }
          const report = (diagnostic?.report ?? {}) as { pilares?: string[]; resumo?: string };
          context = [
            `Empresa: ${company.name}`,
            `Segmento: ${company.segment ?? "não informado"}`,
            `Pilares: ${(report.pilares ?? []).join(", ") || "educacional, bastidores, prova social, oferta"}`,
            `Resumo do diagnóstico: ${report.resumo ?? "sem diagnóstico"}`,
          ];
        }

        const allowed = await checkAiQuota(supabase, company.id, "plano");
        if (!allowed) return quotaExceededResponse("plano");
        const frequencia = parsed.data.postsPorSemana ?? 3;

        let plan: z4.infer<typeof planSchema>;
        try {
          plan = await generateJson({
            schema: planSchema,
            instructions:
              "Você é estrategista de conteúdo para pequenas empresas brasileiras. Responda em português do Brasil. Crie o plano do próximo mês com 12 publicações no máximo, distribuídas entre os dias 1 e 28. Legendas de até 700 caracteres, hashtags em uma linha só, CTA curto. Use o contexto fornecido sem inventar ofertas, condições ou respostas ausentes. Nada de promessas de resultado em saúde.",
            input: [
              ...context,
              `Tom de voz: ${brandKit.tone ?? "profissional e acolhedor"}`,
              `Frequência desejada: ${frequencia} publicações por semana`,
            ].join("\n"),
          });
        } catch (err) {
          const message =
            "Não foi possível gerar o plano." +
            (err instanceof AiError ? ` ${err.userMessage}` : "");
          console.error("[api/plano] plan-generation failed");
          return new Response(message, { status: 502 });
        }

        if (plan.publicacoes.length === 0) {
          console.error("[api/plano] AI returned an empty plan");
          return new Response("A IA não retornou publicações. Tente novamente.", { status: 502 });
        }

        const hoje = new Date();
        const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
        const month = base.toISOString().slice(0, 10);

        // Idempotent: re-running "gerar plano do mês" for the same month
        // REPLACES that month's plan instead of duplicating it forever
        // (the previous version inserted-and-ignored-the-conflict-error,
        // producing an extra 12 items with plan_id=null on every click).
        const { data: planRow, error: planError } = await supabase
          .from("content_plans")
          .upsert(
            {
              company_id: company.id,
              month,
              frequency: { por_semana: frequencia },
              status: "draft",
            },
            { onConflict: "company_id,month" },
          )
          .select("id")
          .single();
        if (planError || !planRow) {
          console.error("[api/plano] plan-save failed");
          return new Response("Não foi possível salvar o plano.", { status: 500 });
        }

        const { error: deleteError } = await supabase
          .from("content_items")
          .delete()
          .eq("plan_id", planRow.id);
        if (deleteError) {
          console.error("[api/plano] plan-items-clear failed");
          return new Response("Não foi possível atualizar o plano.", { status: 500 });
        }

        const rows = plan.publicacoes.slice(0, 12).map((p) => {
          const dia = Math.max(1, Math.min(28, p.dia));
          const data = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia, 13, 0, 0));
          return {
            company_id: company.id,
            plan_id: planRow.id,
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

        const { error: insertError } = await supabase.from("content_items").insert(rows);
        if (insertError) {
          console.error("[api/plano] plan-items-save failed");
          return new Response("Falha ao salvar o plano.", { status: 500 });
        }

        return Response.json({ ok: true, total: rows.length });
      },
    },
  },
});
