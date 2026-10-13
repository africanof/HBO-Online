import { describe, expect, it, vi } from "vitest";
import { agentCommissionLine, normalizeAgentCode, isAgentCodeShape, validateAgentApplication, agentOfferText, agentInviteMessage, agentTotals, sumCommissions,
  applyAsAgent, checkAgentCode, setListingAgent, decideAgent, decideAgentCommissions, listAgentsForAdmin, getMyAgentPanel } from "./agents";
import { friendlyError } from "./classified-listings";
import { WALLET_KIND_LABELS } from "./protected-payments";
import { HELP_FAQ } from "./legal";
import { getNotificationLink } from "./notifications";

const rpcClient = (data: unknown = null, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) }) as any;

describe("agentes no terreno", () => {
  it("códigos", () => {
    expect(normalizeAgentCode(" ag-1001 ")).toBe("AG1001");
    expect(normalizeAgentCode(null)).toBe("");
    expect(isAgentCodeShape("ag 1001")).toBe(true);
    expect(isAgentCodeShape("AG12")).toBe(false);
    expect(isAgentCodeShape("XX1001")).toBe(false);
  });
  it("valida o pedido", () => {
    expect(validateAgentApplication({ marketId: "", fullName: "Maria João", phone: "923000000" })).toBe("Escolha a praça onde trabalha.");
    expect(validateAgentApplication({ marketId: "m", fullName: "Ma", phone: "923000000" })).toBe("Escreva o nome completo.");
    expect(validateAgentApplication({ marketId: "m", fullName: "Maria", phone: "923 00" })).toBe("Escreva um telefone com 9 algarismos.");
    expect(validateAgentApplication({ marketId: "m", fullName: "Maria", phone: "+244 923 000 000" })).toBeNull();
  });
  it("textos", () => {
    expect(agentOfferText(2)).toBe("Ganhe 2% do valor de cada venda dos anúncios que ajudou a pôr.");
    expect(agentOfferText("1.5")).toBe("Ganhe 1,5% do valor de cada venda dos anúncios que ajudou a pôr.");
    expect(agentCommissionLine({ amount: 5000, sale_amount: 250000, rate_pct: 2 })).toBe("Vendido por 250 000 Kz · 2% = 5 000 Kz");
    expect(agentCommissionLine({ amount: 100 })).toBe("100 Kz");
    expect(agentOfferText(0)).toBe("Ajude os vendedores da sua praça a pôr anúncios no Huambo Online.");
    expect(agentInviteMessage("AG1001", "Maria", "https://huambo.ao/")).toBe("Olá! Sou Maria, agente do Huambo Online. Ajudo a pôr o seu anúncio na internet, de graça para si.\nAo publicar, escreva o meu código: AG1001\n👉 https://huambo.ao/classificados/publicar?agente=AG1001");
    expect(WALLET_KIND_LABELS.agent).toBe("Comissão de agente");
    expect(HELP_FAQ.some(f => f.q === "O que é um agente no terreno?")).toBe(true);
  });
  it("totais", () => {
    expect(agentTotals(null)).toEqual({ pending: 0, approved: 0, listings: 0, sold: 0, rejected: 0, count: 0 });
    const p = { agent: null, sale_pct: 2, pending_kz: 200, approved_kz: 500, listings: 8, sold: 3,
      commissions: [{ status: "rejected" }, { status: "pending" }] as any };
    expect(agentTotals(p)).toEqual({ pending: 200, approved: 500, listings: 8, sold: 3, rejected: 1, count: 2 });
    expect(sumCommissions([{ id: "a", amount: 100 }, { id: "b", amount: 150 }, { id: "c", amount: 1 }], ["a", "b"])).toBe(250);
  });
  it("erros em português", () => {
    expect(friendlyError({ message: "AGENT_NOT_FOUND" })).toContain("Código de agente não encontrado");
    expect(friendlyError({ message: "CANNOT_BE_OWN_AGENT" })).toBe("Não pode usar o seu próprio código de agente nos seus anúncios.");
    expect(friendlyError({ message: "AGENT_LOCKED" })).toContain("já não pode ser mudado");
    expect(friendlyError({ message: "MARKET_REQUIRED" })).toBe("Escolha a praça onde trabalha.");
    expect(friendlyError({ message: "NAME_REQUIRED" })).toBe("Escreva o nome completo.");
  });
  it("aviso leva ao painel de agente", () => {
    expect(getNotificationLink({ data: { for: "agent" }, type: "system", title: "x" } as any)?.href).toBe("/agente");
  });
  it("chamadas ao servidor", async () => {
    const c = rpcClient({ code: "AG1001" });
    await applyAsAgent(c, { marketId: "m", fullName: " Maria ", phone: "923000000", note: " " });
    expect(c.rpc).toHaveBeenCalledWith("apply_field_agent", { p_market_id: "m", p_full_name: "Maria", p_phone: "923000000", p_note: null });
    const bad = rpcClient(); const r = await applyAsAgent(bad, { marketId: "", fullName: "Maria", phone: "923000000" });
    expect(r.error?.message).toBe("Escolha a praça onde trabalha."); expect(bad.rpc).not.toHaveBeenCalled();

    const k = rpcClient([{ code: "AG1001", first_name: "Maria", market_name: "Kapango" }]);
    expect(await checkAgentCode(k, "ag-1001")).toEqual({ code: "AG1001", first_name: "Maria", market_name: "Kapango" });
    expect(k.rpc).toHaveBeenCalledWith("check_agent_code", { p_code: "AG1001" });
    const k2 = rpcClient([]); expect(await checkAgentCode(k2, "AG1")).toBeNull(); expect(k2.rpc).not.toHaveBeenCalled();

    const s = rpcClient(); await setListingAgent(s, "L", " ag1001");
    expect(s.rpc).toHaveBeenCalledWith("set_listing_agent", { p_listing_id: "L", p_code: "AG1001" });

    const d = rpcClient(); expect((await decideAgent(d, "u", "rejected", " ")).error?.message).toBe("Escreva o motivo.");
    await decideAgent(d, "u", "active"); expect(d.rpc).toHaveBeenCalledWith("admin_decide_agent", { p_user_id: "u", p_status: "active", p_note: null });
    const e = rpcClient(2);
    expect((await decideAgentCommissions(e, [], true)).error?.message).toBe("Escolha pelo menos uma comissão.");
    expect((await decideAgentCommissions(e, ["a"], false)).error?.message).toBe("Escreva o motivo.");
    await decideAgentCommissions(e, ["a", "b"], true);
    expect(e.rpc).toHaveBeenCalledWith("admin_decide_agent_commissions", { p_ids: ["a", "b"], p_approve: true, p_note: null });
    const l = rpcClient(null); expect((await listAgentsForAdmin(l, "")).data).toEqual([]);
    expect(l.rpc).toHaveBeenCalledWith("admin_list_agents_v2", { p_status: null });
    expect((await getMyAgentPanel(rpcClient({ agent: null, sale_pct: 2 }))).data?.sale_pct).toBe(2);
  });
});
