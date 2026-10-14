import { describe, expect, it, vi } from "vitest";
import { inspectionFee, submitInspectionPayment, decideInspectionPayment, inspectedMap, inspectionBadgeText, isInspected, requestInspection, decideInspection, revokeInspection, scheduleInspection, validateInspectionRequest, inspectionRef } from "./inspections";

const rpc = (data: unknown = null) => ({ rpc: vi.fn(async () => ({ data, error: null })) }) as any;

describe("inspeções", () => {
  it("selo válido só até à data", () => {
    const now = Date.parse("2026-10-14T10:00:00Z");
    expect(isInspected({ inspected_at: null, valid_until: "2027-10-14T10:00:00Z" }, now)).toBe(true);
    expect(isInspected({ inspected_at: null, valid_until: "2026-10-13T10:00:00Z" }, now)).toBe(false);
    expect(isInspected(null, now)).toBe(false);
    expect(inspectionBadgeText({ inspected_at: "2026-10-14T10:00:00Z", valid_until: "2027-10-14T10:00:00Z" })).toBe("Visitado pela administração em 14/10/2026 · válido até 14/10/2027");
    expect(inspectionRef(1001)).toBe("I-1001");
  });
  it("taxa: profissionais 2 000 Kz, os outros 5 000 Kz", () => {
    expect(inspectionFee("provider", null)).toBe(2000);
    expect(inspectionFee("business", null)).toBe(5000);
    expect(inspectionFee("store", { inspection_fee_kz: "7000", inspection_fee_provider_kz: 2500 })).toBe(7000);
    expect(inspectionFee("provider", { inspection_fee_kz: 7000, inspection_fee_provider_kz: "2500" })).toBe(2500);
  });
  it("pagamento da taxa", async () => {
    const k = rpc();
    expect((await submitInspectionPayment(k, "i", { method: "bank_transfer" })).error?.message).toContain("referência");
    await submitInspectionPayment(k, "i", { method: "multicaixa_express", reference: " TX1 ", proofPath: "u/p.jpg" });
    expect(k.rpc).toHaveBeenLastCalledWith("submit_inspection_payment", { p_id: "i", p_method: "multicaixa_express", p_reference: "TX1", p_proof_path: "u/p.jpg" });
    expect((await decideInspectionPayment(k, "i", false)).error?.message).toContain("motivo");
    await decideInspectionPayment(k, "i", true);
    expect(k.rpc).toHaveBeenLastCalledWith("admin_decide_inspection_payment", { p_id: "i", p_confirm: true, p_note: null });
  });
  it("valida o pedido", () => {
    expect(validateInspectionRequest({ address: "Rua", phone: "923000000" })).toContain("morada");
    expect(validateInspectionRequest({ address: "Rua 1, Huambo", phone: "923" })).toContain("telefone");
    expect(validateInspectionRequest({ address: "Rua 1, Huambo", phone: "923 000 000" })).toBeNull();
  });
  it("chamadas ao servidor", async () => {
    const c = rpc([{ target_id: "b1", inspected_at: "2026-10-14T10:00:00Z", valid_until: "2027-10-14T10:00:00Z" }]);
    expect(await inspectedMap(c, "business", ["b1", "b1", null, "b2"])).toEqual({ b1: { inspected_at: "2026-10-14T10:00:00Z", valid_until: "2027-10-14T10:00:00Z" } });
    expect(c.rpc).toHaveBeenCalledWith("inspected_targets", { p_kind: "business", p_ids: ["b1", "b2"] });
    const e = rpc(); expect(await inspectedMap(e, "store", [])).toEqual({}); expect(e.rpc).not.toHaveBeenCalled();
    const k = rpc();
    await requestInspection(k, "provider", "u1", { address: " Rua 1, Huambo ", phone: " 923000000 ", preferredTime: "manhãs" });
    expect(k.rpc).toHaveBeenLastCalledWith("request_inspection", { p_kind: "provider", p_target: "u1", p_address: "Rua 1, Huambo", p_phone: "923000000", p_preferred_time: "manhãs", p_note: null });
    expect((await decideInspection(k, "i", true, { exists: false })).error?.message).toContain("existe");
    expect((await decideInspection(k, "i", false, { exists: true })).error?.message).toContain("motivo");
    await decideInspection(k, "i", true, { exists: true, address: true });
    expect(k.rpc).toHaveBeenLastCalledWith("admin_decide_inspection", { p_id: "i", p_approve: true, p_note: null, p_checklist: { exists: true, address: true } });
    expect((await revokeInspection(k, "i", " ")).error?.message).toContain("motivo");
    expect((await scheduleInspection(k, "i", "")).error?.message).toContain("dia");
    await scheduleInspection(k, "i", "2026-10-20T09:00", " João ");
    expect(k.rpc).toHaveBeenLastCalledWith("admin_schedule_inspection", expect.objectContaining({ p_id: "i", p_inspector: "João" }));
  });
});
