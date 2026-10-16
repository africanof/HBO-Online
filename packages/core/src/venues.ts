import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";
import { formatEventDate } from "./events";

/**
 * 🏨🍽️🏬 Reservas em estabelecimentos (igual no Site e na APP): hotéis e hospedagem, restaurantes e armazéns (comércio a grosso).
 * O estabelecimento é uma empresa do diretório (com portfólio) aprovada pela administração. Mostra quartos / menu / produtos e se há,
 * recebe reservas e encomendas; o cliente paga no local ou adiantado para as contas do estabelecimento (com comprovativo) e recebe
 * um código e um QR único. Taxa do APP: 5% pagos pelo cliente + 5% pelo estabelecimento, que entrega os 10% à plataforma.
 */
export type VenueKind = "hotel" | "restaurant" | "warehouse";
export type VenueSubtype = "hotel" | "resort" | "hospedaria" | "casa_passagem" | "pensao" | "lodge" | "apartamento"
  | "restaurante" | "snack_bar" | "churrasqueira" | "pastelaria" | "take_away" | "armazem" | "distribuidora" | "cash_carry";
export type VenueOrderKind = "stay" | "table" | "order";
export type VenueMethod = "at_place" | "prepaid";
export type VenueOrderStatus = "reserved" | "awaiting_payment" | "submitted" | "paid" | "completed" | "cancelled" | "expired" | "rejected";
export type VenueStatus = "pending" | "approved" | "suspended";

export const VENUE_KINDS: Record<VenueKind, { label: string; icon: string; slug: string; item: string; items: string; empty: string; subtypes: VenueSubtype[] }> = {
  hotel: { label: "Hotéis e hospedagem", icon: "🏨", slug: "hoteis", item: "Tipo de quarto", items: "Quartos", empty: "Ainda não há quartos.",
    subtypes: ["hotel", "resort", "hospedaria", "casa_passagem", "pensao", "lodge", "apartamento"] },
  restaurant: { label: "Restaurantes", icon: "🍽️", slug: "restaurantes", item: "Prato ou bebida", items: "Menu", empty: "Ainda não há pratos no menu.",
    subtypes: ["restaurante", "snack_bar", "churrasqueira", "pastelaria", "take_away"] },
  warehouse: { label: "Armazéns (comércio a grosso)", icon: "🏬", slug: "armazens", item: "Produto", items: "Produtos", empty: "Ainda não há produtos.",
    subtypes: ["armazem", "distribuidora", "cash_carry"] }
};
export const VENUE_KIND_LIST = Object.keys(VENUE_KINDS) as VenueKind[];
export const VENUE_SUBTYPE_LABELS: Record<VenueSubtype, string> = {
  hotel: "Hotel", resort: "Resort", hospedaria: "Hospedaria", casa_passagem: "Casa de passagem", pensao: "Pensão", lodge: "Lodge", apartamento: "Apartamentos",
  restaurante: "Restaurante", snack_bar: "Snack-bar", churrasqueira: "Churrasqueira", pastelaria: "Pastelaria", take_away: "Take-away",
  armazem: "Armazém", distribuidora: "Distribuidora", cash_carry: "Cash & carry"
};
export const VENUE_ORDER_KIND_LABELS: Record<VenueOrderKind, string> = { stay: "🛏️ Reserva de quarto", table: "🍽️ Reserva de mesa", order: "📦 Encomenda" };
export const VENUE_METHOD_LABELS: Record<VenueMethod, string> = { at_place: "Pagar no local", prepaid: "Pagar já (adiantado, para a conta do estabelecimento)" };
export const VENUE_STATUS_LABELS: Record<VenueStatus, string> = { pending: "⏳ À espera de aprovação", approved: "✅ Aprovado", suspended: "⛔ Suspenso" };
export const VENUE_ORDER_STATUS_LABELS: Record<VenueOrderStatus, string> = {
  reserved: "✅ Reservado — mostre o QR ao chegar", awaiting_payment: "⏳ Falta pagar", submitted: "⏳ Pago — o estabelecimento está a confirmar",
  paid: "✅ Pago — mostre o QR ao chegar", completed: "✔ Concluído", cancelled: "Cancelado", expired: "Caducou", rejected: "❌ Pagamento não confirmado"
};
export const VENUE_COMPLETE_LABELS: Record<string, string> = {
  ok: "✅ Código válido — pode atender", used: "⚠️ Este código JÁ FOI USADO", invalid: "❌ Código não existe neste estabelecimento",
  expired: "❌ Reserva caducada", cancelled: "❌ Pedido cancelado", awaiting_payment: "⏳ Ainda não pagou", submitted: "⏳ Falta confirmar o pagamento", rejected: "❌ Pagamento recusado"
};
export const VENUE_ACTIVE_ORDER: VenueOrderStatus[] = ["reserved", "awaiting_payment", "submitted", "paid"];
export const VENUE_MAX_PHOTOS = 6;

