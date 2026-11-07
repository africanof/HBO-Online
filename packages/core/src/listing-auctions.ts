import type { SupabaseClient } from "@supabase/supabase-js";

/** Leilão ligado a um anúncio + página pública do vendedor (iguais no Site e na APP). */
export type ListingAuction = {
  id: string; seller_id: string; title: string; starting_price: number; reserve_met: boolean; min_increment: number;
  current_price: number; starts_at: string; ends_at: string; status: "draft" | "scheduled" | "live" | "ended" | "cancelled";
  winner_id: string | null; bid_count: number; my_best: number | null; leader_is_me: boolean;
  has_reserve?: boolean; buy_now_price?: number | null; buy_now_available?: boolean; bought_now?: boolean;
};

/** Tipos de anúncio que o servidor aceita pôr em leilão. */
export const AUCTIONABLE_TYPES = ["real_estate", "vehicle", "product", "classified"];

/**
 * Leilões como no eBay: cada pessoa indica o MÁXIMO que paga (fica secreto) e o sistema licita por ela
 * só o necessário para ficar à frente. O incremento sobe com o preço (escalões em Kz) e nunca é menor
 * que o escolhido pelo vendedor — igual à função auction_increment do servidor.
 */
export const BID_INCREMENT_STEPS: [number, number][] = [[1000, 50], [5000, 250], [25000, 500], [100000, 1000], [250000, 2500], [500000, 5000], [1000000, 10000], [2500000, 25000], [5000000, 50000]];
export function bidIncrement(price: number, sellerMin = 0): number {
  const step = BID_INCREMENT_STEPS.find(([limit]) => Number(price) < limit)?.[1] ?? 100000;
  return Math.max(Number(sellerMin) || 0, step);
}
/**
 * Preço depois de todos os máximos: 2.º maior máximo + incremento (sem passar do máximo de quem ganha);
 * empate → ganha quem chegou primeiro; com reserva atingida o preço sobe até ela. Igual a auction_standing.
 */
export function proxyStanding(maxes: { bidder: string; max: number; at: string }[], startingPrice: number, sellerMin = 0, reserve?: number | null) {
  const sorted = [...maxes].sort((x, y) => y.max - x.max || Date.parse(x.at) - Date.parse(y.at));
  if (!sorted.length) return { leader: null as string | null, price: startingPrice };
  const [first, second] = sorted;
  let price = second ? Math.min(first.max, second.max + bidIncrement(second.max, sellerMin)) : startingPrice;
  if (reserve != null && first.max >= reserve) price = Math.max(price, reserve);
  return { leader: first.bidder, price: Math.min(Math.max(price, startingPrice), first.max) };
}
/** Valor mínimo que se pode escrever (o servidor já envia em min_increment o incremento atual). */
export function nextMinimumBid(a: Pick<ListingAuction, "bid_count" | "starting_price" | "current_price" | "min_increment"> & Partial<Pick<ListingAuction, "leader_is_me" | "my_best">>): number {
  if (a.leader_is_me && a.my_best != null) return Number(a.my_best) + 1; // quem ganha só pode subir o seu máximo
  return Number(a.bid_count) === 0 ? Number(a.starting_price) : Number(a.current_price) + Math.max(Number(a.min_increment), 1);
}

/**
 * Valores rápidos para licitar (como no eBay): o mínimo arredondado e mais dois saltos (1 e 4 incrementos).
 * Ficam de fora os valores iguais ou acima do «Comprar já» (aí compensa comprar).
 */
export function quickBids(a: Pick<ListingAuction, "bid_count" | "starting_price" | "current_price" | "min_increment"> & Partial<Pick<ListingAuction, "leader_is_me" | "my_best" | "buy_now_price" | "buy_now_available">>): number[] {
  const min = nextMinimumBid(a);
  if (!(min > 0)) return [];
  const inc = bidIncrement(min, Number(a.min_increment) || 0);
  const first = Math.ceil(min / inc) * inc;
  const cap = a.buy_now_available && Number(a.buy_now_price) > 0 ? Number(a.buy_now_price) : Infinity;
  return [...new Set([first, first + inc, first + 4 * inc])].filter(v => v >= min && v < cap);
}

