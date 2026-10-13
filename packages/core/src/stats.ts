import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "./engage";

/**
 * Estatísticas para vendedores, lojas, empresas e profissionais (igual no Site e na APP):
 * quantas pessoas viram, guardaram e contactaram. O Supabase só guarda números por dia, nunca quem viu.
 */
export type StatsKind = "listing" | "product" | "business" | "provider";
export type StatsEvent = "view" | "whatsapp" | "call" | "share";
export type ItemStats = {
  kind: StatsKind; item_id: string; title: string; status: string; created_at: string;
  views: number; views_total: number; whatsapp: number; calls: number; shares: number;
  saves: number; messages: number; offers: number; orders: number; followers: number;
};
export type DayStats = { day: string; views: number; contacts: number };
export type StatsTotals = { views: number; saves: number; contacts: number; messages: number; whatsapp: number; calls: number; offers: number; orders: number; shares: number };

export const STATS_PERIODS = [7, 30, 90] as const;
export const STATS_KIND_LABELS: Record<StatsKind, string> = { listing: "Anúncio", product: "Produto", business: "Empresa", provider: "Perfil profissional" };
export const STATS_VIEWS_KEY = "huambo:vistas-contadas";
const STATS_KINDS: StatsKind[] = ["listing", "product", "business", "provider"];

export function isStatsKind(k: string): k is StatsKind { return (STATS_KINDS as string[]).includes(k); }
export function statsItemHref(kind: StatsKind, id: string): string {
  return kind === "listing" ? `/classificados/${id}` : kind === "product" ? `/loja/${id}` : kind === "business" ? `/empresas/${id}` : `/profissionais/${id}`;
}
/** Dia de hoje em Angola (AAAA-MM-DD). */
export function angolaDay(now = Date.now()): string { return new Date(now + 3600000).toISOString().slice(0, 10); }

/** Contactos = mensagens + WhatsApp + chamadas + propostas + encomendas/pedidos. */
export function contactsOf(s: Pick<ItemStats, "messages" | "whatsapp" | "calls" | "offers" | "orders">): number {
  return (s.messages || 0) + (s.whatsapp || 0) + (s.calls || 0) + (s.offers || 0) + (s.orders || 0);
}
export function statsTotals(items: ItemStats[]): StatsTotals {
  const t: StatsTotals = { views: 0, saves: 0, contacts: 0, messages: 0, whatsapp: 0, calls: 0, offers: 0, orders: 0, shares: 0 };
  for (const s of items) {
    t.views += s.views; t.saves += s.saves; t.messages += s.messages; t.whatsapp += s.whatsapp; t.calls += s.calls;
    t.offers += s.offers; t.orders += s.orders; t.shares += s.shares; t.contacts += contactsOf(s);
  }
  return t;
}
/** «3 em cada 100 pessoas que viram contactaram» — null se ainda não há vistas suficientes. */
export function contactRateText(views: number, contacts: number): string | null {
  if (views < 10) return null;
  const pct = Math.round((contacts / views) * 100);
  return `${Math.min(pct, 100)} em cada 100 pessoas que viram entraram em contacto.`;
}
export function periodLabel(days: number): string { return days === 7 ? "Últimos 7 dias" : days === 30 ? "Últimos 30 dias" : days === 90 ? "Últimos 3 meses" : `Últimos ${days} dias`; }
export function countLabel(n: number, one: string, many: string): string { return `${n} ${n === 1 ? one : many}`; }

/** Ordena: mais vistos primeiro (empates: mais recentes). */
export function sortStats(items: ItemStats[]): ItemStats[] {
  return [...items].sort((a, b) => b.views - a.views || contactsOf(b) - contactsOf(a) || Date.parse(b.created_at) - Date.parse(a.created_at));
}
/** Alturas das barras (0–100) para o gráfico diário. */
export function barHeights(days: DayStats[]): number[] {
  const max = Math.max(1, ...days.map(d => d.views));
  return days.map(d => Math.round((d.views / max) * 100));
}

