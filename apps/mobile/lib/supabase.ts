import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { configureSupabase, createSupabaseClient } from "@huambo-online/supabase";

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

export const supabaseConfigured = Boolean(url && key && /^https:\/\//i.test(url));
/** Endereço do Site (links de confirmação e recuperação de palavra-passe abrem no Site). */
export const siteUrl = (process.env.EXPO_PUBLIC_SITE_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");

// A sessão fica guardada no telemóvel e é partilhada por todos os ecrãs.
configureSupabase({ storage: AsyncStorage, detectSessionInUrl: false });

export function supabase() {
  if (!supabaseConfigured) throw new Error("Serviço indisponível: configuração do Supabase em falta.");
  return createSupabaseClient(url, key);
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data.user?.id ?? null;
}

/** Renova o token só com a APP aberta (recomendação do Supabase para React Native). */
export function startAuthAutoRefresh() {
  if (!supabaseConfigured) return () => {};
  const auth = supabase().auth;
  if (AppState.currentState === "active") void auth.startAutoRefresh();
  const sub = AppState.addEventListener("change", state => { if (state === "active") void auth.startAutoRefresh(); else void auth.stopAutoRefresh(); });
  return () => sub.remove();
}
