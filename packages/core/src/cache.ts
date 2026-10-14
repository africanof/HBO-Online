/**
 * Cache intermédia para as listas públicas mais pedidas (postos de combustível, classificados, páginas de vendedores).
 * O servidor do Site guarda a resposta durante poucos segundos: muitos visitantes → uma só consulta ao PostgreSQL.
 * Hoje a cache vive na memória do servidor; quando houver UPSTASH_REDIS_REST_URL/TOKEN passa a ser Redis (partilhada).
 */
export interface CacheStore {
  readonly kind: "memory" | "redis";
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/** Cache na memória do servidor, com limite de entradas (sai a mais antiga). */
export function memoryCache(maxEntries = 500, now: () => number = Date.now): CacheStore {
  const map = new Map<string, { v: string; until: number }>();
  return {
    kind: "memory",
    async get(key) {
      const e = map.get(key);
      if (!e) return null;
      if (e.until <= now()) { map.delete(key); return null; }
      map.delete(key); map.set(key, e); // fica como a mais recente
      return e.v;
    },
    async set(key, value, ttl) {
      map.delete(key); map.set(key, { v: value, until: now() + ttl * 1000 });
      while (map.size > maxEntries) map.delete(map.keys().next().value as string);
    }
  };
}

/** Redis da Upstash por HTTP (sem bibliotecas novas). A chave fica só no servidor. */
export function upstashCache(url: string, token: string, fetchImpl: typeof fetch = fetch): CacheStore {
  const base = url.replace(/\/+$/, ""); const headers = { Authorization: `Bearer ${token}` };
  return {
    kind: "redis",
    async get(key) {
      const r = await fetchImpl(`${base}/get/${encodeURIComponent(key)}`, { headers });
      if (!r.ok) throw new Error("REDIS_" + r.status);
      const j = await r.json() as { result?: string | null };
      return j.result ?? null;
    },
    async set(key, value, ttl) {
      const r = await fetchImpl(`${base}/set/${encodeURIComponent(key)}?EX=${Math.max(1, Math.round(ttl))}`, { method: "POST", headers, body: value });
      if (!r.ok) throw new Error("REDIS_" + r.status);
    }
  };
}

/** Escolhe Redis se estiver configurado; senão a memória do servidor. */
export function pickCacheStore(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): CacheStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim(), token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token && /^https:\/\//i.test(url) ? upstashCache(url, token, fetchImpl) : memoryCache();
}

/**
 * Lê da cache ou carrega (e guarda). Pedidos iguais ao mesmo tempo esperam pela mesma consulta.
 * Se a cache falhar, vai direto à base de dados (nunca deixa a página sem dados por causa da cache).
 * Erros não são guardados.
 */
export function createCached(store: CacheStore, loaderTimeoutMs = 8000) {
  const inflight = new Map<string, Promise<unknown>>();
  /** Se a base de dados demorar demasiado, desiste (não deixa pedidos presos à espera). */
  const limit = <T,>(p: Promise<T>) => new Promise<T>((ok, fail) => {
    const t = setTimeout(() => fail(new Error("CACHE_LOADER_TIMEOUT")), loaderTimeoutMs);
    p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); fail(e); });
  });
  return async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<{ data: T; hit: boolean }> {
    try { const v = await store.get(key); if (v != null) return { data: JSON.parse(v) as T, hit: true }; } catch { /* cache em baixo: segue */ }
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = limit(loader()).then(async data => { try { await store.set(key, JSON.stringify(data), ttlSeconds); } catch { /* ignora */ } return data; })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return { data: await p, hit: false };
  };
}

/** Chave estável: o mesmo pedido dá sempre a mesma chave (a ordem dos campos não conta). */
export function cacheKey(name: string, params: Record<string, unknown> = {}): string {
  const norm = (v: unknown): unknown => Array.isArray(v) ? v.map(norm)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, norm((v as any)[k])])) : v;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  return `ho:v1:${name}:${JSON.stringify(norm(clean))}`;
}

