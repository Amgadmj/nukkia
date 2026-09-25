import { Check, Circle, Image, MessageSquare, Palette, Type, FileText } from "lucide-react";
import { brandFonts, brandPalette, type BrandBookInput } from "@/lib/brand-story";

export function BrandIdentityOverview({
  brandKit,
  story,
  loading,
  error,
  storyUnavailable,
}: {
  brandKit: BrandBookInput["brandKit"];
  story: BrandBookInput["story"];
  loading: boolean;
  error: boolean;
  storyUnavailable: boolean;
}) {
  const assets = [
    { label: "Logo", saved: Boolean(brandKit?.logo_url?.trim()), icon: Image },
    { label: "Paleta", saved: brandPalette(brandKit?.palette).colors.length > 0, icon: Palette },
    {
      label: "Tipografia",
      saved: brandFonts(brandKit?.fonts).label !== "Não informada",
      icon: Type,
    },
    { label: "Tom de voz", saved: Boolean(brandKit?.tone?.trim()), icon: MessageSquare },
    { label: "História", saved: Boolean(story), icon: FileText },
  ];
  const complete = assets.filter((asset) => asset.saved).length;
  const known = !loading && !error;

  return (
    <section
      aria-label="Elementos salvos da identidade"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">A base da sua marca</h2>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Logo, cores e fontes dão consistência às peças. Voz e história orientam a mensagem.
          </p>
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {loading ? (
            "Carregando elementos salvos…"
          ) : error ? (
            "Progresso indisponível"
          ) : (
            <>
              <span className="font-semibold tabular-nums text-foreground">
                {complete} de {assets.length}
              </span>{" "}
              elementos salvos
            </>
          )}
        </p>
      </div>
      {known && (
        <div
          role="progressbar"
          aria-label="Elementos salvos"
          aria-valuemin={0}
          aria-valuemax={assets.length}
          aria-valuenow={complete}
          className="mt-5 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(complete / assets.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {assets.map(({ label, saved, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 rounded-lg bg-background/50 px-3 py-3"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium">{label}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {!known ? (
                  "A verificar"
                ) : label === "História" && storyUnavailable ? (
                  "Indisponível"
                ) : saved ? (
                  <>
                    <Check aria-hidden="true" className="size-3 text-primary" /> Salvo
                  </>
                ) : (
                  <>
                    <Circle aria-hidden="true" className="size-2.5" /> A adicionar
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Sugestões e alterações não salvas não contam neste progresso.
      </p>
    </section>
  );
}
