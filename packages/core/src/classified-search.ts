import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";

export type ClassifiedSearchFilters = {
  listingType?: ClassifiedListingType; purpose?: ClassifiedPurpose; categoryId?: string;
  minPrice?: number; maxPrice?: number; query?: string; attributes?: Record<string, unknown>; limit?: number;
  provinceId?: string; municipalityId?: string;
};

/**
 * O território do anúncio está em attributes (provinceId/municipalityId),
 * por isso o filtro territorial vai dentro de attributes — igual para pesquisa e alertas.
 */
export function normalizeSearchFilters(filters: ClassifiedSearchFilters): ClassifiedSearchFilters {
  const attributes: Record<string, unknown> = { ...(filters.attributes ?? {}) };
  if (filters.municipalityId) attributes.municipalityId = filters.municipalityId;
  else if (filters.provinceId) attributes.provinceId = filters.provinceId;
  const out: ClassifiedSearchFilters = {};
  if (filters.query?.trim()) out.query = filters.query.trim();
  if (filters.listingType) out.listingType = filters.listingType;
  if (filters.purpose) out.purpose = filters.purpose;
  if (filters.categoryId) out.categoryId = filters.categoryId;
  if (filters.minPrice !== undefined && Number.isFinite(filters.minPrice)) out.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined && Number.isFinite(filters.maxPrice)) out.maxPrice = filters.maxPrice;
  if (Object.keys(attributes).length) out.attributes = attributes;
  if (filters.limit) out.limit = filters.limit;
  return out;
}

export async function searchClassifiedListings(client: SupabaseClient, filters: ClassifiedSearchFilters = {}) {
  const f = normalizeSearchFilters(filters);
  return client.rpc("search_classified_listings", {
    p_listing_type: f.listingType ?? null, p_purpose: f.purpose ?? null, p_category_id: f.categoryId ?? null,
    p_min_price: f.minPrice ?? null, p_max_price: f.maxPrice ?? null, p_query: f.query ?? "",
    p_attributes: f.attributes ?? {}, p_limit: Math.max(1, Math.min(f.limit ?? 30, 100))
  });
}

export async function saveClassifiedSearch(client: SupabaseClient, name: string, filters: ClassifiedSearchFilters) {
  const f = normalizeSearchFilters(filters);
  delete f.limit;
  return client.rpc("create_classified_saved_search", { p_name: name.trim(), p_filters: f });
}
