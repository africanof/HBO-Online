import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "./i18n";

/**
 * 🔍 Inspeção de artigos pela equipa do Huambo Online (anúncios e produtos da Loja).
 * Vendedor: pede antes de vender → selo «Inspecionado pelo Huambo Online» com relatório (90 dias).
 * Comprador: junta à compra protegida → o dinheiro só segue se a inspeção aprovar; se não aprovar, é reembolsado.
 * Textos: ITEM_INSPECTION_DICT (chaves «ii.*»).
 */
export type ItemInspectionCategory = "item" | "vehicle" | "property";
export type ItemInspectionStatus = "awaiting_payment" | "payment_submitted" | "paid" | "scheduled" | "in_progress" | "approved" | "failed" | "handed_over" | "cancelled";
export type ItemInspection = {
  id: string; ref_no: number; mode: "seller" | "buyer"; category: ItemInspectionCategory; listing_id: string | null; product_id: string | null; order_id: string | null;
  requester_id: string; seller_id: string; title: string | null; status: ItemInspectionStatus; fee: number; pay_by: string | null; pay_reference: string | null;
  pay_proof_path?: string | null; note: string | null; scheduled_for: string | null; place: string | null; checklist: Record<string, boolean>; report: string | null;
  photos: string[]; inspected_at: string | null; valid_until: string | null; handed_over_at: string | null; team_note: string | null; created_at: string; updated_at: string;
  role?: "requester" | "seller"; requester_name?: string | null; seller_name?: string | null;
};
export type ItemInspectionBadge = { ref_no: number; category: ItemInspectionCategory; inspected_at: string; valid_until: string; checklist: Record<string, boolean>; report: string | null; photos: string[] };

/** Pontos verificados por tipo (os textos estão em «ii.c.<chave>»). */
export const ITEM_INSPECTION_CHECKLIST: Record<ItemInspectionCategory, string[]> = {
  item: ["powers_on", "screen", "battery", "camera_sound", "software", "imei", "accessories", "condition"],
  vehicle: ["engine", "gearbox", "brakes", "suspension", "tyres", "electrics", "body", "mileage", "numbers", "documents", "insurance", "liens"],
  property: ["location", "structure", "utilities", "finishes", "title_deed", "plans", "owner", "disputes", "occupancy"]
};
/** Tipo de inspeção a partir do tipo de anúncio. */
export function itemInspectionCategory(listingType: string | null | undefined): ItemInspectionCategory {
  return listingType === "vehicle" ? "vehicle" : listingType === "real_estate" ? "property" : "item";
}
export const itemInspectionRef = (n: number | null | undefined) => (n ? "INS-" + n : "");
export const ITEM_INSPECTION_OPEN: ItemInspectionStatus[] = ["awaiting_payment", "payment_submitted", "paid", "scheduled", "in_progress"];
const num = (x: any): ItemInspection => ({ ...x, fee: Number(x.fee ?? 0), checklist: x.checklist ?? {}, photos: x.photos ?? [] });

