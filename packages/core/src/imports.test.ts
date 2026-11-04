import { describe, expect, it } from "vitest";
import { validateImportRequest, suggestedImportFee, importRef, IMPORT_NEXT, IMPORT_DICT, IMPORT_ORIGINS } from "./imports";
import { LANGS } from "./i18n";

describe("importação", () => {
  const ok = { title: "Painel solar 400 W", quantity: 2, origin: "china" as const, fulfillment: "pickup" as const, phone: "923 456 789" };
  it("valida o pedido", () => {
    expect(validateImportRequest(ok)).toBeNull();
    expect(validateImportRequest({ ...ok, title: "ab" })).toBe("im.err_title");
    expect(validateImportRequest({ ...ok, quantity: 0 })).toBe("im.err_qty");
    expect(validateImportRequest({ ...ok, phone: "123" })).toBe("im.err_phone");
    expect(validateImportRequest({ ...ok, fulfillment: "delivery", address: "" })).toBe("im.err_address");
    expect(validateImportRequest({ ...ok, budget: -5 })).toBe("im.err_budget");
  });
  it("sugere 10% de serviço arredondado às centenas", () => {
    expect(suggestedImportFee(400000, 120000)).toBe(52000);
    expect(suggestedImportFee(12345, 0)).toBe(1200);
  });
  it("referência e passos da equipa", () => {
    expect(importRef(7)).toBe("IMP-7");
    expect(IMPORT_NEXT.paid).toContain("refunded");
    expect(IMPORT_NEXT.delivered).toBeUndefined();
  });
  it("todos os textos em todas as línguas", () => {
    for (const [k, v] of Object.entries(IMPORT_DICT)) for (const l of LANGS) expect(v[l], k + " " + l).toBeTruthy();
    for (const o of IMPORT_ORIGINS) expect(IMPORT_DICT["im.o." + o]).toBeTruthy();
    for (const s of ["research_payment", "research_submitted", "requested", "quoted", "awaiting_payment", "submitted", "paid", "purchased", "in_transit", "arrived", "delivered", "declined", "cancelled", "refunded"]) expect(IMPORT_DICT["im.s." + s]).toBeTruthy();
  });
});
