import { describe, expect, it, vi } from "vitest";
import { commissionFor, commissionTotals, submitCommissionPayment, updateCommissionAsAdmin, closeListing, listMyCommissions, COMMISSION_STATUS_LABELS } from "./commissions";
import { setListingDeal } from "./deal-reviews";
import { PLAN_KIND_LABELS } from "./plans";
import { getNotificationLink } from "./notifications";
import { friendlyError } from "./classified-listings";

describe("comissão dos anúncios", () => {
  it("5% do valor da venda, arredondado", () => {
    expect(commissionFor(90000)).toBe(4500);
    expect(commissionFor("80000", 5)).toBe(4000);
    expect(commissionFor(12345, 5)).toBe(617);
    expect(commissionFor(null)).toBe(0); expect(commissionFor(1000, 0)).toBe(0);
  });
  it("totais", () => {
    const t = commissionTotals([{ status: "due", amount: 4500, overdue: true }, { status: "due", amount: "500", overdue: false }, { status: "submitted", amount: 100, overdue: false }, { status: "paid", amount: 9, overdue: false }]);
    expect(t).toEqual({ dueCount: 2, dueTotal: 5000, overdueCount: 1, waitingCount: 1 });
    expect(Object.keys(COMMISSION_STATUS_LABELS)).toHaveLength(5);
  });
  it("chama as funções certas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null }); const c = { rpc } as any;
    expect((await submitCommissionPayment(c, [], { method: "bank_transfer", reference: "x" })).error?.message).toMatch(/Escolha/);
    expect((await submitCommissionPayment(c, ["a"], { method: "bank_transfer" })).error?.message).toMatch(/referência/);
    await submitCommissionPayment(c, ["a", "b"], { method: "multicaixa_express", reference: " MCX " });
    expect(rpc).toHaveBeenLastCalledWith("submit_commission_payment", { p_ids: ["a", "b"], p_method: "multicaixa_express", p_reference: "MCX", p_proof_path: null });
    await updateCommissionAsAdmin(c, "id1", "adjust", " baixo ", 100000);
    expect(rpc).toHaveBeenLastCalledWith("admin_update_commission", { p_id: "id1", p_action: "adjust", p_note: "baixo", p_sale_amount: 100000 });
    await setListingDeal(c, "l1", "sold", "u2", 90000);
    expect(rpc).toHaveBeenLastCalledWith("set_listing_deal_v2", { p_listing_id: "l1", p_status: "sold", p_counterpart: "u2", p_sale_amount: 90000 });
    await setListingDeal(c, "l1", "rented", "u2", 90000);
    expect(rpc).toHaveBeenLastCalledWith("set_listing_deal_v2", { p_listing_id: "l1", p_status: "rented", p_counterpart: "u2", p_sale_amount: null });
    rpc.mockResolvedValue({ data: null, error: null }); expect((await listMyCommissions(c)).data).toEqual([]);
  });
  it("fechar com o valor da venda", async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null }); const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }));
    await closeListing({ from: () => ({ update }) } as any, "l1", "sold", 50000);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "sold", sale_amount: 50000 }));
    await closeListing({ from: () => ({ update }) } as any, "l1", "closed", 50000);
    expect(update).toHaveBeenLastCalledWith(expect.not.objectContaining({ sale_amount: 50000 }));
  });
  it("Loja, notificações e erros", () => {
    expect(PLAN_KIND_LABELS.store).toBe("Loja");
    expect(getNotificationLink({ type: "system", title: "Venda registada", data: { for: "commission", listing_id: "x" } })?.href).toBe("/conta/comissoes");
    expect(friendlyError(new Error("COMMISSION_OVERDUE"))).toMatch(/Comissões/);
    expect(friendlyError(new Error("STORE_UNAVAILABLE"))).toMatch(/Loja/);
  });
});
