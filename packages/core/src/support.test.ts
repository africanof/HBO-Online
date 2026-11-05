import { describe, expect, it } from "vitest";
import { supportSummary, isSupportConversation } from "./messaging";

describe("suporte", () => {
  it("resume a conversa com o assistente", () => {
    expect(supportSummary([{ role: "user", content: " O pagamento\n não aparece " }, { role: "assistant", content: "Fale com a equipa." }]))
      .toBe("🙂 O pagamento não aparece\n🤖 Fale com a equipa.");
    expect(supportSummary([])).toBe("");
  });
  it("guarda só as últimas trocas quando é longo", () => {
    const long = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: i + " " + "x".repeat(300) }));
    const s = supportSummary(long);
    expect(s.length).toBeLessThanOrEqual(3000);
    expect(s.endsWith("x")).toBe(true);
    expect(s).toContain("🙂 19 ");
  });
  it("reconhece conversas de suporte", () => {
    expect(isSupportConversation({ context_type: "support" })).toBe(true);
    expect(isSupportConversation({ context_type: "general" })).toBe(false);
  });
});
