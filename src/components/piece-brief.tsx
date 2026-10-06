import type { Dispatch, SetStateAction } from "react";
import type { DemoData } from "@/lib/quick-start";
import { briefIssues, pieceBriefSchema, updateBrand } from "@/lib/brand-preview";
import { MaterialInput } from "./material-input";

export function PieceBrief({
  data,
  onData,
  onPrepare,
  onContext,
  onIdentity,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onPrepare: () => void;
  onContext: () => void;
  onIdentity: () => void;
}) {
  const brief =
    data.brand.pieceBrief ??
    pieceBriefSchema.parse({
      format: data.brand.preferredApproach === "educate" ? "carousel" : "image",
    });
  const change = (patch: Partial<typeof brief>) =>
    onData((current) => ({
      ...current,
      brand: updateBrand(current.brand, {
        pieceBrief: pieceBriefSchema.parse({ ...brief, ...patch }),
      }),
    }));
  const issues = briefIssues(data);
  const material = data.brand.inspirationBrief.find((item) => item.image) ?? null;
  const materials = [
    ...data.inspirations,
    ...(data.brand.serviceBrief?.visualMaterial ? [data.brand.serviceBrief.visualMaterial] : []),
    ...data.library.items.flatMap((item) =>
      item.versions.flatMap((version) =>
        version.snapshot.kind === "generic"
          ? version.snapshot.brand.inspirationBrief.filter((ref) => ref.image)
          : [],
      ),
    ),
  ].filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index);
  return (
    <section className="workspace-card piece-brief" aria-labelledby="piece-brief-title">
      <header>
        <h1 id="piece-brief-title">O que vamos criar?</h1>
        <p>Defina esta peça. As informações gerais da marca continuam no Cérebro.</p>
      </header>
      <fieldset>
        <legend>Formato</legend>
        <div className="workspace-actions">
          {(["image", "carousel"] as const).map((format) => (
            <button
              key={format}
              type="button"
              className="quick-secondary"
              aria-pressed={brief.format === format}
              onClick={() => change({ format })}
            >
              {format === "image" ? "Imagem" : "Carrossel · 3 páginas"}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="piece-source">
        <strong>
          {data.brand.serviceBrief?.offer || data.answers.offers || "Oferta ainda não informada"}
        </strong>
        <p>
          {data.brand.serviceBrief
            ? `Serviço selecionado · fonte: ${data.brand.serviceBrief.source}`
            : "Oferta do contexto da marca"}
        </p>
        <button className="quick-text-button" onClick={onContext}>
          Revisar contexto e oferta
        </button>
      </div>
      <label>
        Ideia para esta peça
        <textarea
          className="quick-input"
          maxLength={600}
          value={brief.idea}
          placeholder="Ex.: Apresentar a equipe da clínica e explicar como agendar"
          onChange={(e) => change({ idea: e.target.value })}
        />
      </label>
      <label>
        Objetivo desta peça
        <input
          className="quick-input"
          maxLength={1000}
          value={brief.goal}
          placeholder={data.answers.goals}
          onChange={(e) => change({ goal: e.target.value })}
        />
      </label>
      <label>
        Público desta peça
        <input
          className="quick-input"
          maxLength={1000}
          value={brief.audience}
          placeholder={data.brand.serviceBrief?.audience || data.answers.audience}
          onChange={(e) => change({ audience: e.target.value })}
        />
      </label>
      <details>
        <summary>Material e restrições</summary>
        <MaterialInput
          value={material}
          library={materials}
          onChange={(item) => {
            const current = data;
            const references = current.brand.inspirationBrief.filter((ref) => !ref.image);
            if (item && references.length >= 20)
              throw new Error(
                "Limite de 20 referências anexadas. Desanexe uma referência antes de usar este material.",
              );
            const next = {
              ...current,
              brand: updateBrand(current.brand, {
                inspirationBrief: item ? [...references, item] : references,
                ...(item?.permission !== "unknown" && item
                  ? { photo: item.image, assetSource: item.source }
                  : material?.image === current.brand.photo
                    ? { photo: "" }
                    : {}),
              }),
            };
            if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 4_800_000)
              throw new Error("Sem espaço para este material. Seu rascunho foi preservado.");
            onData(next);
          }}
        />
        <label>
          Restrições para a revisão
          <textarea
            className="quick-input"
            maxLength={600}
            value={brief.constraints}
            placeholder="Ex.: Não divulgar preços; confirmar horário com a equipe"
            onChange={(e) => change({ constraints: e.target.value })}
          />
        </label>
        <p>
          Composição local: as restrições ficam visíveis para sua revisão; não há verificação
          automática.
        </p>
      </details>
      <p>
        Imagem 1080 × 1350 (4:5).{" "}
        {brief.format === "carousel" ? "Três páginas editáveis." : "Uma página editável."} Idioma:
        português do Brasil.
      </p>
      {issues.length > 0 && <p role="status">{issues[0]}</p>}
      <div className="workspace-actions">
        <button
          className="quick-primary"
          disabled={!!issues.length || !brief.idea.trim()}
          onClick={() => {
            change({});
            onPrepare();
          }}
        >
          Preparar opções
        </button>
        <button className="quick-text-button" onClick={onIdentity}>
          Revisar identidade
        </button>
      </div>
      {!brief.idea.trim() && <small>Escreva uma ideia para preparar as opções.</small>}
      {brief.asNew && (
        <p>
          Nova peça: ao confirmar a composição, você começará um item independente na biblioteca.
        </p>
      )}
      {data.brand.creative && (
        <p>Seu rascunho atual será mantido até você confirmar outra composição.</p>
      )}
    </section>
  );
}
