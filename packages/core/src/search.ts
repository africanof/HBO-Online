import type { SupabaseClient } from "@supabase/supabase-js";

export interface SearchFilters {
  query?: string;
  limit?: number;
  entityType?: "business"|"product"|"service";
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
}

export async function searchHuamboOnline(client:SupabaseClient,filters:SearchFilters={}){
  return client.rpc("search_huambo_online",{
    p_query:filters.query?.trim()||"",
    p_limit:Math.max(1,Math.min(filters.limit??30,100)),
    p_entity_type:filters.entityType??null,
    p_category_id:filters.categoryId??null,
    p_min_price:filters.minPrice??null,
    p_max_price:filters.maxPrice??null
  });
}