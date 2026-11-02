import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rastreio de encomendas: passos da encomenda (feita, paga, aprovada pela equipa, confirmada,
 * em preparação, pronta, recolhida, a caminho, entregue, recebida) e posição do estafeta.
 * Os textos vêm dos dicionários das apps: «trk.step.<passo>» e «trk.ev.<evento>».
 */
export type TrackingEvent = { kind: string; note: string | null; at: string };
export type OrderTracking = {
  order: { id: string; ref_no: number | null; status: string; payment_status: string | null; payment_method: string | null; fulfillment_type: string | null;
    fulfillment_status: string | null; protected: boolean; escrow_status: string | null; created_at: string; paid_at: string | null; delivered_at: string | null;
    received_at: string | null; team_forwarded_at: string | null; team_declined_at: string | null };
  events: TrackingEvent[];
  delivery: { status: string; requested_at: string; assigned_at: string | null; delivered_at: string | null; courier_name: string | null; courier_vehicle: string | null;
    lat: number | null; lng: number | null; located_at: string | null } | null;
};
export type TrackingStepKey = "placed" | "paid" | "team_approved" | "confirmed" | "processing" | "ready" | "picked_up" | "in_transit" | "delivered" | "received" | "picked_by_buyer";
export type TrackingStep = { key: TrackingStepKey; done: boolean; current: boolean; at: string | null };

export async function getOrderTracking(client: SupabaseClient, orderId: string) {
  const r = await client.rpc("order_tracking", { p_order_id: orderId });
  return { data: (r.data ?? null) as OrderTracking | null, error: r.error };
}
/** O estafeta partilha a posição atual (só durante a entrega). */
export function shareCourierLocation(client: SupabaseClient, deliveryId: string, lat: number, lng: number) {
  return client.rpc("courier_share_location", { p_delivery_id: deliveryId, p_lat: lat, p_lng: lng });
}

const RANK: Record<string, number> = { pending: 0, confirmed: 1, processing: 2, ready: 3, completed: 4 };
const DELIVERY_RANK: Record<string, number> = { pending: 0, assigned: 1, accepted: 1, picked_up: 2, in_transit: 3, delivered: 4, cancelled: -1 };

/** Os passos a mostrar, por ordem, com o que já aconteceu, o passo atual e a hora de cada um. */
export function trackingSteps(t: OrderTracking): TrackingStep[] {
  const o = t.order; const d = t.delivery;
  const when = (...kinds: string[]) => [...t.events].reverse().find(e => kinds.includes(e.kind))?.at ?? null;
  const rank = RANK[o.status] ?? 0; const drank = d ? DELIVERY_RANK[d.status] ?? 0 : -1;
  const pickup = o.fulfillment_type === "pickup";
  const steps: Omit<TrackingStep, "current">[] = [{ key: "placed", done: true, at: o.created_at }];
  // Pagar na entrega: o pagamento não é um passo antes da entrega.
  if (o.payment_method !== "cash_on_delivery" || o.protected) {
    steps.push({ key: "paid", done: o.payment_status === "paid" || o.payment_status === "refunded" || !!o.paid_at, at: o.paid_at ?? when("paid") });
  }
  steps.push({ key: "team_approved", done: !!o.team_forwarded_at, at: o.team_forwarded_at });
  steps.push({ key: "confirmed", done: rank >= 1, at: when("status_confirmed") });
  steps.push({ key: "processing", done: rank >= 2, at: when("status_processing") });
  steps.push({ key: "ready", done: rank >= 3, at: when("status_ready") });
  if (pickup) {
    steps.push({ key: "picked_by_buyer", done: rank >= 4, at: when("status_completed", "received") });
  } else {
    const delivered = drank >= 4 || !!o.delivered_at || rank >= 4;
    if (d && d.status !== "cancelled") {
      steps.push({ key: "picked_up", done: drank >= 2 || delivered, at: when("courier_picked_up") });
      steps.push({ key: "in_transit", done: drank >= 3 || delivered, at: when("courier_in_transit") });
    }
    steps.push({ key: "delivered", done: delivered, at: d?.delivered_at ?? o.delivered_at ?? when("courier_delivered", "status_completed") });
    if (o.protected) steps.push({ key: "received", done: !!o.received_at, at: o.received_at });
  }
  // Os passos já feitos ficam feitos mesmo que um passo anterior não tenha data (ex.: aprovação antiga).
  const lastDone = steps.map(s => s.done).lastIndexOf(true);
  const fixed = steps.map((s, i) => ({ ...s, done: s.done || i < lastDone }));
  const cancelled = o.status === "cancelled" || !!o.team_declined_at;
  const currentIndex = cancelled ? -1 : fixed.findIndex(s => !s.done);
  return fixed.map((s, i) => ({ ...s, current: i === currentIndex }));
}

/** A encomenda foi cancelada ou recusada pela equipa? */
export function trackingStopped(t: OrderTracking): "cancelled" | "declined" | null {
  if (t.order.team_declined_at) return "declined";
  return t.order.status === "cancelled" ? "cancelled" : null;
}
/** O estafeta está a partilhar a posição agora (há menos de 30 min)? */
export function courierLive(t: OrderTracking): { lat: number; lng: number; at: string } | null {
  const d = t.delivery;
  return d && d.lat != null && d.lng != null && d.located_at ? { lat: Number(d.lat), lng: Number(d.lng), at: d.located_at } : null;
}
/** A encomenda ainda está a andar (para atualizar o ecrã de vez em quando)? */
export function trackingActive(t: OrderTracking): boolean {
  return !trackingStopped(t) && !["completed"].includes(t.order.status) || (t.delivery != null && ["assigned", "accepted", "picked_up", "in_transit"].includes(t.delivery.status));
}
