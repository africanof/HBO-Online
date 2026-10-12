import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";

/**
 * Pagamento protegido (custódia) das encomendas da Loja — igual no Site e na APP.
 * O comprador paga ao Huambo Online; o dinheiro fica guardado até ele confirmar que recebeu
 * (ou até X dias depois da entrega sem reclamação). Depois passa ao saldo do vendedor, que pede o levantamento.
 */

export type EscrowStatus = "awaiting_payment" | "held" | "released" | "refunded";
export type OrderPayMethod = "bank_transfer" | "multicaixa_express";
export type OrderPaymentInfo = {
  id: string; status: "pending" | "confirmed" | "rejected" | "expired"; provider: "manual" | "proxypay"; method: OrderPayMethod | "reference";
  entity: string | null; reference: string | null; amount: number | string; expires_at: string | null; admin_note: string | null; created_at: string;
};
/** Campos do pagamento protegido que vêm em cada encomenda (my_orders_v3). */
export type ProtectedOrderFields = {
  id: string; ref_no?: number | null; status: string; total: number | string; refunded_amount?: number | string | null;
  protected?: boolean | null; escrow_status?: EscrowStatus | null; pay_by?: string | null; paid_at?: string | null; delivered_at?: string | null;
  release_at?: string | null; released_at?: string | null; platform_fee?: number | string | null; payment?: OrderPaymentInfo | null;
};
export type ProtectedSettings = {
  protected_enabled?: boolean; payment_provider?: "manual" | "proxypay"; proxypay_entity?: string | null; protected_fee_pct?: number | string;
  auto_release_days?: number; payment_window_hours?: number; payout_min_kz?: number | string; payout_weekdays?: number[];
};
export type WalletEntryKind = "sale" | "release" | "fee" | "refund" | "payout" | "payout_returned" | "adjustment";
export type WalletEntry = { id: number; bucket: "pending" | "available"; kind: WalletEntryKind; amount: number | string; note: string | null; created_at: string; order_id: string | null };
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected" | "cancelled";
export type PayoutMethod = "iban" | "express";
export type MyPayout = { id: string; ref_no: number; amount: number | string; method: PayoutMethod; destination: string; status: PayoutStatus;
  admin_note: string | null; bank_reference: string | null; created_at: string; paid_at: string | null };
export type Wallet = {
  pending: number | string; available: number | string; in_payout: number | string; paid_out: number | string;
  account: { method: PayoutMethod; holder_name: string; destination: string; updated_at: string } | null;
  entries: WalletEntry[]; payouts: MyPayout[]; payout_min_kz: number | string; payout_weekdays: number[]; fee_pct: number | string; auto_release_days: number;
};
export type AdminOrderPayment = {
  id: string; order_id: string; order_ref: string; buyer_id: string; buyer_name: string; buyer_phone: string | null; seller_name: string;
  amount: number | string; paid_amount: number | string | null; provider: "manual" | "proxypay"; method: string; status: OrderPaymentInfo["status"];
  entity: string | null; reference: string | null; proof_path: string | null; admin_note: string | null; created_at: string; decided_at: string | null;
  order_status: string; escrow_status: EscrowStatus | null;
};
export type AdminPayout = {
  id: string; ref_no: number; user_id: string; user_name: string; phone: string | null; amount: number | string; method: PayoutMethod; holder_name: string;
  destination: string; status: PayoutStatus; batch_id: string | null; bank_reference: string | null; admin_note: string | null;
  created_at: string; processed_at: string | null; paid_at: string | null;
};
export type EscrowSummary = { held: number | string; available: number | string; payouts_open: number | string; payouts_requested: number;
  payouts_processing: number; payments_pending: number; awaiting_payment: number; refunds_to_send: number; fees_30d: number | string };

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  awaiting_payment: "🛡️ À espera do pagamento", held: "🛡️ Pago — dinheiro guardado pelo Huambo Online",
  released: "✅ Pagamento entregue ao vendedor", refunded: "↩️ Dinheiro devolvido ao comprador"
};
export const ORDER_PAY_METHOD_LABELS: Record<OrderPayMethod, string> = { multicaixa_express: "Multicaixa Express", bank_transfer: "Transferência bancária" };
export const WALLET_KIND_LABELS: Record<WalletEntryKind, string> = {
  sale: "Venda paga (guardada)", release: "Libertado", fee: "Comissão", refund: "Reembolso ao cliente", payout: "Levantamento",
  payout_returned: "Levantamento devolvido ao saldo", adjustment: "Acerto"
};
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  requested: "Pedido — à espera do dia de pagamentos", processing: "A ser pago pelo banco", paid: "Pago ✔", rejected: "Não feito", cancelled: "Cancelado"
};
export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = { iban: "Conta bancária (IBAN)", express: "Multicaixa Express" };
/** Os três passos, para explicar ao comprador antes de escolher. */
export const PROTECTED_STEPS = [
  "Paga ao Huambo Online (Multicaixa Express ou transferência).",
  "Guardamos o dinheiro. O vendedor só envia depois de saber que pagou.",
  "Recebeu e está tudo bem? Confirme e o vendedor recebe. Problema? Peça reembolso."
];

