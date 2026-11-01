import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadClassifiedMedia, formatPrice } from "./classified-listings";

/** Favoritos, histórico, partilha e fotografia de perfil — iguais no Site e na APP. */

export type SavedKind = "listing" | "provider" | "business" | "product";
export const SAVED_KIND_LABELS: Record<SavedKind, string> = { listing: "Anúncios", provider: "Profissionais", business: "Empresas", product: "Produtos" };
const COLUMN: Record<SavedKind, string> = { listing: "classified_listing_id", provider: "provider_id", business: "business_id", product: "product_id" };

/** Caminho da página de cada tipo (igual no Site e na APP). */
export function itemHref(kind: SavedKind, id: string): string {
  return { listing: "/classificados/", provider: "/profissionais/", business: "/empresas/", product: "/loja/" }[kind] + id;
}

export async function findSaved(client: SupabaseClient, userId: string, kind: SavedKind, targetId: string) {
  return client.from("saved_items").select("id").eq("user_id", userId).eq(COLUMN[kind], targetId).maybeSingle();
}
/** Guarda ou remove dos favoritos. Devolve o novo id (ou null se removido). */
export async function toggleSaved(client: SupabaseClient, userId: string, kind: SavedKind, targetId: string, savedId: string | null) {
  if (savedId) {
    const r = await client.from("saved_items").delete().eq("id", savedId);
    return { data: null as string | null, error: r.error };
  }
  const r = await client.from("saved_items").insert({ user_id: userId, [COLUMN[kind]]: targetId }).select("id").single();
  return { data: (r.data as any)?.id ?? null, error: r.error };
}
export async function listMySaved(client: SupabaseClient) { return client.rpc("my_saved_items"); }

// Histórico (fica só no aparelho)
export type HistoryEntry = { kind: SavedKind; id: string; title: string; image?: string | null; at: number };
export type KeyValueStore = { getItem(key: string): Promise<string | null> | string | null; setItem(key: string, value: string): Promise<void> | void };
export const HISTORY_KEY = "huambo:historico";
export const HISTORY_MAX = 30;

