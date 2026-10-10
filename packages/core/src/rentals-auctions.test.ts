import { describe, expect, it } from "vitest";
import { validateRentalRequest, requestRental, listMyRentalRequests, respondRentalRequest, cancelRentalRequest, RENTAL_STATUS_LABELS } from "./rentals";
import { nextMinimumBid, timeLeft, validateAuctionInput, startListingAuction, bidOnAuction, cancelAuction, getPublicSeller, AUCTIONABLE_TYPES } from "./listing-auctions";
import { friendlyError } from "./classified-listings";

function rpcClient() {
  const calls: { fn: string; args: any }[] = [];
  const res = { data: { id: "x" }, error: null };
  const client: any = { rpc: (fn: string, args: any) => { calls.push({ fn, args }); const p: any = Promise.resolve(res); p.maybeSingle = () => Promise.resolve(res); return p; } };
  return { client, calls };
}
const now = new Date("2026-10-10T12:00:00");

describe("alugueres", () => {
  it("valida datas e valor", () => {
    expect(validateRentalRequest({ startsAt: "", endsAt: "2026-10-20" }, now)).toMatch(/início/);
    expect(validateRentalRequest({ startsAt: "2026-10-01", endsAt: "2026-10-20" }, now)).toMatch(/já passou/);
    expect(validateRentalRequest({ startsAt: "2026-10-20", endsAt: "2026-10-20" }, now)).toMatch(/depois do início/);
    expect(validateRentalRequest({ startsAt: "2026-10-20", endsAt: "2026-10-25", price: -1 }, now)).toMatch(/valor/);
    expect(validateRentalRequest({ startsAt: "2026-10-10", endsAt: "2026-10-25", price: 5000 }, now)).toBeNull();
  });
  it("não chama o servidor com dados inválidos", async () => {
    const { client, calls } = rpcClient();
    const r = await requestRental(client, { listingId: "l", startsAt: "", endsAt: "", price: 0 });
    expect(r.error).toBeTruthy(); expect(calls).toHaveLength(0);
  });
  it("usa as funções do servidor", async () => {
    const { client, calls } = rpcClient();
    await requestRental(client, { listingId: "l", startsAt: "2099-01-01", endsAt: "2099-01-05", price: 1000, message: "  " });
    await listMyRentalRequests(client, "owner");
    await respondRentalRequest(client, "r1", false);
    await cancelRentalRequest(client, "r2");
    expect(calls.map(c => c.fn)).toEqual(["request_classified_rental", "my_rental_requests", "respond_rental_request", "cancel_rental_request"]);
    expect(calls[0].args).toMatchObject({ p_listing_id: "l", p_price: 1000, p_message: null });
    expect(calls[1].args).toEqual({ p_role: "owner" });
    expect(calls[2].args).toEqual({ p_request_id: "r1", p_accept: false });
    expect(RENTAL_STATUS_LABELS.pending).toBe("À espera de resposta");
  });
});

describe("leilões", () => {
  it("calcula o lance mínimo como o servidor", () => {
    expect(nextMinimumBid({ bid_count: 0, starting_price: 10000, current_price: 10000, min_increment: 500 })).toBe(10000);
    expect(nextMinimumBid({ bid_count: 2, starting_price: 10000, current_price: 12000, min_increment: 500 })).toBe(12500);
    expect(nextMinimumBid({ bid_count: 1, starting_price: 10000, current_price: 10000, min_increment: 0 })).toBe(10001);
  });
  it("mostra o tempo que falta", () => {
    const t = new Date("2026-10-10T12:00:00Z").getTime();
    expect(timeLeft("2026-10-12T16:00:00Z", t)).toBe("2 d 4 h");
    expect(timeLeft("2026-10-10T13:35:00Z", t)).toBe("1 h 35 min");
    expect(timeLeft("2026-10-10T12:00:20Z", t)).toBe("1 min");
    expect(timeLeft("2026-10-10T11:00:00Z", t)).toBe("Terminado");
  });
  it("valida o formulário do leilão", () => {
    expect(validateAuctionInput({ startingPrice: 0, days: 7 })).toMatch(/inicial/);
    expect(validateAuctionInput({ startingPrice: 1000, reservePrice: 500, days: 7 })).toMatch(/mínimo de venda/);
    expect(validateAuctionInput({ startingPrice: 1000, minIncrement: -1, days: 7 })).toMatch(/incremento/);
    expect(validateAuctionInput({ startingPrice: 1000, days: 31 })).toMatch(/30 dias/);
    expect(validateAuctionInput({ startingPrice: 1000, reservePrice: 2000, minIncrement: 100, days: 7 })).toBeNull();
    expect(AUCTIONABLE_TYPES).toContain("vehicle");
  });
  it("cria, licita e cancela pelas funções do servidor", async () => {
    const { client, calls } = rpcClient();
    expect((await bidOnAuction(client, "a", NaN)).error).toBeTruthy();
    await startListingAuction(client, "l", { startingPrice: 1000, days: 3 });
    await bidOnAuction(client, "a", 1500);
    await cancelAuction(client, "a");
    await getPublicSeller(client, "u");
    expect(calls.map(c => c.fn)).toEqual(["create_classified_auction", "place_auction_bid", "close_auction", "public_seller"]);
    const a = calls[0].args;
    expect(new Date(a.p_ends_at).getTime() - new Date(a.p_starts_at).getTime()).toBe(3 * 86400000);
    expect(a).toMatchObject({ p_listing_id: "l", p_starting_price: 1000, p_reserve_price: null, p_min_increment: 0 });
  });
  it("traduz os erros do servidor", () => {
    expect(friendlyError({ message: "BID_TOO_LOW" })).toMatch(/lance/i);
    expect(friendlyError({ message: "AUCTION_HAS_BIDS" })).toMatch(/não pode ser cancelado/);
    expect(friendlyError({ message: "CANNOT_RENT_OWN_LISTING" })).not.toBe("CANNOT_RENT_OWN_LISTING");
  });
});
