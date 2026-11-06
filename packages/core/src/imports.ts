import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "./i18n";

/**
 * Importação (compras no exterior): o cliente consulta o catálogo ou descreve o que procura, a equipa do
 * Huambo Online envia um orçamento, o cliente aceita e paga ao Huambo Online (pagamento protegido) e a
 * equipa compra, importa e entrega. Textos: IMPORT_DICT (chaves «im.*»).
 */
export const IMPORT_ORIGINS = ["any", "china", "dubai", "portugal", "brasil", "africa_sul", "eua", "europa"] as const;
export type ImportOrigin = typeof IMPORT_ORIGINS[number];
export type ImportStatus = "research_payment" | "research_submitted" | "requested" | "quoted" | "awaiting_payment" | "submitted" | "paid" | "purchased" | "in_transit" | "arrived" | "delivered" | "declined" | "cancelled" | "refunded";

export type ImportCatalogItem = { id: string; title: string; description: string | null; icon: string; origin: ImportOrigin; days_min: number; days_max: number; active: boolean; sort: number };
export type ImportRequest = {
  id: string; ref_no: number; user_id: string; catalog_id: string | null; title: string; details: string | null; links: string | null; photo_url: string | null;
  quantity: number; budget: number | null; origin: ImportOrigin; fulfillment: "pickup" | "delivery"; address: string | null; phone: string; status: ImportStatus;
  product_cost: number | null; shipping_cost: number | null; service_fee: number | null; total: number | null; eta_days: number | null; quote_note: string | null;
  quoted_at: string | null; quote_valid_until: string | null; pay_by: string | null; pay_method: string | null; reference: string | null; proof_path: string | null;
  paid_at: string | null; research_fee: number; research_credit: number; research_reference: string | null; research_proof_path: string | null;
  research_pay_by: string | null; research_paid_at: string | null; team_note: string | null; tracking: string | null; created_at: string; updated_at: string; buyer_name?: string | null;
};
export type ImportRequestInput = { title: string; details?: string; links?: string; quantity: number; budget?: number | null; origin: ImportOrigin;
  fulfillment: "pickup" | "delivery"; address?: string; phone: string; catalogId?: string | null; photoUrl?: string | null };

/** Passos que o cliente vê (linha do tempo). */
export const IMPORT_STEPS: ImportStatus[] = ["research_payment", "research_submitted", "requested", "quoted", "awaiting_payment", "submitted", "paid", "purchased", "in_transit", "arrived", "delivered"];
export const IMPORT_OPEN: ImportStatus[] = ["research_payment", "research_submitted", "requested", "quoted", "awaiting_payment", "submitted", "paid", "purchased", "in_transit", "arrived"];
/** Próximos passos que a equipa pode marcar depois do pagamento. */
export const IMPORT_NEXT: Partial<Record<ImportStatus, ImportStatus[]>> = {
  paid: ["purchased", "refunded"], purchased: ["in_transit", "arrived", "refunded"], in_transit: ["arrived"], arrived: ["delivered"]
};

export const importRef = (n: number) => "IMP-" + n;
const num = (v: unknown) => v == null ? null : Number(v);
function normalize(x: any): ImportRequest {
  return { ...x, budget: num(x.budget), product_cost: num(x.product_cost), shipping_cost: num(x.shipping_cost), service_fee: num(x.service_fee), total: num(x.total), research_fee: Number(x.research_fee ?? 0), research_credit: Number(x.research_credit ?? 0) };
}

/** Devolve a chave do texto com o problema, ou null. */
export function validateImportRequest(i: ImportRequestInput): string | null {
  if (i.title.trim().length < 3) return "im.err_title";
  if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100000) return "im.err_qty";
  if (i.phone.replace(/\D/g, "").length < 9) return "im.err_phone";
  if (i.fulfillment === "delivery" && (i.address ?? "").trim().length < 5) return "im.err_address";
  if (i.budget != null && (!Number.isFinite(i.budget) || i.budget <= 0)) return "im.err_budget";
  return null;
}

