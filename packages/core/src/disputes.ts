import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Disputas, devoluções e reembolsos das encomendas da Loja (igual no Site e na APP).
 * O comprador pede; o vendedor aceita ou recusa; a administração decide se não se entenderem.
 * O dinheiro é devolvido fora da plataforma: o vendedor marca «reembolso enviado» e o comprador confirma.
 */

export type DisputeRequest = "refund" | "return_refund" | "replacement";
export type DisputeReason = "not_received" | "damaged" | "not_as_described" | "wrong_item" | "missing_items" | "other" | "seller_cancelled";
export type DisputeStatus = "open" | "declined" | "awaiting_return" | "returned" | "awaiting_refund" | "refund_sent" | "replacing" | "escalated" | "resolved";
export type DisputeOutcome = "refunded" | "replaced" | "rejected" | "withdrawn";
export type DisputeAction = "accept" | "decline" | "mark_returned" | "confirm_return" | "mark_refunded" | "confirm_refund" | "confirm_replacement" | "escalate" | "withdraw" | "comment";
export type DisputeDecision = "refund" | "return_refund" | "replacement" | "reject";
export type DisputeRole = "buyer" | "seller";
export type DisputeEvent = { actor_role: DisputeRole | "admin" | "system"; action: string; note: string | null; photos: string[]; created_at: string };
export type MyDispute = {
  id: string; order_id: string; my_role: DisputeRole; other_name: string; request: DisputeRequest; reason: DisputeReason; description: string | null;
  amount: number | string | null; status: DisputeStatus; outcome: DisputeOutcome | null; admin_note: string | null; created_at: string; updated_at: string;
  order_total: number | string; order_items: { name: string; quantity: number }[]; events: DisputeEvent[];
};
export type AdminDispute = Omit<MyDispute, "my_role" | "other_name" | "order_items"> & {
  buyer_id: string; buyer_name: string; seller_id: string; seller_name: string; payment_method: string | null; order_status: string;
};

export const DISPUTE_REQUEST_LABELS: Record<DisputeRequest, string> = {
  refund: "Reembolso (devolver o dinheiro)", return_refund: "Devolver o artigo e receber o dinheiro", replacement: "Trocar por outro igual"
};
export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  not_received: "Não recebi a encomenda", damaged: "Chegou estragado ou partido", not_as_described: "Diferente do anúncio",
  wrong_item: "Artigo errado (modelo, tamanho, cor)", missing_items: "Faltam artigos", other: "Outro motivo", seller_cancelled: "Encomenda paga e cancelada"
};
export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "À espera do vendedor", declined: "Recusado pelo vendedor", awaiting_return: "À espera da devolução do artigo",
  returned: "Artigo devolvido — o vendedor confirma a receção", awaiting_refund: "À espera do reembolso", refund_sent: "Reembolso enviado — confirme se recebeu",
  replacing: "O vendedor vai enviar outro artigo", escalated: "Em análise pela administração", resolved: "Fechado"
};
export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  refunded: "Reembolsado ✔", replaced: "Artigo trocado ✔", rejected: "Recusado pela administração", withdrawn: "O comprador desistiu"
};
export const DISPUTE_ACTION_LABELS: Record<DisputeAction, string> = {
  accept: "✔ Aceitar o pedido", decline: "✖ Recusar", mark_returned: "📦 Já devolvi o artigo", confirm_return: "✔ Recebi o artigo devolvido",
  mark_refunded: "💸 Já devolvi o dinheiro", confirm_refund: "✔ Recebi o dinheiro", confirm_replacement: "✔ Recebi o artigo novo",
  escalate: "⚖️ Chamar a administração", withdraw: "Desistir do pedido", comment: "Enviar mensagem"
};
export const DISPUTE_DECISION_LABELS: Record<DisputeDecision, string> = {
  refund: "Reembolso ao comprador", return_refund: "Devolver o artigo e reembolsar", replacement: "Trocar o artigo", reject: "Recusar o pedido (dar razão ao vendedor)"
};
const EVENT_LABELS: Record<string, string> = {
  opened: "Pedido aberto", accepted: "Pedido aceite", declined: "Pedido recusado", returned: "Artigo devolvido", return_received: "Devolução recebida",
  refund_sent: "Reembolso enviado", refund_confirmed: "Reembolso recebido", replacement_received: "Artigo novo recebido", escalated: "Enviado à administração",
  decided: "Decisão da administração", withdrawn: "Pedido retirado", comment: "Mensagem", auto_refund: "Reembolso automático"
};
const ROLE_NAMES: Record<string, string> = { buyer: "Comprador", seller: "Vendedor", admin: "Administração", system: "Huambo Online" };
export function disputeEventLabel(e: Pick<DisputeEvent, "actor_role" | "action">): string {
  return `${ROLE_NAMES[e.actor_role] ?? e.actor_role} · ${EVENT_LABELS[e.action] ?? e.action}`;
}

