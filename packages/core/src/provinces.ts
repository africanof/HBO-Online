import type { SupabaseClient } from "@supabase/supabase-js";

export async function listActiveProvinces(client:SupabaseClient,countryCode="AO"){
  return client.rpc("list_active_provinces",{p_country_code:countryCode.toUpperCase()});
}
// Painel: desbloquear províncias e gerir os municípios de cada uma (administradores e moderadores).
export type AdminProvince = { id: string; name: string; active: boolean; municipalities: number; listings: number };
export async function adminListProvinces(client: SupabaseClient) {
  const r = await client.rpc("admin_list_provinces");
  return { data: (r.data ?? []) as AdminProvince[], error: r.error };
}
export function setProvinceActive(client: SupabaseClient, provinceId: string, active: boolean) {
  return client.rpc("admin_set_province_active", { p_province_id: provinceId, p_active: active });
}
export async function adminListMunicipalities(client: SupabaseClient, provinceId: string) {
  const r = await client.rpc("admin_list_municipalities", { p_province_id: provinceId });
  return { data: (r.data ?? []) as { id: string; name: string }[], error: r.error };
}
/** Um município por linha (ou separados por vírgulas); nomes vazios e repetidos ficam de fora. */
export function parseMunicipalityNames(text: string): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const n = raw.replace(/\s+/g, " ").trim();
    if (n.length < 2 || n.length > 80 || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase()); out.push(n);
  }
  return out.slice(0, 400);
}
export function addMunicipalities(client: SupabaseClient, provinceId: string, text: string) {
  return client.rpc("admin_add_municipalities", { p_province_id: provinceId, p_names: parseMunicipalityNames(text) });
}
export function renameMunicipality(client: SupabaseClient, municipalityId: string, name: string) {
  return client.rpc("admin_rename_municipality", { p_municipality_id: municipalityId, p_name: name.trim() });
}
export function deleteMunicipality(client: SupabaseClient, municipalityId: string) {
  return client.rpc("admin_delete_municipality", { p_municipality_id: municipalityId });
}
