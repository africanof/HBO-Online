import { describe, expect, it } from "vitest";
import { isJobCategorySlug, listJobCategories, listJobListings, salaryLabel, jobCategoryOf } from "./jobs";

const cats = [
  { id: "c3", name: "Estágios não remunerados", slug: "estagios-nao-remunerados" as const },
  { id: "c1", name: "Emprego e recrutamento", slug: "emprego" as const },
  { id: "c2", name: "Estágios remunerados", slug: "estagios-remunerados" as const }
];
function fake(data: any) {
  const calls: any[] = [];
  const q: any = new Proxy({}, { get: (_t, k) => k === "then" ? (f: any) => f({ data, error: null }) : k === "maybeSingle" ? () => Promise.resolve({ data, error: null }) : (...a: any[]) => { calls.push([k, ...a]); return q; } });
  return { calls, client: { from: (t: string) => { calls.push(["from", t]); return q; } } as any };
}

describe("emprego e estágios", () => {
  it("reconhece as categorias de emprego", () => {
    expect(isJobCategorySlug("emprego")).toBe(true);
    expect(isJobCategorySlug("estagios-nao-remunerados")).toBe(true);
    expect(isJobCategorySlug("moda")).toBe(false);
  });
  it("ordena as categorias e filtra as vagas", async () => {
    expect((await listJobCategories(fake(cats).client)).data.map(c => c.slug)).toEqual(["emprego", "estagios-remunerados", "estagios-nao-remunerados"]);
    const f = fake([]);
    await listJobListings(f.client, cats, { slug: "estagios-remunerados", query: "contabilista" });
    expect(f.calls).toEqual(expect.arrayContaining([["eq", "status", "published"], ["in", "category_id", ["c2"]], ["or", "title.ilike.%contabilista%,description.ilike.%contabilista%"]]));
    expect((await listJobListings(fake([]).client, [], {})).data).toEqual([]);
  });
  it("salário", () => {
    expect(salaryLabel(null)).toBe("Salário a combinar");
    expect(salaryLabel(150000)).toMatch(/150/);
    expect(salaryLabel(50000, "estagios-nao-remunerados")).toBe("Não remunerado");
  });
  it("categoria de emprego de um anúncio", async () => {
    expect(await jobCategoryOf(fake({ id: "c1", name: "x", slug: "emprego" }).client, "c1")).toMatchObject({ slug: "emprego" });
    expect(await jobCategoryOf(fake({ id: "c9", name: "x", slug: "moda" }).client, "c9")).toBeNull();
    expect(await jobCategoryOf(fake(null).client, null)).toBeNull();
  });
});
