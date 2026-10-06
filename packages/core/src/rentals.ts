import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestRental(client:SupabaseClient,input:{
 listingId:string; startsAt:string; endsAt:string; price:number; message?:string;
}){
 return client.rpc("request_classified_rental",{
  p_listing_id:input.listingId,p_starts_at:input.startsAt,p_ends_at:input.endsAt,
  p_price:input.price,p_message:input.message?.trim()||null
 });
}
export async function listMyRentalRequests(client:SupabaseClient){
 return client.from("rental_requests").select("*").order("created_at",{ascending:false});
}
export async function updateRentalRequest(client:SupabaseClient,id:string,status:"accepted"|"rejected"|"cancelled"){
 return client.from("rental_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id).select().single();
}