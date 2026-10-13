import { describe, expect, it, vi } from "vitest";
import { contactsBreakdown, shortDay, angolaDay, barHeights, contactRateText, contactsOf, getMyStats, isStatsKind, recordItemEvent, recordItemView, shouldCountView, sortStats, statsItemHref, statsTips, statsTotals, periodLabel, type ItemStats } from "./stats";

const item = (o: Partial<ItemStats>): ItemStats => ({ kind: "listing", item_id: "a", title: "Mota", status: "published", created_at: "2026-10-01T10:00:00Z",
  views: 0, views_total: 0, whatsapp: 0, calls: 0, shares: 0, saves: 0, messages: 0, offers: 0, orders: 0, followers: 0, ...o });
const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe("estatísticas", () => {
  it("dia de Angola (UTC+1)", () => {
    expect(angolaDay(Date.parse("2026-10-12T23:30:00Z"))).toBe("2026-10-13");
    expect(angolaDay(Date.parse("2026-10-12T22:59:00Z"))).toBe("2026-10-12");
  });
  it("contactos e totais", () => {
    const a = item({ views: 50, messages: 2, whatsapp: 3, calls: 1, offers: 1, saves: 4 });
    const b = item({ item_id: "b", kind: "product", views: 10, orders: 2, shares: 5 });
    expect(contactsOf(a)).toBe(7);
    expect(statsTotals([a, b])).toEqual({ views: 60, saves: 4, contacts: 9, messages: 2, whatsapp: 3, calls: 1, offers: 1, orders: 2, shares: 5 });
  });
  it("resumo dos contactos", () => {
    expect(contactsBreakdown({ messages: 5, whatsapp: 1, calls: 0, offers: 1, orders: 1, shares: 2 })).toBe("5 mensagens · 1 WhatsApp · 1 proposta · 1 encomenda ou pedido · 2 partilhas");
    expect(contactsBreakdown({ messages: 0, whatsapp: 0, calls: 1, offers: 0, orders: 0, shares: 0 })).toBe("1 chamada");
    expect(contactsBreakdown({ messages: 0, whatsapp: 0, calls: 0, offers: 0, orders: 0, shares: 0 })).toBe("Ainda sem contactos neste período.");
  });
  it("taxa de contacto só com vistas suficientes", () => {
    expect(contactRateText(5, 1)).toBeNull();
    expect(contactRateText(40, 6)).toBe("15 em cada 100 pessoas que viram entraram em contacto.");
    expect(contactRateText(10, 30)).toContain("100 em cada 100");
  });
  it("ordena, barras e ligações", () => {
    expect(sortStats([item({ item_id: "x", views: 1 }), item({ item_id: "y", views: 9 })]).map(s => s.item_id)).toEqual(["y", "x"]);
    expect(barHeights([{ day: "d1", views: 0, contacts: 0 }, { day: "d2", views: 4, contacts: 1 }, { day: "d3", views: 2, contacts: 0 }])).toEqual([0, 100, 50]);
    expect(barHeights([{ day: "d1", views: 0, contacts: 0 }])).toEqual([0]);
    expect(statsItemHref("product", "p")).toBe("/loja/p");
    expect(statsItemHref("provider", "u")).toBe("/profissionais/u");
    expect(isStatsKind("listing")).toBe(true); expect(isStatsKind("auction")).toBe(false);
    expect(periodLabel(90)).toBe("Últimos 3 meses");
    expect(shortDay("2026-10-03")).toBe("03/10");
  });
  it("conselhos", () => {
    const old = "2026-01-01T00:00:00Z";
    const tips = statsTips([item({ created_at: old }), item({ item_id: "b", title: "Casa T3", views: 40, created_at: old })], 30);
    expect(tips[0]).toBe("1 item ainda não foi visto nos últimos 30 dias. Partilhe no WhatsApp e ponha boas fotos.");
    expect(tips[1]).toContain("«Casa T3» tem muitas vistas mas nenhum contacto");
    expect(tips[2]).toContain("«Casa T3» é o seu anúncio mais visto");
    expect(statsTips([item({ views: 3, created_at: old })], 7)).toEqual(["Anúncios com várias fotos, preço claro e município certo recebem mais contactos."]);
    expect(statsTips([], 7)).toEqual([]);
  });
  it("conta uma vista por aparelho por dia", async () => {
    const s = memStore();
    expect(await shouldCountView(s, "listing", "a", "2026-10-13")).toBe(true);
    expect(await shouldCountView(s, "listing", "a", "2026-10-13")).toBe(false);
    expect(await shouldCountView(s, "product", "a", "2026-10-13")).toBe(true);
    expect(await shouldCountView(s, "listing", "a", "2026-10-14")).toBe(true);
    const broken = { getItem: () => "{nada", setItem: () => {} };
    expect(await shouldCountView(broken, "listing", "a")).toBe(true);
  });
  it("regista no servidor só tipos válidos e nunca lança erro", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await recordItemEvent({ rpc } as any, "listing", "a", "whatsapp");
    await recordItemEvent({ rpc } as any, "auction", "a", "view");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("record_item_event", { p_kind: "listing", p_id: "a", p_event: "whatsapp" });
    await expect(recordItemEvent({ rpc: vi.fn().mockRejectedValue(new Error("offline")) } as any, "listing", "a", "view")).resolves.toBeUndefined();
    const s = memStore(); const rpc2 = vi.fn().mockResolvedValue({});
    await recordItemView({ rpc: rpc2 } as any, s, "listing", "a"); await recordItemView({ rpc: rpc2 } as any, s, "listing", "a");
    expect(rpc2).toHaveBeenCalledTimes(1);
  });
  it("lê as estatísticas", async () => {
    const rpc = vi.fn((name: string) => Promise.resolve(name === "my_item_stats"
      ? { data: [{ kind: "listing", item_id: "a", title: "Mota", status: "published", created_at: "x", views: "5", views_total: "9", whatsapp: 1, calls: 0, shares: 0, saves: 2, messages: 1, offers: 0, orders: 0, followers: 0 }], error: null }
      : name === "my_stats_daily" ? { data: [{ day: "2026-10-13", views: "5", contacts: "2" }], error: null } : { data: "3", error: null }));
    const r = await getMyStats({ rpc } as any, 30);
    expect(rpc).toHaveBeenCalledWith("my_item_stats", { p_days: 30 });
    expect(r.items[0]).toMatchObject({ views: 5, views_total: 9, saves: 2 });
    expect(r.daily).toEqual([{ day: "2026-10-13", views: 5, contacts: 2 }]);
    expect(r.followers).toBe(3); expect(r.error).toBeNull();
  });
});
