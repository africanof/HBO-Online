-- Validate the listing's own territorial ancestry before saved-search matching.
create or replace function public.listing_territory_active(p_listing public.classified_listings)
returns boolean language plpgsql stable security invoker set search_path=public
as $$
begin
  -- Prefer the most specific territory stored on the listing.
  if p_listing.street_id is not null then
    return public.saved_search_territory_active(p_listing.street_id,'street');
  elsif p_listing.neighborhood_id is not null then
    return public.saved_search_territory_active(p_listing.neighborhood_id,'neighborhood');
  elsif p_listing.municipality_id is not null then
    return public.saved_search_territory_active(p_listing.municipality_id,'municipality');
  elsif p_listing.province_id is not null then
    return public.saved_search_territory_active(p_listing.province_id,'province');
  elsif p_listing.country_id is not null then
    return public.saved_search_territory_active(p_listing.country_id,'country');
  end if;
  return true;
end;
$$;

create or replace function public.classified_saved_search_matches_listing(
  p_filters jsonb, p_listing public.classified_listings
) returns boolean
language plpgsql stable security invoker set search_path=public
as $$
declare f jsonb := case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end;
begin
  if not public.listing_territory_active(p_listing) then return false; end if;
  return
    (coalesce(f->>'listingType','')='' or p_listing.listing_type=f->>'listingType')
    and (coalesce(f->>'purpose','')='' or p_listing.purpose=f->>'purpose')
    and (coalesce(f->>'query','')='' or lower(p_listing.title) like '%'||lower(trim(f->>'query'))||'%' or lower(coalesce(p_listing.description,'')) like '%'||lower(trim(f->>'query'))||'%')
    and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> f->'attributes');
end;
$$;