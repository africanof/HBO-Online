import { describe, expect, it } from "vitest";
import { validateMarketInput, shortMarketName, marketSummary, listMarkets, suggestMarket, saveMarket, setMarketStatus, listMarketContents, MARKET_STATUS_LABELS } from "./markets";
import { friendlyError } from "./classified-listings";

function fakeClient() {
  const calls: { fn: string; args: any }[] = [];
  const q: any = {};
  for (const m of ["select", "eq", "order", "limit", "insert", "update"]) q[m] = (...a: any[]) => { calls.push({ fn: m, args: a }); return q; };
  q.single = () => Promise.resolve({ data: {}, error: null });
  q.then = (res: any) => Promise.resolve({ data: [{ id: "x" }], error: null }).then(res);
  const client: any = { rpc: (fn: string, args: any) => { calls.push({ fn: "rpc:" + fn, args }); return Promise.resolve({ data: [], error: null }); }, from: (t: string) => { calls.push({ fn: "from", args: [t] }); return q; } };
  return { client, calls };
}

describe("praças", () => {
  it("valida os dados da praça", () => {
    expect(validateMarketInput({ name: " " })).toMatch(/nome/);
    expect(validateMarketInput({ name: "Praça do Kapango", photoUrl: "http://x" })).toMatch(/https/);
    expect(validateMarketInput({ name: "Praça do Kapango", openingHours: "06:00–18:00" })).toBeNull();
    expect(MARKET_STATUS_LABELS.pending).toMatch(/aprovação/);
  });
  it("encurta o nome e resume o conteúdo", () => {
    expect(shortMarketName("Praça do Kapango")).toBe("Kapango");
    expect(shortMarketName("Praça das Cassilhas")).toBe("Cassilhas");
    expect(shortMarketName("Praça da Alemanha")).toBe("Alemanha");
    expect(shortMarketName("Mercado Municipal")).toBe("Mercado Municipal");
    expect(marketSummary({ listings: 1, products: 5, businesses: 0 })).toBe("1 anúncio · 5 produtos");
    expect(marketSummary({})).toMatch(/Ainda sem/);
  });
  it("usa as funções certas", async () => {
    const { client, calls } = fakeClient();
    await listMarkets(client, { query: " ferro " });
    expect(calls[0]).toEqual({ fn: "rpc:market_directory", args: { p_query: "ferro", p_municipality_id: null } });
    expect((await suggestMarket(client, { name: "" })).error).toBeTruthy();
    await suggestMarket(client, { name: " Praça Nova ", addressText: " " });
    expect(calls.at(-1)).toEqual({ fn: "rpc:suggest_market", args: { p_name: "Praça Nova", p_municipality_id: null, p_address: null, p_description: null } });
    await saveMarket(client, { name: "Praça do Ferro", openingHours: "06h-18h" }, "m1");
    expect(calls.find(c => c.fn === "update")?.args[0]).toMatchObject({ name: "Praça do Ferro", opening_hours: "06h-18h", status: "active" });
    await setMarketStatus(client, "m1", "hidden");
    expect(calls.filter(c => c.fn === "update").at(-1)?.args[0]).toMatchObject({ status: "hidden" });
    const r = await listMarketContents(client, "m1");
    expect(r.listings).toHaveLength(1);
    expect(calls.filter(c => c.fn === "from").map(c => c.args[0])).toEqual(expect.arrayContaining(["classified_listings", "products", "businesses"]));
  });
  it("traduz os erros", () => {
    expect(friendlyError({ message: "MARKET_EXISTS" })).toMatch(/já existe/);
  });
});
