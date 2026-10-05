import { MaterialInput } from "./material-input";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { DemoData } from "@/lib/quick-start";
import {
  addInspiration,
  attachInspiration,
  detachInspiration,
  editInspiration,
  removeInspiration,
} from "@/lib/inspirations";
export function InspirationBoard({
  data,
  onData,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
}) {
  const [notice, setNotice] = useState("");
  function apply(action: () => DemoData) {
    try {
      onData(action());
      setNotice("");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível alterar a referência.");
      return false;
    }
  }
  return (
    <section className="workspace-card" aria-label="Inspirações">
      <h2>Inspirações</h2>
      <p>
        Guarde imagens locais, links e notas de direção visual. A permissão informada por você não é
        uma verificação de direitos. Nenhum link é extraído ou enviado a um provedor.
      </p>
      <button className="quick-secondary" onClick={() => apply(() => addInspiration(data))}>
        Adicionar referência
      </button>
      {notice && <p role="alert">{notice}</p>}
      {!data.inspirations.length && (
        <p>
          Nenhuma referência adicionada. Comece com um link público e o que deseja aproveitar como
          direção.
        </p>
      )}
      <div className="library-grid">
        {data.inspirations.map((item) => {
          const attached = data.brand.inspirationBrief.some(
            (reference) => reference.id === item.id,
          );
          const edit = (patch: Parameters<typeof editInspiration>[2]) =>
            apply(() => editInspiration(data, item.id, patch));
          return (
            <article className="workspace-card library-item" key={item.id}>
              <MaterialInput
                value={item.image ? item : null}
                onChange={(material) => {
                  if (
                    !apply(() =>
                      editInspiration(data, item.id, {
                        image: material?.image ?? "",
                        source: material?.source ?? "",
                        ...(material
                          ? { title: material.title, permission: material.permission }
                          : {}),
                      }),
                    )
                  )
                    throw new Error(
                      "Não foi possível guardar o material. Confira o aviso da referência.",
                    );
                }}
              />
              <label>
                Título
                <input
                  className="quick-input"
                  maxLength={120}
                  value={item.title}
                  onChange={(event) => edit({ title: event.target.value })}
                />
              </label>
              <label>
                Fonte pública HTTPS
                <input
                  className="quick-input"
                  type="url"
                  maxLength={2048}
                  value={item.url}
                  onChange={(event) => edit({ url: event.target.value })}
                />
              </label>
              <label>
                O que usar como direção
                <textarea
                  className="quick-input"
                  maxLength={600}
                  value={item.note}
                  onChange={(event) => edit({ note: event.target.value })}
                />
              </label>
              <label>
                Permissão declarada
                <select
                  className="quick-input"
                  value={item.permission}
                  onChange={(event) =>
                    edit({ permission: event.target.value as typeof item.permission })
                  }
                >
                  <option value="unknown">Não verificada · somente inspiração</option>
                  <option value="own">Declaro que é material próprio</option>
                  <option value="licensed">Declaro que tenho licença</option>
                </select>
              </label>
              <p>
                {attached
                  ? "Anexada ao briefing como direção, sem autorização de produção."
                  : "Rascunho da referência. Após editar, anexe novamente ao briefing."}
              </p>
              <div className="workspace-actions">
                <button
                  className="quick-secondary"
                  onClick={() =>
                    apply(() =>
                      attached
                        ? detachInspiration(data, item.id)
                        : attachInspiration(data, item.id),
                    )
                  }
                >
                  {attached ? "Desanexar do briefing" : "Anexar ao briefing"}
                </button>
                <button
                  className="quick-text-button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remover esta referência? Seu texto de briefing será preservado.",
                      )
                    )
                      apply(() => removeInspiration(data, item.id));
                  }}
                >
                  Remover referência
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