export function addToHistory(list: HistoryEntry[], entry: Omit<HistoryEntry, "at">, now = Date.now()): HistoryEntry[] {
  const rest = list.filter(e => !(e.kind === entry.kind && e.id === entry.id));
  return [{ ...entry, at: now }, ...rest].slice(0, HISTORY_MAX);
}
export async function loadHistory(store: KeyValueStore): Promise<HistoryEntry[]> {
  try {
    const raw = await store.getItem(HISTORY_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter(e => e && typeof e.id === "string" && typeof e.kind === "string") : [];
  } catch { return []; }
}
export async function recordView(store: KeyValueStore, entry: Omit<HistoryEntry, "at">) {
  try { await store.setItem(HISTORY_KEY, JSON.stringify(addToHistory(await loadHistory(store), entry))); } catch { /* histórico é opcional */ }
}
export async function clearHistory(store: KeyValueStore) { try { await store.setItem(HISTORY_KEY, "[]"); } catch { /* opcional */ } }

// Partilha
export type ShareExtra = { price?: number | string | null; currency?: string | null; refCode?: string | null; place?: string | null };
/** Texto para partilhar (WhatsApp, SMS…): título, preço, número do anúncio, local e ligação. */
export function shareMessage(siteUrl: string, kind: SavedKind, id: string, title: string, extra: ShareExtra = {}) {
  const base = siteUrl.replace(/\/$/, "");
  const url = base ? base + itemHref(kind, id) : "";
  const price = extra.price != null && Number(extra.price) > 0 ? formatPrice(extra.price, extra.currency ?? "AOA") : "";
  const details = [price && "💰 " + price, extra.refCode, extra.place && "📍 " + extra.place].filter(Boolean).join(" · ");
  const lines = [`${title} — Huambo Online`, details, url && "👉 " + url].filter(Boolean);
  return { url, text: lines.join("\n") };
}
/** Abre o WhatsApp para escolher a quem enviar. */
export function whatsappShareUrl(text: string): string { return "https://wa.me/?text=" + encodeURIComponent(text); }
/** Mensagem pronta para escrever ao vendedor pelo WhatsApp. */
export function sellerWhatsappMessage(kind: "listing" | "product", title: string, refCode?: string | null, url?: string | null): string {
  const what = kind === "product" ? "o seu produto" : "o seu anúncio";
  return `Olá! Vi ${what} «${title}»${refCode ? ` (${refCode})` : ""} no Huambo Online e tenho interesse.${url ? "\n" + url : ""}`;
}
/** Número de WhatsApp em formato internacional sem «+» (Angola: 244 + 9 algarismos), ou null. Igual ao servidor. */
export function normalizeWhatsapp(input: string | null | undefined): string | null {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^9\d{8}$/.test(d)) return "244" + d;
  if (/^2449\d{8}$/.test(d)) return d;
  if (d.startsWith("244")) return null;
  return /^[1-9]\d{9,14}$/.test(d) ? d : null;
}
/** «244923000000» → «+244 923 000 000». */
export function formatWhatsapp(n: string | null | undefined): string {
  const d = (n ?? "").replace(/\D/g, "");
  return d.startsWith("244") && d.length === 12 ? `+244 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : d ? "+" + d : "";
}
export async function getMyWhatsapp(client: SupabaseClient, userId: string) {
  const r = await client.from("profiles").select("whatsapp,whatsapp_public").eq("id", userId).maybeSingle();
  return { data: (r.data ?? null) as { whatsapp: string | null; whatsapp_public: boolean } | null, error: r.error };
}
export function setMyWhatsapp(client: SupabaseClient, number: string, visible: boolean) {
  if (number.trim() && !normalizeWhatsapp(number)) return Promise.resolve({ data: null, error: new Error("INVALID_WHATSAPP") });
  return client.rpc("set_my_whatsapp", { p_number: number.trim() || null, p_public: visible });
}
/** Número de WhatsApp de uma conta: só a equipa (administradores e moderadores) o recebe. */
export async function getSellerWhatsapp(client: SupabaseClient, userId: string): Promise<string | null> {
  const r = await client.rpc("seller_whatsapp", { p_user_id: userId });
  return typeof r.data === "string" && r.data ? r.data : null;
}

// WhatsApp da equipa: o botão «💬 WhatsApp» do Site e da APP abre sempre a conversa com a
// administração (intermediária), nunca com o vendedor.
/** Número oficial de WhatsApp da equipa (público), ou null se ainda não foi definido. */
export async function getTeamWhatsapp(client: SupabaseClient): Promise<string | null> {
  const r = await client.from("platform_settings").select("team_whatsapp").eq("id", 1).maybeSingle();
  const n = (r.data as { team_whatsapp?: string | null } | null)?.team_whatsapp;
  return typeof n === "string" && n ? n : null;
}
/** Só a equipa: muda o número oficial (vazio apaga). */
export function setTeamWhatsapp(client: SupabaseClient, number: string) {
  if (number.trim() && !normalizeWhatsapp(number)) return Promise.resolve({ data: null, error: new Error("INVALID_WHATSAPP") });
  return client.rpc("admin_set_team_whatsapp", { p_number: number.trim() || null });
}
/** Mensagem para a equipa sobre um anúncio ou produto, com a ligação direta. */
export function teamWhatsappMessage(kind: "listing" | "product", title: string, refCode?: string | null, url?: string | null): string {
  const what = kind === "product" ? "o produto" : "o anúncio";
  return `Olá, equipa Huambo Online! Vi ${what} «${title}»${refCode ? ` (${refCode})` : ""} e gostaria de saber se ainda está disponível.${url ? "\n👉 " + url : ""}`;
}
/** Mensagem para a equipa sobre um pedido feito no Site ou na APP (encomenda, reserva, proposta…). */
export function teamWhatsappRequestMessage(what: string, refNo?: number | null, url?: string | null): string {
  return `Olá, equipa Huambo Online! Fiz um pedido: ${what}${refNo ? ` (n.º ${refNo})` : ""}. Podem ajudar-me a acompanhá-lo?${url ? "\n👉 " + url : ""}`;
}
/** Ligação «https://wa.me/…» para a equipa com a mensagem já escrita, ou null sem número. */
export function teamWhatsappLink(number: string | null | undefined, text: string): string | null {
  const n = normalizeWhatsapp(number);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

// Fotografia de perfil
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export async function uploadAvatar(client: SupabaseClient, userId: string, file: Blob | ArrayBuffer, filename: string, contentType: string) {
  const up = await uploadClassifiedMedia(client, file, userId, filename, contentType, "avatars");
  if (up.error || !up.data) return { data: null, error: up.error ?? new Error("Falha no envio da fotografia.") };
  const r = await client.from("profiles").update({ avatar_url: up.data }).eq("id", userId);
  if (r.error) return { data: null, error: r.error };
  return { data: up.data, error: null };
}
