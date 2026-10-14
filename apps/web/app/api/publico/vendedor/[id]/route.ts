import { getPublicSeller, listSellerListings, listProducts, cacheKey, PUBLIC_CACHE_TTL } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../../../../../lib/supabase";
import { cached, cachedJson, errorJson } from "../../../../../lib/public-cache";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dynamic = "force-dynamic";

/** Página pública do vendedor (perfil, anúncios e produtos), guardada 60 s. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return errorJson("Serviço indisponível.", 503);
  const { id } = await params;
  if (!UUID.test(id)) return errorJson("Vendedor inválido.", 400);
  try {
    const r = await cached(cacheKey("seller", { id }), PUBLIC_CACHE_TTL.seller, async () => {
      const c = supabase();
      const [s, l, p] = await Promise.all([getPublicSeller(c, id), listSellerListings(c, id), listProducts(c, { sellerId: id })]);
      if (s.error || l.error || p.error) throw s.error ?? l.error ?? p.error;
      return { seller: s.data ?? null, listings: l.data ?? [], products: p.data ?? [] };
    });
    if (!r.data.seller) return errorJson("Perfil não encontrado.", 404);
    return cachedJson(r.data, PUBLIC_CACHE_TTL.seller, r.hit);
  } catch { return errorJson("Não foi possível carregar."); }
}
