import { describe, expect, it, vi } from "vitest";
import { formatRef, parseRef, refHref, findByRef } from "./refs";
import { searchHref } from "./design";
import { canRetractBid, retractMyBid, cancelBidAsSeller, listBidsForAuction, RETRACT_REASON_LABELS } from "./listing-auctions";
import { friendlyError } from "./classified-listings";

describe("número de cada artigo", () => {
  it("formata e lê o número de várias maneiras", () => {
    expect(formatRef("listing", 1001)).toBe("A-1001");
    expect(formatRef("product", "1002")).toBe("P-1002");
    expect(formatRef("order", null)).toBe("");
    expect(parseRef("A-1001")).toEqual({ kind: "listing", n: 1001, code: "A-1001" });
    expect(parseRef(" p1002 ")).toEqual({ kind: "product", n: 1002, code: "P-1002" });
    expect(parseRef("e 001003")?.code).toBe("E-1003");
    expect(parseRef("n.º A-7")?.code).toBe("A-7");
    for (const t of ["", "Toyota", "A-", "X-12", "A-12a", "1001"]) expect(parseRef(t)).toBeNull();
  });
  it("a pesquisa com um número vai direto ao artigo", () => {
    expect(searchHref("all" as any, "A-1001")).toBe("/ref/A-1001");
    expect(searchHref("all" as any, "Toyota Hilux")).not.toMatch(/^\/ref/);
    expect(refHref("listing", "x")).toBe("/classificados/x");
    expect(refHref("product", "x")).toBe("/loja/x");
    expect(refHref("order", "x")).toBe("/encomendas#encomenda-x");
  });
  it("procura no servidor", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ kind: "product", id: "p1" }], error: null });
    expect((await findByRef({ rpc } as any, "P-1001")).data).toEqual({ kind: "product", id: "p1" });
    expect(rpc).toHaveBeenCalledWith("find_by_ref", { p_ref: "P-1001" });
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await findByRef({ rpc } as any, "P-9")).data).toBeNull();
  });
});

describe("retirar lances", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  const h = (x: number) => new Date(now + x * 3600000).toISOString();
  it("segue as regras do servidor", () => {
    const live = (endsIn: number) => ({ status: "live" as const, ends_at: h(endsIn) });
    expect(canRetractBid(live(48), [{ created_at: h(-30), retracted: false }], now).ok).toBe(true);
    expect(canRetractBid(live(5), [{ created_at: h(-3), retracted: false }], now)).toMatchObject({ ok: false, why: expect.stringMatching(/12 horas/) });
    expect(canRetractBid(live(5), [{ created_at: h(-0.5), retracted: false }], now).ok).toBe(true);
    expect(canRetractBid(live(48), [{ created_at: h(-1), retracted: true }], now)).toMatchObject({ ok: false, why: expect.stringMatching(/Não tem lances/) });
    expect(canRetractBid({ status: "ended", ends_at: h(-1) }, [{ created_at: h(-5), retracted: false }], now).ok).toBe(false);
  });
  it("chama as funções certas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const c = { rpc } as any;
    await retractMyBid(c, "a1", "typo");
    expect(rpc).toHaveBeenLastCalledWith("retract_auction_bid", { p_auction_id: "a1", p_reason: "typo" });
    await cancelBidAsSeller(c, "b1", "  Conta suspeita ");
    expect(rpc).toHaveBeenLastCalledWith("seller_cancel_bid", { p_bid_id: "b1", p_reason: "Conta suspeita" });
    await listBidsForAuction(c, "a1");
    expect(rpc).toHaveBeenLastCalledWith("auction_bids_for", { p_auction_id: "a1" });
    expect(Object.keys(RETRACT_REASON_LABELS)).toEqual(["typo", "listing_changed", "cannot_contact"]);
    expect(friendlyError(new Error("RETRACT_TOO_LATE"))).toMatch(/12 horas/);
    expect(friendlyError(new Error("BIDDER_BLOCKED"))).toMatch(/não pode voltar a licitar/);
  });
});
