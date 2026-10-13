import type { SupabaseClient } from "@supabase/supabase-js";
import qrcode from "qrcode-generator";
import { formatPrice } from "./classified-listings";
import { placeColumns, type GeoPoint } from "./places";
import type { PaymentMethodPlan } from "./plans";

/**
 * Eventos e venda de bilhetes (igual no Site e na APP).
 * O dinheiro dos bilhetes vai diretamente para o organizador; o Huambo Online cobra uma comissão dos bilhetes pagos.
 */
export type EventCategory = "music" | "party" | "sport" | "culture" | "religion" | "business" | "training" | "family" | "other";
export type EventStatus = "draft" | "published" | "cancelled";
export type TicketOrderStatus = "reserved" | "submitted" | "confirmed" | "rejected" | "cancelled" | "expired";
export type EventSummary = {
  id: string; ref_no: number; title: string; category: EventCategory; starts_at: string; ends_at: string | null; venue: string;
  municipality_name: string | null; cover_url: string | null; featured: boolean; price_from: number | null; tickets_left: number; status: EventStatus;
};
export type EventRow = {
  id: string; ref_no: number; organizer_id: string; title: string; description: string | null; category: EventCategory; starts_at: string; ends_at: string | null;
  venue: string; municipality_id: string | null; directions: string | null; geo_lat: number | null; geo_lng: number | null; cover_url: string | null;
  status: EventStatus; cancel_reason: string | null; featured_until: string | null; created_at: string; municipalities?: { name: string } | null;
};
export type TicketTypeAvailability = { id: string; name: string; price: number; quantity: number; left_count: number; max_per_order: number; active: boolean; sort: number };
export type TicketTypeDraft = { id?: string; name: string; price: string; quantity: string; max_per_order?: string; active?: boolean };
export type EventPaymentInfo = { holder: string; iban: string; express: string; note: string };
export type MyTicketOrder = {
  id: string; ref_no: number; status: TicketOrderStatus; quantity: number; total: number; unit_price: number; method: PaymentMethodPlan | null; reference: string | null;
  pay_by: string | null; note: string | null; created_at: string; event_id: string; title: string; starts_at: string; ends_at: string | null; venue: string;
  event_status: EventStatus; cancel_reason: string | null; pay_holder: string | null; pay_iban: string | null; pay_express: string | null; pay_note: string | null;
  type_name: string; tickets: { code: string; status: "valid" | "used" | "void" }[];
};
export type OrganizerOrder = {
  id: string; ref_no: number; status: TicketOrderStatus; quantity: number; total: number; buyer_name: string; buyer_phone: string | null;
  method: PaymentMethodPlan | null; reference: string | null; pay_by: string | null; note: string | null; created_at: string; type_name: string;
};
export type OrganizerPanel = {
  sold: number; revenue: number; checked_in: number; fee_pct: number; fee_total: number; fee_due: number; fee_pending: boolean; boost_pending: boolean;
  boost_price_kz: number; boost_days: number; orders: OrganizerOrder[];
  payments: { id: string; ref_no: number; kind: "fee" | "boost"; amount: number; days: number | null; status: "pending" | "confirmed" | "rejected"; admin_note: string | null; created_at: string }[];
};
export type AdminEventPayment = {
  id: string; ref_no: number; event_id: string; event_ref: number; event_title: string; organizer_name: string; kind: "fee" | "boost"; amount: number; days: number | null;
  method: PaymentMethodPlan; reference: string | null; proof_path: string | null; status: "pending" | "confirmed" | "rejected"; admin_note: string | null; created_at: string;
};
export type CheckInResult = { result: "ok" | "used" | "void" | "invalid"; code?: string; type?: string; holder?: string; at?: string };

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  music: "🎵 Música e concertos", party: "🎉 Festas", sport: "⚽ Desporto", culture: "🎭 Cultura e teatro", religion: "⛪ Religião",
  business: "💼 Negócios e feiras", training: "🎓 Formação e palestras", family: "👨‍👩‍👧 Família e crianças", other: "📌 Outros"
};
export const TICKET_ORDER_STATUS_LABELS: Record<TicketOrderStatus, string> = {
  reserved: "⏳ Reservado — falta pagar", submitted: "⏳ Pago — à espera do organizador", confirmed: "✅ Confirmado",
  rejected: "❌ Pagamento não confirmado", cancelled: "Cancelado", expired: "Reserva caducada"
};
export const CHECKIN_LABELS: Record<CheckInResult["result"], string> = {
  ok: "✅ Bilhete válido — pode entrar", used: "⚠️ Este bilhete JÁ ENTROU", void: "❌ Bilhete anulado", invalid: "❌ Código não existe neste evento"
};
/** Como o comprador pagou o bilhete (o dinheiro vai para o organizador). */
export const TICKET_METHOD_LABELS: Record<PaymentMethodPlan, string> = { multicaixa_express: "Multicaixa Express", bank_transfer: "Transferência bancária", cash: "Em mão ao organizador" };
/** O bilhete é para este evento que já passou ou foi cancelado? */
export function ticketUsable(o: Pick<MyTicketOrder, "status" | "event_status" | "starts_at" | "ends_at">, now = Date.now()) {
  return o.status === "confirmed" && o.event_status === "published" && !eventIsOver(o, now);
}
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// --- Datas (sempre em hora de Angola, UTC+1) -------------------------------------------------
const angola = (iso: string) => new Date(Date.parse(iso) + 3600000);
export function formatEventDate(iso: string): string {
  const d = angola(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
/** «2026-10-18T20:00» (campo de data/hora, hora de Angola) → ISO. */
export function localInputToIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const t = Date.parse(v + ":00+01:00");
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return angola(iso).toISOString().slice(0, 16);
}
/** APP: dia «DD/MM/AAAA» + hora «HH:MM» → «AAAA-MM-DDTHH:MM» (vazio se não for válido). */
export function partsToLocalInput(date: string, time: string): string {
  const d = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(date); const t = /^\s*(\d{1,2})[:h.](\d{2})\s*$/.exec(time || "");
  if (!d || !t) return "";
  const [dd, mm, yy, hh, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (mm < 1 || mm > 12 || dd < 1 || dd > new Date(Date.UTC(yy, mm, 0)).getUTCDate() || hh > 23 || mi > 59) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${yy}-${p(mm)}-${p(dd)}T${p(hh)}:${p(mi)}`;
}
/** «AAAA-MM-DDTHH:MM» → { date: "DD/MM/AAAA", time: "HH:MM" }. */
export function localInputToParts(v: string): { date: string; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(v || "");
  return m ? { date: `${m[3]}/${m[2]}/${m[1]}`, time: m[4] } : { date: "", time: "" };
}
export function eventIsOver(e: { starts_at: string; ends_at: string | null }, now = Date.now()): boolean {
  return (e.ends_at ? Date.parse(e.ends_at) : Date.parse(e.starts_at) + 6 * 3600000) < now;
}

// --- Textos -----------------------------------------------------------------------------------
export function eventRef(n: number | null | undefined) { return n ? `E-${n}` : ""; }
export function ticketOrderRef(n: number | null | undefined) { return n ? `B-${n}` : ""; }
export function priceFromText(price: number | string | null | undefined): string {
  if (price == null || price === "") return "Sem bilhetes";
  return Number(price) === 0 ? "Grátis" : `Desde ${formatPrice(Number(price))}`;
}
export function ticketsLeftText(n: number): string {
  return n <= 0 ? "Esgotado" : n <= 10 ? `Últimos ${n} bilhete${n === 1 ? "" : "s"}` : `${n} bilhetes disponíveis`;
}
export function eventShareMessage(siteUrl: string, e: { id: string; title: string; starts_at: string; venue: string }, priceFrom?: number | null): string {
  return `🎟️ ${e.title}\n📅 ${formatEventDate(e.starts_at)}\n📍 ${e.venue}${priceFrom != null ? "\n💰 " + priceFromText(priceFrom) : ""}\n👉 ${siteUrl.replace(/\/$/, "")}/eventos/${e.id}`;
}
export function normalizeTicketCode(code: string): string {
  let c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.startsWith("HO")) c = c.slice(2);
  return c.length === 8 ? `HO-${c.slice(0, 4)}-${c.slice(4)}` : code.trim().toUpperCase();
}
/** Quadradinhos do QR (true = preto). */
export function qrMatrix(text: string): boolean[][] {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}
/** Caminho SVG do QR (1 unidade por quadradinho). */
export function qrSvgPath(text: string): { size: number; d: string } {
  const m = qrMatrix(text); let d = "";
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c} ${r}h1v1h-1z`; }));
  return { size: m.length, d };
}

