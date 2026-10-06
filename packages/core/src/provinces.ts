import type { SupabaseClient } from "@supabase/supabase-js";

export async function listActiveProvinces(client:SupabaseClient,countryCode="AO"){
  return client.rpc("list_active_provinces",{p_country_code:countryCode.toUpperCase()});
}