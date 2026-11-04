import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Comprovativos de pagamento lidos pela IA: a base de dados confere valor, conta de destino, data
 * e talões repetidos; a equipa confirma ou recusa (a IA nunca confirma sozinha).
 */
export type ProofKind = "subscription" | "boost" | "promo_boost" | "event_fee" | "fuel_fee" | "venue_fee" | "commission" | "order" | "fuel_order" | "venue_order" | "import_order";
export type ProofVerdict = "match" | "check" | "suspicious" | "unreadable" | "pending";
export type ProofCheck = {
  kind: ProofKind; payment_id: string; label: string; amount: number; method: string | null; reference: string | null;
  payer_id: string; payer_name: string | null; created_at: string; proof_path: string;
  verdict: ProofVerdict; summary: string | null; read_amount: number | null; read_date: string | null; read_operation: string | null;
  read_destination: string | null; read_beneficiary: string | null; read_bank: string | null;
  amount_ok: boolean | null; destination_ok: boolean | null; date_ok: boolean | null; duplicate_kind: string | null; duplicate_id: string | null; checked_at: string | null;
};

export async function listProofChecks(client: SupabaseClient) {
  const r = await client.rpc("admin_list_proof_checks");
  const data = ((r.data ?? []) as any[]).map(x => ({ ...x, amount: Number(x.amount), read_amount: x.read_amount == null ? null : Number(x.read_amount) })) as ProofCheck[];
  return { data, error: r.error };
}

/** Confirma ou recusa o pagamento com a função da equipa certa para cada tipo. */
export function decideProofPayment(client: SupabaseClient, kind: ProofKind, id: string, confirm: boolean, note?: string | null) {
  const n = note?.trim() || null;
  switch (kind) {
    case "subscription": return client.rpc("admin_decide_subscription_payment", { p_payment_id: id, p_confirm: confirm, p_note: n });
    case "boost": return client.rpc("admin_decide_boost", { p_boost_id: id, p_confirm: confirm, p_note: n });
    case "promo_boost": return client.rpc("admin_decide_promo_boost", { p_boost_id: id, p_confirm: confirm, p_note: n });
    case "event_fee": return client.rpc("admin_decide_event_payment", { p_payment_id: id, p_confirm: confirm, p_note: n });
    case "fuel_fee": return client.rpc("admin_decide_fuel_payment", { p_payment_id: id, p_confirm: confirm, p_note: n });
    case "venue_fee": return client.rpc("admin_decide_venue_payment", { p_payment_id: id, p_confirm: confirm, p_note: n });
    case "order": return client.rpc("admin_decide_order_payment", { p_payment_id: id, p_confirm: confirm, p_note: n });
    case "fuel_order": return client.rpc("decide_fuel_payment", { p_order_id: id, p_confirm: confirm, p_note: n });
    case "venue_order": return client.rpc("decide_venue_payment", { p_order_id: id, p_confirm: confirm, p_note: n });
    case "import_order": return client.rpc("decide_import_payment", { p_id: id, p_confirm: confirm, p_note: n });
    case "commission": return client.rpc("admin_update_commission", { p_id: id, p_action: confirm ? "confirm" : "reject", p_note: n, p_sale_amount: null });
  }
}

/** Ícone de cada resultado (os textos vêm dos dicionários das apps: «pf.verdict.<v>»). */
export const PROOF_VERDICT_ICON: Record<ProofVerdict, string> = { match: "✅", check: "🟡", suspicious: "🚩", unreadable: "❔", pending: "⏳" };

/** ✔/✖/? para cada conferência. */
export function proofMark(ok: boolean | null | undefined): string { return ok === true ? "✔" : ok === false ? "✖" : "?"; }

// Aprovação automática (só taxas pequenas da plataforma; nunca o pagamento protegido)
export type AutoConfirmed = { kind: ProofKind; payment_id: string; label: string | null; amount: number; payer_id: string | null; payer_name: string | null;
  read_operation: string | null; read_bank: string | null; read_date: string | null; proof_path: string; auto_confirmed_at: string };
export async function listAutoConfirmed(client: SupabaseClient, days = 7) {
  const r = await client.rpc("admin_list_auto_confirmed", { p_days: days });
  return { data: ((r.data ?? []) as any[]).map(x => ({ ...x, amount: Number(x.amount) })) as AutoConfirmed[], error: r.error };
}
/** Valor máximo (Kz) aprovado sozinho; 0 = desligado. */
export async function getProofAutoMax(client: SupabaseClient): Promise<number> {
  const r = await client.from("platform_settings").select("proof_auto_max_kz").eq("id", 1).maybeSingle();
  return Number((r.data as { proof_auto_max_kz?: number } | null)?.proof_auto_max_kz ?? 0);
}
export const PROOF_AUTO_MAX_LIMIT = 50000;
export function setProofAutoMax(client: SupabaseClient, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > PROOF_AUTO_MAX_LIMIT) return Promise.resolve({ data: null, error: new Error("INVALID_INPUT") });
  return client.from("platform_settings").update({ proof_auto_max_kz: Math.round(value), updated_at: new Date().toISOString() }).eq("id", 1);
}