/** Quanto tempo cada lista fica guardada (segundos). Combustível muda depressa: 30 s. */
export const PUBLIC_CACHE_TTL = { fuel: 30, classifieds: 60, seller: 60 } as const;

/**
 * Cliente das listas em cache (Site e APP). Se o servidor demorar ou falhar, devolve null e quem chama vai direto ao Supabase.
 * Depois de uma falha, deixa de tentar durante uns minutos (o servidor pode estar a acordar).
 */
export function createPublicApi(baseUrl: string, opts: { timeoutMs?: number; pauseMs?: number; fetchImpl?: typeof fetch; now?: () => number } = {}) {
  const timeout = opts.timeoutMs ?? 3000, pause = opts.pauseMs ?? 5 * 60_000, now = opts.now ?? Date.now;
  let blockedUntil = 0;
  return async function getPublic<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T | null> {
    if (now() < blockedUntil) return null;
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ctl?.abort(), timeout);
    try {
      const r = await (opts.fetchImpl ?? fetch)(`${baseUrl.replace(/\/+$/, "")}/api/publico/${path}${qs ? "?" + qs : ""}`, { signal: ctl?.signal });
      if (!r.ok) { await r.text().catch(() => ""); throw new Error(String(r.status)); } // fecha a ligação
      return (await r.json()) as T;
    } catch { blockedUntil = now() + pause; return null; }
    finally { clearTimeout(timer); }
  };
}

type GetPublic = <T>(path: string, params?: Record<string, string | undefined>) => Promise<T | null>;
/** Lista dos postos: primeiro a cache do Site; se não responder, direto ao Supabase. */
export async function fuelFeedCached(getPublic: GetPublic, direct: () => Promise<{ data: any[]; error: unknown }>, f: { product?: string; municipalityId?: string } = {}) {
  const r = await getPublic<any[]>("combustivel", { produto: f.product || undefined, municipio: f.municipalityId || undefined });
  return Array.isArray(r) ? { data: r, error: null, cached: true } : { ...(await direct()), cached: false };
}
/** Pesquisa de classificados: cache do Site ou Supabase. */
export async function classifiedsCached(getPublic: GetPublic, direct: () => Promise<{ data: any; error: unknown }>, filters: Record<string, unknown>) {
  const r = await getPublic<any[]>("classificados", { f: JSON.stringify(filters) });
  return Array.isArray(r) ? { data: r, error: null, cached: true } : { ...(await direct()), cached: false };
}
export type SellerBundle = { seller: any; listings: any[]; products: any[] };
/** Página do vendedor (perfil, anúncios e produtos): cache do Site ou Supabase. */
export async function sellerPageCached(getPublic: GetPublic, id: string, direct: () => Promise<SellerBundle & { error: unknown }>) {
  const r = await getPublic<SellerBundle>("vendedor/" + encodeURIComponent(id));
  return r && r.seller ? { ...r, error: null, cached: true } : { ...(await direct()), cached: false };
}

// --- Fila de tarefas (avisos em massa feitos fora da publicação) ------------------------------
export type JobQueueStats = { pending: number; oldest_pending_seconds: number | null; done_last_hour: number; failed: number };
export async function jobQueueStats(client: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> }) {
  const r = await client.rpc("admin_job_queue_stats");
  return { data: (r.data ?? null) as JobQueueStats | null, error: r.error };
}
/** «A fila está em dia» ou o atraso, em palavras simples. */
export function jobQueueText(s: JobQueueStats | null): string {
  if (!s) return "";
  const late = s.oldest_pending_seconds ?? 0;
  const head = Number(s.pending) === 0 ? "✅ Fila de avisos em dia" : late > 300 ? `⚠️ Fila atrasada: ${s.pending} por enviar (há ${Math.round(late / 60)} min)` : `⏳ ${s.pending} avisos a sair`;
  return `${head} · ${s.done_last_hour} tratadas na última hora${Number(s.failed) ? ` · ❌ ${s.failed} falharam` : ""}`;
}
