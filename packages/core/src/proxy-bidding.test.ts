import { describe, expect, it, vi } from "vitest";
import { bidIncrement, proxyStanding, nextMinimumBid, listBidsForAuction } from "./listing-auctions";
import { friendlyError } from "./classified-listings";

const t = (s: number) => new Date(Date.UTC(2026, 9, 12, 12, 0, s)).toISOString();

describe("leilões como no eBay (licitação automática)", () => {
  it("o incremento sobe com o preço e respeita o do vendedor", () => {
    expect(bidIncrement(500)).toBe(50);
    expect(bidIncrement(1000)).toBe(100);
    expect(bidIncrement(5000)).toBe(250);
    expect(bidIncrement(99999)).toBe(500);
    expect(bidIncrement(6_000_000)).toBe(10000);
    expect(bidIncrement(1000, 700)).toBe(700);
  });
  it("mesmo cenário testado no servidor", () => {
    // A deixa 5000 de máximo: paga o preço inicial
    expect(proxyStanding([{ bidder: "A", max: 5000, at: t(1) }], 1000)).toEqual({ leader: "A", price: 1000 });
    // B licita 2000: A continua a ganhar com 2100
    expect(proxyStanding([{ bidder: "A", max: 5000, at: t(1) }, { bidder: "B", max: 2000, at: t(2) }], 1000)).toEqual({ leader: "A", price: 2100 });
    // B sobe para 6000: B ganha com 5000 + 250
    expect(proxyStanding([{ bidder: "A", max: 5000, at: t(1) }, { bidder: "B", max: 6000, at: t(3) }], 1000)).toEqual({ leader: "B", price: 5250 });
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
