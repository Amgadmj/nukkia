import "./workspace-skeleton.css";

export type SkeletonLayout = "dashboard" | "calendar" | "editor" | "list";

export function WorkspaceSkeleton({
  layout = "dashboard",
  fullPage = false,
}: {
  layout?: SkeletonLayout;
  fullPage?: boolean;
}) {
  return (
    <div
      className={`workspace-skeleton${fullPage ? " workspace-skeleton-full" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={layout === "calendar" ? "Carregando calendário" : "Carregando conteúdo"}
    >
      {fullPage && (
        <aside className="skeleton-sidebar" aria-hidden="true">
          <div className="skeleton-block skeleton-heading" />
          {Array.from({ length: 8 }, (_, i) => (
            <div className="skeleton-block skeleton-line" key={i} />
          ))}
        </aside>
      )}
      <div className="skeleton-content" aria-hidden="true">
        <div className="skeleton-block skeleton-heading" />
        <div className="skeleton-block skeleton-description" />
        <div className={`skeleton-body skeleton-${layout}`}>
          {Array.from(
            { length: layout === "editor" ? 2 : layout === "calendar" ? 5 : 6 },
            (_, i) => (
              <div className="skeleton-panel" key={i}>
                <div className="skeleton-block skeleton-line" />
                <div className="skeleton-block skeleton-line skeleton-short" />
                {layout !== "calendar" && <div className="skeleton-block skeleton-preview" />}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
