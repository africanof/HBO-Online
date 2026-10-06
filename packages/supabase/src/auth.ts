import type { SupabaseClient } from "@supabase/supabase-js";

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  municipality?: string;
}

export async function signUp(client: SupabaseClient, input: SignUpInput) {
  return client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() || null,
        municipality: input.municipality?.trim() || ""
      }
    }
  });
}

export async function signIn(client: SupabaseClient, email: string, password: string) {
  return client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
}

export async function signOut(client: SupabaseClient) {
  return client.auth.signOut();
}
