import type { SupabaseClient } from "@supabase/supabase-js";

export async function listLiveAuctions(client:SupabaseClient){
  return client.from("auctions").select("id,seller_id,product_id,title,description,currency,starting_price,reserve_price,min_increment,current_price,starts_at,ends_at,status,winner_id").in("status",["scheduled","live"]).order("ends_at");
}
export async function createAuction(client:SupabaseClient,input:{sellerId:string;productId?:string;title:string;description?:string;startingPrice:number;reservePrice?:number;minIncrement?:number;startsAt:string;endsAt:string}){
  return client.from("auctions").insert({seller_id:input.sellerId,product_id:input.productId||null,title:input.title.trim(),description:input.description?.trim()||null,starting_price:input.startingPrice,reserve_price:input.reservePrice??null,min_increment:input.minIncrement??0,current_price:input.startingPrice,starts_at:input.startsAt,ends_at:input.endsAt,status:"draft"}).select().single();
}
export async function placeBid(client:SupabaseClient,auctionId:string,amount:number){
  return client.rpc("place_auction_bid",{p_auction_id:auctionId,p_amount:amount});
}
export async function listAuctionBids(client:SupabaseClient,auctionId:string){
  return client.from("auction_bids").select("id,auction_id,bidder_id,amount,created_at").eq("auction_id",auctionId).order("created_at",{ascending:false});
}