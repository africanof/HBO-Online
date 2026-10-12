import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Portfólio de profissionais e empresas (igual no Site e na APP): trabalhos já feitos, com fotografias,
 * título, descrição e data. As fotografias ficam na pasta do dono no bucket público classified-media.
 */
export type PortfolioTarget = { providerId: string } | { businessId: string };
export type PortfolioItem = { id: string; owner_id: string; provider_id: string | null; business_id: string | null; title: string; description: string | null;
  photos: string[]; done_on: string | null; position: number; created_at: string };
export type PortfolioInput = { title: string; description?: string; photos: string[]; doneOn?: string | null };

export const PORTFOLIO_MAX_ITEMS = 40;
export const PORTFOLIO_MAX_PHOTOS = 8;
const COLUMNS = "id,owner_id,provider_id,business_id,title,description,photos,done_on,position,created_at";

export function validatePortfolioItem(input: PortfolioInput, today = new Date()): string | null {
  const t = input.title.trim();
  if (t.length < 2) return "Dê um título ao trabalho (ex.: «Casa de banho remodelada»).";
  if (t.length > 120) return "O título é demasiado longo (máximo 120 letras).";
  if ((input.description?.trim().length ?? 0) > 1000) return "A descrição é demasiado longa (máximo 1000 letras).";
  if (!input.photos.length) return "Junte pelo menos uma fotografia do trabalho.";
  if (input.photos.length > PORTFOLIO_MAX_PHOTOS) return `Pode juntar no máximo ${PORTFOLIO_MAX_PHOTOS} fotografias por trabalho.`;
  if (input.doneOn) {
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(input.doneOn)) return "Data inválida.";
    if (portfolioDate(input.doneOn) > today.toISOString().slice(0, 10)) return "A data do trabalho não pode ser no futuro.";
  }
  return null;
}
/** "2026-09" → "2026-09-01" (o mês chega para um portfólio). */
export function portfolioDate(v: string): string { return v.length === 7 ? v + "-01" : v; }
/** "09/2026" → "2026-09" */
export function toIsoMonth(v: string): string | null {
  const m = /^\s*(\d{1,2})\s*[/.-]\s*(\d{4})\s*$/.exec(v);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return null;
  return `${m[2]}-${m[1].padStart(2, "0")}`;
}
/** "set. 2026" */
export function portfolioDateLabel(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(d ?? "");
  if (!m) return "";
  return ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."][Number(m[2]) - 1] + " " + m[1];
}
const targetFilter = (t: PortfolioTarget) => "providerId" in t ? ["provider_id", t.providerId] as const : ["business_id", t.businessId] as const;

export async function listPortfolio(client: SupabaseClient, target: PortfolioTarget) {
  const [col, id] = targetFilter(target);
  const r = await client.from("portfolio_items").select(COLUMNS).eq(col, id).order("position").order("done_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  return { data: (r.data ?? []) as PortfolioItem[], error: r.error };
}
export async function savePortfolioItem(client: SupabaseClient, ownerId: string, target: PortfolioTarget, input: PortfolioInput, id?: string) {
  const invalid = validatePortfolioItem(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const row = { title: input.title.trim(), description: input.description?.trim() || null, photos: input.photos, done_on: input.doneOn ? portfolioDate(input.doneOn) : null };
  if (id) return client.from("portfolio_items").update(row).eq("id", id).select(COLUMNS).single();
  const [col, tid] = targetFilter(target);
  return client.from("portfolio_items").insert({ ...row, owner_id: ownerId, [col]: tid }).select(COLUMNS).single();
}
export async function deletePortfolioItem(client: SupabaseClient, id: string) { return client.from("portfolio_items").delete().eq("id", id); }
/** Mudar a ordem: o primeiro da lista aparece primeiro no perfil. */
export async function reorderPortfolio(client: SupabaseClient, ids: string[]) {
  const results = await Promise.all(ids.map((id, i) => client.from("portfolio_items").update({ position: i }).eq("id", id)));
  return { error: results.find(r => r.error)?.error ?? null };
}
export function movePortfolio<T extends { id: string }>(items: T[], id: string, dir: -1 | 1): T[] {
  const i = items.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const out = [...items]; [out[i], out[j]] = [out[j], out[i]]; return out;
}

// --- Fotografia do perfil, logótipo e produtos da empresa -------------------------------------
export function setProviderPhoto(client: SupabaseClient, userId: string, url: string | null) {
  return client.from("provider_profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("user_id", userId);
}
export function setBusinessLogo(client: SupabaseClient, businessId: string, url: string | null) {
  return client.from("businesses").update({ logo_url: url, updated_at: new Date().toISOString() }).eq("id", businessId);
}
/** Produtos ativos de uma empresa na Loja. */
export async function listBusinessProducts(client: SupabaseClient, ownerId: string, businessId: string) {
  const r = await client.rpc("product_catalog", { p_query: "", p_category_id: null, p_municipality_id: null, p_seller_id: ownerId, p_limit: 100 });
  return { data: ((r.data ?? []) as { business_id: string | null }[]).filter(p => p.business_id === businessId) as any[], error: r.error };
}
