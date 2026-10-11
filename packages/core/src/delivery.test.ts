import { describe, expect, it } from "vitest";
import { nextCourierSteps, isActiveDelivery, validateCourierInput, latestDeliveryByOrder, registerCourier, claimDelivery, updateDeliveryStatus,
  requestOrderDelivery, cancelDeliveryRequest, listMyDeliveries, setCourierStatus, assignDelivery, getMyCourier, DELIVERY_STATUS_LABELS } from "./delivery";
import { getNotificationLink } from "./notifications";
import { friendlyError } from "./classified-listings";

function rpcClient() {
  const calls: { fn: string; args: any }[] = [];
  const client: any = {
    rpc: (fn: string, args: any) => { calls.push({ fn, args }); return Promise.resolve({ data: null, error: null }); },
    from: (t: string) => { const q: any = { select: () => q, eq: (c: string, v: string) => { calls.push({ fn: "from:" + t, args: { [c]: v } }); return q; }, maybeSingle: () => Promise.resolve({ data: null, error: null }) }; return q; }
  };
  return { client, calls };
}
const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("entregas", () => {
  it("segue os passos do servidor", () => {
    expect(nextCourierSteps("accepted")).toEqual(["picked_up", "released"]);
    expect(nextCourierSteps("assigned")).toEqual(["picked_up", "released"]);
    expect(nextCourierSteps("picked_up")).toEqual(["in_transit", "delivered"]);
    expect(nextCourierSteps("in_transit")).toEqual(["delivered"]);
    expect(nextCourierSteps("delivered")).toEqual([]);
    expect(nextCourierSteps("pending")).toEqual([]);
    expect(isActiveDelivery("in_transit")).toBe(true);
    expect(isActiveDelivery("cancelled")).toBe(false);
    expect(DELIVERY_STATUS_LABELS.delivered).toBe("Entregue");
  });
  it("valida o registo de estafeta", () => {
    expect(validateCourierInput({ name: " ", phone: "923000000", vehicle: "moto" })).toMatch(/nome/);
    expect(validateCourierInput({ name: "Zé", phone: "abc", vehicle: "moto" })).toMatch(/telefone/);
    expect(validateCourierInput({ name: "Zé", phone: "+244 923 000 000", vehicle: "aviao" })).toMatch(/transporte/);
    expect(validateCourierInput({ name: "Zé", phone: "+244 923 000 000", vehicle: "a_pe" })).toBeNull();
  });
  it("escolhe a entrega mais recente de cada encomenda", () => {
    const m = latestDeliveryByOrder([
      { id: "1", order_id: "a", requested_at: "2026-10-01T10:00:00Z" },
      { id: "2", order_id: "a", requested_at: "2026-10-02T10:00:00Z" },
      { id: "3", order_id: "b", requested_at: "2026-10-01T10:00:00Z" }
    ]);
    expect(m.a.id).toBe("2"); expect(m.b.id).toBe("3");
  });
  it("usa as funções do servidor", async () => {
    const { client, calls } = rpcClient();
    expect((await registerCourier(client, { name: "", phone: "923000000", vehicle: "moto" })).error).toBeTruthy();
    await registerCourier(client, { name: " Zé ", phone: "923000000", vehicle: "moto" });
    await claimDelivery(client, "d1");
    await updateDeliveryStatus(client, "d1", "delivered");
    await requestOrderDelivery(client, "o1", "  ");
    await cancelDeliveryRequest(client, "d1");
    await listMyDeliveries(client, "party");
    await setCourierStatus(client, "u1", "approved");
    await assignDelivery(client, "d1", "u1");
    await getMyCourier(client, "u1");
    expect(calls.map(c => c.fn)).toEqual(["register_courier", "claim_delivery", "update_delivery_status", "request_order_delivery",
      "cancel_delivery_request", "my_deliveries", "admin_set_courier_status", "assign_delivery", "from:couriers"]);
    expect(calls[0].args).toEqual({ p_name: "Zé", p_phone: "923000000", p_vehicle: "moto", p_municipality_id: null });
    expect(calls[2].args).toEqual({ p_delivery_id: "d1", p_status: "delivered" });
    expect(calls[3].args).toEqual({ p_order_id: "o1", p_notes: null });
    expect(calls[8].args).toEqual({ user_id: "u1" });
  });
  it("liga as notificações à página certa", () => {
    expect(getNotificationLink({ type: "delivery", title: "Nova entrega disponível", data: { delivery_id: uuid, for: "courier" } })?.href).toBe("/entregas");
    expect(getNotificationLink({ type: "delivery", title: "Entrega atualizada", data: { delivery_id: uuid, order_id: uuid } })?.href).toBe("/encomendas");
    expect(getNotificationLink({ type: "system", title: "Novo pedido de aluguer", data: { rental_id: uuid, listing_id: uuid } })?.href).toBe("/alugueres?recebidos=1");
    expect(getNotificationLink({ type: "system", title: "Nova praça sugerida", data: { market_id: uuid, for: "admin" } })?.href).toBe("/admin");
    expect(getNotificationLink({ type: "system", title: "Pedido de aluguer aceite", data: { rental_id: uuid } })?.href).toBe("/alugueres");
  });
  it("traduz os erros", () => {
    expect(friendlyError({ message: "DELIVERY_ALREADY_TAKEN" })).toMatch(/Outro estafeta/);
    expect(friendlyError({ message: "NOT_APPROVED_COURIER" })).toMatch(/aprovada/);
  });
});
