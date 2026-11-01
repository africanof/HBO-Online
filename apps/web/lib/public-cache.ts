// Só no servidor (rotas /api/publico): nunca importar em componentes do navegador.
import { createCached, pickCacheStore, normalizeSearchFilters, type ClassifiedSearchFilters, safeAttributeFilters } from "@huambo-online/core";

/** Uma só cache por servidor: Redis (Upstash) se UPSTASH_REDIS_REST_URL/TOKEN existirem, senão memória. */
const store = pickCacheStore(process.env);
export const cacheKind = store.kind;
export const cached = createCached(store);

/** Resposta JSON com cache também no navegador e em proxies (curta: os dados mudam). */
export function cachedJson(data: unknown, ttl: number, hit: boolean) {
  return Response.json(data, { headers: {
    "Cache-Control": `public, max-age=${Math.round(ttl / 2)}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
    "X-Cache": (hit ? "HIT" : "MISS") + "-" + store.kind, "Access-Control-Allow-Origin": "*"
  } });
}
export function errorJson(message: string, status = 502) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ["classified", "product", "vehicle", "real_estate", "service"];
const PURPOSES = ["sale", "rent", "lease", "wanted", "service", "auction"];
const MODES = ["fixed", "negotiable", "offers", "auction", "trade"];

/** Só aceita os filtros conhecidos (o resto é ignorado), para não encher a cache com pedidos estranhos. */
export function readFilters(raw: string | null): ClassifiedSearchFilters | null {
  let f: any = {};
  try { f = raw ? JSON.parse(raw) : {}; } catch { return null; }
  if (!f || typeof f !== "object") return null;
  const out: ClassifiedSearchFilters = {};
  if (typeof f.query === "string" && f.query.trim()) out.query = f.query.trim().slice(0, 80);
  if (TYPES.includes(f.listingType)) out.listingType = f.listingType;
  if (PURPOSES.includes(f.purpose)) out.purpose = f.purpose;
  if (MODES.includes(f.saleMode)) out.saleMode = f.saleMode;
  for (const k of ["categoryId", "provinceId", "municipalityId"] as const) if (typeof f[k] === "string" && UUID.test(f[k])) out[k] = f[k];
  for (const k of ["minPrice", "maxPrice"] as const) if (typeof f[k] === "number" && Number.isFinite(f[k]) && f[k] >= 0) out[k] = f[k];
  const attrs = safeAttributeFilters(f.attributes);
  if (Object.keys(attrs).length) out.attributes = attrs;
  out.limit = Math.max(1, Math.min(Number(f.limit) || 30, 60));
  return normalizeSearchFilters(out);
}

