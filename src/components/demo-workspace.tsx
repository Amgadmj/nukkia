import { useState, type Dispatch, type SetStateAction } from "react";
import { WorkspaceShell } from "./workspace-shell";
import { RotateCcw } from "lucide-react";
import {
  BrandBrain,
  DeliveryJourney,
  LocalChannels,
  LocalIdentity,
  LocalResults,
  WorkspaceOverview,
} from "./marketing-views";
import { ContentStudio } from "./content-studio";
import { WorkspaceContextEditor } from "./workspace-context-editor";
import type { Answers } from "@/lib/onboarding";
import type { DemoData } from "@/lib/quick-start";
import {
  journeyProgress,
  workspaceNotifications,
  type WorkspaceSection,
  type ContextSearch,
} from "@/lib/marketing-workspace";

export function DemoWorkspace({
  data,
  onData,
  section,
  onSection,
  onEditBrief,
  onRestart,
  editor,
  onEditorReturn,
  onEditorChapter,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onAnswer: (key: keyof Answers, value: string) => void;
  section: WorkspaceSection;
  onSection: (section: WorkspaceSection) => void;
  onEditBrief: () => void;
  onRestart: () => void;
  onChooseApproach: () => void;
  editor?: ContextSearch;
  onEditorReturn?: () => void;
  onEditorChapter?: (chapter?: number) => void;
}) {
  const [contentView, setContentView] = useState<"peca" | "abordagens">("peca");
  const progress = journeyProgress(data);
  const choose = () => {
    setContentView("abordagens");
    onSection("conteudo");
  };
  return (
    <WorkspaceShell
      name={data.name}
      section={section}
      onSection={onSection}
      xp={progress.xp}
      completed={progress.completed}
      total={progress.total}
      notifications={workspaceNotifications(data)}
      accountActions={
        <button onClick={onRestart} title="Recomeçar demonstração">
          <RotateCcw size={16} /> <span>Recomeçar demonstração</span>
        </button>
      }
    >
      {editor?.editar ? (
        <WorkspaceContextEditor
          data={data}
          onData={onData}
          mode={editor.editar}
          chapter={editor.capitulo}
          onReturn={onEditorReturn ?? (() => onSection("painel"))}
          onChapter={onEditorChapter ?? (() => {})}
        />
      ) : (
        <>
          {section === "painel" && (
            <WorkspaceOverview
              data={data}
              onSection={onSection}
              onEditBrief={onEditBrief}
              onChooseApproach={choose}
            />
          )}
          {section === "trilha" && (
            <DeliveryJourney data={data} onSection={onSection} onDiagnose={onEditBrief} />
          )}
          {section === "cerebro" && (
            <BrandBrain
              data={data}
              onData={onData}
              onSection={onSection}
              onEditBrief={onEditBrief}
            />
          )}
          {section === "conteudo" && (
            <>
              <div className="workspace-tabs" role="tablist" aria-label="Conteúdo">
                <button
                  role="tab"
                  aria-selected={contentView === "peca"}
                  onClick={() => setContentView("peca")}
                >
                  Minha peça
                </button>
                <button
                  role="tab"
                  aria-selected={contentView === "abordagens"}
                  onClick={() => setContentView("abordagens")}
                >
                  Três abordagens
                </button>
              </div>
              <ContentStudio
                data={data}
                onData={onData}
                onEditBrief={onEditBrief}
                onTrail={() => onSection("trilha")}
                onIdentity={() => onSection("marca")}
                view={contentView}
                onView={setContentView}
              />
            </>
          )}
          {section === "marca" && (
            <LocalIdentity
              data={data}
              onData={onData}
              onContinue={() => onSection(editor?.retorno ?? "conteudo")}
            />
          )}
          {section === "redes" && (
            <LocalChannels
              data={data}
              onData={onData}
              onSection={onSection}
              onEditBrief={onEditBrief}
            />
          )}
          {section === "metricas" && <LocalResults data={data} onSection={onSection} />}
        </>
      )}
    </WorkspaceShell>
  );
}
