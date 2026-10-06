import { useEffect, useRef, useState } from "react";
import { prepareAsset } from "@/lib/post-art";
import type { DemoData } from "@/lib/quick-start";

type Material = DemoData["inspirations"][number];
/** Local-only selection. No network ingestion and no implicit rights clearance. */
export function MaterialInput({
  value,
  onChange,
  library = [],
}: {
  value: Material | null;
  onChange: (material: Material | null) => void;
  library?: Material[];
}) {
  const [pending, setPending] = useState<Material | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function apply(material: Material | null) {
    try {
      onChange(material);
      setNotice("");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível usar o material.");
      return false;
    }
  }
  return (
    <section className="material-input" aria-label="Material visual">
      {value && (
        <div className="material-current">
          <img src={value.image} alt={value.title} />
          <p>
            {value.title} · Fonte: {value.source || value.url} · permissão declarada, não verificada
          </p>
          <button type="button" className="quick-text-button" onClick={() => apply(null)}>
            Remover material
          </button>
        </div>
      )}
      <label>
        Enviar imagem local
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const request = ++generation.current;
            setBusy(true);
            setNotice("");
            try {
              const image = await prepareAsset(file, false);
              if (request !== generation.current) return;
              setPending({
                id: crypto.randomUUID(),
                title: file.name.slice(0, 120),
                image,
                source: `Arquivo local: ${file.name}`.slice(0, 1000),
                url: "",
                note: "",
                permission: "unknown",
              });
            } catch (error) {
              if (request === generation.current)
                setNotice(
                  error instanceof Error ? error.message : "Não foi possível abrir a imagem.",
                );
            } finally {
              if (request === generation.current) setBusy(false);
            }
          }}
        />
      </label>
      <small>
        PNG, JPG ou WebP, até 5 MB. Redimensionado neste navegador; sem envio a provedores.
      </small>
      {library.some((item) => item.image) && (
        <details>
          <summary>Escolher imagem guardada</summary>
          <div className="material-strip">
            {library
              .filter((item) => item.image)
              .map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    generation.current++;
                    setBusy(false);
                    setPending(structuredClone(item));
                    setNotice("");
                  }}
                  aria-label={`Inspecionar ${item.title}`}
                >
                  <img src={item.image} alt="" />
                  <span>{item.title}</span>
                </button>
              ))}
          </div>
        </details>
      )}
      {busy && <p role="status">Preparando imagem…</p>}
      {notice && <p role="alert">{notice}</p>}
      {pending && (
        <div className="material-pending">
          <h3>Confira antes de usar</h3>
          <img src={pending.image} alt={pending.title} />
          <label>
            Descrição da imagem
            <input
              className="quick-input"
              maxLength={120}
              value={pending.title}
              onChange={(e) => setPending({ ...pending, title: e.target.value })}
            />
          </label>
          <label>
            Fonte
            <input
              className="quick-input"
              maxLength={1000}
              value={pending.source}
              onChange={(e) => setPending({ ...pending, source: e.target.value })}
            />
          </label>
          <label>
            Permissão declarada
            <select
              className="quick-input"
              value={pending.permission}
              onChange={(e) =>
                setPending({ ...pending, permission: e.target.value as Material["permission"] })
              }
            >
              <option value="unknown">Não verificada · apenas referência</option>
              <option value="own">Declaro que é material próprio</option>
              <option value="licensed">Declaro que tenho licença</option>
            </select>
          </label>
          <div className="workspace-actions">
            <button
              type="button"
              className="quick-secondary"
              disabled={!pending.title.trim() || !pending.source.trim()}
              onClick={() => {
                if (apply(pending)) setPending(null);
              }}
            >
              Usar material
            </button>
            <button
              type="button"
              className="quick-text-button"
              onClick={() => {
                generation.current++;
                setBusy(false);
                setPending(null);
                setNotice("");
              }}
            >
              Cancelar seleção
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
