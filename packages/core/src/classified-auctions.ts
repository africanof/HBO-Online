import type { SupabaseClient } from "@supabase/supabase-js";

export async function createClassifiedAuction(client:SupabaseClient,input:{
  listingId:string; startsAt:string; endsAt:string; startingPrice:number; reservePrice?:number; minIncrement?:number;
}){
  return client.rpc("create_classified_auction",{
    p_listing_id:input.listingId,p_starts_at:input.startsAt,p_ends_at:input.endsAt,
    p_starting_price:input.startingPrice,p_reserve_price:input.reservePrice??null,
    p_min_increment:input.minIncrement??0
  });
}

export async function getAuctionListing(client:SupabaseClient,auctionId:string){
  return client.from("auctions").select("*,classified_listings(*)").eq("id",auctionId).single();
}