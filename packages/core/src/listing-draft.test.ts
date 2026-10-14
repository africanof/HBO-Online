import { describe, expect, it } from "vitest";
import { draftHasContent, parseDraft, loadListingDraft, saveListingDraft, clearListingDraft, draftAgeText, LISTING_DRAFT_KEY, type ListingDraftFields } from "./listing-draft";

const fields = (p: Partial<ListingDraftFields> = {}): ListingDraftFields => ({ listingType: "classified", isAgro: false, agroCat: "", agroUnit: "kg", agroQty: "", agroFrom: "", purpose: "sale",
  title: "", description: "", price: "", budgetMin: "", budgetMax: "", saleMode: "", acceptsTrade: false, tradeWants: "", auctionDays: "7", categoryId: "", provinceId: "", municipalityId: "",
  marketId: "", videoUrl: "", agentCode: "", directions: "", point: null, ...p });
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };

describe("rascunho do anúncio", () => {
  it("só guarda quando há conteúdo", async () => {
    expect(draftHasContent(fields())).toBe(false);
    expect(draftHasContent(fields({ title: " Mesa " }))).toBe(true);
    expect(draftHasContent(fields(), [{ key: "a", uri: "file://x" }])).toBe(true);
    const s = mem();
    expect(await saveListingDraft(s, fields())).toBe(false); expect(s.m.get(LISTING_DRAFT_KEY)).toBe("");
    expect(await saveListingDraft(s, fields({ title: "Mesa" }), [{ key: "f1", uri: "file:///d/f1.jpg", mimeType: "image/jpeg" }], 1000)).toBe(true);
    const d = await loadListingDraft(s, 2000);
    expect(d?.fields.title).toBe("Mesa"); expect(d?.photos).toHaveLength(1);
    await clearListingDraft(s); expect(await loadListingDraft(s)).toBeNull();
  });
  it("ignora rascunhos estragados ou muito antigos", () => {
    expect(parseDraft("{nao json")).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2 }))).toBeNull();
    const old = JSON.stringify({ v: 1, savedAt: 0, fields: fields({ title: "x" }), photos: [] });
    expect(parseDraft(old, 31 * 24 * 3600_000)).toBeNull();
    expect(parseDraft(old, 1000)?.fields.title).toBe("x");
    expect(parseDraft(JSON.stringify({ v: 1, savedAt: 0, fields: fields({ title: "x" }), photos: [{ key: 1 }, { key: "a", uri: "u" }] }), 1)?.photos).toEqual([{ key: "a", uri: "u" }]);
  });
  it("texto da idade", () => {
    expect(draftAgeText(0, 20_000)).toBe("guardado agora mesmo");
    expect(draftAgeText(0, 5 * 60_000)).toBe("guardado há 5 min");
    expect(draftAgeText(0, 3 * 3600_000)).toBe("guardado há 3 h");
    expect(draftAgeText(0, 50 * 3600_000)).toBe("guardado há 2 dia(s)");
  });
});
