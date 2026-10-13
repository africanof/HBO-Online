import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Confiança (igual no Site e na APP): denúncias de qualquer perfil ou produto, pedidos de verificação
 * com documento privado, respostas às avaliações e o painel da administração (verificações e registo).
 */

export type ReportTargetType = "user" | "provider" | "business" | "product" | "classified_listing" | "promo_post";
export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  user: "Pessoa", provider: "Profissional", business: "Empresa", product: "Produto", classified_listing: "Anúncio", promo_post: "Vídeo ou live"
};
export const REPORT_REASONS = ["Burla ou fraude", "Informação falsa", "Produto ou serviço proibido", "Conteúdo ofensivo", "Perfil falso", "Outro motivo"];

export function validateReport(reason: string): string | null {
  return reason.trim().length < 3 ? "Escolha ou escreva o motivo da denúncia." : null;
}
export function submitReport(client: SupabaseClient, targetType: ReportTargetType, targetId: string, reason: string, details?: string) {
  return client.rpc("report_content", { p_target_type: targetType, p_target_id: targetId, p_reason: reason.trim(), p_details: details?.trim() || null });
}

/** Ligação para ver o alvo de uma denúncia. */
export function reportTargetHref(type: string, id: string, ownerId?: string | null): string {
  switch (type) {
    case "classified_listing": return "/classificados/" + id;
    case "product": return "/loja/" + id;
    case "business": return "/empresas/" + id;
    case "provider": return "/profissionais/" + id;
    case "promo_post": return "/videos/" + id;
    default: return "/vendedor/" + (ownerId || id);
  }
}

// --- Verificações ----------------------------------------------------------------------
export type VerificationKind = "identity" | "provider" | "business";
export type VerificationStatus = "pending" | "approved" | "rejected";
export const VERIFICATION_KIND_LABELS: Record<VerificationKind, string> = { identity: "Identidade (BI)", provider: "Perfil profissional", business: "Empresa (alvará / NIF)" };
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = { pending: "À espera de análise", approved: "Aprovada ✔", rejected: "Recusada" };
export const VERIFICATION_BUCKET = "verification-docs";
export const VERIFICATION_MAX_BYTES = 5 * 1024 * 1024;
export const VERIFICATION_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type MyVerification = { id: string; kind: VerificationKind; business_id: string | null; business_name: string | null; status: VerificationStatus; admin_note: string | null; created_at: string; decided_at: string | null };
export type AdminVerification = MyVerification & { user_id: string; user_name: string; phone: string | null; document_path: string; note: string | null };
export type TrustSignals = { identity_verified: boolean; phone_verified: boolean; provider_verified: boolean; businesses_verified: number };

export function validateDocument(f: { size?: number | null; type?: string | null }): string | null {
  if (f.type && !VERIFICATION_TYPES.includes(f.type)) return "Envie uma fotografia (JPG, PNG, WEBP) ou um PDF.";
  if (f.size != null && f.size > VERIFICATION_MAX_BYTES) return "O documento é demasiado grande (máximo 5 MB).";
  return null;
}
/** Nome seguro do ficheiro dentro da pasta da pessoa: "<id>/<data>-<nome>". */
export function documentPath(userId: string, filename: string, now = Date.now()): string {
  const clean = filename.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "documento";
  return `${userId}/${now}-${clean}`;
}
export async function uploadVerificationDocument(client: SupabaseClient, userId: string, file: Blob | ArrayBuffer, filename: string, contentType: string) {
  const path = documentPath(userId, filename);
  const r = await client.storage.from(VERIFICATION_BUCKET).upload(path, file, { contentType, upsert: false });
  return { data: r.error ? null : path, error: r.error };
}
export function requestVerification(client: SupabaseClient, kind: VerificationKind, documentPath: string, opts: { businessId?: string; note?: string } = {}) {
  return client.rpc("request_verification", { p_kind: kind, p_business_id: opts.businessId ?? null, p_document_path: documentPath, p_note: opts.note?.trim() || null });
}
export async function listMyVerifications(client: SupabaseClient) {
  const r = await client.rpc("my_verifications");
  return { data: (r.data ?? []) as MyVerification[], error: r.error };
}
export async function getTrustSignals(client: SupabaseClient, userId: string) {
  const r = await client.rpc("public_trust_signals", { p_user_id: userId });
  return { data: ((Array.isArray(r.data) ? r.data[0] : r.data) ?? null) as TrustSignals | null, error: r.error };
}
/** Selos de confiança para mostrar no perfil. */
export function trustBadges(t: TrustSignals | null | undefined): string[] {
  if (!t) return [];
  const out: string[] = [];
  if (t.identity_verified) out.push("✔ Identidade verificada");
  if (t.phone_verified) out.push("✔ Telefone verificado");
  if (t.provider_verified) out.push("✔ Profissional verificado");
  if (Number(t.businesses_verified) > 0) out.push("✔ Empresa verificada");
  return out;
}

