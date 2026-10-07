import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "./classified-listings";

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(newPassword: string, confirmation: string): string | null {
  if (newPassword.length < MIN_PASSWORD_LENGTH) return `A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (newPassword !== confirmation) return "As palavras-passe não coincidem.";
  return null;
}

/** Mensagens claras para erros de login/registo. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as any).message) : String(error ?? "");
  if (/invalid login credentials/i.test(raw)) return "Email ou palavra-passe incorretos.";
  if (/email not confirmed/i.test(raw)) return "Confirme primeiro o seu email (veja a caixa de entrada).";
  if (/already registered|already been registered|user already exists/i.test(raw)) return "Já existe uma conta com este email. Use «Entrar».";
  if (/password should be at least|weak password/i.test(raw)) return `A palavra-passe é fraca. Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (/rate limit|too many requests|security purposes/i.test(raw)) return "Demasiadas tentativas. Aguarde um minuto e tente novamente.";
  if (/database error saving new user/i.test(raw)) return "Não foi possível criar a conta. O telefone pode já estar associado a outra conta.";
  if (/unable to validate email|invalid email/i.test(raw)) return "Email inválido.";
  if (/failed to fetch|network request failed|load failed/i.test(raw)) return "Não foi possível contactar o serviço. Verifique a internet e tente novamente.";
  return friendlyError(error, "Não foi possível concluir a operação.");
}

export async function changeCurrentUserPassword(client: SupabaseClient, newPassword: string, confirmation: string) {
  const invalid = validateNewPassword(newPassword, confirmation);
  if (invalid) return { data: null, error: new Error(invalid) };
  return client.auth.updateUser({ password: newPassword });
}

export async function requestPasswordReset(client: SupabaseClient, email: string, redirectTo: string) {
  if (!email.trim()) return { data: null, error: new Error("Indique o e-mail da conta.") };
  return client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
}

export async function deleteCurrentUserAccount(client: SupabaseClient, confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "ELIMINAR") return { data: null, error: new Error('Escreva "ELIMINAR" para confirmar.') };
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { data: null, error: authError ?? new Error("Utilizador não autenticado.") };
  const { error } = await client.rpc("delete_my_account");
  if (error) return { data: null, error: /foreign key|violates/i.test(error.message) ? new Error("Não foi possível eliminar a conta porque ainda tem anúncios ou mensagens. Apague-os primeiro.") : error };
  return client.auth.signOut();
}
