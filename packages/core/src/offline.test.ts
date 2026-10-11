import { describe, expect, it } from "vitest";
import { isOfflineError, loadWithCache, loadItemWithCache, offlineNotice, readCache, writeCache, CACHE_PREFIX } from "./offline";

function memStore() { const m = new Map<string, string>(); return { m, store: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } } }; }
const T0 = Date.UTC(2026, 9, 14, 13, 30); // 14:30 em Angola

describe("sem internet", () => {
  it("reconhece erros de rede", () => {
    expect(isOfflineError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isOfflineError({ message: "TypeError: Network request failed" })).toBe(true);
    expect(isOfflineError({ message: "permission denied for table" })).toBe(false);
    expect(isOfflineError(null)).toBe(false);
  });
  it("guarda o resultado e mostra a cópia quando a rede falha", async () => {
    const { store, m } = memStore();
    const ok = await loadWithCache(store, "home", async () => ({ data: [1, 2], error: null }), T0);
    expect(ok).toEqual({ data: [1, 2], error: null, fromCache: false, savedAt: null });
    expect(m.has(CACHE_PREFIX + "home")).toBe(true);
    const off = await loadWithCache(store, "home", async () => { throw new TypeError("Failed to fetch"); }, T0 + 1000);
    expect(off).toEqual({ data: [1, 2], error: null, fromCache: true, savedAt: T0 });
  });
  it("não esconde erros que não são de rede e não usa cópias velhas", async () => {
    const { store } = memStore();
    await writeCache(store, "x", ["velho"], T0);
    const denied = await loadWithCache(store, "x", async () => ({ data: null, error: { message: "permission denied" } }), T0 + 1000);
    expect(denied.fromCache).toBe(false); expect(denied.error).toEqual({ message: "permission denied" });
    expect(await readCache(store, "x", T0 + 8 * 24 * 3600 * 1000)).toBeNull();
    const nothing = await loadWithCache(store, "nada", async () => ({ data: null, error: { message: "Failed to fetch" } }), T0);
    expect(nothing.data).toBeNull(); expect(nothing.fromCache).toBe(false);
  });
  it("ignora armazenamento estragado ou cheio", async () => {
    const bad = { getItem: () => "{não é json", setItem: () => { throw new Error("cheio"); } };
    expect(await readCache(bad, "k")).toBeNull();
    await expect(writeCache(bad, "k", [1])).resolves.toBeUndefined();
  });
  it("guarda só os últimos anúncios abertos", async () => {
    const { store, m } = memStore();
    for (let i = 0; i < 5; i++) await loadItemWithCache(store, "anuncios", "id" + i, async () => ({ data: { n: i } }), 3, T0 + i);
    const saved = JSON.parse(m.get(CACHE_PREFIX + "anuncios")!).data;
    expect(Object.keys(saved).sort()).toEqual(["id2", "id3", "id4"]);
    const off = await loadItemWithCache(store, "anuncios", "id4", async () => ({ data: null, error: { message: "Network request failed" } }), 3, T0 + 10);
    expect(off).toEqual({ data: { n: 4 }, error: null, fromCache: true, savedAt: T0 + 4 });
    const gone = await loadItemWithCache(store, "anuncios", "id0", async () => ({ data: null, error: { message: "Network request failed" } }), 3, T0 + 10);
    expect(gone.fromCache).toBe(false);
  });
  it("explica de quando é a cópia", () => {
    expect(offlineNotice(T0, T0 + 3600_000)).toBe("📡 Sem internet — a mostrar o que foi guardado às 14:30.");
    expect(offlineNotice(T0, T0 + 24 * 3600_000)).toBe("📡 Sem internet — a mostrar o que foi guardado ontem às 14:30.");
    expect(offlineNotice(T0, T0 + 3 * 24 * 3600_000)).toBe("📡 Sem internet — a mostrar o que foi guardado há 3 dias.");
    expect(offlineNotice(null)).toMatch(/Sem internet/);
  });
});
