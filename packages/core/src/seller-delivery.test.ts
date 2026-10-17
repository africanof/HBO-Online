import { describe, expect, it, vi } from "vitest";
import { validateDeliverySettings, computeDeliveryQuote, deliveryPolicyLines, deliveryQuoteText, freeDeliveryHint, defaultFulfillment, cartTotals,
  saveDeliverySettings, cartDeliveryQuote, placeOrdersV3, validateCheckoutV3, getDeliveryPolicy, DELIVERY_REASON_TEXT, type DeliveryPolicy, type DeliverySettingsInput } from "./seller-delivery";
import { friendlyError } from "./classified-listings";
import { tc } from "./i18n-core";

const A = "a", B = "b", C = "c";
const policy: DeliveryPolicy = { pickup_enabled: true, pickup_place: "Mercado Alemão", delivery_enabled: true, default_fee: 3000, free_over: 25000, min_order: null,
  delivery_days: "1 a 2 dias", note: null, zones: [{ municipality_id: A, municipality_name: "Huambo", fee: 1500 }, { municipality_id: B, municipality_name: "Caála", fee: 2000 }] };
const input: DeliverySettingsInput = { pickupEnabled: true, deliveryEnabled: true, defaultFee: 3000, freeOver: 25000, minOrder: null, zones: [{ municipalityId: A, fee: 1500 }] };

