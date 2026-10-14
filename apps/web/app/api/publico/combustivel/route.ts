import { fuelFeed, cacheKey, PUBLIC_CACHE_TTL, FUEL_PRODUCT_LIST, type FuelProduct } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../../../../lib/supabase";
import { cached, cachedJson, errorJson } from "../../../../lib/public-cache";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dynamic = "force-dynamic";

/** Onde há combustível e gás (lista pública), guardada 30 s. */
export async function GET(req: Request) {
  if (!supabaseConfigured) return errorJson("Serviço indisponível.", 503);
  const q = new URL(req.url).searchParams;
  const product = q.get("produto") ?? "", municipalityId = q.get("municipio") ?? "";
  if (product && !FUEL_PRODUCT_LIST.includes(product as FuelProduct)) return errorJson("Produto inválido.", 400);
  if (municipalityId && !UUID.test(municipalityId)) return errorJson("Município inválido.", 400);
  try {
    const r = await cached(cacheKey("fuel", { product, municipalityId }), PUBLIC_CACHE_TTL.fuel, async () => {
      const x = await fuelFeed(supabase(), { product: product as FuelProduct | "", municipalityId });
      if (x.error) throw x.error;
      return x.data;
    });
    return cachedJson(r.data, PUBLIC_CACHE_TTL.fuel, r.hit);
  } catch { return errorJson("Não foi possível carregar."); }
}
