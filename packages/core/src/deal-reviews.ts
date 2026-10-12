import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reputação depois de negócios reais (igual no Site e na APP):
 * - vendedores e compradores avaliam-se depois de uma encomenda concluída ou de um anúncio vendido;
 * - pedidos de serviço a profissionais e empresas, com confirmação e avaliação «Serviço confirmado»;
 * - números públicos de cada perfil.
 */

export type DealKind = "order" | "listing";
export type DealRole = "seller" | "buyer";

export type PendingReview = { kind: DealKind; ref_id: string; title: string; other_id: string; other_name: string; other_role: DealRole; done_at: string | null };
export type UserReview = { id: string; role: DealRole; rating: number; comment: string | null; created_at: string; author_name: string; kind: DealKind; reply?: string | null; reply_at?: string | null };
export type ProviderReview = { id: string; rating: number; comment: string | null; created_at: string; author_id: string; author_name: string; confirmed: boolean; owner_reply?: string | null; owner_reply_at?: string | null };
export type DealCandidate = { user_id: string; full_name: string };

export type UserStats = {
  seller_rating: number | null; seller_reviews: number; buyer_rating: number | null; buyer_reviews: number;
  sales_done: number; purchases_done: number; listings_sold: number; listings_active: number;
  services_requested: number; services_done: number; service_rating: number | null; service_reviews: number; member_since: string | null;
};
export type BusinessStats = { rating: number | null; review_count: number; confirmed_reviews: number; services_requested: number; services_done: number; sales_done: number; member_since: string | null };

export type ServiceRequestStatus = "requested" | "accepted" | "declined" | "done" | "confirmed" | "cancelled";
export type ServiceRequest = {
  id: string; status: ServiceRequestStatus; description: string; provider_note: string | null; created_at: string; updated_at: string;
  provider_id: string | null; business_id: string | null; target_name: string; client_id: string; client_name: string; preferred_date?: string | null;
};
export type ServiceAction = "accept" | "decline" | "done" | "cancel";

export const SERVICE_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  requested: "Pedido enviado", accepted: "Aceite", declined: "Recusado", done: "Serviço concluído", confirmed: "Confirmado ✔", cancelled: "Cancelado"
};
export const DEAL_ROLE_LABELS: Record<DealRole, string> = { seller: "vendedor", buyer: "comprador" };

/** Botões que cada lado pode usar em cada passo do pedido de serviço. */
export function serviceActions(status: ServiceRequestStatus, as: "client" | "provider"): (ServiceAction | "confirm")[] {
  if (as === "provider") return status === "requested" ? ["accept", "decline", "done"] : status === "accepted" ? ["done", "decline"] : [];
  return status === "requested" ? ["cancel"] : status === "accepted" ? ["confirm", "cancel"] : status === "done" ? ["confirm"] : [];
}
export const SERVICE_ACTION_LABELS: Record<ServiceAction | "confirm", string> = {
  accept: "✔ Aceitar", decline: "✖ Recusar", done: "✅ Serviço concluído", cancel: "Cancelar pedido", confirm: "⭐ Confirmar e avaliar"
};

/** Estado final ao fechar um anúncio com negócio: venda → vendido, arrendamento → arrendado, pedidos/serviços → fechado. */
export function finalDealStatus(purpose: string): "sold" | "rented" | "closed" {
  return purpose === "sale" || purpose === "auction" ? "sold" : purpose === "rent" || purpose === "lease" ? "rented" : "closed";
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const int = (v: unknown) => Number(v ?? 0) || 0;

/** "4,8" (vírgula, como em Angola). */
export function formatRating(r: number | string | null | undefined): string {
  const n = num(r);
  return n === null || !Number.isFinite(n) ? "" : n.toFixed(1).replace(".", ",");
}
/** "1 venda", "23 vendas". */
export function plural(n: number, one: string, many: string) { return `${n} ${n === 1 ? one : many}`; }

/** Resumo curto ao lado do vendedor: «★ 4,8 · 23 vendas» (vazio se ainda não houver nada). */
export function sellerBadge(s: Pick<UserStats, "seller_rating" | "seller_reviews" | "sales_done" | "listings_sold"> | null | undefined): string {
  if (!s) return "";
  const sales = int(s.sales_done) + int(s.listings_sold);
  const parts: string[] = [];
  if (int(s.seller_reviews) > 0 && num(s.seller_rating) !== null) parts.push(`★ ${formatRating(s.seller_rating)} (${int(s.seller_reviews)})`);
  if (sales > 0) parts.push(plural(sales, "venda", "vendas"));
  return parts.join(" · ");
}

/** "Membro desde out. 2026". */
export function memberSince(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."][d.getUTCMonth()];
  return `Membro desde ${m} ${d.getUTCFullYear()}`;
}

/** Linhas de números para mostrar no perfil público (só as que têm sentido). */
export function userStatsRows(s: UserStats | null | undefined): { label: string; value: string }[] {
  if (!s) return [];
  const rows: { label: string; value: string }[] = [];
  if (int(s.seller_reviews) > 0) rows.push({ label: "Como vendedor", value: `★ ${formatRating(s.seller_rating)} · ${plural(int(s.seller_reviews), "avaliação", "avaliações")}` });
  if (int(s.buyer_reviews) > 0) rows.push({ label: "Como comprador", value: `★ ${formatRating(s.buyer_rating)} · ${plural(int(s.buyer_reviews), "avaliação", "avaliações")}` });
  rows.push({ label: "Vendas concluídas", value: String(int(s.sales_done) + int(s.listings_sold)) });
  rows.push({ label: "Compras concluídas", value: String(int(s.purchases_done)) });
  if (int(s.services_requested) > 0 || int(s.service_reviews) > 0) {
    rows.push({ label: "Pedidos de serviço recebidos", value: String(int(s.services_requested)) });
    rows.push({ label: "Serviços prestados", value: String(int(s.services_done)) });
  }
  rows.push({ label: "Anúncios ativos", value: String(int(s.listings_active)) });
  return rows;
}
export function businessStatsRows(s: BusinessStats | null | undefined): { label: string; value: string }[] {
  if (!s) return [];
  const rows = [
    { label: "Avaliação", value: int(s.review_count) > 0 ? `★ ${formatRating(s.rating)} · ${plural(int(s.review_count), "avaliação", "avaliações")}` : "Ainda sem avaliações" },
    { label: "Pedidos de serviço recebidos", value: String(int(s.services_requested)) },
    { label: "Serviços prestados", value: String(int(s.services_done)) }
  ];
  if (int(s.confirmed_reviews) > 0) rows.push({ label: "Serviços confirmados por clientes", value: String(int(s.confirmed_reviews)) });
  if (int(s.sales_done) > 0) rows.push({ label: "Vendas na Loja", value: String(int(s.sales_done)) });
  return rows;
}

/** Valida a avaliação antes de enviar. Devolve a mensagem de erro ou null. */
export function validateReview(rating: number, comment = ""): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Escolha de 1 a 5 estrelas.";
  if (comment.length > 1000) return "O comentário é demasiado longo (máximo 1000 letras).";
  return null;
}
export function validateServiceRequest(description: string): string | null {
  const t = description.trim();
  if (t.length < 3) return "Descreva o serviço de que precisa.";
  if (t.length > 1000) return "A descrição é demasiado longa (máximo 1000 letras).";
  return null;
}

