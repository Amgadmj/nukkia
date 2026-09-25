import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  identityIssues,
  recommendedVisualStyle,
  updateBrand,
  VISUAL_STYLES,
} from "@/lib/brand-preview";
import { prepareAsset } from "@/lib/post-art";
import type { DemoData } from "@/lib/quick-start";

export function BrandIdentitySettings({
  data,
  onData,
  onContinue,
  savedAccent,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onContinue: () => void;
  savedAccent?: string | undefined;
}) {
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef(true);
  const latest = useRef(data.brand);
  latest.current = data.brand;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const selected = data.brand.visualStyle ?? recommendedVisualStyle(data);
  const photoRequired = selected === "warm" || data.brand.preferredApproach === "trust";
  const missing = identityIssues({ ...data.brand, visualStyle: selected });
  if (photoRequired && !data.brand.photo && !missing.length)
    missing.push("Adicione uma foto própria ou escolha um formato sem foto.");

  async function upload(file: File | undefined, kind: "logo" | "photo") {
    if (!file) return;
    const original = latest.current;
    setUploading(true);
    setNotice("");
    try {
      const asset = await prepareAsset(file, kind === "logo");
      if (!active.current) return;
      if (latest.current !== original) {
        setNotice(
          "A peça mudou durante o envio. Confira a versão atual e escolha a imagem novamente.",
        );
        return;
      }
      onData((current) =>
        current.brand === original
          ? { ...current, brand: updateBrand(current.brand, { [kind]: asset }) }
          : current,
      );
      setNotice("Imagem adicionada à peça. Revise antes de aprovar.");
    } catch (error) {
      if (active.current)
        setNotice(error instanceof Error ? error.message : "Não foi possível abrir a imagem.");
    } finally {
      if (active.current) setUploading(false);
    }
  }

  return (
    <details id="ajustes-peca" className="scroll-mt-40 rounded-xl border border-border bg-card">
      <summary className="cursor-pointer rounded-xl px-5 py-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        Ajustes desta peça
      </summary>
      <div className="space-y-5 border-t border-border p-5">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Logo, foto, cor e estilo da peça atual. Alterações preservam o texto e pedem nova
          aprovação. O kit da marca é salvo separadamente.
        </p>
        <fieldset disabled={uploading} className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="piece-visual-style">Estilo desta peça</Label>
            <select
              id="piece-visual-style"
              value={selected}
              className="flex min-h-11 w-full max-w-lg rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onChange={(event) => {
                const visualStyle = VISUAL_STYLES.find(
                  (style) => style.id === event.target.value,
                )?.id;
                if (visualStyle)
                  onData((current) => ({
                    ...current,
                    brand: updateBrand(current.brand, { visualStyle }),
                  }));
              }}
            >
              {VISUAL_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {(["logo", "photo"] as const).map((kind) => (
              <div key={kind} className="min-w-0 space-y-3">
                <Label htmlFor={`piece-${kind}`}>
                  {kind === "logo"
                    ? "Logo desta peça"
                    : `Foto desta peça · ${photoRequired ? "necessária" : "opcional"}`}
                </Label>
                {data.brand[kind] ? (
                  <img
                    src={data.brand[kind]}
                    alt={kind === "logo" ? "Logo atual da peça" : "Foto fornecida para esta peça"}
                    className="h-28 max-w-full rounded-lg border border-border bg-muted p-2 object-contain"
                  />
                ) : kind === "logo" && data.brand.research.logo ? (
                  <div className="space-y-2">
                    <img
                      src={data.brand.research.logo}
                      alt="Logo encontrado no site da marca"
                      className="h-28 max-w-full rounded-lg bg-muted p-2 object-contain"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-10 whitespace-normal"
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
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {kind === "logo" ? "Sem logo na peça." : "Nenhuma foto adicionada à peça."}
                  </p>
                )}
                <Input
                  id={`piece-${kind}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-describedby="piece-assets-help"
                  onChange={(event) => {
                    void upload(event.target.files?.[0], kind);
                    event.target.value = "";
                  }}
                />
              </div>
            ))}
          </div>
          <p id="piece-assets-help" className="text-xs text-muted-foreground">
            Materiais desta peça: PNG, JPG ou WebP de até 5 MB. Use fotos próprias ou autorizadas.
          </p>
          <div className="space-y-2">
            <Label htmlFor="piece-accent">Cor de destaque desta peça</Label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="piece-accent"
                type="color"
                value={data.brand.accent}
                className="h-10 w-12 cursor-pointer rounded border border-border bg-background"
                onChange={(event) =>
                  onData((current) => ({
                    ...current,
                    brand: updateBrand(current.brand, { accent: event.target.value }),
                  }))
                }
              />
              <span className="font-mono text-xs">{data.brand.accent}</span>
              <span className="text-xs text-muted-foreground">
                {savedAccent?.toLowerCase() === data.brand.accent.toLowerCase()
                  ? "Da marca"
                  : "Ajuste desta peça"}
              </span>
            </div>
          </div>
          {missing.length > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              {missing[0]}
            </p>
          )}
          {data.brand.preferredApproach === "trust" && !data.brand.photo && selected !== "warm" && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onData((current) => ({
                  ...current,
                  brand: updateBrand(current.brand, { preferredApproach: "educate" }),
                }))
              }
            >
              Escolher um formato sem foto
            </Button>
          )}
          <Button
            type="button"
            disabled={uploading || missing.length > 0}
            className="h-auto min-h-10 whitespace-normal"
            onClick={() => {
              if (uploading || missing.length) return;
              onData((current) => {
                const brand = updateBrand(current.brand, { visualStyle: selected });
                if (identityIssues(brand).length) return current;
                return { ...current, brand: { ...brand, identityConfirmed: true } };
              });
              onContinue();
            }}
          >
            {uploading ? "Preparando imagem…" : "Confirmar ajustes e abrir peça"}
          </Button>
        </fieldset>
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    </details>
  );
}