describe("regras de entrega do vendedor", () => {
  it("valida o formulário", () => {
    expect(validateDeliverySettings(input)).toBeNull();
    expect(validateDeliverySettings({ ...input, pickupEnabled: false, deliveryEnabled: false })).toContain("pelo menos uma opção");
    expect(validateDeliverySettings({ ...input, defaultFee: null, zones: [] })).toContain("preço da entrega");
    expect(validateDeliverySettings({ ...input, deliveryEnabled: false, defaultFee: null, zones: [] })).toBeNull();
    expect(validateDeliverySettings({ ...input, zones: [{ municipalityId: A, fee: 1 }, { municipalityId: A, fee: 2 }] })).toContain("duas vezes");
    expect(validateDeliverySettings({ ...input, zones: [{ municipalityId: A, fee: -1 }] })).toContain("inválido");
    expect(validateDeliverySettings({ ...input, freeOver: 0 })).toContain("maior que zero");
    expect(validateDeliverySettings({ ...input, minOrder: 30000 })).toContain("abaixo do valor mínimo");
  });
  it("calcula como a base de dados", () => {
    expect(computeDeliveryQuote(policy, A, 20000)).toMatchObject({ delivery: true, fee: 1500, free: false, missing_for_free: 5000 });
    expect(computeDeliveryQuote(policy, C, 20000)).toMatchObject({ delivery: true, fee: 3000 });
    expect(computeDeliveryQuote(policy, C, 30000)).toMatchObject({ delivery: true, fee: 0, free: true, missing_for_free: null });
    expect(computeDeliveryQuote({ ...policy, default_fee: null }, C, 20000)).toMatchObject({ delivery: false, reason: "area", fee: null });
    expect(computeDeliveryQuote({ ...policy, min_order: 5000 }, A, 3000)).toMatchObject({ delivery: false, reason: "min_order" });
    expect(computeDeliveryQuote(policy, null, 3000)).toMatchObject({ delivery: false, reason: "needs_area" });
    expect(computeDeliveryQuote({ ...policy, delivery_enabled: false }, A, 3000)).toMatchObject({ delivery: false, reason: "no_delivery", missing_for_free: null });
    expect(computeDeliveryQuote(null, A, 3000)).toMatchObject({ configured: false, pickup: true, delivery: true, fee: 0 });
  });
  it("textos para o comprador", () => {
    const lines = deliveryPolicyLines(policy);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("🏪 Levantamento no local: Mercado Alemão");
    expect(lines[1]).toMatch(/^🚚 Entrega: de 1.500 Kz a 3.000 Kz, conforme o município$/);
    expect(lines[3]).toBe("⏱️ Prazo: 1 a 2 dias");
    expect(deliveryPolicyLines(policy)[2]).toMatch(/^🎁 Entrega grátis a partir de 25.000 Kz$/);
    expect(deliveryPolicyLines({ ...policy, default_fee: null })).toContain("📍 Entrega em: Huambo, Caála");
    expect(deliveryPolicyLines({ ...policy, delivery_enabled: false, pickup_place: null })).toEqual(["🏪 Levantamento no local", "🚫 Não faz entregas"]);
    expect(deliveryPolicyLines(null)[0]).toContain("a combinar");
    expect(deliveryQuoteText(computeDeliveryQuote(policy, C, 30000))).toBe("Entrega grátis 🎁");
    expect(deliveryQuoteText(computeDeliveryQuote(policy, A, 1000))).toMatch(/^Entrega: 1.500 Kz$/);
    expect(deliveryQuoteText(computeDeliveryQuote({ ...policy, default_fee: null }, C, 1))).toBe(DELIVERY_REASON_TEXT.area);
    expect(freeDeliveryHint(computeDeliveryQuote(policy, A, 20000))).toMatch(/^Faltam 5.000 Kz para a entrega ser grátis\.$/);
    expect(freeDeliveryHint(computeDeliveryQuote(policy, A, 30000))).toBeNull();
  });
  it("traduz para inglês e chinês", () => {
    for (const l of deliveryPolicyLines(policy)) { expect(tc(l, "en")).not.toBe(l); expect(tc(l, "zh")).not.toBe(l); }
    for (const t of Object.values(DELIVERY_REASON_TEXT)) expect(tc(t, "zh")).not.toBe(t);
    expect(tc(freeDeliveryHint(computeDeliveryQuote(policy, A, 20000))!, "en")).toMatch(/more for free delivery\.$/);
    expect(tc("Recebeu uma encomenda de 7000.00 Kz (inclui entrega: 1000 Kz).", "en")).toBe("You received an order of 7000.00 Kz (includes delivery: 1000 Kz).");
    for (const code of ["SELLER_NO_PICKUP", "SELLER_NO_DELIVERY", "DELIVERY_BELOW_MINIMUM", "DELIVERY_AREA_NOT_COVERED", "FULFILLMENT_REQUIRED", "DELIVERY_AREA_REQUIRED"]) {
      const msg = friendlyError({ message: code }); expect(msg).not.toMatch(/Não foi possível/); expect(tc(msg, "en")).not.toBe(msg);
    }
  });
  it("escolha inicial e totais do carrinho", () => {
    expect(defaultFulfillment(computeDeliveryQuote(policy, A, 1))).toBe("delivery");
    expect(defaultFulfillment(computeDeliveryQuote({ ...policy, delivery_enabled: false }, A, 1))).toBe("pickup");
    expect(defaultFulfillment(computeDeliveryQuote({ ...policy, pickup_enabled: false, default_fee: null }, C, 1))).toBeNull();
    const rows = [{ seller_id: "s1", seller_name: "A", subtotal: 20000, quote: computeDeliveryQuote(policy, A, 20000) },
      { seller_id: "s2", seller_name: "B", subtotal: 3000, quote: computeDeliveryQuote({ ...policy, pickup_enabled: false, min_order: 5000 }, A, 3000) }];
    expect(cartTotals(rows, { s1: "delivery", s2: "pickup" })).toEqual({ subtotal: 23000, delivery: 1500, total: 24500, problems: ["s2"] });
    expect(cartTotals(rows, { s1: "pickup" })).toMatchObject({ total: 23000, problems: ["s2"] });
  });
});

