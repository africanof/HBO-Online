import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoryType = string;

export async function listActiveCategories(client:SupabaseClient,type?:CategoryType){
  return client.rpc("list_active_categories",{p_type:type??null});
}