// --- Validação --------------------------------------------------------------------------------
export type EventInput = {
  title: string; description?: string; category: EventCategory; startsAt: string; endsAt?: string; venue: string; municipalityId?: string;
  directions?: string; point?: GeoPoint | null; coverUrl?: string | null; pay: EventPaymentInfo; tickets: TicketTypeDraft[];
};
export function validateEvent(i: EventInput, now = Date.now()): string | null {
  if (i.title.trim().length < 4) return "Escreva o nome do evento.";
  const s = localInputToIso(i.startsAt);
  if (!s) return "Escolha o dia e a hora do início.";
  if (Date.parse(s) < now) return "O evento tem de ser no futuro.";
  if (i.endsAt) { const e = localInputToIso(i.endsAt); if (!e || Date.parse(e) <= Date.parse(s)) return "O fim tem de ser depois do início."; }
  if (i.venue.trim().length < 2) return "Escreva o local (ex.: Cine Ruacaná).";
  if (!i.tickets.length) return "Junte pelo menos um tipo de bilhete (pode ser grátis).";
  for (const [k, t] of i.tickets.entries()) {
    if (t.name.trim().length < 2) return `Bilhete ${k + 1}: escreva o nome (ex.: Normal, VIP).`;
    const p = Number(t.price.replace(/\s/g, "").replace(",", "."));
    if (!(p >= 0)) return `Bilhete ${k + 1}: preço inválido (0 = grátis).`;
    const q = Number(t.quantity);
    if (!Number.isInteger(q) || q < 1) return `Bilhete ${k + 1}: indique quantos bilhetes há.`;
  }
  const paid = i.tickets.some(t => Number(t.price.replace(/\s/g, "").replace(",", ".")) > 0);
  if (paid && !i.pay.iban.trim() && !i.pay.express.trim()) return "Indique o IBAN ou o número Multicaixa Express para receber o dinheiro dos bilhetes.";
  if (paid && i.pay.holder.trim().length < 3) return "Indique o nome do titular da conta.";
  return null;
}

