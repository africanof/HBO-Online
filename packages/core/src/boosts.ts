import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethodPlan } from "./plans";
import { formatPrice } from "./classified-listings";

/**
 * Destaques pagos (igual no Site e na APP): o vendedor paga para o anúncio aparecer no topo das listas,
 * com o selo «⭐ Destaque», durante uns dias (500 Kz por 7 dias por omissão). A administração confirma o pagamento.
 */
export type BoostStatus = "pending" | "active" | "rejected" | "expired" | "cancelled";
export type MyBoost = { id: string; ref_no: number; listing_id: string; listing_title: string; days: number; amount: number | string; status: BoostStatus;
  method: PaymentMethodPlan | null; reference: string | null; starts_at: string | null; ends_at: string | null; admin_note: string | null; created_at: string };
export type AdminBoost = MyBoost & { owner_id: string; owner_name: string; phone: string | null; proof_path: string | null };
export type BoostSettings = { boost_price_kz?: number | string; boost_days?: number };

export const FEATURED_TAG = "⭐ Destaque";
export const BOOST_STATUS_LABELS: Record<BoostStatus, string> = {
  pending: "Pagamento à espera de confirmação", active: "Em destaque ⭐", rejected: "Pagamento não confirmado", expired: "Terminou", cancelled: "Cancelado"
};
export const boostRef = (n: number | null | undefined) => (n ? "D-" + n : "");

/** Está em destaque agora? (Destaque pago com prazo, ou posto à mão pela administração.) */
export function isFeatured(l: { featured?: boolean | null; featured_until?: string | null }, now = Date.now()): boolean {
  if (!l.featured) return false;
  return !l.featured_until || Date.parse(l.featured_until) > now;
}
/** «Destacar por 500 Kz (7 dias)». */
export function boostOfferText(s: BoostSettings | null | undefined): string {
  const days = s?.boost_days ?? 7;
  return `⭐ Destacar por ${formatPrice(s?.boost_price_kz ?? 500)} (${days} ${days === 1 ? "dia" : "dias"})`;
}
/** Estado do destaque de um anúncio, a partir da lista dos meus destaques. */
export function boostStateFor(listingId: string, boosts: Pick<MyBoost, "listing_id" | "status" | "ends_at" | "admin_note" | "created_at">[], now = Date.now()):
  { kind: "active"; until: string } | { kind: "pending" } | { kind: "rejected"; note: string | null } | { kind: "none" } {
  const mine = boosts.filter(b => b.listing_id === listingId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pending = mine.find(b => b.status === "pending");
  if (pending) return { kind: "pending" };
  const active = mine.filter(b => b.status === "active" && b.ends_at && Date.parse(b.ends_at) > now).sort((a, b) => b.ends_at!.localeCompare(a.ends_at!))[0];
  if (active) return { kind: "active", until: active.ends_at! };
  if (mine[0]?.status === "rejected") return { kind: "rejected", note: mine[0].admin_note };
  return { kind: "none" };
}
export function formatDate(iso: string): string {
  const d = new Date(Date.parse(iso) + 3600000); // hora de Angola
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// --- Servidor ---------------------------------------------------------------------------------
export type BoostPaymentInput = { method: PaymentMethodPlan; reference?: string; proofPath?: string | null };
export function requestBoost(client: SupabaseClient, listingId: string, input: BoostPaymentInput) {
  if (!input.reference?.trim() && !input.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("request_listing_boost", { p_listing_id: listingId, p_method: input.method, p_reference: input.reference?.trim() || null, p_proof_path: input.proofPath || null });
}
export async function listMyBoosts(client: SupabaseClient) {
  const r = await client.rpc("my_listing_boosts");
  return { data: (r.data ?? []) as MyBoost[], error: r.error };
}
export async function listBoostsForAdmin(client: SupabaseClient, status: BoostStatus | "" = "pending") {
  const r = await client.rpc("admin_list_boosts", { p_status: status || null });
  return { data: (r.data ?? []) as AdminBoost[], error: r.error };
}
export function decideBoost(client: SupabaseClient, boostId: string, confirm: boolean, note?: string) {
  return client.rpc("admin_decide_boost", { p_boost_id: boostId, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function getBoostSettings(client: SupabaseClient) {
  const r = await client.from("platform_settings").select("boost_price_kz,boost_days").eq("id", 1).maybeSingle();
  return { data: (r.data ?? null) as BoostSettings | null, error: r.error };
}
