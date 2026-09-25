import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { z } from "zod";
import { ArrowRight, RotateCcw } from "lucide-react";
import { OnboardingMark } from "@/components/quick-start-flow";
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
    passo: z.number().int().min(-1).max(6).catch(-1),
    aba: z
      .enum(["painel", "trilha", "cerebro", "conteudo", "marca", "redes", "metricas"])
      .catch("painel"),
  }),
  head: () => ({
    meta: [
      { title: "Sua primeira experiência | Nukkia Demo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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
  const { passo, aba, editar, retorno, capitulo } = Route.useSearch();
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
  const setStep = (step: number) =>
    void navigate({ to: "/demo", search: { passo: step, aba: "painel" } });
  const setAnswer = (key: keyof Answers, value: string) =>
    setData((previous) =>
      changeDemoContext(previous, { answers: { ...previous.answers, [key]: value } }),
    );
  return (
    <div className={passo < 6 ? "nukkia-workspace dark quick-demo" : "quick-demo-workspace"}>
      {passo < 6 && (
        <div className="quick-demo-label">
          <button
            title="Recomeçar demonstração"
            aria-label="Recomeçar demonstração"
            onClick={() => {
              cancel();
              setRawData(empty());
              void navigate({ to: "/demo", search: { passo: -1, aba: "painel" }, replace: true });
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      )}
      {!storageAvailable && (
        <p role="status" className="quick-storage-notice">
          Suas respostas ficam nesta página. Atualizar a página reinicia a demonstração.
        </p>
      )}
      {passo === -1 ? (
        <main className="quick-signup">
          <OnboardingMark />
          <p className="quick-eyebrow">O CÉREBRO DA SUA MARCA</p>
          <h1>Nukkia</h1>
          <div className="quick-signup-fields">
            <label>
              Nome
              <input className="quick-input" value="Marina Costa" readOnly />
            </label>
            <label>
              E-mail
              <input className="quick-input" type="email" value="marina@example.com" readOnly />
            </label>
          </div>
          <button
            className="quick-primary"
            onClick={() => {
              setData((current) => recordWorkspaceEvent(current, "started"));
              setStep(0);
            }}
          >
            Criar conta de demonstração
            <ArrowRight size={16} />
          </button>
          <Link to="/auth" search={{ modo: "cadastro" }} className="quick-skip">
            Quero criar uma conta real
          </Link>
        </main>
      ) : passo < 6 ? (
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
            void navigate({ to: "/demo", search: { passo: -1, aba: "painel" }, replace: true });
          }}
          onEditBrief={() =>
            void navigate({
              to: "/demo",
              search: { passo: 6, aba: "cerebro", editar: "contexto", retorno: aba },
            })
          }
          editor={{ editar, retorno, capitulo }}
          onEditorReturn={() =>
            void navigate({ to: "/demo", search: { passo: 6, aba: retorno ?? "painel" } })
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
              },
            })
          }
          onChooseApproach={() => setStep(3)}
          onData={setData}
          onAnswer={setAnswer}
          section={aba}
          onSection={(section) =>
            void navigate({
              to: "/demo",
              search: { passo: 6, aba: section, ...(section === "marca" ? { retorno: aba } : {}) },
            })
          }
        />
      )}
    </div>
  );
}