/** Dias para pedir depois de a encomenda ser concluída, e dias sem resposta para chamar a administração. */
export const DISPUTE_WINDOW_DAYS = 14;
export const DISPUTE_ESCALATE_DAYS = 3;
export const DISPUTE_BUCKET = "dispute-evidence";
export const DISPUTE_MAX_PHOTOS = 4;
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE: DisputeStatus[] = ["open", "declined", "awaiting_return", "returned", "awaiting_refund", "refund_sent", "replacing", "escalated"];
export const isActiveDispute = (s: DisputeStatus) => ACTIVE.includes(s);

/** Motivos que o comprador pode escolher e os pedidos que fazem sentido para cada um. */
export const BUYER_REASONS: Exclude<DisputeReason, "seller_cancelled">[] = ["not_received", "damaged", "not_as_described", "wrong_item", "missing_items", "other"];
export function requestsFor(reason: DisputeReason): DisputeRequest[] {
  return reason === "not_received" ? ["refund"] : ["return_refund", "refund", "replacement"];
}

type OrderLike = { status: string; payment_status: string; total: number | string; refunded_amount?: number | string | null; completed_at?: string | null; updated_at?: string | null; created_at?: string };
/** Pode o comprador pedir devolução/reembolso desta encomenda? Devolve o motivo se não puder. */
export function canOpenDispute(o: OrderLike, existing: Pick<MyDispute, "status" | "outcome">[] = [], now = Date.now()): { ok: true } | { ok: false; why: string } {
  if (o.status === "pending") return { ok: false, why: "A encomenda ainda está pendente: pode cancelá-la." };
  if (o.status === "cancelled") return { ok: false, why: "Encomenda cancelada." };
  if (o.status !== "completed" && o.payment_status !== "paid") return { ok: false, why: "Ainda não pagou esta encomenda." };
  if (existing.some(d => isActiveDispute(d.status))) return { ok: false, why: "Já tem um pedido aberto para esta encomenda." };
  if (existing.some(d => d.outcome && d.outcome !== "withdrawn")) return { ok: false, why: "Esta encomenda já teve um pedido decidido." };
  if (o.status === "completed") {
    const done = Date.parse(o.completed_at || o.updated_at || "");
    if (Number.isFinite(done) && now - done > DISPUTE_WINDOW_DAYS * DAY) return { ok: false, why: `Já passaram mais de ${DISPUTE_WINDOW_DAYS} dias desde a entrega.` };
  }
  return { ok: true };
}

/** Valor máximo que ainda se pode pedir de volta. */
export function refundableAmount(o: Pick<OrderLike, "total" | "refunded_amount">): number {
  return Math.max(0, Number(o.total) - Number(o.refunded_amount ?? 0));
}

export type DisputeInput = { request: DisputeRequest; reason: DisputeReason; description: string; amount?: number | null; photos?: string[] };
export function validateDispute(input: DisputeInput, maxAmount: number): string | null {
  if (!BUYER_REASONS.includes(input.reason as any)) return "Escolha o motivo.";
  if (!requestsFor(input.reason).includes(input.request)) return "Se não recebeu a encomenda, só pode pedir o reembolso.";
  const t = input.description.trim();
  if (t.length < 5) return "Explique o que aconteceu (pelo menos 5 letras).";
  if (t.length > 1000) return "A explicação é demasiado longa (máximo 1000 letras).";
  if (input.request !== "replacement" && input.amount != null) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) return "Indique um valor válido.";
    if (input.amount > maxAmount) return `O valor não pode passar de ${Math.round(maxAmount).toLocaleString("pt-AO")} Kz.`;
  }
  if ((input.photos?.length ?? 0) > DISPUTE_MAX_PHOTOS) return `Pode juntar no máximo ${DISPUTE_MAX_PHOTOS} fotografias.`;
  return null;
}

