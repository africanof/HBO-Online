import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Morada por ponto de referência (igual no Site e na APP): «Como chegar» em texto + um ponto no mapa.
 * Muitas ruas não têm nome nem número, por isso o ponto de referência e o GPS ajudam quem compra e o estafeta.
 */
export type GeoPoint = { lat: number; lng: number };
export const DIRECTIONS_MAX = 300;
export const DIRECTIONS_PLACEHOLDER = "Ex.: atrás da igreja católica, portão azul, perto da cantina do Sr. João";
/** Angola (com margem). */
export const ANGOLA_BOUNDS = { minLat: -18.1, maxLat: -4.3, minLng: 11.6, maxLng: 24.2 };

export function isInAngola(p: GeoPoint | null | undefined): boolean {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= ANGOLA_BOUNDS.minLat && p.lat <= ANGOLA_BOUNDS.maxLat && p.lng >= ANGOLA_BOUNDS.minLng && p.lng <= ANGOLA_BOUNDS.maxLng;
}
/** Ponto guardado (colunas numéricas, podem vir como texto). */
export function pointFrom(lat: unknown, lng: unknown): GeoPoint | null {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const p = { lat: Number(lat), lng: Number(lng) };
  return isInAngola(p) ? p : null;
}
/** Arredonda (3 casas ≈ 100 m; 5 casas ≈ 1 m). */
export function roundPoint(p: GeoPoint, decimals = 5): GeoPoint {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}
/**
 * Lê coordenadas coladas: «-12.7765, 15.7398», «-12,7765 15,7398» ou uma ligação do Google Maps
 * («…/@-12.7765,15.7398,17z», «…?q=-12.7765,15.7398»).
 */
export function parseGeoInput(text: string | null | undefined): GeoPoint | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const at = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(t) ?? /[?&](?:q|query|ll)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i.exec(t);
  const m = at ?? /^(-?\d{1,2}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)$/.exec(t);
  if (!m) return null;
  const p = { lat: Number(m[1].replace(",", ".")), lng: Number(m[2].replace(",", ".")) };
  return isInAngola(p) ? roundPoint(p, 6) : null;
}
export function formatPoint(p: GeoPoint): string { return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`; }
/** Abre no Google Maps (no telemóvel abre a app de mapas). */
export function mapsUrl(p: GeoPoint): string { return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`; }
/** Mapa pequeno do OpenStreetMap para mostrar dentro da página (só quando a pessoa pede). */
export function osmEmbedUrl(p: GeoPoint, zoomDelta = 0.006): string {
  const b = [p.lng - zoomDelta, p.lat - zoomDelta, p.lng + zoomDelta, p.lat + zoomDelta].map(n => n.toFixed(5)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${b}&layer=mapnik&marker=${p.lat}%2C${p.lng}`;
}
export function validateDirections(text: string | null | undefined): string | null {
  return (text ?? "").trim().length > DIRECTIONS_MAX ? `«Como chegar» pode ter no máximo ${DIRECTIONS_MAX} letras.` : null;
}
/** Colunas para gravar (anúncios, empresas, profissionais). */
export function placeColumns(directions: string | null | undefined, point: GeoPoint | null | undefined) {
  const p = point && isInAngola(point) ? roundPoint(point, 6) : null;
  return { directions: (directions ?? "").trim().slice(0, DIRECTIONS_MAX) || null, geo_lat: p?.lat ?? null, geo_lng: p?.lng ?? null };
}
/** Mensagens para os erros do GPS (navegador ou telemóvel). */
export function geoErrorMessage(code: "denied" | "unavailable" | "timeout" | "outside"): string {
  return code === "denied" ? "Autorize a localização para marcar o ponto (ou cole as coordenadas do Google Maps)."
    : code === "outside" ? "O ponto tem de ser em Angola."
    : code === "timeout" ? "O GPS demorou demasiado. Tente outra vez num lugar aberto."
    : "Não foi possível saber a localização. Ligue o GPS e tente outra vez.";
}

// --- Servidor ---------------------------------------------------------------------------------
export function setOrderDeliveryPoint(client: SupabaseClient, orderId: string, point: GeoPoint | null) {
  if (point && !isInAngola(point)) return Promise.resolve({ data: null, error: new Error(geoErrorMessage("outside")) });
  return client.rpc("set_order_delivery_point", { p_order_id: orderId, p_lat: point?.lat ?? null, p_lng: point?.lng ?? null });
}
export async function getOrderDeliveryPoint(client: SupabaseClient, orderId: string): Promise<GeoPoint | null> {
  const r = await client.rpc("order_delivery_point", { p_order_id: orderId });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return row ? pointFrom(row.lat, row.lng) : null;
}
/** Mensagem quando o texto colado não deu um ponto (null se ainda não parece coordenadas). */
export function geoInputProblem(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t || parseGeoInput(t)) return null;
  if (/-?\d{1,3}[.,]\d+\D+-?\d{1,3}[.,]\d+/.test(t)) {
    const nums = (t.match(/-?\d{1,3}[.,]\d+/g) ?? []).map(n => Number(n.replace(",", ".")));
    return nums.length >= 2 && Number.isFinite(nums[0]) && Number.isFinite(nums[1]) ? geoErrorMessage("outside") : "Não percebi as coordenadas. Copie do Google Maps (ex.: -12.7765, 15.7398).";
  }
  return t.length > 8 && /\d/.test(t) ? "Não percebi as coordenadas. Copie do Google Maps (ex.: -12.7765, 15.7398)." : null;
}
