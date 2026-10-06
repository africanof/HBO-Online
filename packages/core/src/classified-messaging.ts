import type { SupabaseClient } from "@supabase/supabase-js";

export async function contactListingOwner(client:SupabaseClient,listingId:string,message:string){
  return client.rpc("start_classified_conversation",{
    p_listing_id:listingId,p_message:message.trim()
  });
}

export async function listListingConversations(client:SupabaseClient,listingId:string){
  return client.from("conversations")
    .select("id,created_by,subject,context_type,classified_listing_id,created_at,updated_at")
    .eq("classified_listing_id",listingId)
    .order("updated_at",{ascending:false});
}
export async function getConversation(client:SupabaseClient,conversationId:string){return client.from("conversations").select("id,created_by,subject,context_type,classified_listing_id,created_at,updated_at").eq("id",conversationId).maybeSingle();}
