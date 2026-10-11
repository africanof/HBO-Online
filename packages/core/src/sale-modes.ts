import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";

/** Como se vende cada anúncio (escolhido ao publicar) e propostas de compra ou troca. Igual no Site e na APP. */
export type SaleMode = "fixed" | "negotiable" | "offers" | "auction" | "trade";

export const SALE_MODE_INFO: Record<SaleMode, { label: string; badge: string; help: string; icon: string }> = {
  fixed: { icon: "🏷️", label: "Preço fixo (compra direta)", badge: "Preço fixo", help: "Quem quiser compra pelo preço indicado, sem regatear." },
  negotiable: { icon: "🤝", label: "Preço negociável", badge: "Negociável", help: "Indica o preço, mas aceita propostas mais baixas." },
  offers: { icon: "💬", label: "Aberto a propostas", badge: "Aceita propostas", help: "Os compradores dizem quanto pagam. O preço é só uma referência (pode ficar vazio)." },
  auction: { icon: "🔨", label: "Leilão", badge: "Leilão", help: "Ganha quem der o lance mais alto até ao fim do prazo." },
  trade: { icon: "🔁", label: "Só troca", badge: "Troca", help: "Não vende por dinheiro: troca por outro artigo (pode aceitar diferença em dinheiro)." }
};

/** Opções que fazem sentido para cada finalidade. */
export function saleModesFor(purpose: string, listingType?: string): SaleMode[] {
  if (purpose === "sale" || purpose === "auction") return listingType === "service" ? ["fixed", "negotiable", "offers"] : ["fixed", "negotiable", "offers", "auction", "trade"];
  if (purpose === "rent" || purpose === "lease" || purpose === "service") return ["fixed", "negotiable", "offers"];
  return [];
}
/** O «também aceito troca» só aparece para venda com dinheiro. */
export const canAlsoTrade = (purpose: string, mode: SaleMode | "") => (purpose === "sale") && (mode === "fixed" || mode === "negotiable" || mode === "offers");

/** Valida o modo escolhido antes de publicar. */
export function validateSaleMode(input: { purpose: string; listingType?: string; saleMode?: SaleMode | ""; price?: number; auctionDays?: number; tradeWants?: string; acceptsTrade?: boolean }): string | null {
  const modes = saleModesFor(input.purpose, input.listingType);
  if (modes.length === 0) return null;
  if (!input.saleMode || !modes.includes(input.saleMode)) return "Escolha como quer vender: preço fixo, negociável, propostas, leilão ou troca.";
  if ((input.saleMode === "fixed" || input.saleMode === "negotiable") && !(input.price && input.price > 0)) return "Indique o preço.";
  if (input.saleMode === "auction") {
    if (!(input.price && input.price > 0)) return "Indique o preço inicial do leilão.";
    if (!input.auctionDays || input.auctionDays < 1 || input.auctionDays > 30) return "O leilão dura de 1 a 30 dias.";
  }
  if (input.saleMode === "trade" && (input.tradeWants ?? "").trim().length < 2) return "Diga o que aceita em troca.";
  return null;
}

type ListingLike = { purpose?: string; sale_mode?: string | null; accepts_trade?: boolean | null; trade_wants?: string | null; status?: string };

/** Etiquetas para o cartão e a página do anúncio: ["Negociável", "Aceita troca"]. */
export function saleModeBadges(l: ListingLike): string[] {
  if (l.purpose === "wanted") return [];
  const mode = (l.purpose === "auction" ? "auction" : l.sale_mode) as SaleMode | null | undefined;
  const out: string[] = [];
  if (mode && SALE_MODE_INFO[mode]) out.push(SALE_MODE_INFO[mode].badge);
  if (l.accepts_trade && mode !== "trade") out.push("Aceita troca");
  return out;
}

