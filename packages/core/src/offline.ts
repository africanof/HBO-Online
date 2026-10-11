import type { KeyValueStore } from "./engage";

/**
 * Sem internet ou com rede fraca (igual no Site e na APP): guarda o último resultado de cada lista
 * e de cada anúncio visto, e mostra-o quando a rede falha, com o aviso «Sem internet».
 */
export const CACHE_PREFIX = "huambo:cache:";
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // uma semana
const MAX_CHARS = 300_000; // não guardar respostas enormes

export type Loaded<T> = { data: T | null; error: unknown; fromCache: boolean; savedAt: number | null };
type Result<T> = { data: T | null; error?: unknown };

/** O erro é de falta de rede (e não de permissão ou dados inválidos)? */
export function isOfflineError(error: unknown): boolean {
  if (!error) return false;
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as any).message) : String(error);
  return /failed to fetch|network request failed|networkerror|load failed|fetch failed|timeout|timed out|ECONNRESET|ENOTFOUND|internet/i.test(raw);
}

export async function readCache<T>(store: KeyValueStore, key: string, now = Date.now(), maxAge = CACHE_MAX_AGE_MS): Promise<{ data: T; savedAt: number } | null> {
  try {
    const raw = await store.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; data: T };
    if (typeof v?.at !== "number" || now - v.at > maxAge) return null;
    return { data: v.data, savedAt: v.at };
  } catch { return null; }
}
export async function writeCache<T>(store: KeyValueStore, key: string, data: T, now = Date.now()) {
  try {
    const raw = JSON.stringify({ at: now, data });
    if (raw.length <= MAX_CHARS) await store.setItem(CACHE_PREFIX + key, raw);
  } catch { /* armazenamento cheio ou indisponível: segue sem guardar */ }
}

/**
 * Carrega da internet; se der certo guarda uma cópia. Se a rede falhar, devolve a cópia guardada.
 * Erros que não são de rede (ex.: sem permissão) são devolvidos tal como vieram.
 */
export async function loadWithCache<T>(store: KeyValueStore, key: string, loader: () => PromiseLike<Result<T>>, now = Date.now()): Promise<Loaded<T>> {
  let res: Result<T>;
  try { res = await loader(); } catch (e) { res = { data: null, error: e }; }
  if (!res.error && res.data !== null && res.data !== undefined) {
    await writeCache(store, key, res.data, now);
    return { data: res.data, error: null, fromCache: false, savedAt: null };
  }
  if (isOfflineError(res.error)) {
    const c = await readCache<T>(store, key, now);
    if (c) return { data: c.data, error: null, fromCache: true, savedAt: c.savedAt };
  }
  return { data: res.data ?? null, error: res.error ?? null, fromCache: false, savedAt: null };
}

/** «Sem internet — a mostrar o que foi guardado às 14:30 de ontem». */
export function offlineNotice(savedAt: number | null, now = Date.now()): string {
  if (!savedAt) return "Sem internet. Verifique a ligação e tente novamente.";
  const d = new Date(savedAt + 60 * 60 * 1000); const n = new Date(now + 60 * 60 * 1000); // hora de Angola
  const hh = String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  const days = Math.round((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86400000);
  const when = days <= 0 ? `às ${hh}` : days === 1 ? `ontem às ${hh}` : `há ${days} dias`;
  return `📡 Sem internet — a mostrar o que foi guardado ${when}.`;
}

/**
 * Como loadWithCache, mas guarda vários itens (ex.: anúncios abertos) num só lugar,
 * ficando só com os `max` mais recentes, para não encher o telemóvel.
 */
export async function loadItemWithCache<T>(store: KeyValueStore, bucket: string, id: string, loader: () => PromiseLike<Result<T>>, max = 30, now = Date.now()): Promise<Loaded<T>> {
  const read = async () => (await readCache<Record<string, { at: number; data: T }>>(store, bucket, now, Number.MAX_SAFE_INTEGER))?.data ?? {};
  let res: Result<T>;
  try { res = await loader(); } catch (e) { res = { data: null, error: e }; }
  if (!res.error && res.data !== null && res.data !== undefined) {
    const map = await read();
    map[id] = { at: now, data: res.data };
    const kept = Object.entries(map).sort((a, b) => b[1].at - a[1].at).slice(0, max);
    await writeCache(store, bucket, Object.fromEntries(kept), now);
    return { data: res.data, error: null, fromCache: false, savedAt: null };
  }
  if (isOfflineError(res.error)) {
    const hit = (await read())[id];
    if (hit && now - hit.at <= CACHE_MAX_AGE_MS) return { data: hit.data, error: null, fromCache: true, savedAt: hit.at };
  }
  return { data: res.data ?? null, error: res.error ?? null, fromCache: false, savedAt: null };
}