export async function listImportCatalog(client: SupabaseClient, all = false) {
  let q = client.from("import_catalog").select("*").order("sort").order("title");
  if (!all) q = q.eq("active", true);
  const r = await q;
  return { data: (r.data ?? []) as ImportCatalogItem[], error: r.error };
}
export function saveImportCatalogItem(client: SupabaseClient, item: Partial<ImportCatalogItem> & { title: string }) {
  const row = { title: item.title.trim(), description: item.description?.trim() || null, icon: item.icon || "📦", origin: item.origin ?? "any",
    days_min: item.days_min ?? 15, days_max: Math.max(item.days_max ?? 45, item.days_min ?? 15), active: item.active ?? true, sort: item.sort ?? 100 };
  return item.id ? client.from("import_catalog").update(row).eq("id", item.id) : client.from("import_catalog").insert(row);
}
/** Equipa: apagar do catálogo (os pedidos já feitos continuam, sem ligação ao catálogo). */
export const deleteImportCatalogItem = (client: SupabaseClient, id: string) => client.from("import_catalog").delete().eq("id", id);

export async function createImportRequest(client: SupabaseClient, i: ImportRequestInput) {
  const bad = validateImportRequest(i);
  if (bad) return { data: null, error: new Error(bad) };
  const r = await client.rpc("import_request_create", { p_title: i.title.trim(), p_details: i.details?.trim() || null, p_links: i.links?.trim() || null,
    p_quantity: i.quantity, p_budget: i.budget ?? null, p_origin: i.origin, p_fulfillment: i.fulfillment, p_address: i.address?.trim() || null,
    p_phone: i.phone.trim(), p_catalog_id: i.catalogId ?? null, p_photo_url: i.photoUrl ?? null });
  return { data: r.data ? normalize(r.data) : null, error: r.error };
}
export async function myImportRequests(client: SupabaseClient, userId: string) {
  const r = await client.from("import_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  return { data: ((r.data ?? []) as any[]).map(normalize), error: r.error };
}
export const acceptImportQuote = (client: SupabaseClient, id: string) => client.rpc("import_accept_quote", { p_id: id });
export const cancelImportRequest = (client: SupabaseClient, id: string) => client.rpc("import_cancel", { p_id: id });
export function submitImportPayment(client: SupabaseClient, id: string, i: { method: "bank_transfer" | "multicaixa_express"; reference: string; proofPath: string; proofHash?: string | null }) {
  return client.rpc("import_submit_payment", { p_id: id, p_method: i.method, p_reference: i.reference.trim(), p_proof_path: i.proofPath, p_proof_hash: i.proofHash || null });
}

/** Taxa de pesquisa e orçamento (paga antes de a equipa pesquisar; descontada no total se o cliente aceitar). */
export function submitImportResearchPayment(client: SupabaseClient, id: string, i: { method: "bank_transfer" | "multicaixa_express"; reference: string; proofPath: string; proofHash?: string | null }) {
  return client.rpc("import_submit_research_payment", { p_id: id, p_method: i.method, p_reference: i.reference.trim(), p_proof_path: i.proofPath, p_proof_hash: i.proofHash || null });
}
export type ImportResearchSettings = { fee: number; deduct: boolean };
export async function getImportResearchSettings(client: SupabaseClient): Promise<ImportResearchSettings> {
  const r = await client.from("platform_settings").select("import_research_fee_kz,import_research_deduct").eq("id", 1).maybeSingle();
  const d = r.data as { import_research_fee_kz?: number; import_research_deduct?: boolean } | null;
  return { fee: Number(d?.import_research_fee_kz ?? 0), deduct: d?.import_research_deduct ?? true };
}

// Equipa
export const decideImportResearch = (client: SupabaseClient, id: string, confirm: boolean, note?: string | null) =>
  client.rpc("decide_import_research", { p_id: id, p_confirm: confirm, p_note: note?.trim() || null });
export function setImportResearchSettings(client: SupabaseClient, s: ImportResearchSettings) {
  if (!Number.isFinite(s.fee) || s.fee < 0 || s.fee > 100000) return Promise.resolve({ data: null, error: new Error("INVALID_INPUT") });
  return client.rpc("admin_set_import_research", { p_fee: Math.round(s.fee), p_deduct: s.deduct });
}
export async function listImportRequestsForAdmin(client: SupabaseClient, status: "open" | ImportStatus | "" = "open") {
  const r = await client.rpc("admin_list_import_requests", { p_status: status || null });
  return { data: ((r.data ?? []) as any[]).map(normalize), error: r.error };
}
export function quoteImport(client: SupabaseClient, id: string, q: { product: number; shipping: number; fee: number; etaDays: number; note?: string }) {
  if (!(q.product > 0) || q.shipping < 0 || q.fee < 0 || !(q.etaDays >= 1 && q.etaDays <= 365)) return Promise.resolve({ data: null, error: new Error("INVALID_INPUT") });
  return client.rpc("import_admin_quote", { p_id: id, p_product: q.product, p_shipping: q.shipping, p_fee: q.fee, p_eta_days: Math.round(q.etaDays), p_note: q.note?.trim() || null });
}
export const declineImport = (client: SupabaseClient, id: string, reason: string) => client.rpc("import_admin_decline", { p_id: id, p_reason: reason.trim() });
export const decideImportPayment = (client: SupabaseClient, id: string, confirm: boolean, note?: string | null) =>
  client.rpc("decide_import_payment", { p_id: id, p_confirm: confirm, p_note: note?.trim() || null });
export const advanceImport = (client: SupabaseClient, id: string, status: ImportStatus, note?: string | null, tracking?: string | null) =>
  client.rpc("import_admin_progress", { p_id: id, p_status: status, p_note: note?.trim() || null, p_tracking: tracking?.trim() || null });

/** Taxa de serviço sugerida à equipa (10% do produto + transporte, arredondada às centenas). */
export function suggestedImportFee(product: number, shipping: number, pct = 10): number {
  const base = Math.max(0, product) + Math.max(0, shipping);
  return Math.round(base * pct / 100 / 100) * 100;
}

export const IMPORT_DICT: Dictionary = {
  "ad.tab.imports": { pt: "✈️ Importação", en: "✈️ Imports", zh: "✈️ 进口代购", fr: "✈️ Importation" },
  "im.title": { pt: "✈️ Importação — compramos por si no exterior", en: "✈️ Imports — we buy abroad for you", zh: "✈️ 进口代购 — 我们替您在海外购买", fr: "✈️ Importation — nous achetons pour vous à l'étranger" },
  "im.intro": { pt: "Diga-nos o que procura. A equipa do Huambo Online encontra o produto, envia-lhe o orçamento com tudo incluído e trata da compra, do transporte e da alfândega até ao Huambo.",
    en: "Tell us what you are looking for. The Huambo Online team finds the product, sends you an all-inclusive quote and handles the purchase, shipping and customs all the way to Huambo.",
    zh: "告诉我们您要找的商品。Huambo Online 团队会寻找商品，向您发送全包报价，并负责购买、运输和清关，直至送达万博。",
    fr: "Dites-nous ce que vous cherchez. L'équipe Huambo Online trouve le produit, vous envoie un devis tout compris et s'occupe de l'achat, du transport et de la douane jusqu'à Huambo." },
  "im.how": { pt: "Como funciona", en: "How it works", zh: "如何运作", fr: "Comment ça marche" },
  "im.how1": { pt: "1. Peça: descreva o produto (com fotografia ou ligação, se tiver).", en: "1. Request: describe the product (with a photo or link if you have one).", zh: "1. 提交需求：描述商品（如有，可附照片或链接）。", fr: "1. Demandez : décrivez le produit (avec photo ou lien si vous en avez)." },
  "im.how_fee": { pt: "💡 Para pesquisar e preparar o orçamento cobramos uma taxa de {fee}, paga ao enviar o pedido. Se aceitar o orçamento, este valor é descontado no total. Não é devolvida se desistir ou se o produto não for encontrado.",
    en: "💡 To research and prepare the quote we charge a {fee} fee, paid when you send the request. If you accept the quote, this amount is deducted from the total. It is not refunded if you give up or the product cannot be found.",
    zh: "💡 为查找商品并准备报价，我们收取 {fee} 的费用，在提交需求时支付。如果您接受报价，该金额将从总价中扣除。如果您放弃或找不到商品，该费用不予退还。",
    fr: "💡 Pour rechercher et préparer le devis, nous facturons {fee}, payés à l'envoi de la demande. Si vous acceptez le devis, ce montant est déduit du total. Ils ne sont pas remboursés si vous renoncez ou si le produit est introuvable." },
  "im.how_fee_nodeduct": { pt: "💡 Para pesquisar e preparar o orçamento cobramos uma taxa de {fee}, paga ao enviar o pedido. Não é devolvida se desistir ou se o produto não for encontrado.",
    en: "💡 To research and prepare the quote we charge a {fee} fee, paid when you send the request. It is not refunded if you give up or the product cannot be found.",
    zh: "💡 为查找商品并准备报价，我们收取 {fee} 的费用，在提交需求时支付。如果您放弃或找不到商品，该费用不予退还。",
    fr: "💡 Pour rechercher et préparer le devis, nous facturons {fee}, payés à l'envoi de la demande. Ils ne sont pas remboursés si vous renoncez ou si le produit est introuvable." },
  "im.r_pay_step": { pt: "1. Pague a taxa de pesquisa e orçamento: {fee}", en: "1. Pay the research and quote fee: {fee}", zh: "1. 支付查找和报价费：{fee}", fr: "1. Payez les frais de recherche et de devis : {fee}" },
  "im.r_proof_sent": { pt: "Comprovativo enviado. Assim que for confirmado, a equipa começa a pesquisa.", en: "Proof sent. As soon as it is confirmed, the team starts the research.", zh: "凭证已提交。确认后，团队将开始查找。", fr: "Justificatif envoyé. Dès sa confirmation, l'équipe commence la recherche." },
  "im.r_sent": { pt: "Pedido registado. Pague a taxa de pesquisa (em baixo) para a equipa começar.", en: "Request saved. Pay the research fee (below) so the team can start.", zh: "需求已登记。请支付下方的查找费，团队即可开始。", fr: "Demande enregistrée. Payez les frais de recherche (ci-dessous) pour que l'équipe commence." },
  "im.q_credit": { pt: "Taxa de pesquisa já paga", en: "Research fee already paid", zh: "已付查找费", fr: "Frais de recherche déjà payés" },
  "im.a_research": { pt: "Taxa de pesquisa e orçamento", en: "Research and quote fee", zh: "查找和报价费", fr: "Frais de recherche et de devis" },
  "im.a_research_fee": { pt: "Valor em Kz (0 = sem taxa)", en: "Amount in Kz (0 = no fee)", zh: "金额（Kz，0 = 不收费）", fr: "Montant en Kz (0 = sans frais)" },
  "im.a_research_deduct": { pt: "Descontar no total se o cliente aceitar o orçamento", en: "Deduct from the total if the customer accepts the quote", zh: "客户接受报价时从总价中扣除", fr: "Déduire du total si le client accepte le devis" },
  "im.a_save": { pt: "Guardar", en: "Save", zh: "保存", fr: "Enregistrer" },
  "im.how2": { pt: "2. Orçamento: recebe o preço final (produto + transporte e alfândega + serviço) e o prazo.", en: "2. Quote: you receive the final price (product + shipping and customs + service) and the lead time.", zh: "2. 报价：您将收到最终价格（商品 + 运输和清关 + 服务费）及所需时间。", fr: "2. Devis : vous recevez le prix final (produit + transport et douane + service) et le délai." },
  "im.how3": { pt: "3. Pagamento protegido: paga ao Huambo Online. Se não conseguirmos comprar, devolvemos o dinheiro.", en: "3. Protected payment: you pay Huambo Online. If we can't buy it, we refund you.", zh: "3. 担保支付：您付款给 Huambo Online。如果无法购买，我们将退款。", fr: "3. Paiement protégé : vous payez Huambo Online. Si nous ne pouvons pas acheter, nous vous remboursons." },
  "im.how4": { pt: "4. Acompanhe: comprado → a caminho → chegou ao Huambo → entregue.", en: "4. Track it: bought → on the way → arrived in Huambo → delivered.", zh: "4. 跟踪：已购买 → 运输中 → 已到达万博 → 已交付。", fr: "4. Suivez : acheté → en route → arrivé à Huambo → livré." },
  "im.catalog": { pt: "O que costumamos importar", en: "What we usually import", zh: "我们常代购的商品", fr: "Ce que nous importons souvent" },
  "im.days": { pt: "{min}–{max} dias", en: "{min}–{max} days", zh: "{min}–{max} 天", fr: "{min}–{max} jours" },
  "im.ask_this": { pt: "Pedir orçamento", en: "Request a quote", zh: "申请报价", fr: "Demander un devis" },
  "im.new": { pt: "Pedir um produto", en: "Request a product", zh: "申请代购商品", fr: "Demander un produit" },
  "im.f_title": { pt: "O que procura?", en: "What are you looking for?", zh: "您在找什么？", fr: "Que cherchez-vous ?" },
  "im.f_title_ph": { pt: "Ex.: Painel solar 400 W", en: "E.g. 400 W solar panel", zh: "例如：400 W 太阳能板", fr: "Ex. : panneau solaire 400 W" },
  "im.f_details": { pt: "Detalhes (marca, modelo, tamanho, cor…)", en: "Details (brand, model, size, colour…)", zh: "详情（品牌、型号、尺寸、颜色…）", fr: "Détails (marque, modèle, taille, couleur…)" },
  "im.f_links": { pt: "Ligação do produto (opcional)", en: "Product link (optional)", zh: "商品链接（可选）", fr: "Lien du produit (facultatif)" },
  "im.f_photo": { pt: "Fotografia (opcional)", en: "Photo (optional)", zh: "照片（可选）", fr: "Photo (facultatif)" },
  "im.f_qty": { pt: "Quantidade", en: "Quantity", zh: "数量", fr: "Quantité" },
  "im.f_budget": { pt: "Orçamento máximo em Kz (opcional)", en: "Maximum budget in Kz (optional)", zh: "最高预算（Kz，可选）", fr: "Budget maximum en Kz (facultatif)" },
  "im.f_origin": { pt: "De onde?", en: "From where?", zh: "从哪里？", fr: "D'où ?" },
  "im.f_receive": { pt: "Como recebe?", en: "How will you receive it?", zh: "如何收货？", fr: "Comment le recevoir ?" },
  "im.f_pickup": { pt: "Levanto no Huambo", en: "I'll collect in Huambo", zh: "我在万博自取", fr: "Je récupère à Huambo" },
  "im.f_delivery": { pt: "Entrega na minha morada", en: "Deliver to my address", zh: "送到我的地址", fr: "Livraison à mon adresse" },
  "im.f_address": { pt: "Morada de entrega", en: "Delivery address", zh: "收货地址", fr: "Adresse de livraison" },
  "im.f_phone": { pt: "Telefone", en: "Phone", zh: "电话", fr: "Téléphone" },
  "im.send": { pt: "Enviar pedido", en: "Send request", zh: "提交需求", fr: "Envoyer la demande" },
  "im.sent": { pt: "Pedido enviado. A equipa responde com o orçamento (normalmente em 1 a 2 dias úteis).", en: "Request sent. The team will reply with a quote (usually within 1–2 working days).", zh: "需求已提交。团队将回复报价（通常在 1–2 个工作日内）。", fr: "Demande envoyée. L'équipe répond avec un devis (généralement sous 1 à 2 jours ouvrables)." },
  "im.login": { pt: "Inicie sessão para pedir uma importação.", en: "Sign in to request an import.", zh: "请登录后申请代购。", fr: "Connectez-vous pour demander une importation." },
  "im.mine": { pt: "Os meus pedidos de importação", en: "My import requests", zh: "我的代购需求", fr: "Mes demandes d'importation" },
  "im.none": { pt: "Ainda não fez pedidos.", en: "You haven't made any requests yet.", zh: "您还没有提交需求。", fr: "Vous n'avez encore fait aucune demande." },
  "im.qty_n": { pt: "{n} un.", en: "{n} pcs", zh: "{n} 件", fr: "{n} unité(s)" },
  "im.quote": { pt: "Orçamento", en: "Quote", zh: "报价", fr: "Devis" },
  "im.q_product": { pt: "Produto", en: "Product", zh: "商品", fr: "Produit" },
  "im.q_shipping": { pt: "Transporte e alfândega", en: "Shipping and customs", zh: "运输和清关", fr: "Transport et douane" },
  "im.q_fee": { pt: "Serviço Huambo Online", en: "Huambo Online service", zh: "Huambo Online 服务费", fr: "Service Huambo Online" },
  "im.q_total": { pt: "Total", en: "Total", zh: "合计", fr: "Total" },
  "im.q_eta": { pt: "Prazo: cerca de {n} dias depois do pagamento", en: "Lead time: about {n} days after payment", zh: "时间：付款后约 {n} 天", fr: "Délai : environ {n} jours après le paiement" },
  "im.q_valid": { pt: "Válido até {d}", en: "Valid until {d}", zh: "有效期至 {d}", fr: "Valable jusqu'au {d}" },
  "im.q_expired": { pt: "O orçamento expirou (os preços e o câmbio mudam). Faça um novo pedido.", en: "The quote has expired (prices and exchange rates change). Please make a new request.", zh: "报价已过期（价格和汇率会变化）。请重新提交需求。", fr: "Le devis a expiré (les prix et le change évoluent). Faites une nouvelle demande." },
  "im.accept": { pt: "✅ Aceitar e pagar", en: "✅ Accept and pay", zh: "✅ 接受并付款", fr: "✅ Accepter et payer" },
  "im.cancel": { pt: "Cancelar pedido", en: "Cancel request", zh: "取消需求", fr: "Annuler la demande" },
  "im.cancel_q": { pt: "Cancelar este pedido de importação?", en: "Cancel this import request?", zh: "取消此代购需求？", fr: "Annuler cette demande d'importation ?" },
  "im.pay_step": { pt: "1. Transfira {total} para o Huambo Online", en: "1. Transfer {total} to Huambo Online", zh: "1. 向 Huambo Online 转账 {total}", fr: "1. Virez {total} à Huambo Online" },
  "im.pay_until": { pt: "até {d}", en: "by {d}", zh: "截止 {d}", fr: "avant le {d}" },
  "im.pay_desc": { pt: "No descritivo da transferência escreva: {ref}", en: "In the transfer description write: {ref}", zh: "请在转账备注中填写：{ref}", fr: "Dans le libellé du virement, écrivez : {ref}" },
  "im.pay_expired": { pt: "O prazo para pagar passou. Toque em «Aceitar e pagar» para ter mais tempo.", en: "The payment deadline has passed. Tap «Accept and pay» to get more time.", zh: "付款期限已过。点击「接受并付款」以延长时间。", fr: "Le délai de paiement est dépassé. Touchez « Accepter et payer » pour avoir plus de temps." },
  "im.send_proof": { pt: "2. Envie o comprovativo", en: "2. Send the proof of payment", zh: "2. 上传付款凭证", fr: "2. Envoyez le justificatif" },
  "im.proof_sent": { pt: "Comprovativo enviado. A equipa confirma e começa a compra.", en: "Proof sent. The team will confirm and start the purchase.", zh: "凭证已提交。团队确认后将开始购买。", fr: "Justificatif envoyé. L'équipe confirme et lance l'achat." },
  "im.tracking": { pt: "Rastreio", en: "Tracking", zh: "物流单号", fr: "Suivi" },
  "im.team_note": { pt: "Nota da equipa", en: "Team note", zh: "团队备注", fr: "Note de l'équipe" },
  "im.refund_note": { pt: "O valor pago vai ser devolvido para a sua conta. A equipa entra em contacto.", en: "The amount paid will be refunded to your account. The team will contact you.", zh: "已付款项将退回您的账户。团队会与您联系。", fr: "Le montant payé vous sera remboursé. L'équipe vous contactera." },
  "im.protected": { pt: "🛡️ Paga ao Huambo Online, nunca a terceiros. Se não for possível comprar, devolvemos o dinheiro.", en: "🛡️ You pay Huambo Online, never third parties. If the purchase is not possible, we refund you.", zh: "🛡️ 只付款给 Huambo Online，绝不付给第三方。如无法购买，我们将退款。", fr: "🛡️ Vous payez Huambo Online, jamais des tiers. Si l'achat est impossible, nous vous remboursons." },
  "im.err_title": { pt: "Escreva o produto que procura.", en: "Enter the product you are looking for.", zh: "请填写您要找的商品。", fr: "Indiquez le produit que vous cherchez." },
  "im.err_qty": { pt: "Indique uma quantidade válida.", en: "Enter a valid quantity.", zh: "请填写有效数量。", fr: "Indiquez une quantité valide." },
  "im.err_phone": { pt: "Indique um telefone válido (9 dígitos).", en: "Enter a valid phone number (9 digits).", zh: "请填写有效电话（9 位数字）。", fr: "Indiquez un téléphone valide (9 chiffres)." },
  "im.err_address": { pt: "Escreva a morada de entrega.", en: "Enter the delivery address.", zh: "请填写收货地址。", fr: "Indiquez l'adresse de livraison." },
  "im.err_budget": { pt: "O orçamento máximo tem de ser um número.", en: "The maximum budget must be a number.", zh: "最高预算必须是数字。", fr: "Le budget maximum doit être un nombre." },
  "im.err_proof": { pt: "Junte o comprovativo e escreva o n.º da operação (mínimo 4 caracteres).", en: "Attach the proof and enter the transaction number (at least 4 characters).", zh: "请附上凭证并填写交易编号（至少 4 个字符）。", fr: "Joignez le justificatif et indiquez le n° d'opération (4 caractères minimum)." },
  "im.o.any": { pt: "Qualquer país (o melhor preço)", en: "Any country (best price)", zh: "任何国家（最优价格）", fr: "N'importe quel pays (meilleur prix)" },
  "im.o.china": { pt: "China", en: "China", zh: "中国", fr: "Chine" },
  "im.o.dubai": { pt: "Dubai", en: "Dubai", zh: "迪拜", fr: "Dubaï" },
  "im.o.portugal": { pt: "Portugal", en: "Portugal", zh: "葡萄牙", fr: "Portugal" },
  "im.o.brasil": { pt: "Brasil", en: "Brazil", zh: "巴西", fr: "Brésil" },
  "im.o.africa_sul": { pt: "África do Sul", en: "South Africa", zh: "南非", fr: "Afrique du Sud" },
  "im.o.eua": { pt: "Estados Unidos", en: "United States", zh: "美国", fr: "États-Unis" },
  "im.o.europa": { pt: "Europa", en: "Europe", zh: "欧洲", fr: "Europe" },
  "im.s.research_payment": { pt: "💳 Por pagar a taxa de pesquisa", en: "💳 Research fee to pay", zh: "💳 待付查找费", fr: "💳 Frais de recherche à payer" },
  "im.s.research_submitted": { pt: "🔎 Taxa de pesquisa a confirmar", en: "🔎 Research fee being confirmed", zh: "🔎 查找费确认中", fr: "🔎 Frais de recherche en vérification" },
  "im.s.requested": { pt: "⏳ Em pesquisa — à espera do orçamento", en: "⏳ Researching — waiting for a quote", zh: "⏳ 查找中 — 等待报价", fr: "⏳ Recherche en cours — en attente du devis" },
  "im.s.quoted": { pt: "💬 Orçamento recebido", en: "💬 Quote received", zh: "💬 已收到报价", fr: "💬 Devis reçu" },
  "im.s.awaiting_payment": { pt: "💳 Por pagar", en: "💳 Awaiting payment", zh: "💳 待付款", fr: "💳 À payer" },
  "im.s.submitted": { pt: "🔎 Pagamento a confirmar", en: "🔎 Payment being confirmed", zh: "🔎 付款确认中", fr: "🔎 Paiement en cours de vérification" },
  "im.s.paid": { pt: "🛡️ Pago — a comprar", en: "🛡️ Paid — buying", zh: "🛡️ 已付款 — 采购中", fr: "🛡️ Payé — achat en cours" },
  "im.s.purchased": { pt: "🛒 Comprado", en: "🛒 Bought", zh: "🛒 已购买", fr: "🛒 Acheté" },
  "im.s.in_transit": { pt: "✈️ A caminho", en: "✈️ On the way", zh: "✈️ 运输中", fr: "✈️ En route" },
  "im.s.arrived": { pt: "📍 Chegou ao Huambo", en: "📍 Arrived in Huambo", zh: "📍 已到达万博", fr: "📍 Arrivé à Huambo" },
  "im.s.delivered": { pt: "✅ Entregue", en: "✅ Delivered", zh: "✅ 已交付", fr: "✅ Livré" },
  "im.s.declined": { pt: "❌ Não disponível", en: "❌ Not available", zh: "❌ 无法提供", fr: "❌ Non disponible" },
  "im.s.cancelled": { pt: "Cancelado", en: "Cancelled", zh: "已取消", fr: "Annulé" },
  "im.s.refunded": { pt: "↩️ Cancelado — dinheiro devolvido", en: "↩️ Cancelled — money refunded", zh: "↩️ 已取消 — 已退款", fr: "↩️ Annulé — remboursé" },
  // Equipa
  "im.a_title": { pt: "✈️ Pedidos de importação", en: "✈️ Import requests", zh: "✈️ 代购需求", fr: "✈️ Demandes d'importation" },
  "im.a_open": { pt: "Em curso", en: "In progress", zh: "进行中", fr: "En cours" },
  "im.a_all": { pt: "Todos", en: "All", zh: "全部", fr: "Tous" },
  "im.a_quote": { pt: "Enviar orçamento", en: "Send quote", zh: "发送报价", fr: "Envoyer le devis" },
  "im.a_requote": { pt: "Refazer orçamento", en: "Redo quote", zh: "重新报价", fr: "Refaire le devis" },
  "im.a_fee_hint": { pt: "Sugestão: {fee} (10%)", en: "Suggested: {fee} (10%)", zh: "建议：{fee}（10%）", fr: "Suggestion : {fee} (10 %)" },
  "im.a_eta": { pt: "Prazo (dias)", en: "Lead time (days)", zh: "时间（天）", fr: "Délai (jours)" },
  "im.a_note": { pt: "Nota para o cliente (opcional)", en: "Note for the customer (optional)", zh: "给客户的备注（可选）", fr: "Note pour le client (facultatif)" },
  "im.a_decline": { pt: "Não é possível", en: "Not possible", zh: "无法办理", fr: "Pas possible" },
  "im.a_decline_q": { pt: "Porque não é possível? (o cliente vê esta nota)", en: "Why is it not possible? (the customer sees this note)", zh: "为什么无法办理？（客户会看到此备注）", fr: "Pourquoi n'est-ce pas possible ? (le client voit cette note)" },
  "im.a_mark": { pt: "Marcar: {s}", en: "Mark: {s}", zh: "标记：{s}", fr: "Marquer : {s}" },
  "im.a_tracking_q": { pt: "N.º de rastreio (opcional):", en: "Tracking number (optional):", zh: "物流单号（可选）：", fr: "N° de suivi (facultatif) :" },
  "im.a_refund_q": { pt: "Motivo da devolução (o cliente vê esta nota):", en: "Reason for the refund (the customer sees this note):", zh: "退款原因（客户会看到此备注）：", fr: "Motif du remboursement (le client voit cette note) :" },
  "im.a_proof": { pt: "Ver comprovativo", en: "See proof", zh: "查看凭证", fr: "Voir le justificatif" },
  "im.a_catalog": { pt: "Catálogo de importação", en: "Import catalogue", zh: "代购目录", fr: "Catalogue d'importation" },
  "im.a_add": { pt: "Adicionar ao catálogo", en: "Add to catalogue", zh: "添加到目录", fr: "Ajouter au catalogue" },
  "im.a_hide": { pt: "Esconder", en: "Hide", zh: "隐藏", fr: "Masquer" },
  "im.a_new": { pt: "➕ Novo artigo do catálogo", en: "➕ New catalogue item", zh: "➕ 新目录项目", fr: "➕ Nouvel article du catalogue" },
  "im.a_editing": { pt: "✏️ A editar: {t}", en: "✏️ Editing: {t}", zh: "✏️ 正在编辑：{t}", fr: "✏️ Modification : {t}" },
  "im.a_edit": { pt: "✏️ Editar", en: "✏️ Edit", zh: "✏️ 编辑", fr: "✏️ Modifier" },
  "im.a_delete": { pt: "🗑️ Apagar", en: "🗑️ Delete", zh: "🗑️ 删除", fr: "🗑️ Supprimer" },
  "im.a_delete_q": { pt: "Apagar «{t}» do catálogo? Os pedidos já feitos continuam. Para só o tirar da página, use «Esconder».", en: "Delete «{t}» from the catalogue? Requests already made remain. To just remove it from the page, use «Hide».", zh: "从目录中删除「{t}」？已提交的请求会保留。如只想从页面移除，请用「隐藏」。", fr: "Supprimer «{t}» du catalogue ? Les demandes déjà faites restent. Pour seulement le retirer de la page, utilisez «Masquer»." },
  "im.a_save_changes": { pt: "Guardar alterações", en: "Save changes", zh: "保存更改", fr: "Enregistrer les modifications" },
  "im.a_cancel": { pt: "Cancelar", en: "Cancel", zh: "取消", fr: "Annuler" },
  "im.a_saved": { pt: "Guardado.", en: "Saved.", zh: "已保存。", fr: "Enregistré." },
  "im.a_deleted": { pt: "Apagado do catálogo.", en: "Deleted from the catalogue.", zh: "已从目录中删除。", fr: "Supprimé du catalogue." },
  "im.a_icon": { pt: "Ícone", en: "Icon", zh: "图标", fr: "Icône" },
  "im.a_days_min": { pt: "Prazo mínimo (dias)", en: "Minimum time (days)", zh: "最短时间（天）", fr: "Délai minimum (jours)" },
  "im.a_days_max": { pt: "Prazo máximo (dias)", en: "Maximum time (days)", zh: "最长时间（天）", fr: "Délai maximum (jours)" },
  "im.a_sort": { pt: "Ordem (o número mais baixo aparece primeiro)", en: "Order (lowest number shows first)", zh: "顺序（数字越小越靠前）", fr: "Ordre (le plus petit nombre apparaît en premier)" },
  "im.a_show": { pt: "Mostrar", en: "Show", zh: "显示", fr: "Afficher" }
};
