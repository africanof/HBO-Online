import { describe, expect, it, vi } from "vitest";
import { trackingSteps, trackingStopped, courierLive, getOrderTracking, shareCourierLocation, type OrderTracking } from "./tracking";

const base = (o: Partial<OrderTracking["order"]> = {}, d: OrderTracking["delivery"] = null, events: OrderTracking["events"] = []): OrderTracking => ({
  order: { id: "o1", ref_no: 1001, status: "pending", payment_status: "pending", payment_method: "bank_transfer", fulfillment_type: "delivery", fulfillment_status: null,
    protected: false, escrow_status: null, created_at: "2026-11-01T10:00:00Z", paid_at: null, delivered_at: null, received_at: null, team_forwarded_at: null, team_declined_at: null, ...o },
  events, delivery: d
});
const keys = (t: OrderTracking) => trackingSteps(t).map(s => s.key + (s.done ? "✓" : "") + (s.current ? "←" : ""));

describe("rastreio", () => {
  it("encomenda nova: o passo atual é o pagamento", () => {
    expect(keys(base())).toEqual(["placed✓", "paid←", "team_approved", "confirmed", "processing", "ready", "delivered"]);
  });
  it("paga, aprovada e a caminho com estafeta", () => {
    const t = base({ status: "ready", payment_status: "paid", paid_at: "2026-11-01T11:00:00Z", team_forwarded_at: "2026-11-01T11:30:00Z" },
      { status: "in_transit", requested_at: "x", assigned_at: "x", delivered_at: null, courier_name: "Zé", courier_vehicle: "moto", lat: -12.77, lng: 15.73, located_at: "2026-11-01T12:00:00Z" },
      [{ kind: "courier_in_transit", note: null, at: "2026-11-01T12:00:00Z" }]);
    expect(keys(t)).toEqual(["placed✓", "paid✓", "team_approved✓", "confirmed✓", "processing✓", "ready✓", "picked_up✓", "in_transit✓", "delivered←"]);
    expect(trackingSteps(t).find(s => s.key === "in_transit")?.at).toBe("2026-11-01T12:00:00Z");
    expect(courierLive(t)).toEqual({ lat: -12.77, lng: 15.73, at: "2026-11-01T12:00:00Z" });
  });
  it("pagar na entrega não tem passo de pagamento; levantar no vendedor termina em «levantada»", () => {
    expect(keys(base({ payment_method: "cash_on_delivery", fulfillment_type: "pickup", status: "completed" })))
      .toEqual(["placed✓", "team_approved✓", "confirmed✓", "processing✓", "ready✓", "picked_by_buyer✓"]);
  });
  it("pagamento protegido: falta o comprador confirmar que recebeu", () => {
    expect(keys(base({ protected: true, status: "completed", payment_status: "paid", delivered_at: "x" })).slice(-2)).toEqual(["delivered✓", "received←"]);
  });
  it("cancelada ou recusada pela equipa: sem passo atual", () => {
    expect(trackingStopped(base({ status: "cancelled" }))).toBe("cancelled");
    expect(trackingStopped(base({ team_declined_at: "x" }))).toBe("declined");
    expect(trackingSteps(base({ status: "cancelled" })).some(s => s.current)).toBe(false);
  });
  it("chama as funções do servidor", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null })); const c = { rpc } as any;
    await getOrderTracking(c, "o1"); expect(rpc).toHaveBeenLastCalledWith("order_tracking", { p_order_id: "o1" });
    await shareCourierLocation(c, "d1", -12.7, 15.7); expect(rpc).toHaveBeenLastCalledWith("courier_share_location", { p_delivery_id: "d1", p_lat: -12.7, p_lng: 15.7 });
  });
});