// --- IBAN angolano e Multicaixa Express -------------------------------------------------------
/** 21 algarismos de um IBAN angolano (com ou sem «AO06»), só se o controlo estiver certo. */
export function angolaIbanDigits(input: string): string | null {
  let s = (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^AO06\d{21}$/.test(s)) s = s.slice(4);
  if (!/^\d{21}$/.test(s)) return null;
  let mod = 0;
  for (const ch of s + "102406") mod = (mod * 10 + Number(ch)) % 97;
  return mod === 1 ? s : null;
}
export function formatAngolaIban(digits: string): string {
  return ("AO06 " + digits.replace(/(.{4})/g, "$1 ")).trim();
}
export function expressNumber(input: string): string | null {
  const n = (input ?? "").replace(/\D/g, "");
  const nine = n.length === 12 && n.startsWith("244") ? n.slice(3) : n;
  return /^9\d{8}$/.test(nine) ? nine : null;
}
/** Igual ao servidor: IBAN arrumado ou «Multicaixa Express 9xxxxxxxx»; null se não for válido. */
export function cleanRefundDestination(input: string): string | null {
  const d = angolaIbanDigits(input);
  if (d) return formatAngolaIban(d);
  const n = expressNumber(input);
  return n ? "Multicaixa Express " + n : null;
}
export type PayoutAccountInput = { method: PayoutMethod; holder: string; destination: string };
export function validatePayoutAccount(a: PayoutAccountInput): string | null {
  if (a.holder.trim().length < 3) return "Escreva o nome do titular da conta.";
  if (a.method === "iban" && !angolaIbanDigits(a.destination)) return "O IBAN não está certo. Confira os 21 algarismos (pode escrever com ou sem AO06).";
  if (a.method === "express" && !expressNumber(a.destination)) return "Escreva o número Multicaixa Express (9 algarismos, começa por 9).";
  return null;
}

