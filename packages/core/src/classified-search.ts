import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
export type ClassifiedSearchFilters={listingType?:ClassifiedListingType;purpose?:ClassifiedPurpose;categoryId?:string;minPrice?:number;maxPrice?:number;query?:string;attributes?:Record<string,unknown>;limit?:number;streetId?:string;neighborhoodId?:string;municipalityId?:string;provinceId?:string;countryCode?:string};
export async function searchClassifiedListings(client:SupabaseClient,filters:ClassifiedSearchFilters={}){
 return client.rpc("search_classified_listings",{p_listing_type:filters.listingType??null,p_purpose:filters.purpose??null,p_category_id:filters.categoryId??null,p_min_price:filters.minPrice??null,p_max_price:filters.maxPrice??null,p_query:filters.query?.trim()||"",p_attributes:filters.attributes??{},p_limit:Math.max(1,Math.min(filters.limit??30,100))});
}
export async function saveClassifiedSearch(client:SupabaseClient,name:string,filters:ClassifiedSearchFilters){
 return client.rpc("create_classified_saved_search",{p_name:name.trim(),p_filters:filters});
}
