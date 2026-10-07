import { createSupabaseClient } from "@huambo-online/supabase";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

export const supabaseConfigured = Boolean(url && key && /^https:\/\//i.test(url));

/** Cliente único do Site (a sessão fica partilhada entre páginas). */
export function supabase() {
  if (!supabaseConfigured) throw new Error("Serviço indisponível: configuração do Supabase em falta.");
  return createSupabaseClient(url, key);
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data.user?.id ?? null;
}
