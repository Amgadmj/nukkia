import type { ContentApproach } from "@/lib/brand-preview";
import { resumeLibraryVersion } from "@/lib/content-library";
import { HealthReadiness } from "./health-readiness";
import { ContentLibrary, SaveToLibrary } from "./content-library";
import { type Dispatch, type SetStateAction } from "react";
import { WorkspaceShell } from "./workspace-shell";
import {
  BrandBrain,
  DeliveryJourney,
  LocalChannels,
  LocalIdentity,
  LocalResults,
  WorkspaceOverview,
} from "./marketing-views";
import { ContentStudio } from "./content-studio";
import { HealthStudio } from "./health-studio";
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
  editor,
  onEditorReturn,
  onEditorChapter,
  contentView,
  onContentView,
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
  contentView:
    "briefing" | "peca" | "abordagens" | "saude" | "biblioteca" | "planejamento" | "revisao";
  onContentView: (
    view: "briefing" | "peca" | "abordagens" | "saude" | "biblioteca" | "planejamento" | "revisao",
  ) => void;
}) {
  const progress = journeyProgress(data);
  const choose = (approach?: ContentApproach) => {
    if (approach)
      onData((current) => ({
        ...current,
        brand: {
          ...current.brand,
          preferredApproach: approach,
          pieceBrief: {
            ...(current.brand.pieceBrief ?? {
              idea: "",
              goal: "",
              audience: "",
              constraints: "",
              ratio: "4:5" as const,
            }),
            asNew: true,
            format: approach === "educate" ? ("carousel" as const) : ("image" as const),
          },
        },
      }));
    onContentView("briefing");
  };
  return (
    <WorkspaceShell
      name={data.name}
      section={section}
      onSection={onSection}
      onCalendar={() => onContentView("planejamento")}
      calendarActive={section === "conteudo" && contentView === "planejamento" && !editor?.editar}
      xp={progress.xp}
      completed={progress.completed}
      total={progress.total}
      notifications={workspaceNotifications(data)}
    >
      {editor?.editar ? (
        <WorkspaceContextEditor
          data={data}
          onData={onData}
          mode={editor.editar}
          chapter={editor.capitulo}
          onReturn={onEditorReturn ?? (() => onSection("painel"))}
          onChapter={onEditorChapter ?? (() => {})}
          onHealthStudio={() => onContentView("saude")}
        />
      ) : (
        <>
          {section === "painel" && (
            <WorkspaceOverview
              data={data}
              onSection={onSection}
              onEditBrief={onEditBrief}
              onChooseApproach={choose}
              onEditPiece={() => onContentView("peca")}
              onLibrary={() => onContentView("biblioteca")}
              onResumeSaved={(id, version) => {
                if (
                  !window.confirm(
                    "Retomar esta versão? Guarde antes o rascunho atual que deseja manter. A aprovação deverá ser refeita.",
                  )
                )
                  return;
                const item = data.library.items.find((item) => item.id === id);
                if (!item) return;
                onData((current) => resumeLibraryVersion(current, id, version));
                onContentView(item.kind === "generic" ? "peca" : "saude");
              }}
            />
          )}
          {section === "trilha" && (
            <DeliveryJourney
              data={data}
              onSection={onSection}
              onDiagnose={onEditBrief}
              onCalendar={() => onContentView("planejamento")}
            />
          )}
          {section === "cerebro" && (
            <BrandBrain
              catalogScope={{ kind: "demo" }}
              onServiceBrief={() => onContentView("briefing")}
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
                  aria-selected={contentView === "briefing" || contentView === "abordagens"}
                  onClick={() => onContentView("briefing")}
                >
                  Briefing da peça
                </button>
                <button
                  role="tab"
                  aria-selected={contentView === "saude"}
                  onClick={() => onContentView("saude")}
                >
                  Estúdio de saúde
                </button>
                <button
                  role="tab"
                  aria-selected={contentView === "peca"}
                  onClick={() => onContentView("peca")}
                >
                  Minha peça
                </button>

                <button
                  role="tab"
                  aria-selected={contentView === "biblioteca"}
                  onClick={() => onContentView("biblioteca")}
                >
                  Biblioteca
                </button>
                <button
                  role="tab"
                  aria-selected={contentView === "planejamento"}
                  onClick={() => onContentView("planejamento")}
                >
                  Planejamento mensal
                </button>
                <button
                  role="tab"
                  aria-selected={contentView === "revisao"}
                  onClick={() => onContentView("revisao")}
                >
                  Prontidão e revisão
                </button>
              </div>
              {(contentView === "peca" || contentView === "saude") && (
                <SaveToLibrary
                  data={data}
                  onData={onData}
                  kind={contentView === "peca" ? "generic" : "health"}
                  onLibrary={() => onContentView("biblioteca")}
                />
              )}
              {contentView === "revisao" ? (
                <HealthReadiness data={data} />
              ) : contentView === "biblioteca" || contentView === "planejamento" ? (
                <ContentLibrary
                  data={data}
                  onData={onData}
                  onOpen={onContentView}
                  planning={contentView === "planejamento"}
                />
              ) : contentView === "saude" ? (
                <HealthStudio data={data} onData={onData} />
              ) : (
                <ContentStudio
                  data={data}
                  onData={onData}
                  onEditBrief={onEditBrief}
                  onTrail={() => onSection("trilha")}
                  onIdentity={() => onSection("marca")}
                  view={contentView}
                  onView={onContentView}
                />
              )}
            </>
          )}
          {section === "marca" && (
            <LocalIdentity
              data={data}
              onData={onData}
              onContinue={() => {
                const destination = editor?.retorno ?? "conteudo";
                if (destination === "conteudo") onContentView(contentView);
                else onSection(destination);
              }}
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
          {section === "metricas" && (
            <LocalResults
              data={data}
              onSection={(destination) =>
                destination === "conteudo" ? onContentView("peca") : onSection(destination)
              }
            />
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
