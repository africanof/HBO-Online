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

// --- Identidade v2: BI frente e verso + selfie com o BI, tirados na hora com a câmara --------------
export type IdentityShot = "front" | "back" | "selfie";
export const IDENTITY_SHOTS: { key: IdentityShot; title: string; hint: string; camera: "back" | "front" }[] = [
  { key: "front", title: "1. BI — frente", hint: "Ponha o BI numa mesa, com boa luz. O nome, a fotografia e o número têm de se ler bem.", camera: "back" },
  { key: "back", title: "2. BI — verso", hint: "Vire o BI e fotografe o lado de trás, inteiro e sem reflexos.", camera: "back" },
  { key: "selfie", title: "3. Selfie com o BI", hint: "Segure o BI ao lado da cara, com a fotografia virada para a câmara. Sem óculos escuros nem boné.", camera: "front" }
];
/** Número do BI angolano: 9 algarismos, 2 letras e 3 algarismos (ex.: 004512345LA042). Devolve normalizado ou null. */
export function normalizeBiNumber(text: string | null | undefined): string | null {
  const s = (text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{9}[A-Z]{2}\d{3}$/.test(s) ? s : null;
}
export function validateIdentityRequest(i: { front?: unknown; back?: unknown; selfie?: unknown; idNumber: string }): string | null {
  if (!i.front) return "Tire a fotografia da frente do BI.";
  if (!i.back) return "Tire a fotografia do verso do BI.";
  if (!i.selfie) return "Tire a selfie a segurar o BI.";
  if (!normalizeBiNumber(i.idNumber)) return "Escreva o número do BI como está no documento (9 algarismos, 2 letras e 3 algarismos, ex.: 004512345LA042).";
  return null;
}
export function identityShotPath(userId: string, shot: IdentityShot, now = Date.now()): string { return `${userId}/${now}-bi-${shot}.jpg`; }
/** Envia as três fotografias (JPEG) e cria o pedido. */
export async function requestIdentityVerification(client: SupabaseClient, userId: string, shots: Record<IdentityShot, Blob | ArrayBuffer>, idNumber: string, note?: string) {
  const bad = validateIdentityRequest({ ...shots, idNumber }); if (bad) return { data: null, error: new Error(bad) };
  const now = Date.now(); const paths = {} as Record<IdentityShot, string>;
  for (const k of ["front", "back", "selfie"] as IdentityShot[]) {
    const path = identityShotPath(userId, k, now);
    const r = await client.storage.from(VERIFICATION_BUCKET).upload(path, shots[k], { contentType: "image/jpeg", upsert: false });
    if (r.error) return { data: null, error: r.error };
    paths[k] = path;
  }
  return client.rpc("request_identity_verification", { p_front_path: paths.front, p_back_path: paths.back, p_selfie_path: paths.selfie,
    p_id_number: normalizeBiNumber(idNumber), p_note: note?.trim() || null });
}
export type MyVerificationV2 = MyVerification & { id_number_hint: string | null; has_selfie: boolean };
export async function listMyVerificationsV2(client: SupabaseClient) {
  const r = await client.rpc("my_verifications_v2");
  return { data: (r.data ?? []) as MyVerificationV2[], error: r.error };
}
export type AdminVerificationV2 = AdminVerification & { back_path: string | null; selfie_path: string | null; id_number: string | null; account_created_at: string | null; previous_rejections: number };
export async function listVerificationsForAdminV2(client: SupabaseClient, status: VerificationStatus | "" = "pending") {
  const r = await client.rpc("admin_list_verifications_v2", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminVerificationV2[]).map(v => ({ ...v, previous_rejections: Number(v.previous_rejections) || 0 })), error: r.error };
}
/** «004512345LA042» → «004512345 LA 042» (mais fácil de comparar com o BI). */
export function biNumberText(n: string | null | undefined): string {
  const m = /^(\d{9})([A-Z]{2})(\d{3})$/.exec(n ?? ""); return m ? `${m[1]} ${m[2]} ${m[3]}` : (n ?? "");
}
/** O que a administração deve confirmar antes de aprovar. */
export const IDENTITY_ADMIN_CHECKLIST = [
  "A cara da selfie é a mesma da fotografia do BI.",
  "O nome do BI é o mesmo nome da conta.",
  "O número escrito é o mesmo do BI.",
  "O BI não está fora de validade, rasurado nem é fotocópia ou fotografia de um ecrã."
];
export const IDENTITY_REJECT_REASONS = ["Fotografias ilegíveis ou com reflexos", "A cara da selfie não corresponde ao BI", "O nome não corresponde ao da conta",
  "O número não corresponde ao BI", "BI fora de validade", "Fotografia de um ecrã ou fotocópia"];
