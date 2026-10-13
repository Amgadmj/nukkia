import { Check } from "lucide-react";
import type { DemoData } from "@/lib/quick-start";
import {
  recommendedVisualStyle,
  VISUAL_STYLES,
  visualStyleTokens,
  type VisualStyle,
} from "@/lib/brand-preview";

export function VisualStylePicker({
  selected,
  onSelect,
  recommended,
  accent = "#395D51",
}: {
  selected: VisualStyle;
  onSelect: (style: VisualStyle) => void;
  recommended: VisualStyle;
  accent?: string;
}) {
  return (
    <fieldset className="direction-picker">
      <legend>Estilo da marca</legend>
      <p className="direction-picker-note">
        Compare a paleta e a tipografia. Você pode ajustar depois.
      </p>
      <div className="direction-grid">
        {VISUAL_STYLES.map((style) => {
          const tokens = visualStyleTokens(style.id, accent);
          return (
            <label className="direction-card" data-selected={selected === style.id} key={style.id}>
              <input
                type="radio"
                name="visual-style"
                value={style.id}
                checked={selected === style.id}
                onChange={() => onSelect(style.id)}
              />
              <div
                className="brand-style-specimen"
                style={{ background: tokens.background, color: tokens.ink }}
                aria-hidden="true"
              >
                <span style={{ fontFamily: tokens.font }}>Aa</span>
                <div className="brand-style-swatches">
                  {[tokens.accent, tokens.background, tokens.ink].map((color, index) => (
                    <i key={index} style={{ background: color }} />
                  ))}
                </div>
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
          );
        })}
      </div>
    </fieldset>
  );
}

export function BrandDirection({
  data,
  selected,
  onSelect,
  onCorrect,
  onAccent,
}: {
  data: DemoData;
  selected: VisualStyle;
  onSelect: (style: VisualStyle) => void;
  onCorrect: () => void;
  onAccent?: (accent: string) => void;
}) {
  const tokens = visualStyleTokens(selected, data.brand.accent);
  return (
    <div className="brand-direction">
      <section className="brand-system" aria-label="Sistema da marca">
        <div className="direction-summary-top">
          <h2>{data.name || "Sua marca"}</h2>
          <button type="button" onClick={onCorrect}>
            Editar contexto
          </button>
        </div>
        <p>
          Direção editável. As cores e fontes abaixo são propostas para suas peças, não uma
          identidade extraída do site.
        </p>
        <div className="brand-system-grid">
          <section aria-label="Paleta">
            <h3>Paleta</h3>
            <div className="brand-palette">
              {[
                { name: "Destaque", color: tokens.accent },
                { name: "Fundo", color: tokens.background },
                { name: "Texto", color: tokens.ink },
              ].map((item) => (
                <div key={item.name}>
                  <span style={{ background: item.color }} />
                  <strong>{item.name}</strong>
                  <code>{item.color.toUpperCase()}</code>
                </div>
              ))}
            </div>
            <label className="brand-accent-input">
              Cor de destaque
              <input
                type="color"
                value={tokens.accent}
                onInput={(event) => onAccent?.(event.currentTarget.value)}
                onChange={(event) => onAccent?.(event.target.value)}
              />
            </label>
          </section>
          <section aria-label="Tipografia">
            <h3>Tipografia</h3>
            <div className="brand-type-specimen" style={{ fontFamily: tokens.font }}>
              Aa Bb Cc
            </div>
            <strong>{selected === "warm" ? "Georgia" : "Arial"}</strong>
            <p>
              {selected === "warm"
                ? "Serifa para títulos e textos de tom próximo."
                : "Sem serifa para títulos e textos diretos."}
            </p>
          </section>
          <section aria-label="Logo da marca">
            <h3>Logo</h3>
            {data.brand.logo ? (
              <img
                className="brand-system-logo"
                src={data.brand.logo}
                alt={`Logo de ${data.name}`}
              />
            ) : (
              <p>Nenhum logo adicionado. Você pode enviá-lo em Identidade.</p>
            )}
          </section>
          <section aria-label="Contexto da marca">
            <h3>Contexto</h3>
            <dl>
              <dt>Área</dt>
              <dd>{data.segment || "A definir"}</dd>
              <dt>Público</dt>
              <dd>{data.answers.audience || "A definir"}</dd>
            </dl>
          </section>
        </div>
      </section>
      <VisualStylePicker
        selected={selected}
        onSelect={onSelect}
        recommended={recommendedVisualStyle(data)}
        accent={data.brand.accent}
      />
    </div>
  );
}
