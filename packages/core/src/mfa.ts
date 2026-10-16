import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Autenticação em dois passos com uma APP autenticadora (Google Authenticator, Microsoft Authenticator, Authy…).
 * Usa o MFA do Supabase (TOTP): ao entrar, depois da palavra-passe pede o código de 6 algarismos.
 */
export type MfaFactor = { id: string; friendly_name?: string | null; factor_type: string; status: "verified" | "unverified"; created_at: string };
export type MfaEnrollment = { factorId: string; qrCode: string; secret: string; uri: string };

export function normalizeTotpCode(code: string): string { return (code ?? "").replace(/\D/g, ""); }
export function validateTotpCode(code: string): string | null {
  return normalizeTotpCode(code).length === 6 ? null : "Escreva os 6 algarismos que aparecem na APP autenticadora.";
}
/** Segredo em grupos de 4 para escrever à mão na APP. */
export function formatTotpSecret(secret: string): string { return (secret ?? "").replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") ?? ""; }
export function mfaErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as any).message) : String(error ?? "");
  if (/invalid totp code|invalid code|code.*(invalid|expired)/i.test(raw)) return "Código errado ou já fora do tempo. Escreva o código que aparece agora na APP.";
  if (/too many|rate limit/i.test(raw)) return "Demasiadas tentativas. Aguarde um minuto e tente novamente.";
  if (/mfa.*(disabled|not enabled)|totp.*disabled/i.test(raw)) return "A autenticação em dois passos não está ligada no servidor. Fale com a administração.";
  if (/maximum number of (verified )?factors|already exists/i.test(raw)) return "Já tem uma APP autenticadora ligada. Desligue-a primeiro para ligar outra.";
  if (/aal2|AAL2/.test(raw)) return "Por segurança, entre de novo com o código da APP autenticadora antes de fazer isto.";
  return raw || "Não foi possível concluir. Tente novamente.";
}

export async function listTotpFactors(client: SupabaseClient) {
  const r = await client.auth.mfa.listFactors();
  return { data: ((r.data?.totp ?? []) as unknown as MfaFactor[]), error: r.error };
}
/** Passo 1 de ligar: cria o fator e devolve o QR (imagem SVG em data URL) e o segredo para escrever à mão. Apaga tentativas antigas por acabar. */
export async function startTotpEnrollment(client: SupabaseClient, name = "Huambo Online") {
  const all = await client.auth.mfa.listFactors();
  for (const f of (all.data?.all ?? []) as unknown as MfaFactor[]) if (f.factor_type === "totp" && f.status === "unverified") await client.auth.mfa.unenroll({ factorId: f.id });
  const r = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `${name} ${new Date().toISOString().slice(0, 10)}` });
  if (r.error || !r.data) return { data: null, error: r.error ?? new Error("Não foi possível começar.") };
  const d = r.data as any;
  return { data: { factorId: d.id, qrCode: d.totp.qr_code, secret: d.totp.secret, uri: d.totp.uri } as MfaEnrollment, error: null };
}
/** Passo 2 de ligar (ou entrar): confirma o código de 6 algarismos. */
export async function verifyTotp(client: SupabaseClient, factorId: string, code: string) {
  const bad = validateTotpCode(code); if (bad) return { data: null, error: new Error(bad) };
  return client.auth.mfa.challengeAndVerify({ factorId, code: normalizeTotpCode(code) });
}
export async function disableTotp(client: SupabaseClient, factorId: string) { return client.auth.mfa.unenroll({ factorId }); }
/** Depois da palavra-passe: falta o código? (a conta tem APP autenticadora e a sessão ainda não foi confirmada). */
export async function mfaRequired(client: SupabaseClient): Promise<boolean> {
  const r = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  return !r.error && r.data?.nextLevel === "aal2" && r.data?.currentLevel !== "aal2";
}
/** Entrar com o código: usa a primeira APP autenticadora confirmada. */
export async function verifyLoginTotp(client: SupabaseClient, code: string) {
  const f = await listTotpFactors(client);
  const factor = f.data.find(x => x.status === "verified");
  if (!factor) return { data: null, error: f.error ?? new Error("Esta conta não tem APP autenticadora ligada.") };
  return verifyTotp(client, factor.id, code);
}
export const MFA_APPS = ["Google Authenticator", "Microsoft Authenticator", "Authy"];
export const MFA_STEPS = [
  "Instale no telemóvel uma APP autenticadora (Google Authenticator, Microsoft Authenticator ou Authy).",
  "Na APP, carregue em «+» e leia o código QR (ou escreva a chave à mão).",
  "Escreva aqui os 6 algarismos que a APP mostra, para confirmar."
];
