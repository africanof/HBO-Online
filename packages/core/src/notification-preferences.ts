import type { SupabaseClient } from "@supabase/supabase-js";
export type NotificationPreferences={user_id:string;enabled:boolean;saved_search:boolean;messages:boolean;rentals:boolean;auctions:boolean;marketplace:boolean;reviews:boolean;system:boolean;interests_frequency?:InterestFrequency;email_digest?:boolean;updated_at:string};
export async function getNotificationPreferences(client:SupabaseClient){return client.rpc("get_notification_preferences").maybeSingle<NotificationPreferences>();}
export async function saveNotificationPreferences(client:SupabaseClient,p:Omit<NotificationPreferences,"user_id"|"updated_at">){const r=await client.rpc("upsert_notification_preferences",{p_enabled:p.enabled,p_saved_search:p.saved_search,p_messages:p.messages,p_rentals:p.rentals,p_auctions:p.auctions,p_marketplace:p.marketplace,p_reviews:p.reviews,p_system:p.system});return{data:(r.data??null) as NotificationPreferences|null,error:r.error};}

/** «✨ Novidades para si»: avisos com anúncios novos de que a pessoa pode gostar (pelo que viu, pesquisou e guardou). */
export type InterestFrequency = "daily" | "weekly" | "off";
export const INTEREST_FREQUENCIES: { value: InterestFrequency; label: string }[] = [
  { value: "daily", label: "No máximo um aviso por dia" },
  { value: "weekly", label: "Uma vez por semana" },
  { value: "off", label: "Desligado" }
];
export async function setInterestNotifications(client: SupabaseClient, frequency: InterestFrequency) {
  const r = await client.rpc("set_interest_notifications", { p_frequency: frequency });
  return { data: (r.data ?? null) as NotificationPreferences | null, error: r.error };
}

/** Resumo diário por email (Resend): ligar/desligar com sessão iniciada. */
export async function setEmailDigest(client: SupabaseClient, enabled: boolean) {
  const r = await client.rpc("set_email_digest", { p_enabled: enabled });
  return { data: (r.data ?? null) as NotificationPreferences | null, error: r.error };
}

/** Cancelar os emails pela ligação do email (sem sessão). */
export async function unsubscribeEmail(client: SupabaseClient, token: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token.trim())) return { ok: false };
  const r = await client.rpc("unsubscribe_email", { p_token: token.trim() });
  return { ok: !r.error && r.data === true };
}
