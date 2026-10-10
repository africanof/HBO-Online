import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadClassifiedMedia } from "./classified-listings";

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
export function shareMessage(siteUrl: string, kind: SavedKind, id: string, title: string) {
  const base = siteUrl.replace(/\/$/, "");
  const url = base ? base + itemHref(kind, id) : "";
  return { url, text: url ? `${title} — Huambo Online\n${url}` : `${title} — Huambo Online` };
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