export type ItemInspectionFees = Record<ItemInspectionCategory, number>;
export async function getItemInspectionFees(client: SupabaseClient): Promise<ItemInspectionFees> {
  const r = await client.from("platform_settings").select("item_inspection_fee_item,item_inspection_fee_vehicle,item_inspection_fee_property").eq("id", 1).maybeSingle();
  const d = (r.data ?? {}) as any;
  return { item: Number(d.item_inspection_fee_item ?? 2000), vehicle: Number(d.item_inspection_fee_vehicle ?? 10000), property: Number(d.item_inspection_fee_property ?? 20000) };
}
export function requestItemInspection(client: SupabaseClient, t: { listingId?: string | null; productId?: string | null; orderId?: string | null; note?: string }) {
  return client.rpc("request_item_inspection", { p_listing_id: t.listingId ?? null, p_product_id: t.productId ?? null, p_order_id: t.orderId ?? null, p_note: t.note?.trim() || null });
}
export function submitItemInspectionPayment(client: SupabaseClient, id: string, i: { method: "bank_transfer" | "multicaixa_express"; reference: string; proofPath: string; proofHash?: string | null }) {
  return client.rpc("submit_item_inspection_payment", { p_id: id, p_method: i.method, p_reference: i.reference.trim(), p_proof_path: i.proofPath, p_proof_hash: i.proofHash || null });
}
export const cancelItemInspection = (client: SupabaseClient, id: string) => client.rpc("cancel_item_inspection", { p_id: id });
export async function myItemInspections(client: SupabaseClient) {
  const r = await client.rpc("my_item_inspections");
  return { data: ((r.data ?? []) as any[]).map(num), error: r.error };
}
export async function itemInspectionBadge(client: SupabaseClient, t: { listingId?: string | null; productId?: string | null }): Promise<ItemInspectionBadge | null> {
  const r = await client.rpc("item_inspection_badge", { p_listing_id: t.listingId ?? null, p_product_id: t.productId ?? null });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return row ? { ...row, checklist: row.checklist ?? {}, photos: row.photos ?? [] } : null;
}
// Equipa
export async function listItemInspectionsForAdmin(client: SupabaseClient, open = true) {
  const r = await client.rpc("admin_list_item_inspections", { p_open: open });
  return { data: ((r.data ?? []) as any[]).map(num), error: r.error };
}
export const decideItemInspectionPayment = (client: SupabaseClient, id: string, confirm: boolean, note?: string | null) =>
  client.rpc("decide_item_inspection_payment", { p_id: id, p_confirm: confirm, p_note: note?.trim() || null });
export type ItemInspectionStep = "schedule" | "start" | "approve" | "fail" | "handover";
export function itemInspectionStep(client: SupabaseClient, id: string, step: ItemInspectionStep, x: { when?: string | null; place?: string; checklist?: Record<string, boolean>; report?: string; photos?: string[]; note?: string } = {}) {
  if ((step === "approve" || step === "fail") && (x.report ?? "").trim().length < 10) return Promise.resolve({ data: null, error: new Error("REPORT_REQUIRED") });
  if (step === "schedule" && !x.when) return Promise.resolve({ data: null, error: new Error("INVALID_INPUT") });
  return client.rpc("admin_item_inspection_step", { p_id: id, p_step: step, p_when: x.when ?? null, p_place: x.place?.trim() || null, p_checklist: x.checklist ?? null,
    p_report: x.report?.trim() || null, p_photos: x.photos ?? null, p_note: x.note?.trim() || null });
}
export function setItemInspectionFees(client: SupabaseClient, f: ItemInspectionFees) {
  return client.rpc("admin_set_item_inspection_fees", { p_item: f.item, p_vehicle: f.vehicle, p_property: f.property });
}
/** Próximos passos da equipa para cada estado. */
export function itemInspectionAdminSteps(i: Pick<ItemInspection, "status" | "mode">): ItemInspectionStep[] {
  switch (i.status) {
    case "paid": return ["schedule", "start"];
    case "scheduled": return ["schedule", "start", "approve", "fail"];
    case "in_progress": return ["approve", "fail"];
    case "approved": return i.mode === "buyer" ? ["handover"] : [];
    default: return [];
  }
}

