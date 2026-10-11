import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";
import { searchClassifiedListings } from "./classified-search";
import { listProviders, listBusinesses } from "./directory";

/** «Procura-se»: pedidos de compradores (finalidade "wanted") com orçamento de… até… */

/** "20 000 – 25 000 Kz", "até 25 000 Kz", "a partir de 20 000 Kz" ou "Orçamento a combinar". */
export function formatBudget(min: number | string | null | undefined, max: number | string | null | undefined, currency = "AOA"): string {
  const has = (v: unknown) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const lo = has(min) ? Number(min) : null, hi = has(max) ? Number(max) : null;
  if (lo !== null && hi !== null) return lo === hi ? formatPrice(hi, currency) : `${formatPrice(lo, currency).replace(/ (Kz|[A-Z]{3})$/, "")} – ${formatPrice(hi, currency)}`;
  if (hi !== null) return `até ${formatPrice(hi, currency)}`;
  if (lo !== null) return `a partir de ${formatPrice(lo, currency)}`;
  return "Orçamento a combinar";
}

/** Valida o orçamento. Devolve a mensagem de erro ou null. */
export function validateBudget(min: number | undefined, max: number | undefined): string | null {
  if (min !== undefined && (!Number.isFinite(min) || min < 0)) return "Indique um orçamento mínimo válido.";
  if (max !== undefined && (!Number.isFinite(max) || max < 0)) return "Indique um orçamento máximo válido.";
  if (min !== undefined && max !== undefined && min > max) return "O orçamento mínimo não pode ser maior que o máximo.";
  return null;
}

/** Preço do anúncio (para filtros e ordenação): o máximo do orçamento, ou o mínimo. */
export function budgetPrice(min?: number, max?: number): number | undefined { return max ?? min; }

/** Texto do preço num cartão: orçamento para pedidos "Procuro", preço normal para os outros. */
export function listingPriceLabel(x: { purpose?: string; price?: number | string | null; currency?: string; budget_min?: number | string | null; budget_max?: number | string | null }): string {
  if (x.purpose === "wanted") return x.budget_min != null || x.budget_max != null ? formatBudget(x.budget_min, x.budget_max, x.currency) : (x.price != null ? `até ${formatPrice(x.price, x.currency)}` : "Orçamento a combinar");
  return formatPrice(x.price, x.currency);
}

/** Mensagem pronta para o vendedor responder a um pedido. */
export function wantedReplyMessage(title: string, service = false) { return service ? `Olá! Vi o seu pedido «${title}» e posso fazer este serviço. Quando lhe dá jeito?` : `Olá! Vi o seu pedido «${title}» e tenho o que procura. Ainda precisa?`; }

/** Pedidos "Procura-se" publicados (os mais recentes primeiro). */
export async function listWanted(client: SupabaseClient, query = "", limit = 40) {
  return searchClassifiedListings(client, { purpose: "wanted", query, limit });
}

const STOP = new Set(("preciso precisa procuro procura compro comprar quero pago pagar alguem vende vendo venda estado bons boas usado usada novo nova " +
  "urgente urgencia para mais menos como desde entre kwanzas preco barato barata qualquer tipo servico servicos profissional pessoa senhor senhora " +
  "trabalho fazer minha minhas meus numa numas esta este isto aqui zona bairro").split(" "));

/** Sem acentos e em minúsculas (igual à função fold_text da base de dados). */
export function foldText(t: string) { return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

/** Raízes das palavras do pedido, iguais às usadas no servidor: "Procuro um eletricista" → ["eletri"]. */
export function wantedKeywords(title: string): string[] {
  const words = foldText(title).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w));
  return [...new Set(words.map(w => w.slice(0, 6)))];
}

/** Profissionais e empresas que podem responder a um pedido "Procura-se". */
export async function findHelpers(client: SupabaseClient, title: string, limit = 12) {
  const words = wantedKeywords(title).slice(0, 2);
  if (!words.length) return { providers: [] as any[], businesses: [] as any[] };
  const runs = await Promise.all(words.map(q => Promise.all([listProviders(client, { query: q, limit }), listBusinesses(client, { query: q, limit })])));
  const providers = new Map<string, any>(); const businesses = new Map<string, any>();
  for (const [p, b] of runs) {
    for (const x of (p.data as any[]) ?? []) if (!providers.has(x.user_id)) providers.set(x.user_id, x);
    for (const x of (b.data as any[]) ?? []) if (!businesses.has(x.id)) businesses.set(x.id, x);
  }
  return { providers: [...providers.values()].slice(0, limit), businesses: [...businesses.values()].slice(0, limit) };
}
