import type { SupabaseClient } from "@supabase/supabase-js";

export async function getReputation(client:SupabaseClient,target:{
  businessId?:string; providerId?:string; productId?:string; serviceId?:string;
}){
  return client.rpc("reputation_summary",{
    p_business_id:target.businessId??null,
    p_provider_id:target.providerId??null,
    p_product_id:target.productId??null,
    p_service_id:target.serviceId??null
  });
}

export async function listPublishedReviews(client:SupabaseClient,target:{
  businessId?:string; providerId?:string; productId?:string; serviceId?:string;
}){
  let q=client.from("reviews").select("id,author_id,business_id,provider_id,product_id,service_id,order_id,rating,title,comment,created_at").eq("status","published").order("created_at",{ascending:false});
  if(target.businessId) q=q.eq("business_id",target.businessId);
  if(target.providerId) q=q.eq("provider_id",target.providerId);
  if(target.productId) q=q.eq("product_id",target.productId);
  if(target.serviceId) q=q.eq("service_id",target.serviceId);
  return q;
}