export type VenueFeedRow = {
  id: string; ref_no: number; kind: VenueKind; subtype: VenueSubtype; accepts_reservations: boolean; accepts_prepay: boolean; accepts_pay_at_place: boolean;
  opening_hours: string | null; created_at: string; business_id: string; name: string; description: string | null; logo_url: string | null; phone: string | null;
  whatsapp: string | null; address_text: string | null; verified: boolean; directions: string | null; geo_lat: number | null; geo_lng: number | null;
  municipality_name: string | null; price_from: number | null; photo: string | null; rooms_free: number | null; has_now: boolean;
};
export type VenueItem = {
  id: string; name: string; description: string | null; section: string | null; photos: string[]; price: number; unit: string | null; capacity: number | null;
  qty_total: number | null; min_qty: number; available: boolean; position: number; free: number | null;
};
export type VenueDetail = {
  id: string; ref_no: number; kind: VenueKind; subtype: VenueSubtype; status: VenueStatus; owner_id: string; accepts_reservations: boolean; accepts_pay_at_place: boolean;
  accepts_prepay: boolean; hold_minutes: number; check_in_time: string | null; check_out_time: string | null; opening_hours: string | null; policies: string | null;
  client_fee_pct: number; business_fee_pct: number; from: string; to: string;
  business: { id: string; name: string; description: string | null; logo_url: string | null; phone: string | null; whatsapp: string | null; address_text: string | null;
    verified: boolean; directions: string | null; geo_lat: number | null; geo_lng: number | null; municipality_name: string | null };
  items: VenueItem[];
};
export type VenuePay = { holder: string | null; iban: string | null; express: string | null; note: string | null };
export type MyVenue = {
  id: string; ref_no: number; business_id: string; business_name: string; owner_id: string; kind: VenueKind; subtype: VenueSubtype; accepts_reservations: boolean;
  accepts_pay_at_place: boolean; accepts_prepay: boolean; hold_minutes: number; check_in_time: string | null; check_out_time: string | null;
  opening_hours: string | null; policies: string | null; status: VenueStatus; admin_note: string | null; created_at: string; pay: VenuePay | null;
};
export type VenueLine = { name: string; unit: string | null; qty: number; unit_price?: number; line_total?: number };
type OrderBase = {
  id: string; ref_no: number; kind: VenueOrderKind; status: VenueOrderStatus; method: VenueMethod; guests: number | null; check_in: string | null; check_out: string | null;
  slot_at: string | null; buyer_note: string | null; subtotal: number; total: number; code: string | null; hold_until: string | null; pay_by: string | null;
  pay_method: string | null; reference: string | null; proof_path: string | null; note: string | null; created_at: string; completed_at: string | null; lines: VenueLine[];
};
export type MyVenueOrder = OrderBase & {
  client_fee_pct: number; client_fee: number; qr_token: string | null; venue_id: string; venue_kind: VenueKind; venue_name: string; address_text: string | null;
  directions: string | null; geo_lat: number | null; geo_lng: number | null; phone: string | null;
  pay_holder: string | null; pay_iban: string | null; pay_express: string | null; pay_note: string | null;
};
export type VenueOrder = OrderBase & { client_fee: number; business_fee: number; buyer_name: string; buyer_phone: string | null; qr_token: string };
export type VenuePanel = {
  client_fee_pct: number; business_fee_pct: number; completed_total: number; fee_total: number; fee_due: number; fee_overdue: boolean; fee_pending: boolean;
  orders: VenueOrder[]; payments: { id: string; ref_no: number; amount: number; status: "pending" | "confirmed" | "rejected"; admin_note: string | null; created_at: string }[];
};
export type VenueOrderView = {
  result: "ok" | "invalid"; role?: "venue" | "admin" | "buyer" | "other"; id?: string; ref_no?: number; status?: VenueOrderStatus; kind?: VenueOrderKind;
  method?: VenueMethod; buyer_name?: string; buyer_phone?: string | null; guests?: number | null; check_in?: string | null; check_out?: string | null;
  slot_at?: string | null; buyer_note?: string | null; subtotal?: number; client_fee_pct?: number; client_fee?: number; business_fee?: number; total?: number;
  code?: string | null; hold_until?: string | null; pay_method?: string | null; reference?: string | null; proof_path?: string | null; note?: string | null;
  created_at?: string; completed_at?: string | null; venue_id?: string; venue_name?: string; venue_kind?: VenueKind; lines?: VenueLine[];
};
export type VenueCompleteResult = { result: string; code?: string; kind?: VenueOrderKind; buyer?: string; guests?: number | null; check_in?: string | null;
  check_out?: string | null; slot_at?: string | null; total?: number; method?: VenueMethod; lines?: VenueLine[] };
