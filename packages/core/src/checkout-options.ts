import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "./engage";

/** Compra como na Vinted: combinar com quem vende, ponto de recolha ou entrega em casa por estafeta (igual no Site e na APP). */
export type CheckoutFulfillment = "pickup" | "point" | "delivery";
export type HomeDeliveryArea = { municipality_id: string; municipality: string; fee: number; eta: string };
export type PickupPoint = { id: string; name: string; address: string; directions: string | null; municipality: string; lat: number | null; lng: number | null; hours: string | null; fee: number; eta: string };
export type DeliveryOptions = { home: HomeDeliveryArea[]; points: PickupPoint[] };

export async function getDeliveryOptions(client: SupabaseClient): Promise<DeliveryOptions> {
  const r = await client.rpc("delivery_options");
  const d = (r.data ?? {}) as { home?: any[]; points?: any[] };
  return {
    home: (d.home ?? []).map(x => ({ ...x, fee: Number(x.fee) })),
    points: (d.points ?? []).map(x => ({ ...x, fee: Number(x.fee), lat: x.lat == null ? null : Number(x.lat), lng: x.lng == null ? null : Number(x.lng) }))
  };
}

export type ListingCheckoutV2Input = { fulfillment: CheckoutFulfillment; phone: string; deliveryText?: string; note?: string; municipalityId?: string | null; pickupPointId?: string | null };
/** Devolve a chave do texto do erro (ou null). */
export function validateListingCheckoutV2(i: ListingCheckoutV2Input): string | null {
  if (!i.phone.trim() || i.phone.replace(/\D/g, "").length < 9) return "pp.err_phone";
  if (i.fulfillment === "point" && !i.pickupPointId) return "co.err.point";
  if (i.fulfillment === "delivery" && !i.municipalityId) return "co.err.area";
  if (i.fulfillment === "delivery" && (i.deliveryText ?? "").trim().length < 5) return "pp.err_address";
  return null;
}
export function buyListingProtectedV2(client: SupabaseClient, listingId: string, i: ListingCheckoutV2Input) {
  return client.rpc("protected_buy_listing_v2", {
    p_listing_id: listingId, p_fulfillment: i.fulfillment, p_contact_phone: i.phone.trim(),
    p_delivery_text: i.fulfillment === "delivery" ? (i.deliveryText ?? "").trim() : null, p_note: (i.note ?? "").trim() || null,
    p_municipality_id: i.fulfillment === "delivery" ? i.municipalityId ?? null : null, p_pickup_point_id: i.fulfillment === "point" ? i.pickupPointId ?? null : null
  });
}

/** Preço da entrega escolhida (0 ao combinar com quem vende). */
export function deliveryFee(o: DeliveryOptions, i: Pick<ListingCheckoutV2Input, "fulfillment" | "municipalityId" | "pickupPointId">): number {
  if (i.fulfillment === "point") return o.points.find(p => p.id === i.pickupPointId)?.fee ?? Math.min(...o.points.map(p => p.fee), Infinity);
  if (i.fulfillment === "delivery") return o.home.find(h => h.municipality_id === i.municipalityId)?.fee ?? Math.min(...o.home.map(h => h.fee), Infinity);
  return 0;
}
/** Linhas do resumo: artigo + entrega + inspeção = total. */
export function checkoutSummary(price: number, fee: number, inspectionFee = 0) {
  const f = Number.isFinite(fee) ? fee : 0;
  return { item: price, delivery: f, inspection: inspectionFee, total: price + f + inspectionFee, payNow: price + f };
}

/** Distância em km (para pôr o ponto mais perto primeiro). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (x: number) => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function sortPointsNear(points: PickupPoint[], me: { lat: number; lng: number } | null): (PickupPoint & { km: number | null })[] {
  const list = points.map(p => ({ ...p, km: me && p.lat != null && p.lng != null ? distanceKm(me, { lat: p.lat, lng: p.lng }) : null }));
  return me ? list.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)) : list;
}
export function formatKm(km: number | null): string { return km == null ? "" : km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1).replace(".", ",") + " km"; }

/** Os dados da última compra ficam guardados só neste aparelho (como a morada guardada da Vinted). */
export type SavedCheckout = { fulfillment?: CheckoutFulfillment; phone?: string; deliveryText?: string; municipalityId?: string; pickupPointId?: string };
export const CHECKOUT_KEY = "huambo:compra";
export async function loadSavedCheckout(store: KeyValueStore): Promise<SavedCheckout> {
  try { const v = JSON.parse((await store.getItem(CHECKOUT_KEY)) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export async function saveCheckout(store: KeyValueStore, v: SavedCheckout) { try { await store.setItem(CHECKOUT_KEY, JSON.stringify(v)); } catch { /* opcional */ } }

// Administração: pontos de recolha e preços de entrega por município
export type PickupPointAdmin = { id: string; name: string; address: string; directions: string | null; municipality_id: string; geo_lat: number | null; geo_lng: number | null; hours: string | null; phone: string | null; active: boolean };
export async function listPickupPointsAdmin(client: SupabaseClient) {
  const r = await client.from("pickup_points").select("id,name,address,directions,municipality_id,geo_lat,geo_lng,hours,phone,active").order("name");
  return { data: (r.data ?? []) as PickupPointAdmin[], error: r.error };
}
export function savePickupPoint(client: SupabaseClient, p: Omit<PickupPointAdmin, "id"> & { id?: string | null }) {
  return client.rpc("admin_save_pickup_point", { p_id: p.id ?? null, p_name: p.name, p_address: p.address, p_directions: p.directions, p_municipality_id: p.municipality_id,
    p_lat: p.geo_lat, p_lng: p.geo_lng, p_hours: p.hours, p_phone: p.phone, p_active: p.active });
}
export type DeliveryFeeRow = { municipality_id: string; home_fee: number | null; point_fee: number | null; eta_text: string; active: boolean };
export async function listDeliveryFees(client: SupabaseClient) {
  const r = await client.from("delivery_fees").select("municipality_id,home_fee,point_fee,eta_text,active");
  return { data: (r.data ?? []) as DeliveryFeeRow[], error: r.error };
}
export function saveDeliveryFee(client: SupabaseClient, f: DeliveryFeeRow) {
  return client.rpc("admin_save_delivery_fee", { p_municipality_id: f.municipality_id, p_home_fee: f.home_fee, p_point_fee: f.point_fee, p_eta: f.eta_text, p_active: f.active });
}
