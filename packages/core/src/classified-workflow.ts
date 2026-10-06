import type { SupabaseClient } from "@supabase/supabase-js";

export async function publishClassifiedListing(client:SupabaseClient,listingId:string){
  return client.rpc("publish_classified_listing",{p_listing_id:listingId});
}

export async function closeClassifiedListing(client:SupabaseClient,listingId:string,status:"sold"|"rented"|"closed"|"cancelled"){
  return client.rpc("close_classified_listing",{p_listing_id:listingId,p_final_status:status});
}