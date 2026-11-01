import type { SupabaseClient } from "@supabase/supabase-js";

// Recomendações «Para si» (sem inteligência artificial): a base de dados soma o que a pessoa
// viu (1), pesquisou (2) e guardou (3) nos últimos 30 dias e sugere anúncios das categorias,
// tipos e palavras com mais pontos. Sem histórico, mostra os destaques e os mais recentes.

/** Anúncios recomendados (para visitantes, os mais recentes). */
export async function recommendedListings(client: SupabaseClient, limit = 12) {
  const r = await client.rpc("recommended_listings", { p_limit: limit });
  return { data: (r.data ?? []) as any[], error: r.error };
}
/** Regista que a pessoa abriu um anúncio. Nunca falha para quem chama (só conta com sessão iniciada). */
export async function trackListingView(client: SupabaseClient, listingId: string | null | undefined): Promise<void> {
  if (!listingId) return;
  try { await client.rpc("track_listing_view", { p_listing_id: listingId }); } catch { /* sem sessão ou sem rede: ignorar */ }
}
/** Regista uma pesquisa (palavras, categoria, tipo). Nunca falha para quem chama. */
export async function trackSearch(client: SupabaseClient, s: { query?: string | null; categoryId?: string | null; listingType?: string | null }): Promise<void> {
  const query = (s.query ?? "").trim();
  if (!query && !s.categoryId && !s.listingType) return;
  try { await client.rpc("track_search", { p_query: query || null, p_category_id: s.categoryId || null, p_listing_type: s.listingType || null }); } catch { /* ignorar */ }
}
/** Apaga o histórico de recomendações da própria pessoa. */
export async function clearMyInterests(client: SupabaseClient, userId: string) {
  return client.from("user_interests").delete().eq("user_id", userId);
}