/** Botões que cada lado vê em cada passo (o servidor confirma sempre). */
export function disputeActions(d: Pick<MyDispute, "status" | "updated_at">, role: DisputeRole, now = Date.now()): DisputeAction[] {
  if (d.status === "resolved") return [];
  const stale = now - Date.parse(d.updated_at) > DISPUTE_ESCALATE_DAYS * DAY;
  const out: DisputeAction[] = [];
  if (role === "seller") {
    if (d.status === "open") out.push("accept", "decline");
    if (d.status === "returned") out.push("confirm_return");
    if (d.status === "awaiting_refund") out.push("mark_refunded");
    if (stale && !["open", "declined", "escalated"].includes(d.status)) out.push("escalate");
  } else {
    if (d.status === "awaiting_return") out.push("mark_returned");
    if (d.status === "refund_sent") out.push("confirm_refund");
    if (d.status === "replacing") out.push("confirm_replacement");
    if (d.status === "declined" || (stale && d.status !== "escalated")) out.push("escalate");
    out.push("withdraw");
  }
  return out;
}
/** O que fazer agora, numa frase, para quem está a ver. */
export function disputeNextStep(d: Pick<MyDispute, "status" | "request" | "outcome">, role: DisputeRole): string {
  const me = role === "buyer";
  switch (d.status) {
    case "open": return me ? "O vendedor tem de responder. Se não responder em 3 dias, pode chamar a administração." : "Responda ao pedido: aceite ou explique porque recusa.";
    case "declined": return me ? "O vendedor recusou. Se não concorda, chame a administração." : "Recusou o pedido. O comprador pode chamar a administração.";
    case "awaiting_return": return me ? "Devolva o artigo ao vendedor (combine pelas mensagens) e carregue em «Já devolvi o artigo»." : "Espere que o comprador devolva o artigo.";
    case "returned": return me ? "O vendedor vai confirmar que recebeu o artigo." : "Confirme quando receber o artigo devolvido.";
    case "awaiting_refund": return me ? "O vendedor tem de lhe devolver o dinheiro." : "Devolva o dinheiro ao comprador e carregue em «Já devolvi o dinheiro».";
    case "refund_sent": return me ? "Confirme quando receber o dinheiro. Se não chegou em 3 dias, chame a administração." : "Espere que o comprador confirme que recebeu.";
    case "replacing": return me ? "O vendedor vai enviar outro artigo. Confirme quando o receber." : "Envie o artigo novo ao comprador.";
    case "escalated": return "A administração está a analisar e vai decidir. Pode juntar mensagens e fotografias.";
    default: return d.outcome ? DISPUTE_OUTCOME_LABELS[d.outcome] : "Fechado.";
  }
}

export function disputePhotoPath(orderId: string, userId: string, filename: string, now = Date.now()): string {
  const clean = filename.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "foto.jpg";
  return `${orderId}/${userId}/${now}-${clean}`;
}

// --- Servidor --------------------------------------------------------------------------
export async function uploadDisputePhoto(client: SupabaseClient, orderId: string, userId: string, file: Blob | ArrayBuffer, filename: string, contentType: string) {
  const path = disputePhotoPath(orderId, userId, filename);
  const r = await client.storage.from(DISPUTE_BUCKET).upload(path, file, { contentType, upsert: false });
  return { data: r.error ? null : path, error: r.error };
}
export async function disputePhotoUrls(client: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const r = await client.storage.from(DISPUTE_BUCKET).createSignedUrls(paths, 600);
  const out: Record<string, string> = {};
  for (const x of r.data ?? []) if (x.path && x.signedUrl) out[x.path] = x.signedUrl;
  return out;
}
export function openDispute(client: SupabaseClient, orderId: string, input: DisputeInput) {
  return client.rpc("open_order_dispute", { p_order_id: orderId, p_request: input.request, p_reason: input.reason, p_description: input.description.trim(),
    p_amount: input.request === "replacement" ? null : input.amount ?? null, p_photos: input.photos ?? [] });
}
export function disputeAction(client: SupabaseClient, disputeId: string, action: DisputeAction, note?: string, photos: string[] = []) {
  return client.rpc("dispute_action", { p_dispute_id: disputeId, p_action: action, p_note: note?.trim() || null, p_photos: photos });
}
export async function listMyDisputes(client: SupabaseClient) {
  const r = await client.rpc("my_disputes");
  return { data: (r.data ?? []) as MyDispute[], error: r.error };
}
export async function listDisputesForAdmin(client: SupabaseClient, status: DisputeStatus | "active" | "" = "escalated") {
  const r = await client.rpc("admin_list_disputes", { p_status: status || null });
  return { data: (r.data ?? []) as AdminDispute[], error: r.error };
}
export function decideDispute(client: SupabaseClient, disputeId: string, decision: DisputeDecision, note: string, amount?: number | null) {
  return client.rpc("admin_decide_dispute", { p_dispute_id: disputeId, p_decision: decision, p_amount: amount ?? null, p_note: note.trim() });
}
/** Pedido mais recente de cada encomenda (para mostrar na lista de encomendas). */
export function latestDisputeByOrder<T extends Pick<MyDispute, "order_id" | "created_at">>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const d of items) if (!out[d.order_id] || d.created_at > out[d.order_id].created_at) out[d.order_id] = d;
  return out;
}
