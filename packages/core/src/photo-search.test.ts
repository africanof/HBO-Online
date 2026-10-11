import { describe, expect, it } from "vitest";
import { analyzePhoto, photoSearchMessage, fitWithin, searchByKeywords, PHOTO_SEARCH_DAILY_LIMIT } from "./photo-search";

function client(opts: { session?: boolean; invoke?: any; rpc?: (fn: string, a: any) => any } = {}) {
  const calls: any[] = [];
  return { calls, c: {
    auth: { getSession: async () => ({ data: { session: opts.session === false ? null : { access_token: "t" } } }) },
    functions: { invoke: async (name: string, o: any) => { calls.push({ name, o }); return opts.invoke ?? { data: { found: true, label: "Telemóvel", keywords: ["telemóvel"], listing_type: "product", remaining: 19 }, error: null }; } },
    rpc: (fn: string, a: any) => { calls.push({ fn, a }); return Promise.resolve(opts.rpc ? opts.rpc(fn, a) : { data: [{ id: a.p_query + "-L" }, { id: "comum" }], error: null }); }
  } as any };
}

describe("pesquisa por fotografia", () => {
  it("só com sessão iniciada", async () => {
    const { c, calls } = client({ session: false });
    expect((await analyzePhoto(c, "abc")).error).toBe("AUTH_REQUIRED");
    expect(calls).toHaveLength(0);
  });
  it("envia a fotografia sem o prefixo data: e devolve as palavras", async () => {
    const { c, calls } = client();
    const r = await analyzePhoto(c, "data:image/jpeg;base64,QUJD");
    expect(calls[0]).toEqual({ name: "photo-search", o: { body: { image: "QUJD", mediaType: "image/jpeg" } } });
    expect(r.data?.keywords).toEqual(["telemóvel"]);
  });
  it("traduz o erro do servidor (limite diário)", async () => {
    const ctx = { json: async () => ({ error: "PHOTO_SEARCH_LIMIT" }) };
    const { c } = client({ invoke: { data: null, error: Object.assign(new Error("429"), { context: ctx }) } });
    const r = await analyzePhoto(c, "QUJD");
    expect(r.error).toBe("PHOTO_SEARCH_LIMIT");
    expect(photoSearchMessage(r.error!)).toMatch(String(PHOTO_SEARCH_DAILY_LIMIT));
    expect(photoSearchMessage("PHOTO_SEARCH_NOT_CONFIGURED")).toMatch(/ainda não está ativa/);
    expect(photoSearchMessage("qualquer")).toMatch(/Tente de novo/);
  });
  it("reduz a fotografia mantendo a proporção", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(600, 800)).toEqual({ width: 600, height: 800 });
  });
  it("procura com até 3 palavras e junta resultados sem repetir", async () => {
    const { c, calls } = client();
    const r = await searchByKeywords(c, ["telemóvel", "Samsung", "telemóvel", "A54", "smartphone"]);
    const queries = calls.filter(x => x.fn === "search_classified_listings_v2").map(x => x.a.p_query);
    expect(queries).toEqual(["telemóvel", "Samsung", "A54"]);
    expect(r.listings.map(x => x.id).sort()).toEqual(["A54-L", "Samsung-L", "comum", "telemóvel-L"].sort());
  });
});
