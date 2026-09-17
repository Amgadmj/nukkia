import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, useMissions, useProgress } from "@/lib/company";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trilha")({
  head: () => ({
    meta: [
      { title: "Trilha de evolução | Nukkia" },
      {
        name: "description",
        content:
          "Missões prioritárias para evoluir sua presença digital e ganhar pontos de experiência.",
      },
      { property: "og:title", content: "Trilha de evolução | Nukkia" },
      { property: "og:description", content: "Missões, conquistas e XP da sua marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Trilha,
});

function Trilha() {
  const { data: company } = useCompany();
  const { data: missions } = useMissions(company?.id);
  const { data: progress } = useProgress(company?.id);
  const queryClient = useQueryClient();

  const xp = progress?.xp ?? 0;
  const level = progress?.level ?? 1;
  const nextLevelXp = level * 500;

  async function concluir(mission: { id: string; xp: number; status: string }) {
    if (!company || mission.status === "done") return;
    // XP/level are computed atomically in the database (complete_mission),
    // not read-modify-written from possibly-stale cached XP here — the old
    // client-side version could lose XP when two missions were completed in
    // quick succession, and let any signed-in user set their own XP by
    // calling the table update directly.
    const { error } = await supabase.rpc("complete_mission", { _mission_id: mission.id });
    if (error) {
      toast.error("Não foi possível concluir a missão.");
      return;
    }
    toast.success(`Missão concluída! +${mission.xp} XP`);
    queryClient.invalidateQueries({ queryKey: ["missions", company.id] });
    queryClient.invalidateQueries({ queryKey: ["progress", company.id] });

    // First mission completed → the onboarding stepper's next suggested
    // stop is Conteúdo. Only advance forward, never overwrite a later step.
    if (company.onboarding_step === "missions") {
      await supabase.from("companies").update({ onboarding_step: "content" }).eq("id", company.id);
      queryClient.invalidateQueries({ queryKey: ["company"] });
    }
  }

  if (!company) {
    return <p className="text-muted-foreground">Cadastre sua empresa no painel para começar.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="surface-glow">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Trophy className="size-4 text-accent" /> Seu progresso
          </CardDescription>
          <CardTitle className="text-2xl">
            Nível {level} · {xp} XP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(100, (xp / nextLevelXp) * 100)} />
          <p className="mt-2 text-xs text-muted-foreground">
            Faltam {Math.max(0, nextLevelXp - xp)} XP para o nível {level + 1}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(missions ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Finalize o diagnóstico para receber suas missões prioritárias.
          </p>
        )}
        {(missions ?? []).map((mission) => {
          const done = mission.status === "done";
          return (
            <Card key={mission.id} className={cn(done && "opacity-70")}>
              <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                {done ? (
                  <CheckCircle2 className="size-6 shrink-0 text-accent" />
                ) : (
                  <Circle className="size-6 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{mission.title}</p>
                    {mission.category && <Badge variant="secondary">{mission.category}</Badge>}
                    <Badge>{mission.xp} XP</Badge>
                  </div>
                  {mission.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{mission.description}</p>
                  )}
                </div>
                <Button
                  variant={done ? "outline" : "default"}
                  disabled={done}
                  onClick={() => concluir(mission)}
                >
                  {done ? "Concluída" : "Concluir"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
