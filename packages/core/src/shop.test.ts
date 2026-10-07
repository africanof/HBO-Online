import { describe, expect, it } from "vitest";
import { validateProductInput, validateCheckout, groupCartBySeller, placeOrders, NEXT_SELLER_STATUS } from "./shop";

const product = { name: "Arroz 25kg", price: 15000, stock: 10, categoryId: "c", municipalityId: "m" };

describe("products", () => {
  it("validates products", () => {
    expect(validateProductInput(product)).toBeNull();
    expect(validateProductInput({ ...product, price: 0 })).toMatch(/preço/);
    expect(validateProductInput({ ...product, stock: 1.5 })).toMatch(/stock/);
    expect(validateProductInput({ ...product, municipalityId: "" })).toMatch(/município/);
    expect(validateProductInput({ ...product, media: ["1", "2", "3", "4", "5", "6", "7"] })).toMatch(/máximo 6/);
  });
});

describe("checkout", () => {
  it("requires phone and delivery address", () => {
    expect(validateCheckout({ fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: "abc" })).toMatch(/telefone/);
    expect(validateCheckout({ fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: "923000000" })).toMatch(/morada/);
    expect(validateCheckout({ fulfillment: "pickup", paymentMethod: "bank_transfer", phone: "923000000" })).toBeNull();
  });
  it("groups the cart by seller", () => {
    const g = groupCartBySeller([
      { seller_id: "a", seller_name: "Ana", line_total: 100 }, { seller_id: "b", seller_name: "Bruno", line_total: "50" }, { seller_id: "a", seller_name: "Ana", line_total: 25 }
    ]);
    expect(g.map(x => [x.sellerId, x.items.length, x.total])).toEqual([["a", 2, 125], ["b", 1, 50]]);
  });
  it("sends the order to the server only when valid", async () => {
    const calls: any[] = [];
    const client: any = { rpc: async (fn: string, args: any) => { calls.push([fn, args]); return { data: ["o1"], error: null }; } };
    expect((await placeOrders(client, { fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: "923 000 000" })).error).toBeTruthy();
    await placeOrders(client, { fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: " 923 000 000 ", deliveryText: " Bairro X " });
    expect(calls).toEqual([["place_orders", { p_fulfillment: "delivery", p_payment_method: "cash_on_delivery", p_contact_phone: "923 000 000", p_delivery_text: "Bairro X", p_note: null }]]);
  });
  it("defines the seller flow", () => {
    expect(NEXT_SELLER_STATUS.pending).toBe("confirmed");
    expect(NEXT_SELLER_STATUS.ready).toBe("completed");
    expect(NEXT_SELLER_STATUS.completed).toBeUndefined();
  });
});
