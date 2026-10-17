import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { z } from "zod";
import { RotateCcw } from "lucide-react";
import { BrandOnboarding } from "@/components/brand-onboarding";
import { recoverResearch } from "@/lib/brand-preview";
import { useBrandResearch } from "@/lib/use-brand-research";
import { DemoWorkspace } from "@/components/demo-workspace";
import { type Answers } from "@/lib/onboarding";
import { changeDemoContext, demoSchema, type DemoData } from "@/lib/quick-start";
import "@/demo.css";
import { recordWorkspaceEvent, retainWorkspaceAchievements } from "@/lib/marketing-workspace";

export const Route = createFileRoute("/demo")({
  ssr: false,
  validateSearch: z.object({
    editar: z.enum(["contexto", "diagnostico"]).optional().catch(undefined),
    retorno: z
      .enum(["painel", "trilha", "cerebro", "conteudo", "marca", "redes", "metricas"])
      .optional()
      .catch("painel"),
    capitulo: z.coerce.number().int().min(0).max(4).optional().catch(undefined),
    vista: z
      .enum(["briefing", "peca", "abordagens", "saude", "biblioteca", "planejamento", "revisao"])
      .catch("briefing"),
    passo: z
      .number()
      .int()
      .min(-1)
      .max(6)
      .transform((step) => Math.max(0, step))
      .catch(0),
    aba: z
      .enum(["painel", "trilha", "cerebro", "conteudo", "marca", "redes", "metricas"])
      .catch("painel"),
  }),
  head: () => ({
    meta: [{ title: "Nukkia" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: DemoPage,
});

const STORAGE_KEY = "nukkia:walkthrough:v1";
const empty = () => demoSchema.parse({ name: "", answers: {} });
function restore() {
  try {
    const parsed = demoSchema.safeParse(
      JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null"),
    );
    if (parsed.success) {
      parsed.data.brand.research = recoverResearch(parsed.data.brand.research);
      return parsed.data;
    }
  } catch {
    /* The demo also works with browser storage disabled. */
  }
  return empty();
}

function DemoPage() {
  const { passo, aba, editar, retorno, capitulo, vista } = Route.useSearch();
  const navigate = useNavigate();
  const [data, setRawData] = useState(restore);
  const setData = useCallback<Dispatch<SetStateAction<DemoData>>>(
    (value) =>
      setRawData((previous) =>
        retainWorkspaceAchievements(
          previous,
          typeof value === "function" ? value(previous) : value,
        ),
      ),
    [],
  );
  const [storageAvailable, setStorageAvailable] = useState(true);
  const { research, cancel } = useBrandResearch(data, setData);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setStorageAvailable(false);
    }
  }, [data]);
  const setStep = (step: number) => {
    if (step < 0) {
      void navigate({ to: "/" });
      return;
    }
    if (step === 1) setData((current) => recordWorkspaceEvent(current, "started"));
    void navigate({ to: "/demo", search: { passo: step, aba: "painel" } });
  };
  const setAnswer = (key: keyof Answers, value: string) =>
    setData((previous) =>
      changeDemoContext(previous, { answers: { ...previous.answers, [key]: value } }),
    );
  return (
    <div className={passo < 6 ? "nukkia-workspace quick-demo" : "quick-demo-workspace"}>
      {passo < 6 && (
        <div className="quick-demo-label">
          <button
            title="Recomeçar configuração"
            aria-label="Recomeçar configuração"
            onClick={() => {
              cancel();
              setRawData(empty());
              void navigate({ to: "/demo", search: { passo: 0, aba: "painel" }, replace: true });
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      )}
      {!storageAvailable && (
        <p role="status" className="quick-storage-notice">
          Não foi possível salvar neste navegador. Atualizar a página pode apagar suas respostas.
        </p>
      )}
      {passo < 6 ? (
        <BrandOnboarding
          step={Math.min(passo, 3)}
          data={data}
          onData={setData}
          onStep={setStep}
          onResearch={research}
        />
      ) : (
        <DemoWorkspace
          data={data}
          onRestart={() => {
            cancel();
            setRawData(empty());
            void navigate({ to: "/demo", search: { passo: 0, aba: "painel" }, replace: true });
          }}
          onEditBrief={() =>
            void navigate({
              to: "/demo",
              search: { passo: 6, aba: "cerebro", editar: "contexto", retorno: aba, vista },
            })
          }
          editor={{ editar, retorno, capitulo }}
          onEditorReturn={() =>
            void navigate({ to: "/demo", search: { passo: 6, aba: retorno ?? "painel", vista } })
          }
          onEditorChapter={(chapter) =>
            void navigate({
              to: "/demo",
              search: {
                passo: 6,
                aba: "cerebro",
                editar: chapter === undefined ? "contexto" : "diagnostico",
                retorno: retorno ?? "painel",
                capitulo: chapter,
                vista,
              },
            })
          }
          onChooseApproach={() => setStep(3)}
          onData={setData}
          onAnswer={setAnswer}
          section={aba}
          contentView={vista}
          onContentView={(view) =>
            void navigate({ to: "/demo", search: { passo: 6, aba: "conteudo", vista: view } })
          }
          onSection={(section) =>
            void navigate({
              to: "/demo",
              search: {
                passo: 6,
                aba: section,
                vista: section === "conteudo" ? "briefing" : vista,
                ...(section === "marca" ? { retorno: aba } : {}),
              },
            })
          }
        />
      )}
    </div>
  );
}
