import { describe, expect, it } from "vitest";
import { buildSeo, fetchSeo } from "./seo";

const img = "https://x.supabase.co/storage/v1/object/public/classified-media/a.jpg";
describe("SEO e partilhas", () => {
  it("mostra título, preço e fotografia do anúncio", () => {
    const s = buildSeo("listing", { title: "Toyota Hilux 2015", description: "Bom estado,   pouco uso.", price: 9500000, currency: "AOA", purpose: "sale", media: [img], status: "published" });
    expect(s.title).toBe("Toyota Hilux 2015 — 9 500 000 Kz");
    expect(s.description).toBe("À venda · 9 500 000 Kz. Bom estado, pouco uso.");
    expect(s.image).toBe(img);
    expect(s.noindex).toBe(false);
  });
  it("usa o orçamento nos pedidos Procura-se e esconde do Google o que não está publicado", () => {
    const s = buildSeo("listing", { title: "Preciso de casa", purpose: "wanted", budget_min: 20000, budget_max: 25000, currency: "AOA", media: [], status: "sold" });
    expect(s.title).toBe("Preciso de casa — 20 000 – 25 000 Kz");
    expect(s.image).toBeUndefined();
    expect(s.noindex).toBe(true);
  });
  it("corta textos longos e trata perfis", () => {
    expect(buildSeo("product", { name: "Fuba", price: 1000, currency: "AOA", description: "x".repeat(400), media: ["http://inseguro"], active: true }).description.length).toBe(160);
    expect(buildSeo("provider", { display_name: "Zé", categories: { name: "Eletricista" }, active: true }).title).toBe("Zé — Eletricista");
    expect(buildSeo("business", { name: "Farmácia", custom_category: "Saúde", active: false }).noindex).toBe(true);
    expect(buildSeo("market", { name: "Praça do Kapango", status: "active" }).title).toBe("Praça do Kapango — praça do Huambo");
    expect(buildSeo("seller", { full_name: "" }).title).toBe("Vendedor — anúncios e avaliações");
    expect(buildSeo("listing", null).noindex).toBe(true);
  });
  it("não pergunta à base de dados com um id inválido", async () => {
    const client: any = { from: () => { throw new Error("não devia chamar"); } };
    expect((await fetchSeo(client, "product", "abc")).noindex).toBe(true);
  });
});
