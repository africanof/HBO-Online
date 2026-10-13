import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "./engage";

/**
 * Convide um amigo (igual no Site e na APP). Cada pessoa tem um código (ex.: K7M2QX) e uma ligação.
 * Quando o amigo paga a primeira mensalidade (profissional, empresa ou loja), quem convidou ganha 1 mês grátis.
 */
export type ReferralStatus = "joined" | "earned" | "rewarded";
export type ReferralFriend = { name: string; status: ReferralStatus; reward_days: number | null; created_at: string };
export type ReferralPanel = {
  code: string; reward_days: number; invited: number; earned: number; days_earned: number; waiting_days: number;
  can_claim: boolean; invited_by: string | null; friends: ReferralFriend[];
};
export const REFERRAL_KEY = "huambo:convite";
export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  joined: "Entrou — ainda não pagou a primeira mensalidade",
  earned: "🎁 Ganhou! O prémio entra na sua primeira mensalidade",
  rewarded: "✅ Mês grátis já aplicado"
};

export function normalizeReferralCode(code: string | null | undefined): string {
  return (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function isReferralCodeShape(code: string | null | undefined): boolean { return /^[A-HJ-NP-Z2-9]{6}$/.test(normalizeReferralCode(code)); }
export function referralLink(siteUrl: string, code: string): string { return `${siteUrl.replace(/\/$/, "")}/?convite=${normalizeReferralCode(code)}`; }
export function referralRewardText(days: number | null | undefined): string {
  const d = Number(days ?? 30);
  const what = d === 30 ? "1 mês grátis" : `${d} dias grátis`;
  return `Ganhe ${what} na sua mensalidade por cada amigo que entrar com o seu convite e pagar a primeira mensalidade (profissional, empresa ou loja).`;
}
export function referralInviteMessage(siteUrl: string, code: string): string {
  return `Olá! Uso o Huambo Online para comprar, vender e encontrar profissionais no Huambo. Entra com o meu convite:\n👉 ${referralLink(siteUrl, code)}\n(código ${normalizeReferralCode(code)})`;
}
export function daysText(days: number): string { return days === 30 ? "1 mês" : days % 30 === 0 ? `${days / 30} meses` : `${days} dias`; }

// --- Guardar o código até a pessoa ter sessão ---------------------------------------------------
export async function storeReferralCode(store: KeyValueStore, code: string | null | undefined) {
  const c = normalizeReferralCode(code);
  if (!isReferralCodeShape(c)) return;
  try { await store.setItem(REFERRAL_KEY, c); } catch { /* opcional */ }
}
export async function pendingReferralCode(store: KeyValueStore): Promise<string> {
  try { return normalizeReferralCode(await store.getItem(REFERRAL_KEY)); } catch { return ""; }
}

// --- Servidor ---------------------------------------------------------------------------------
export async function getMyReferrals(client: SupabaseClient) {
  const r = await client.rpc("my_referrals");
  return { data: (r.data ?? null) as ReferralPanel | null, error: r.error };
}
export async function claimReferral(client: SupabaseClient, code: string) {
  const c = normalizeReferralCode(code);
  if (!isReferralCodeShape(c)) return { data: null as string | null, error: new Error("O código de convite tem 6 letras e números (ex.: K7M2QX).") };
  const r = await client.rpc("claim_referral", { p_code: c });
  return { data: (r.data ?? null) as string | null, error: r.error };
}
/** Depois de entrar: usa o código guardado (da ligação ou do registo) uma só vez. */
let inflight: Promise<{ data: string | null; error: unknown } | null> | null = null;
export function claimPendingReferral(client: SupabaseClient, store: KeyValueStore) {
  // Ao entrar, o aviso de sessão e a verificação inicial chegam juntos: um só pedido de cada vez.
  inflight ??= claimPendingOnce(client, store).finally(() => { inflight = null; });
  return inflight;
}
async function claimPendingOnce(client: SupabaseClient, store: KeyValueStore) {
  const code = await pendingReferralCode(store);
  if (!code) return null;
  const r = await claimReferral(client, code);
  const msg = String((r.error as { message?: string } | null)?.message ?? "");
  // Só volta a tentar se foi falta de rede; erros do convite (já usado, conta antiga…) apagam o código.
  if (!r.error || /REFERRAL_|código de convite/i.test(msg)) { try { await store.setItem(REFERRAL_KEY, ""); } catch { /* opcional */ } }
  return r;
}
