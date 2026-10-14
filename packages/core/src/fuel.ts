import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";
import { formatEventDate } from "./events";
import { placeColumns, type GeoPoint } from "./places";

/**
 * ⛽ Combustível e gás (igual no Site e na APP).
 * Postos e pontos de venda de gás marcam quando há; quem procura vê onde há, pede aviso, confirma «há / já acabou»,
 * reserva (paga no posto) ou paga adiantado e levanta com um código. A plataforma cobra comissão sobre o levantado.
 */
export type FuelProduct = "gasolina" | "gasoleo" | "petroleo" | "gas_12kg" | "gas_6kg";
export type FuelStatus = "available" | "low" | "out" | "unknown";
export type FuelQueue = "none" | "short" | "medium" | "long";
export type FuelKind = "fuel" | "gas" | "both";
export type FuelMethod = "at_station" | "prepaid";
export type FuelOrderStatus = "reserved" | "awaiting_payment" | "submitted" | "paid" | "collected" | "cancelled" | "expired" | "rejected";

export const FUEL_PRODUCTS: Record<FuelProduct, { label: string; short: string; unit: "litro" | "botija"; icon: string; gas: boolean }> = {
  gasolina: { label: "Gasolina", short: "Gasolina", unit: "litro", icon: "⛽", gas: false },
  gasoleo: { label: "Gasóleo", short: "Gasóleo", unit: "litro", icon: "⛽", gas: false },
  petroleo: { label: "Petróleo", short: "Petróleo", unit: "litro", icon: "🛢️", gas: false },
  gas_12kg: { label: "Gás (botija 12 kg)", short: "Gás 12 kg", unit: "botija", icon: "🔥", gas: true },
  gas_6kg: { label: "Gás (botija 6 kg)", short: "Gás 6 kg", unit: "botija", icon: "🔥", gas: true }
};
export const FUEL_PRODUCT_LIST = Object.keys(FUEL_PRODUCTS) as FuelProduct[];
export const FUEL_KIND_LABELS: Record<FuelKind, string> = { fuel: "⛽ Posto de combustível", gas: "🔥 Venda de gás", both: "⛽🔥 Combustível e gás" };
export const FUEL_STATUS_LABELS: Record<FuelStatus, string> = { available: "🟢 Há", low: "🟡 Está a acabar", out: "🔴 Esgotado", unknown: "⚪ Sem informação" };
export const FUEL_QUEUE_LABELS: Record<FuelQueue, string> = { none: "Sem fila", short: "Fila pequena", medium: "Fila média", long: "Fila grande" };
export const FUEL_METHOD_LABELS: Record<FuelMethod, string> = { at_station: "Reservar e pagar no posto", prepaid: "Pagar já (adiantado)" };
export const FUEL_ORDER_STATUS_LABELS: Record<FuelOrderStatus, string> = {
  reserved: "✅ Reservado — mostre o código no posto", awaiting_payment: "⏳ Falta pagar", submitted: "⏳ Pago — à espera do posto",
  paid: "✅ Pago — mostre o código no posto", collected: "✔ Levantado", cancelled: "Cancelado", expired: "Caducou", rejected: "❌ Pagamento não confirmado"
};
export const FUEL_COLLECT_LABELS: Record<string, string> = {
  ok: "✅ Código válido — pode abastecer", used: "⚠️ Este código JÁ FOI USADO", invalid: "❌ Código não existe neste posto",
  expired: "❌ Reserva caducada", cancelled: "❌ Pedido cancelado", awaiting_payment: "⏳ Ainda não pagou", submitted: "⏳ Falta confirmar o pagamento", rejected: "❌ Pagamento recusado"
};
export const FUEL_ACTIVE_ORDER: FuelOrderStatus[] = ["reserved", "awaiting_payment", "submitted", "paid"];

export type FuelRow = {
  product_id: string; station_id: string; station_ref: number; station_name: string; kind: FuelKind; municipality_name: string | null; address: string | null;
  directions: string | null; geo_lat: number | null; geo_lng: number | null; phone: string | null; whatsapp: string | null; opening_hours: string | null;
  product: FuelProduct; price: number | null; status: FuelStatus; queue: FuelQueue | null; note: string | null; status_at: string; updated_at: string;
  reservable_left: number; max_per_order: number; accepts_reservations: boolean; accepts_prepay: boolean; hold_minutes: number;
  yes_2h: number; no_2h: number; last_report_at: string | null;
};
export type FuelStation = {
  id: string; ref_no: number; owner_id: string; name: string; kind: FuelKind; municipality_id: string | null; address: string | null; directions: string | null;
  geo_lat: number | null; geo_lng: number | null; phone: string | null; whatsapp: string | null; opening_hours: string | null; accepts_reservations: boolean;
  accepts_prepay: boolean; hold_minutes: number; status: "pending" | "approved" | "suspended"; admin_note: string | null; created_at: string;
};
export type FuelProductRow = { id: string; station_id: string; product: FuelProduct; price: number | null; status: FuelStatus; queue: FuelQueue | null;
  reservable_qty: number; max_per_order: number; note: string | null; status_at: string };
