import { describe, expect, it, vi } from "vitest";
import { bidIncrement, proxyStanding, nextMinimumBid, listBidsForAuction } from "./listing-auctions";
import { friendlyError } from "./classified-listings";

const t = (s: number) => new Date(Date.UTC(2026, 9, 12, 12, 0, s)).toISOString();

describe("leilões como no eBay (licitação automática)", () => {
  it("o incremento sobe com o preço e respeita o do vendedor", () => {
    // eBay em dólares × 1000 (1 US$ → 1000 Kz)
    expect(bidIncrement(500)).toBe(50);
    expect(bidIncrement(1000)).toBe(250);
    expect(bidIncrement(5000)).toBe(500);
    expect(bidIncrement(91010)).toBe(1000);     // como 91,01 US$ → 1 US$
    expect(bidIncrement(150000)).toBe(2500);
    expect(bidIncrement(300000)).toBe(5000);
    expect(bidIncrement(750000)).toBe(10000);
    expect(bidIncrement(2_000_000)).toBe(25000);
    expect(bidIncrement(3_000_000)).toBe(50000);
    expect(bidIncrement(6_000_000)).toBe(100000);
    expect(bidIncrement(1000, 700)).toBe(700);
  });
  it("mesmo cenário testado no servidor", () => {
    // A deixa 5000 de máximo: paga o preço inicial
    expect(proxyStanding([{ bidder: "A", max: 5000, at: t(1) }], 1000)).toEqual({ leader: "A", price: 1000 });
    // B licita 2000: A continua a ganhar com 2250
    expect(proxyStanding([{ bidder: "A", max: 5000, at: t(1) }, { bidder: "B", max: 2000, at: t(2) }], 1000)).toEqual({ leader: "A", price: 2250 });
    // B sobe para 6000: B ganha com 5000 + 500
    expect(proxyStanding([{ bidder: "A", max: 5000, at: t(1) }, { bidder: "B", max: 6000, at: t(3) }], 1000)).toEqual({ leader: "B", price: 5500 });
    // empate: ganha quem chegou primeiro a esse valor, e paga o valor todo
    expect(proxyStanding([{ bidder: "B", max: 9000, at: t(4) }, { bidder: "A", max: 9000, at: t(5) }], 1000)).toEqual({ leader: "B", price: 9000 });
  });
  it("preço mínimo de venda (reserva)", () => {
    expect(proxyStanding([{ bidder: "C", max: 8000, at: t(1) }], 1000, 0, 10000)).toEqual({ leader: "C", price: 1000 });
    expect(proxyStanding([{ bidder: "C", max: 15000, at: t(1) }], 1000, 0, 10000)).toEqual({ leader: "C", price: 10000 });
    expect(proxyStanding([], 1000)).toEqual({ leader: null, price: 1000 });
  });
  it("valor mínimo a escrever", () => {
    const base = { bid_count: 0, starting_price: 1000, current_price: 1000, min_increment: 100 };
    expect(nextMinimumBid(base)).toBe(1000);
    expect(nextMinimumBid({ ...base, bid_count: 2, current_price: 2100 })).toBe(2200);
    expect(nextMinimumBid({ ...base, bid_count: 2, current_price: 2100, leader_is_me: true, my_best: 5000 })).toBe(5001);
    expect(friendlyError(new Error("MAX_MUST_INCREASE"))).toMatch(/máximo maior/);
  });
  it("histórico com licitações automáticas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "1", is_auto: true }], error: null });
    expect((await listBidsForAuction({ rpc } as any, "a1")).data[0].is_auto).toBe(true);
    expect(rpc).toHaveBeenCalledWith("auction_bids_for_v2", { p_auction_id: "a1" });
  });
});

import { validateAuctionInput, startListingAuction, buyAuctionNow, listMyAuctionBids, groupMyBids, getListingAuction, BID_STANDING_LABELS } from "./listing-auctions";
describe("comprar já e as minhas licitações", () => {
  it("valida o preço «Comprar já»", () => {
    expect(validateAuctionInput({ startingPrice: 1000, days: 7, buyNowPrice: 1000 })).toMatch(/Comprar já/);
    expect(validateAuctionInput({ startingPrice: 1000, reservePrice: 3000, days: 7, buyNowPrice: 2000 })).toMatch(/Comprar já/);
    expect(validateAuctionInput({ startingPrice: 1000, reservePrice: 3000, days: 7, buyNowPrice: 8000 })).toBeNull();
  });
  it("inicia o leilão e põe o preço «Comprar já»", async () => {
    const rpc = vi.fn().mockImplementation((fn: string) => Promise.resolve({ data: fn === "create_classified_auction" ? { id: "a9" } : {}, error: null }));
    await startListingAuction({ rpc } as any, "l1", { startingPrice: 1000, days: 3, buyNowPrice: 5000 });
    expect(rpc).toHaveBeenLastCalledWith("set_auction_buy_now", { p_auction_id: "a9", p_price: 5000 });
    await buyAuctionNow({ rpc } as any, "a9");
    expect(rpc).toHaveBeenLastCalledWith("buy_auction_now", { p_auction_id: "a9" });
    await getListingAuction({ rpc: (fn: string) => ({ maybeSingle: () => (rpc(fn), Promise.resolve({ data: null, error: null })) }) } as any, "l1");
    expect(rpc).toHaveBeenLastCalledWith("auction_for_listing_v2");
  });
  it("agrupa as minhas licitações", async () => {
    const it = (standing: string, status = "live") => ({ auction_id: standing, standing, status } as any);
    const g = groupMyBids([it("winning"), it("outbid"), it("won", "ended"), it("retracted")]);
    expect(g.live.map(x => x.standing)).toEqual(["winning", "outbid"]);
    expect(g.ended.map(x => x.standing)).toEqual(["won", "retracted"]);
    expect(g.needAttention).toBe(1);
    expect(Object.keys(BID_STANDING_LABELS)).toHaveLength(8);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    expect((await listMyAuctionBids({ rpc } as any)).data).toEqual([]);
    expect(rpc).toHaveBeenCalledWith("my_auction_bids");
  });
});
