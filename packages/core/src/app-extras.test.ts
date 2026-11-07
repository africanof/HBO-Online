import { describe, expect, it } from "vitest";
import { quickBids, timeLeftLive } from "./listing-auctions";
import { chatPaymentState, screenKey, createScreenCounter, scrubErrorText, mapHtml, mapHref, shouldAskForReview, meetingPointMessage, parseMeetingPoint } from "./app-extras";
import { getNotificationLink } from "./notifications";

describe("APP 0.5.3", () => {
  it("ecrãs sem identificadores", () => {
    expect(screenKey("/classificados/1a2b3c4d-1111-2222-3333-444455556666?x=1")).toBe("/classificados/[id]");
    expect(screenKey("/eventos/bilhete/ABC12345")).toBe("/eventos/bilhete/[id]");
    expect(screenKey("/")).toBe("/");
    expect(screenKey("/loja/")).toBe("/loja");
  });
  it("junta as visitas e envia em lotes", async () => {
    const sent: Record<string, number>[] = [];
    const c = createScreenCounter(async x => { sent.push(x); }, 3);
    c.add("/"); c.add("/explorar"); c.add("/");
    await Promise.resolve();
    expect(sent).toEqual([{ "/": 2, "/explorar": 1 }]);
    await c.flush(); expect(sent.length).toBe(1);
    c.add("/loja"); await c.flush(); expect(sent[1]).toEqual({ "/loja": 1 });
  });
  it("tira dados pessoais dos erros", () => {
    const t = scrubErrorText("Falhou para ana@mail.com 923 456 789 token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc");
    expect(t).not.toMatch(/ana@|923 456|eyJ/);
  });
  it("mapa sem injeção de HTML", () => {
    const h = mapHtml([{ kind: "listing", id: "x1", title: "</script><b>", subtitle: null, lat: -12.7, lng: 15.7 }]);
    expect(h).not.toContain("</script><b>");
    expect(mapHref({ kind: "fuel", id: "a" })).toBe("/combustivel/a");
  });
  it("avaliação: só depois de correr bem e no máximo a cada 120 dias", () => {
    const now = Date.now();
    expect(shouldAskForReview(null, 0, now)).toBe(false);
    expect(shouldAskForReview(null, 1, now)).toBe(true);
    expect(shouldAskForReview(now - 10 * 86400_000, 3, now)).toBe(false);
    expect(shouldAskForReview(now - 130 * 86400_000, 3, now)).toBe(true);
  });
  it("respostas rápidas e ponto de encontro", () => {
    expect(meetingPointMessage({ lat: -12.7765, lng: 15.7398 })).toBe("📍 Ponto de encontro: https://www.google.com/maps/search/?api=1&query=-12.777,15.740");
    expect(parseMeetingPoint(meetingPointMessage({ lat: -12.7765, lng: 15.7398 }))).toMatchObject({ lat: -12.777, lng: 15.74 });
    expect(parseMeetingPoint("ligue 923 https://www.google.com/maps")).toBeNull();
  });
  it("ligação do aviso «Baixou de preço»", () => {
    const id = "1a2b3c4d-1111-4222-8333-444455556666";
    expect(getNotificationLink({ type: "price_drop" as any, title: "", data: { for: "price_drop", listing_id: id } } as any)?.href).toBe("/classificados/" + id);
    expect(getNotificationLink({ type: "price_drop" as any, title: "", data: { for: "price_drop", product_id: id } } as any)?.href).toBe("/loja/" + id);
  });
});

describe("pedido de pagamento na conversa", () => {
  const base = { offer_id: "o", listing_id: "l", title: "T", photo: null, purpose: "sale", currency: "AOA", amount: 100, listing_price: 120,
    offer_status: "accepted", expires_at: "2026-11-09T00:00:00Z", is_buyer: true, listing_status: "published", order_id: null, order_status: null, escrow_status: null } as const;
  it("mostra o estado certo a cada lado", () => {
    expect(chatPaymentState({ ...base })).toBe("pay");
    expect(chatPaymentState({ ...base, is_buyer: false })).toBe("waiting_buyer");
    expect(chatPaymentState({ ...base, offer_status: "expired" })).toBe("expired");
    expect(chatPaymentState({ ...base, listing_status: "sold" })).toBe("unavailable");
    expect(chatPaymentState({ ...base, order_id: "x", order_status: "pending", escrow_status: "awaiting_payment" })).toBe("awaiting_payment");
    expect(chatPaymentState({ ...base, order_id: "x", order_status: "pending", escrow_status: "held" })).toBe("held");
    expect(chatPaymentState({ ...base, order_id: "x", order_status: "cancelled", escrow_status: "awaiting_payment" })).toBe("cancelled");
  });
});

describe("valores rápidos do leilão", () => {
  it("mínimo arredondado e mais dois saltos", () => {
    expect(quickBids({ bid_count: 0, starting_price: 20000, current_price: 20000, min_increment: 0 })).toEqual([20000, 20500, 22000]);
    expect(quickBids({ bid_count: 3, starting_price: 20000, current_price: 30000, min_increment: 1000 })).toEqual([31000, 32000, 35000]);
    // O exemplo do eBay: 91,01 US$ → lance mínimo 92,01 → 93, 94, 97. Em kwanzas (× 1000):
    expect(quickBids({ bid_count: 23, starting_price: 1000, current_price: 91010, min_increment: 1000 })).toEqual([93000, 94000, 97000]);
  });
  it("não passa do «Comprar já»", () => {
    expect(quickBids({ bid_count: 0, starting_price: 20000, current_price: 20000, min_increment: 0, buy_now_price: 21000, buy_now_available: true })).toEqual([20000, 20500]);
  });
  it("quem ganha só sobe o seu máximo", () => {
    expect(quickBids({ bid_count: 2, starting_price: 1000, current_price: 1500, min_increment: 0, leader_is_me: true, my_best: 2000 })[0]).toBeGreaterThan(2000);
  });
});

describe("contagem ao segundo", () => {
  it("mostra segundos e fica urgente na última hora", () => {
    const now = Date.UTC(2026, 10, 7, 12, 0, 0);
    expect(timeLeftLive(new Date(now + 130_000).toISOString(), now)).toEqual({ text: "2 min 10 s", urgent: true, ended: false });
    expect(timeLeftLive(new Date(now + (23 * 3600 + 58 * 60 + 5) * 1000).toISOString(), now).text).toBe("23 h 58 min 05 s");
    expect(timeLeftLive(new Date(now + (2 * 86400 + 4 * 3600 + 7) * 1000).toISOString(), now).text).toBe("2 d 4 h 00 min 07 s");
    expect(timeLeftLive(new Date(now + 9_000).toISOString(), now).text).toBe("9 s");
    expect(timeLeftLive(new Date(now - 1).toISOString(), now).ended).toBe(true);
  });
});
