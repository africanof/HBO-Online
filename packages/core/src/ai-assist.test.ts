import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { aiCatalog, aiKnowledgeText, aiMessage, cleanDetails, fillFromPhoto, priceHint, smartSearch, smartSearchFrom, translateListing } from "./ai-assist";

const CATS = [{ slug: "telemoveis-e-tablets", name: "Telemóveis e Tablets" }, { slug: "viaturas", name: "Viaturas" }];
function fake(opts: { session?: boolean; invoke?: any; rpc?: any; from?: any }) {
  return { auth: { getSession: async () => ({ data: { session: opts.session === false ? null : {} } }) },
    functions: { invoke: opts.invoke ?? vi.fn() }, rpc: opts.rpc ?? vi.fn(), from: opts.from ?? vi.fn() } as any;
}

describe("ai-assist", () => {
  it("o conhecimento da Edge Function está igual aos textos da Ajuda", () => {
    const file = fileURLToPath(new URL("../../../supabase/functions/ai-assist/knowledge.ts", import.meta.url));
    const expected = "// Gerado a partir de packages/core/src/legal.ts (Ajuda, Termos, Privacidade, Devoluções) com o teste packages/core/src/ai-assist.test.ts (UPDATE_AI_KNOWLEDGE=1 pnpm test).\n// Não editar à mão: volte a gerar quando estes textos mudarem.\nexport const KNOWLEDGE = " + JSON.stringify(aiKnowledgeText()) + ";\n";
    if (process.env.UPDATE_AI_KNOWLEDGE) writeFileSync(file, expected);
    expect(readFileSync(file, "utf8")).toBe(expected);
  });
  it("catálogo tem categorias e campos", () => {
    const c = aiCatalog(CATS);
    expect(c).toMatch(/viaturas = Viaturas/);
    expect(c).toMatch(/fuel \(uma de: gasolina\|gasoleo/);
  });
  it("limpa campos inválidos", () => {
    expect(cleanDetails("vehicle", null, { brand: "Toyota", fuel: "petroleo", year: "2015", mileage: "-3", foo: "x" })).toEqual({ brand: "Toyota", year: "2015" });
    expect(cleanDetails("product", "telemoveis-e-tablets", { phoneType: "telemovel", storage: "128" })).toEqual({ phoneType: "telemovel", storage: "128" });
  });
  it("pesquisa inteligente → filtros válidos", () => {
    const s = smartSearchFrom({ keywords: "Hilux", listing_type: "vehicle", purpose: "sale", category_slug: "nada", min_price: null, max_price: 5000000, attributes: { fuel: "gasoleo", transmission: "x" }, remaining: 29 }, CATS);
    expect(smartSearchFrom({ keywords: "carro", listing_type: "vehicle" }, CATS).query).toBe("");
    expect(smartSearchFrom({ keywords: "carro" }, CATS).query).toBe("carro");
    expect(s).toMatchObject({ query: "Hilux", listingType: "vehicle", purpose: "sale", categorySlug: "", maxPrice: "5000000", minPrice: "", attributes: { fuel: "gasoleo" } });
  });
  it("exige sessão e texto", async () => {
    expect((await smartSearch(fake({}), " ", CATS)).error).toBe("AI_NEEDS_TEXT");
    expect((await smartSearch(fake({ session: false }), "carro", CATS)).error).toBe("AUTH_REQUIRED");
  });
  it("preencher pela foto limpa a resposta", async () => {
    const invoke = vi.fn(async () => ({ data: { found: true, title: "iPhone 12", description: "x", listing_type: "product", category_slug: "telemoveis-e-tablets", details: { phoneType: "telemovel", brand: "Apple", storage: "999" }, remaining: 14 }, error: null }));
    const r = await fillFromPhoto(fake({ invoke }), "data:image/jpeg;base64,AAA", "image/jpeg", CATS);
    expect(r.data).toMatchObject({ listingType: "product", categorySlug: "telemoveis-e-tablets", details: { phoneType: "telemovel", brand: "Apple" } });
    expect(invoke.mock.calls[0][1].body.image).toBe("AAA");
  });
  it("tradução usa a guardada quando o texto não mudou", async () => {
    const maybeSingle = async () => ({ data: { title: "Car", description: "Good", source_hash: "h1" } });
    const q: any = { select: () => q, eq: () => q, maybeSingle };
    const invoke = vi.fn();
    const r = await translateListing(fake({ from: () => q, rpc: async () => ({ data: "h1", error: null }), invoke }), "id", "en");
    expect(r.data?.title).toBe("Car"); expect(invoke).not.toHaveBeenCalled();
  });
  it("ajuda no preço precisa de amostras", async () => {
    expect(await priceHint(fake({ rpc: async () => ({ data: [], error: null }) }), null, "vehicle", "sale")).toBeNull();
    expect(await priceHint(fake({ rpc: async () => ({ data: [{ samples: 4, low: 100, median: 200, high: 300 }], error: null }) }), null, "vehicle", "sale")).toEqual({ samples: 4, low: 100, median: 200, high: 300 });
    expect(await priceHint(fake({}), null, "vehicle", "wanted")).toBeNull();
  });
  it("mensagens de erro", () => { expect(aiMessage("AI_LIMIT")).toMatch(/amanhã/); expect(aiMessage("zzz")).toMatch(/Tente de novo/); });
});
