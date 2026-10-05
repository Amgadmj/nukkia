import type { DemoData } from "@/lib/quick-start";
import {
  CONTENT_APPROACHES,
  composeContent,
  firstPostBrief,
  recommendContent,
  type ContentApproach,
} from "@/lib/brand-preview";
import { postSvg, svgUrl } from "@/lib/post-art";
import { BrandSources } from "./brand-sources";

export function ContentRecommendation({
  data,
  selected,
  onSelect,
  onCorrect,
}: {
  data: DemoData;
  selected: ContentApproach;
  onSelect: (id: ContentApproach) => void;
  onCorrect: () => void;
}) {
  const recommendation = recommendContent(data);
  return (
    <>
      <details className="brand-opportunity" aria-label="Por que começar por aqui">
        <summary>Contexto e motivo da recomendação</summary>
        <div>
          <span>O QUE VOCÊ CONFIRMOU</span>
          <p>{recommendation.observation}</p>
        </div>
        <div>
          <span>HIPÓTESE A TESTAR</span>
          <p>{recommendation.hypothesis}</p>
        </div>
        <div>
          <span>NOSSA RECOMENDAÇÃO</span>
          <p>{recommendation.reason}</p>
        </div>
        <button className="quick-text-button" type="button" onClick={onCorrect}>
          Quero corrigir o contexto
        </button>
        <details className="brand-source-details">
          <summary>O que sabemos — e o que ainda não sabemos</summary>
          <p>
            {recommendation.coverage.pages} página(s) pública(s) coletada(s). Suas respostas são
            informações fornecidas por você, não verificações independentes.
          </p>
          <BrandSources research={data.brand.research} />
          <p>
            Histórico de publicações, alcance e conversões: não disponíveis. Esta recomendação usa
            regras e seu objetivo; não é uma auditoria das redes nem uma promessa de desempenho.
          </p>
        </details>
      </details>
      <fieldset className="brand-approaches">
        <legend>Como você quer contar esta ideia?</legend>
        <p className="brand-approaches-intro">
          A oferta permanece a mesma. Compare as prévias ilustrativas e escolha a intenção; o texto
          continua editável.
        </p>
        <div className="brand-approach-grid">
          {CONTENT_APPROACHES.map((option) => {
            const preview = composeContent(data, option.id);
            return (
              <label
                className="brand-approach-card"
                key={option.id}
                data-selected={selected === option.id}
              >
                <div className="brand-approach-choice">
                  <input
                    type="radio"
                    name="content-approach"
                    value={option.id}
                    checked={selected === option.id}
                    onChange={() => onSelect(option.id)}
                  />
                  <strong>{option.name}</strong>
                </div>
                <img
                  className="approach-thumbnail"
                  alt={`Prévia ilustrativa: ${option.name}`}
                  src={svgUrl(
                    postSvg(firstPostBrief(data), preview.copy, data.brand, {
                      approach: option.id,
                      page: 1,
                      total: preview.slides.length + 1,
                    }),
                  )}
                />
                <span className="brand-approach-badge">
                  {recommendation.approach === option.id
                    ? "RECOMENDADO PARA SEU FOCO"
                    : "OUTRO CAMINHO"}
                </span>
                <strong>
                  {data.brand.pieceBrief
                    ? data.brand.pieceBrief.format === "carousel"
                      ? "Carrossel · 3 páginas"
                      : "Imagem · 1 página"
                    : option.format}
                </strong>
                <p>{option.purpose}</p>
                <small>{option.need}</small>
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
