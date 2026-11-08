import type { SupabaseClient } from "@supabase/supabase-js";

/** Entrar e criar conta com Google, Facebook ou Apple (igual no Site e na APP). */
export type SocialProvider = "google" | "facebook" | "apple";
export const SOCIAL_PROVIDERS: { id: SocialProvider; label: string; icon: string }[] = [
  { id: "google", label: "Google", icon: "G" },
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "apple", label: "Apple", icon: "" }
];

/** Quais estão ligados no Supabase (Authentication → Providers). Os botões só aparecem para esses. */
export async function enabledSocialProviders(supabaseUrl: string, publishableKey: string, fetcher: typeof fetch = fetch): Promise<SocialProvider[]> {
  try {
    const r = await fetcher(supabaseUrl.replace(/\/$/, "") + "/auth/v1/settings", { headers: { apikey: publishableKey } });
    if (!r.ok) return [];
    const ext = ((await r.json()) as { external?: Record<string, boolean> }).external ?? {};
    return SOCIAL_PROVIDERS.map(p => p.id).filter(id => ext[id] === true);
  } catch { return []; }
}

/** Lê o regresso do Google/Facebook/Apple: «?code=…» (PKCE) ou «#access_token=…&refresh_token=…», ou o erro. */
export function parseAuthReturn(url: string): { code?: string; accessToken?: string; refreshToken?: string; error?: string } {
  const u = new URL(url.replace(/^([a-z][\w+.-]*):\/\/(?!\/)/i, "https://app/").replace("https://app//", "https://app/"));
  const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
  const q = u.searchParams;
  const error = q.get("error_description") || hash.get("error_description") || q.get("error") || hash.get("error") || undefined;
  return { code: q.get("code") ?? undefined, accessToken: hash.get("access_token") ?? undefined, refreshToken: hash.get("refresh_token") ?? undefined, error: error ?? undefined };
}

/** Guarda a sessão a partir do regresso (código ou tokens). */
export async function completeSocialLogin(client: SupabaseClient, returnUrl: string) {
  const r = parseAuthReturn(returnUrl);
  if (r.error) return { error: new Error(r.error) };
  if (r.code) { const x = await client.auth.exchangeCodeForSession(r.code); return { error: x.error }; }
  if (r.accessToken && r.refreshToken) { const x = await client.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken }); return { error: x.error }; }
  return { error: new Error("SOCIAL_LOGIN_CANCELLED") };
}