export const ITEM_INSPECTION_DICT: Dictionary = {
  "ii.badge": { pt: "🔍 Inspecionado pelo Huambo Online", en: "🔍 Inspected by Huambo Online", zh: "🔍 经 Huambo Online 检验", fr: "🔍 Inspecté par Huambo Online" },
  "ii.badge_when": { pt: "Inspecionado em {d} · válido até {v}", en: "Inspected on {d} · valid until {v}", zh: "检验于 {d} · 有效期至 {v}", fr: "Inspecté le {d} · valable jusqu'au {v}" },
  "ii.report": { pt: "Relatório da inspeção", en: "Inspection report", zh: "检验报告", fr: "Rapport d'inspection" },
  "ii.title": { pt: "🔍 Inspeção pelo Huambo Online", en: "🔍 Inspection by Huambo Online", zh: "🔍 Huambo Online 检验", fr: "🔍 Inspection par Huambo Online" },
  "ii.how.item": { pt: "O artigo é entregue à equipa, que verifica o hardware e o software (liga, ecrã, bateria, bloqueios, IMEI…).", en: "The item is handed to the team, which checks hardware and software (power, screen, battery, locks, IMEI…).", zh: "商品交给团队，检查硬件和软件（开机、屏幕、电池、锁定、IMEI…）。", fr: "L'article est remis à l'équipe, qui vérifie le matériel et le logiciel (allumage, écran, batterie, blocages, IMEI…)." },
  "ii.how.vehicle": { pt: "A equipa vê a mecânica (motor, caixa, travões, pneus…) e os documentos (livrete, título, seguro, penhoras).", en: "The team checks the mechanics (engine, gearbox, brakes, tyres…) and the documents (registration, title, insurance, liens).", zh: "团队检查机械（发动机、变速箱、刹车、轮胎…）和文件（行驶证、产权、保险、抵押）。", fr: "L'équipe vérifie la mécanique (moteur, boîte, freins, pneus…) et les documents (carte grise, titre, assurance, gages)." },
  "ii.how.property": { pt: "A equipa confirma a situação física (estrutura, água, luz) e a legal (registo predial, licenças, dono, dívidas).", en: "The team confirms the physical condition (structure, water, power) and the legal status (land registry, permits, owner, debts).", zh: "团队确认实际状况（结构、水、电）和法律状况（产权登记、许可、业主、债务）。", fr: "L'équipe confirme l'état physique (structure, eau, électricité) et la situation légale (registre foncier, permis, propriétaire, dettes)." },
  "ii.seller_offer": { pt: "Mostre aos compradores que o artigo está bom: peça a inspeção ({fee}) e o anúncio ganha o selo com o relatório.", en: "Show buyers the item is good: request an inspection ({fee}) and the listing gets the badge with the report.", zh: "向买家证明商品状况良好：申请检验（{fee}），信息将获得徽章和报告。", fr: "Montrez aux acheteurs que l'article est bon : demandez une inspection ({fee}) et l'annonce reçoit le badge avec le rapport." },
  "ii.buyer_offer": { pt: "Antes de receber, a equipa inspeciona o artigo ({fee}). Se não aprovar, recebe o dinheiro de volta.", en: "Before you receive it, the team inspects the item ({fee}). If it fails, you get your money back.", zh: "收货前由团队检验商品（{fee}）。如果不合格，您将获得退款。", fr: "Avant la remise, l'équipe inspecte l'article ({fee}). S'il n'est pas approuvé, vous êtes remboursé." },
  "ii.request": { pt: "🔍 Pedir inspeção · {fee}", en: "🔍 Request inspection · {fee}", zh: "🔍 申请检验 · {fee}", fr: "🔍 Demander une inspection · {fee}" },
  "ii.requested": { pt: "Pedido criado. Pague a taxa em «As minhas inspeções».", en: "Request created. Pay the fee in «My inspections».", zh: "申请已创建。请在「我的检验」中支付费用。", fr: "Demande créée. Payez les frais dans « Mes inspections »." },
  "ii.see_mine": { pt: "As minhas inspeções", en: "My inspections", zh: "我的检验", fr: "Mes inspections" },
  "ii.none": { pt: "Ainda não tem inspeções.", en: "You have no inspections yet.", zh: "您还没有检验。", fr: "Vous n'avez encore aucune inspection." },
  "ii.pay_step": { pt: "1. Pague a taxa de inspeção: {fee}", en: "1. Pay the inspection fee: {fee}", zh: "1. 支付检验费：{fee}", fr: "1. Payez les frais d'inspection : {fee}" },
  "ii.pay_desc": { pt: "No descritivo da transferência escreva: {ref}", en: "In the transfer description write: {ref}", zh: "请在转账备注中填写：{ref}", fr: "Dans le libellé du virement, écrivez : {ref}" },
  "ii.fee_note": { pt: "A taxa paga a deslocação e o trabalho da equipa. Não é devolvida se o artigo não for aprovado.", en: "The fee covers the team's travel and work. It is not refunded if the item fails.", zh: "该费用用于团队的出行和工作。如果商品不合格，费用不予退还。", fr: "Les frais couvrent le déplacement et le travail de l'équipe. Ils ne sont pas remboursés si l'article n'est pas approuvé." },
  "ii.proof_sent": { pt: "Comprovativo enviado. A equipa confirma e marca a inspeção.", en: "Proof sent. The team will confirm and schedule the inspection.", zh: "凭证已提交。团队确认后将安排检验。", fr: "Justificatif envoyé. L'équipe confirme et planifie l'inspection." },
  "ii.when": { pt: "📅 {d}", en: "📅 {d}", zh: "📅 {d}", fr: "📅 {d}" },
  "ii.mode.seller": { pt: "Para o meu anúncio", en: "For my listing", zh: "用于我的信息", fr: "Pour mon annonce" },
  "ii.mode.buyer": { pt: "Antes de receber a compra", en: "Before receiving the purchase", zh: "收货前", fr: "Avant de recevoir l'achat" },
  "ii.mode.seller_of": { pt: "O comprador pediu inspeção", en: "The buyer requested an inspection", zh: "买家申请了检验", fr: "L'acheteur a demandé une inspection" },
  "ii.cat.item": { pt: "📱 Artigo / eletrónico", en: "📱 Item / electronics", zh: "📱 商品 / 电子产品", fr: "📱 Article / électronique" },
  "ii.cat.vehicle": { pt: "🚗 Viatura", en: "🚗 Vehicle", zh: "🚗 车辆", fr: "🚗 Véhicule" },
  "ii.cat.property": { pt: "🏠 Imóvel / terreno", en: "🏠 Property / land", zh: "🏠 房产 / 土地", fr: "🏠 Bien immobilier / terrain" },
  "ii.s.awaiting_payment": { pt: "💳 Por pagar a taxa", en: "💳 Fee to pay", zh: "💳 待付费用", fr: "💳 Frais à payer" },
  "ii.s.payment_submitted": { pt: "🔎 Pagamento a confirmar", en: "🔎 Payment being confirmed", zh: "🔎 付款确认中", fr: "🔎 Paiement en vérification" },
  "ii.s.paid": { pt: "✅ Pago — a marcar", en: "✅ Paid — being scheduled", zh: "✅ 已付款 — 安排中", fr: "✅ Payé — à planifier" },
  "ii.s.scheduled": { pt: "📅 Marcada", en: "📅 Scheduled", zh: "📅 已安排", fr: "📅 Planifiée" },
  "ii.s.in_progress": { pt: "🔧 Em inspeção", en: "🔧 Being inspected", zh: "🔧 检验中", fr: "🔧 En cours d'inspection" },
  "ii.s.approved": { pt: "✅ Aprovada", en: "✅ Approved", zh: "✅ 合格", fr: "✅ Approuvée" },
  "ii.s.failed": { pt: "❌ Não aprovada", en: "❌ Not approved", zh: "❌ 不合格", fr: "❌ Non approuvée" },
  "ii.s.handed_over": { pt: "📦 Entregue / propriedade transferida", en: "📦 Handed over / ownership transferred", zh: "📦 已交付 / 产权已转移", fr: "📦 Remis / propriété transférée" },
  "ii.s.cancelled": { pt: "Cancelada", en: "Cancelled", zh: "已取消", fr: "Annulée" },
  "ii.cancel": { pt: "Cancelar inspeção", en: "Cancel inspection", zh: "取消检验", fr: "Annuler l'inspection" },
  "ii.c.powers_on": { pt: "Liga e funciona", en: "Powers on and works", zh: "可开机并正常使用", fr: "S'allume et fonctionne" },
  "ii.c.screen": { pt: "Ecrã sem defeitos", en: "Screen without defects", zh: "屏幕无缺陷", fr: "Écran sans défaut" },
  "ii.c.battery": { pt: "Bateria em bom estado", en: "Battery in good condition", zh: "电池状况良好", fr: "Batterie en bon état" },
  "ii.c.camera_sound": { pt: "Câmaras, som e botões funcionam", en: "Cameras, sound and buttons work", zh: "摄像头、声音和按键正常", fr: "Caméras, son et boutons fonctionnent" },
  "ii.c.software": { pt: "Software sem bloqueios (conta, iCloud, FRP)", en: "Software without locks (account, iCloud, FRP)", zh: "软件无锁定（账户、iCloud、FRP）", fr: "Logiciel sans blocage (compte, iCloud, FRP)" },
  "ii.c.imei": { pt: "IMEI / n.º de série sem bloqueio nem roubo", en: "IMEI / serial not blocked or stolen", zh: "IMEI / 序列号未被锁定或报失", fr: "IMEI / n° de série ni bloqué ni volé" },
  "ii.c.accessories": { pt: "Acessórios como anunciado", en: "Accessories as advertised", zh: "配件与描述相符", fr: "Accessoires comme annoncé" },
  "ii.c.condition": { pt: "Estado físico como anunciado", en: "Physical condition as advertised", zh: "外观状况与描述相符", fr: "État physique comme annoncé" },
  "ii.c.engine": { pt: "Motor", en: "Engine", zh: "发动机", fr: "Moteur" },
  "ii.c.gearbox": { pt: "Caixa de velocidades", en: "Gearbox", zh: "变速箱", fr: "Boîte de vitesses" },
  "ii.c.brakes": { pt: "Travões", en: "Brakes", zh: "刹车", fr: "Freins" },
  "ii.c.suspension": { pt: "Suspensão e direção", en: "Suspension and steering", zh: "悬挂和转向", fr: "Suspension et direction" },
  "ii.c.tyres": { pt: "Pneus", en: "Tyres", zh: "轮胎", fr: "Pneus" },
  "ii.c.electrics": { pt: "Luzes e parte elétrica", en: "Lights and electrics", zh: "灯光和电气", fr: "Éclairage et électricité" },
  "ii.c.body": { pt: "Carroçaria e chassis sem danos graves", en: "Body and chassis without serious damage", zh: "车身和底盘无严重损坏", fr: "Carrosserie et châssis sans dégâts graves" },
  "ii.c.mileage": { pt: "Quilometragem compatível", en: "Plausible mileage", zh: "里程合理", fr: "Kilométrage cohérent" },
  "ii.c.numbers": { pt: "N.º de chassis e motor conferem com os documentos", en: "Chassis and engine numbers match the documents", zh: "车架号和发动机号与文件一致", fr: "N° de châssis et moteur conformes aux documents" },
  "ii.c.documents": { pt: "Livrete / título em nome do vendedor", en: "Registration / title in the seller's name", zh: "行驶证 / 产权在卖家名下", fr: "Carte grise / titre au nom du vendeur" },
  "ii.c.insurance": { pt: "Seguro e inspeção periódica", en: "Insurance and roadworthiness test", zh: "保险和定期检验", fr: "Assurance et contrôle technique" },
  "ii.c.liens": { pt: "Sem penhoras, multas ou dívidas conhecidas", en: "No known liens, fines or debts", zh: "无已知抵押、罚款或债务", fr: "Sans gage, amende ou dette connus" },
  "ii.c.location": { pt: "Localização e limites conferem", en: "Location and boundaries match", zh: "位置和边界一致", fr: "Emplacement et limites conformes" },
  "ii.c.structure": { pt: "Estrutura, paredes e telhado", en: "Structure, walls and roof", zh: "结构、墙体和屋顶", fr: "Structure, murs et toit" },
  "ii.c.utilities": { pt: "Água, luz e saneamento", en: "Water, power and sanitation", zh: "水、电和卫生设施", fr: "Eau, électricité et assainissement" },
  "ii.c.finishes": { pt: "Acabamentos como anunciado", en: "Finishes as advertised", zh: "装修与描述相符", fr: "Finitions comme annoncé" },
  "ii.c.title_deed": { pt: "Registo predial / título em nome do vendedor", en: "Land registry / title in the seller's name", zh: "产权登记在卖家名下", fr: "Registre foncier / titre au nom du vendeur" },
  "ii.c.plans": { pt: "Planta e licenças", en: "Plans and permits", zh: "图纸和许可", fr: "Plans et permis" },
  "ii.c.owner": { pt: "Proprietário confirmado", en: "Owner confirmed", zh: "业主已确认", fr: "Propriétaire confirmé" },
  "ii.c.disputes": { pt: "Sem litígios, hipotecas ou dívidas conhecidas", en: "No known disputes, mortgages or debts", zh: "无已知纠纷、抵押或债务", fr: "Sans litige, hypothèque ou dette connus" },
  "ii.c.occupancy": { pt: "Livre de ocupantes (ou como anunciado)", en: "Free of occupants (or as advertised)", zh: "无人占用（或与描述相符）", fr: "Libre d'occupants (ou comme annoncé)" },
  // Equipa
  "ii.a_title": { pt: "🔍 Inspeções de artigos", en: "🔍 Item inspections", zh: "🔍 商品检验", fr: "🔍 Inspections d'articles" },
  "ii.a_fees": { pt: "Taxas de inspeção (Kz)", en: "Inspection fees (Kz)", zh: "检验费（Kz）", fr: "Frais d'inspection (Kz)" },
  "ii.a_when": { pt: "Data e hora", en: "Date and time", zh: "日期和时间", fr: "Date et heure" },
  "ii.a_place": { pt: "Local (ponto de entrega ou morada da visita)", en: "Place (drop-off point or visit address)", zh: "地点（交付点或上门地址）", fr: "Lieu (point de dépôt ou adresse de la visite)" },
  "ii.a_report": { pt: "Relatório (o cliente vê)", en: "Report (the customer sees it)", zh: "报告（客户可见）", fr: "Rapport (le client le voit)" },
  "ii.step.schedule": { pt: "📅 Marcar", en: "📅 Schedule", zh: "📅 安排", fr: "📅 Planifier" },
  "ii.step.start": { pt: "🔧 Começar inspeção", en: "🔧 Start inspection", zh: "🔧 开始检验", fr: "🔧 Commencer l'inspection" },
  "ii.step.approve": { pt: "✅ Aprovar", en: "✅ Approve", zh: "✅ 合格", fr: "✅ Approuver" },
  "ii.step.fail": { pt: "❌ Não aprovar", en: "❌ Fail", zh: "❌ 不合格", fr: "❌ Refuser" },
  "ii.step.handover": { pt: "📦 Entregue ao comprador / propriedade transferida", en: "📦 Handed to buyer / ownership transferred", zh: "📦 已交给买家 / 产权已转移", fr: "📦 Remis à l'acheteur / propriété transférée" },
  "ii.a_buyer_mode": { pt: "Compra com inspeção: o dinheiro fica retido até ao fim; se não aprovar, abre-se o reembolso ao comprador.", en: "Purchase with inspection: money is held until the end; if it fails, a refund to the buyer is opened.", zh: "带检验的购买：款项保留至结束；如不合格，将为买家发起退款。", fr: "Achat avec inspection : l'argent est retenu jusqu'à la fin ; en cas d'échec, un remboursement est ouvert pour l'acheteur." }
};
