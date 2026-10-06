import type { SupabaseClient } from "@supabase/supabase-js";

export async function reportClassifiedListing(client:SupabaseClient,listingId:string,reason:string,details?:string){
  return client.rpc("report_classified_listing",{
    p_listing_id:listingId,p_reason:reason.trim(),p_details:details?.trim()||null
  });
}

export async function getClassifiedModerationReports(client:SupabaseClient,listingId?:string){
  let q=client.from("moderation_reports")
    .select("id,reporter_id,target_id,reason,details,status,resolved_by,resolved_at,created_at")
    .eq("target_type","classified_listing")
    .order("created_at",{ascending:false});
  if(listingId) q=q.eq("target_id",listingId);
  return q;
}