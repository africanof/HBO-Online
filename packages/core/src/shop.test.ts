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
    const deleted: any[] = [];
    const client: any = {
      rpc: async (fn: string, args: any) => { calls.push([fn, args]); return { data: ["o1"], error: null }; },
      from: (t: string) => ({ delete: () => ({ not: async (col: string, op: string, v: any) => { deleted.push([t, col, op, v]); return { error: null }; } }) })
    };
    expect((await placeOrders(client, { fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: "923 000 000" })).error).toBeTruthy();
    await placeOrders(client, { fulfillment: "delivery", paymentMethod: "cash_on_delivery", phone: " 923 000 000 ", deliveryText: " Bairro X " });
    expect(calls).toEqual([["place_orders", { p_fulfillment: "delivery", p_payment_method: "cash_on_delivery", p_contact_phone: "923 000 000", p_delivery_text: "Bairro X", p_note: null }]]);
    expect(deleted).toEqual([["cart_items", "ordered_at", "is", null]]);
  });
  it("defines the seller flow", () => {
    expect(NEXT_SELLER_STATUS.pending).toBe("confirmed");
    expect(NEXT_SELLER_STATUS.ready).toBe("completed");
    expect(NEXT_SELLER_STATUS.completed).toBeUndefined();
  });
});

import { setCartQuantity } from "./shop";
describe("cart quantity", () => {
  it("removes the item when quantity is 0 and updates otherwise", async () => {
    const log: any[] = [];
    const client: any = {
      rpc: async (fn: string, args: any) => { log.push(["rpc", fn, args]); return { error: null }; },
      from: (t: string) => ({ delete: () => ({ eq: async (c: string, v: string) => { log.push(["delete", t, c, v]); return { error: null }; } }) })
    };
    await setCartQuantity(client, "p1", 0);
    await setCartQuantity(client, "p1", 3);
    expect(log).toEqual([["delete", "cart_items", "product_id", "p1"], ["rpc", "cart_set_quantity", { p_product_id: "p1", p_quantity: 3 }]]);
  });
});
