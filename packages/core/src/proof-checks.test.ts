import { describe, expect, it, vi } from "vitest";
import { decideProofPayment, listProofChecks, proofMark, PROOF_VERDICT_ICON } from "./proof-checks";

describe("comprovativos", () => {
  it("decide com a função certa de cada tipo", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null })); const c = { rpc } as any;
    await decideProofPayment(c, "subscription", "p1", true);
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_subscription_payment", { p_payment_id: "p1", p_confirm: true, p_note: null });
    await decideProofPayment(c, "boost", "b1", false, " Talão repetido ");
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_boost", { p_boost_id: "b1", p_confirm: false, p_note: "Talão repetido" });
    await decideProofPayment(c, "commission", "c1", false, "Valor errado");
    expect(rpc).toHaveBeenLastCalledWith("admin_update_commission", { p_id: "c1", p_action: "reject", p_note: "Valor errado", p_sale_amount: null });
    await decideProofPayment(c, "order", "o1", true);
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_order_payment", { p_payment_id: "o1", p_confirm: true, p_note: null });
  });
  it("lista com números", async () => {
    const r = await listProofChecks({ rpc: async () => ({ data: [{ kind: "boost", amount: "500", read_amount: "500" }], error: null }) } as any);
    expect(r.data[0].amount).toBe(500); expect(r.data[0].read_amount).toBe(500);
  });
  it("marcas", () => { expect(proofMark(true)).toBe("✔"); expect(proofMark(false)).toBe("✖"); expect(proofMark(null)).toBe("?"); expect(PROOF_VERDICT_ICON.suspicious).toBe("🚩"); });
});
describe("aprovação automática", () => {
  it("valor máximo", async () => {
    const { getProofAutoMax, setProofAutoMax } = await import("./proof-checks");
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { proof_auto_max_kz: "1000" } }) };
    expect(await getProofAutoMax({ from: () => q } as any)).toBe(1000);
    expect((await setProofAutoMax({} as any, -1)).error).toBeTruthy();
    expect((await setProofAutoMax({} as any, 60000)).error).toBeTruthy();
    const upd = vi.fn(() => ({ eq: async () => ({ error: null }) }));
    await setProofAutoMax({ from: () => ({ update: upd }) } as any, 1500.4);
    expect((upd.mock.calls[0] as any)[0].proof_auto_max_kz).toBe(1500);
  });
});
