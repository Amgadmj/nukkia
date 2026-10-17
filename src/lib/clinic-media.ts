export const CLINIC_MEDIA_BUCKET = "content-media";
export const CLINIC_MEDIA_MAX_BYTES = 52_428_800;
export const CLINIC_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "video/mp4"];

type MediaFile = { name: string; type: string; size: number };

/** Client validation complements the private bucket's size, MIME and RLS checks. */
export function validateClinicMedia(file: MediaFile | null, licensed: boolean): string | null {
  if (!file) return "Selecione um arquivo.";
  if (!licensed) return "Confirme que o material é seu ou que você tem licença de uso.";
  if (!CLINIC_MEDIA_TYPES.includes(file.type)) return "Use PNG, JPEG, WebP ou MP4.";
  if (!Number.isFinite(file.size) || file.size <= 0) return "O arquivo está vazio ou inválido.";
  if (file.size > CLINIC_MEDIA_MAX_BYTES) return "O arquivo deve ter no máximo 50 MB.";
  return null;
}

function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Identificador de empresa ou arquivo inválido.");
  }
  return value;
}

export function clinicMediaPrefix(companyId: string): string {
  return `${requireUuid(companyId)}/uploads`;
}

export function clinicMediaPath(companyId: string, filename: string, uuid: string): string {
  const safe = filename
    .split(/[\\/]/)
    .at(-1)!
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120);
  return `${clinicMediaPrefix(companyId)}/${requireUuid(uuid)}-${safe || "arquivo"}`;
}