export type MyFuelOrder = {
  id: string; ref_no: number; status: FuelOrderStatus; method: FuelMethod; product: FuelProduct; quantity: number; unit_price: number; total: number;
  code: string | null; hold_until: string | null; pay_by: string | null; pay_method: string | null; reference: string | null; note: string | null; plate: string | null;
  created_at: string; station_id: string; station_name: string; address: string | null; directions: string | null; geo_lat: number | null; geo_lng: number | null;
  phone: string | null; pay_holder: string | null; pay_iban: string | null; pay_express: string | null; pay_note: string | null;
};
export type StationOrder = {
  id: string; ref_no: number; status: FuelOrderStatus; method: FuelMethod; product: FuelProduct; quantity: number; total: number; buyer_name: string;
  buyer_phone: string | null; plate: string | null; code: string | null; hold_until: string | null; pay_by: string | null; pay_method: string | null;
  reference: string | null; note: string | null; created_at: string; collected_at: string | null;
};
export type StationPanel = {
  fee_pct: number; collected_today: number; collected_total: number; fee_total: number; fee_due: number; fee_overdue: boolean; fee_pending: boolean;
  orders: StationOrder[]; payments: { id: string; ref_no: number; amount: number; status: "pending" | "confirmed" | "rejected"; admin_note: string | null; created_at: string }[];
};
export type AdminFuelPayment = { id: string; ref_no: number; station_id: string; station_ref: number; station_name: string; owner_name: string; amount: number;
  method: string; reference: string | null; proof_path: string | null; status: string; admin_note: string | null; created_at: string };
export type FuelCollectResult = { result: string; code?: string; buyer?: string; plate?: string | null; product?: FuelProduct; quantity?: number; total?: number; method?: FuelMethod };

// --- Textos -----------------------------------------------------------------------------------
export function stationRef(n: number | null | undefined) { return n ? `S-${n}` : ""; }
export function fuelOrderRef(n: number | null | undefined) { return n ? `C-${n}` : ""; }
/** «20 L», «1 botija», «2 botijas». */
export function fuelQuantityText(product: FuelProduct, qty: number): string {
  const q = Number(qty) || 0; const n = Number.isInteger(q) ? String(q) : q.toFixed(1).replace(".", ",");
  return FUEL_PRODUCTS[product]?.unit === "botija" ? `${n} ${q === 1 ? "botija" : "botijas"}` : `${n} L`;
}
export function fuelPriceText(product: FuelProduct, price: number | null | undefined): string {
  if (price == null) return "Preço por indicar";
  return `${formatPrice(price)} / ${FUEL_PRODUCTS[product]?.unit === "botija" ? "botija" : "litro"}`;
}
/** «agora mesmo», «há 25 min», «há 3 h», «há 2 dias». */
export function minutesAgoText(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60); if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24); return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
/** Informação com mais de 6 horas pode já não ser verdade. */
export function fuelIsStale(statusAt: string | null | undefined, now = Date.now()): boolean {
  return !statusAt || now - Date.parse(statusAt) > 6 * 3600000;
}
export function fuelStatusLine(r: Pick<FuelRow, "status" | "status_at" | "queue">, now = Date.now()): string {
  const parts = [FUEL_STATUS_LABELS[r.status]];
  if (r.status !== "unknown") parts.push(`atualizado ${minutesAgoText(r.status_at, now)}`);
  if (r.queue && (r.status === "available" || r.status === "low")) parts.push(FUEL_QUEUE_LABELS[r.queue]);
  return parts.join(" · ");
}
export function fuelReportsText(yes: number, no: number): string {
  if (!yes && !no) return "";
  const p: string[] = [];
  if (yes) p.push(`${yes} ${yes === 1 ? "pessoa confirmou" : "pessoas confirmaram"} que há`);
  if (no) p.push(`${no} ${no === 1 ? "disse" : "disseram"} que acabou`);
  return p.join(" · ") + " (últimas 2 h)";
}
export function normalizeFuelCode(code: string): string {
  let c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.startsWith("CB")) c = c.slice(2);
  return c.length === 6 ? `CB-${c}` : code.trim().toUpperCase();
}
export function fuelShareMessage(siteUrl: string, r: Pick<FuelRow, "station_id" | "station_name" | "product" | "status" | "price" | "municipality_name">): string {
  return `${FUEL_PRODUCTS[r.product].icon} ${FUEL_STATUS_LABELS[r.status]} ${FUEL_PRODUCTS[r.product].label.toLowerCase()} — ${r.station_name}${r.municipality_name ? ", " + r.municipality_name : ""}` +
    `${r.price != null ? `\n💰 ${fuelPriceText(r.product, r.price)}` : ""}\n👉 ${siteUrl.replace(/\/$/, "")}/combustivel/${r.station_id}`;
}
export function holdText(iso: string | null | undefined): string { return iso ? `até ${formatEventDate(iso)}` : ""; }