// --- Respostas às avaliações ----------------------------------------------------------------
export function replyToReview(client: SupabaseClient, kind: "service" | "deal", reviewId: string, reply: string) {
  return client.rpc("reply_to_review", { p_kind: kind, p_review_id: reviewId, p_reply: reply.trim() });
}

// --- Administração ----------------------------------------------------------------------
export async function listReportsV2(client: SupabaseClient, status?: string) {
  return client.rpc("admin_list_reports_v2", { p_status: status || null });
}
export function setTargetActive(client: SupabaseClient, type: "product" | "business" | "provider", id: string, active: boolean) {
  return client.rpc("admin_set_target_active", { p_target_type: type, p_target_id: id, p_active: active });
}
export async function listVerificationsForAdmin(client: SupabaseClient, status: VerificationStatus | "" = "pending") {
  const r = await client.rpc("admin_list_verifications", { p_status: status || null });
  return { data: (r.data ?? []) as AdminVerification[], error: r.error };
}
export function decideVerification(client: SupabaseClient, id: string, approve: boolean, note?: string) {
  return client.rpc("admin_decide_verification", { p_id: id, p_approve: approve, p_note: note?.trim() || null });
}
/** Ligação temporária (10 minutos) para a administração ver o documento privado. */
export async function verificationDocumentUrl(client: SupabaseClient, path: string) {
  const r = await client.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, 600);
  return { data: r.data?.signedUrl ?? null, error: r.error };
}
export type AuditEntry = { id: number; actor_name: string; action: string; target_type: string; target_id: string | null; details: Record<string, unknown>; created_at: string };
export async function listAudit(client: SupabaseClient, limit = 100) {
  const r = await client.rpc("admin_list_audit", { p_limit: limit });
  return { data: (r.data ?? []) as AuditEntry[], error: r.error };
}
const ACTION_LABELS: Record<string, string> = {
  hide: "Escondeu", show: "Voltou a mostrar", update: "Alterou", verification_approved: "Aprovou a verificação de", verification_rejected: "Recusou a verificação de"
};
const TABLE_LABELS: Record<string, string> = {
  profiles: "conta", user_roles: "papel", moderation_reports: "denúncia", classified_listings: "anúncio", couriers: "estafeta", categories: "categoria",
  product: "produto", business: "empresa", provider: "profissional", identity: "identidade"
};
/** "Alterou conta: status → suspended". */
export function auditLabel(e: Pick<AuditEntry, "action" | "target_type" | "details">): string {
  const what = `${ACTION_LABELS[e.action] ?? e.action} ${TABLE_LABELS[e.target_type] ?? e.target_type}`;
  const det = e.action === "update" ? Object.entries(e.details ?? {}).map(([k, v]) => `${k} → ${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ") : "";
  return det ? `${what}: ${det}` : what;
}
