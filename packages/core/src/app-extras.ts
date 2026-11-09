import type { SupabaseClient } from "@supabase/supabase-js";
import { searchClassifiedListings } from "./classified-search";

/** Extras da APP 0.5.3: mapa, respostas rápidas, «Baixou de preço», erros e uso (para a equipa). */

// Mapa
export type MapKind = "listing" | "business" | "provider" | "fuel" | "event" | "pickup";
export type MapPoint = { kind: MapKind; id: string; title: string; subtitle: string | null; lat: number; lng: number };
export const MAP_KINDS: { value: MapKind; label: string; icon: string; color: string }[] = [
  { value: "listing", label: "Anúncios", icon: "🏷️", color: "#e65100" },
  { value: "business", label: "Empresas", icon: "🏪", color: "#1565c0" },
  { value: "provider", label: "Profissionais", icon: "🧰", color: "#2e7d32" },
  { value: "fuel", label: "Combustível e gás", icon: "⛽", color: "#6a1b9a" },
  { value: "event", label: "Eventos", icon: "🎟️", color: "#c62828" },
  { value: "pickup", label: "Pontos de recolha", icon: "📦", color: "#00897b" }
];
/** Centro do mapa: cidade do Huambo. */
export const MAP_CENTER = { lat: -12.7765, lng: 15.7398, zoom: 13 };
export function mapHref(p: Pick<MapPoint, "kind" | "id">): string {
  if (p.kind === "pickup") return "";
  return { listing: "/classificados/", business: "/empresas/", provider: "/profissionais/", fuel: "/combustivel/", event: "/eventos/" }[p.kind] + p.id;
}
export async function listMapPoints(client: SupabaseClient, kind?: MapKind | "") {
  const r = await client.rpc("map_points", { p_kind: kind || null });
  const rows = ((r.data ?? []) as any[]).filter(x => Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng)))
    .map(x => ({ kind: x.kind, id: x.id, title: String(x.title ?? ""), subtitle: x.subtitle ?? null, lat: Number(x.lat), lng: Number(x.lng) }) as MapPoint);
  return { data: rows, error: r.error };
}
/** Página do mapa (Leaflet + OpenStreetMap), sem chave. Os pontos vão em JSON; o toque num ponto envia o caminho à APP. */
export function mapHtml(points: MapPoint[], center: { lat: number; lng: number; zoom: number } = MAP_CENTER, me?: { lat: number; lng: number } | null): string {
  const colors = Object.fromEntries(MAP_KINDS.map(k => [k.value, k.color]));
  const icons = Object.fromEntries(MAP_KINDS.map(k => [k.value, k.icon]));
  const data = JSON.stringify(points.map(p => ({ k: p.kind, t: p.title, s: p.subtitle, a: p.lat, o: p.lng, h: mapHref(p) }))).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0}.pin{font-size:15px;width:30px;height:30px;line-height:26px;text-align:center;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}.pop b{display:block;font:600 14px sans-serif}.pop span{font:13px sans-serif;color:#555}.pop a{display:inline-block;margin-top:6px;font:600 13px sans-serif;color:#e65100}</style></head>
<body><div id="m"></div><script>
var C=${JSON.stringify(colors)},I=${JSON.stringify(icons)},P=${data};
var m=L.map('m',{zoomControl:false}).setView([${center.lat},${center.lng}],${center.zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function go(h){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(h);return false}return true}
P.forEach(function(p){var i=L.divIcon({className:'',html:'<div class="pin" style="background:'+C[p.k]+'">'+I[p.k]+'</div>',iconSize:[30,30],iconAnchor:[15,15]});
L.marker([p.a,p.o],{icon:i}).addTo(m).bindPopup('<div class="pop"><b>'+esc(p.t)+'</b>'+(p.s?'<span>'+esc(p.s)+'</span><br>':'')+(p.h?'<a href="'+p.h+'" target="_top" onclick="return go(\\''+p.h+'\\')">Ver →</a>':'')+'</div>')});
${me ? `L.circleMarker([${me.lat},${me.lng}],{radius:8,color:'#fff',weight:3,fillColor:'#1e88e5',fillOpacity:1}).addTo(m);` : ""}
</script></body></html>`;
}

// Conversas (as respostas rápidas estão nos textos da APP: qr.b1…qr.s5)
/** Ponto de encontro (≈100 m, 3 casas decimais). O filtro das conversas só deixa passar este formato exato. */
export function meetingPointUrl(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}
export function meetingPointMessage(p: { lat: number; lng: number }, label = "Ponto de encontro"): string {
  return `📍 ${label}: ${meetingPointUrl(p)}`;
}
/** Lê um ponto de encontro de uma mensagem (para mostrar o botão «Abrir no mapa»). */
export function parseMeetingPoint(body: string | null | undefined): { lat: number; lng: number; url: string } | null {
  const m = /^📍 [^\n]{1,40}(https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=(-?\d{1,2}\.\d{3}),(-?\d{1,2}\.\d{3}))$/.exec((body ?? "").trim());
  return m ? { lat: Number(m[2]), lng: Number(m[3]), url: m[1] } : null;
}

// «Baixou de preço»
export function setPriceDropNotifications(client: SupabaseClient, enabled: boolean) {
  return client.rpc("set_price_drop_notifications", { p_enabled: enabled });
}

// Erros da APP
export type AppErrorReport = { message: string; stack?: string | null; screen?: string | null; version?: string | null; platform?: string | null; fatal?: boolean };
/** Limpa a mensagem: tira emails, números de telefone e tokens antes de enviar. */
export function scrubErrorText(text: string | null | undefined, max = 500): string {
  return (text ?? "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s]{7,}\d/g, "[número]")
    .replace(/(eyJ[\w-]{10,}\.[\w-]+\.[\w-]+)|([A-Za-z0-9_-]{32,})/g, "[chave]").slice(0, max);
}
export async function logAppError(client: SupabaseClient, e: AppErrorReport) {
  return client.rpc("log_app_error", { p_message: scrubErrorText(e.message) || "Erro", p_stack: e.stack ? scrubErrorText(e.stack, 4000) : null,
    p_screen: e.screen ?? null, p_version: e.version ?? null, p_platform: e.platform ?? null, p_fatal: !!e.fatal });
}
/** Ecrã sem números de identificação: «/classificados/1a2b…» → «/classificados/[id]». */
export function screenKey(path: string): string {
  const p = ("/" + (path ?? "").split("?")[0].split("#")[0]).replace(/\/+/g, "/");
  return p.split("/").map(s => /^[0-9a-f-]{16,}$/i.test(s) || /^\d+$/.test(s) || /^[A-Z0-9]{6,}$/.test(s) ? "[id]" : s).join("/").replace(/(.)\/$/, "$1").slice(0, 80) || "/";
}
/** Junta as visitas e envia de vez em quando (poupa dados). */
export function createScreenCounter(send: (counts: Record<string, number>) => Promise<unknown>, every = 20) {
  let counts: Record<string, number> = {}; let n = 0;
  async function flush() { if (!n) return; const c = counts; counts = {}; n = 0; try { await send(c); } catch { /* opcional */ } }
  return { add(path: string) { const k = screenKey(path); counts[k] = (counts[k] ?? 0) + 1; n++; if (n >= every) void flush(); }, flush };
}
export function trackAppScreens(client: SupabaseClient, counts: Record<string, number>) { return client.rpc("track_app_screens", { p_counts: counts }); }
export type AppHealth = {
  errors: { fingerprint: string; message: string; stack: string | null; screen: string | null; app_version: string | null; fatal: boolean; total: number; users: number; last_at: string }[];
  screens: { screen: string; views: number }[];
  days: { day: string; views: number; errors: number }[];
};
export async function adminAppHealth(client: SupabaseClient, days = 7) {
  const r = await client.rpc("admin_app_health", { p_days: days });
  return { data: (r.data ?? null) as AppHealth | null, error: r.error };
}

// Pedido de avaliação na Play Store: só depois de correr bem, e no máximo uma vez a cada 120 dias.
export const REVIEW_PROMPT_KEY = "huambo:pedido-avaliacao";
export function shouldAskForReview(lastAskedAt: number | null, goodMoments: number, now = Date.now()): boolean {
  return goodMoments >= 1 && (!lastAskedAt || now - lastAskedAt > 120 * 86400_000);
}

/** «📍 Perto de si»: anúncios do município da conta (igual no Site e na APP). */
export async function nearMeListings(client: SupabaseClient, userId: string, limit = 12): Promise<{ name: string; items: any[] } | null> {
  const p = await client.from("profiles").select("municipality").eq("id", userId).maybeSingle();
  const name = String((p.data as any)?.municipality ?? "").trim(); if (!name) return null;
  const m = await client.from("municipalities").select("id,name").ilike("name", name).limit(1).maybeSingle();
  if (!m.data) return null;
  const r = await searchClassifiedListings(client, { municipalityId: (m.data as any).id, limit });
  return { name: (m.data as any).name, items: (r.data as any[]) ?? [] };
}

// «💳 Pedir pagamento» dentro da conversa (anúncios dos classificados)
export type ChatPaymentCard = {
  offer_id: string; listing_id: string; title: string; photo: string | null; purpose: string; currency: string; amount: number; listing_price: number | null;
  offer_status: "accepted" | "withdrawn" | "declined" | "pending" | "expired"; expires_at: string; is_buyer: boolean; listing_status: string;
  order_id: string | null; order_status: string | null; escrow_status: "awaiting_payment" | "held" | "released" | "refunded" | null;
};
export type ChatPaymentState = "pay" | "waiting_buyer" | "awaiting_payment" | "held" | "released" | "refunded" | "cancelled" | "expired" | "unavailable";
/** O que o cartão mostra (igual no Site e na APP). */
export function chatPaymentState(c: ChatPaymentCard): ChatPaymentState {
  if (c.order_id) {
    if (c.order_status === "cancelled") return "cancelled";
    return (c.escrow_status ?? "awaiting_payment") as ChatPaymentState;
  }
  if (c.offer_status !== "accepted") return "expired";
  if (c.listing_status !== "published") return "unavailable";
  return c.is_buyer ? "pay" : "waiting_buyer";
}
export function requestChatPayment(client: SupabaseClient, conversationId: string, amount: number) {
  return client.rpc("chat_payment_request", { p_conversation_id: conversationId, p_amount: amount });
}
export async function listChatPaymentCards(client: SupabaseClient, conversationId: string): Promise<Record<string, ChatPaymentCard>> {
  const r = await client.rpc("chat_payment_cards", { p_conversation_id: conversationId });
  const out: Record<string, ChatPaymentCard> = {};
  for (const x of (r.data ?? []) as any[]) out[x.offer_id] = { ...x, amount: Number(x.amount), listing_price: x.listing_price == null ? null : Number(x.listing_price) };
  return out;
}