// --- Validação --------------------------------------------------------------------------------
export type StationInput = {
  name: string; kind: FuelKind; municipalityId?: string; address?: string; directions?: string; point?: GeoPoint | null; phone?: string; whatsapp?: string;
  openingHours?: string; acceptsReservations: boolean; acceptsPrepay: boolean; holdMinutes: number; pay: { holder: string; iban: string; express: string; note: string };
  products: FuelProduct[];
};
export function validateStation(i: StationInput): string | null {
  if (i.name.trim().length < 3) return "Escreva o nome do posto ou do ponto de venda.";
  if (!i.municipalityId) return "Escolha o município.";
  if (!i.products.length) return "Escolha pelo menos um produto que vende.";
  if (i.kind === "fuel" && i.products.some(p => FUEL_PRODUCTS[p].gas)) return "Marcou gás: escolha «Combustível e gás».";
  if (i.kind === "gas" && i.products.some(p => !FUEL_PRODUCTS[p].gas)) return "Marcou combustível: escolha «Combustível e gás».";
  if (!(i.holdMinutes >= 15 && i.holdMinutes <= 1440)) return "O tempo para levantar tem de ser entre 15 minutos e 24 horas.";
  if (i.acceptsPrepay && !i.pay.iban.trim() && !i.pay.express.trim()) return "Para receber pagamentos adiantados, indique o IBAN ou o número Multicaixa Express.";
  if (i.acceptsPrepay && i.pay.holder.trim().length < 3) return "Indique o nome do titular da conta.";
  return null;
}
export function validateFuelReserve(r: Pick<FuelRow, "product" | "max_per_order" | "reservable_left">, qty: number, name: string): string | null {
  if (!(qty > 0)) return "Indique a quantidade.";
  if (FUEL_PRODUCTS[r.product].gas && !Number.isInteger(qty)) return "Indique o número de botijas (sem vírgulas).";
  if (qty > r.max_per_order) return `O máximo por pessoa é ${fuelQuantityText(r.product, r.max_per_order)}.`;
  if (qty > r.reservable_left) return `Só há ${fuelQuantityText(r.product, r.reservable_left)} para reservar.`;
  if (name.trim().length < 2) return "Escreva o seu nome.";
  return null;
}

// --- Servidor ---------------------------------------------------------------------------------
const num = (v: unknown) => Number(v) || 0;
const fixRow = (r: FuelRow): FuelRow => ({ ...r, price: r.price == null ? null : num(r.price), reservable_left: num(r.reservable_left), max_per_order: num(r.max_per_order),
  yes_2h: num(r.yes_2h), no_2h: num(r.no_2h) });
