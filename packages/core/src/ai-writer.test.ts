import { describe, expect, it, vi } from "vitest";
import { aiWriterMessage, canImproveText, improveListingText } from "./ai-writer";

function fake(session: boolean, invoke: any) {
  return { auth: { getSession: async () => ({ data: { session: session ? {} : null } }) }, functions: { invoke } } as any;
}

describe("ai-writer", () => {
  it("pede texto mínimo", async () => {
    expect(canImproveText("ab", "curto")).toBe(false);
    expect(canImproveText("Toyota", "")).toBe(true);
    expect((await improveListingText(fake(true, vi.fn()), { title: "", description: "" })).error).toBe("AI_NEEDS_TEXT");
  });
  it("exige sessão", async () => {
    const invoke = vi.fn();
    expect((await improveListingText(fake(false, invoke), { title: "Toyota Hilux", description: "" })).error).toBe("AUTH_REQUIRED");
    expect(invoke).not.toHaveBeenCalled();
  });
  it("envia os dados e devolve o texto", async () => {
    const invoke = vi.fn(async () => ({ data: { optimized_title: "Toyota Hilux 2015", optimized_description: "Boa.", remaining: 14 }, error: null }));
    const r = await improveListingText(fake(true, invoke), { title: "hilux", description: "carro bom", category: "Viaturas", details: { brand: "Toyota", year: 2015, model: "" } });
    expect(r.data?.optimized_title).toBe("Toyota Hilux 2015");
    expect(invoke).toHaveBeenCalledWith("generate-ad", { body: expect.objectContaining({ title: "hilux", category: "Viaturas", details: { brand: "Toyota", year: "2015" } }) });
  });
  it("traduz o erro do servidor", async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { context: { json: async () => ({ error: "AI_WRITER_LIMIT" }) } } }));
    expect((await improveListingText(fake(true, invoke), { title: "Casa T3", description: "" })).error).toBe("AI_WRITER_LIMIT");
    expect(aiWriterMessage("AI_WRITER_LIMIT")).toMatch(/15/);
    expect(aiWriterMessage("xyz")).toMatch(/Tente de novo/);
  });
});