/** O que o comprador pode fazer neste anúncio. */
export function buyerOptions(l: ListingLike): { buyNow: boolean; offerMoney: boolean; offerTrade: boolean } {
  if (l.status && l.status !== "published") return { buyNow: false, offerMoney: false, offerTrade: false };
  if (l.purpose === "wanted" || l.purpose === "auction" || l.sale_mode === "auction") return { buyNow: false, offerMoney: false, offerTrade: false };
  const mode = l.sale_mode ?? "negotiable"; // anúncios antigos: negociável
  return {
    buyNow: mode === "fixed" || mode === "negotiable",
    offerMoney: mode === "negotiable" || mode === "offers" || (mode === "trade"), // na troca o dinheiro é a diferença
    offerTrade: mode === "trade" || mode === "offers" || !!l.accepts_trade
  };
}

/** Mensagem pronta para «Quero comprar». */
export function buyNowMessage(title: string, price: number | string | null | undefined, currency = "AOA") {
  return price != null && price !== "" ? `Olá! Quero comprar «${title}» por ${formatPrice(price, currency)}. Quando e onde posso levantar?` : `Olá! Quero comprar «${title}». Qual é o preço e onde posso levantar?`;
}

/** "75 000 Kz + troca por Samsung A10". */
export function offerLabel(o: { amount?: number | string | null; trade_item?: string | null }, currency = "AOA"): string {
  return [o.amount != null && o.amount !== "" ? formatPrice(o.amount, currency) : null, o.trade_item ? "troca por " + o.trade_item : null].filter(Boolean).join(" + ");
}
export function validateOffer(input: { amount?: number; tradeItem?: string }, opts: { offerMoney: boolean; offerTrade: boolean; tradeOnly?: boolean }): string | null {
  const t = (input.tradeItem ?? "").trim();
  if (input.amount !== undefined && !(Number.isFinite(input.amount) && input.amount > 0)) return "Indique um valor válido.";
  if (opts.tradeOnly && t.length < 2) return "Diga o que oferece em troca.";
  if (input.amount === undefined && t.length < 2) return opts.offerTrade && opts.offerMoney ? "Indique o valor ou o que oferece em troca." : opts.offerTrade ? "Diga o que oferece em troca." : "Indique o valor da proposta.";
  return null;
}

export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = { pending: "À espera de resposta", accepted: "Aceite ✔", declined: "Recusada", withdrawn: "Retirada" };
export type ListingOffer = { id: string; buyer_id: string; buyer_name: string; amount: number | null; trade_item: string | null; message: string | null; status: OfferStatus; seller_note: string | null; created_at: string };
export type MyOffer = { id: string; listing_id: string; listing_title: string; listing_status: string; amount: number | null; trade_item: string | null; message: string | null; status: OfferStatus; seller_note: string | null; created_at: string };

export function makeOffer(client: SupabaseClient, listingId: string, input: { amount?: number; tradeItem?: string; message?: string }) {
  return client.rpc("make_offer", { p_listing_id: listingId, p_amount: input.amount ?? null, p_trade_item: input.tradeItem?.trim() || null, p_message: input.message?.trim() || null });
}
export function respondOffer(client: SupabaseClient, offerId: string, accept: boolean, note?: string) {
  return client.rpc("respond_offer", { p_offer_id: offerId, p_accept: accept, p_note: note?.trim() || null });
}
export function withdrawOffer(client: SupabaseClient, offerId: string) { return client.rpc("withdraw_offer", { p_offer_id: offerId }); }
export async function listOffersFor(client: SupabaseClient, listingId: string) {
  const r = await client.rpc("listing_offers_for", { p_listing_id: listingId });
  return { data: (r.data ?? []) as ListingOffer[], error: r.error };
}
export async function listMyOffers(client: SupabaseClient) {
  const r = await client.rpc("my_offers");
  return { data: (r.data ?? []) as MyOffer[], error: r.error };
}
export async function myOfferCounts(client: SupabaseClient) {
  const r = await client.rpc("my_listing_offer_counts");
  const map: Record<string, number> = {};
  for (const x of (r.data ?? []) as { listing_id: string; pending: number }[]) map[x.listing_id] = Number(x.pending);
  return { data: map, error: r.error };
}
