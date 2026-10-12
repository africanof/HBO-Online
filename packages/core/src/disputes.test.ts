import { describe, expect, it, vi } from "vitest";
import { canOpenDispute, validateDispute, disputeActions, disputeNextStep, requestsFor, refundableAmount, disputePhotoPath, latestDisputeByOrder,
  disputeEventLabel, openDispute, disputeAction, decideDispute, listDisputesForAdmin, isActiveDispute, DISPUTE_STATUS_LABELS, DISPUTE_ACTION_LABELS,
  type DisputeStatus } from "./disputes";
import { getNotificationLink } from "./notifications";
import { friendlyError } from "./classified-listings";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-10-20T12:00:00Z");
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

describe("quando se pode pedir devolução ou reembolso", () => {
  it("segue as mesmas regras do servidor", () => {
    expect(canOpenDispute({ status: "pending", payment_status: "paid", total: 100 }, [], now)).toMatchObject({ ok: false, why: expect.stringMatching(/cancelá-la/) });
    expect(canOpenDispute({ status: "cancelled", payment_status: "paid", total: 100 }, [], now).ok).toBe(false);
    expect(canOpenDispute({ status: "confirmed", payment_status: "unpaid", total: 100 }, [], now)).toMatchObject({ ok: false, why: expect.stringMatching(/não pagou/) });
    expect(canOpenDispute({ status: "confirmed", payment_status: "paid", total: 100 }, [], now).ok).toBe(true);
    expect(canOpenDispute({ status: "completed", payment_status: "paid", total: 100, completed_at: iso(3) }, [], now).ok).toBe(true);
    expect(canOpenDispute({ status: "completed", payment_status: "paid", total: 100, completed_at: iso(15) }, [], now)).toMatchObject({ ok: false, why: expect.stringMatching(/14 dias/) });
    // sem data de conclusão, quem decide é o servidor
    expect(canOpenDispute({ status: "completed", payment_status: "paid", total: 100, created_at: iso(40) }, [], now).ok).toBe(true);
  });
  it("um pedido aberto ou decidido impede outro; desistir permite voltar a pedir", () => {
    const o = { status: "completed", payment_status: "paid", total: 100, completed_at: iso(1) };
    expect(canOpenDispute(o, [{ status: "open", outcome: null }], now).ok).toBe(false);
    expect(canOpenDispute(o, [{ status: "resolved", outcome: "refunded" }], now).ok).toBe(false);
    expect(canOpenDispute(o, [{ status: "resolved", outcome: "withdrawn" }], now).ok).toBe(true);
  });
  it("valor que ainda se pode pedir", () => {
    expect(refundableAmount({ total: "10000", refunded_amount: "2500" })).toBe(7500);
    expect(refundableAmount({ total: 100, refunded_amount: 300 })).toBe(0);
    expect(refundableAmount({ total: 100 })).toBe(100);
  });
});

describe("formulário do pedido", () => {
  it("não recebido só permite reembolso", () => {
    expect(requestsFor("not_received")).toEqual(["refund"]);
    expect(requestsFor("damaged")).toContain("replacement");
    expect(validateDispute({ request: "return_refund", reason: "not_received", description: "Nunca chegou" }, 100)).toMatch(/só pode pedir o reembolso/);
  });
  it("valida explicação, valor e fotografias", () => {
    const base = { request: "refund" as const, reason: "damaged" as const, description: "O ecrã veio partido" };
    expect(validateDispute(base, 100)).toBeNull();
    expect(validateDispute({ ...base, description: "mau" }, 100)).toMatch(/Explique/);
    expect(validateDispute({ ...base, amount: 0 }, 100)).toMatch(/valor válido/);
    expect(validateDispute({ ...base, amount: 101 }, 100)).toMatch(/não pode passar/);
    expect(validateDispute({ ...base, amount: 50 }, 100)).toBeNull();
    expect(validateDispute({ ...base, request: "replacement", amount: 999 }, 100)).toBeNull(); // troca não leva valor
    expect(validateDispute({ ...base, photos: ["a", "b", "c", "d", "e"] }, 100)).toMatch(/máximo 4/);
    expect(validateDispute({ ...base, reason: "seller_cancelled" }, 100)).toMatch(/motivo/);
  });
  it("caminho das fotografias fica na pasta da encomenda e da pessoa", () => {
    expect(disputePhotoPath("ord", "uid", "Foto do ecrã (1).JPG", 5)).toBe("ord/uid/5-Foto-do-ecra-1-.JPG");
    expect(disputePhotoPath("ord", "uid", "###", 5)).toBe("ord/uid/5-foto.jpg");
  });
});

