import { describe, expect, it } from "vitest";
import { addToHistory, loadHistory, recordView, clearHistory, itemHref, shareMessage, toggleSaved, HISTORY_MAX, type KeyValueStore } from "./engage";

function memoryStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>(); if (initial !== undefined) data.set("huambo:historico", initial);
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

describe("history", () => {
  it("keeps the latest view first without duplicates and limits size", () => {
    let list = addToHistory([], { kind: "listing", id: "a", title: "A" }, 1);
    list = addToHistory(list, { kind: "product", id: "b", title: "B" }, 2);
    list = addToHistory(list, { kind: "listing", id: "a", title: "A2" }, 3);
    expect(list.map(e => [e.id, e.title, e.at])).toEqual([["a", "A2", 3], ["b", "B", 2]]);
    for (let i = 0; i < 40; i++) list = addToHistory(list, { kind: "listing", id: "x" + i, title: "x" }, i + 10);
    expect(list.length).toBe(HISTORY_MAX);
  });
  it("survives broken storage data", async () => {
    expect(await loadHistory(memoryStore("{not json"))).toEqual([]);
    expect(await loadHistory(memoryStore('[{"id":"1","kind":"listing","title":"ok","at":1},null,{"x":1}]'))).toHaveLength(1);
  });
  it("records and clears views", async () => {
    const s = memoryStore();
    await recordView(s, { kind: "provider", id: "p", title: "João" });
    expect((await loadHistory(s))[0].title).toBe("João");
    await clearHistory(s);
    expect(await loadHistory(s)).toEqual([]);
  });
});

describe("links and sharing", () => {
  it("uses the same paths on Site and APP", () => {
    expect(itemHref("listing", "1")).toBe("/classificados/1");
    expect(itemHref("provider", "2")).toBe("/profissionais/2");
    expect(itemHref("business", "3")).toBe("/empresas/3");
    expect(itemHref("product", "4")).toBe("/loja/4");
  });
  it("builds share text with the site link", () => {
    expect(shareMessage("https://huambo.example/", "product", "9", "Arroz")).toEqual({ url: "https://huambo.example/loja/9", text: "Arroz — Huambo Online\nhttps://huambo.example/loja/9" });
    expect(shareMessage("", "product", "9", "Arroz").url).toBe("");
  });
});

describe("favorites", () => {
  it("inserts on the right column and removes by id", async () => {
    const log: any[] = [];
    const client: any = { from: () => ({
      insert: (row: any) => { log.push(["insert", row]); return { select: () => ({ single: async () => ({ data: { id: "s1" }, error: null }) }) }; },
      delete: () => ({ eq: async (c: string, v: string) => { log.push(["delete", c, v]); return { error: null }; } })
    }) };
    expect((await toggleSaved(client, "u", "business", "b1", null)).data).toBe("s1");
    expect((await toggleSaved(client, "u", "business", "b1", "s1")).data).toBeNull();
    expect(log).toEqual([["insert", { user_id: "u", business_id: "b1" }], ["delete", "id", "s1"]]);
  });
});
