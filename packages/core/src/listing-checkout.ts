import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "./i18n";

/**
 * Pagamento protegido OBRIGATÓRIO nos anúncios (igual no Site e na APP).
 * Comprar, arrendar ou alugar cria uma encomenda protegida: paga-se ao Huambo Online, o dinheiro fica guardado
 * e só passa ao vendedor depois de o comprador receber. Propostas aceites, leilões ganhos e pedidos de aluguer
 * aceites criam a encomenda sozinhos. Enquanto há uma encomenda aberta, o anúncio fica «Reservado».
 */

export type ListingCheckoutKind = "buy" | "rent" | "lease";
export type MyListingOrder = { id: string; total: number | string; escrow_status: "awaiting_payment" | "held"; pay_by: string | null; source: string };
export type ListingForCheckout = { purpose?: string | null; price?: number | string | null; sale_mode?: string | null; status?: string | null };

/** Que compra protegida o anúncio permite (null = nenhuma: «Procura-se», emprego, só troca, só propostas ou sem preço). */
export function listingCheckoutKind(l: ListingForCheckout | null | undefined, isJob = false): ListingCheckoutKind | null {
  if (!l || isJob || l.status !== "published") return null;
  if (l.sale_mode === "offers" || l.sale_mode === "trade") return null;
  if (!(Number(l.price) > 0)) return null;
  if (l.purpose === "sale") return "buy";
  if (l.purpose === "rent") return "rent";
  if (l.purpose === "lease") return "lease";
  return null;
}

export type ListingCheckoutInput = { fulfillment: "pickup" | "delivery"; phone: string; deliveryText?: string; note?: string };
export function validateListingCheckout(i: ListingCheckoutInput): string | null {
  if (!i.phone.trim()) return "pp.err_phone";
  if (i.fulfillment === "delivery" && !(i.deliveryText ?? "").trim()) return "pp.err_address";
  return null;
}

/** Cria (ou devolve, se já existir) a encomenda protegida do anúncio. Devolve o id da encomenda. */
export function buyListingProtected(client: SupabaseClient, listingId: string, i: ListingCheckoutInput) {
  return client.rpc("protected_buy_listing", {
    p_listing_id: listingId, p_fulfillment: i.fulfillment, p_contact_phone: i.phone.trim(),
    p_delivery_text: i.fulfillment === "delivery" ? (i.deliveryText ?? "").trim() : null, p_note: (i.note ?? "").trim() || null
  });
}
export async function listingReserved(client: SupabaseClient, listingId: string): Promise<boolean> {
  const r = await client.rpc("listing_reserved", { p_listing: listingId });
  return r.data === true;
}
export async function myListingOrder(client: SupabaseClient, listingId: string): Promise<MyListingOrder | null> {
  const r = await client.rpc("my_listing_order", { p_listing: listingId });
  return (r.data as MyListingOrder | null) ?? null;
}
/** Endereço da encomenda para pagar ou acompanhar. */
export const orderHref = (orderId: string, pay = false) => `/encomendas${pay ? "?pagar=1" : ""}#encomenda-${orderId}`;

