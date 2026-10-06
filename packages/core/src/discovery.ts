import type { DiscoveryEntityType, DiscoveryQuery } from "@huambo-online/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DISCOVERY_TYPES: readonly DiscoveryEntityType[] = ["business","provider","service","product"];

export function normalizeDiscoveryQuery(query: DiscoveryQuery): DiscoveryQuery {
  return {
    ...query,
    text: query.text?.trim() || undefined,
    radiusKm: query.radiusKm && query.radiusKm > 0 ? query.radiusKm : undefined
  };
}

function applyCommon<T extends { ilike(column: string, pattern: string): T; eq(column: string, value: unknown): T }>(request:T,q:DiscoveryQuery){
  if(q.text) request=request.ilike("name",`%${q.text}%`);
  if(q.categoryId) request=request.eq("category_id",q.categoryId);
  return request;
}

export async function searchBusinesses(client: SupabaseClient, q:DiscoveryQuery={}) {
  let request=client.from("businesses").select("id,name,description,category_id,address_id,verified").eq("active",true);
  request=applyCommon(request,normalizeDiscoveryQuery(q));
  if(q.verifiedOnly) request=request.eq("verified",true);
  return request.order("name");
}

export async function searchServices(client: SupabaseClient, q:DiscoveryQuery={}) {
  const query=normalizeDiscoveryQuery(q);
  let request=client.from("services").select("id,title,description,provider_id,category_id,price_from,currency,address_id").eq("active",true);
  if(query.text) request=request.ilike("title",`%${query.text}%`);
  if(query.categoryId) request=request.eq("category_id",query.categoryId);
  if(query.minPrice!==undefined) request=request.gte("price_from",query.minPrice);
  if(query.maxPrice!==undefined) request=request.lte("price_from",query.maxPrice);
  return request.order("title");
}

export async function searchProducts(client: SupabaseClient, q:DiscoveryQuery={}) {
  const query=normalizeDiscoveryQuery(q);
  let request=client.from("products").select("id,name,description,seller_id,category_id,price,currency,stock,address_id").eq("active",true).gt("stock",0);
  request=applyCommon(request,query);
  if(query.minPrice!==undefined) request=request.gte("price",query.minPrice);
  if(query.maxPrice!==undefined) request=request.lte("price",query.maxPrice);
  return request.order("name");
}