import { shrinkPlan, jpegName, PHOTO_MAX_SIDE, PHOTO_QUALITY } from "@huambo-online/core";

/**
 * Reduz a fotografia no navegador antes de enviar (lado maior 1280 px, JPEG 70%).
 * Se algo falhar, ou se a fotografia já for pequena, devolve o ficheiro original.
 */
export async function compressPhoto(file: File, maxSide = PHOTO_MAX_SIDE, quality = PHOTO_QUALITY): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const smaller = Math.max(bitmap.width, bitmap.height) > maxSide;
    const plan = shrinkPlan(bitmap.width, bitmap.height, file.size, maxSide);
    if (!plan) { bitmap.close?.(); return file; }
    const canvas = document.createElement("canvas"); canvas.width = plan.width; canvas.height = plan.height;
    const ctx = canvas.getContext("2d"); if (!ctx) return file;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, plan.width, plan.height); // fundo branco para PNG transparentes
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height); bitmap.close?.();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", quality));
    // Fica com a versão reduzida se tiver menos píxeis; senão, só se for mais leve.
    if (!blob || (!smaller && blob.size >= file.size)) return file;
    return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: Date.now() });
  } catch { return file; }
}
