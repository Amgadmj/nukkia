import type { BrandSuggestion } from "@/lib/brand-preview";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";

function compactTitle(value: string, index: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  // Legacy drafts may have no editorial title. Never disguise a chopped
  // sentence as a summary; new analyses provide the semantic title separately.
  return normalized.split(" ").length <= 5 && normalized.length <= 80
    ? normalized
    : normalized || `Sugestão ${index + 1}`;
}

export function ResearchSuggestions({
  suggestions,
  onUse,
  confirmedValue,
  compact = false,
  selectedValue,
  selectedValues,
}: {
  suggestions: BrandSuggestion[];
  onUse: (item: BrandSuggestion) => void;
  confirmedValue?: string | undefined;
  compact?: boolean;
  selectedValue?: string | undefined;
  selectedValues?: string[] | undefined;
}) {
  if (!suggestions.length) return null;
  return (
    <div
      className={`research-suggestions${compact ? " research-suggestions-compact" : ""}`}
      aria-label="Sugestões personalizadas"
    >
      {compact && <Sparkles className="research-suggestions-mark" size={16} aria-hidden="true" />}
      {suggestions.map((item, index) => {
        const confirmed = confirmedValue === item.value;
        const displayValue = compact ? item.title || compactTitle(item.value, index) : item.value;
        // Match the value actually applied to the question field, which is limited to 240 characters.
        const selected =
          selectedValues?.includes(item.value) ||
          selectedValue === (item.field === "faq" ? item.value.slice(0, 240) : item.value);
        const date =
          item.foundAt && !Number.isNaN(Date.parse(item.foundAt))
            ? new Date(item.foundAt).toLocaleDateString("pt-BR")
            : null;
        const label = confirmed
          ? "Confirmado por você"
          : item.kind === "past-campaign"
            ? "Campanha anterior"
            : item.kind === "opportunity"
              ? "Oportunidade recomendada"
              : "Encontrado na fonte";
        return (
          <article
            className="research-suggestion"
            data-selected={compact && selected ? true : undefined}
            key={item.field + item.value + index}
          >
            {!compact && (
              <span className="research-suggestion-kind">
                {confirmed ? <Check size={12} /> : <Sparkles size={12} />} {label}
              </span>
            )}
            <button
              type="button"
              aria-pressed={compact && selectedValue !== undefined ? selected : undefined}
              onClick={() => onUse(item)}
            >
              {displayValue}
              {!compact && <span>Usar sugestão →</span>}
            </button>
            {item.kind === "past-campaign" && (
              <p className="research-caution">
                {compact ? (
                  <>
                    Campanha anterior{item.publishedAt ? ` · ${item.publishedAt}` : ""} · confirme a
                    vigência.
                  </>
                ) : (
                  <>
                    {item.publishedAt ? `Encontrada em ${item.publishedAt}. ` : ""}Vigência não
                    confirmada. Quer adaptar?
                  </>
                )}
              </p>
            )}
            {item.kind === "opportunity" && (
              <p>
                {compact
                  ? "Hipótese de público · confirme antes de usar."
                  : "Inferido pela IA · confirme se faz sentido para sua marca."}
              </p>
            )}
            {!compact && (
              <div className="research-suggestion-source">
                {item.sourceUrl.startsWith("https://") && (
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    Fonte <ArrowUpRight size={12} />
                  </a>
                )}
                {date && <span>Coletado em {date}</span>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
