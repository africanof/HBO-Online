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