/** Contagem ao segundo (como no eBay): "2 d 4 h 12 min 05 s", "23 h 58 min 12 s", "2 min 10 s", "45 s", "Terminado". */
export function timeLeftLive(endsAt: string, now = Date.now()): { text: string; urgent: boolean; ended: boolean } {
  const ms = new Date(endsAt).getTime() - now;
  if (!(ms > 0)) return { text: "Terminado", urgent: false, ended: true };
  const total = Math.floor(ms / 1000), sec = total % 60, min = Math.floor(total / 60) % 60, h = Math.floor(total / 3600) % 24, d = Math.floor(total / 86400);
  const ss = String(sec).padStart(2, "0"), mm = String(min).padStart(2, "0");
  const text = d > 0 ? `${d} d ${h} h ${mm} min ${ss} s` : h > 0 ? `${h} h ${mm} min ${ss} s` : min > 0 ? `${min} min ${ss} s` : `${sec} s`;
  return { text, urgent: total < 3600, ended: false };
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

export function validateAuctionInput(input: { startingPrice: number; reservePrice?: number; minIncrement?: number; days: number; buyNowPrice?: number }): string | null {
  if (input.buyNowPrice !== undefined && (!Number.isFinite(input.buyNowPrice) || input.buyNowPrice <= input.startingPrice || input.buyNowPrice < (input.reservePrice ?? 0)))
    return "O preço «Comprar já» tem de ser maior que o preço inicial e não menor que o preço mínimo de venda.";
  if (!Number.isFinite(input.startingPrice) || input.startingPrice <= 0) return "Indique o preço inicial.";
  if (input.reservePrice !== undefined && (!Number.isFinite(input.reservePrice) || input.reservePrice < input.startingPrice)) return "O preço mínimo de venda não pode ser menor que o inicial.";
  if (input.minIncrement !== undefined && (!Number.isFinite(input.minIncrement) || input.minIncrement < 0)) return "Indique um incremento válido.";
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 30) return "A duração tem de ser entre 1 e 30 dias.";
  return null;
}

export async function getListingAuction(client: SupabaseClient, listingId: string) {
  return client.rpc("auction_for_listing_v2", { p_listing_id: listingId }).maybeSingle<ListingAuction>();
}
export async function startListingAuction(client: SupabaseClient, listingId: string, input: { startingPrice: number; reservePrice?: number; minIncrement?: number; days: number; buyNowPrice?: number }) {
  const invalid = validateAuctionInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const start = new Date();
  const end = new Date(start.getTime() + input.days * 86400000);
  const created = await client.rpc("create_classified_auction", {
    p_listing_id: listingId, p_starts_at: start.toISOString(), p_ends_at: end.toISOString(),
    p_starting_price: input.startingPrice, p_reserve_price: input.reservePrice ?? null, p_min_increment: input.minIncrement ?? 0
  });
  const id = (created.data as { id?: string } | null)?.id;
  if (created.error || input.buyNowPrice === undefined || !id) return created;
  const bn = await setBuyNow(client, id, input.buyNowPrice);
  return bn.error ? { data: created.data, error: bn.error } : created;
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
export type AuctionBid = { id: string; bidder_label: string; amount: number | string; created_at: string; is_mine: boolean; is_auto?: boolean; retracted: boolean; retract_reason: string | null; retracted_by_seller: boolean };
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
  const r = await client.rpc("auction_bids_for_v2", { p_auction_id: auctionId });
  return { data: (r.data ?? []) as AuctionBid[], error: r.error };
}
export function retractMyBid(client: SupabaseClient, auctionId: string, reason: RetractReason) {
  return client.rpc("retract_auction_bid", { p_auction_id: auctionId, p_reason: reason });
}
export function cancelBidAsSeller(client: SupabaseClient, bidId: string, reason: string) {
  return client.rpc("seller_cancel_bid", { p_bid_id: bidId, p_reason: reason.trim() });
}

// --- Comprar já e «As minhas licitações» ---------------------------------------------------
export function setBuyNow(client: SupabaseClient, auctionId: string, price: number | null) {
  return client.rpc("set_auction_buy_now", { p_auction_id: auctionId, p_price: price });
}
export function buyAuctionNow(client: SupabaseClient, auctionId: string) {
  return client.rpc("buy_auction_now", { p_auction_id: auctionId });
}
export type BidStanding = "winning" | "outbid" | "won" | "lost" | "reserve_not_met" | "retracted" | "cancelled" | "auction_cancelled";
export const BID_STANDING_LABELS: Record<BidStanding, string> = {
  winning: "✔ Está a ganhar", outbid: "⚠️ Foi ultrapassado", won: "🎉 Ganhou", lost: "Perdeu", reserve_not_met: "Preço mínimo de venda não atingido",
  retracted: "Retirou os lances", cancelled: "Lances cancelados pelo vendedor", auction_cancelled: "Leilão cancelado"
};
export type MyAuctionBid = { auction_id: string; listing_id: string | null; ref_no: number | null; title: string; photo: string | null; status: string; ends_at: string;
  current_price: number | string; my_max: number | string | null; standing: BidStanding; bid_count: number };
export async function listMyAuctionBids(client: SupabaseClient) {
  const r = await client.rpc("my_auction_bids");
  return { data: (r.data ?? []) as MyAuctionBid[], error: r.error };
}
/** Separa em «a decorrer» e «terminados», e conta os que precisam de atenção (ultrapassado). */
export function groupMyBids(items: MyAuctionBid[]) {
  const live = items.filter(i => i.status === "live" && ["winning", "outbid"].includes(i.standing));
  return { live, ended: items.filter(i => !live.includes(i)), needAttention: live.filter(i => i.standing === "outbid").length };
}
