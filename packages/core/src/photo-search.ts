import type { SupabaseClient } from "@supabase/supabase-js";
import { searchClassifiedListings } from "./classified-search";
import { listProducts } from "./shop";

/** Pesquisa por fotografia (Claude Haiku 5.5 no servidor): só com sessão iniciada, 20 por dia. */
export const PHOTO_SEARCH_DAILY_LIMIT = 20;
/** Lado maior da fotografia enviada (poupa dados e custa menos). */
export const PHOTO_SEARCH_MAX_SIDE = 1024;

export type PhotoSearchResult = { found: boolean; label: string; keywords: string[]; listing_type: string; remaining: number };
export type PhotoSearchErrorCode = "AUTH_REQUIRED" | "PHOTO_SEARCH_LIMIT" | "PHOTO_SEARCH_NOT_CONFIGURED" | "INVALID_IMAGE" | "PHOTO_SEARCH_FAILED" | "NETWORK";

const MESSAGES: Record<PhotoSearchErrorCode, string> = {
  AUTH_REQUIRED: "Inicie sessão para pesquisar por fotografia.",
  PHOTO_SEARCH_LIMIT: `Já fez as ${PHOTO_SEARCH_DAILY_LIMIT} pesquisas por fotografia de hoje. Volte amanhã ou pesquise por texto.`,
  PHOTO_SEARCH_NOT_CONFIGURED: "A pesquisa por fotografia ainda não está ativa. Tente mais tarde.",
  INVALID_IMAGE: "Não foi possível ler a fotografia. Tente outra.",
  PHOTO_SEARCH_FAILED: "Não conseguimos analisar a fotografia agora. Tente de novo.",
  NETWORK: "Sem ligação à internet. Verifique os dados móveis ou o Wi-Fi."
};
export function photoSearchMessage(code: string): string {
  return MESSAGES[code as PhotoSearchErrorCode] ?? MESSAGES.PHOTO_SEARCH_FAILED;
}

/** Tamanho final mantendo a proporção, com o lado maior até PHOTO_SEARCH_MAX_SIDE. */
export function fitWithin(width: number, height: number, max = PHOTO_SEARCH_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Envia a fotografia (base64) para a função do servidor e devolve o que é e as palavras de pesquisa. */
export async function analyzePhoto(client: SupabaseClient, imageBase64: string, mediaType = "image/jpeg"): Promise<{ data: PhotoSearchResult | null; error: PhotoSearchErrorCode | null }> {
  const { data: s } = await client.auth.getSession();
  if (!s.session) return { data: null, error: "AUTH_REQUIRED" };
  try {
    const r = await client.functions.invoke("photo-search", { body: { image: imageBase64.replace(/^data:[^,]*,/, ""), mediaType } });
    if (r.error) {
      let code: string = "PHOTO_SEARCH_FAILED";
      const ctx = (r.error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") { try { code = (await ctx.json())?.error ?? code; } catch { /* resposta sem JSON */ } }
      else if (/fetch|network/i.test(String((r.error as Error).message))) code = "NETWORK";
      return { data: null, error: code as PhotoSearchErrorCode };
    }
    return { data: r.data as PhotoSearchResult, error: null };
  } catch { return { data: null, error: "NETWORK" }; }
}

export async function photoSearchesLeft(client: SupabaseClient): Promise<number | null> {
  const r = await client.rpc("photo_searches_left");
  return r.error ? null : Number(r.data);
}

/** Procura nos Classificados (incluindo Praças) e na Loja com as palavras dadas pela fotografia. */
export async function searchByKeywords(client: SupabaseClient, keywords: string[], maxQueries = 3) {
  const words = [...new Set(keywords.map(k => k.trim()).filter(Boolean))].slice(0, maxQueries);
  const listings = new Map<string, any>(); const products = new Map<string, any>();
  const runs = await Promise.all(words.map(q => Promise.all([searchClassifiedListings(client, { query: q, limit: 24 }), listProducts(client, { query: q, limit: 24 })])));
  for (const [l, p] of runs) {
    for (const x of (l.data as any[]) ?? []) if (!listings.has(x.id)) listings.set(x.id, x);
    for (const x of (p.data as any[]) ?? []) if (!products.has(x.id)) products.set(x.id, x);
  }
  return { listings: [...listings.values()], products: [...products.values()] };
}
