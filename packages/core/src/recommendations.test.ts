import { describe, expect, it } from "vitest";
import { recommendedListings, trackListingView, trackSearch, clearMyInterests } from "./recommendations";

function fake(fail = false) {
  const calls: any[] = [];
  const client: any = {
    rpc: (f: string, a: any) => { calls.push([f, a]); return fail ? Promise.reject(new Error("offline")) : Promise.resolve({ data: [{ id: "l1" }], error: null }); },
    from: (t: string) => ({ delete: () => ({ eq: (k: string, v: string) => { calls.push(["delete", t, k, v]); return Promise.resolve({ error: null }); } }) })
  };
  return { client, calls };
}

describe("recomendações", () => {
  it("pede os recomendados com limite", async () => {
    const { client, calls } = fake();
    expect((await recommendedListings(client, 6)).data).toEqual([{ id: "l1" }]);
    expect(calls[0]).toEqual(["recommended_listings", { p_limit: 6 }]);
  });
  it("regista vistas e pesquisas sem nunca falhar", async () => {
    const { client, calls } = fake(true);
    await expect(trackListingView(client, "l1")).resolves.toBeUndefined();
    await expect(trackSearch(client, { query: "  portátil ", listingType: "classified" })).resolves.toBeUndefined();
    expect(calls).toEqual([["track_listing_view", { p_listing_id: "l1" }], ["track_search", { p_query: "portátil", p_category_id: null, p_listing_type: "classified" }]]);
  });
  it("não regista pesquisas vazias nem vistas sem anúncio", async () => {
    const { client, calls } = fake();
    await trackSearch(client, { query: "  " }); await trackListingView(client, null);
    expect(calls).toHaveLength(0);
  });
  it("apaga só o histórico do próprio", async () => {
    const { client, calls } = fake();
    await clearMyInterests(client, "u1");
    expect(calls[0]).toEqual(["delete", "user_interests", "user_id", "u1"]);
  });
});
