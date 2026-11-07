import { describe, expect, it } from "vitest";
import { screenKey, createScreenCounter, scrubErrorText, mapHtml, mapHref, shouldAskForReview, meetingPointMessage, parseMeetingPoint } from "./app-extras";
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
