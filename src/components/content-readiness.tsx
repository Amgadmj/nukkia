import { ArrowRight, Check, Circle, ImageIcon, Palette } from "lucide-react";
import { briefIssues } from "@/lib/brand-preview";
import type { DemoData } from "@/lib/quick-start";

export function ContentReadiness({
  data,
  context,
  onIdentity,
  onContext,
}: {
  data: DemoData;
  context: "piece" | "calendar";
  onIdentity: () => void;
  onContext?: () => void;
}) {
  const contextIssues = briefIssues(data);
  const needsContext = contextIssues.length > 0;
  const hasLogo = Boolean(data.brand.logo || data.brand.research.logo);
  const needsPhoto = data.brand.visualStyle === "warm" || data.brand.preferredApproach === "trust";
  const items = [
    {
      label: "Direção visual",
      detail: data.brand.visualStyle ? "escolhida" : "falta escolher",
      complete: Boolean(data.brand.visualStyle),
      icon: Palette,
    },
    {
      label: "Logo da marca",
      detail: hasLogo ? "adicionado" : "recomendado para reconhecer a marca",
      complete: hasLogo,
      icon: ImageIcon,
    },
    {
      label: "Foto própria",
      detail: data.brand.photo
        ? "adicionada"
        : needsPhoto
          ? "necessária neste formato"
          : "opcional",
      complete: Boolean(data.brand.photo) || !needsPhoto,
      icon: ImageIcon,
    },
  ];

  if (needsContext)
    return (
      <section className="content-readiness" aria-labelledby="content-context-title">
        <div className="content-readiness-copy">
          <span>ANTES DE PLANEJAR</span>
          <h2 id="content-context-title">Complete seu diagnóstico</h2>
          <p>{contextIssues[0]}</p>
        </div>
        <button className="quick-primary" type="button" onClick={onContext}>
          Completar diagnóstico <ArrowRight size={17} />
        </button>
      </section>
    );

  return (
    <section className="content-readiness" aria-labelledby="content-identity-title">
      <div className="content-readiness-copy">
        <span>{context === "calendar" ? "PARA MELHORAR SEU PLANO" : "ANTES DA PRIMEIRA PEÇA"}</span>
        <h2 id="content-identity-title">Finalize sua identidade</h2>
        <p>
          {context === "calendar"
            ? "Um planejamento mais preciso usa a direção visual e os materiais reais da sua marca."
            : "Confirme os elementos que vão dar forma à peça. Você poderá ajustá-los depois."}
        </p>
      </div>
      <ul className="content-readiness-list" aria-label="Estado da identidade">
        {items.map(({ label, detail, complete, icon: Icon }) => (
          <li key={label} data-complete={complete}>
            <span className="content-readiness-icon">
              {complete ? <Check size={16} /> : <Circle size={14} />}
            </span>
            <Icon size={17} aria-hidden="true" />
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          </li>
        ))}
      </ul>
      <button className="quick-primary" type="button" onClick={onIdentity}>
        Finalizar identidade <ArrowRight size={17} />
      </button>
    </section>
  );
}
