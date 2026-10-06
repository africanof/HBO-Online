import type { SupabaseClient } from "@supabase/supabase-js";

export async function closeAuction(client:SupabaseClient, auctionId:string){
  return client.rpc("close_auction",{p_auction_id:auctionId});
}

export async function activateDueAuctions(client:SupabaseClient){
  return client.rpc("activate_due_auctions");
}

export async function getAuction(client:SupabaseClient, auctionId:string){
  return client.from("auctions").select("id,seller_id,product_id,title,description,currency,starting_price,reserve_price,min_increment,current_price,starts_at,ends_at,status,winner_id").eq("id",auctionId).single();
}