import { describe, expect, it, vi } from "vitest";
import { planSummary, planDaysLeft, needsPayment, planTotal, validatePlanPayment, proofPath, submitPlanPayment, decidePlanPayment, listMyPlans, PLAN_STATE_LABELS } from "./plans";
import { getNotificationLink } from "./notifications";
import { friendlyError } from "./classified-listings";
import { ADMIN_STAT_LABELS } from "./admin";

const now = Date.parse("2026-10-12T12:00:00Z");
describe("mensalidades", () => {
  it("resumo para o dono", () => {
    expect(planSummary({ state: "trial", active_until: "2026-11-11T12:00:00Z", monthly_price: 2000 }, now)).toBe("Grátis até 11/11/2026 (faltam 30 dias). Depois: 2 000 Kz por mês.");
    expect(planSummary({ state: "paid", active_until: "2026-10-13T12:00:00Z", monthly_price: "5000" }, now)).toMatch(/^Pago até 13\/10\/2026 \(falta 1 dia\)/);
    expect(planSummary({ state: "expired", active_until: "2026-10-01T12:00:00Z", monthly_price: 2000 }, now)).toMatch(/voltar a aparecer/);
    expect(planDaysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
    expect(Object.keys(PLAN_STATE_LABELS)).toHaveLength(5);
  });
  it("quando mostrar «Pagar»", () => {
    expect(needsPayment({ state: "expired", pending_payment_id: null })).toBe(true);
    expect(needsPayment({ state: "expired", pending_payment_id: "p1" })).toBe(false);
    expect(needsPayment({ state: "trial", pending_payment_id: null })).toBe(false);
    expect(needsPayment({ state: "trial_ending", pending_payment_id: null })).toBe(true);
    expect(planTotal("2000", 3)).toBe(6000); expect(planTotal(5000, 12)).toBe(60000);
  });
  it("valida o pagamento", () => {
    expect(validatePlanPayment({ months: 0, method: "bank_transfer", reference: "x" })).toMatch(/1 a 12/);
    expect(validatePlanPayment({ months: 1, method: "bank_transfer" })).toMatch(/referência/);
    expect(validatePlanPayment({ months: 1, method: "bank_transfer", proofPath: "u/x.jpg" })).toBeNull();
    expect(validatePlanPayment({ months: 3, method: "multicaixa_express", reference: "MCX 1" })).toBeNull();
    expect(proofPath("u1", "Talão (1).PDF", 9)).toBe("u1/9-Talao-1-.PDF");
  });
  it("chama as funções certas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null }); const c = { rpc } as any;
    await submitPlanPayment(c, "s1", { months: 3, method: "multicaixa_express", reference: " MCX 1 " });
    expect(rpc).toHaveBeenLastCalledWith("submit_subscription_payment", { p_subscription_id: "s1", p_months: 3, p_method: "multicaixa_express", p_reference: "MCX 1", p_proof_path: null });
    expect((await submitPlanPayment(c, "s1", { months: 1, method: "cash" })).error?.message).toMatch(/referência/);
    await decidePlanPayment(c, "p1", false, " Valor errado ");
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_subscription_payment", { p_payment_id: "p1", p_confirm: false, p_note: "Valor errado" });
    expect((await listMyPlans(c)).data).toEqual([]);
  });
  it("notificações, erros e painel", () => {
    expect(getNotificationLink({ type: "system", title: "O seu plano termina em 7 dias", data: { for: "plan" } })?.href).toBe("/conta/plano");
    expect(getNotificationLink({ type: "system", title: "Pagamento", data: { for: "admin", payment_id: "0f8fad5b-d9cb-469f-a165-70867728950e" } })?.href).toBe("/admin");
    expect(friendlyError(new Error("PAYMENT_PENDING"))).toMatch(/à espera/);
    expect(friendlyError(new Error("PROFILE_UNAVAILABLE"))).toMatch(/não está disponível/);
    expect(ADMIN_STAT_LABELS.map(([k]) => k)).toContain("plan_revenue_30d");
  });
});
