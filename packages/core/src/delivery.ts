import type { SupabaseClient } from "@supabase/supabase-js";

/** Estafetas e entregas: tudo passa pelas funções do servidor (iguais no Site e na APP). */
export type DeliveryStatus = "pending" | "assigned" | "accepted" | "picked_up" | "in_transit" | "delivered" | "cancelled";
export type CourierStatus = "pending" | "approved" | "suspended";
export type Vehicle = "moto" | "carro" | "carrinha" | "bicicleta" | "a_pe";
export type CourierStep = "picked_up" | "in_transit" | "delivered" | "released";
export type Courier = { user_id: string; display_name: string; phone: string; vehicle: Vehicle; municipality_id: string | null; status: CourierStatus; available: boolean };

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "À espera de estafeta", assigned: "Estafeta atribuído", accepted: "Estafeta a caminho", picked_up: "Recolhida",
  in_transit: "A caminho do cliente", delivered: "Entregue", cancelled: "Cancelada"
};
export const COURIER_STATUS_LABELS: Record<CourierStatus, string> = { pending: "À espera de aprovação", approved: "Aprovado", suspended: "Suspenso" };
export const VEHICLE_LABELS: Record<Vehicle, string> = { moto: "Mota", carro: "Carro", carrinha: "Carrinha", bicicleta: "Bicicleta", a_pe: "A pé" };
export const STEP_LABELS: Record<CourierStep, string> = { picked_up: "Já recolhi", in_transit: "Estou a caminho", delivered: "Entreguei", released: "Desistir desta entrega" };

/** Próximos passos que o estafeta pode dar (igual à regra do servidor). */
export function nextCourierSteps(status: DeliveryStatus): CourierStep[] {
  if (status === "assigned" || status === "accepted") return ["picked_up", "released"];
  if (status === "picked_up") return ["in_transit", "delivered"];
  if (status === "in_transit") return ["delivered"];
  return [];
}
/** Uma entrega que ainda está a decorrer (não terminada nem cancelada). */
export function isActiveDelivery(status: string) { return !["delivered", "cancelled"].includes(status); }

export function validateCourierInput(input: { name: string; phone: string; vehicle: string }): string | null {
  if (input.name.trim().length < 2) return "Indique o seu nome.";
  if (!/^\+?[\d\s]{6,30}$/.test(input.phone.trim())) return "Indique um telefone válido.";
  if (!(input.vehicle in VEHICLE_LABELS)) return "Escolha o meio de transporte.";
  return null;
}

export async function getMyCourier(client: SupabaseClient, userId: string) {
  return client.from("couriers").select("*").eq("user_id", userId).maybeSingle<Courier>();
}
export async function registerCourier(client: SupabaseClient, input: { name: string; phone: string; vehicle: Vehicle; municipalityId?: string }) {
  const invalid = validateCourierInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  return client.rpc("register_courier", { p_name: input.name.trim(), p_phone: input.phone.trim(), p_vehicle: input.vehicle, p_municipality_id: input.municipalityId || null });
}
export async function setCourierAvailable(client: SupabaseClient, available: boolean) { return client.rpc("set_courier_available", { p_available: available }); }
export async function listAvailableDeliveries(client: SupabaseClient) { return client.rpc("available_deliveries"); }
export async function claimDelivery(client: SupabaseClient, id: string) { return client.rpc("claim_delivery", { p_delivery_id: id }); }
export async function updateDeliveryStatus(client: SupabaseClient, id: string, step: CourierStep) { return client.rpc("update_delivery_status", { p_delivery_id: id, p_status: step }); }
/** role 'courier': entregas que aceitei; 'party': entregas das minhas encomendas (como vendedor ou comprador). */
export async function listMyDeliveries(client: SupabaseClient, role: "courier" | "party") { return client.rpc("my_deliveries", { p_role: role }); }
export async function requestOrderDelivery(client: SupabaseClient, orderId: string, notes?: string) {
  return client.rpc("request_order_delivery", { p_order_id: orderId, p_notes: notes?.trim() || null });
}
export async function cancelDeliveryRequest(client: SupabaseClient, id: string) { return client.rpc("cancel_delivery_request", { p_delivery_id: id }); }

export async function listCouriersForAdmin(client: SupabaseClient) { return client.rpc("admin_list_couriers"); }
export async function setCourierStatus(client: SupabaseClient, userId: string, status: CourierStatus) { return client.rpc("admin_set_courier_status", { p_user_id: userId, p_status: status }); }
export async function listOpenDeliveriesForAdmin(client: SupabaseClient) { return client.rpc("admin_list_deliveries"); }
export async function assignDelivery(client: SupabaseClient, deliveryId: string, courierId: string) { return client.rpc("assign_delivery", { p_delivery_id: deliveryId, p_assignee: courierId }); }

/** A entrega mais recente de cada encomenda (para mostrar nas Encomendas). */
export function latestDeliveryByOrder<T extends { order_id: string; requested_at: string }>(rows: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const r of rows) if (!out[r.order_id] || r.requested_at > out[r.order_id].requested_at) out[r.order_id] = r;
  return out;
}

/** Compatibilidade com a versão anterior: o pedido passa agora pela função do servidor. */
export async function createDeliveryRequest(client: SupabaseClient, input: { orderId: string; notes?: string }) {
  return requestOrderDelivery(client, input.orderId, input.notes);
}
