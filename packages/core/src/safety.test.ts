import { describe, expect, it, vi } from "vitest";
import { scamWarnings, conversationWarnings, validateSafeSpots, getSafeSpots, saveSafeSpots, toggleBlock, listMyBlocks, friendlyError, DEFAULT_SAFE_SPOTS, SCAM_WARNING_TEXT, HELP_FAQ } from "./index";

describe("avisos de burla", () => {
  it("apanha os truques mais comuns", () => {
    expect(scamWarnings("Manda primeiro o dinheiro e depois envio")).toContain("advance_payment");
    expect(scamWarnings("tem de pagar adiantado")).toContain("advance_payment");
    expect(scamWarnings("Antes de entregar, transfere 50% por Express")).toContain("advance_payment");
    expect(scamWarnings("Só precisa de pagar a taxa de envio de 5000 kz")).toContain("deposit_first");
    expect(scamWarnings("Vai receber um código por SMS, manda-me o código")).toContain("codes");
    expect(scamWarnings("Diz-me o PIN do Multicaixa")).toContain("codes");
    expect(scamWarnings("Estou fora do país, a transportadora entrega em casa")).toContain("abroad");
    expect(scamWarnings("É urgente, tem outro comprador, paga já")).toContain("pressure");
  });
  it("não incomoda em mensagens normais", () => {
    expect(scamWarnings("Olá, ainda está disponível? Posso ver amanhã?")).toEqual([]);
    expect(scamWarnings("Pago na entrega, combinado")).toEqual([]);
    expect(scamWarnings("")).toEqual([]);
    expect(scamWarnings("O código do anúncio é A-1023")).toEqual([]);
  });
  it("só avisa sobre as mensagens da outra pessoa", () => {
    const msgs = [{ sender_id: "eu", body: "manda primeiro o dinheiro" }, { sender_id: "ele", body: "Diga-me o código que recebeu por SMS" }, { sender_id: "ele", body: "manda o código" }];
    expect(conversationWarnings(msgs, "eu")).toEqual(["codes"]);
    expect(Object.keys(SCAM_WARNING_TEXT)).toHaveLength(5);
  });
});

describe("pontos de encontro e bloquear", () => {
  it("valida a lista", () => {
    expect(validateSafeSpots(DEFAULT_SAFE_SPOTS)).toBeNull();
    expect(validateSafeSpots([{ name: "x" }])).toMatch(/nome/);
    expect(validateSafeSpots(Array.from({ length: 21 }, () => ({ name: "Lugar" })))).toMatch(/20/);
  });
  it("lê e guarda", async () => {
    const chain: any = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { safe_spots: [] }, error: null }), update: vi.fn(() => chain) };
    expect(await getSafeSpots({ from: () => chain } as any)).toEqual(DEFAULT_SAFE_SPOTS);
    chain.maybeSingle = async () => ({ data: { safe_spots: [{ name: "Largo do Mercado", note: "Polícia perto" }] }, error: null });
    expect((await getSafeSpots({ from: () => chain } as any))[0].name).toBe("Largo do Mercado");
    expect((await saveSafeSpots({ from: () => chain } as any, [{ name: "a" }])).error).toBeTruthy();
    await saveSafeSpots({ from: () => chain } as any, [{ name: " Largo  ", note: " " }]);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ safe_spots: [{ name: "Largo", note: null }] }));
  });
  it("bloquear", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "toggle_block" ? true : [], error: null }));
    expect((await toggleBlock({ rpc } as any, "u2")).data).toBe(true);
    expect(rpc).toHaveBeenCalledWith("toggle_block", { p_user_id: "u2" });
    await listMyBlocks({ rpc } as any);
    expect(rpc).toHaveBeenLastCalledWith("my_blocks");
    expect(friendlyError(new Error("BLOCKED"))).toMatch(/bloqueou/);
    expect(friendlyError(new Error("BIDDER_BLOCKED"))).toMatch(/lances/);
    expect(HELP_FAQ.find(f => /burlas/.test(f.q))?.a).toMatch(/Bloquear/);
  });
});
