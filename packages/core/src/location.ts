import type { SupabaseClient } from "@supabase/supabase-js";

export async function listProvinces(client: SupabaseClient) {
  return client.from("provinces").select("id,name,country_code").order("name");
}
export async function listMunicipalities(client: SupabaseClient, provinceId: string) {
  return client.from("municipalities").select("id,name,province_id").eq("province_id", provinceId).order("name");
}
export async function listNeighborhoods(client: SupabaseClient, municipalityId: string) {
  return client.from("neighborhoods").select("id,name,municipality_id").eq("municipality_id", municipalityId).order("name");
}