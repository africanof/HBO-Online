import { describe, expect, it, vi } from "vitest";
import { geoInputProblem, isInAngola, pointFrom, roundPoint, parseGeoInput, formatPoint, mapsUrl, osmEmbedUrl, validateDirections, placeColumns, geoErrorMessage,
  setOrderDeliveryPoint, getOrderDeliveryPoint } from "./places";
import { friendlyError } from "./classified-listings";

describe("morada por ponto de referência", () => {
  it("só pontos em Angola", () => {
    expect(isInAngola({ lat: -12.7765, lng: 15.7398 })).toBe(true);   // Huambo
    expect(isInAngola({ lat: -8.8383, lng: 13.2344 })).toBe(true);    // Luanda
    expect(isInAngola({ lat: 38.72, lng: -9.14 })).toBe(false);       // Lisboa
    expect(isInAngola({ lat: NaN, lng: 15 })).toBe(false);
    expect(isInAngola(null)).toBe(false);
  });
  it("lê pontos guardados", () => {
    expect(pointFrom("-12.777", "15.740")).toEqual({ lat: -12.777, lng: 15.74 });
    expect(pointFrom(null, 15)).toBeNull();
    expect(pointFrom("", "")).toBeNull();
    expect(pointFrom(10, 10)).toBeNull();
  });
  it("lê coordenadas coladas e ligações do Google Maps", () => {
    expect(parseGeoInput("-12.776543, 15.739871")).toEqual({ lat: -12.776543, lng: 15.739871 });
    expect(parseGeoInput("-12,7765 15,7398")).toEqual({ lat: -12.7765, lng: 15.7398 });
    expect(parseGeoInput("https://www.google.com/maps/place/Huambo/@-12.7765432,15.7398712,17z/data=x")).toEqual({ lat: -12.776543, lng: 15.739871 });
    expect(parseGeoInput("https://maps.google.com/?q=-12.7765,15.7398")).toEqual({ lat: -12.7765, lng: 15.7398 });
    expect(parseGeoInput("38.72, -9.14")).toBeNull();
    expect(parseGeoInput("atrás da igreja")).toBeNull();
    expect(parseGeoInput("")).toBeNull();
    expect(geoInputProblem("38.7223, -9.1393")).toBe("O ponto tem de ser em Angola.");
    expect(geoInputProblem("-12.7765, 15.7398")).toBeNull();
    expect(geoInputProblem("-12")).toBeNull();
    expect(geoInputProblem("rua 12345678")).toContain("Não percebi");
  });
  it("arredonda e mostra", () => {
    expect(roundPoint({ lat: -12.776543, lng: 15.739871 }, 3)).toEqual({ lat: -12.777, lng: 15.74 });
    expect(formatPoint({ lat: -12.7765, lng: 15.7398 })).toBe("-12.77650, 15.73980");
    expect(mapsUrl({ lat: -12.7765, lng: 15.7398 })).toBe("https://www.google.com/maps/search/?api=1&query=-12.7765,15.7398");
    expect(osmEmbedUrl({ lat: -12.7765, lng: 15.7398 })).toContain("marker=-12.7765%2C15.7398");
  });
  it("valida e prepara as colunas", () => {
    expect(validateDirections("x".repeat(301))).toBe("«Como chegar» pode ter no máximo 300 letras.");
    expect(validateDirections("Portão azul")).toBeNull();
    expect(placeColumns("  Portão azul ", { lat: -12.7765432, lng: 15.7398712 })).toEqual({ directions: "Portão azul", geo_lat: -12.776543, geo_lng: 15.739871 });
    expect(placeColumns("", { lat: 38, lng: -9 })).toEqual({ directions: null, geo_lat: null, geo_lng: null });
    expect(geoErrorMessage("denied")).toContain("Autorize a localização");
  });
  it("ponto de entrega da encomenda", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lat: "-12.7765", lng: "15.7398", delivery_text: "x" }], error: null });
    expect(await getOrderDeliveryPoint({ rpc } as any, "o1")).toEqual({ lat: -12.7765, lng: 15.7398 });
    await setOrderDeliveryPoint({ rpc } as any, "o1", { lat: -12.7, lng: 15.7 });
    expect(rpc).toHaveBeenCalledWith("set_order_delivery_point", { p_order_id: "o1", p_lat: -12.7, p_lng: 15.7 });
    await setOrderDeliveryPoint({ rpc } as any, "o1", null);
    expect(rpc).toHaveBeenCalledWith("set_order_delivery_point", { p_order_id: "o1", p_lat: null, p_lng: null });
    const bad = await setOrderDeliveryPoint({ rpc } as any, "o1", { lat: 1, lng: 1 });
    expect(bad.error?.message).toBe("O ponto tem de ser em Angola.");
    expect(friendlyError({ message: "INVALID_LOCATION" })).toBe("O ponto tem de ser em Angola.");
    expect(friendlyError({ message: "ORDER_CLOSED" })).toBe("Esta encomenda já está fechada.");
  });
});

import { placeOrders } from "./shop";
describe("encomenda com ponto da entrega", () => {
  const client = () => {
    const rpc = vi.fn((name: string) => Promise.resolve(name.startsWith("place_orders") ? { data: ["o1", "o2"], error: null } : { data: null, error: null }));
    const del = { not: vi.fn().mockResolvedValue({ error: null }) };
    return { rpc, from: vi.fn(() => ({ delete: () => del })) } as any;
  };
  it("marca o ponto em cada encomenda feita", async () => {
    const c = client();
    await placeOrders(c, { fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: "923000000", deliveryText: "Bairro Académico", point: { lat: -12.7765, lng: 15.7398 } });
    expect(c.rpc.mock.calls.filter((x: any[]) => x[0] === "set_order_delivery_point").map((x: any[]) => x[1].p_order_id)).toEqual(["o1", "o2"]);
  });
  it("sem ponto, ou a levantar na loja, não marca nada", async () => {
    const c = client();
    await placeOrders(c, { fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: "923000000", deliveryText: "Bairro" });
    await placeOrders(c, { fulfillment: "pickup", paymentMethod: "cash_on_delivery", phone: "923000000", point: { lat: -12.7765, lng: 15.7398 } });
    expect(c.rpc.mock.calls.some((x: any[]) => x[0] === "set_order_delivery_point")).toBe(false);
  });
});
