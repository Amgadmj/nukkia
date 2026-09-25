import type { DemoData } from "@/lib/quick-start";
import { CONTENT_APPROACHES, recommendContent, type ContentApproach } from "@/lib/brand-preview";
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
      <section className="brand-opportunity" aria-label="Por que começar por aqui">
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
      </section>
      <fieldset className="brand-approaches">
        <legend>Escolha o papel da primeira peça</legend>
        <p className="brand-approaches-intro">
          A oferta permanece a mesma. O que muda é como a mensagem ajuda seu público.
        </p>
        <div className="brand-approach-grid">
          {CONTENT_APPROACHES.map((option) => {
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
                <span className="brand-approach-badge">
                  {recommendation.approach === option.id
                    ? "RECOMENDADO PARA SEU FOCO"
                    : "OUTRO CAMINHO"}
                </span>
                <strong>{option.format}</strong>
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
