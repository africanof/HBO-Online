import type { KeyValueStore } from "./engage";

/**
 * Rascunho do anúncio guardado no aparelho enquanto se escreve (Site e APP).
 * Se a rede cair ou a APP fechar, nada se perde: ao voltar, o formulário volta a encher-se sozinho.
 */
export const LISTING_DRAFT_KEY = "huambo:rascunho-anuncio";
export const LISTING_DRAFT_MAX_AGE_MS = 30 * 24 * 3600_000;

export type ListingDraftFields = {
  listingType: string; isAgro: boolean; agroCat: string; agroUnit: string; agroQty: string; agroFrom: string; purpose: string;
  title: string; description: string; price: string; budgetMin: string; budgetMax: string; saleMode: string; acceptsTrade: boolean;
  tradeWants: string; auctionDays: string; categoryId: string; provinceId: string; municipalityId: string; marketId: string;
  videoUrl: string; agentCode: string; directions: string; point: { lat: number; lng: number } | null;
};
export type ListingDraftPhoto = { key: string; uri: string; mimeType?: string };
export type ListingDraft = { v: 1; savedAt: number; fields: ListingDraftFields; photos: ListingDraftPhoto[] };

/** Só vale a pena guardar se a pessoa já escreveu alguma coisa ou juntou fotografias. */
export function draftHasContent(f: Partial<ListingDraftFields>, photos: unknown[] = []): boolean {
  return !!(f.title?.trim() || f.description?.trim() || f.price?.trim() || f.budgetMin?.trim() || f.budgetMax?.trim() || f.tradeWants?.trim() || f.directions?.trim() || photos.length);
}
export function parseDraft(raw: string | null | undefined, now = Date.now()): ListingDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as ListingDraft;
    if (!d || d.v !== 1 || typeof d.fields !== "object" || !d.fields || typeof d.savedAt !== "number") return null;
    if (now - d.savedAt > LISTING_DRAFT_MAX_AGE_MS) return null;
    if (!draftHasContent(d.fields, d.photos ?? [])) return null;
    return { ...d, photos: Array.isArray(d.photos) ? d.photos.filter(p => p && typeof p.uri === "string" && typeof p.key === "string") : [] };
  } catch { return null; }
}
export async function loadListingDraft(store: KeyValueStore, now = Date.now()) { return parseDraft(await store.getItem(LISTING_DRAFT_KEY), now); }
export async function saveListingDraft(store: KeyValueStore, fields: ListingDraftFields, photos: ListingDraftPhoto[] = [], now = Date.now()) {
  if (!draftHasContent(fields, photos)) { await store.setItem(LISTING_DRAFT_KEY, ""); return false; }
  const d: ListingDraft = { v: 1, savedAt: now, fields, photos };
  await store.setItem(LISTING_DRAFT_KEY, JSON.stringify(d));
  return true;
}
export async function clearListingDraft(store: KeyValueStore) { await store.setItem(LISTING_DRAFT_KEY, ""); }
/** «guardado há 5 min» */
export function draftAgeText(savedAt: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - savedAt) / 60000));
  if (m < 1) return "guardado agora mesmo";
  if (m < 60) return `guardado há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `guardado há ${h} h` : `guardado há ${Math.round(h / 24)} dia(s)`;
}
export const OFFLINE_PUBLISH_MESSAGE = "Sem internet. O anúncio ficou guardado neste aparelho: carregue em «Publicar» quando a rede voltar.";