describe("passos de cada lado", () => {
  const d = (status: DisputeStatus, daysAgo = 0) => ({ status, updated_at: iso(daysAgo) });
  it("vendedor", () => {
    expect(disputeActions(d("open"), "seller", now)).toEqual(["accept", "decline"]);
    expect(disputeActions(d("returned"), "seller", now)).toEqual(["confirm_return"]);
    expect(disputeActions(d("awaiting_refund"), "seller", now)).toEqual(["mark_refunded"]);
    expect(disputeActions(d("refund_sent"), "seller", now)).toEqual([]);
    expect(disputeActions(d("refund_sent", 4), "seller", now)).toEqual(["escalate"]);
    expect(disputeActions(d("open", 10), "seller", now)).toEqual(["accept", "decline"]);
  });
  it("comprador", () => {
    expect(disputeActions(d("open"), "buyer", now)).toEqual(["withdraw"]);
    expect(disputeActions(d("open", 4), "buyer", now)).toEqual(["escalate", "withdraw"]);
    expect(disputeActions(d("declined"), "buyer", now)).toEqual(["escalate", "withdraw"]);
    expect(disputeActions(d("awaiting_return"), "buyer", now)).toEqual(["mark_returned", "withdraw"]);
    expect(disputeActions(d("refund_sent"), "buyer", now)).toEqual(["confirm_refund", "withdraw"]);
    expect(disputeActions(d("replacing"), "buyer", now)).toEqual(["confirm_replacement", "withdraw"]);
    expect(disputeActions(d("escalated", 9), "buyer", now)).toEqual(["withdraw"]);
    expect(disputeActions(d("resolved"), "buyer", now)).toEqual([]);
  });
  it("todos os estados e botões têm texto em português", () => {
    for (const s of Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[]) {
      expect(disputeNextStep({ status: s, request: "refund", outcome: s === "resolved" ? "refunded" : null }, "buyer")).not.toBe("");
      expect(disputeNextStep({ status: s, request: "refund", outcome: null }, "seller")).not.toBe("");
    }
    expect(Object.values(DISPUTE_ACTION_LABELS).every(Boolean)).toBe(true);
    expect(disputeEventLabel({ actor_role: "system", action: "auto_refund" })).toBe("Huambo Online · Reembolso automático");
    expect(isActiveDispute("escalated")).toBe(true); expect(isActiveDispute("resolved")).toBe(false);
  });
  it("mostra o pedido mais recente de cada encomenda", () => {
    const m = latestDisputeByOrder([{ order_id: "a", created_at: "2026-10-01", n: 1 }, { order_id: "a", created_at: "2026-10-05", n: 2 }, { order_id: "b", created_at: "2026-10-02", n: 3 }]);
    expect(m.a.n).toBe(2); expect(m.b.n).toBe(3);
  });
});

describe("ligação ao servidor", () => {
  it("chama as funções certas com os parâmetros certos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const c = { rpc } as any;
    await openDispute(c, "o1", { request: "replacement", reason: "wrong_item", description: "  Tamanho errado ", amount: 50, photos: ["o1/u/1.jpg"] });
    expect(rpc).toHaveBeenLastCalledWith("open_order_dispute", { p_order_id: "o1", p_request: "replacement", p_reason: "wrong_item", p_description: "Tamanho errado", p_amount: null, p_photos: ["o1/u/1.jpg"] });
    await disputeAction(c, "d1", "decline", "  ");
    expect(rpc).toHaveBeenLastCalledWith("dispute_action", { p_dispute_id: "d1", p_action: "decline", p_note: null, p_photos: [] });
    await decideDispute(c, "d1", "refund", " Metade ", 500);
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_dispute", { p_dispute_id: "d1", p_decision: "refund", p_amount: 500, p_note: "Metade" });
    await listDisputesForAdmin(c, "");
    expect(rpc).toHaveBeenLastCalledWith("admin_list_disputes_v2", { p_status: null });
  });
  it("notificações levam à página certa e os erros ficam em português", () => {
    const dispute = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(getNotificationLink({ type: "order", title: "O vendedor aceitou", data: { order_id: dispute, dispute_id: dispute, for: "dispute" } })?.href).toBe("/disputas");
    expect(getNotificationLink({ type: "system", title: "Disputa para decidir", data: { dispute_id: dispute, for: "admin" } })?.href).toBe("/admin");
    expect(friendlyError(new Error("ESCALATE_TOO_EARLY"))).toMatch(/3 dias/);
    expect(friendlyError(new Error("DISPUTE_WINDOW_CLOSED"))).toMatch(/14 dias/);
    expect(friendlyError(new Error("DISPUTE_ALREADY_DECIDED"))).toMatch(/decidido/);
  });
});
