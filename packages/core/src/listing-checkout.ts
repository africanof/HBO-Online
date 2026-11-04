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
  "pp.example_badge": { pt: "EXEMPLO", en: "EXAMPLE", zh: "示例", fr: "EXEMPLE" },
  "pp.example_note": { pt: "🧪 Este é um exemplo para mostrar como o Huambo Online funciona. Não está à venda e não pode ser comprado nem contactado.", en: "🧪 This is an example showing how Huambo Online works. It is not for sale and cannot be bought or contacted.", zh: "🧪 这是展示 Huambo Online 如何使用的示例。不出售，无法购买或联系。", fr: "🧪 Ceci est un exemple qui montre comment fonctionne Huambo Online. Il n'est pas à vendre et ne peut être ni acheté ni contacté." },
  "pp.team_confirms": { pt: "🛡️ O pagamento é feito ao Huambo Online e confirmado pela equipa. O valor passa ao seu saldo quando ler o código do cliente (eventos: 1 dia depois do evento).", en: "🛡️ Payment is made to Huambo Online and confirmed by the team. The amount goes to your balance when you scan the customer's code (events: 1 day after the event).", zh: "🛡️ 款项支付给 Huambo Online，并由团队确认。扫描客户代码后金额将转入您的余额（活动：活动结束后 1 天）。", fr: "🛡️ Le paiement est fait à Huambo Online et confirmé par l'équipe. Le montant passe à votre solde quand vous scannez le code du client (événements : 1 jour après l'événement)." },
  "pp.pay_platform": { pt: "🛡️ Paga adiantado ao Huambo Online (pagamento protegido). O dinheiro só chega ao vendedor depois de usar o código.", en: "🛡️ You pay Huambo Online in advance (protected payment). The money only reaches the seller after your code is used.", zh: "🛡️ 您预先付款给 Huambo Online（担保支付）。只有在使用您的代码后，款项才会转给卖家。", fr: "🛡️ Vous payez Huambo Online à l'avance (paiement protégé). L'argent n'arrive au vendeur qu'après l'utilisation de votre code." },
  "pp.admin_tickets": { pt: "🎟️ Pagamentos de bilhetes para confirmar", en: "🎟️ Ticket payments to confirm", zh: "🎟️ 待确认的门票付款", fr: "🎟️ Paiements de billets à confirmer" },
  "pp.confirm_pay": { pt: "✅ Pagamento recebido", en: "✅ Payment received", zh: "✅ 已收到付款", fr: "✅ Paiement reçu" },
  "pp.reject_pay": { pt: "❌ Não recebido", en: "❌ Not received", zh: "❌ 未收到", fr: "❌ Non reçu" },
  "pp.reject_why": { pt: "Porque não confirma? (o cliente vê esta nota)", en: "Why not confirm? (the customer sees this note)", zh: "为什么不确认？（客户会看到此备注）", fr: "Pourquoi ne pas confirmer ? (le client voit cette note)" },
  "pp.none_pending": { pt: "Nada por confirmar.", en: "Nothing to confirm.", zh: "没有待确认的项目。", fr: "Rien à confirmer." },
  "pp.decided": { pt: "Feito.", en: "Done.", zh: "完成。", fr: "Fait." },
  "sv.quote": { pt: "Orçamento", en: "Quote", zh: "报价", fr: "Devis" },
  "sv.quote_amount_q": { pt: "Valor do orçamento (Kz):", en: "Quote amount (Kz):", zh: "报价金额（Kz）：", fr: "Montant du devis (Kz) :" },
  "sv.quote_amount_ph": { pt: "Valor do orçamento (Kz)", en: "Quote amount (Kz)", zh: "报价金额（Kz）", fr: "Montant du devis (Kz)" },
  "sv.quote_amount_bad": { pt: "Indique um valor de orçamento válido.", en: "Enter a valid quote amount.", zh: "请输入有效的报价金额。", fr: "Indiquez un montant de devis valide." },
  "sv.quote_note_q": { pt: "Nota do orçamento (opcional): o que inclui, prazo…", en: "Quote note (optional): what's included, timing…", zh: "报价备注（可选）：包含内容、时间……", fr: "Note du devis (facultatif) : ce qui est inclus, délai…" },
  "sv.quote_sent": { pt: "Orçamento enviado. O cliente vai aceitar e pagar com pagamento protegido.", en: "Quote sent. The client will accept and pay with protected payment.", zh: "报价已发送。客户将接受并使用担保支付付款。", fr: "Devis envoyé. Le client va l'accepter et payer avec le paiement protégé." },
  "sv.quote_paid": { pt: "pago e guardado pelo Huambo Online", en: "paid and held by Huambo Online", zh: "已付款，由 Huambo Online 保管", fr: "payé et conservé par Huambo Online" },
  "sv.quote_released": { pt: "pagamento entregue", en: "payment released", zh: "款项已发放", fr: "paiement versé" },
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

/** O Huambo Online recebe todos os pagamentos (pagamento protegido ligado)? Guardado durante a sessão. */
let collectsCache: Promise<boolean> | null = null;
export function platformCollects(client: SupabaseClient): Promise<boolean> {
  if (!collectsCache) collectsCache = Promise.resolve(client.rpc("platform_collects")).then(r => r.data === true).catch(() => { collectsCache = null; return false; });
  return collectsCache;
}
export type AdminTicketOrder = { id: string; ref_no: number; status: string; quantity: number; total: number | string; method: string | null; reference: string | null;
  submitted_at: string | null; created_at: string; buyer_name: string; buyer_phone: string | null; escrow: string | null; event_title: string; starts_at: string };
/** Pagamentos de bilhetes para a equipa confirmar (pagamento protegido). */
export async function listTicketOrdersForAdmin(client: SupabaseClient, status = "submitted") {
  const r = await client.rpc("admin_list_event_orders", { p_status: status || null });
  return { data: (r.data ?? []) as AdminTicketOrder[], error: r.error };
}
