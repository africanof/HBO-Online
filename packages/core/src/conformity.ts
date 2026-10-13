import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garantia de conformidade (igual no Site e na APP): o anúncio tem de corresponder ao artigo.
 * Quem publica declara que a descrição é verdadeira e completa (incluindo defeitos). Se houver omissão ou erro,
 * quem comprou ou arrendou pode pedir troca, devolução com reembolso ou reembolso: primeiro ao dono e, se ele
 * recusar ou não responder em 3 dias, à administração, que decide.
 */
export type ClaimRequest = "exchange" | "return_refund" | "refund";
export type ClaimReason = "omitted_defect" | "not_as_described" | "wrong_item" | "missing_parts" | "other";
export type ClaimStatus = "open" | "accepted" | "declined" | "escalated" | "resolved";
export type ClaimOutcome = "done" | "rejected" | "withdrawn";
export type ListingClaim = {
  id: string; ref_no: number; listing_id: string | null; listing_title: string; role: "buyer" | "seller"; other_name: string;
  request: ClaimRequest; reason: ClaimReason; description: string; amount: number | null; status: ClaimStatus; outcome: ClaimOutcome | null;
  seller_note: string | null; admin_note: string | null; decided_by_admin: boolean; respond_by: string; created_at: string; updated_at: string;
};
export type AdminListingClaim = Omit<ListingClaim, "role" | "other_name" | "decided_by_admin" | "respond_by" | "updated_at"> & { buyer_name: string; seller_name: string; seller_id: string; seller_claims: number };

export const CONFORMITY_DECLARATION =
  "Declaro que o anúncio descreve o artigo com verdade e por completo, incluindo defeitos e o que falta. Se houver omissão ou erro, aceito fazer a troca, a devolução ou o reembolso.";
export const CONFORMITY_GUARANTEE =
  "🛡️ Garantia: o artigo tem de corresponder ao anúncio. Se tiver um defeito escondido ou for diferente da descrição, tem direito a troca, devolução ou reembolso.";
export const CLAIM_REQUEST_LABELS: Record<ClaimRequest, string> = { exchange: "🔄 Troca", return_refund: "↩️ Devolução e reembolso", refund: "💸 Reembolso (total ou parte)" };
export const CLAIM_REASON_LABELS: Record<ClaimReason, string> = {
  omitted_defect: "Tem um defeito que não estava no anúncio", not_as_described: "É diferente da descrição",
  wrong_item: "É outro artigo (diferente das fotografias)", missing_parts: "Faltam peças ou acessórios", other: "Outro motivo"
};
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  open: "⏳ À espera da resposta do dono", accepted: "✅ Aceite — falta cumprir", declined: "❌ Recusada pelo dono",
  escalated: "⚖️ Com a administração", resolved: "Fechada"
};
export const CLAIM_OUTCOME_LABELS: Record<ClaimOutcome, string> = { done: "✔ Resolvida", rejected: "Recusada pela administração", withdrawn: "Retirada" };

export function claimRef(n: number | null | undefined): string { return n ? `R-${n}` : ""; }
export function validateClaim(i: { request: ClaimRequest | ""; reason: ClaimReason | ""; description: string; amount?: number | null }): string | null {
  if (!i.reason) return "Escolha o que está errado.";
  if (!i.request) return "Escolha o que quer: troca, devolução ou reembolso.";
  if (i.description.trim().length < 10) return "Explique o problema (pelo menos 10 letras).";
  if (i.description.trim().length > 1000) return "A explicação é demasiado longa.";
  if (i.request !== "exchange" && i.amount != null && !(i.amount > 0)) return "O valor a reembolsar tem de ser maior que zero.";
  return null;
}
/** Que botões cada pessoa vê numa reclamação. */
export function claimActions(c: Pick<ListingClaim, "role" | "status" | "respond_by">, now = Date.now()): ("accept" | "decline" | "confirm" | "escalate" | "withdraw")[] {
  if (c.status === "resolved") return [];
  if (c.role === "seller") return c.status === "open" ? ["accept", "decline"] : [];
  const late = Date.parse(c.respond_by) < now;
  const out: ("confirm" | "escalate" | "withdraw")[] = [];
  if (c.status === "accepted") out.push("confirm", "escalate");
  if (c.status === "declined") out.push("escalate");
  if (c.status === "open" && late) out.push("escalate");
  out.push("withdraw");
  return out;
}
export function claimDeadlineText(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const d = new Date(Date.parse(deadline) + 3600000);
  return `Pode reclamar até ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}.`;
}

// --- Servidor ---------------------------------------------------------------------------------
export async function getClaimDeadline(client: SupabaseClient, listingId: string): Promise<string | null> {
  const r = await client.rpc("listing_claim_deadline", { p_listing_id: listingId });
  return r.error ? null : (r.data as string | null);
}
export function openListingClaim(client: SupabaseClient, listingId: string, i: { request: ClaimRequest | ""; reason: ClaimReason | ""; description: string; amount?: number | null }) {
  const bad = validateClaim(i);
  if (bad) return Promise.resolve({ data: null, error: new Error(bad) });
  return client.rpc("open_listing_claim", { p_listing_id: listingId, p_request: i.request, p_reason: i.reason, p_description: i.description.trim(),
    p_amount: i.request === "exchange" ? null : i.amount ?? null });
}
export function respondListingClaim(client: SupabaseClient, id: string, accept: boolean, note?: string) {
  if (!accept && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo da recusa.") });
  return client.rpc("respond_listing_claim", { p_claim_id: id, p_accept: accept, p_note: note?.trim() || null });
}
export function buyerListingClaim(client: SupabaseClient, id: string, action: "confirm" | "escalate" | "withdraw", note?: string) {
  return client.rpc("buyer_listing_claim", { p_claim_id: id, p_action: action, p_note: note?.trim() || null });
}
export async function listMyListingClaims(client: SupabaseClient) {
  const r = await client.rpc("my_listing_claims");
  return { data: (r.data ?? []) as ListingClaim[], error: r.error };
}
export async function listListingClaimsForAdmin(client: SupabaseClient, status: ClaimStatus | "" = "escalated") {
  const r = await client.rpc("admin_list_listing_claims", { p_status: status || null });
  return { data: (r.data ?? []) as AdminListingClaim[], error: r.error };
}
export function decideListingClaim(client: SupabaseClient, id: string, uphold: boolean, note: string) {
  if (!note.trim()) return Promise.resolve({ data: null, error: new Error("Escreva a decisão e o motivo.") });
  return client.rpc("admin_decide_listing_claim", { p_claim_id: id, p_uphold: uphold, p_note: note.trim() });
}
