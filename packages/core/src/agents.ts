import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";

/**
 * Agentes no terreno (igual no Site e na APP): pessoas nas praças (ex.: Kapango) que ajudam os vendedores a pôr
 * anúncios. O vendedor escreve o código do agente ao publicar; por cada anúncio publicado o agente ganha uma pequena
 * comissão, que a administração confirma e que entra no «O meu saldo» do agente.
 */
export type AgentStatus = "pending" | "active" | "suspended" | "rejected";
export type AgentCommissionStatus = "pending" | "approved" | "rejected";
export type FieldAgent = {
  code: string; status: AgentStatus; full_name: string; phone: string; note: string | null; admin_note: string | null;
  market_id: string | null; market_name: string | null; created_at: string;
};
export type AgentCommission = {
  id: string; listing_id: string | null; listing_title: string; amount: number; status: AgentCommissionStatus;
  admin_note: string | null; created_at: string; decided_at: string | null; listing_status: string | null;
};
export type AgentPanel = {
  agent: FieldAgent | null; fee_kz: number; daily_cap: number;
  pending_kz?: number; approved_kz?: number; listings?: number; commissions?: AgentCommission[];
};
export type AdminAgent = {
  user_id: string; code: string; full_name: string; phone: string; note: string | null; status: AgentStatus; admin_note: string | null;
  market_name: string | null; created_at: string; listings: number; pending_count: number; pending_kz: number; approved_kz: number;
};
export type AdminAgentCommission = {
  id: string; agent_id: string; agent_code: string; agent_name: string; listing_id: string | null; listing_title: string;
  listing_status: string | null; listing_ref: number | null; owner_name: string; amount: number; status: AgentCommissionStatus;
  admin_note: string | null; created_at: string;
};
export type AgentCodeInfo = { code: string; first_name: string; market_name: string | null };

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  pending: "⏳ À espera de aprovação", active: "✅ Agente ativo", suspended: "⛔ Suspenso", rejected: "Pedido não aceite"
};
export const AGENT_COMMISSION_STATUS_LABELS: Record<AgentCommissionStatus, string> = {
  pending: "⏳ À espera de confirmação", approved: "✅ Confirmada (no saldo)", rejected: "Recusada"
};

/** «ag-1001», «AG 1001» → «AG1001». */
export function normalizeAgentCode(code: string | null | undefined): string {
  return (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
/** Formato do código: AG + números. */
export function isAgentCodeShape(code: string | null | undefined): boolean { return /^AG\d{4,}$/.test(normalizeAgentCode(code)); }

export function validateAgentApplication(i: { marketId?: string | null; fullName: string; phone: string }): string | null {
  if (!i.marketId) return "Escolha a praça onde trabalha.";
  if (i.fullName.trim().length < 3) return "Escreva o nome completo.";
  if (i.phone.replace(/[^0-9]/g, "").length < 9) return "Escreva um telefone com 9 algarismos.";
  return null;
}
export function agentOfferText(feeKz: number | null | undefined, dailyCap?: number | null): string {
  const fee = Number(feeKz ?? 0);
  if (!fee) return "Ajude os vendedores da sua praça a pôr anúncios no Huambo Online.";
  return `Ganhe ${formatPrice(fee)} por cada anúncio publicado com o seu código${dailyCap ? ` (até ${dailyCap} por dia)` : ""}.`;
}
/** Mensagem que o agente envia no WhatsApp aos vendedores. */
export function agentInviteMessage(code: string, firstName: string, siteUrl: string): string {
  return `Olá! Sou ${firstName}, agente do Huambo Online. Ajudo a pôr o seu anúncio na internet, de graça para si.\n` +
    `Ao publicar, escreva o meu código: ${code}\n👉 ${siteUrl.replace(/\/$/, "")}/classificados/publicar?agente=${code}`;
}
export function agentTotals(p: AgentPanel | null) {
  const list = p?.commissions ?? [];
  return {
    pending: Number(p?.pending_kz ?? 0), approved: Number(p?.approved_kz ?? 0), listings: Number(p?.listings ?? 0),
    rejected: list.filter(c => c.status === "rejected").length, count: list.length
  };
}
/** Totais das comissões escolhidas (administração). */
export function sumCommissions(list: { id: string; amount: number }[], ids: string[]): number {
  return list.filter(c => ids.includes(c.id)).reduce((s, c) => s + Number(c.amount || 0), 0);
}

// --- Servidor ---------------------------------------------------------------------------------
export async function getMyAgentPanel(client: SupabaseClient) {
  const r = await client.rpc("my_field_agent");
  return { data: (r.data ?? null) as AgentPanel | null, error: r.error };
}
export function applyAsAgent(client: SupabaseClient, i: { marketId: string; fullName: string; phone: string; note?: string }) {
  const bad = validateAgentApplication(i);
  if (bad) return Promise.resolve({ data: null, error: new Error(bad) });
  return client.rpc("apply_field_agent", { p_market_id: i.marketId, p_full_name: i.fullName.trim(), p_phone: i.phone, p_note: i.note?.trim() || null });
}
/** Confirma um código: devolve o primeiro nome e a praça do agente (ou null). */
export async function checkAgentCode(client: SupabaseClient, code: string): Promise<AgentCodeInfo | null> {
  if (!isAgentCodeShape(code)) return null;
  const r = await client.rpc("check_agent_code", { p_code: normalizeAgentCode(code) });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return row ? row as AgentCodeInfo : null;
}
/** Diz que agente ajudou neste anúncio (código vazio = tirar). */
export function setListingAgent(client: SupabaseClient, listingId: string, code: string) {
  return client.rpc("set_listing_agent", { p_listing_id: listingId, p_code: normalizeAgentCode(code) });
}
export async function listAgentsForAdmin(client: SupabaseClient, status?: AgentStatus | "") {
  const r = await client.rpc("admin_list_agents", { p_status: status || null });
  return { data: (r.data ?? []) as AdminAgent[], error: r.error };
}
export function decideAgent(client: SupabaseClient, userId: string, status: Exclude<AgentStatus, "pending">, note?: string) {
  if (status !== "active" && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo.") });
  return client.rpc("admin_decide_agent", { p_user_id: userId, p_status: status, p_note: note?.trim() || null });
}
export async function listAgentCommissionsForAdmin(client: SupabaseClient, status: AgentCommissionStatus | "" = "pending") {
  const r = await client.rpc("admin_list_agent_commissions", { p_status: status || null });
  return { data: (r.data ?? []) as AdminAgentCommission[], error: r.error };
}
export function decideAgentCommissions(client: SupabaseClient, ids: string[], approve: boolean, note?: string) {
  if (!ids.length) return Promise.resolve({ data: 0, error: new Error("Escolha pelo menos uma comissão.") });
  if (!approve && !note?.trim()) return Promise.resolve({ data: 0, error: new Error("Escreva o motivo.") });
  return client.rpc("admin_decide_agent_commissions", { p_ids: ids, p_approve: approve, p_note: note?.trim() || null });
}
