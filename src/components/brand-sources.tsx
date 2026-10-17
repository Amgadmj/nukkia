import {
  ArrowUpRight,
  Check,
  Facebook,
  FileText,
  Globe2,
  Instagram,
  Linkedin,
  Pencil,
  X,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { BrandResearch } from "@/lib/brand-preview";
import { groupBrandSources, type SourceIdentity } from "@/lib/brand-sources";

function TikTokIcon({ size = 17, className = "", ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} brand-source-icon-tiktok`}
      {...props}
    >
      <path d="M16.6 2h-3.3v13.4a3 3 0 1 1-2.6-3V9.1a6.3 6.3 0 1 0 5.9 6.3V8.7a8.1 8.1 0 0 0 4.7 1.5V6.9A4.9 4.9 0 0 1 16.6 2Z" />
    </svg>
  );
}

export function BrandSources({
  research,
  showMaterial = false,
  showVerificationNote = true,
  showResearchDocument = true,
  includeDiscovered = true,
  extraLinks = [],
  excludedKeys = [],
  onRemove,
  editor,
}: {
  research: BrandResearch;
  showMaterial?: boolean;
  showVerificationNote?: boolean;
  showResearchDocument?: boolean;
  includeDiscovered?: boolean;
  extraLinks?: string[];
  excludedKeys?: string[];
  onRemove?: (key: string) => void;
  editor?: {
    current: { key: string; value: string } | null;
    onStart: (source: SourceIdentity) => void;
    onChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
  };
}) {
  const groups = groupBrandSources(research, extraLinks).filter(
    (group) => !excludedKeys.includes(group.key) && (includeDiscovered || group.pages.length > 0),
  );
  if (!groups.length) return null;
  return (
    <section className="brand-sources" aria-label="Links da sua clínica:">
      <p className="brand-sources-heading">
        Links da sua clínica: <span>{groups.length}</span>
      </p>
      <ul className="brand-sources-list">
        {groups.map((group) => {
          const Icon =
            group.kind === "Instagram"
              ? Instagram
              : group.kind === "Facebook"
                ? Facebook
                : group.kind === "LinkedIn"
                  ? Linkedin
                  : group.kind === "TikTok"
                    ? TikTokIcon
                    : group.kind === "Texto"
                      ? FileText
                      : Globe2;
          const read = group.pages.length > 0;
          const editing = editor?.current?.key === group.key;
          return (
            <li className="brand-source-item" key={group.key}>
              <div className="brand-source-row">
                <Icon className="brand-source-icon" size={17} aria-hidden="true" />
                <div className="brand-source-label">
                  {editing && editor ? (
                    <input
                      className="brand-source-input"
                      aria-label={`Link de ${group.kind}`}
                      type="text"
                      inputMode="url"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={2048}
                      value={editor.current!.value}
                      onChange={(event) => editor.onChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          editor.onSave();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          editor.onCancel();
                        }
                      }}
                    />
                  ) : group.url ? (
                    <a
                      href={group.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir ${group.kind}: ${group.label}`}
                    >
                      <span>{group.label}</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  ) : (
                    <strong>{group.label}</strong>
                  )}
                  {showMaterial && (
                    <span>
                      {group.kind} ·{" "}
                      {read
                        ? group.kind === "Texto"
                          ? "Fornecido por você"
                          : `${group.pages.length} ${group.pages.length === 1 ? "página lida" : "páginas lidas"}`
                        : "Conteúdo não consultado"}
                    </span>
                  )}
                </div>
                {editor &&
                  group.url &&
                  (editing ? (
                    <>
                      <button
                        type="button"
                        className="brand-source-action"
                        aria-label={`Salvar link de ${group.kind}`}
                        title="Salvar link"
                        onClick={editor.onSave}
                      >
                        <Check size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="brand-source-action"
                        aria-label={`Cancelar edição de ${group.kind}`}
                        title="Cancelar"
                        onClick={editor.onCancel}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="brand-source-action"
                      aria-label={`Editar ${group.kind}: ${group.label}`}
                      title="Editar link ou @perfil"
                      disabled={!!editor.current}
                      onClick={() => editor.onStart(group)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  ))}
                {onRemove && !editing && (
                  <button
                    type="button"
                    className="brand-source-remove shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remover ${group.kind}: ${group.label}`}
                    disabled={!!editor?.current}
                    onClick={() => onRemove(group.key)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {read && showMaterial && (
                <details className="brand-source-evidence">
                  <summary>Consultar material</summary>
                  {group.pages.map((page) => (
                    <div key={page.url}>
                      {group.url ? (
                        <a href={page.url} target="_blank" rel="noreferrer">
                          {page.title || page.url} ↗
                        </a>
                      ) : (
                        <strong>{page.title}</strong>
                      )}
                      {!Number.isNaN(Date.parse(page.fetchedAt)) && (
                        <small>
                          Lido em {new Date(page.fetchedAt).toLocaleDateString("pt-BR")}
                        </small>
                      )}
                      <p>{page.text}</p>
                    </div>
                  ))}
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {showResearchDocument && research.evidenceMarkdown && (
        <details className="brand-source-evidence">
          <summary>Consultar documento de pesquisa</summary>
          <a
            download="perfil-clinica-evidencias.md"
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(research.evidenceMarkdown)}`}
          >
            Baixar Markdown das evidências
          </a>
          <pre className="clinic-evidence-document">{research.evidenceMarkdown}</pre>
        </details>
      )}
      {!showMaterial && showVerificationNote && (
        <p className="brand-sources-note">Confira se estes endereços pertencem à sua marca.</p>
      )}
    </section>
  );
}
