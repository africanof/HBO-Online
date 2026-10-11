import { describe, expect, it } from "vitest";
import { validateProviderInput, validateServiceInput, validateBusinessInput, ratingLabel, whatsappLink, submitReview, contactDirectoryOwner, listProviders } from "./directory";

const provider = { displayName: "João", categoryId: "c", municipalityId: "m" };

describe("directory validation", () => {
  it("validates provider profiles", () => {
    expect(validateProviderInput(provider)).toBeNull();
    expect(validateProviderInput({ ...provider, displayName: " " })).toMatch(/nome/);
    expect(validateProviderInput({ ...provider, categoryId: "" })).toMatch(/área/);
    expect(validateProviderInput({ ...provider, municipalityId: undefined })).toMatch(/município/);
    expect(validateProviderInput({ ...provider, whatsapp: "12" })).toMatch(/WhatsApp/);
  });
  it("validates services and businesses", () => {
    expect(validateServiceInput({ title: "" })).toMatch(/serviço/);
    expect(validateServiceInput({ title: "x", priceFrom: -5 })).toMatch(/preço/);
    expect(validateBusinessInput({ name: "Loja", categoryId: "c", municipalityId: "m" })).toBeNull();
    expect(validateBusinessInput({ name: "Loja", categoryId: "c" })).toMatch(/município/);
  });
});

describe("display helpers", () => {
  it("formats ratings", () => {
    expect(ratingLabel(0, 0)).toBe("Sem avaliações");
    expect(ratingLabel(4.4, 12)).toBe("★★★★☆ 4.4 (12)");
  });
  it("builds WhatsApp links with Angola prefix", () => {
    expect(whatsappLink("923 000 000")).toBe("https://wa.me/244923000000");
    expect(whatsappLink("+244923000000", "Olá")).toBe("https://wa.me/244923000000?text=Ol%C3%A1");
    expect(whatsappLink("12")).toBeNull();
  });
});

describe("directory calls", () => {
  const calls: any[] = [];
  const client: any = { rpc: async (fn: string, args: any) => { calls.push([fn, args]); return { data: { id: "c1" }, error: null }; } };
  it("sends the right target to the server", async () => {
    await submitReview(client, { providerId: "p1" }, 5, " Ótimo ");
    await contactDirectoryOwner(client, { businessId: "b1" }, "Olá");
    await listProviders(client, { query: " eletricista ", municipalityId: "m" });
    expect(calls).toEqual([
      ["submit_review", { p_provider_id: "p1", p_business_id: null, p_rating: 5, p_comment: "Ótimo" }],
      ["start_directory_conversation", { p_provider_id: null, p_business_id: "b1", p_message: "Olá" }],
      ["provider_directory", { p_query: "eletricista", p_category_id: null, p_municipality_id: "m", p_limit: 30 }]
    ]);
  });
  it("rejects invalid ratings and empty messages before calling", async () => {
    expect((await submitReview(client, { providerId: "p" }, 0, "")).error?.message).toMatch(/estrelas/);
    expect((await contactDirectoryOwner(client, { providerId: "p" }, " ")).error?.message).toMatch(/mensagem/);
  });
});

describe("área de atividade «Outra»", () => {
  it("exige o texto quando se escolhe Outra", async () => {
    const { validateProviderInput, validateBusinessInput, OTHER_CATEGORY } = await import("./directory");
    const base = { displayName: "Ana", municipalityId: "m" };
    expect(validateProviderInput({ ...base, categoryId: "" })).toMatch(/área de atividade/);
    expect(validateProviderInput({ ...base, categoryId: OTHER_CATEGORY, customCategory: " " })).toMatch(/Escreva/);
    expect(validateProviderInput({ ...base, categoryId: OTHER_CATEGORY, customCategory: "x".repeat(61) })).toMatch(/60/);
    expect(validateProviderInput({ ...base, categoryId: OTHER_CATEGORY, customCategory: "Canalizador" })).toBeNull();
    expect(validateBusinessInput({ name: "Loja", municipalityId: "m", categoryId: OTHER_CATEGORY, customCategory: "Venda de pneus" })).toBeNull();
  });
  it("grava, lê e mostra a área escrita", async () => {
    const { categoryColumns, categoryFormValues, categoryLabel, OTHER_CATEGORY } = await import("./directory");
    expect(categoryColumns(OTHER_CATEGORY, "  Costureira ")).toEqual({ category_id: null, custom_category: "Costureira" });
    expect(categoryColumns("c1", "ignorado")).toEqual({ category_id: "c1", custom_category: null });
    expect(categoryFormValues({ category_id: null, custom_category: "Costureira" })).toEqual({ categoryId: OTHER_CATEGORY, customCategory: "Costureira" });
    expect(categoryFormValues({ category_id: "c1", custom_category: null })).toEqual({ categoryId: "c1", customCategory: "" });
    expect(categoryLabel({ categories: null, custom_category: "Costureira" })).toBe("Costureira");
    expect(categoryLabel({ categories: { name: "Limpeza" }, custom_category: null })).toBe("Limpeza");
  });
});
