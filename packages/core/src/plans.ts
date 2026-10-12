import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mensalidades da plataforma (igual no Site e na APP): profissionais e empresas têm um mês grátis;
 * depois pagam por mês (2 000 Kz profissionais, 5 000 Kz empresas — a administração pode mudar).
 * Sem pagamento em dia, o perfil deixa de aparecer ao público até pagar.
 */
export type PlanKind = "provider" | "business";
export type PlanState = "trial" | "trial_ending" | "paid" | "expiring" | "expired";
export type PaymentMethodPlan = "bank_transfer" | "multicaixa_express" | "cash";
export type MyPlan = { id: string; kind: PlanKind; subject_id: string; name: string; trial_ends_at: string; paid_until: string | null; active_until: string;
  state: PlanState; monthly_price: number | string; pending_payment_id: string | null; pending_amount: number | string | null; last_rejected_note: string | null };
export type PlatformSettings = { provider_monthly_kz: number | string; business_monthly_kz: number | string; trial_days: number;
  bank_name: string | null; iban: string | null; account_holder: string | null; express_number: string | null; payment_note: string | null };
export type AdminPlanPayment = { id: string; subscription_id: string; kind: PlanKind; subject_id: string; subject_name: string; owner_id: string; owner_name: string; phone: string | null;
  months: number; amount: number | string; method: PaymentMethodPlan; reference: string | null; proof_path: string | null; status: "pending" | "confirmed" | "rejected";
  admin_note: string | null; created_at: string; active_until: string };

export const PLAN_KIND_LABELS: Record<PlanKind, string> = { provider: "Perfil profissional", business: "Empresa" };
export const PLAN_STATE_LABELS: Record<PlanState, string> = {
  trial: "Mês grátis", trial_ending: "Mês grátis a terminar", paid: "Pago ✔", expiring: "Pago — termina em breve", expired: "Sem pagamento — não aparece ao público"
};
export const PLAN_METHOD_LABELS: Record<PaymentMethodPlan, string> = { bank_transfer: "Transferência bancária", multicaixa_express: "Multicaixa Express", cash: "Em mão (no escritório)" };
export const PLAN_PROOF_BUCKET = "payment-proofs";
export const PLAN_MONTH_OPTIONS = [1, 3, 6, 12];
const DAY = 86400000;

export function planDaysLeft(activeUntil: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(activeUntil) - now) / DAY));
}
/** Frase curta para o dono: «Grátis até 12/11/2026 (faltam 30 dias)». */
export function planSummary(p: Pick<MyPlan, "state" | "active_until" | "monthly_price">, now = Date.now()): string {
  const d = new Date(p.active_until), date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const left = planDaysLeft(p.active_until, now), price = Number(p.monthly_price).toLocaleString("pt-AO").replace(/ | |\./g, " ");
  if (p.state === "expired") return `O período terminou a ${date}. Pague ${price} Kz por mês para voltar a aparecer aos clientes.`;
  const what = p.state === "trial" || p.state === "trial_ending" ? "Grátis" : "Pago";
  return `${what} até ${date} (${left === 1 ? "falta 1 dia" : `faltam ${left} dias`}). Depois: ${price} Kz por mês.`;
}
export function needsPayment(p: Pick<MyPlan, "state" | "pending_payment_id">): boolean {
  return !p.pending_payment_id && (p.state === "expired" || p.state === "expiring" || p.state === "trial_ending");
}
export function planTotal(monthly: number | string, months: number): number { return Number(monthly) * months; }

export type PlanPaymentInput = { months: number; method: PaymentMethodPlan; reference?: string; proofPath?: string | null };
export function validatePlanPayment(input: PlanPaymentInput): string | null {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 12) return "Escolha de 1 a 12 meses.";
  if (!PLAN_METHOD_LABELS[input.method]) return "Escolha como pagou.";
  if (!input.reference?.trim() && !input.proofPath) return "Escreva a referência do pagamento ou junte o comprovativo.";
  if ((input.reference?.trim().length ?? 0) > 120) return "A referência é demasiado longa.";
  return null;
}
export function proofPath(userId: string, filename: string, now = Date.now()): string {
  const clean = filename.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "comprovativo";
  return `${userId}/${now}-${clean}`;
}

// --- Servidor --------------------------------------------------------------------------
export async function listMyPlans(client: SupabaseClient) {
  const r = await client.rpc("my_subscriptions");
  return { data: (r.data ?? []) as MyPlan[], error: r.error };
}
export async function getPlatformSettings(client: SupabaseClient) {
  const r = await client.from("platform_settings").select("provider_monthly_kz,business_monthly_kz,trial_days,bank_name,iban,account_holder,express_number,payment_note").eq("id", 1).maybeSingle();
  return { data: (r.data ?? null) as PlatformSettings | null, error: r.error };
}
export function updatePlatformSettings(client: SupabaseClient, s: Partial<PlatformSettings>) {
  return client.from("platform_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
}
export async function uploadPaymentProof(client: SupabaseClient, userId: string, file: Blob | ArrayBuffer, filename: string, contentType: string) {
  const path = proofPath(userId, filename);
  const r = await client.storage.from(PLAN_PROOF_BUCKET).upload(path, file, { contentType, upsert: false });
  return { data: r.error ? null : path, error: r.error };
}
export function submitPlanPayment(client: SupabaseClient, subscriptionId: string, input: PlanPaymentInput) {
  const invalid = validatePlanPayment(input);
  if (invalid) return Promise.resolve({ data: null, error: new Error(invalid) });
  return client.rpc("submit_subscription_payment", { p_subscription_id: subscriptionId, p_months: input.months, p_method: input.method,
    p_reference: input.reference?.trim() || null, p_proof_path: input.proofPath || null });
}
export async function listPlanPaymentsForAdmin(client: SupabaseClient, status: "pending" | "confirmed" | "rejected" | "" = "pending") {
  const r = await client.rpc("admin_list_subscription_payments", { p_status: status || null });
  return { data: (r.data ?? []) as AdminPlanPayment[], error: r.error };
}
export function decidePlanPayment(client: SupabaseClient, paymentId: string, confirm: boolean, note?: string) {
  return client.rpc("admin_decide_subscription_payment", { p_payment_id: paymentId, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function paymentProofUrl(client: SupabaseClient, path: string) {
  const r = await client.storage.from(PLAN_PROOF_BUCKET).createSignedUrl(path, 600);
  return { data: r.data?.signedUrl ?? null, error: r.error };
}
