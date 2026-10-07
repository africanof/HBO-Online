import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
export { signUp, signIn, signOut } from "./auth";
export type { SignUpInput } from "./auth";

export interface SupabaseClientOptions {
  /** Armazenamento da sessão (no telemóvel: AsyncStorage). No browser usa-se localStorage. */
  storage?: SupportedStorage;
  /** Ler a sessão do URL (links de recuperação). Desligar no telemóvel. */
  detectSessionInUrl?: boolean;
}

let defaults: SupabaseClientOptions = {};
const clients = new Map<string, SupabaseClient>();

/** Define as opções usadas por todos os clientes criados a seguir (chamar no arranque da APP). */
export function configureSupabase(options: SupabaseClientOptions) {
  defaults = { ...defaults, ...options };
  clients.clear();
}

/**
 * Devolve sempre o mesmo cliente para o mesmo URL/chave.
 * Um único cliente por app evita perder a sessão entre páginas/ecrãs.
 */
export function createSupabaseClient(url: string, publishableKey: string): SupabaseClient {
  const u = (url ?? "").trim();
  const k = (publishableKey ?? "").trim();
  if (!u || !k) throw new Error("Supabase URL e publishable key são obrigatórias.");
  const cacheKey = u + "|" + k;
  const existing = clients.get(cacheKey);
  if (existing) return existing;
  const client = createClient(u, k, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: defaults.detectSessionInUrl ?? true,
      ...(defaults.storage ? { storage: defaults.storage } : {})
    }
  });
  clients.set(cacheKey, client);
  return client;
}
