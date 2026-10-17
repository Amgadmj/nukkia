import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  CLINIC_MEDIA_BUCKET,
  CLINIC_MEDIA_TYPES,
  clinicMediaPath,
  clinicMediaPrefix,
  validateClinicMedia,
} from "@/lib/clinic-media";

type MediaItem = { name: string; mime: string };
type Preview = MediaItem & { url: string };

export function ClinicMediaLibrary({ companyId }: { companyId?: string | undefined }) {
  try {
    if (companyId) {
      clinicMediaPrefix(companyId);
      // A company change discards all selected files, consent and private preview state.
      return <CompanyMediaLibrary key={companyId} companyId={companyId} />;
    }
  } catch {
    // Do not attempt storage requests without a valid company scope.
  }
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground">
      <h2 className="font-semibold">Seus materiais</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Selecione uma empresa para acessar seus materiais privados.
      </p>
    </section>
  );
}

function CompanyMediaLibrary({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [listing, setListing] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [licensed, setLicensed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const uploadLock = useRef(false);
  const lifetime = useRef(0);
  const previewRequest = useRef(0);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scope = lifetime;
    const requests = previewRequest;
    return () => {
      scope.current++;
      requests.current++;
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setListing(true);
    setListError(null);
    async function load() {
      try {
        const collected: MediaItem[] = [];
        // Storage list is paginated. Only user uploads, never generated content at the root.
        for (let offset = 0; active; offset += 100) {
          const { data, error } = await supabase.storage
            .from(CLINIC_MEDIA_BUCKET)
            .list(clinicMediaPrefix(companyId), {
              limit: 100,
              offset,
              sortBy: { column: "name", order: "asc" },
            });
          if (!active) return;
          if (error || !data) throw new Error("list unavailable");
          for (const entry of data) {
            if (
              entry.id &&
              entry.name &&
              !/[\\/]/.test(entry.name) &&
              !/^\.{1,2}$/.test(entry.name)
            ) {
              collected.push({
                name: entry.name,
                mime: String(entry.metadata?.["mimetype"] ?? ""),
              });
            }
          }
          if (data.length < 100) break;
        }
        if (active) setItems(collected);
      } catch {
        if (active)
          setListError(
            "Não foi possível acessar os materiais privados. O armazenamento pode estar indisponível ou sem permissão. Tente novamente.",
          );
      } finally {
        if (active) setListing(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [companyId, revision]);

  function closePreview() {
    previewRequest.current++;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreview(null);
    setPreviewLoading(null);
  }

  async function openPreview(item: MediaItem) {
    closePreview();
    const request = ++previewRequest.current;
    const scope = lifetime.current;
    setPreviewLoading(item.name);
    setActionError(null);
    try {
      const { data, error } = await supabase.storage
        .from(CLINIC_MEDIA_BUCKET)
        .createSignedUrl(`${clinicMediaPrefix(companyId)}/${item.name}`, 60);
      if (scope !== lifetime.current || request !== previewRequest.current) return;
      if (error || !data?.signedUrl) throw new Error("preview unavailable");
      setPreview({ ...item, url: data.signedUrl });
      previewTimer.current = setTimeout(() => {
        if (scope === lifetime.current && request === previewRequest.current) closePreview();
      }, 60_000);
    } catch {
      if (scope === lifetime.current && request === previewRequest.current) {
        setActionError("Não foi possível abrir a prévia privada. Tente novamente.");
      }
    } finally {
      if (scope === lifetime.current && request === previewRequest.current) setPreviewLoading(null);
    }
  }

  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadLock.current) return;
    setNotice(null);
    const validation = validateClinicMedia(file, licensed);
    setActionError(validation);
    if (validation || !file) return;
    const scope = lifetime.current;
    uploadLock.current = true;
    setUploading(true);
    try {
      const path = clinicMediaPath(companyId, file.name, crypto.randomUUID());
      const { data, error } = await supabase.storage.from(CLINIC_MEDIA_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (scope !== lifetime.current) return;
      if (error || !data) throw new Error("upload unavailable");
      setFile(null);
      setLicensed(false);
      if (input.current) input.current.value = "";
      setNotice("Arquivo enviado para seus materiais privados.");
      setRevision((value) => value + 1);
    } catch {
      if (scope === lifetime.current) {
        setActionError(
          "Não foi possível enviar o arquivo. Verifique sua conexão e o acesso ao armazenamento antes de tentar novamente.",
        );
      }
    } finally {
      if (scope === lifetime.current) {
        uploadLock.current = false;
        setUploading(false);
      }
    }
  }

  return (
    <section
      aria-label="Seus materiais"
      className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground"
    >
      <div>
        <h2 className="font-semibold">
          Seus materiais{" "}
          <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Guarde vídeos, fotos e artes em armazenamento privado. O envio não publica conteúdo nem
          envia arquivos para modelos de IA.
        </p>
      </div>
      <p className="text-sm font-medium">
        Não envie imagens de pacientes, prontuários, dados de saúde ou outros materiais sensíveis.
      </p>
      <form onSubmit={uploadFile} className="space-y-3">
        <label className="block space-y-2 text-sm">
          <span>Escolher arquivo · PNG, JPEG, WebP ou MP4 · até 50 MB</span>
          <Input
            ref={input}
            type="file"
            accept={CLINIC_MEDIA_TYPES.join(",")}
            disabled={uploading}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setLicensed(false);
              setActionError(null);
              setNotice(null);
            }}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={licensed}
            disabled={uploading}
            className="mt-1 accent-primary"
            onChange={(event) => setLicensed(event.target.checked)}
          />
          <span>O material é meu ou tenho licença para armazená-lo e utilizá-lo.</span>
        </label>
        <Button type="submit" disabled={uploading || !file || !licensed}>
          {uploading ? "Enviando arquivo…" : "Enviar arquivo"}
        </Button>
        {uploading && (
          <p role="status" className="text-sm text-muted-foreground">
            Aguarde a confirmação do envio. Se trocar de empresa, o envio já iniciado poderá
            terminar na empresa original.
          </p>
        )}
      </form>
      {notice && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      <div className="space-y-3 border-t pt-4" aria-busy={listing}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Arquivos enviados</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={listing}
            onClick={() => setRevision((value) => value + 1)}
          >
            Atualizar lista
          </Button>
        </div>
        {listing && (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando materiais…
          </p>
        )}
        {listError && (
          <p role="alert" className="text-sm text-destructive">
            {listError}
          </p>
        )}
        {!listing && !listError && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum arquivo enviado para esta empresa.</p>
        )}
        {!listError && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <span className="min-w-0 break-all text-sm">
                  {item.name.replace(/^[0-9a-f-]{36}-/i, "")}
                </span>
                {CLINIC_MEDIA_TYPES.includes(item.mime) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={previewLoading === item.name}
                    onClick={() => openPreview(item)}
                  >
                    {previewLoading === item.name ? "Abrindo…" : "Visualizar"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Prévia indisponível para este formato
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {(preview || previewLoading) && (
        <div className="space-y-2 rounded-lg border p-3" aria-label="Prévia privada">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Prévia privada por até 1 minuto.</p>
            <Button type="button" variant="ghost" size="sm" onClick={closePreview}>
              Fechar prévia
            </Button>
          </div>
          {previewLoading && <p role="status">Abrindo prévia…</p>}
          {preview &&
            (preview.mime === "video/mp4" ? (
              <video
                src={preview.url}
                controls
                preload="metadata"
                className="max-h-80 w-full"
                aria-label={preview.name}
              />
            ) : (
              <img
                src={preview.url}
                alt={preview.name}
                className="max-h-80 w-full object-contain"
              />
            ))}
        </div>
      )}
    </section>
  );
}
