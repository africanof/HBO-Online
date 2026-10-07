import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@huambo-online/types";

const PROFILE_COLUMNS = "id,full_name,phone,province,municipality";

type ProfileRow = { id: string; full_name: string | null; phone: string | null; province: string | null; municipality: string | null };

export function profileFromRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name ?? "",
    phone: row.phone ?? undefined,
    province: row.province ?? "Huambo",
    municipality: row.municipality ?? ""
  };
}

export type ProfileInput = Pick<UserProfile, "fullName" | "phone" | "municipality">;

export function validateProfileInput(input: ProfileInput): string | null {
  if (!input.fullName.trim()) return "Indique o seu nome.";
  if (input.fullName.trim().length > 120) return "O nome é demasiado longo.";
  const phone = input.phone?.trim();
  if (phone && !/^\+?[0-9 ]{9,15}$/.test(phone)) return "Telefone inválido. Use apenas números (ex.: 923 000 000).";
  return null;
}

export async function getCurrentUserProfile(client: SupabaseClient): Promise<{ data: UserProfile | null; error: any }> {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { data: null, error: authError };
  const { data, error } = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  if (error) return { data: null, error };
  return { data: data ? profileFromRow(data as ProfileRow) : null, error: null };
}

export async function updateCurrentUserProfile(client: SupabaseClient, input: ProfileInput): Promise<{ data: UserProfile | null; error: any }> {
  const invalid = validateProfileInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { data: null, error: authError ?? new Error("Utilizador não autenticado.") };
  const { data, error } = await client.from("profiles")
    .update({ full_name: input.fullName.trim(), phone: input.phone?.trim() || null, municipality: input.municipality.trim() })
    .eq("id", user.id).select(PROFILE_COLUMNS).single();
  if (error) {
    const msg = /duplicate key|unique/i.test(error.message) ? "Este telefone já está associado a outra conta." : error.message;
    return { data: null, error: new Error(msg) };
  }
  return { data: profileFromRow(data as ProfileRow), error: null };
}

export async function signOutCurrentUser(client: SupabaseClient) { return client.auth.signOut(); }

export type PublicProfile = { id: string; full_name: string; avatar_url: string | null; province: string | null; municipality: string | null; created_at: string };

/** Nome e município do anunciante (só dados públicos). */
export async function getPublicProfile(client: SupabaseClient, userId: string) {
  return client.rpc("get_public_profile", { p_user_id: userId }).maybeSingle<PublicProfile>();
}
