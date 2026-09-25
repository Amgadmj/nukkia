import { type Dispatch, type SetStateAction } from "react";
import { ArrowRight } from "lucide-react";
import type { DemoData } from "@/lib/quick-start";
import {
  briefIssues,
  composeContent,
  recommendContent,
  updateBrand,
  identityReady,
} from "@/lib/brand-preview";
import { ContentRecommendation } from "./content-recommendation";
import { ContentReadiness } from "./content-readiness";
import { FirstPostWorkspace } from "./first-post-workspace";
import { WorkspaceHeading } from "./marketing-views";

export function ContentStudio({
  data,
  onData,
  onEditBrief,
  onTrail,
  onIdentity,
  view,
  onView,
  onVideo,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onEditBrief: () => void;
  onTrail: () => void;
  onIdentity: () => void;
  view: "peca" | "abordagens";
  onView: (view: "peca" | "abordagens") => void;
  onVideo?: (frames: string[]) => Promise<Blob>;
}) {
  const selected =
    data.brand.preferredApproach ??
    data.brand.creative?.approach ??
    recommendContent(data).approach;
  const needsPhoto =
    (selected === "trust" || data.brand.visualStyle === "warm") && !data.brand.photo;
  const missing = briefIssues(data);
  if (missing.length)
    return (
      <div className="workspace-page">
        <WorkspaceHeading
          eyebrow="SEU ESTÚDIO DE CONTEÚDO"
          title="Uma peça que começa com você."
          description="Confirme sua marca, sua oferta e um detalhe concreto para preparar uma composição útil."
        />
        <section className="workspace-card">
          <h2>Vamos completar o ponto de partida.</h2>
          <p>{missing[0]}</p>
          <button className="quick-secondary" onClick={onEditBrief}>
            Completar meu contexto <ArrowRight size={16} />
          </button>
        </section>
      </div>
    );
  function choose() {
    if ((!identityReady(data.brand) && !data.brand.creative) || needsPhoto) return;
    const current = data.brand.creative;
    const next = composeContent(data, selected);
    const same =
      current &&
      current.approach === next.approach &&
      current.briefKey === next.briefKey &&
      current.questionKey === next.questionKey;
    if (
      current &&
      !same &&
      !window.confirm("Esta abordagem substituirá o rascunho atual. Continuar?")
    )
      return;
    if (!same)
      onData((previous) => ({
        ...previous,
        brand: updateBrand(previous.brand, { creative: composeContent(previous, selected) }),
      }));
    onView("peca");
  }
  const ready = identityReady(data.brand);
  if (view === "peca" && !data.brand.creative && !ready)
    return (
      <div className="workspace-page">
        <ContentReadiness
          data={data}
          context="piece"
          onIdentity={onIdentity}
          onContext={onEditBrief}
        />
      </div>
    );
  return (
    <div className="workspace-content">
      {view === "abordagens" || !data.brand.creative ? (
        <div className="workspace-page">
          <WorkspaceHeading
            eyebrow="A IDEIA ANTES DA PEÇA"
            title="O que vale comunicar agora?"
            description="Escolha a intenção da mensagem. O rascunho será preparado no editor para você revisar."
          />
          <ContentRecommendation
            data={data}
            selected={selected}
            onSelect={(preferredApproach) =>
              onData((current) => ({
                ...current,
                // Choosing an intention doesn't replace or alter the current piece.
                brand: { ...current.brand, preferredApproach },
              }))
            }
            onCorrect={onEditBrief}
          />
          {!ready && (
            <div className="content-approach-gate" role="status">
              <p>
                Sua escolha fica guardada. Finalize a identidade para transformar esta abordagem em
                uma peça.
              </p>
            </div>
          )}
          {needsPhoto && (
            <div className="brand-review-note" role="status">
              <p>
                Este formato precisa de uma foto própria. Adicione uma imagem ou escolha outra
                abordagem.
              </p>
              <button className="quick-text-button" onClick={onIdentity}>
                Adicionar uma foto <ArrowRight size={15} />
              </button>
            </div>
          )}
          <div className="workspace-actions">
            <button
              className="quick-primary"
              onClick={ready ? choose : onIdentity}
              disabled={ready && needsPhoto}
            >
              {!ready
                ? "Finalizar identidade"
                : data.brand.creative
                  ? "Usar esta abordagem"
                  : "Preparar meu rascunho"}{" "}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      ) : (
        <FirstPostWorkspace
          data={data}
          onData={onData}
          onEditBrief={onEditBrief}
          onChooseApproach={() => onView("abordagens")}
          onTrail={onTrail}
          onVideo={onVideo}
        />
      )}
    </div>
  );
}
