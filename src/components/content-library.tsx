import { ContentCalendar, CalendarTimezone } from "./content-calendar";
import { localCalendarDate } from "@/lib/content-calendar";
import { resolveHealthMaterial } from "@/lib/health-studio";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { DemoData } from "@/lib/quick-start";
import {
  archiveLibraryItem,
  duplicateLibraryItem,
  planLibraryVersion,
  resumeLibraryVersion,
  saveLibraryVersion,
  saveNewLibraryItem,
  type LibraryKind,
  type LibraryItem,
  type PlanningChannel,
} from "@/lib/content-library";
import { postSvg, svgUrl } from "@/lib/post-art";
import { firstPostBrief } from "@/lib/brand-preview";

const channelLabels = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  website: "Site",
  undecided: "Canal a definir",
} as const;

type Props = {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onOpen: (view: "peca" | "saude" | "biblioteca") => void;
};
export function SaveToLibrary({
  data,
  onData,
  kind,
  onLibrary,
}: Omit<Props, "onOpen"> & { kind: LibraryKind; onLibrary: () => void }) {
  const [notice, setNotice] = useState("");
  const activeId = kind === "generic" ? data.library.activeGeneric : data.library.activeHealth;
  const active = data.library.items.find((item) => item.id === activeId);
  function save(asNew = false) {
    try {
      const next = asNew
        ? saveNewLibraryItem(data, kind)
        : saveLibraryVersion(data, kind, active?.versions.length ?? 0);
      onData(next);
      setNotice(
        "Versão adicionada ao espaço de trabalho. Confira o estado de salvamento antes de sair.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível guardar a versão.");
    }
  }
  return (
    <section className="workspace-card library-save" aria-label="Salvar versão">
      <p>
        Guarde uma versão para retomar ou planejar depois.{" "}
        {active
          ? `Este item tem ${active.versions.length} versão(ões).`
          : "Um novo item será criado."}
      </p>
      <div className="workspace-actions">
        <button
          className="quick-secondary"
          onClick={() => save()}
          disabled={kind === "generic" ? !data.brand.creative : !data.healthStudio.selectedOption}
        >
          Guardar versão na biblioteca
        </button>
        {active && (
          <button
            className="quick-secondary"
            onClick={() => save(true)}
            disabled={kind === "generic" ? !data.brand.creative : !data.healthStudio.selectedOption}
          >
            Guardar como novo item
          </button>
        )}
        <button className="quick-text-button" onClick={onLibrary}>
          Abrir biblioteca
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
export function ContentLibrary({
  data,
  onData,
  onOpen,
  planning = false,
}: Props & { planning?: boolean }) {
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState(() => localCalendarDate().slice(0, 7));
  function apply(action: () => DemoData) {
    try {
      onData(action());
      setNotice("Alteração adicionada ao espaço de trabalho. Confira o estado de salvamento.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível alterar o item.");
      return false;
    }
  }
  const items = data.library.items
    .filter((item) => {
      if (item.archived !== (planning ? false : archived) || (planning && !item.plan)) return false;
      const snapshot = (
        item.versions.find((saved) => saved.version === versionOf(item)) || item.versions.at(-1)!
      ).snapshot;
      const format =
        snapshot.kind === "health"
          ? "health"
          : snapshot.brand.creative?.slides.length
            ? "carousel"
            : "image";
      const state =
        snapshot.kind === "health" ? "health" : snapshot.approved ? "approved" : "draft";
      return (filter === "all" || format === filter) && (status === "all" || state === status);
    })
    .sort((a, b) =>
      planning
        ? (a.plan?.date ?? "").localeCompare(b.plan?.date ?? "")
        : b.versions.at(-1)!.savedAt.localeCompare(a.versions.at(-1)!.savedAt),
    );
  function versionOf(item: LibraryItem) {
    return planning ? item.plan!.version : (selected[item.id] ?? item.versions.at(-1)!.version);
  }
  return (
    <div className="workspace-page">
      <header>
        <h1>{planning ? "Seu calendário de conteúdo" : "Biblioteca"}</h1>
        <p>
          {planning
            ? "Organize cada entrega por dia, horário e canal."
            : "Versões do seu espaço de trabalho. Retome o texto com o contexto atual da marca; a aprovação precisa ser refeita."}
        </p>
      </header>
      <div className="library-filters">
        <label>
          Formato
          <select
            className="quick-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="image">Imagem</option>
            <option value="carousel">Carrossel</option>
            <option value="health">Roteiro de saúde</option>
          </select>
        </label>
        <label>
          Estado
          <select
            className="quick-input"
            aria-label="Estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos os estados</option>
            <option value="draft">Rascunho criativo</option>
            <option value="approved">Aprovação criativa registrada</option>
            <option value="health">Roteiro sem revisão profissional</option>
          </select>
        </label>
        {planning ? (
          <label>
            Mês
            <input
              className="quick-input"
              type="month"
              value={month}
              onChange={(event) => {
                if (/^\d{4}-\d{2}$/.test(event.target.value)) {
                  setMonth(event.target.value);
                  setActivePlan(null);
                }
              }}
            />
          </label>
        ) : (
          <label>
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />{" "}
            Mostrar arquivados
          </label>
        )}
      </div>
      {notice && (
        <p role="status" className="brand-review-note">
          {notice}
        </p>
      )}
      {!planning && !items.length && (
        <section className="workspace-card">
          <h2>{planning ? "Nenhuma versão planejada neste mês" : "Nenhum item nesta seleção"}</h2>
          <p>
            {planning
              ? "Abra a biblioteca, escolha uma versão e informe a data pretendida."
              : "Prepare uma peça ou um roteiro e use Guardar versão na biblioteca."}
          </p>
          <button
            className="quick-secondary"
            onClick={() => onOpen(planning ? "biblioteca" : "peca")}
          >
            {planning ? "Abrir biblioteca" : "Abrir editor da peça"}
          </button>
        </section>
      )}
      {planning && (
        <ContentCalendar
          items={items}
          allItems={data.library.items}
          month={month}
          onMonth={(value) => {
            setMonth(value);
            setActivePlan(null);
          }}
          activeId={activePlan}
          onSelect={setActivePlan}
          onPlan={(id, version, date, channel, timing) => {
            const saved = apply(() => planLibraryVersion(data, id, version, date, channel, timing));
            if (saved) {
              setFilter("all");
              setStatus("all");
            }
            return saved;
          }}
        />
      )}
      <div className={planning ? "planning-detail" : "library-grid"}>
        {items
          .filter((item) => !planning || item.id === activePlan)
          .map((item) => {
            const version = versionOf(item);
            const saved =
              item.versions.find((saved) => saved.version === version) ?? item.versions.at(-1)!;
            const snapshot = saved.snapshot;
            const creative = snapshot.kind === "generic" ? snapshot.brand.creative : null;
            const option =
              snapshot.kind === "health"
                ? snapshot.draft.options.find(
                    (option) => option.id === snapshot.draft.selectedOption,
                  )
                : null;
            return (
              <article className="workspace-card library-item" key={item.id}>
                {snapshot.kind === "generic" && creative ? (
                  <img
                    className="library-thumbnail"
                    alt={`Prévia da versão ${saved.version}: ${creative.copy.title}`}
                    src={svgUrl(
                      postSvg(
                        firstPostBrief({
                          name: snapshot.name,
                          segment: snapshot.segment,
                          answers: {
                            offers: snapshot.offer,
                            audience: snapshot.audience,
                            goals: snapshot.goal,
                          },
                          brand: snapshot.brand,
                        }),
                        creative.copy,
                        snapshot.brand,
                        { approach: creative.approach, page: 1, total: creative.slides.length + 1 },
                      ),
                    )}
                  />
                ) : (
                  <div className="library-thumbnail library-script">
                    <strong>{option?.scenes[0]?.heading ?? "Roteiro"}</strong>
                    <p>{option?.scenes[0]?.script}</p>
                  </div>
                )}
                <h2>{creative?.copy.title || option?.title || item.title || "Peça sem título"}</h2>
                {item.title !== (creative?.copy.title ?? option?.title) && (
                  <p>Item: {item.title}</p>
                )}
                <p>
                  {snapshot.kind === "health"
                    ? "Roteiro fictício · sem revisão profissional"
                    : snapshot.approved
                      ? "Aprovação criativa registrada nesta versão · sem revisão clínica"
                      : "Rascunho criativo"}
                </p>
                <p>
                  {snapshot.kind === "health"
                    ? "Roteiro de saúde"
                    : creative?.slides.length
                      ? "Carrossel"
                      : "Imagem"}{" "}
                  · {new Date(saved.savedAt).toLocaleString("pt-BR")}
                </p>
                <label>
                  Versão
                  <select
                    className="quick-input"
                    value={saved.version}
                    disabled={planning}
                    onChange={(event) =>
                      setSelected({ ...selected, [item.id]: Number(event.target.value) })
                    }
                  >
                    {item.versions.map((saved) => (
                      <option key={saved.version} value={saved.version}>
                        Versão {saved.version} · {new Date(saved.savedAt).toLocaleString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </label>
                <details>
                  <summary>Inspecionar texto e origem</summary>
                  <p>
                    ID: {item.id} · versão {saved.version}
                  </p>
                  {snapshot.kind === "generic" ? (
                    <>
                      <p>
                        Marca na versão: {snapshot.name} · oferta: {snapshot.offer}
                      </p>
                      <p>
                        Origem:{" "}
                        {creative?.origin === "manual"
                          ? "Composição local e edição manual"
                          : "Rascunho assistido"}
                      </p>
                      {snapshot.brand.serviceBrief && (
                        <p>
                          Serviço: {snapshot.brand.serviceBrief.offer} · fonte:{" "}
                          {snapshot.brand.serviceBrief.source || "Informada pela equipe"} · revisão
                          do catálogo: {snapshot.brand.serviceBrief.catalogRevision}
                        </p>
                      )}
                      {snapshot.brand.inspirationBrief.map((reference) => (
                        <div key={reference.id}>
                          {reference.image && (
                            <img
                              className="library-thumbnail"
                              src={reference.image}
                              alt={reference.title}
                            />
                          )}
                          <p>
                            Direção visual: {reference.title} · {reference.source || reference.url}{" "}
                            · {reference.note} · permissão declarada, não verificada
                          </p>
                        </div>
                      ))}
                      <h3>Página 1 · {creative?.copy.title}</h3>
                      <p>{creative?.copy.body}</p>
                      {snapshot.brand.pieceBrief && (
                        <p>
                          Ideia: {snapshot.brand.pieceBrief.idea} · Restrições:{" "}
                          {snapshot.brand.pieceBrief.constraints || "Nenhuma informada"}
                        </p>
                      )}
                      <p className="library-copy">{creative?.copy.caption}</p>
                      {creative?.slides.map((slide, index) => (
                        <p key={index}>
                          {slide.title} — {slide.body}
                        </p>
                      ))}
                      <p>
                        Fonte da identidade:{" "}
                        {snapshot.brand.assetSource || "Informada no espaço de trabalho"}
                      </p>
                    </>
                  ) : (
                    option?.scenes.map((scene) => (
                      <div key={scene.id}>
                        <p>
                          {scene.seconds}s · {scene.heading}: {scene.script}
                        </p>
                        {scene.material && (
                          <figure className="material-current">
                            <img
                              src={
                                snapshot.kind === "health"
                                  ? resolveHealthMaterial(snapshot.draft, scene.material)?.image
                                  : ""
                              }
                              alt={scene.material.title}
                            />
                            <figcaption>
                              {scene.material.source} · permissão declarada, não verificada
                            </figcaption>
                          </figure>
                        )}
                      </div>
                    ))
                  )}
                </details>
                {!item.archived && (
                  <label>
                    Data pretendida para esta versão
                    <input
                      className="quick-input"
                      type="date"
                      value={item.plan?.version === saved.version ? item.plan.date : ""}
                      onChange={(event) =>
                        apply(() =>
                          planLibraryVersion(data, item.id, saved.version, event.target.value),
                        )
                      }
                    />
                  </label>
                )}
                {!item.archived && item.plan?.version === saved.version && (
                  <>
                    <label>
                      Horário pretendido
                      <input
                        className="quick-input"
                        type="time"
                        value={item.plan.time ?? ""}
                        onInput={(event) => {
                          const time = event.currentTarget.value;
                          apply(() =>
                            planLibraryVersion(
                              data,
                              item.id,
                              saved.version,
                              item.plan!.date,
                              undefined,
                              {
                                time,
                                timezone: item.plan!.timezone ?? "America/Sao_Paulo",
                              },
                            ),
                          );
                        }}
                        onChange={(event) =>
                          apply(() =>
                            planLibraryVersion(
                              data,
                              item.id,
                              saved.version,
                              item.plan!.date,
                              undefined,
                              {
                                time: event.target.value,
                                timezone: item.plan!.timezone ?? "America/Sao_Paulo",
                              },
                            ),
                          )
                        }
                      />
                    </label>
                    <CalendarTimezone
                      value={item.plan.timezone ?? "America/Sao_Paulo"}
                      onChange={(timezone) =>
                        apply(() =>
                          planLibraryVersion(
                            data,
                            item.id,
                            saved.version,
                            item.plan!.date,
                            undefined,
                            { timezone },
                          ),
                        )
                      }
                    />
                  </>
                )}
                {!item.archived && (
                  <label>
                    Canal pretendido
                    <select
                      className="quick-input"
                      aria-label="Canal pretendido"
                      disabled={item.plan?.version !== saved.version}
                      value={
                        item.plan?.version === saved.version
                          ? (item.plan.channel ?? "undecided")
                          : "undecided"
                      }
                      onChange={(event) =>
                        apply(() =>
                          planLibraryVersion(
                            data,
                            item.id,
                            saved.version,
                            item.plan!.date,
                            event.target.value as PlanningChannel,
                          ),
                        )
                      }
                    >
                      <option value="undecided">A definir</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="website">Site</option>
                    </select>
                    <small>Canal de intenção, sem publicação automática.</small>
                  </label>
                )}
                {item.plan && !item.archived && (
                  <button
                    className="quick-text-button"
                    onClick={() =>
                      apply(() => planLibraryVersion(data, item.id, item.plan!.version, ""))
                    }
                  >
                    Remover do planejamento
                  </button>
                )}
                {item.plan && (
                  <p>
                    {item.archived ? "Data preservada no arquivo:" : "Planejado para"}{" "}
                    {item.plan.date.split("-").reverse().join("/")}{" "}
                    {item.plan.time && `às ${item.plan.time}`}{" "}
                    {item.plan.timezone && `(${item.plan.timezone})`} · versão {item.plan.version}.
                    Não publicado.
                  </p>
                )}
                <div className="workspace-actions">
                  {!item.archived && (
                    <button
                      className="quick-primary"
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Retomar esta versão no editor? Guarde antes as edições atuais que deseja manter. O contexto atual da marca será preservado e a aprovação deverá ser refeita.",
                          )
                        )
                          return;
                        if (apply(() => resumeLibraryVersion(data, item.id, saved.version)))
                          onOpen(item.kind === "generic" ? "peca" : "saude");
                      }}
                    >
                      Editar versão {saved.version}
                    </button>
                  )}
                  <button
                    className="quick-secondary"
                    onClick={() => apply(() => duplicateLibraryItem(data, item.id, saved.version))}
                  >
                    Duplicar versão
                  </button>
                  <button
                    className="quick-text-button"
                    onClick={() => apply(() => archiveLibraryItem(data, item.id, !item.archived))}
                  >
                    {item.archived ? "Restaurar item" : "Arquivar item"}
                  </button>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}

/** Reuse the existing immutable snapshots; never create a second material store. */
export function SavedContentPicker({ data, onData, onOpen }: Props) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const items = data.library.items.filter((item) => !item.archived && item.kind === "generic");
  return (
    <details className="workspace-card saved-content-picker">
      <summary>Reutilizar conteúdo da biblioteca</summary>
      <p>
        Escolha uma versão para retomar seu texto. O contexto e a identidade atuais são mantidos; a
        peça precisa de nova aprovação.
      </p>
      {!items.length && (
        <p>
          Nenhuma peça guardada. Use Guardar versão na biblioteca no editor para reutilizá-la
          depois.
        </p>
      )}
      {notice && <p role="alert">{notice}</p>}
      <div className="saved-content-strip">
        {items.map((item) => {
          const saved =
            item.versions.find((version) => version.version === selected[item.id]) ||
            item.versions.at(-1)!;
          const snapshot = saved.snapshot;
          if (snapshot.kind !== "generic" || !snapshot.brand.creative) return null;
          const creative = snapshot.brand.creative;
          return (
            <article key={item.id}>
              <img
                alt={`Prévia guardada: ${creative.copy.title}`}
                src={svgUrl(
                  postSvg(
                    firstPostBrief({
                      name: snapshot.name,
                      segment: snapshot.segment,
                      answers: {
                        offers: snapshot.offer,
                        audience: snapshot.audience,
                        goals: snapshot.goal,
                      },
                      brand: snapshot.brand,
                    }),
                    creative.copy,
                    snapshot.brand,
                    { approach: creative.approach, page: 1, total: creative.slides.length + 1 },
                  ),
                )}
              />
              <h3>{creative.copy.title}</h3>
              {item.title !== creative.copy.title && <p>Item: {item.title}</p>}
              <p>
                {creative?.slides.length ? "Carrossel" : "Imagem"} ·{" "}
                {new Date(saved.savedAt).toLocaleString("pt-BR")}
              </p>
              <label>
                Versão a reutilizar
                <select
                  className="quick-input"
                  value={saved.version}
                  onChange={(event) =>
                    setSelected({ ...selected, [item.id]: Number(event.target.value) })
                  }
                >
                  {item.versions.map((version) => (
                    <option key={version.version} value={version.version}>
                      Versão {version.version} · {new Date(version.savedAt).toLocaleString("pt-BR")}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Fonte:{" "}
                {snapshot.brand.serviceBrief?.source ||
                  snapshot.brand.assetSource ||
                  "Contexto informado pela marca"}
                . Direitos não verificados.
              </p>
              <button
                className="quick-secondary"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Retomar esta versão? Guarde antes as edições atuais que deseja manter. A aprovação deverá ser refeita.",
                    )
                  )
                    return;
                  try {
                    onData(resumeLibraryVersion(data, item.id, saved.version));
                    setNotice("");
                    onOpen("peca");
                  } catch (error) {
                    setNotice(
                      error instanceof Error ? error.message : "Não foi possível retomar a versão.",
                    );
                  }
                }}
              >
                Usar versão {saved.version}
              </button>
            </article>
          );
        })}
      </div>
    </details>
  );
}