export const LISTING_CHECKOUT_DICT: Dictionary = {
  "pp.buy": { pt: "🛡️ Comprar com pagamento protegido", en: "🛡️ Buy with protected payment", zh: "🛡️ 使用担保支付购买", fr: "🛡️ Acheter avec paiement protégé" },
  "pp.rent": { pt: "🛡️ Arrendar com pagamento protegido", en: "🛡️ Rent with protected payment", zh: "🛡️ 使用担保支付租房", fr: "🛡️ Louer avec paiement protégé" },
  "pp.lease": { pt: "🛡️ Alugar com pagamento protegido", en: "🛡️ Hire with protected payment", zh: "🛡️ 使用担保支付租用", fr: "🛡️ Louer avec paiement protégé" },
  "pp.rent_first": { pt: "Paga o primeiro mês pelo Huambo Online.", en: "You pay the first month through Huambo Online.", zh: "通过 Huambo Online 支付第一个月。", fr: "Vous payez le premier mois via Huambo Online." },
  "pp.how": { pt: "Paga ao Huambo Online e o dinheiro fica guardado. Só chega ao vendedor depois de receber — se houver problema, pede o reembolso.", en: "You pay Huambo Online and the money is held. It only reaches the seller after you receive the item — if something goes wrong, you ask for a refund.", zh: "您付款给 Huambo Online，款项由平台保管。只有在您收到商品后才会转给卖家——如有问题，可申请退款。", fr: "Vous payez Huambo Online et l'argent est conservé. Il n'arrive au vendeur qu'après réception — en cas de problème, vous demandez un remboursement." },
  "pp.never_outside": { pt: "Nunca pague fora do Huambo Online: fora daqui o seu dinheiro não fica protegido.", en: "Never pay outside Huambo Online: outside it your money is not protected.", zh: "切勿在 Huambo Online 之外付款：在平台外付款，您的资金不受保护。", fr: "Ne payez jamais en dehors de Huambo Online : ailleurs, votre argent n'est pas protégé." },
  "pp.handover": { pt: "Como recebe?", en: "How will you receive it?", zh: "您如何收货？", fr: "Comment le recevez-vous ?" },
  "pp.in_person": { pt: "🤝 Em mão (encontro combinado)", en: "🤝 In person (arranged meeting)", zh: "🤝 当面交付（约定见面）", fr: "🤝 En main propre (rendez-vous)" },
  "pp.delivery": { pt: "🚚 Entrega na minha morada", en: "🚚 Delivery to my address", zh: "🚚 送货到我的地址", fr: "🚚 Livraison à mon adresse" },
  "pp.phone": { pt: "O seu telefone", en: "Your phone", zh: "您的电话", fr: "Votre téléphone" },
  "pp.address": { pt: "Morada ou ponto de entrega", en: "Address or delivery point", zh: "地址或交付点", fr: "Adresse ou point de livraison" },
  "pp.note": { pt: "Nota para o vendedor (opcional)", en: "Note for the seller (optional)", zh: "给卖家的备注（可选）", fr: "Note pour le vendeur (facultatif)" },
  "pp.continue": { pt: "Continuar para o pagamento", en: "Continue to payment", zh: "继续付款", fr: "Continuer vers le paiement" },
  "pp.reserved": { pt: "🔒 Reservado: outra pessoa está a pagar este anúncio. Se o pagamento não chegar, volta a ficar disponível.", en: "🔒 Reserved: someone else is paying for this listing. If the payment doesn't arrive, it becomes available again.", zh: "🔒 已预订：其他人正在为此广告付款。如果付款未到账，将重新开放。", fr: "🔒 Réservé : quelqu'un d'autre paie cette annonce. Si le paiement n'arrive pas, elle redevient disponible." },
  "pp.yours_pay": { pt: "🛡️ Esta compra está reservada para si: pague {total} para a garantir.", en: "🛡️ This purchase is reserved for you: pay {total} to secure it.", zh: "🛡️ 此购买已为您预留：支付 {total} 以确认。", fr: "🛡️ Cet achat vous est réservé : payez {total} pour le garantir." },
  "pp.pay_now": { pt: "Pagar agora", en: "Pay now", zh: "立即付款", fr: "Payer maintenant" },
  "pp.yours_held": { pt: "🛡️ Já pagou {total}: o dinheiro está guardado até confirmar que recebeu.", en: "🛡️ You've paid {total}: the money is held until you confirm you received it.", zh: "🛡️ 您已支付 {total}：款项将保管至您确认收货。", fr: "🛡️ Vous avez payé {total} : l'argent est conservé jusqu'à ce que vous confirmiez la réception." },
  "pp.see_order": { pt: "Ver a encomenda", en: "See the order", zh: "查看订单", fr: "Voir la commande" },
  "pp.offer_hint": { pt: "Este anúncio vende-se por proposta: faça uma proposta e, se for aceite, paga com pagamento protegido.", en: "This listing sells by offer: make an offer and, if accepted, pay with protected payment.", zh: "此广告以报价方式出售：请提交报价，若被接受，使用担保支付付款。", fr: "Cette annonce se vend sur offre : faites une offre et, si elle est acceptée, payez avec le paiement protégé." },
  "pp.login": { pt: "Entre na sua conta para comprar.", en: "Sign in to buy.", zh: "请登录后购买。", fr: "Connectez-vous pour acheter." },
  "pp.err_phone": { pt: "Indique o seu telefone.", en: "Enter your phone number.", zh: "请输入您的电话。", fr: "Indiquez votre téléphone." },
  "pp.err_address": { pt: "Indique a morada ou o ponto de entrega.", en: "Enter the address or delivery point.", zh: "请输入地址或交付点。", fr: "Indiquez l'adresse ou le point de livraison." }
};
