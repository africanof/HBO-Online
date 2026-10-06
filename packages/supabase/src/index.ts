import { createClient } from "@supabase/supabase-js";
export { signUp, signIn, signOut } from "./auth";
export type { SignUpInput } from "./auth";

export function createSupabaseClient(url: string, publishableKey: string) {
  if (!url || !publishableKey) throw new Error("Supabase URL e publishable key são obrigatórias.");
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}
