import type { SupabaseClient } from "@supabase/supabase-js";

export async function changeCurrentUserPassword(client: SupabaseClient, newPassword: string, confirmation: string) {
  if (newPassword.length < 8) return { data: null, error: new Error("A palavra-passe deve ter pelo menos 8 caracteres.") };
  if (newPassword !== confirmation) return { data: null, error: new Error("As palavras-passe não coincidem.") };
  return client.auth.updateUser({ password: newPassword });
}

export async function requestPasswordReset(client: SupabaseClient, email: string, redirectTo: string) {
  if (!email.trim()) return { data: null, error: new Error("Indique o e-mail da conta.") };
  return client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}

export async function deleteCurrentUserAccount(client: SupabaseClient, confirmation: string){
  if(confirmation.trim().toUpperCase() !== "ELIMINAR") return {data:null,error:new Error('Escreva "ELIMINAR" para confirmar.')};
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user) return {data:null,error:authError??new Error("Utilizador não autenticado.")};
  const {error}=await client.rpc("delete_my_account");
  if(error) return {data:null,error};
  return client.auth.signOut();
}
