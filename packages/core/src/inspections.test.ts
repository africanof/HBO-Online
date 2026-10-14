import { describe, expect, it, vi } from "vitest";
import { inspectedMap, inspectionBadgeText, isInspected, requestInspection, decideInspection, revokeInspection, scheduleInspection, validateInspectionRequest, inspectionRef } from "./inspections";

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
