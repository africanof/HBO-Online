import { describe, expect, it } from "vitest";
import { validateListingCheckoutV2, deliveryFee, checkoutSummary, sortPointsNear, formatKm, type DeliveryOptions } from "./checkout-options";

const opts: DeliveryOptions = {
  home: [{ municipality_id: "hu", municipality: "Huambo", fee: 2500, eta: "1 a 2 dias úteis" }],
  points: [
    { id: "a", name: "Longe", address: "x", directions: null, municipality: "Huambo", lat: -12.9, lng: 15.9, hours: null, fee: 1500, eta: "" },
    { id: "b", name: "Perto", address: "y", directions: null, municipality: "Huambo", lat: -12.777, lng: 15.74, hours: null, fee: 1500, eta: "" }
  ]
};
describe("compra como na Vinted", () => {
  it("valida cada opção", () => {
    expect(validateListingCheckoutV2({ fulfillment: "pickup", phone: "923 000 000" })).toBeNull();
    expect(validateListingCheckoutV2({ fulfillment: "point", phone: "923000000" })).toBe("co.err.point");
    expect(validateListingCheckoutV2({ fulfillment: "delivery", phone: "923000000", municipalityId: "hu", deliveryText: "" })).toBe("pp.err_address");
    expect(validateListingCheckoutV2({ fulfillment: "delivery", phone: "92" })).toBe("pp.err_phone");
  });
  it("preço da entrega e total", () => {
    expect(deliveryFee(opts, { fulfillment: "point", pickupPointId: "b" })).toBe(1500);
    expect(deliveryFee(opts, { fulfillment: "delivery", municipalityId: "hu" })).toBe(2500);
    expect(deliveryFee(opts, { fulfillment: "pickup" })).toBe(0);
    expect(checkoutSummary(185000, 1500, 10000)).toEqual({ item: 185000, delivery: 1500, inspection: 10000, total: 196500, payNow: 186500 });
  });
  it("ponto mais perto primeiro", () => {
    const s = sortPointsNear(opts.points, { lat: -12.7765, lng: 15.7398 });
    expect(s[0].name).toBe("Perto");
    expect(formatKm(s[0].km)).toMatch(/m$/);
    expect(sortPointsNear(opts.points, null)[0].name).toBe("Longe");
  });
});
