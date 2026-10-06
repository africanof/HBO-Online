import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@huambo-online/types";

export async function getCurrentUserProfile(client: SupabaseClient): Promise<{data:UserProfile|null;error:any}> {
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user) return {data:null,error:authError};
  const {data,error}=await client.from("profiles").select("id,display_name,phone,avatar_url,country_code").eq("id",user.id).maybeSingle();
  if(error) return {data:null,error};
  return {data:data?{id:data.id,displayName:data.display_name??"",phone:data.phone??undefined,avatarUrl:data.avatar_url??undefined,countryCode:data.country_code??"AO"}:null,error:null};
}

export async function updateCurrentUserProfile(client: SupabaseClient,input:Pick<UserProfile,"displayName"|"phone"|"avatarUrl"|"countryCode">){
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user) return {data:null,error:authError??new Error("Utilizador não autenticado.")};
  return client.from("profiles").update({display_name:input.displayName.trim(),phone:input.phone?.trim()||null,avatar_url:input.avatarUrl?.trim()||null,country_code:input.countryCode.trim().toUpperCase()}).eq("id",user.id).select("id,display_name,phone,avatar_url,country_code").single();
}

export async function signOutCurrentUser(client: SupabaseClient){return client.auth.signOut();}

