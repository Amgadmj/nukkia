import { PieceBrief } from "./piece-brief";
import { SavedContentPicker } from "./content-library";
import { type Dispatch, type SetStateAction } from "react";
import { ArrowRight } from "lucide-react";
import type { DemoData } from "@/lib/quick-start";
import {
  briefIssues,
  composeContent,
  composeWorkspaceContent,
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
  view: "peca" | "abordagens" | "briefing";
  onView: (view: "peca" | "abordagens" | "briefing") => void;
  onVideo?: (frames: string[]) => Promise<Blob>;
}) {
  if (view === "briefing")
    return (
      <PieceBrief
        data={data}
        onData={onData}
        onPrepare={() => onView("abordagens")}
        onContext={onEditBrief}
        onIdentity={onIdentity}
      />
    );
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
          title="Complete o briefing"
          description="Confirme sua marca, sua oferta e um detalhe concreto para preparar uma composição útil."
        />
        <section className="workspace-card">
          <h2>Vamos completar o ponto de partida.</h2>
          <p>{missing[0]}</p>
          {data.brand.serviceBrief && (
            <button
              className="quick-text-button"
              onClick={() =>
                onData((current) => ({
                  ...current,
                  brand: updateBrand(current.brand, { serviceBrief: null }),
                }))
              }
            >
              Remover serviço do briefing
            </button>
          )}
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
      (!same || data.brand.pieceBrief?.asNew) &&
      !window.confirm("Esta abordagem substituirá o rascunho atual. Continuar?")
    )
      return;
    if (!same || data.brand.pieceBrief?.asNew)
      onData((previous) => composeWorkspaceContent(previous, selected));
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
      <SavedContentPicker data={data} onData={onData} onOpen={() => onView("peca")} />
      {(data.brand.serviceBrief ||
        data.brand.inspirationBrief.length > 0 ||
        data.brand.pieceBrief) && (
        <details className="workspace-card piece-context">
          <summary>Briefing, fontes e restrições</summary>
          {data.brand.pieceBrief && (
            <>
              <p>{data.brand.pieceBrief.idea}</p>
              <p>{data.brand.pieceBrief.constraints || "Sem restrições adicionais."}</p>
              <button className="quick-text-button" onClick={() => onView("briefing")}>
                Editar briefing da peça
              </button>
            </>
          )}
          {data.brand.serviceBrief && (
            <section>
              <h2>Serviço usado neste briefing</h2>
              <p>
                {data.brand.serviceBrief.offer} · {data.brand.serviceBrief.audience}
              </p>
              <p>{data.brand.serviceBrief.detail}</p>
              <p>
                Fonte: {data.brand.serviceBrief.source || "Informada pela equipe"} · versão do
                catálogo: {data.brand.serviceBrief.catalogRevision}. Mudanças posteriores no
                catálogo não alteram esta cópia.
              </p>
              <button
                className="quick-text-button"
                onClick={() =>
                  onData((current) => ({
                    ...current,
                    brand: updateBrand(current.brand, { serviceBrief: null }),
                  }))
                }
              >
                Remover serviço e voltar ao contexto da marca
              </button>
            </section>
          )}
          {data.brand.inspirationBrief.length > 0 && (
            <section className="workspace-card">
              <h2>Direção visual anexada</h2>
              {data.brand.inspirationBrief.map((reference) => (
                <p key={reference.id}>
                  {reference.title}: {reference.note} · fonte: {reference.url} · direitos não
                  verificados
                </p>
              ))}
              <button className="quick-text-button" onClick={onIdentity}>
                Editar inspirações
              </button>
            </section>
          )}
        </details>
      )}
      {view === "abordagens" || !data.brand.creative ? (
        <div className="workspace-page">
          <WorkspaceHeading
            title="Escolher abordagem"
            description="Briefing → Abordagem → Editor. Compare caminhos para esta peça e escolha como contar sua ideia."
          />
          <button className="quick-text-button" onClick={() => onView("briefing")}>
            Voltar ao briefing
          </button>
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
          onEditBrief={() => onView("briefing")}
          onChooseApproach={() => onView("abordagens")}
          onTrail={onTrail}
          onVideo={onVideo}
        />
      )}
    </div>
  );
}
