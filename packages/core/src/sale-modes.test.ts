import { describe, expect, it } from "vitest";
import { saleModesFor, canAlsoTrade, validateSaleMode, saleModeBadges, buyerOptions, buyNowMessage, offerLabel, validateOffer, makeOffer, respondOffer, myOfferCounts } from "./sale-modes";
import { createClassifiedListing } from "./classified-listings";
import { getNotificationLink } from "./notifications";
import { friendlyError } from "./classified-listings";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
describe("modos de venda", () => {
  it("mostra as opções certas para cada finalidade", () => {
    expect(saleModesFor("sale", "product")).toEqual(["fixed", "negotiable", "offers", "auction", "trade"]);
    expect(saleModesFor("sale", "service")).toEqual(["fixed", "negotiable", "offers"]);
    expect(saleModesFor("rent")).toEqual(["fixed", "negotiable", "offers"]);
    expect(saleModesFor("wanted")).toEqual([]);
    expect(canAlsoTrade("sale", "fixed")).toBe(true);
    expect(canAlsoTrade("sale", "trade")).toBe(false);
    expect(canAlsoTrade("rent", "fixed")).toBe(false);
  });
  it("valida antes de publicar", () => {
    expect(validateSaleMode({ purpose: "sale", saleMode: "" })).toMatch(/Escolha como quer vender/);
    expect(validateSaleMode({ purpose: "sale", saleMode: "fixed" })).toBe("Indique o preço.");
    expect(validateSaleMode({ purpose: "sale", saleMode: "offers" })).toBeNull();
    expect(validateSaleMode({ purpose: "sale", saleMode: "auction", price: 1000, auctionDays: 0 })).toMatch(/1 a 30 dias/);
    expect(validateSaleMode({ purpose: "sale", saleMode: "auction", price: 1000, auctionDays: 7 })).toBeNull();
    expect(validateSaleMode({ purpose: "sale", saleMode: "trade", tradeWants: " " })).toMatch(/troca/);
    expect(validateSaleMode({ purpose: "rent", saleMode: "auction", price: 5 })).toMatch(/Escolha/);
    expect(validateSaleMode({ purpose: "wanted" })).toBeNull();
  });
  it("mostra etiquetas e o que o comprador pode fazer", () => {
    expect(saleModeBadges({ purpose: "sale", sale_mode: "negotiable", accepts_trade: true })).toEqual(["Negociável", "Aceita troca"]);
    expect(saleModeBadges({ purpose: "auction", sale_mode: null })).toEqual(["Leilão"]);
    expect(saleModeBadges({ purpose: "sale", sale_mode: "trade", accepts_trade: true })).toEqual(["Troca"]);
    expect(saleModeBadges({ purpose: "wanted", sale_mode: "fixed" })).toEqual([]);
    expect(buyerOptions({ purpose: "sale", sale_mode: "fixed" })).toEqual({ buyNow: true, offerMoney: false, offerTrade: false });
    expect(buyerOptions({ purpose: "sale", sale_mode: "fixed", accepts_trade: true }).offerTrade).toBe(true);
    expect(buyerOptions({ purpose: "sale", sale_mode: "offers" })).toEqual({ buyNow: false, offerMoney: true, offerTrade: true });
    expect(buyerOptions({ purpose: "sale", sale_mode: null }).offerMoney).toBe(true); // anúncios antigos
    expect(buyerOptions({ purpose: "sale", sale_mode: "negotiable", status: "sold" }).buyNow).toBe(false);
  });
  it("mostra o preço de troca e propostas sem valor", async () => {
    const { listingPriceLabel } = await import("./wanted");
    expect(listingPriceLabel({ purpose: "sale", price: null, sale_mode: "trade" })).toBe("🔁 Troca");
    expect(listingPriceLabel({ purpose: "sale", price: null, sale_mode: "offers" })).toBe("Aceita propostas");
    expect(listingPriceLabel({ purpose: "sale", price: 900, sale_mode: "offers" })).toBe("900 Kz");
  });
  it("escreve as mensagens e valida propostas", () => {
    expect(buyNowMessage("Fogão", 45000)).toBe("Olá! Quero comprar «Fogão» por 45 000 Kz. Quando e onde posso levantar?");
    expect(offerLabel({ amount: 5000, trade_item: "Samsung A10" })).toBe("5 000 Kz + troca por Samsung A10");
    expect(offerLabel({ amount: null, trade_item: "Bicicleta" })).toBe("troca por Bicicleta");
    expect(validateOffer({}, { offerMoney: true, offerTrade: true })).toMatch(/valor ou o que oferece/);
    expect(validateOffer({ amount: -5 }, { offerMoney: true, offerTrade: false })).toMatch(/válido/);
    expect(validateOffer({ amount: 5000 }, { offerMoney: true, offerTrade: true, tradeOnly: true })).toMatch(/troca/);
    expect(validateOffer({ amount: 800 }, { offerMoney: true, offerTrade: false })).toBeNull();
  });
  it("guarda o modo de venda e usa as funções do servidor", async () => {
    let inserted: any = null;
    const client: any = { from: () => ({ insert: (row: any) => { inserted = row; return { select: () => ({ single: async () => ({ data: { id: "L1" }, error: null }) }) }; } }) };
    await createClassifiedListing(client, { ownerId: uuid, listingType: "product", purpose: "sale", title: "Fogão", saleMode: "negotiable", acceptsTrade: true, tradeWants: " Geleira " });
    expect([inserted.sale_mode, inserted.accepts_trade, inserted.trade_wants]).toEqual(["negotiable", true, "Geleira"]);
    await createClassifiedListing(client, { ownerId: uuid, listingType: "product", purpose: "wanted", title: "Preciso de fogão", saleMode: "fixed" });
    expect([inserted.sale_mode, inserted.accepts_trade]).toEqual([null, false]);
    const calls: any[] = [];
    const rpc: any = { rpc: (fn: string, args: any) => { calls.push([fn, args]); return Promise.resolve({ data: fn === "my_listing_offer_counts" ? [{ listing_id: "a", pending: "2" }] : null, error: null }); } };
    await makeOffer(rpc, uuid, { amount: 800, tradeItem: " ", message: " Pode ser? " });
    await respondOffer(rpc, uuid, true);
    expect(calls[0]).toEqual(["make_offer", { p_listing_id: uuid, p_amount: 800, p_trade_item: null, p_message: "Pode ser?" }]);
    expect(calls[1][1]).toEqual({ p_offer_id: uuid, p_accept: true, p_note: null });
    expect((await myOfferCounts(rpc)).data).toEqual({ a: 2 });
  });
  it("liga notificações e traduz erros", () => {
    expect(getNotificationLink({ type: "system", title: "Nova proposta", data: { listing_id: uuid, offer_id: uuid, for: "offer" } })?.href).toBe("/classificados/" + uuid + "#propostas");
    expect(getNotificationLink({ type: "system", title: "Proposta aceite ✔", data: { listing_id: uuid, offer_id: uuid, for: "my_offer" } })?.href).toBe("/propostas");
    expect(friendlyError({ message: "OFFERS_NOT_ACCEPTED" })).toMatch(/preço fixo/);
    expect(friendlyError({ message: "TRADE_REQUIRED" })).toMatch(/só para troca/);
  });
});
