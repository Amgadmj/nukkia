import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowRight, Check, Download, LoaderCircle } from "lucide-react";
import type { DemoData } from "@/lib/quick-start";
import {
  briefIssues,
  creativeFingerprint,
  creativeStatus,
  composeContent,
  recommendContent,
  CONTENT_APPROACHES,
  firstPostBrief,
  reviseCreative,
  updateBrand,
  type PostCopy,
} from "@/lib/brand-preview";
import { postSvg, prepareAsset, publicationZip, renderPng, svgUrl } from "@/lib/post-art";
import { CompactAnswer } from "./brand-onboarding";
import { recordWorkspaceEvent } from "@/lib/marketing-workspace";
import { BrandSources } from "./brand-sources";

export function FirstPostWorkspace({
  data,
  onData,
  onEditBrief,
  onChooseApproach,
  onTrail,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onEditBrief: () => void;
  onChooseApproach: () => void;
  onTrail: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [page, setPage] = useState(0);
  const latest = useRef(data);
  latest.current = data;
  const creative = data.brand.creative;
  const issues = briefIssues(data);
  const status = creativeStatus(data);
  const fingerprint = creativeFingerprint(data);
  useEffect(() => {
    setReviewed(false);
    setNotice("");
  }, [fingerprint]);
  function compose() {
    onData((current) => {
      if (briefIssues(current).length) return current;
      return {
        ...current,
        brand: {
          ...current.brand,
          creative: composeContent(
            current,
            current.brand.creative?.approach ?? recommendContent(current).approach,
          ),
        },
      };
    });
  }
  const svgs = useMemo(
    () =>
      creative
        ? [
            creative.copy,
            ...creative.slides.map((slide) => ({ ...slide, caption: creative.copy.caption })),
          ].map((copy, index, pages) =>
            postSvg(firstPostBrief(data), copy, data.brand, {
              approach: creative.approach,
              page: index + 1,
              total: pages.length,
            }),
          )
        : [],
    [data, creative],
  );
  const activePage = Math.min(page, Math.max(0, svgs.length - 1));
  const activeCopy = activePage ? creative?.slides[activePage - 1] : creative?.copy;
  const svg = svgs[activePage] ?? "";
  function editCopy(key: keyof PostCopy, value: string) {
    onData((current) =>
      current.brand.creative
        ? {
            ...current,
            brand: {
              ...current.brand,
              creative:
                activePage > 0 && key !== "caption"
                  ? {
                      ...current.brand.creative,
                      slides: current.brand.creative.slides.map((slide, index) =>
                        index === activePage - 1 ? { ...slide, [key]: value } : slide,
                      ),
                      review: "needs-review",
                      approved: null,
                      exported: null,
                    }
                  : reviseCreative(current.brand.creative, {
                      ...current.brand.creative.copy,
                      [key]: value,
                    }),
            },
          }
        : current,
    );
    setNotice("");
  }
  async function upload(file: File | undefined, kind: "logo" | "photo") {
    if (!file) return;
    try {
      const asset = await prepareAsset(file, kind === "logo");
      onData((current) => ({
        ...current,
        brand: updateBrand(current.brand, {
          [kind]: asset,
          ...(kind === "logo" ? { assetSource: "Arquivo fornecido por você" } : {}),
        }),
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a imagem.");
    }
  }
  async function download() {
    if (!status.approved || !creative || exporting) return;
    const version = fingerprint;
    setExporting(true);
    setNotice("");
    try {
      const png = await Promise.all(svgs.map(renderPng));
      if (
        creativeFingerprint(latest.current) !== version ||
        !creativeStatus(latest.current).approved
      )
        throw new Error(
          "A peça mudou durante a preparação. Revise a versão atual antes de baixar.",
        );
      const bytes = publicationZip(
        png,
        creative.copy.caption,
        data.brand.research.sources.map((source) => source.url),
      );
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "nukkia-primeira-publicacao.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      onData((current) =>
        current.brand.creative && creativeFingerprint(current) === version
          ? recordWorkspaceEvent(
              {
                ...current,
                brand: {
                  ...current.brand,
                  creative: { ...current.brand.creative, exported: version },
                },
              },
              "exported",
            )
          : current,
      );
      setNotice(
        "Download iniciado: arte PNG + legenda. +30 XP. Nada foi publicado nas suas redes.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível baixar agora.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="brand-first-post">
      <div className="brand-workspace-heading">
        <div>
          <p className="quick-eyebrow">
            {data.brand.confirmed
              ? "SEU CONTEXTO VIROU UM PONTO DE PARTIDA · +20 XP"
              : "VAMOS PREPARAR SEU PONTO DE PARTIDA"}
          </p>
          <h1>Sua marca. Sua primeira peça.</h1>
          <p className="quick-dashboard-intro">
            Uma composição inicial com o que você confirmou. Dê seu toque antes de levar para o
            mundo.
          </p>
        </div>
        <button className="quick-text-button" onClick={onTrail}>
          Minha trilha <ArrowRight size={16} />
        </button>
      </div>
      <div className="brand-focus">
        <span>SEU PRIMEIRO FOCO</span>
        <strong>{data.answers.goals}</strong>
        {creative && (
          <p>{CONTENT_APPROACHES.find((option) => option.id === creative.approach)?.format}</p>
        )}
        <button className="quick-text-button" onClick={onChooseApproach}>
          Por que esta peça? / Escolher outra abordagem
        </button>
      </div>
      {(issues.length > 0 || status.stale) && (
        <div className="brand-review-note" role="status">
          <p>
            {issues[0] ||
              "O contexto mudou. Preservamos sua edição; prepare uma nova versão com os dados atuais."}
          </p>
          <button className="quick-text-button" onClick={onEditBrief}>
            Revisar contexto <ArrowRight size={15} />
          </button>
          {!issues.length && (
            <button
              className="quick-secondary"
              onClick={() => {
                if (
                  window.confirm(
                    "Criar uma nova composição com o contexto atual? O texto em edição será substituído.",
                  )
                )
                  compose();
              }}
            >
              Preparar nova versão
            </button>
          )}
        </div>
      )}
      {creative ? (
        <div className="brand-studio">
          <div className="brand-art-column">
            {svgs.length > 1 && (
              <nav className="brand-page-tabs" aria-label="Páginas do carrossel">
                {svgs.map((_, index) => (
                  <button
                    key={index}
                    aria-current={index === activePage ? "page" : undefined}
                    onClick={() => setPage(index)}
                  >
                    Página {index + 1}
                  </button>
                ))}
              </nav>
            )}
            <img
              className="brand-post-art"
              src={svgUrl(svg)}
              alt={`Prévia da publicação de ${data.name}, página ${activePage + 1}: ${activeCopy?.title}`}
              width={1080}
              height={1350}
            />
            <p className="brand-microcopy">1080 × 1350 · imagem + legenda · publicação manual</p>
            <details className="brand-source-details">
              <summary>De onde veio esta prévia?</summary>
              <p>
                {creative.origin === "manual"
                  ? "Composição local com os dados que você confirmou. Não houve pesquisa por IA nem revisão automática de conteúdo."
                  : "Criada com o contexto confirmado da marca. A revisão final é sua."}
              </p>
              <BrandSources research={data.brand.research} includeDiscovered={false} />
            </details>
          </div>
          <div className="brand-edit-column">
            <div className="brand-editor-title">
              <span>{status.approved ? "APROVADA POR VOCÊ" : "PRÉVIA EDITÁVEL"}</span>
              <button className="quick-text-button" onClick={onEditBrief}>
                Editar briefing
              </button>
            </div>
            <div className="brand-fields">
              <CompactAnswer
                label="Título da arte"
                maxLength={78}
                value={activeCopy?.title ?? ""}
                onChange={(value) => editCopy("title", value)}
              />
              <CompactAnswer
                label="Mensagem na arte"
                maxLength={180}
                value={activeCopy?.body ?? ""}
                onChange={(value) => editCopy("body", value)}
              />
              <CompactAnswer
                label="Legenda"
                maxLength={1800}
                value={creative.copy.caption}
                onChange={(value) => editCopy("caption", value)}
              />
            </div>
            <details className="brand-assets" open>
              <summary>
                Deixe com a cara da sua marca{" "}
                <span>
                  {creative.approach === "trust" || data.brand.visualStyle === "warm"
                    ? "Foto necessária"
                    : "Opcional"}
                </span>
              </summary>
              <div className="brand-asset-controls">
                <label>
                  Logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      void upload(event.target.files?.[0], "logo");
                      event.target.value = "";
                    }}
                  />
                </label>
                {(creative.approach !== "educate" || data.brand.visualStyle === "warm") && (
                  <label>
                    Foto
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        void upload(event.target.files?.[0], "photo");
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
                <label className="brand-color-label">
                  Cor
                  <input
                    type="color"
                    value={data.brand.accent}
                    onChange={(event) =>
                      onData((current) => ({
                        ...current,
                        brand: updateBrand(current.brand, { accent: event.target.value }),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="brand-asset-removals">
                {data.brand.logo && (
                  <button
                    onClick={() =>
                      onData((current) => ({
                        ...current,
                        brand: updateBrand(current.brand, { logo: "", assetSource: "" }),
                      }))
                    }
                  >
                    Remover logo
                  </button>
                )}
                {data.brand.photo && (
                  <button
                    onClick={() =>
                      onData((current) => ({
                        ...current,
                        brand: updateBrand(current.brand, { photo: "" }),
                      }))
                    }
                  >
                    Remover foto
                  </button>
                )}
              </div>
              {data.brand.research.logo && !data.brand.logo && (
                <button
                  className="quick-text-button"
                  onClick={() =>
                    onData((current) => ({
                      ...current,
                      brand: updateBrand(current.brand, {
                        logo: current.brand.research.logo,
                        assetSource: current.brand.research.logoSource,
                      }),
                    }))
                  }
                >
                  Usar logo encontrado no site
                </button>
              )}
            </details>
            {creative.reviewNotes.length > 0 && (
              <div className="brand-review-note">
                {creative.reviewNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
            {status.contentIssues.length > 0 && (
              <div className="brand-review-note" role="status">
                {status.contentIssues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            )}
            <label className="brand-review-check">
              <input
                type="checkbox"
                checked={reviewed || status.approved}
                disabled={status.approved}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                Conferi todas as páginas, os fatos, a oferta e a chamada. A imagem representa minha
                marca e tenho permissão para usá-la.
              </span>
            </label>
            <div className="brand-delivery-actions">
              <button
                className="quick-primary"
                disabled={!reviewed || !status.valid || status.approved}
                onClick={() => {
                  onData((current) =>
                    current.brand.creative && creativeStatus(current).valid
                      ? recordWorkspaceEvent(
                          {
                            ...current,
                            brand: {
                              ...current.brand,
                              creative: {
                                ...current.brand.creative,
                                approved: creativeFingerprint(current),
                                exported: null,
                              },
                            },
                          },
                          "approved",
                        )
                      : current,
                  );
                  setNotice("Peça aprovada por você. +40 XP. Agora você pode baixar o conjunto.");
                }}
              >
                <Check size={16} />
                {status.approved ? "Peça aprovada" : "Aprovar esta peça"}
              </button>
              <button
                className="quick-secondary"
                disabled={!status.approved || exporting}
                onClick={() => void download()}
              >
                {exporting ? (
                  <LoaderCircle className="brand-spin" size={16} />
                ) : (
                  <Download size={16} />
                )}
                Baixar arte + legenda
              </button>
            </div>
            <p className="brand-microcopy">
              Revise também as regras do seu setor. Esta prévia não certifica conformidade nem
              garante resultados.
            </p>
          </div>
        </div>
      ) : (
        <button className="quick-primary" disabled={issues.length > 0} onClick={compose}>
          Criar composição editável <ArrowRight size={16} />
        </button>
      )}
      {notice && (
        <p className="brand-review-note" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