export async function fuelFeed(client: SupabaseClient, f: { product?: FuelProduct | ""; municipalityId?: string; stationId?: string } = {}) {
  const r = await client.rpc("fuel_feed", { p_product: f.product || null, p_municipality: f.municipalityId || null, p_station: f.stationId || null, p_limit: 200 });
  return { data: ((r.data ?? []) as FuelRow[]).map(fixRow), error: r.error };
}
export async function getStation(client: SupabaseClient, id: string) {
  const r = await client.from("fuel_stations").select("*").eq("id", id).maybeSingle();
  return { data: (r.data ?? null) as FuelStation | null, error: r.error };
}
export async function listMyStations(client: SupabaseClient, ownerId: string) {
  const r = await client.from("fuel_stations").select("*").eq("owner_id", ownerId).order("created_at");
  return { data: (r.data ?? []) as FuelStation[], error: r.error };
}
export async function listStationProducts(client: SupabaseClient, stationId: string) {
  const r = await client.from("fuel_products").select("id,station_id,product,price,status,queue,reservable_qty,max_per_order,note,status_at").eq("station_id", stationId);
  const order = (p: FuelProduct) => FUEL_PRODUCT_LIST.indexOf(p);
  return { data: ((r.data ?? []) as FuelProductRow[]).map(p => ({ ...p, price: p.price == null ? null : num(p.price), reservable_qty: num(p.reservable_qty), max_per_order: num(p.max_per_order) }))
    .sort((a, b) => order(a.product) - order(b.product)), error: r.error };
}
export async function getStationPay(client: SupabaseClient, stationId: string) {
  const r = await client.from("fuel_station_pay").select("holder,iban,express,note").eq("station_id", stationId).maybeSingle();
  const d = r.data as any; return { holder: d?.holder ?? "", iban: d?.iban ?? "", express: d?.express ?? "", note: d?.note ?? "" };
}
/** Grava o posto, os dados de pagamento e os produtos que vende (produtos tirados são apagados). */
export async function saveStation(client: SupabaseClient, ownerId: string, i: StationInput, id?: string, existing: FuelProductRow[] = []) {
  const bad = validateStation(i); if (bad) return { data: null, error: new Error(bad) };
  const pc = placeColumns(i.directions, i.point);
  const row = { name: i.name.trim(), kind: i.kind, municipality_id: i.municipalityId || null, address: i.address?.trim() || null, directions: pc.directions,
    geo_lat: pc.geo_lat, geo_lng: pc.geo_lng, phone: i.phone?.replace(/\s/g, "") || null, whatsapp: i.whatsapp?.replace(/\s/g, "") || null,
    opening_hours: i.openingHours?.trim() || null, accepts_reservations: i.acceptsReservations, accepts_prepay: i.acceptsPrepay, hold_minutes: i.holdMinutes };
  const st = id ? await client.from("fuel_stations").update(row).eq("id", id).select("id").single() : await client.from("fuel_stations").insert({ ...row, owner_id: ownerId }).select("id").single();
  if (st.error || !st.data) return { data: null, error: st.error };
  const stationId = (st.data as { id: string }).id;
  const pay = await client.from("fuel_station_pay").upsert({ station_id: stationId, holder: i.pay.holder.trim() || null, iban: i.pay.iban.replace(/\s/g, "") || null,
    express: i.pay.express.replace(/\s/g, "") || null, note: i.pay.note.trim() || null, updated_at: new Date().toISOString() });
  if (pay.error) return { data: { id: stationId }, error: pay.error };
  for (const p of i.products.filter(p => !existing.some(e => e.product === p))) {
    const r = await client.from("fuel_products").insert({ station_id: stationId, product: p, max_per_order: FUEL_PRODUCTS[p].gas ? 2 : 40 });
    if (r.error) return { data: { id: stationId }, error: r.error };
  }
  // Produto tirado: apaga se nunca teve pedidos; se teve, fica «sem informação» e sem reservas (o histórico dos pedidos não se perde).
  for (const e of existing.filter(e => !i.products.includes(e.product))) {
    const used = await client.from("fuel_orders").select("id", { count: "exact", head: true }).eq("product_id", e.id);
    if (used.count) await client.from("fuel_products").update({ status: "unknown", reservable_qty: 0 }).eq("id", e.id);
    else await client.from("fuel_products").delete().eq("id", e.id);
  }
  return { data: { id: stationId }, error: null };
}
/** O posto atualiza um produto: há / a acabar / esgotado, preço, fila, quantidade para reservas. */
export async function updateFuelProduct(client: SupabaseClient, id: string, p: Partial<Pick<FuelProductRow, "status" | "price" | "queue" | "reservable_qty" | "max_per_order" | "note">>) {
  if (p.price != null && !(p.price >= 0)) return { data: null, error: new Error("Preço inválido.") };
  if (p.reservable_qty != null && !(p.reservable_qty >= 0)) return { data: null, error: new Error("Quantidade inválida.") };
  if (p.max_per_order != null && !(p.max_per_order > 0)) return { data: null, error: new Error("O máximo por pessoa tem de ser maior que zero.") };
  const r = await client.from("fuel_products").update(p).eq("id", id).select("id").single();
  return { data: r.data, error: r.error };
}
export async function reportFuel(client: SupabaseClient, productId: string, has: boolean) { return await client.rpc("report_fuel", { p_product_id: productId, p_has: has }); }
export async function listMyFuelAlerts(client: SupabaseClient) {
  const r = await client.from("fuel_alerts").select("id,product,municipality_id");
  return { data: (r.data ?? []) as { id: string; product: FuelProduct; municipality_id: string | null }[], error: r.error };
}
export async function addFuelAlert(client: SupabaseClient, userId: string, product: FuelProduct, municipalityId?: string | null) {
  return await client.from("fuel_alerts").insert({ user_id: userId, product, municipality_id: municipalityId || null });
}
export async function removeFuelAlert(client: SupabaseClient, id: string) { return await client.from("fuel_alerts").delete().eq("id", id); }
export function reserveFuel(client: SupabaseClient, productId: string, quantity: number, method: FuelMethod, name: string, phone?: string, plate?: string) {
  return client.rpc("reserve_fuel", { p_product_id: productId, p_quantity: quantity, p_method: method, p_name: name.trim(), p_phone: phone?.trim() || null, p_plate: plate?.trim() || null });
}
export function submitFuelPayment(client: SupabaseClient, orderId: string, method: "bank_transfer" | "multicaixa_express", reference: string) {
  if (reference.trim().length < 3) return Promise.resolve({ data: null, error: new Error("Escreva a referência ou o número da operação.") });
  return client.rpc("submit_fuel_payment", { p_order_id: orderId, p_method: method, p_reference: reference.trim() });
}
export function decideFuelPayment(client: SupabaseClient, orderId: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (ex.: não recebi o dinheiro).") });
  return client.rpc("decide_fuel_payment", { p_order_id: orderId, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function collectFuel(client: SupabaseClient, stationId: string, code: string) {
  const r = await client.rpc("collect_fuel", { p_station_id: stationId, p_code: normalizeFuelCode(code) });
  return { data: (r.data ?? null) as FuelCollectResult | null, error: r.error };
}
export function cancelFuelOrder(client: SupabaseClient, orderId: string, reason?: string) {
  return client.rpc("cancel_fuel_order", { p_order_id: orderId, p_reason: reason?.trim() || null });
}
export async function myFuelOrders(client: SupabaseClient) {
  const r = await client.rpc("my_fuel_orders");
  return { data: ((r.data ?? []) as MyFuelOrder[]).map(o => ({ ...o, quantity: num(o.quantity), total: num(o.total), unit_price: num(o.unit_price) })), error: r.error };
}
export async function stationPanel(client: SupabaseClient, stationId: string) {
  const r = await client.rpc("fuel_station_panel", { p_station_id: stationId });
  const d = r.data as StationPanel | null;
  return { data: d ? { ...d, fee_due: num(d.fee_due), fee_total: num(d.fee_total), collected_today: num(d.collected_today), collected_total: num(d.collected_total),
    orders: d.orders.map(o => ({ ...o, quantity: num(o.quantity), total: num(o.total) })) } : null, error: r.error };
}
export function submitFuelFee(client: SupabaseClient, stationId: string, i: { method: "bank_transfer" | "multicaixa_express" | "cash"; reference?: string; proofPath?: string | null }) {
  if (!i.reference?.trim() && !i.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("submit_fuel_fee_payment", { p_station_id: stationId, p_method: i.method, p_reference: i.reference?.trim() || null, p_proof_path: i.proofPath || null });
}
export async function listStationsForAdmin(client: SupabaseClient, status: "pending" | "approved" | "suspended" | "" = "pending") {
  let q = client.from("fuel_stations").select("*,municipalities(name)").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const r = await q;
  return { data: (r.data ?? []) as (FuelStation & { municipalities?: { name: string } | null })[], error: r.error };
}
export function setStationStatus(client: SupabaseClient, id: string, status: "pending" | "approved" | "suspended", note?: string) {
  if (status === "suspended" && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (o dono vai ler).") });
  return client.rpc("admin_set_fuel_station_status", { p_station_id: id, p_status: status, p_note: note?.trim() || null });
}
export async function listFuelPaymentsForAdmin(client: SupabaseClient, status: "pending" | "confirmed" | "rejected" | "" = "pending") {
  const r = await client.rpc("admin_list_fuel_payments", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminFuelPayment[]).map(p => ({ ...p, amount: num(p.amount) })), error: r.error };
}
export function decideFuelFee(client: SupabaseClient, id: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo.") });
  return client.rpc("admin_decide_fuel_payment", { p_payment_id: id, p_confirm: confirm, p_note: note?.trim() || null });
}
