import type { SupabaseClient } from "@supabase/supabase-js";

type SavedTarget = { business_id?:string; provider_id?:string; service_id?:string; product_id?:string };

export async function saveItem(client:SupabaseClient,userId:string,target:SavedTarget){
  return client.from("saved_items").insert({user_id:userId,...target}).select().single();
}
export async function unsaveItem(client:SupabaseClient,userId:string,target:SavedTarget){
  let q=client.from("saved_items").delete().eq("user_id",userId);
  for(const [field,value] of Object.entries(target)){if(value) q=q.eq(field,value);}
  return q;
}
export async function listSavedItems(client:SupabaseClient){
  return client.from("saved_items").select("id,user_id,business_id,provider_id,service_id,product_id,created_at").order("created_at",{ascending:false});
}
export async function followBusiness(client:SupabaseClient,userId:string,businessId:string){
  return client.from("followed_businesses").insert({user_id:userId,business_id:businessId});
}
export async function unfollowBusiness(client:SupabaseClient,userId:string,businessId:string){
  return client.from("followed_businesses").delete().eq("user_id",userId).eq("business_id",businessId);
}
export async function followProvider(client:SupabaseClient,userId:string,providerId:string){
  return client.from("followed_providers").insert({user_id:userId,provider_id:providerId});
}
export async function unfollowProvider(client:SupabaseClient,userId:string,providerId:string){
  return client.from("followed_providers").delete().eq("user_id",userId).eq("provider_id",providerId);
}