// --- Servidor ---------------------------------------------------------------------------------
const num = (v: unknown) => Number(v) || 0;
export async function listEvents(client: SupabaseClient, f: { category?: EventCategory | ""; municipalityId?: string; query?: string; limit?: number } = {}) {
  const r = await client.rpc("list_events", { p_category: f.category || null, p_municipality: f.municipalityId || null, p_query: f.query?.trim() || null, p_limit: f.limit ?? 60 });
  return { data: ((r.data ?? []) as EventSummary[]).map(e => ({ ...e, price_from: e.price_from == null ? null : num(e.price_from), tickets_left: num(e.tickets_left) })), error: r.error };
}
export async function getEvent(client: SupabaseClient, id: string) {
  const r = await client.from("events").select("id,ref_no,organizer_id,title,description,category,starts_at,ends_at,venue,municipality_id,directions,geo_lat,geo_lng,cover_url,status,cancel_reason,featured_until,created_at,municipalities(name)").eq("id", id).maybeSingle();
  return { data: (r.data ?? null) as EventRow | null, error: r.error };
}
export async function getEventTickets(client: SupabaseClient, eventId: string) {
  const r = await client.rpc("event_ticket_availability", { p_event_id: eventId });
  return { data: ((r.data ?? []) as TicketTypeAvailability[]).map(t => ({ ...t, price: num(t.price) })), error: r.error };
}
export async function listMyEvents(client: SupabaseClient, organizerId: string) {
  const r = await client.from("events").select("id,ref_no,title,category,starts_at,ends_at,venue,status,featured_until,cover_url").eq("organizer_id", organizerId).order("starts_at", { ascending: false });
  return { data: (r.data ?? []) as Pick<EventRow, "id" | "ref_no" | "title" | "category" | "starts_at" | "ends_at" | "venue" | "status" | "featured_until" | "cover_url">[], error: r.error };
}
export async function getEventPaymentInfo(client: SupabaseClient, eventId: string): Promise<EventPaymentInfo> {
  const r = await client.from("event_payment_info").select("holder,iban,express,note").eq("event_id", eventId).maybeSingle();
  const d = r.data as Partial<EventPaymentInfo> | null;
  return { holder: d?.holder ?? "", iban: d?.iban ?? "", express: d?.express ?? "", note: d?.note ?? "" };
}
/** Grava o evento (como rascunho ou mantém o estado), os dados de pagamento e os tipos de bilhete. */
export async function saveEvent(client: SupabaseClient, organizerId: string, i: EventInput, id?: string, existingTypes: { id: string }[] = []) {
  const bad = validateEvent(i);
  if (bad) return { data: null, error: new Error(bad) };
  const pc = placeColumns(i.directions, i.point);
  const row = { title: i.title.trim(), description: i.description?.trim() || null, category: i.category, starts_at: localInputToIso(i.startsAt),
    ends_at: i.endsAt ? localInputToIso(i.endsAt) : null, venue: i.venue.trim(), municipality_id: i.municipalityId || null,
    directions: pc.directions, geo_lat: pc.geo_lat, geo_lng: pc.geo_lng, cover_url: i.coverUrl || null };
  const ev = id ? await client.from("events").update(row).eq("id", id).select("id").single() : await client.from("events").insert({ ...row, organizer_id: organizerId }).select("id").single();
  if (ev.error || !ev.data) return { data: null, error: ev.error };
  const eventId = (ev.data as { id: string }).id;
  const pay = await client.from("event_payment_info").upsert({ event_id: eventId, holder: i.pay.holder.trim() || null, iban: i.pay.iban.replace(/\s/g, "") || null,
    express: i.pay.express.replace(/\s/g, "") || null, note: i.pay.note.trim() || null, updated_at: new Date().toISOString() });
  if (pay.error) return { data: { id: eventId }, error: pay.error };
  for (const [k, t] of i.tickets.entries()) {
    const tr = { name: t.name.trim(), price: Number(t.price.replace(/\s/g, "").replace(",", ".")), quantity: Number(t.quantity), max_per_order: Number(t.max_per_order || 10), active: t.active ?? true, sort: k };
    const res = t.id ? await client.from("event_ticket_types").update(tr).eq("id", t.id) : await client.from("event_ticket_types").insert({ ...tr, event_id: eventId });
    if (res.error) return { data: { id: eventId }, error: res.error };
  }
  // Tipos tirados do formulário: apaga (se ainda não tiverem vendas) ou desativa.
  for (const old of existingTypes.filter(o => !i.tickets.some(t => t.id === o.id))) {
    const del = await client.from("event_ticket_types").delete().eq("id", old.id);
    if (del.error) await client.from("event_ticket_types").update({ active: false }).eq("id", old.id);
  }
  return { data: { id: eventId }, error: null };
}
export function setEventPublished(client: SupabaseClient, id: string, publish: boolean) {
  return client.from("events").update({ status: publish ? "published" : "draft" }).eq("id", id).select("id,status").single();
}
export function cancelEvent(client: SupabaseClient, id: string, reason: string) {
  if (!reason.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo do cancelamento.") });
  return client.rpc("cancel_event", { p_event_id: id, p_reason: reason.trim() });
}
export function reserveTickets(client: SupabaseClient, ticketTypeId: string, quantity: number, name: string, phone?: string) {
  if (!(quantity >= 1)) return Promise.resolve({ data: null, error: new Error("Escolha quantos bilhetes quer.") });
  if (name.trim().length < 2) return Promise.resolve({ data: null, error: new Error("Escreva o seu nome (aparece no bilhete).") });
  return client.rpc("reserve_event_tickets", { p_ticket_type_id: ticketTypeId, p_quantity: quantity, p_name: name.trim(), p_phone: phone?.trim() || null });
}
export function submitTicketPayment(client: SupabaseClient, orderId: string, method: PaymentMethodPlan, reference: string) {
  if (reference.trim().length < 3) return Promise.resolve({ data: null, error: new Error("Escreva a referência ou o número da operação.") });
  return client.rpc("submit_event_ticket_payment", { p_order_id: orderId, p_method: method, p_reference: reference.trim() });
}
export function decideTicketOrder(client: SupabaseClient, orderId: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (ex.: não recebi o dinheiro).") });
  return client.rpc("decide_event_ticket_order", { p_order_id: orderId, p_confirm: confirm, p_note: note?.trim() || null });
}
export function cancelTicketOrder(client: SupabaseClient, orderId: string) { return client.rpc("cancel_event_ticket_order", { p_order_id: orderId }); }
export async function checkInTicket(client: SupabaseClient, eventId: string, code: string) {
  const r = await client.rpc("check_in_event_ticket", { p_event_id: eventId, p_code: code });
  return { data: (r.data ?? null) as CheckInResult | null, error: r.error };
}
export async function myTicketOrders(client: SupabaseClient) {
  const r = await client.rpc("my_event_tickets");
  return { data: ((r.data ?? []) as MyTicketOrder[]).map(o => ({ ...o, total: num(o.total), unit_price: num(o.unit_price) })), error: r.error };
}
export async function organizerPanel(client: SupabaseClient, eventId: string) {
  const r = await client.rpc("organizer_event_panel", { p_event_id: eventId });
  return { data: (r.data ?? null) as OrganizerPanel | null, error: r.error };
}
export function submitEventPlatformPayment(client: SupabaseClient, eventId: string, kind: "fee" | "boost", i: { method: PaymentMethodPlan; reference?: string; proofPath?: string | null }) {
  if (!i.reference?.trim() && !i.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("submit_event_platform_payment", { p_event_id: eventId, p_kind: kind, p_method: i.method, p_reference: i.reference?.trim() || null, p_proof_path: i.proofPath || null });
}
export async function listEventPaymentsForAdmin(client: SupabaseClient, status: "pending" | "confirmed" | "rejected" | "" = "pending") {
  const r = await client.rpc("admin_list_event_payments", { p_status: status || null });
  return { data: (r.data ?? []) as AdminEventPayment[], error: r.error };
}
export function decideEventPayment(client: SupabaseClient, id: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo.") });
  return client.rpc("admin_decide_event_payment", { p_payment_id: id, p_confirm: confirm, p_note: note?.trim() || null });
}
