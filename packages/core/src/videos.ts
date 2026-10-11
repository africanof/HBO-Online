import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadClassifiedMedia, storagePathFromPublicUrl } from "./classified-listings";

/** Vídeos de anúncios e produtos: 1 por artigo, até 60 segundos e 30 MB (poupa dados móveis). */
export const VIDEO_BUCKET = "media-videos";
export const VIDEO_MAX_BYTES = 30 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp"];

/** Valida o vídeo escolhido. Devolve a mensagem de erro ou null. */
export function validateVideo(v: { size?: number | null; type?: string | null; durationSeconds?: number | null }): string | null {
  const type = (v.type ?? "").toLowerCase();
  if (type && !VIDEO_TYPES.includes(type)) return "Formato de vídeo não suportado. Use MP4 ou MOV.";
  if (v.size != null && v.size > VIDEO_MAX_BYTES) return `O vídeo tem ${(v.size / 1048576).toFixed(0)} MB. O máximo é 30 MB — grave um vídeo mais curto.`;
  if (v.durationSeconds != null && Number.isFinite(v.durationSeconds) && v.durationSeconds > VIDEO_MAX_SECONDS + 0.5) return `O vídeo tem ${Math.round(v.durationSeconds)} segundos. O máximo é ${VIDEO_MAX_SECONDS} segundos.`;
  return null;
}

/** Tipo do ficheiro a partir do nome (quando o telemóvel não o indica). */
export function videoTypeFromName(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : ext === "3gp" ? "video/3gpp" : "video/mp4";
}

export async function uploadVideo(client: SupabaseClient, ownerId: string, file: Blob | ArrayBuffer, filename: string, contentType?: string) {
  const type = contentType || videoTypeFromName(filename);
  const invalid = validateVideo({ size: file instanceof ArrayBuffer ? file.byteLength : file.size, type });
  if (invalid) return { data: null, error: new Error(invalid) };
  return uploadClassifiedMedia(client, file, ownerId, filename, type, VIDEO_BUCKET);
}

/** Apaga um vídeo enviado mas que não chegou a ser guardado (os guardados são limpos pelo servidor). */
export async function removeUnsavedVideo(client: SupabaseClient, url: string) {
  const path = storagePathFromPublicUrl(url, VIDEO_BUCKET);
  if (!path) return { data: [], error: null };
  return client.storage.from(VIDEO_BUCKET).remove([path]);
}
