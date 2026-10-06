import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";

export async function searchClassifiedByLocation(client:SupabaseClient,filters:{
 provinceId?:string; municipalityId?:string; neighborhoodId?:string;
 listingType?:ClassifiedListingType; purpose?:ClassifiedPurpose; limit?:number;
}={}){
 return client.rpc("search_classified_by_location",{
  p_province_id:filters.provinceId??null,p_municipality_id:filters.municipalityId??null,
  p_neighborhood_id:filters.neighborhoodId??null,p_listing_type:filters.listingType??null,
  p_purpose:filters.purpose??null,p_limit:Math.max(1,Math.min(filters.limit??30,100))
 });
}