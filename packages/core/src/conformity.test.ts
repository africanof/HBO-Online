import { describe, expect, it, vi } from "vitest";
import { validateClaim, claimActions, claimRef, claimDeadlineText, openListingClaim, respondListingClaim, buyerListingClaim, decideListingClaim,
  getClaimDeadline, listListingClaimsForAdmin, CONFORMITY_DECLARATION, CLAIM_REQUEST_LABELS } from "./conformity";
import { createClassifiedListing, friendlyError } from "./classified-listings";
import { saveProduct } from "./shop";
import { getNotificationLink } from "./notifications";

const rpcClient = (data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }) as any;

describe("garantia de conformidade", () => {
  it("validação da reclamação", () => {
    const ok = { request: "refund" as const, reason: "omitted_defect" as const, description: "O motor tem uma fuga de óleo." };
    expect(validateClaim({ ...ok, reason: "" })).toBe("Escolha o que está errado.");
    expect(validateClaim({ ...ok, request: "" })).toContain("troca, devolução ou reembolso");
    expect(validateClaim({ ...ok, description: "curto" })).toContain("pelo menos 10");
    expect(validateClaim({ ...ok, amount: 0 })).toContain("maior que zero");
    expect(validateClaim({ ...ok, request: "exchange", amount: 0 })).toBeNull();
    expect(validateClaim(ok)).toBeNull();
  });
  it("botões de cada pessoa", () => {
    const later = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 1000).toISOString();
    expect(claimActions({ role: "seller", status: "open", respond_by: later })).toEqual(["accept", "decline"]);
    expect(claimActions({ role: "seller", status: "escalated", respond_by: later })).toEqual([]);
    expect(claimActions({ role: "buyer", status: "open", respond_by: later })).toEqual(["withdraw"]);
    expect(claimActions({ role: "buyer", status: "open", respond_by: past })).toEqual(["escalate", "withdraw"]);
    expect(claimActions({ role: "buyer", status: "declined", respond_by: later })).toEqual(["escalate", "withdraw"]);
    expect(claimActions({ role: "buyer", status: "accepted", respond_by: later })).toEqual(["confirm", "escalate", "withdraw"]);
    expect(claimActions({ role: "buyer", status: "resolved", respond_by: later })).toEqual([]);
  });
  it("textos", () => {
    expect(claimRef(1001)).toBe("R-1001");
    expect(claimDeadlineText("2026-10-20T10:00:00Z")).toBe("Pode reclamar até 20/10/2026.");
    expect(claimDeadlineText(null)).toBeNull();
    expect(CONFORMITY_DECLARATION).toContain("troca, a devolução ou o reembolso");
    expect(CLAIM_REQUEST_LABELS.exchange).toBe("🔄 Troca");
  });
  it("erros e avisos", () => {
    expect(friendlyError({ message: "CONFORMITY_REQUIRED" })).toContain("confirme que o anúncio descreve o artigo");
    expect(friendlyError({ message: "CLAIM_NOT_ALLOWED" })).toContain("Só quem comprou ou arrendou");
    expect(friendlyError({ message: "CLAIM_ALREADY_OPEN" })).toContain("já tem uma reclamação aberta".replace("já", "Já"));
    expect(getNotificationLink({ data: { for: "claim" }, type: "system", title: "x" } as any)?.href).toBe("/disputas");
  });
  it("chamadas ao servidor", async () => {
    const c = rpcClient();
    await openListingClaim(c, "L", { request: "exchange", reason: "missing_parts", description: " Faltava o macaco e o pneu. ", amount: 5000 });
    expect(c.rpc).toHaveBeenCalledWith("open_listing_claim", { p_listing_id: "L", p_request: "exchange", p_reason: "missing_parts", p_description: "Faltava o macaco e o pneu.", p_amount: null });
    expect((await openListingClaim(c, "L", { request: "", reason: "other", description: "xxxxxxxxxxxx" })).error?.message).toContain("troca");
    expect((await respondListingClaim(c, "id", false, " ")).error?.message).toBe("Escreva o motivo da recusa.");
    await respondListingClaim(c, "id", true); expect(c.rpc).toHaveBeenLastCalledWith("respond_listing_claim", { p_claim_id: "id", p_accept: true, p_note: null });
    await buyerListingClaim(c, "id", "escalate", " Não respondeu "); expect(c.rpc).toHaveBeenLastCalledWith("buyer_listing_claim", { p_claim_id: "id", p_action: "escalate", p_note: "Não respondeu" });
    expect((await decideListingClaim(c, "id", true, "")).error?.message).toContain("decisão");
    expect(await getClaimDeadline(rpcClient("2026-10-20T10:00:00Z"), "L")).toBe("2026-10-20T10:00:00Z");
    const l = rpcClient(null); expect((await listListingClaimsForAdmin(l, "")).data).toEqual([]);
    expect(l.rpc).toHaveBeenCalledWith("admin_list_listing_claims", { p_status: null });
  });
  it("a declaração vai com o anúncio e o produto", async () => {
    const inserted: any[] = [];
    const client = { from: () => ({ insert: (row: any) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: "x" }, error: null }) }) }; } }) } as any;
    await createClassifiedListing(client, { ownerId: "u", listingType: "product", purpose: "sale", title: "Mota", conformity: true } as any);
    expect(typeof inserted[0].conformity_accepted_at).toBe("string");
    await createClassifiedListing(client, { ownerId: "u", listingType: "product", purpose: "wanted", title: "Procuro mota" } as any);
    expect(inserted[1].conformity_accepted_at).toBeNull();
    await saveProduct(client, "u", { name: "Saco de arroz", price: 15000, stock: 3, categoryId: "c", municipalityId: "m", conformity: true });
    expect(typeof inserted[2].conformity_accepted_at).toBe("string");
  });
});
