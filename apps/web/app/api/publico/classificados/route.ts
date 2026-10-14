import { searchClassifiedListings, cacheKey, PUBLIC_CACHE_TTL } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../../../../lib/supabase";
import { cached, cachedJson, errorJson, readFilters } from "../../../../lib/public-cache";
export const dynamic = "force-dynamic";

/** Pesquisa pública de classificados, guardada 60 s. */
export async function GET(req: Request) {
  if (!supabaseConfigured) return errorJson("Serviço indisponível.", 503);
  const filters = readFilters(new URL(req.url).searchParams.get("f"));
  if (!filters) return errorJson("Filtros inválidos.", 400);
  try {
    const r = await cached(cacheKey("classifieds", filters as Record<string, unknown>), PUBLIC_CACHE_TTL.classifieds, async () => {
      const x = await searchClassifiedListings(supabase(), filters);
      if (x.error) throw x.error;
      return x.data ?? [];
    });
    return cachedJson(r.data, PUBLIC_CACHE_TTL.classifieds, r.hit);
  } catch { return errorJson("Não foi possível carregar."); }
}
