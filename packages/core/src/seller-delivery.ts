import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";
import { isInAngola, type GeoPoint } from "./places";
import type { Fulfillment } from "./shop";

/**
 * 🚚 Regras de entrega de cada vendedor (lojas, empresas, anunciantes) — igual no Site e na APP.
 * O vendedor escolhe levantamento no local e/ou entrega, o preço por município (e para os outros), entrega grátis a partir
 * de um valor e o valor mínimo para entregar. O carrinho calcula a taxa por vendedor conforme o município do comprador.
 */
export type DeliveryZone = { municipality_id: string; municipality_name?: string; fee: number };
export type DeliveryPolicy = {
  pickup_enabled: boolean; pickup_place: string | null; delivery_enabled: boolean; default_fee: number | null; free_over: number | null;
  min_order: number | null; delivery_days: string | null; note: string | null; zones: DeliveryZone[];
};
export type DeliveryReason = "no_delivery" | "min_order" | "area" | "needs_area";
export type DeliveryQuote = {
  configured: boolean; pickup: boolean; pickup_place?: string | null; delivery: boolean; fee: number | null; free: boolean; reason: DeliveryReason | null;
  min_order?: number | null; free_over?: number | null; missing_for_free?: number | null; delivery_days?: string | null; note?: string | null;
};
export type CartSellerQuote = { seller_id: string; seller_name: string; subtotal: number; quote: DeliveryQuote };
export type DeliverySettingsInput = {
  pickupEnabled: boolean; pickupPlace?: string; deliveryEnabled: boolean; defaultFee: number | null; freeOver: number | null; minOrder: number | null;
  deliveryDays?: string; note?: string; zones: { municipalityId: string; fee: number }[];
};

export const DELIVERY_REASON_TEXT: Record<DeliveryReason, string> = {
  no_delivery: "Este vendedor não faz entregas (só levantamento no local).",
  min_order: "Abaixo do valor mínimo para entrega deste vendedor.",
  area: "Este vendedor não entrega no município escolhido.",
  needs_area: "Escolha o município da entrega para ver o preço."
};

const num = (v: unknown) => v == null || v === "" ? null : Number(v);
const fixQuote = (q: DeliveryQuote): DeliveryQuote => ({ ...q, fee: num(q.fee), min_order: num(q.min_order), free_over: num(q.free_over), missing_for_free: num(q.missing_for_free) });

/** Validação do formulário do vendedor. */
export function validateDeliverySettings(i: DeliverySettingsInput): string | null {
  if (!i.pickupEnabled && !i.deliveryEnabled) return "Escolha pelo menos uma opção: levantamento no local ou entrega.";
  if ((i.pickupPlace?.trim().length ?? 0) > 300) return "O local de levantamento é demasiado longo (máximo 300 letras).";
  if (i.deliveryEnabled) {
    if (i.defaultFee == null && !i.zones.length) return "Indique o preço da entrega: por município ou um preço para todos os municípios.";
    if (i.defaultFee != null && !(i.defaultFee >= 0)) return "Preço de entrega inválido.";
    if (i.zones.some(z => !(Number.isFinite(z.fee) && z.fee >= 0))) return "Há um preço de entrega por município inválido.";
    if (new Set(i.zones.map(z => z.municipalityId)).size !== i.zones.length) return "O mesmo município aparece duas vezes.";
    if (i.freeOver != null && !(i.freeOver > 0)) return "O valor para entrega grátis tem de ser maior que zero.";
    if (i.minOrder != null && !(i.minOrder > 0)) return "O valor mínimo para entrega tem de ser maior que zero.";
    if (i.freeOver != null && i.minOrder != null && i.freeOver < i.minOrder) return "A entrega grátis não pode começar abaixo do valor mínimo para entrega.";
  }
  if ((i.deliveryDays?.trim().length ?? 0) > 120) return "O prazo é demasiado longo (máximo 120 letras).";
  if ((i.note?.trim().length ?? 0) > 300) return "A nota é demasiado longa (máximo 300 letras).";
  return null;
}