// --- Datas e textos ---------------------------------------------------------------------------
const DAY_NAMES: Record<number, string> = { 1: "segundas", 2: "terças", 3: "quartas", 4: "quintas", 5: "sextas", 6: "sábados", 7: "domingos" };
/** [2, 5] → «terças e sextas-feiras». */
export function payoutDaysText(days: number[] | null | undefined): string {
  const list = [...new Set(days ?? [])].filter(d => DAY_NAMES[d]).sort((a, b) => a - b);
  if (!list.length) return "nos dias úteis";
  const names = list.map(d => DAY_NAMES[d]);
  const weekdaysOnly = list.every(d => d <= 5);
  const joined = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " e " + names[names.length - 1];
  return weekdaysOnly ? joined + "-feiras" : joined;
}
/** Próximo dia de pagamentos (hora de Angola, UTC+1), a partir de amanhã se hoje já passou das 12h. */
export function nextPayoutDate(days: number[] | null | undefined, now = Date.now()): Date | null {
  const list = (days ?? []).filter(d => d >= 1 && d <= 7);
  if (!list.length) return null;
  const local = new Date(now + 3600000);
  for (let i = local.getUTCHours() < 12 ? 0 : 1; i <= 7; i++) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i));
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (list.includes(iso)) return d;
  }
  return null;
}
export function formatDay(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
/** «faltam 2 dias», «faltam 5 horas», «já passou». */
export function timeLeftText(iso: string | null | undefined, now = Date.now()): string {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return "";
  const ms = t - now;
  if (ms <= 0) return "já passou";
  const h = Math.ceil(ms / 3600000);
  if (h < 24) return h === 1 ? "falta 1 hora" : `faltam ${h} horas`;
  const d = Math.ceil(ms / 86400000);
  return d === 1 ? "falta 1 dia" : `faltam ${d} dias`;
}
export function isProtectedOrder(o: Pick<ProtectedOrderFields, "protected" | "escrow_status">): boolean {
  return !!o.protected && !!o.escrow_status;
}
/** Pode o comprador carregar em «Confirmar receção»? */
export function canConfirmReceived(o: ProtectedOrderFields, hasActiveDispute = false): boolean {
  return isProtectedOrder(o) && o.escrow_status === "held" && o.status !== "cancelled" && !hasActiveDispute;
}
/** Pode o comprador pagar agora (enviar comprovativo ou pedir referência)? */
export function canPayOrder(o: ProtectedOrderFields): boolean {
  return isProtectedOrder(o) && o.escrow_status === "awaiting_payment" && o.status !== "cancelled" && o.payment?.status !== "pending";
}
/** O que o comprador tem de fazer agora, numa frase. */
export function escrowBuyerStep(o: ProtectedOrderFields, hasActiveDispute = false, now = Date.now()): string {
  if (!isProtectedOrder(o)) return "";
  if (o.status === "cancelled" && o.escrow_status === "awaiting_payment") return "Encomenda cancelada. Não pague.";
  switch (o.escrow_status) {
    case "awaiting_payment":
      if (o.payment?.status === "pending" && o.payment.provider === "manual") return "Recebemos o seu comprovativo. Vamos confirmar e avisá-lo.";
      if (o.payment?.status === "pending" && o.payment.provider === "proxypay") return "Pague a referência no Multicaixa Express, num ATM ou no banco. A confirmação é automática.";
      return `Pague ${formatPrice(o.total)} ao Huambo Online${o.pay_by ? ` (${timeLeftText(o.pay_by, now)})` : ""}. Sem pagamento a tempo, a encomenda é cancelada.`;
    case "held":
      if (hasActiveDispute) return "Tem um pedido de devolução/reembolso aberto: o dinheiro fica guardado até se resolver.";
      if (o.delivered_at && o.release_at) return `O vendedor diz que entregou. Confirme a receção ou peça reembolso (${timeLeftText(o.release_at, now)}; depois o pagamento vai para o vendedor).`;
      return "O dinheiro está guardado. Quando receber a encomenda, confirme a receção.";
    case "released": return "Concluído: o pagamento foi entregue ao vendedor.";
    case "refunded": return "O dinheiro foi-lhe devolvido.";
    default: return "";
  }
}
/** O que o vendedor tem de fazer agora, numa frase. */
export function escrowSellerStep(o: ProtectedOrderFields, now = Date.now()): string {
  if (!isProtectedOrder(o)) return "";
  if (o.status === "cancelled" && o.escrow_status === "awaiting_payment") return "Encomenda cancelada antes do pagamento.";
  switch (o.escrow_status) {
    case "awaiting_payment": return "À espera do pagamento do cliente. Não envie ainda: vai receber o aviso «Pagamento recebido».";
    case "held":
      if (o.status === "cancelled") return "Encomenda cancelada: o Huambo Online devolve o dinheiro ao cliente.";
      if (o.delivered_at && o.release_at) return `Entregue. O dinheiro passa para o seu saldo quando o cliente confirmar, ou sozinho (${timeLeftText(o.release_at, now)}) se não houver reclamação.`;
      return "Pago ✔ O dinheiro está guardado pelo Huambo Online. Prepare e entregue a encomenda; depois marque como «Entregue».";
    case "released": {
      const net = Number(o.total) - Number(o.refunded_amount ?? 0) - Number(o.platform_fee ?? 0);
      return `💰 ${formatPrice(net)} passaram para o seu saldo${Number(o.platform_fee) > 0 ? ` (comissão: ${formatPrice(o.platform_fee)})` : ""}.`;
    }
    case "refunded": return "O dinheiro foi devolvido ao cliente.";
    default: return "";
  }
}
export function walletBalance(w: Pick<Wallet, "pending" | "available" | "in_payout"> | null) {
  return { pending: Number(w?.pending ?? 0), available: Number(w?.available ?? 0), inPayout: Number(w?.in_payout ?? 0) };
}
export function validatePayoutAmount(amount: number, available: number, min: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Escreva o valor a levantar.";
  if (amount > available) return `Só tem ${formatPrice(available)} disponíveis.`;
  if (amount < min) return `O mínimo para levantar é ${formatPrice(min)}.`;
  return null;
}

/** Ficheiro para o banco (pagamentos em lote). Separador «;» para o Excel em Angola/Portugal. */
export function payoutsCsv(rows: Pick<AdminPayout, "ref_no" | "holder_name" | "method" | "destination" | "amount" | "phone">[]): string {
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [["Referência", "Beneficiário", "Tipo", "IBAN / Número", "Montante (Kz)", "Descritivo", "Telefone"].join(";")];
  for (const r of rows) {
    const dest = r.method === "iban" ? r.destination.replace(/\s/g, "") : r.destination;
    lines.push([`L-${r.ref_no}`, r.holder_name, PAYOUT_METHOD_LABELS[r.method], dest, Number(r.amount).toFixed(2).replace(".", ","),
      `Huambo Online L-${r.ref_no}`, r.phone ?? ""].map(esc).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}
export function payoutsTotal(rows: Pick<AdminPayout, "amount">[]): number {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

// --- Servidor ---------------------------------------------------------------------------------
export async function getProtectedSettings(client: SupabaseClient) {
  const r = await client.from("platform_settings").select("protected_enabled,payment_provider,proxypay_entity,protected_fee_pct,auto_release_days,payment_window_hours,payout_min_kz,payout_weekdays").eq("id", 1).maybeSingle();
  return { data: (r.data ?? null) as ProtectedSettings | null, error: r.error };
}
export function updateProtectedSettings(client: SupabaseClient, s: ProtectedSettings) {
  return client.from("platform_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
}
export function submitOrderPayment(client: SupabaseClient, orderId: string, input: { method: OrderPayMethod; reference?: string; proofPath?: string | null }) {
  if (!input.reference?.trim() && !input.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("submit_order_payment", { p_order_id: orderId, p_method: input.method, p_reference: input.reference?.trim() || null, p_proof_path: input.proofPath || null });
}
/** Pede uma referência ProxyPay (Entidade + Referência) à Edge Function do servidor. */
export async function requestPaymentReference(client: SupabaseClient, orderId: string) {
  const r = await client.functions.invoke("payment-reference", { body: { order_id: orderId } });
  if (r.error) {
    let code = "";
    try { code = (await (r.error as any).context?.json?.())?.error ?? ""; } catch { /* sem corpo */ }
    return { data: null, error: new Error(code || r.error.message) };
  }
  return { data: r.data as { entity: string; reference: string; amount: number | string; expires_at: string | null }, error: null };
}
export function confirmOrderReceived(client: SupabaseClient, orderId: string) {
  return client.rpc("confirm_order_received", { p_order_id: orderId });
}
export async function getMyWallet(client: SupabaseClient) {
  const r = await client.rpc("my_wallet");
  return { data: (r.data ?? null) as Wallet | null, error: r.error };
}
export function savePayoutAccount(client: SupabaseClient, a: PayoutAccountInput) {
  const bad = validatePayoutAccount(a);
  if (bad) return Promise.resolve({ data: null, error: new Error(bad) });
  return client.rpc("save_payout_account", { p_method: a.method, p_holder: a.holder.trim(), p_destination: a.destination });
}
export function requestPayout(client: SupabaseClient, amount?: number | null) { return client.rpc("request_payout", { p_amount: amount ?? null }); }
export function cancelPayout(client: SupabaseClient, payoutId: string) { return client.rpc("cancel_payout", { p_payout_id: payoutId }); }
export function setDisputeRefundAccount(client: SupabaseClient, disputeId: string, account: string) {
  if (!cleanRefundDestination(account)) return Promise.resolve({ data: null, error: new Error("Escreva um IBAN angolano válido (AO06 + 21 algarismos) ou um número Multicaixa Express (9 algarismos).") });
  return client.rpc("set_dispute_refund_account", { p_dispute_id: disputeId, p_account: account });
}
// Administração
export async function listOrderPaymentsForAdmin(client: SupabaseClient, status: OrderPaymentInfo["status"] | "" = "pending") {
  const r = await client.rpc("admin_list_order_payments", { p_status: status || null });
  return { data: (r.data ?? []) as AdminOrderPayment[], error: r.error };
}
export function decideOrderPayment(client: SupabaseClient, paymentId: string, confirm: boolean, note?: string) {
  return client.rpc("admin_decide_order_payment", { p_payment_id: paymentId, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function listPayoutsForAdmin(client: SupabaseClient, status: PayoutStatus | "" = "requested") {
  const r = await client.rpc("admin_list_payouts", { p_status: status || null });
  return { data: (r.data ?? []) as AdminPayout[], error: r.error };
}
export function startPayoutBatch(client: SupabaseClient) { return client.rpc("admin_start_payout_batch"); }
export function markPayoutsPaid(client: SupabaseClient, ids: string[], bankReference?: string) {
  return client.rpc("admin_mark_payouts_paid", { p_ids: ids, p_bank_reference: bankReference?.trim() || null });
}
export function rejectPayout(client: SupabaseClient, payoutId: string, note: string) { return client.rpc("admin_reject_payout", { p_payout_id: payoutId, p_note: note.trim() }); }
export function releaseEscrowAsAdmin(client: SupabaseClient, orderId: string, note: string) { return client.rpc("admin_release_escrow", { p_order_id: orderId, p_note: note.trim() }); }
export async function getEscrowSummary(client: SupabaseClient) {
  const r = await client.rpc("admin_escrow_summary");
  return { data: (r.data ?? null) as EscrowSummary | null, error: r.error };
}
