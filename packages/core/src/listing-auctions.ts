import type { SupabaseClient } from "@supabase/supabase-js";

/** Leilão ligado a um anúncio + página pública do vendedor (iguais no Site e na APP). */
export type ListingAuction = {
  id: string; seller_id: string; title: string; starting_price: number; reserve_met: boolean; min_increment: number;
  current_price: number; starts_at: string; ends_at: string; status: "draft" | "scheduled" | "live" | "ended" | "cancelled";
  winner_id: string | null; bid_count: number; my_best: number | null; leader_is_me: boolean;
};

/** Tipos de anúncio que o servidor aceita pôr em leilão. */
export const AUCTIONABLE_TYPES = ["real_estate", "vehicle", "product", "classified"];

/** Valor mínimo do próximo lance (igual à regra do servidor). */
export function nextMinimumBid(a: Pick<ListingAuction, "bid_count" | "starting_price" | "current_price" | "min_increment">): number {
  return Number(a.bid_count) === 0 ? Number(a.starting_price) : Number(a.current_price) + Math.max(Number(a.min_increment), 1);
}

/** "2 d 4 h", "35 min", "Terminado" */
export function timeLeft(endsAt: string, now = Date.now()): string {
  const ms = new Date(endsAt).getTime() - now;
  if (!(ms > 0)) return "Terminado";
  const min = Math.floor(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} d ${h % 24} h`;
  if (h > 0) return `${h} h ${min % 60} min`;
  return `${Math.max(min, 1)} min`;
}

export function validateAuctionInput(input: { startingPrice: number; reservePrice?: number; minIncrement?: number; days: number }): string | null {
  if (!Number.isFinite(input.startingPrice) || input.startingPrice <= 0) return "Indique o preço inicial.";
  if (input.reservePrice !== undefined && (!Number.isFinite(input.reservePrice) || input.reservePrice < input.startingPrice)) return "O preço mínimo de venda não pode ser menor que o inicial.";
  if (input.minIncrement !== undefined && (!Number.isFinite(input.minIncrement) || input.minIncrement < 0)) return "Indique um incremento válido.";
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 30) return "A duração tem de ser entre 1 e 30 dias.";
  return null;
}

export async function getListingAuction(client: SupabaseClient, listingId: string) {
  return client.rpc("auction_for_listing", { p_listing_id: listingId }).maybeSingle<ListingAuction>();
}
export async function startListingAuction(client: SupabaseClient, listingId: string, input: { startingPrice: number; reservePrice?: number; minIncrement?: number; days: number }) {
  const invalid = validateAuctionInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const start = new Date();
  const end = new Date(start.getTime() + input.days * 86400000);
  return client.rpc("create_classified_auction", {
    p_listing_id: listingId, p_starts_at: start.toISOString(), p_ends_at: end.toISOString(),
    p_starting_price: input.startingPrice, p_reserve_price: input.reservePrice ?? null, p_min_increment: input.minIncrement ?? 0
  });
}
export async function bidOnAuction(client: SupabaseClient, auctionId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return { data: null, error: new Error("Indique o valor do lance.") };
  return client.rpc("place_auction_bid", { p_auction_id: auctionId, p_amount: amount });
}
export async function cancelAuction(client: SupabaseClient, auctionId: string) { return client.rpc("close_auction", { p_auction_id: auctionId }); }

export type PublicSeller = { id: string; full_name: string; avatar_url: string | null; municipality: string | null; member_since: string;
  listings: number; products: number; is_provider: boolean; rating: number; review_count: number };
export async function getPublicSeller(client: SupabaseClient, userId: string) {
  return client.rpc("public_seller", { p_user_id: userId }).maybeSingle<PublicSeller>();
}
export async function listSellerListings(client: SupabaseClient, ownerId: string) {
  return client.from("classified_listings").select("id,title,price,currency,media,purpose,listing_type,created_at,video_url").eq("owner_id", ownerId).eq("status", "published").order("created_at", { ascending: false }).limit(60);
}

// --- Cancelar lances -------------------------------------------------------------------
export type AuctionBid = { id: string; bidder_label: string; amount: number | string; created_at: string; is_mine: boolean; retracted: boolean; retract_reason: string | null; retracted_by_seller: boolean };
export type RetractReason = "typo" | "listing_changed" | "cannot_contact";
export const RETRACT_REASON_LABELS: Record<RetractReason, string> = {
  typo: "Enganei-me no valor", listing_changed: "O vendedor mudou o anúncio", cannot_contact: "Não consigo contactar o vendedor"
};
/** Regras para retirar (iguais às do servidor): faltam mais de 12 h, ou o último lance foi há menos de 1 h. */
export const RETRACT_CUTOFF_HOURS = 12;
export const RETRACT_GRACE_MINUTES = 60;
export function canRetractBid(a: Pick<ListingAuction, "status" | "ends_at">, myBids: Pick<AuctionBid, "created_at" | "retracted">[], now = Date.now()): { ok: true } | { ok: false; why: string } {
  const active = myBids.filter(b => !b.retracted);
  const end = Date.parse(a.ends_at);
  if (a.status !== "live" || !(end > now)) return { ok: false, why: "O leilão já terminou." };
  if (!active.length) return { ok: false, why: "Não tem lances neste leilão." };
  const latest = Math.max(...active.map(b => Date.parse(b.created_at)));
  if (end - now <= RETRACT_CUTOFF_HOURS * 3600000 && now - latest > RETRACT_GRACE_MINUTES * 60000)
    return { ok: false, why: `Faltam menos de ${RETRACT_CUTOFF_HOURS} horas para o fim: só pode retirar um lance feito há menos de 1 hora.` };
  return { ok: true };
}
export async function listBidsForAuction(client: SupabaseClient, auctionId: string) {
  const r = await client.rpc("auction_bids_for", { p_auction_id: auctionId });
  return { data: (r.data ?? []) as AuctionBid[], error: r.error };
}
export function retractMyBid(client: SupabaseClient, auctionId: string, reason: RetractReason) {
  return client.rpc("retract_auction_bid", { p_auction_id: auctionId, p_reason: reason });
}
export function cancelBidAsSeller(client: SupabaseClient, bidId: string, reason: string) {
  return client.rpc("seller_cancel_bid", { p_bid_id: bidId, p_reason: reason.trim() });
}
