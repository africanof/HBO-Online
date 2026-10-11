import { fitWithin } from "./photo-search";

/**
 * Fotografias mais leves (poupa dados a quem publica e a quem vê): o lado maior fica com 1600 px
 * nos anúncios e produtos, e 512 px na fotografia de perfil, em JPEG. Igual no Site e na APP.
 */
export const PHOTO_MAX_SIDE = 1600;
export const AVATAR_MAX_SIDE = 512;
export const PHOTO_QUALITY = 0.82;
/** Tamanho máximo do ficheiro original escolhido (é reduzido antes de enviar). */
export const PHOTO_RAW_MAX_BYTES = 30 * 1024 * 1024;
/** Abaixo disto e já pequena, a fotografia é enviada tal como está. */
export const PHOTO_SMALL_BYTES = 400 * 1024;

/** Novo tamanho (ou null se não for preciso reduzir). */
export function shrinkPlan(width: number, height: number, bytes: number | null | undefined, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } | null {
  if (!(width > 0 && height > 0)) return null;
  const fit = fitWithin(width, height, maxSide);
  const smaller = fit.width < width || fit.height < height;
  if (!smaller && bytes != null && bytes <= PHOTO_SMALL_BYTES) return null;
  return fit;
}
/** "IMG_2034.HEIC" → "IMG_2034.jpg". */
export function jpegName(name: string): string {
  const base = (name || "foto").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  return (base || "foto") + ".jpg";
}
/** "2,4 MB", "350 KB". */
export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
}