// --- Servidor --------------------------------------------------------------------------

function firstRow<T>(data: unknown): T | null { return (Array.isArray(data) ? data[0] : data) as T ?? null; }

export async function getUserStats(client: SupabaseClient, userId: string) {
  const r = await client.rpc("public_user_stats", { p_user_id: userId });
  return { data: firstRow<UserStats>(r.data), error: r.error };
}
export async function getBusinessStats(client: SupabaseClient, businessId: string) {
  const r = await client.rpc("business_stats", { p_business_id: businessId });
  return { data: firstRow<BusinessStats>(r.data), error: r.error };
}
export async function listUserReviews(client: SupabaseClient, userId: string) {
  const r = await client.rpc("user_reviews_for_v2", { p_user_id: userId });
  return { data: (r.data ?? []) as UserReview[], error: r.error };
}
export async function listProviderReviews(client: SupabaseClient, target: { providerId?: string; businessId?: string }) {
  const r = await client.rpc("list_reviews_v3", { p_provider_id: target.providerId ?? null, p_business_id: target.businessId ?? null });
  return { data: (r.data ?? []) as ProviderReview[], error: r.error };
}
export async function listPendingReviews(client: SupabaseClient) {
  const r = await client.rpc("my_pending_reviews");
  return { data: (r.data ?? []) as PendingReview[], error: r.error };
}
export function submitDealReview(client: SupabaseClient, kind: DealKind, refId: string, rating: number, comment?: string) {
  return client.rpc("submit_deal_review", { p_kind: kind, p_ref: refId, p_rating: rating, p_comment: comment?.trim() || null });
}
export async function listDealCandidates(client: SupabaseClient, listingId: string) {
  const r = await client.rpc("listing_deal_candidates", { p_listing_id: listingId });
  return { data: (r.data ?? []) as DealCandidate[], error: r.error };
}
export function setListingDeal(client: SupabaseClient, listingId: string, status: "sold" | "rented" | "closed", counterpartId: string, saleAmount?: number | null) {
  return client.rpc("set_listing_deal_v2", { p_listing_id: listingId, p_status: status, p_counterpart: counterpartId, p_sale_amount: status === "sold" ? saleAmount ?? null : null });
}
export function requestService(client: SupabaseClient, target: { providerId?: string; businessId?: string }, description: string, preferredDate?: string) {
  return client.rpc("request_service_v2", { p_provider_id: target.providerId ?? null, p_business_id: target.businessId ?? null, p_description: description.trim(), p_preferred_date: preferredDate || null });
}
/** Próximos dias para escolher no telemóvel: Hoje, Amanhã, qua. 15/10… (data de Angola). */
export function quickDates(days = 7, now = new Date()): { value: string; label: string }[] {
  const luanda = new Date(now.getTime() + 60 * 60 * 1000); // Angola = UTC+1, sem hora de verão
  const week = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(luanda.getUTCFullYear(), luanda.getUTCMonth(), luanda.getUTCDate() + i));
    const iso = d.toISOString().slice(0, 10);
    const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : `${week[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    return { value: iso, label };
  });
}
/** "Para 15/10/2026" (a data vem como AAAA-MM-DD). */
export function formatPreferredDate(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? "");
  return m ? `Para ${m[3]}/${m[2]}/${m[1]}` : "";
}
export function updateServiceRequest(client: SupabaseClient, id: string, action: ServiceAction, note?: string) {
  return client.rpc("update_service_request", { p_id: id, p_action: action, p_note: note?.trim() || null });
}
export function confirmService(client: SupabaseClient, id: string, rating: number, comment?: string) {
  return client.rpc("confirm_service", { p_id: id, p_rating: rating, p_comment: comment?.trim() || null });
}
export async function listMyServiceRequests(client: SupabaseClient, as: "client" | "provider") {
  const r = await client.rpc("my_service_requests_v2", { p_as: as });
  return { data: (r.data ?? []) as ServiceRequest[], error: r.error };
}
