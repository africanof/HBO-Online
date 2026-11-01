import { describe, expect, it } from "vitest";
import { formatBudget, validateBudget, budgetPrice, listingPriceLabel, wantedReplyMessage, listWanted, wantedKeywords, foldText, findHelpers } from "./wanted";
import { createClassifiedListing, updateClassifiedListing } from "./classified-listings";

describe("Procura-se", () => {
  it("mostra o orçamento de forma clara", () => {
    expect(formatBudget(20000, 25000)).toBe("20 000 – 25 000 Kz");
    expect(formatBudget(null, 30000)).toBe("até 30 000 Kz");
    expect(formatBudget(20000, null)).toBe("a partir de 20 000 Kz");
    expect(formatBudget(25000, 25000)).toBe("25 000 Kz");
    expect(formatBudget(null, undefined)).toBe("Orçamento a combinar");
  });
  it("valida o orçamento", () => {
    expect(validateBudget(30000, 20000)).toMatch(/mínimo não pode ser maior/);
    expect(validateBudget(-1, undefined)).toMatch(/mínimo válido/);
    expect(validateBudget(20000, 25000)).toBeNull();
    expect(budgetPrice(20000, 25000)).toBe(25000);
    expect(budgetPrice(20000, undefined)).toBe(20000);
  });
  it("o cartão mostra orçamento nos pedidos e preço nos outros", () => {
    expect(listingPriceLabel({ purpose: "wanted", budget_min: 20000, budget_max: 25000 })).toBe("20 000 – 25 000 Kz");
    expect(listingPriceLabel({ purpose: "wanted", price: 30000 })).toBe("até 30 000 Kz");
    expect(listingPriceLabel({ purpose: "sale", price: 30000 })).toBe("30 000 Kz");
    expect(wantedReplyMessage("Router 5G")).toMatch(/tenho o que procura/);
    expect(wantedReplyMessage("Eletricista", true)).toMatch(/posso fazer este serviço/);
  });
  it("grava o orçamento só nos pedidos e procura só pedidos", async () => {
    const rows: any[] = []; const rpc: any[] = [];
    const q: any = { select: () => q, eq: () => q, single: () => Promise.resolve({ data: {}, error: null }) };
    const c: any = { from: () => ({ insert: (r: any) => { rows.push(r); return q; }, update: (r: any) => { rows.push(r); return q; } }), rpc: (f: string, a: any) => { rpc.push(a); return Promise.resolve({ data: [], error: null }); } };
    await createClassifiedListing(c, { ownerId: "u", listingType: "product", purpose: "wanted", title: "Preciso de router", budgetMin: 20000, budgetMax: 25000, price: 25000 });
    await updateClassifiedListing(c, "l", { listingType: "product", purpose: "sale", title: "Router", budgetMin: 1, budgetMax: 2 });
    rpc.length = 0;
    expect(rows[0]).toMatchObject({ budget_min: 20000, budget_max: 25000, price: 25000 });
    expect(rows[1]).toMatchObject({ budget_min: null, budget_max: null });
    await listWanted(c, "router");
    expect(rpc[0]).toMatchObject({ p_purpose: "wanted", p_query: "router" });
  });

  it("tira as raízes das palavras como o servidor (sem acentos)", () => {
    expect(foldText("Doméstica Ação")).toBe("domestica acao");
    expect(wantedKeywords("Procuro um eletricista")).toEqual(["eletri"]);
    expect(wantedKeywords("Preciso de uma doméstica para limpeza")).toEqual(["domest", "limpez"]);
    expect(wantedKeywords("Preciso de um Router 5G da Unitel")).toEqual(["router", "unitel"]);
    expect(wantedKeywords("Procuro de para")).toEqual([]);
  });
  it("procura profissionais e empresas com as raízes", async () => {
    const calls: any[] = [];
    const c: any = { rpc: (f: string, a: any) => { calls.push({ f, q: a.p_query }); return Promise.resolve({ data: f === "provider_directory" ? [{ user_id: "p1" }] : [{ id: "b1" }], error: null }); } };
    const r = await findHelpers(c, "Procuro canalizador e eletricista");
    expect(calls.map(x => x.q)).toEqual(["canali", "canali", "eletri", "eletri"]);
    expect(r.providers).toEqual([{ user_id: "p1" }]);
    expect((await findHelpers(c, "procuro")).providers).toEqual([]);
  });
});
