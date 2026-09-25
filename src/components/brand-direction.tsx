import { ArrowUpRight, Check, Image, Sparkles } from "lucide-react";
import type { DemoData } from "@/lib/quick-start";
import {
  CONTENT_APPROACHES,
  recommendContent,
  recommendedVisualStyle,
  VISUAL_STYLES,
  type VisualStyle,
} from "@/lib/brand-preview";

export function VisualStylePicker({
  selected,
  onSelect,
  recommended,
}: {
  selected: VisualStyle;
  onSelect: (style: VisualStyle) => void;
  recommended: VisualStyle;
}) {
  return (
    <fieldset className="direction-picker">
      <legend>Como sua marca pode aparecer</legend>
      <p className="direction-picker-note">
        Referências de estilo, não posts prontos. Você pode mudar depois.
      </p>
      <div className="direction-grid">
        {VISUAL_STYLES.map((style) => (
          <label className="direction-card" data-selected={selected === style.id} key={style.id}>
            <input
              type="radio"
              name="visual-style"
              value={style.id}
              checked={selected === style.id}
              onChange={() => onSelect(style.id)}
            />
            <div className={`direction-art direction-art-${style.id}`} aria-hidden="true">
              <span className="direction-art-kicker">
                ESTUDO VISUAL /{" "}
                {style.id === "essential" ? "01" : style.id === "warm" ? "02" : "03"}
              </span>
              {style.id === "essential" ? (
                <>
                  <strong>
                    Menos ruído.
                    <br />
                    <i>Mais presença.</i>
                  </strong>
                  <span className="direction-art-line" />
                  <span className="direction-art-footer">
                    O essencial fica. <ArrowUpRight size={20} />
                  </span>
                </>
              ) : style.id === "warm" ? (
                <>
                  <span className="direction-photo-reference">
                    <Image size={28} strokeWidth={1} />
                    <small>SUA FOTOGRAFIA</small>
                  </span>
                  <strong>
                    Feito de
                    <br />
                    <i>conexões.</i>
                  </strong>
                  <span className="direction-art-footer">Gente, antes de tudo.</span>
                </>
              ) : (
                <>
                  <strong>
                    EM
                    <br />
                    <i>
                      MOVI
                      <br />
                      MENTO.
                    </i>
                  </strong>
                  <span className="direction-art-footer">
                    A próxima ideia começa aqui. <ArrowUpRight size={24} />
                  </span>
                </>
              )}
            </div>
            <span className="direction-card-heading">
              <strong>{style.name}</strong>
              <span className="direction-check">
                {selected === style.id && <Check size={13} />}
              </span>
            </span>
            <span className="direction-card-description">{style.description}</span>
            <span className="direction-card-material">
              {recommended === style.id ? "Sugerido para seu foco" : style.material}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BrandDirection({
  data,
  selected,
  onSelect,
  onCorrect,
}: {
  data: DemoData;
  selected: VisualStyle;
  onSelect: (style: VisualStyle) => void;
  onCorrect: () => void;
}) {
  const recommendation = recommendContent(data);
  const approach = CONTENT_APPROACHES.find((item) => item.id === recommendation.approach)!;
  const topic =
    data.brand.research.suggestions.find(
      (item) => item.field === "offers" && item.value === data.answers.offers,
    )?.title || data.answers.offers;
  return (
    <div className="brand-direction">
      <section className="direction-summary" aria-label="Direção para seu primeiro conteúdo">
        <div className="direction-summary-top">
          <span>
            <Sparkles size={14} /> SUA PRIMEIRA DIREÇÃO
          </span>
          <button type="button" onClick={onCorrect}>
            Editar contexto
          </button>
        </div>
        <h2>{topic}</h2>
        <p>{recommendation.reason}</p>
        <dl>
          <div>
            <dt>PARA QUEM</dt>
            <dd>{data.answers.audience}</dd>
          </div>
          <div>
            <dt>FORMATO SUGERIDO</dt>
            <dd>{approach.format}</dd>
          </div>
        </dl>
      </section>
      <VisualStylePicker
        selected={selected}
        onSelect={onSelect}
        recommended={recommendedVisualStyle(data)}
      />
    </div>
  );
}