export type AdminVenue = { id: string; ref_no: number; kind: VenueKind; subtype: VenueSubtype; status: VenueStatus; admin_note: string | null; accepts_prepay: boolean;
  created_at: string; business_id: string; name: string; phone: string | null; address_text: string | null; verified: boolean; owner_name: string; pay: VenuePay | null;
  fee_due: number; fee_overdue: boolean };
export type AdminVenuePayment = { id: string; ref_no: number; venue_id: string; venue_ref: number; venue_name: string; owner_name: string; amount: number;
  method: string; reference: string | null; proof_path: string | null; status: string; admin_note: string | null; created_at: string };
export type AdminVenueOrder = { id: string; ref_no: number; kind: VenueOrderKind; status: VenueOrderStatus; method: VenueMethod; subtotal: number; client_fee: number;
  business_fee: number; total: number; buyer_name: string; buyer_phone: string | null; reference: string | null; proof_path: string | null; qr_token: string;
  note: string | null; created_at: string; venue_id: string; venue_ref: number; venue_name: string };

// --- Textos -----------------------------------------------------------------------------------
export function venueRef(n: number | null | undefined) { return n ? `E-${n}` : ""; }
export function venueOrderRef(n: number | null | undefined) { return n ? `R-${n}` : ""; }
export function venueKindFromSlug(slug: string | null | undefined): VenueKind | null {
  return VENUE_KIND_LIST.find(k => VENUE_KINDS[k].slug === (slug ?? "").trim().toLowerCase()) ?? null;
}
/** Que pedidos cada tipo aceita: hotel → quarto; restaurante → mesa ou encomenda; armazém → encomenda. */
export function venueOrderKinds(kind: VenueKind): VenueOrderKind[] {
  return kind === "hotel" ? ["stay"] : kind === "restaurant" ? ["table", "order"] : ["order"];
}
/** «2 noites», «1 noite». */
export function nightsBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z"), b = Date.parse(to + "T00:00:00Z");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : 0;
}
export function nightsText(n: number): string { return `${n} ${n === 1 ? "noite" : "noites"}`; }
/** «23/10/2026» */
export function dateText(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
/** Dia de hoje em Angola (AAAA-MM-DD) e somar dias. */
export function luandaToday(now = Date.now()): string { return new Date(now + 3600000).toISOString().slice(0, 10); }
export function addDays(d: string, n: number): string { return new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10); }
/** «Data e hora» escolhidas no formulário (hora de Angola) → ISO. */
export function luandaDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const t = Date.parse(`${date}T${time}:00+01:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function venuePriceText(i: Pick<VenueItem, "price" | "unit">, kind: VenueKind): string {
  return `${formatPrice(i.price)} / ${i.unit?.trim() || (kind === "hotel" ? "noite" : kind === "warehouse" ? "unidade" : "prato")}`;
}
function qtyStr(q: number): string { return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/0+$/, "").replace(".", ","); }
/** «Há 3 quartos livres», «🔴 Sem quartos livres», «Há», «Esgotado», «Restam 40 sacos». */
export function venueAvailabilityText(i: Pick<VenueItem, "available" | "free" | "unit">, kind: VenueKind): string {
  if (!i.available) return kind === "hotel" ? "🔴 Sem quartos" : "🔴 Esgotado";
  if (kind === "hotel") {
    const f = Number(i.free ?? 0);
    return f <= 0 ? "🔴 Sem quartos livres nestas datas" : `🟢 ${f === 1 ? "Há 1 quarto livre" : `Há ${f} quartos livres`}`;
  }
  if (i.free == null) return "🟢 Há";
  const f = Number(i.free);
  return f <= 0 ? "🔴 Esgotado" : `🟢 Há ${qtyStr(f)}${i.unit ? " " + i.unit : ""}`;
}
export function venueFeedBadge(r: Pick<VenueFeedRow, "kind" | "has_now" | "rooms_free">): string {
  if (r.kind === "hotel") return r.has_now ? `🟢 ${Number(r.rooms_free) === 1 ? "1 quarto livre hoje" : `${Number(r.rooms_free ?? 0)} quartos livres hoje`}` : "🔴 Sem quartos livres hoje";
  return r.has_now ? "🟢 Aberto a pedidos" : "⚪ Sem produtos disponíveis";
}
export function venueLineText(l: VenueLine): string { return `${qtyStr(Number(l.qty))} × ${l.name}${l.unit ? ` (${l.unit})` : ""}`; }
/** Resumo do pedido numa linha: datas e quartos, mesa e hora, ou produtos e hora de levantar. */
export function venueOrderSummary(o: Pick<OrderBase, "kind" | "guests" | "check_in" | "check_out" | "slot_at" | "lines">): string {
  if (o.kind === "stay") {
    const n = o.check_in && o.check_out ? nightsBetween(o.check_in, o.check_out) : 0;
    return `${o.lines.map(venueLineText).join(", ")} · ${dateText(o.check_in)} → ${dateText(o.check_out)} (${nightsText(n)}) · ${o.guests ?? 1} ${o.guests === 1 ? "pessoa" : "pessoas"}`;
  }
  if (o.kind === "table") return `Mesa para ${o.guests ?? 1} · ${o.slot_at ? formatEventDate(o.slot_at) : ""}${o.lines.length ? " · " + o.lines.map(venueLineText).join(", ") : ""}`;
  return `${o.lines.map(venueLineText).join(", ")}${o.slot_at ? " · levantar " + formatEventDate(o.slot_at) : ""}`;
}
/** Conta igual à da base de dados. Hotel: preço × quartos × noites. Cliente paga subtotal + 5%; o estabelecimento entrega 10% ao APP. */
export function venueFeeBreakdown(lines: { price: number; qty: number }[], clientPct: number, businessPct: number, nights = 1) {
  const subtotal = lines.reduce((s, l) => s + Math.round(Number(l.price) * Number(l.qty) * Math.max(1, nights)), 0);
  const clientFee = Math.round(subtotal * (Number(clientPct) || 0) / 100);
  const businessFee = Math.round(subtotal * (Number(businessPct) || 0) / 100);
  return { subtotal, clientFee, businessFee, total: subtotal + clientFee, platform: clientFee + businessFee, businessGets: subtotal - businessFee };
}
export function venueFeeNotice(clientPct: number | null | undefined): string {
  return `O total inclui ${Number(clientPct) || 0}% de taxa de serviço do Huambo Online. Paga tudo ao estabelecimento (no local ou para a conta do estabelecimento).`;
}
export function venueOwnerFeeNotice(clientPct: number, businessPct: number): string {
  const c = Number(clientPct) || 0, b = Number(businessPct) || 0;
  return `Taxa do Huambo Online: ${c + b}% de cada pedido concluído — ${c}% já vêm pagos pelo cliente (somados ao preço) e ${b}% saem do seu preço. Recebe tudo e entrega os ${c + b}% à plataforma.`;
}
export function venueVerifyUrl(siteUrl: string, token: string): string { return `${siteUrl.replace(/\/+$/, "")}/reservas/v/${token}`; }
export function venueTokenFromText(text: string | null | undefined): string | null {
  const m = /(?:^|\/v\/|[^0-9a-f])([0-9a-f]{32})(?:$|[^0-9a-f])/i.exec((text ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}
export function normalizeVenueCode(code: string): string {
  let c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.startsWith("RV")) c = c.slice(2);
  return c.length === 6 ? `RV-${c}` : code.trim().toUpperCase();
}
export function venueTransferNote(refNo: number): string { return `Escreva no descritivo da transferência: ${venueOrderRef(refNo)}`; }
export function venueShareMessage(siteUrl: string, r: { id: string; name: string; kind: VenueKind; municipality_name?: string | null }): string {
  return `${VENUE_KINDS[r.kind].icon} ${r.name}${r.municipality_name ? ", " + r.municipality_name : ""} — reserve no Huambo Online\n👉 ${siteUrl.replace(/\/$/, "")}/reservas/${r.id}`;
}

// --- Validação --------------------------------------------------------------------------------
export type VenueInput = {
  businessId: string; kind: VenueKind; subtype: VenueSubtype; acceptsReservations: boolean; acceptsPayAtPlace: boolean; acceptsPrepay: boolean; holdMinutes: number;
  checkInTime?: string; checkOutTime?: string; openingHours?: string; policies?: string; pay: { holder: string; iban: string; express: string; note: string };
};
const TIME_RE = /^[0-2]\d:[0-5]\d$/;
export function validateVenue(i: VenueInput): string | null {
  if (!i.businessId) return "Escolha a sua empresa (registe-a primeiro em «Empresas»).";
  if (!VENUE_KINDS[i.kind]?.subtypes.includes(i.subtype)) return "Escolha o tipo de estabelecimento.";
  if (!i.acceptsPayAtPlace && !i.acceptsPrepay) return "Escolha pelo menos uma forma de pagamento (no local ou adiantado).";
  if (!(i.holdMinutes >= 15 && i.holdMinutes <= 1440)) return "O tempo de tolerância tem de ser entre 15 minutos e 24 horas.";
  if (i.checkInTime && !TIME_RE.test(i.checkInTime)) return "Hora de entrada inválida (ex.: 14:00).";
  if (i.checkOutTime && !TIME_RE.test(i.checkOutTime)) return "Hora de saída inválida (ex.: 12:00).";
  if ((i.policies?.trim().length ?? 0) > 600) return "As regras são demasiado longas (máximo 600 letras).";
  if (i.acceptsPrepay && !i.pay.iban.trim() && !i.pay.express.trim()) return "Para receber pagamentos adiantados, indique o IBAN ou o número Multicaixa Express.";
  if (i.acceptsPrepay && i.pay.holder.trim().length < 3) return "Indique o nome do titular da conta.";
  return null;
}
export type VenueItemInput = { name: string; description?: string; section?: string; photos: string[]; price: number; unit?: string; capacity?: number | null;
  qtyTotal?: number | null; minQty?: number; available: boolean };
export function validateVenueItem(kind: VenueKind, i: VenueItemInput): string | null {
  const n = i.name.trim();
  if (n.length < 2) return kind === "hotel" ? "Escreva o tipo de quarto (ex.: «Quarto duplo»)." : "Escreva o nome.";
  if (n.length > 100) return "O nome é demasiado longo.";
  if (!(Number.isFinite(i.price) && i.price >= 0)) return "Indique o preço.";
  if (i.photos.length > VENUE_MAX_PHOTOS) return `Pode juntar no máximo ${VENUE_MAX_PHOTOS} fotografias.`;
  if ((i.description?.trim().length ?? 0) > 600) return "A descrição é demasiado longa.";
  if (kind === "hotel") {
    if (!(Number.isInteger(i.qtyTotal) && (i.qtyTotal as number) >= 0)) return "Quantos quartos deste tipo tem? (número inteiro)";
    if (!(Number.isInteger(i.capacity) && (i.capacity as number) >= 1 && (i.capacity as number) <= 30)) return "Quantas pessoas cabem em cada quarto?";
  }
  if (i.qtyTotal != null && !(i.qtyTotal >= 0)) return "Quantidade inválida.";
  if (i.minQty != null && !(i.minQty > 0)) return "A quantidade mínima tem de ser maior que zero.";
  return null;
}
export type VenueCartLine = { item: Pick<VenueItem, "id" | "name" | "price" | "min_qty" | "free" | "available" | "capacity" | "unit">; qty: number };
export type VenueReserveInput = { kind: VenueOrderKind; method: VenueMethod; name: string; phone?: string; lines: VenueCartLine[]; checkIn?: string; checkOut?: string;
  guests?: number; slotAt?: string | null; note?: string };
export function validateVenueReserve(v: Pick<VenueDetail, "kind" | "accepts_pay_at_place" | "accepts_prepay">, i: VenueReserveInput, today = luandaToday(), now = Date.now()): string | null {
  if (!venueOrderKinds(v.kind).includes(i.kind)) return "Este tipo de pedido não existe aqui.";
  if (i.method === "at_place" && !v.accepts_pay_at_place) return "Este estabelecimento só aceita pagamento adiantado.";
  if (i.method === "prepaid" && !v.accepts_prepay) return "Este estabelecimento não aceita pagamento adiantado.";
  if (i.name.trim().length < 2) return "Escreva o seu nome.";
  for (const l of i.lines) {
    if (!l.item.available) return `«${l.item.name}» já não está disponível.`;
    if (!(l.qty > 0)) return `Indique a quantidade de «${l.item.name}».`;
    if (i.kind !== "stay" && l.qty < Number(l.item.min_qty)) return `«${l.item.name}»: o mínimo é ${qtyStr(Number(l.item.min_qty))}${l.item.unit ? " " + l.item.unit : ""}.`;
    if (l.item.free != null && l.qty > Number(l.item.free)) return i.kind === "stay" ? "Já não há quartos livres suficientes nestas datas." : `«${l.item.name}»: só há ${qtyStr(Number(l.item.free))}.`;
  }
  if (i.kind === "stay") {
    if (i.lines.length !== 1) return "Escolha um tipo de quarto.";
    if (!Number.isInteger(i.lines[0].qty)) return "Indique o número de quartos.";
    if (!i.checkIn || !i.checkOut) return "Escolha as datas de entrada e de saída.";
    if (i.checkIn < today) return "A data de entrada já passou.";
    const n = nightsBetween(i.checkIn, i.checkOut);
    if (n < 1) return "A saída tem de ser depois da entrada.";
    if (n > 60) return "Máximo de 60 noites por reserva.";
    if (!(i.guests && i.guests >= 1)) return "Indique quantas pessoas são.";
    if (i.guests > (i.lines[0].item.capacity ?? 2) * i.lines[0].qty) return "São pessoas a mais para estes quartos. Escolha mais quartos.";
  } else {
    if (i.kind === "order" && !i.lines.length) return "Escolha pelo menos um produto.";
    if (i.kind === "table" && !(i.guests && i.guests >= 1 && i.guests <= 100)) return "Indique para quantas pessoas é a mesa.";
    if (!i.slotAt) return i.kind === "table" ? "Escolha o dia e a hora." : "Escolha o dia e a hora para levantar.";
    if (Date.parse(i.slotAt) < now - 5 * 60000) return "Esse dia e hora já passaram.";
  }
  if (i.method === "prepaid" && !i.lines.length) return "Não há nada a pagar adiantado. Escolha «Pagar no local».";
  return null;
}

// --- Servidor ---------------------------------------------------------------------------------
const num = (v: unknown) => Number(v) || 0;
const numOrNull = (v: unknown) => v == null ? null : Number(v);
const fixLines = (l: VenueLine[] | null | undefined): VenueLine[] => (l ?? []).map(x => ({ ...x, qty: num(x.qty), unit_price: x.unit_price == null ? undefined : num(x.unit_price),
  line_total: x.line_total == null ? undefined : num(x.line_total) }));
const fixItem = (i: VenueItem): VenueItem => ({ ...i, price: num(i.price), qty_total: numOrNull(i.qty_total), min_qty: num(i.min_qty) || 1, free: numOrNull(i.free), photos: i.photos ?? [] });

export async function venueFeed(client: SupabaseClient, kind: VenueKind, f: { municipalityId?: string; query?: string; limit?: number } = {}) {
  const r = await client.rpc("venue_feed", { p_kind: kind, p_municipality_id: f.municipalityId || null, p_query: f.query?.trim() ?? "", p_limit: f.limit ?? 40 });
  return { data: ((r.data ?? []) as VenueFeedRow[]).map(x => ({ ...x, price_from: numOrNull(x.price_from), rooms_free: numOrNull(x.rooms_free) })), error: r.error };
}
export async function venueDetail(client: SupabaseClient, id: string, from?: string, to?: string) {
  const r = await client.rpc("venue_detail", { p_venue_id: id, p_from: from || null, p_to: to || null });
  const d = r.data as VenueDetail | null;
  return { data: d ? { ...d, client_fee_pct: num(d.client_fee_pct), business_fee_pct: num(d.business_fee_pct), items: (d.items ?? []).map(fixItem) } : null, error: r.error };
}
export async function myVenues(client: SupabaseClient) {
  const r = await client.rpc("my_venues");
  return { data: (r.data ?? []) as MyVenue[], error: r.error };
}
/** Regista ou muda o estabelecimento e a conta para pagamentos adiantados. */
export async function saveVenue(client: SupabaseClient, ownerId: string, i: VenueInput, id?: string) {
  const bad = validateVenue(i); if (bad) return { data: null, error: new Error(bad) };
  const row = { kind: i.kind, subtype: i.subtype, accepts_reservations: i.acceptsReservations, accepts_pay_at_place: i.acceptsPayAtPlace, accepts_prepay: i.acceptsPrepay,
    hold_minutes: i.holdMinutes, check_in_time: i.checkInTime?.trim() || null, check_out_time: i.checkOutTime?.trim() || null,
    opening_hours: i.openingHours?.trim() || null, policies: i.policies?.trim() || null };
  const v = id ? await client.from("venues").update(row).eq("id", id).select("id").single()
    : await client.from("venues").insert({ ...row, owner_id: ownerId, business_id: i.businessId }).select("id").single();
  if (v.error || !v.data) return { data: null, error: v.error };
  const venueId = (v.data as { id: string }).id;
  const p = { holder: i.pay.holder.trim() || null, iban: i.pay.iban.replace(/\s/g, "") || null, express: i.pay.express.replace(/\s/g, "") || null, note: i.pay.note.trim() || null };
  if (p.holder || p.iban || p.express || p.note || id) {
    const pay = await client.from("venue_pay").upsert({ venue_id: venueId, ...p, updated_at: new Date().toISOString() });
    if (pay.error) return { data: { id: venueId }, error: pay.error };
  }
  return { data: { id: venueId }, error: null };
}
export async function listVenueItems(client: SupabaseClient, venueId: string) {
  const r = await client.from("venue_items").select("id,name,description,section,photos,price,unit,capacity,qty_total,min_qty,available,position").eq("venue_id", venueId).order("position").order("created_at");
  return { data: ((r.data ?? []) as VenueItem[]).map(i => fixItem({ ...i, free: null })), error: r.error };
}
export async function saveVenueItem(client: SupabaseClient, venueId: string, kind: VenueKind, i: VenueItemInput, id?: string) {
  const bad = validateVenueItem(kind, i); if (bad) return { data: null, error: new Error(bad) };
  const row = { name: i.name.trim(), description: i.description?.trim() || null, section: i.section?.trim() || null, photos: i.photos, price: i.price,
    unit: i.unit?.trim() || null, capacity: kind === "hotel" ? i.capacity ?? 2 : null, qty_total: i.qtyTotal ?? null, min_qty: kind === "warehouse" ? i.minQty ?? 1 : 1,
    available: i.available, updated_at: new Date().toISOString() };
  return id ? client.from("venue_items").update(row).eq("id", id).select("id").single() : client.from("venue_items").insert({ ...row, venue_id: venueId }).select("id").single();
}
/** Marcar rápido «há / não há» (ou mudar a quantidade) sem abrir o formulário. */
export function setVenueItemAvailable(client: SupabaseClient, id: string, available: boolean, qtyTotal?: number | null) {
  return client.from("venue_items").update({ available, ...(qtyTotal !== undefined ? { qty_total: qtyTotal } : {}), updated_at: new Date().toISOString() }).eq("id", id);
}
export async function deleteVenueItem(client: SupabaseClient, id: string) {
  const used = await client.from("venue_order_lines").select("id", { count: "exact", head: true }).eq("item_id", id);
  // Com pedidos antigos não se apaga (o histórico fica): passa a «não disponível».
  if (used.count) return client.from("venue_items").update({ available: false }).eq("id", id);
  return client.from("venue_items").delete().eq("id", id);
}
export function reserveVenue(client: SupabaseClient, venueId: string, i: VenueReserveInput) {
  return client.rpc("reserve_venue", { p_venue_id: venueId, p_kind: i.kind, p_lines: i.lines.map(l => ({ item_id: l.item.id, qty: l.qty })), p_method: i.method,
    p_name: i.name.trim(), p_phone: i.phone?.trim() || null, p_check_in: i.kind === "stay" ? i.checkIn : null, p_check_out: i.kind === "stay" ? i.checkOut : null,
    p_guests: i.guests ?? null, p_slot_at: i.kind === "stay" ? null : i.slotAt ?? null, p_note: i.note?.trim() || null });
}
export function submitVenuePayment(client: SupabaseClient, orderId: string, i: { method: "bank_transfer" | "multicaixa_express"; reference: string; proofPath: string | null; proofHash?: string | null }) {
  if (i.reference.replace(/[^A-Za-z0-9]/g, "").length < 4) return Promise.resolve({ data: null, error: new Error("Escreva a referência ou o número da operação (como está no comprovativo).") });
  if (!i.proofPath) return Promise.resolve({ data: null, error: new Error("Junte a fotografia do comprovativo de pagamento.") });
  return client.rpc("submit_venue_payment", { p_order_id: orderId, p_method: i.method, p_reference: i.reference.trim(), p_proof_path: i.proofPath, p_proof_hash: i.proofHash || null });
}
export function decideVenuePayment(client: SupabaseClient, orderId: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (ex.: não recebi o dinheiro).") });
  return client.rpc("decide_venue_payment", { p_order_id: orderId, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function completeVenueOrder(client: SupabaseClient, venueId: string, code: string) {
  const r = await client.rpc("complete_venue_order", { p_venue_id: venueId, p_code: normalizeVenueCode(code) });
  const d = r.data as VenueCompleteResult | null;
  return { data: d ? { ...d, lines: fixLines(d.lines), total: d.total == null ? undefined : num(d.total) } : null, error: r.error };
}
export function cancelVenueOrder(client: SupabaseClient, orderId: string, reason?: string) {
  return client.rpc("cancel_venue_order", { p_order_id: orderId, p_reason: reason?.trim() || null });
}
export async function venueOrderByToken(client: SupabaseClient, token: string) {
  const r = await client.rpc("venue_order_by_token", { p_token: token });
  const d = r.data as VenueOrderView | null;
  return { data: d ? { ...d, lines: d.lines ? fixLines(d.lines) : undefined, subtotal: d.subtotal == null ? undefined : num(d.subtotal),
    client_fee: d.client_fee == null ? undefined : num(d.client_fee), business_fee: d.business_fee == null ? undefined : num(d.business_fee),
    total: d.total == null ? undefined : num(d.total) } : null, error: r.error };
}
export async function myVenueOrders(client: SupabaseClient) {
  const r = await client.rpc("my_venue_orders");
  return { data: ((r.data ?? []) as MyVenueOrder[]).map(o => ({ ...o, subtotal: num(o.subtotal), client_fee: num(o.client_fee), client_fee_pct: num(o.client_fee_pct),
    total: num(o.total), lines: fixLines(o.lines) })), error: r.error };
}
export async function venuePanel(client: SupabaseClient, venueId: string) {
  const r = await client.rpc("venue_panel", { p_venue_id: venueId });
  const d = r.data as VenuePanel | null;
  return { data: d ? { ...d, client_fee_pct: num(d.client_fee_pct), business_fee_pct: num(d.business_fee_pct), completed_total: num(d.completed_total),
    fee_total: num(d.fee_total), fee_due: num(d.fee_due), payments: d.payments.map(p => ({ ...p, amount: num(p.amount) })),
    orders: d.orders.map(o => ({ ...o, subtotal: num(o.subtotal), client_fee: num(o.client_fee), business_fee: num(o.business_fee), total: num(o.total), lines: fixLines(o.lines) })) } : null,
    error: r.error };
}
export function submitVenueFee(client: SupabaseClient, venueId: string, i: { method: "bank_transfer" | "multicaixa_express" | "cash"; reference?: string; proofPath?: string | null }) {
  if (!i.reference?.trim() && !i.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("submit_venue_fee_payment", { p_venue_id: venueId, p_method: i.method, p_reference: i.reference?.trim() || null, p_proof_path: i.proofPath || null });
}
export async function listVenuesForAdmin(client: SupabaseClient, status: VenueStatus | "" = "pending") {
  const r = await client.rpc("admin_list_venues", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminVenue[]).map(v => ({ ...v, fee_due: num(v.fee_due) })), error: r.error };
}
export function setVenueStatus(client: SupabaseClient, id: string, status: VenueStatus, note?: string) {
  if (status === "suspended" && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (o dono vai ler).") });
  return client.rpc("admin_set_venue_status", { p_venue_id: id, p_status: status, p_note: note?.trim() || null });
}
export async function listVenuePaymentsForAdmin(client: SupabaseClient, status: "pending" | "confirmed" | "rejected" | "" = "pending") {
  const r = await client.rpc("admin_list_venue_payments", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminVenuePayment[]).map(p => ({ ...p, amount: num(p.amount) })), error: r.error };
}
export function decideVenueFee(client: SupabaseClient, id: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo.") });
  return client.rpc("admin_decide_venue_payment", { p_payment_id: id, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function listVenueOrdersForAdmin(client: SupabaseClient, status: VenueOrderStatus | "" = "submitted") {
  const r = await client.rpc("admin_list_venue_orders", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminVenueOrder[]).map(o => ({ ...o, subtotal: num(o.subtotal), client_fee: num(o.client_fee), business_fee: num(o.business_fee), total: num(o.total) })),
    error: r.error };
}
/** Estabelecimento aprovado ligado a uma empresa (para o botão «Reservar» na página da empresa). */
export async function venueForBusiness(client: SupabaseClient, businessId: string) {
  const r = await client.from("venues").select("id,kind,status").eq("business_id", businessId).maybeSingle();
  return { data: (r.data ?? null) as { id: string; kind: VenueKind; status: VenueStatus } | null, error: r.error };
}
