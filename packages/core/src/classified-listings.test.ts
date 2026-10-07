import { describe, expect, it, vi } from "vitest";
import { validateClassifiedDraft, parsePrice, formatPrice, friendlyError, listingTerritory, base64ToArrayBuffer,
  storagePathFromPublicUrl, createAndPublishClassifiedListing, CLASSIFIED_MAX_PHOTOS } from "./classified-listings";

const base = { listingType: "classified" as const, purpose: "sale" as const, title: "Casa T3", provinceId: "p1", municipalityId: "m1" };

describe("validateClassifiedDraft", () => {
  it("accepts a complete draft", () => expect(validateClassifiedDraft(base)).toBeNull());
  it("requires title, province and municipality", () => {
    expect(validateClassifiedDraft({ ...base, title: "  " })).toBe("Indique um título.");
    expect(validateClassifiedDraft({ ...base, provinceId: "" })).toBe("Escolha a província.");
    expect(validateClassifiedDraft({ ...base, municipalityId: undefined })).toBe("Escolha o município.");
  });
  it("limits photos to 10 and rejects invalid price", () => {
    expect(validateClassifiedDraft({ ...base, photoCount: CLASSIFIED_MAX_PHOTOS + 1 })).toMatch(/máximo 10/);
    expect(validateClassifiedDraft({ ...base, price: NaN })).toBe("Indique um preço válido.");
    expect(validateClassifiedDraft({ ...base, price: -1 })).toBe("Indique um preço válido.");
  });
});

describe("price helpers", () => {
  it("parses Angolan formats", () => {
    expect(parsePrice("")).toBeUndefined();
    expect(parsePrice("15 000")).toBe(15000);
    expect(parsePrice("1500,5")).toBe(1500.5);
    expect(parsePrice("abc")).toBeNaN();
  });
  it("formats in Kz", () => {
    expect(formatPrice(1500000, "AOA")).toBe("1 500 000 Kz");
    expect(formatPrice(null)).toBe("Preço sob consulta");
  });
});

describe("friendlyError", () => {
  it("translates Supabase errors", () => {
    expect(friendlyError({ message: "new row violates row-level security policy" })).toMatch(/Sem permissão/);
    expect(friendlyError(new Error("LOCATION_REQUIRED"))).toBe("Indique a localização do anúncio.");
    expect(friendlyError(new Error("Failed to fetch"))).toMatch(/internet/);
    expect(friendlyError(new Error("outro"))).toBe("outro");
  });
});

describe("territory and storage", () => {
  it("reads territory from attributes", () => {
    expect(listingTerritory({ attributes: { provinceId: "p", municipalityId: "m" } })).toEqual({ provinceId: "p", municipalityId: "m" });
    expect(listingTerritory(null)).toEqual({ provinceId: undefined, municipalityId: undefined });
  });
  it("extracts storage path from public url", () => {
    expect(storagePathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/classified-media/u1/a.jpg")).toBe("u1/a.jpg");
    expect(storagePathFromPublicUrl("https://outro.com/a.jpg")).toBeNull();
  });
  it("decodes base64 photos", () => {
    const buf = base64ToArrayBuffer(Buffer.from("Huambo!").toString("base64"));
    expect(Buffer.from(new Uint8Array(buf)).toString()).toBe("Huambo!");
    const withPrefix = base64ToArrayBuffer("data:image/jpeg;base64," + Buffer.from("ab").toString("base64"));
    expect(new Uint8Array(withPrefix)).toEqual(new Uint8Array([97, 98]));
  });
});

function fakeClient(insertResult: any, rpcResult: any) {
  const inserted: any[] = [];
  const client: any = {
    from: () => ({ insert: (row: any) => { inserted.push(row); return { select: () => ({ single: async () => insertResult }) }; } }),
    rpc: vi.fn(async () => rpcResult)
  };
  return { client, inserted };
}

describe("createAndPublishClassifiedListing", () => {
  it("inserts with territory in attributes and publishes", async () => {
    const { client, inserted } = fakeClient({ data: { id: "L1" }, error: null }, { data: { id: "L1", status: "published" }, error: null });
    const r = await createAndPublishClassifiedListing(client, { ownerId: "u1", ...base, media: ["a"] });
    expect(inserted[0].attributes).toEqual({ provinceId: "p1", municipalityId: "m1" });
    expect(inserted[0].media).toEqual(["a"]);
    expect(client.rpc).toHaveBeenCalledWith("publish_classified_listing", { p_listing_id: "L1" });
    expect(r).toEqual({ data: { id: "L1", status: "published" }, draftId: null, error: null });
  });
  it("keeps the draft id when publishing fails", async () => {
    const { client } = fakeClient({ data: { id: "L2" }, error: null }, { data: null, error: { message: "LOCATION_REQUIRED" } });
    const r = await createAndPublishClassifiedListing(client, { ownerId: "u1", ...base });
    expect(r.draftId).toBe("L2");
    expect(r.error).toEqual({ message: "LOCATION_REQUIRED" });
  });
  it("does not publish when insert fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "row-level security" } }, null);
    const r = await createAndPublishClassifiedListing(client, { ownerId: "u1", ...base });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(r.data).toBeNull();
  });
});
