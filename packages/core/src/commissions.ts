import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethodPlan } from "./plans";

/**
 * Comissão dos anúncios (igual no Site e na APP): depois de vendido ou arrendado/alugado, o dono paga à plataforma
 * uma percentagem do valor (5%, a administração pode mudar) no prazo de 7 dias.
 * Arrendamentos: sobre o valor indicado ao marcar «Arrendado», ou sobre o valor total de um pedido de aluguer aceite.
 * Com comissões em atraso não se publicam anúncios novos.
 */
export type CommissionStatus = "due" | "submitted" | "paid" | "waived" | "cancelled";
export type MyCommission = { id: string; listing_id: string; listing_title: string; listed_price: number | string | null; sale_amount: number | string; rate_pct: number | string;
  amount: number | string; source: "sold" | "auction" | "offer" | "rental" | "rented"; status: CommissionStatus; due_at: string; overdue: boolean; reference: string | null; admin_note: string | null; created_at: string };
export type AdminCommission = Omit<MyCommission, "overdue"> & { owner_id: string; owner_name: string; phone: string | null; method: PaymentMethodPlan | null; proof_path: string | null; submitted_at: string | null };

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  due: "Por pagar", submitted: "Paga — à espera de confirmação", paid: "Paga ✔", waived: "Anulada pela administração", cancelled: "Anulada"
};
export const COMMISSION_SOURCE_LABELS: Record<MyCommission["source"], string> = { sold: "Valor indicado na venda", auction: "Preço final do leilão", offer: "Proposta aceite", rental: "Pedido de aluguer aceite", rented: "Valor indicado no arrendamento" };

/** Comissão arredondada ao kwanza. */
export function commissionFor(amount: number | string | null | undefined, pct: number | string = 5): number {
  const a = Number(amount), p = Number(pct);
  return Number.isFinite(a) && a > 0 && Number.isFinite(p) && p > 0 ? Math.round(a * p / 100) : 0;
}
/** Total a pagar e quantas estão em atraso. */
export function commissionTotals(items: Pick<MyCommission, "status" | "amount" | "overdue">[]) {
  const due = items.filter(i => i.status === "due");
  return { dueCount: due.length, dueTotal: due.reduce((s, i) => s + Number(i.amount), 0), overdueCount: due.filter(i => i.overdue).length,
    waitingCount: items.filter(i => i.status === "submitted").length };
}

export async function listMyCommissions(client: SupabaseClient) {
  const r = await client.rpc("my_commissions");
  return { data: (r.data ?? []) as MyCommission[], error: r.error };
}
export function submitCommissionPayment(client: SupabaseClient, ids: string[], input: { method: PaymentMethodPlan; reference?: string; proofPath?: string | null }) {
  if (!ids.length) return Promise.resolve({ data: null, error: new Error("Escolha a comissão que quer pagar.") });
  if (!input.reference?.trim() && !input.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("submit_commission_payment", { p_ids: ids, p_method: input.method, p_reference: input.reference?.trim() || null, p_proof_path: input.proofPath || null });
}
export async function listCommissionsForAdmin(client: SupabaseClient, status: CommissionStatus | "overdue" | "" = "submitted") {
  const r = await client.rpc("admin_list_commissions", { p_status: status || null });
  return { data: (r.data ?? []) as AdminCommission[], error: r.error };
}
export function updateCommissionAsAdmin(client: SupabaseClient, id: string, action: "confirm" | "reject" | "waive" | "adjust", note?: string, saleAmount?: number) {
  return client.rpc("admin_update_commission", { p_id: id, p_action: action, p_note: note?.trim() || null, p_sale_amount: saleAmount ?? null });
}
/** Fechar o anúncio sem indicar o comprador (com o valor da venda, para a comissão). */
export function closeListing(client: SupabaseClient, listingId: string, status: "sold" | "rented" | "closed", saleAmount?: number | null) {
  return client.from("classified_listings").update({ status, ...(status === "sold" || status === "rented" ? { sale_amount: saleAmount ?? null } : {}), updated_at: new Date().toISOString() }).eq("id", listingId).select().single();
}
