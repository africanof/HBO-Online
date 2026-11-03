import { describe, expect, it } from "vitest";
import { HUAMBO_MUNICIPALITIES, LOCAL_TOPICS, allLocalPaths, localMunicipality, localTopic, localPath, localSeo, fetchLocalListings } from "./local-pages";

describe("páginas locais", () => {
  it("tem os 17 municípios e endereços únicos", () => {
    expect(HUAMBO_MUNICIPALITIES).toHaveLength(17);
    const paths = allLocalPaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/huambo/caala/casas-a-venda");
    expect(paths.length).toBe(1 + 17 * (1 + LOCAL_TOPICS.length));
    for (const m of HUAMBO_MUNICIPALITIES) expect(m.slug).toMatch(/^[a-z0-9-]+$/);
  });
  it("encontra município e tema pelo endereço", () => {
    expect(localMunicipality("bailundo")?.name).toBe("Bailundo");
    expect(localMunicipality("x")).toBeNull();
    expect(localTopic("emprego")?.jobs).toBe(true);
    expect(localPath(localMunicipality("caala")!, localTopic("carros-a-venda"))).toBe("/huambo/caala/carros-a-venda");
  });
  it("monta títulos naturais", () => {
    expect(localSeo(localMunicipality("caala")!, localTopic("casas-a-venda")).title).toBe("Casas à venda na Caála");
    expect(localSeo(localMunicipality("huambo")!, localTopic("emprego")).title).toBe("Emprego e vagas no Huambo (cidade)");
    expect(localSeo(localMunicipality("bailundo")!).title).toContain("no Bailundo");
    expect(localSeo(localMunicipality("caala")!, localTopic("classificados")).description.length).toBeLessThanOrEqual(161);
  });
  it("filtra por município, tipo e atributo", async () => {
    const calls: any[] = [];
    const q: any = new Proxy({}, { get: (_, k) => k === "then" ? (r: any) => r({ data: [{ id: "a" }] }) : (...a: any[]) => { calls.push([k, ...a]); return q; } });
    const client: any = { from: () => q };
    const r = await fetchLocalListings(client, localTopic("terrenos-a-venda")!, "m1");
    expect(r).toEqual([{ id: "a" }]);
    expect(calls).toContainEqual(["eq", "attributes->>municipalityId", "m1"]);
    expect(calls).toContainEqual(["eq", "attributes->>propertyType", "terreno"]);
    calls.length = 0;
    await fetchLocalListings(client, localTopic("casas-a-venda")!, null);
    expect(calls).toContainEqual(["or", "attributes->>propertyType.is.null,attributes->>propertyType.neq.terreno"]);
    expect(calls.some(c => c[1] === "attributes->>municipalityId")).toBe(false);
  });
});
