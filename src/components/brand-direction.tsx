import { Check } from "lucide-react";
import { identityPaletteOptions } from "@/lib/identity-palette";
import type { DemoData } from "@/lib/quick-start";
import {
  recommendedVisualStyle,
  VISUAL_STYLES,
  visualStyleTokens,
  type VisualStyle,
} from "@/lib/brand-preview";

export function BrandPaletteVariations({
  data,
  onAccent,
}: {
  data: DemoData;
  onAccent?: ((color: string) => void) | undefined;
}) {
  const palettes = identityPaletteOptions({
    accent: data.brand.accent,
    confirmed: data.brand.identityConfirmed,
    colors: data.brand.research.visualEvidence?.colors.map((color) => color.value),
  });
  return (
    <section className="workspace-card" aria-label="Variações próximas da sua identidade">
      <h3>Variações próximas da sua identidade</h3>
      <p>
        A referência atual e duas propostas locais de ajuste suave. As variações não são cores
        extraídas do site.
      </p>
      <div className="direction-grid">
        {palettes.map((palette) => (
          <button
            key={palette.nome}
            type="button"
            className="direction-card"
            onClick={() => onAccent?.(palette.cores[0]!)}
          >
            <strong>{palette.nome}</strong>
            <span className="brand-style-swatches">
              {palette.cores.slice(0, 4).map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </span>
            <small>{palette.justificativa}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

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
  onIdentity,
  onLogo,
}: {
  data: DemoData;
  selected: VisualStyle;
  onSelect: (style: VisualStyle) => void;
  onCorrect: () => void;
  onAccent?: (accent: string) => void;
  onIdentity?: (edits: NonNullable<DemoData["brand"]["identityEdits"]>) => void;
  onLogo?: (logo: string) => void;
}) {
  const tokens = visualStyleTokens(selected, data.brand.accent, data.brand.identityEdits);
  const evidence = data.brand.research.visualEvidence;
  const extracted = !!(
    evidence?.colors.length ||
    evidence?.fonts.length ||
    data.brand.research.logo
  );
  tokens.background = data.brand.identityEdits?.background || tokens.background;
  tokens.ink = data.brand.identityEdits?.ink || tokens.ink;
  tokens.font = data.brand.identityEdits?.font || evidence?.fonts[0]?.value || tokens.font;
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
          {extracted
            ? "Identidade sugerida a partir do site. Revise as cores, a fonte e o logo encontrados."
            : "Proposta de identidade. Não encontramos dados visuais suficientes no site; você pode editar os itens abaixo."}
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
            {evidence?.colors.map((item) => (
              <span key={item.value}>
                <button
                  type="button"
                  className="identity-color-candidate"
                  onClick={() => onAccent?.(item.value)}
                  style={{ borderColor: item.value }}
                >
                  <span style={{ background: item.value }} />
                  {item.value.toUpperCase()}
                </button>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Fonte da cor ${item.value}`}
                >
                  Fonte
                </a>
              </span>
            ))}
            {evidence?.colors[0] && (
              <p>
                <a href={evidence.colors[0].sourceUrl} target="_blank" rel="noreferrer">
                  Origem das cores encontradas
                </a>{" "}
                · candidatas para sua revisão.
              </p>
            )}
            {(["background", "ink"] as const).map((key) => (
              <label className="brand-accent-input" key={key}>
                {key === "background" ? "Cor de fundo" : "Cor do texto"}
                <input
                  type="color"
                  value={tokens[key]}
                  onChange={(event) =>
                    onIdentity?.({ ...data.brand.identityEdits, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </section>
          <section aria-label="Tipografia">
            <h3>Tipografia</h3>
            <div className="brand-type-specimen" style={{ fontFamily: tokens.font }}>
              Aa Bb Cc
            </div>
            <label>
              Fonte
              <input
                className="quick-input"
                maxLength={120}
                value={tokens.font}
                onChange={(event) =>
                  onIdentity?.({ ...data.brand.identityEdits, font: event.target.value })
                }
              />
            </label>
            {evidence?.fonts[0] && (
              <p>
                <a href={evidence.fonts[0].sourceUrl} target="_blank" rel="noreferrer">
                  Origem da fonte: CSS do site
                </a>
                . A visualização usa fontes disponíveis neste dispositivo.
              </p>
            )}
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
              <p>
                {evidence?.logoUrl ? (
                  <a href={evidence.logoUrl} target="_blank" rel="noreferrer">
                    Consultar logo encontrado no site
                  </a>
                ) : (
                  "Nenhum logo encontrado. Você pode enviá-lo em Identidade."
                )}
              </p>
            )}
            {data.brand.assetSource?.startsWith("https://") && (
              <a href={data.brand.assetSource} target="_blank" rel="noreferrer">
                Origem do logo
              </a>
            )}
            <label>
              Substituir logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_000_000) {
                    input.setCustomValidity("Escolha PNG, JPEG ou WebP de até 1 MB.");
                    input.reportValidity();
                    return;
                  }
                  input.setCustomValidity("");
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string") onLogo?.(reader.result);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
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
      <BrandPaletteVariations data={data} onAccent={onAccent} />
      <VisualStylePicker
        selected={selected}
        onSelect={onSelect}
        recommended={recommendedVisualStyle(data)}
        accent={data.brand.accent}
      />
    </div>
  );
}