/** A mesma conta que a base de dados faz (para mostrar logo, sem esperar). */
export function computeDeliveryQuote(p: DeliveryPolicy | null, municipalityId: string | null | undefined, subtotal: number): DeliveryQuote {
  if (!p) return { configured: false, pickup: true, delivery: true, fee: 0, free: false, reason: null };
  const zone = municipalityId ? p.zones.find(z => z.municipality_id === municipalityId) : undefined;
  let fee = zone ? Number(zone.fee) : p.default_fee;
  const sub = Math.max(0, subtotal || 0);
  const reason: DeliveryReason | null = !p.delivery_enabled ? "no_delivery" : p.min_order != null && sub < p.min_order ? "min_order"
    : !municipalityId ? "needs_area" : fee == null ? "area" : null;
  if (!reason && p.free_over != null && sub >= p.free_over) fee = 0;
  return { configured: true, pickup: p.pickup_enabled, pickup_place: p.pickup_place, delivery: !reason, fee: reason ? null : fee, free: !reason && fee === 0,
    reason, min_order: p.min_order, free_over: p.free_over,
    missing_for_free: p.delivery_enabled && p.free_over != null && sub < p.free_over ? p.free_over - sub : null, delivery_days: p.delivery_days, note: p.note };
}

/** Linhas curtas para a página do produto, do anúncio e do vendedor. */
export function deliveryPolicyLines(p: DeliveryPolicy | null): string[] {
  if (!p) return ["🤝 Entrega ou levantamento a combinar com o vendedor."];
  const out: string[] = [];
  if (p.pickup_enabled) out.push(p.pickup_place ? `🏪 Levantamento no local: ${p.pickup_place}` : "🏪 Levantamento no local");
  if (p.delivery_enabled) {
    const fees = [...p.zones.map(z => Number(z.fee)), ...(p.default_fee != null ? [Number(p.default_fee)] : [])];
    if (fees.length) {
      const min = Math.min(...fees), max = Math.max(...fees);
      out.push(max === 0 ? "🚚 Entrega grátis" : min === max ? `🚚 Entrega: ${formatPrice(min)}` : `🚚 Entrega: de ${formatPrice(min)} a ${formatPrice(max)}, conforme o município`);
    }
    if (p.default_fee == null && p.zones.length) out.push(`📍 Entrega em: ${p.zones.map(z => z.municipality_name).filter(Boolean).join(", ")}`);
    if (p.free_over != null) out.push(`🎁 Entrega grátis a partir de ${formatPrice(p.free_over)}`);
    if (p.min_order != null) out.push(`🧾 Entrega só a partir de ${formatPrice(p.min_order)}`);
    if (p.delivery_days) out.push(`⏱️ Prazo: ${p.delivery_days}`);
  } else out.push("🚫 Não faz entregas");
  if (p.note) out.push(`ℹ️ ${p.note}`);
  return out;
}
/** «Entrega: 1 500 Kz», «Entrega grátis 🎁», ou o motivo de não haver entrega. */
export function deliveryQuoteText(q: DeliveryQuote): string {
  if (!q.delivery) return q.reason ? DELIVERY_REASON_TEXT[q.reason] : DELIVERY_REASON_TEXT.no_delivery;
  if (!q.configured) return "Entrega a combinar com o vendedor";
  return q.free ? "Entrega grátis 🎁" : `Entrega: ${formatPrice(q.fee ?? 0)}`;
}
export function freeDeliveryHint(q: DeliveryQuote): string | null {
  return q.missing_for_free != null && q.missing_for_free > 0 ? `Faltam ${formatPrice(q.missing_for_free)} para a entrega ser grátis.` : null;
}
/** Escolha inicial de cada vendedor: entrega se for possível, senão levantamento. */
export function defaultFulfillment(q: DeliveryQuote): Fulfillment | null {
  if (q.delivery) return "delivery";
  if (q.pickup) return "pickup";
  return q.reason === "needs_area" ? "delivery" : null;
}
/** Totais do carrinho com as escolhas feitas. */
export function cartTotals(rows: CartSellerQuote[], choices: Record<string, Fulfillment | undefined>) {
  let subtotal = 0, delivery = 0; const problems: string[] = [];
  for (const r of rows) {
    subtotal += Number(r.subtotal) || 0;
    const c = choices[r.seller_id];
    if (!c) { problems.push(r.seller_id); continue; }
    if (c === "pickup" && !r.quote.pickup) problems.push(r.seller_id);
    if (c === "delivery") { if (!r.quote.delivery) problems.push(r.seller_id); else delivery += Number(r.quote.fee) || 0; }
  }
  return { subtotal, delivery, total: subtotal + delivery, problems };
}

