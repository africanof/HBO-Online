import { describe, expect, it, vi } from "vitest";
import { memoryCache, upstashCache, pickCacheStore, createCached, cacheKey, createPublicApi } from "./cache";

describe("cache", () => {
  it("memória: guarda, caduca e tem limite", async () => {
    let t = 0; const c = memoryCache(2, () => t);
    await c.set("a", "1", 10); expect(await c.get("a")).toBe("1");
    t = 11_000; expect(await c.get("a")).toBeNull();
    await c.set("a", "1", 100); await c.set("b", "2", 100); await c.get("a"); await c.set("c", "3", 100);
    expect(await c.get("b")).toBeNull(); expect(await c.get("a")).toBe("1"); expect(await c.get("c")).toBe("3");
  });
  it("chave estável", () => {
    expect(cacheKey("x", { b: 1, a: { d: 2, c: 3 }, e: "" })).toBe(cacheKey("x", { a: { c: 3, d: 2 }, b: 1 }));
    expect(cacheKey("fuel", { p: "gasolina" })).toBe('ho:v1:fuel:{"p":"gasolina"}');
  });
  it("muitos pedidos ao mesmo tempo → uma consulta; erros não ficam guardados", async () => {
    const run = createCached(memoryCache());
    const loader = vi.fn(async () => { await new Promise(r => setTimeout(r, 5)); return [1, 2]; });
    const all = await Promise.all([run("k", 30, loader), run("k", 30, loader), run("k", 30, loader)]);
    expect(loader).toHaveBeenCalledTimes(1); expect(all.map(x => x.data)).toEqual([[1, 2], [1, 2], [1, 2]]);
    expect((await run("k", 30, loader)).hit).toBe(true);
    const bad = vi.fn(async () => { throw new Error("db"); });
    await expect(run("z", 30, bad)).rejects.toThrow("db"); await expect(run("z", 30, bad)).rejects.toThrow("db");
    expect(bad).toHaveBeenCalledTimes(2);
  });
  it("base de dados lenta: desiste e não guarda", async () => {
    const run = createCached(memoryCache(), 20);
    await expect(run("s", 30, () => new Promise(r => setTimeout(() => r("tarde"), 200)))).rejects.toThrow("CACHE_LOADER_TIMEOUT");
    expect(await run("s", 30, async () => "agora")).toEqual({ data: "agora", hit: false });
  });
  it("cache em baixo: vai direto à base de dados", async () => {
    const broken = { kind: "redis" as const, get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } };
    expect(await createCached(broken)("k", 30, async () => "ok")).toEqual({ data: "ok", hit: false });
  });
  it("Upstash por HTTP e escolha automática", async () => {
    const f = vi.fn(async (u: string) => ({ ok: true, json: async () => ({ result: u.includes("/get/") ? "v" : "OK" }) })) as any;
    const r = upstashCache("https://x.upstash.io/", "T", f);
    expect(await r.get("a b")).toBe("v"); await r.set("k", "val", 30);
    expect(f.mock.calls[0][0]).toBe("https://x.upstash.io/get/a%20b");
    expect(f.mock.calls[1][0]).toBe("https://x.upstash.io/set/k?EX=30");
    expect(f.mock.calls[1][1]).toMatchObject({ method: "POST", body: "val", headers: { Authorization: "Bearer T" } });
    expect(pickCacheStore({}).kind).toBe("memory");
    expect(pickCacheStore({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "T" }).kind).toBe("redis");
  });
  it("cliente: falha → null e pausa", async () => {
    let t = 0; let ok = false;
    const f = vi.fn(async () => ok ? { ok: true, json: async () => [1] } : { ok: false, text: async () => "" }) as any;
    const get = createPublicApi("https://site/", { fetchImpl: f, now: () => t, pauseMs: 1000 });
    expect(await get("combustivel", { produto: "gasolina", municipio: undefined })).toBeNull();
    expect(f.mock.calls[0][0]).toBe("https://site/api/publico/combustivel?produto=gasolina");
    ok = true; expect(await get("combustivel")).toBeNull(); expect(f).toHaveBeenCalledTimes(1);
    t = 2000; expect(await get("combustivel")).toEqual([1]);
  });
});

import { fuelFeedCached, classifiedsCached, sellerPageCached } from "./cache";
describe("listas com cache e plano B", () => {
  it("usa a cache quando responde e o Supabase quando não", async () => {
    const direct = vi.fn(async () => ({ data: ["db"], error: null }));
    expect(await fuelFeedCached(async () => ["cache"] as any, direct, { product: "gasolina" })).toEqual({ data: ["cache"], error: null, cached: true });
    expect(direct).not.toHaveBeenCalled();
    expect(await fuelFeedCached(async () => null, direct)).toEqual({ data: ["db"], error: null, cached: false });
    const gp = vi.fn(async () => null);
    await classifiedsCached(gp as any, direct, { purpose: "rent" });
    expect(gp).toHaveBeenCalledWith("classificados", { f: '{"purpose":"rent"}' });
    const d2 = vi.fn(async () => ({ seller: { id: "s" }, listings: [], products: [], error: null }));
    expect((await sellerPageCached(async () => ({ seller: null, listings: [], products: [] }) as any, "s", d2)).cached).toBe(false);
    expect((await sellerPageCached(async () => ({ seller: { id: "s" }, listings: [1], products: [] }) as any, "s", d2)).listings).toEqual([1]);
  });
});
