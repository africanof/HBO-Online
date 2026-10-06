import type { SupabaseClient } from "@supabase/supabase-js";

export type SavedItemInput =
  | {userId:string;businessId:string}
  | {userId:string;providerId:string}
  | {userId:string;serviceId:string}
  | {userId:string;productId:string}
  | {userId:string;auctionId:string}
  | {userId:string;classifiedListingId:string};

export async function saveItem(client:SupabaseClient,input:SavedItemInput){
  return client.from("saved_items").insert({
    user_id:input.userId,
    business_id:"businessId" in input ? input.businessId : null,
    provider_id:"providerId" in input ? input.providerId : null,
    service_id:"serviceId" in input ? input.serviceId : null,
    product_id:"productId" in input ? input.productId : null,
    auction_id:"auctionId" in input ? input.auctionId : null,
    classified_listing_id:"classifiedListingId" in input ? input.classifiedListingId : null
  }).select().single();
}

export async function listSavedItems(client:SupabaseClient){
  return client.from("saved_items").select("id,user_id,business_id,provider_id,service_id,product_id,auction_id,classified_listing_id,created_at,classified_listings(id,title,description,price,currency,status,media)").order("created_at",{ascending:false});
}

export async function removeSavedItem(client:SupabaseClient,id:string){
  return client.from("saved_items").delete().eq("id",id);
}
export async function isClassifiedListingSaved(client:SupabaseClient,userId:string,classifiedListingId:string){
  return client.from("saved_items").select("id").eq("user_id",userId).eq("classified_listing_id",classifiedListingId).maybeSingle();
}

export async function saveClassifiedListing(client:SupabaseClient,userId:string,classifiedListingId:string){
  return saveItem(client,{userId,classifiedListingId});
}

export async function removeClassifiedListing(client:SupabaseClient,userId:string,classifiedListingId:string){
  return client.from("saved_items").delete().eq("user_id",userId).eq("classified_listing_id",classifiedListingId);
}
