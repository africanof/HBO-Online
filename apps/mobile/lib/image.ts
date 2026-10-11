import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { shrinkPlan, PHOTO_MAX_SIDE, PHOTO_QUALITY } from "@huambo-online/core";

type Asset = { uri: string; width?: number; height?: number; fileSize?: number | null; base64?: string | null; mimeType?: string | null };

/**
 * Reduz a fotografia no telemóvel antes de enviar (lado maior 1600 px, JPEG) para poupar dados.
 * Se não for preciso, ou se falhar, devolve a fotografia original.
 */
export async function shrinkAsset(a: Asset, maxSide = PHOTO_MAX_SIDE): Promise<{ uri: string; base64?: string | null; mimeType: string }> {
  const plan = a.width && a.height ? shrinkPlan(a.width, a.height, a.fileSize ?? null, maxSide) : { width: maxSide, height: 0 };
  if (!plan) return { uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? "image/jpeg" };
  try {
    const resize = plan.height ? { width: plan.width, height: plan.height } : { width: maxSide };
    const r = await manipulateAsync(a.uri, [{ resize }], { compress: PHOTO_QUALITY, format: SaveFormat.JPEG, base64: true });
    return { uri: r.uri, base64: r.base64, mimeType: "image/jpeg" };
  } catch { return { uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? "image/jpeg" }; }
}