/** Conselhos simples a partir dos números. */
export function statsTips(items: ItemStats[], days: number): string[] {
  const tips: string[] = [];
  const live = items.filter(s => s.status === "published" || s.status === "active");
  const ageDays = (s: ItemStats) => (Date.now() - Date.parse(s.created_at)) / 86400000;
  const unseen = live.filter(s => s.views === 0 && ageDays(s) >= 2);
  if (unseen.length) tips.push(`${countLabel(unseen.length, "item ainda não foi visto", "itens ainda não foram vistos")} nos ${periodLabel(days).toLowerCase()}. Partilhe no WhatsApp e ponha boas fotos.`);
  const noContact = live.filter(s => s.views >= 30 && contactsOf(s) === 0);
  if (noContact.length) tips.push(`«${noContact[0].title}» tem muitas vistas mas nenhum contacto. Reveja o preço, as fotos e a descrição.`);
  const top = sortStats(live.filter(s => s.kind === "listing" && s.views >= 20))[0];
  if (top) tips.push(`«${top.title}» é o seu anúncio mais visto. Um «⭐ Destaque» pode trazer ainda mais pessoas.`);
  if (!tips.length && live.length) tips.push("Anúncios com várias fotos, preço claro e município certo recebem mais contactos.");
  return tips;
}

/** Conta uma vista só uma vez por aparelho por dia (poupa dados e não engana os números). */
export async function shouldCountView(store: KeyValueStore, kind: StatsKind, id: string, today = angolaDay()): Promise<boolean> {
  try {
    const raw = await store.getItem(STATS_VIEWS_KEY);
    const seen = raw ? JSON.parse(raw) as { day?: string; ids?: string[] } : {};
    const ids = seen.day === today && Array.isArray(seen.ids) ? seen.ids : [];
    const key = kind + ":" + id;
    if (ids.includes(key)) return false;
    await store.setItem(STATS_VIEWS_KEY, JSON.stringify({ day: today, ids: [...ids, key].slice(-500) }));
    return true;
  } catch { return true; }
}

// --- Servidor ---------------------------------------------------------------------------------
/** Regista uma vista ou um clique (WhatsApp, Ligar, Partilhar). Nunca dá erro a quem está a ver. */
export async function recordItemEvent(client: SupabaseClient, kind: string, id: string, event: StatsEvent) {
  if (!isStatsKind(kind) || !id) return;
  try { await client.rpc("record_item_event", { p_kind: kind, p_id: id, p_event: event }); } catch { /* opcional */ }
}
export async function recordItemView(client: SupabaseClient, store: KeyValueStore, kind: string, id: string) {
  if (!isStatsKind(kind) || !id) return;
  if (await shouldCountView(store, kind, id)) await recordItemEvent(client, kind, id, "view");
}
const num = (v: unknown) => Number(v) || 0;
export async function getMyStats(client: SupabaseClient, days: number) {
  const [items, daily, followers] = await Promise.all([
    client.rpc("my_item_stats", { p_days: days }), client.rpc("my_stats_daily", { p_days: days }), client.rpc("my_follower_count")
  ]);
  const error = items.error ?? daily.error ?? null;
  return {
    error,
    items: ((items.data ?? []) as Record<string, unknown>[]).map(r => ({
      kind: r.kind as StatsKind, item_id: String(r.item_id), title: String(r.title ?? ""), status: String(r.status ?? ""), created_at: String(r.created_at ?? ""),
      views: num(r.views), views_total: num(r.views_total), whatsapp: num(r.whatsapp), calls: num(r.calls), shares: num(r.shares),
      saves: num(r.saves), messages: num(r.messages), offers: num(r.offers), orders: num(r.orders), followers: num(r.followers)
    })) as ItemStats[],
    daily: ((daily.data ?? []) as Record<string, unknown>[]).map(r => ({ day: String(r.day), views: num(r.views), contacts: num(r.contacts) })) as DayStats[],
    followers: num(followers.data)
  };
}
/** «2026-10-13» → «13/10». */
export function shortDay(day: string): string { const [, m, d] = day.split("-"); return d && m ? `${d}/${m}` : day; }
/** «5 mensagens · 1 WhatsApp · 1 proposta» (só o que não é zero). */
export function contactsBreakdown(t: Pick<StatsTotals, "messages" | "whatsapp" | "calls" | "offers" | "orders" | "shares">): string {
  const parts = [
    t.messages && countLabel(t.messages, "mensagem", "mensagens"), t.whatsapp && `${t.whatsapp} WhatsApp`,
    t.calls && countLabel(t.calls, "chamada", "chamadas"), t.offers && countLabel(t.offers, "proposta", "propostas"),
    t.orders && countLabel(t.orders, "encomenda ou pedido", "encomendas e pedidos"), t.shares && countLabel(t.shares, "partilha", "partilhas")
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Ainda sem contactos neste período.";
}