// --- Servidor ---------------------------------------------------------------------------------
export async function getDeliveryPolicy(client: SupabaseClient, sellerId: string) {
  const r = await client.rpc("seller_delivery_policy", { p_seller_id: sellerId });
  const d = r.data as DeliveryPolicy | null;
  return { data: d ? { ...d, default_fee: num(d.default_fee), free_over: num(d.free_over), min_order: num(d.min_order),
    zones: (d.zones ?? []).map(z => ({ ...z, fee: Number(z.fee) })) } as DeliveryPolicy : null, error: r.error };
}
export async function saveDeliverySettings(client: SupabaseClient, sellerId: string, i: DeliverySettingsInput) {
  const bad = validateDeliverySettings(i); if (bad) return { error: new Error(bad) };
  const s = await client.from("seller_delivery_settings").upsert({ seller_id: sellerId, pickup_enabled: i.pickupEnabled, pickup_place: i.pickupPlace?.trim() || null,
    delivery_enabled: i.deliveryEnabled, default_fee: i.deliveryEnabled ? i.defaultFee : null, free_over: i.deliveryEnabled ? i.freeOver : null,
    min_order: i.deliveryEnabled ? i.minOrder : null, delivery_days: i.deliveryDays?.trim() || null, note: i.note?.trim() || null, updated_at: new Date().toISOString() });
  if (s.error) return { error: s.error };
  const del = await client.from("seller_delivery_zones").delete().eq("seller_id", sellerId);
  if (del.error) return { error: del.error };
  if (i.deliveryEnabled && i.zones.length) {
    const z = await client.from("seller_delivery_zones").insert(i.zones.map(x => ({ seller_id: sellerId, municipality_id: x.municipalityId, fee: x.fee })));
    if (z.error) return { error: z.error };
  }
  return { error: null };
}
/** Voltar ao «a combinar com o vendedor» (apaga as regras). */
export async function clearDeliverySettings(client: SupabaseClient, sellerId: string) {
  await client.from("seller_delivery_zones").delete().eq("seller_id", sellerId);
  return client.from("seller_delivery_settings").delete().eq("seller_id", sellerId);
}
export async function cartDeliveryQuote(client: SupabaseClient, municipalityId?: string | null) {
  const r = await client.rpc("cart_delivery_quote", { p_municipality_id: municipalityId || null });
  return { data: ((r.data ?? []) as CartSellerQuote[]).map(x => ({ ...x, subtotal: Number(x.subtotal) || 0, quote: fixQuote(x.quote) })), error: r.error };
}
export type CheckoutV3Input = { choices: Record<string, Fulfillment>; paymentMethod: string; phone: string; municipalityId?: string | null;
  deliveryText?: string; note?: string; protected?: boolean; point?: GeoPoint | null };
export function validateCheckoutV3(i: CheckoutV3Input, sellerIds: string[]): string | null {
  if (!/^\+?[0-9 ]{9,15}$/.test(i.phone.trim())) return "Indique um telefone válido para o vendedor o contactar.";
  if (sellerIds.some(id => !i.choices[id])) return "Escolha levantamento ou entrega para cada vendedor.";
  const anyDelivery = Object.values(i.choices).includes("delivery");
  if (anyDelivery && !i.municipalityId) return "Escolha o município da entrega.";
  if (anyDelivery && !i.deliveryText?.trim()) return "Indique a morada ou ponto de referência para a entrega.";
  return null;
}
/** Faz as encomendas com a escolha de cada vendedor e a taxa de entrega calculada pela base de dados. */
export async function placeOrdersV3(client: SupabaseClient, i: CheckoutV3Input, sellerIds: string[]) {
  const bad = validateCheckoutV3(i, sellerIds); if (bad) return { data: null, error: new Error(bad) };
  const r = await client.rpc("place_orders_v3", { p_choices: i.choices, p_payment_method: i.paymentMethod, p_contact_phone: i.phone.trim(),
    p_municipality_id: i.municipalityId || null, p_delivery_text: i.deliveryText?.trim() || null, p_note: i.note?.trim() || null, p_protected: !!i.protected });
  if (!r.error) await client.from("cart_items").delete().not("ordered_at", "is", null);
  if (!r.error && i.point && isInAngola(i.point)) for (const id of (r.data as string[] | null) ?? []) await client.rpc("set_order_delivery_point", { p_order_id: id, p_lat: i.point.lat, p_lng: i.point.lng });
  return r;
}
/** Encomendas com subtotal, taxa de entrega e município da entrega. */
export async function listOrdersV4(client: SupabaseClient, role: "buyer" | "seller") { return client.rpc("my_orders_v4", { p_role: role }); }
