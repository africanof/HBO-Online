import type { SupabaseClient } from "@supabase/supabase-js";

/** Praças (mercados) do Huambo: Kapango, Ferro, Cassilhas, Alemanha… Iguais no Site e na APP. */
export type MarketStatus = "pending" | "active" | "hidden";
export type Market = {
  id: string; name: string; municipality_id: string | null; municipality_name?: string | null; address_text: string | null;
  description: string | null; opening_hours: string | null; photo_url: string | null;
  listings?: number; products?: number; businesses?: number;
};
export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = { pending: "À espera de aprovação", active: "Visível", hidden: "Escondida" };
export type MarketInput = { name: string; municipalityId?: string; addressText?: string; description?: string; openingHours?: string; photoUrl?: string; status?: MarketStatus };

export function validateMarketInput(input: MarketInput): string | null {
  const name = input.name.trim();
  if (name.length < 2) return "Indique o nome da praça.";
  if (name.length > 80) return "O nome é demasiado longo.";
  if ((input.addressText ?? "").length > 200) return "A morada é demasiado longa.";
  if ((input.description ?? "").length > 2000) return "A descrição é demasiado longa.";
  if ((input.openingHours ?? "").length > 120) return "O horário é demasiado longo.";
  if (input.photoUrl && !/^https:\/\//.test(input.photoUrl.trim())) return "O endereço da fotografia tem de começar por https://";
  return null;
}

/** "Praça do Kapango" → "Kapango" (para botões curtos). */
export function shortMarketName(name: string) { return name.replace(/^pra[çc]a\s+(d[aoe]s?\s+)?/i, "").trim() || name; }

/** Resumo do que há na praça: "3 anúncios · 5 produtos · 1 loja". */
export function marketSummary(m: Pick<Market, "listings" | "products" | "businesses">): string {
  const parts: string[] = [];
  const add = (n: number | undefined, one: string, many: string) => { const v = Number(n) || 0; if (v > 0) parts.push(`${v} ${v === 1 ? one : many}`); };
  add(m.listings, "anúncio", "anúncios"); add(m.products, "produto", "produtos"); add(m.businesses, "loja", "lojas");
  return parts.length ? parts.join(" · ") : "Ainda sem vendedores no Huambo Online";
}

export async function listMarkets(client: SupabaseClient, f: { query?: string; municipalityId?: string } = {}) {
  return client.rpc("market_directory", { p_query: f.query?.trim() ?? "", p_municipality_id: f.municipalityId || null });
}
/** Opções para o campo "Praça" dos formulários. */
export async function listMarketOptions(client: SupabaseClient) {
  return client.from("markets").select("id,name").eq("status", "active").order("name");
}
export async function getMarket(client: SupabaseClient, id: string) {
  return client.from("markets").select("id,name,municipality_id,address_text,description,opening_hours,photo_url,status,municipalities(name)").eq("id", id).maybeSingle();
}
/** O que se vende na praça: anúncios publicados, produtos e lojas/empresas. */
export async function listMarketContents(client: SupabaseClient, marketId: string) {
  const [listings, products, businesses] = await Promise.all([
    client.from("classified_listings").select("id,title,price,currency,media,purpose,listing_type,created_at,video_url").eq("market_id", marketId).eq("status", "published").order("created_at", { ascending: false }).limit(60),
    client.from("products").select("id,name,price,currency,stock,media,seller_id,video_url").eq("market_id", marketId).eq("active", true).order("created_at", { ascending: false }).limit(60),
    client.from("businesses").select("id,name,description,logo_url,verified,phone").eq("market_id", marketId).eq("active", true).order("name").limit(60)
  ]);
  return { listings: listings.data ?? [], products: products.data ?? [], businesses: businesses.data ?? [], error: listings.error ?? products.error ?? businesses.error };
}
export async function suggestMarket(client: SupabaseClient, input: { name: string; municipalityId?: string; addressText?: string; description?: string }) {
  const invalid = validateMarketInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  return client.rpc("suggest_market", { p_name: input.name.trim(), p_municipality_id: input.municipalityId || null, p_address: input.addressText?.trim() || null, p_description: input.description?.trim() || null });
}

/** Administração: todas as praças (incluindo sugestões e escondidas). */
export async function listMarketsForAdmin(client: SupabaseClient) {
  return client.from("markets").select("id,name,municipality_id,address_text,description,opening_hours,photo_url,status,created_at,municipalities(name)").order("status").order("name");
}
export async function saveMarket(client: SupabaseClient, input: MarketInput, id?: string) {
  const invalid = validateMarketInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const row = { name: input.name.trim(), municipality_id: input.municipalityId || null, address_text: input.addressText?.trim() || null,
    description: input.description?.trim() || null, opening_hours: input.openingHours?.trim() || null, photo_url: input.photoUrl?.trim() || null,
    status: input.status ?? "active", updated_at: new Date().toISOString() };
  return id ? client.from("markets").update(row).eq("id", id).select().single() : client.from("markets").insert(row).select().single();
}
export async function setMarketStatus(client: SupabaseClient, id: string, status: MarketStatus) {
  return client.from("markets").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select().single();
}