describe("regras de entrega: servidor", () => {
  it("guarda as regras e as zonas", async () => {
    const calls: any[] = [];
    const chain = (t: string) => { const q: any = {}; for (const m of ["upsert", "delete", "insert", "eq"]) q[m] = (...a: any[]) => { calls.push([t, m, ...a]); return q; };
      q.then = (res: any) => res({ error: null }); return q; };
    const c = { from: chain } as any;
    expect((await saveDeliverySettings(c, "u1", { ...input, pickupEnabled: false, deliveryEnabled: false })).error?.message).toContain("pelo menos");
    expect((await saveDeliverySettings(c, "u1", { ...input, pickupPlace: " Loja ", deliveryDays: " 2 dias " })).error).toBeNull();
    expect(calls.find(x => x[1] === "upsert")[2]).toMatchObject({ seller_id: "u1", pickup_place: "Loja", default_fee: 3000, free_over: 25000, delivery_days: "2 dias" });
    expect(calls.find(x => x[0] === "seller_delivery_zones" && x[1] === "insert")[2]).toEqual([{ seller_id: "u1", municipality_id: A, fee: 1500 }]);
    calls.length = 0;
    await saveDeliverySettings(c, "u1", { ...input, deliveryEnabled: false });
    expect(calls.find(x => x[1] === "upsert")[2]).toMatchObject({ delivery_enabled: false, default_fee: null, free_over: null });
    expect(calls.some(x => x[0] === "seller_delivery_zones" && x[1] === "insert")).toBe(false);
  });
  it("lê a política e o carrinho com números", async () => {
    const p = await getDeliveryPolicy({ rpc: vi.fn().mockResolvedValue({ data: { ...policy, default_fee: "3000", free_over: "25000", zones: [{ municipality_id: A, fee: "1500" }] }, error: null }) } as any, "s");
    expect(p.data).toMatchObject({ default_fee: 3000, free_over: 25000, zones: [{ fee: 1500 }] });
    const q = await cartDeliveryQuote({ rpc: vi.fn().mockResolvedValue({ data: [{ seller_id: "s", seller_name: "S", subtotal: "20000.00", quote: { fee: "1500", missing_for_free: "5000.00", delivery: true } }], error: null }) } as any, A);
    expect(q.data[0]).toMatchObject({ subtotal: 20000, quote: { fee: 1500, missing_for_free: 5000 } });
  });
  it("encomenda com a escolha de cada vendedor", async () => {
    expect(validateCheckoutV3({ choices: { s1: "pickup" }, paymentMethod: "cash_on_delivery", phone: "923000000" }, ["s1", "s2"])).toContain("cada vendedor");
    expect(validateCheckoutV3({ choices: { s1: "delivery" }, paymentMethod: "cash_on_delivery", phone: "923000000", deliveryText: "Rua" }, ["s1"])).toContain("município");
    expect(validateCheckoutV3({ choices: { s1: "delivery" }, paymentMethod: "cash_on_delivery", phone: "923000000", municipalityId: A }, ["s1"])).toContain("morada");
    expect(validateCheckoutV3({ choices: { s1: "pickup" }, paymentMethod: "cash_on_delivery", phone: "12" }, ["s1"])).toContain("telefone");
    const rpc = vi.fn().mockResolvedValue({ data: ["o1"], error: null });
    const del = { delete: () => ({ not: vi.fn().mockResolvedValue({ error: null }) }) };
    const c = { rpc, from: () => del } as any;
    await placeOrdersV3(c, { choices: { s1: "delivery", s2: "pickup" }, paymentMethod: "cash_on_delivery", phone: " 923000000 ", municipalityId: A, deliveryText: " Rua 1 ", protected: true, point: { lat: -12.77, lng: 15.73 } }, ["s1", "s2"]);
    expect(rpc).toHaveBeenNthCalledWith(1, "place_orders_v3", { p_choices: { s1: "delivery", s2: "pickup" }, p_payment_method: "cash_on_delivery", p_contact_phone: "923000000",
      p_municipality_id: A, p_delivery_text: "Rua 1", p_note: null, p_protected: true });
    expect(rpc).toHaveBeenNthCalledWith(2, "set_order_delivery_point", { p_order_id: "o1", p_lat: -12.77, p_lng: 15.73 });
  });
});
