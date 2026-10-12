import { describe, expect, it, vi } from "vitest";
import { validatePortfolioItem, toIsoMonth, portfolioDate, portfolioDateLabel, savePortfolioItem, listPortfolio, movePortfolio, listBusinessProducts, PORTFOLIO_MAX_PHOTOS } from "./portfolio";
import { friendlyError } from "./classified-listings";

const today = new Date("2026-10-12T12:00:00Z");
describe("portfólio", () => {
  it("valida o trabalho", () => {
    const ok = { title: "Casa de banho remodelada", photos: ["u1"] };
    expect(validatePortfolioItem(ok, today)).toBeNull();
    expect(validatePortfolioItem({ ...ok, title: " a " }, today)).toMatch(/título/);
    expect(validatePortfolioItem({ ...ok, photos: [] }, today)).toMatch(/pelo menos uma fotografia/);
    expect(validatePortfolioItem({ ...ok, photos: Array(PORTFOLIO_MAX_PHOTOS + 1).fill("x") }, today)).toMatch(/máximo 8/);
    expect(validatePortfolioItem({ ...ok, doneOn: "2026-11" }, today)).toMatch(/futuro/);
    expect(validatePortfolioItem({ ...ok, doneOn: "2026-09" }, today)).toBeNull();
    expect(validatePortfolioItem({ ...ok, doneOn: "ontem" }, today)).toMatch(/Data inválida/);
  });
  it("datas por mês", () => {
    expect(portfolioDate("2026-09")).toBe("2026-09-01");
    expect(portfolioDate("2026-09-15")).toBe("2026-09-15");
    expect(portfolioDateLabel("2026-09-01")).toBe("set. 2026");
    expect(portfolioDateLabel(null)).toBe("");
    expect(toIsoMonth("9/2026")).toBe("2026-09"); expect(toIsoMonth(" 12-2025 ")).toBe("2025-12");
    expect(toIsoMonth("13/2026")).toBeNull(); expect(toIsoMonth("setembro")).toBeNull();
  });
  it("grava no perfil certo", async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null });
    const insert = vi.fn(() => ({ select: () => ({ single }) }));
    const client = { from: vi.fn(() => ({ insert })) } as any;
    await savePortfolioItem(client, "u1", { businessId: "b1" }, { title: " Pintura ", photos: ["p"], doneOn: "2026-08" });
    expect(insert).toHaveBeenCalledWith({ title: "Pintura", description: null, photos: ["p"], done_on: "2026-08-01", owner_id: "u1", business_id: "b1" });
    expect((await savePortfolioItem(client, "u1", { providerId: "u1" }, { title: "x", photos: [] })).error?.message).toMatch(/título/);
  });
  it("lista e ordena", async () => {
    const order = vi.fn(); const q: any = { select: () => q, eq: vi.fn(() => q), order: order.mockImplementation(() => q), then: (f: any) => f({ data: [{ id: "1" }], error: null }) };
    const r = await listPortfolio({ from: () => q } as any, { providerId: "u1" });
    expect(q.eq).toHaveBeenCalledWith("provider_id", "u1"); expect(r.data).toHaveLength(1);
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(movePortfolio(items, "b", -1).map(x => x.id)).toEqual(["b", "a", "c"]);
    expect(movePortfolio(items, "c", 1)).toBe(items);
  });
  it("produtos da empresa e erros", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "p1", business_id: "b1" }, { id: "p2", business_id: null }], error: null });
    expect((await listBusinessProducts({ rpc } as any, "u1", "b1")).data.map((p: any) => p.id)).toEqual(["p1"]);
    expect(friendlyError(new Error("PORTFOLIO_FULL"))).toMatch(/40 trabalhos/);
  });
});
