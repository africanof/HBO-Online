import { describe, expect, it, vi } from "vitest";
import { readAgro, validateAgro, agroAttributes, agroPriceLabel, agroSummary, listAgroListings, listingPriceLabel, AGRO_CATEGORIES, AGRO_UNITS, HELP_FAQ } from "./index";

describe("agricultura e campo", () => {
  it("lê os dados do anúncio", () => {
    expect(readAgro({})).toBeNull();
    expect(readAgro({ agro: true, agroCategory: "xpto" })).toBeNull();
    expect(readAgro({ agro: true, agroCategory: "cereais", unit: "saco50", quantity: 200, availableFrom: "2026-11-01" }))
      .toEqual({ category: "cereais", unit: "saco50", quantity: 200, availableFrom: "2026-11-01" });
    expect(readAgro({ agro: true, agroCategory: "gado", unit: "??", quantity: "abc" })).toEqual({ category: "gado", unit: "unidade", quantity: null, availableFrom: null });
    expect(AGRO_CATEGORIES.length).toBe(10); expect(AGRO_UNITS.map(u => u.value)).toContain("cabeca");
  });
  it("valida o formulário", () => {
    const today = "2026-10-13";
    expect(validateAgro({ category: "", unit: "kg" }, today)).toMatch(/tipo/);
    expect(validateAgro({ category: "frutas", unit: "" }, today)).toMatch(/unidade/);
    expect(validateAgro({ category: "frutas", unit: "kg", quantity: "-3" }, today)).toMatch(/quantidade/);
    expect(validateAgro({ category: "frutas", unit: "kg", availableFrom: "2026-10-01" }, today)).toMatch(/passado/);
    expect(validateAgro({ category: "frutas", unit: "kg", quantity: "1 500", availableFrom: "2026-11-01" }, today)).toBeNull();
    expect(agroAttributes({ category: "frutas", unit: "kg", quantity: "1 500,5", availableFrom: "" })).toEqual({ agro: true, agroCategory: "frutas", unit: "kg", quantity: 1500.5, availableFrom: null });
  });
  it("preço por unidade e resumo", () => {
    const info = readAgro({ agro: true, agroCategory: "cereais", unit: "saco50", quantity: 1200, availableFrom: "2026-11-01" });
    expect(agroPriceLabel(12000, info)).toBe("12 000 Kz / saco 50 kg");
    expect(agroPriceLabel(null, info)).toBeNull();
    expect(agroSummary(info!, "2026-10-13")).toBe("🌽 Cereais · 1 200 sacos de 50 kg disponíveis · Disponível a partir de 01/11/2026");
    expect(agroSummary({ category: "gado", unit: "cabeca", quantity: 1, availableFrom: null }, "2026-10-13")).toBe("🐄 Gado · 1 cabeça disponível · Disponível já");
    expect(listingPriceLabel({ purpose: "sale", price: 500, currency: "AOA", attributes: { agro: true, agroCategory: "horticolas", unit: "kg" } })).toBe("500 Kz / kg");
    expect(listingPriceLabel({ purpose: "sale", price: 500, currency: "AOA", attributes: {} })).toBe("500 Kz");
  });
  it("lista do campo", async () => {
    const calls: any[] = [];
    const chain: any = new Proxy({}, { get: (_t, k) => k === "then" ? (res: any) => res({ data: [{ id: "1" }], error: null }) : (...a: any[]) => { calls.push([k, ...a]); return chain; } });
    const r = await listAgroListings({ from: (t: string) => { calls.push(["from", t]); return chain; } } as any, { category: "gado", query: " boi%" });
    expect(r.data).toEqual([{ id: "1" }]);
    expect(calls).toContainEqual(["contains", "attributes", { agro: true, agroCategory: "gado" }]);
    expect(calls).toContainEqual(["ilike", "title", "%boi%"]);
    expect(HELP_FAQ.some(f => /campo/.test(f.q))).toBe(true);
  });
});
