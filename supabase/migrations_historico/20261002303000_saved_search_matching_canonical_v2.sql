-- Canonical saved-search matcher: preserves filters while enforcing both
-- search-territory and listing-territory validity.
create or replace function public.classified_saved_search_matches_listing(
  p_filters jsonb, p_listing public.classified_listings
) returns boolean
language plpgsql stable security invoker set search_path=public
as $$
declare
  f jsonb := case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end;
  category_filter uuid;
  min_price numeric;
  max_price numeric;
  filter_territory uuid;
  filter_kind text;
  listing_matches boolean := true;
begin
  begin
    if nullif(trim(f->>'categoryId'),'') is not null then category_filter:=(f->>'categoryId')::uuid; end if;
    if nullif(trim(f->>'minPrice'),'') is not null then min_price:=(f->>'minPrice')::numeric; end if;
    if nullif(trim(f->>'maxPrice'),'') is not null then max_price:=(f->>'maxPrice')::numeric;
    end if;
  exception when invalid_text_representation then return false; end;

  if nullif(trim(f->>'streetId'),'') is not null then
    begin filter_territory:=(f->>'streetId')::uuid; filter_kind:='street'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'neighborhoodId'),'') is not null then
    begin filter_territory:=(f->>'neighborhoodId')::uuid; filter_kind:='neighborhood'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'municipalityId'),'') is not null then
    begin filter_territory:=(f->>'municipalityId')::uuid; filter_kind:='municipality'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'provinceId'),'') is not null then
    begin filter_territory:=(f->>'provinceId')::uuid; filter_kind:='province'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'countryId'),'') is not null then
    begin filter_territory:=(f->>'countryId')::uuid; filter_kind:='country'; exception when invalid_text_representation then return false; end;
  end if;

  if not public.listing_territory_active(p_listing) then return false; end if;
  if filter_territory is not null then
    if not public.saved_search_territory_active(filter_territory,filter_kind) then return false; end if;
    -- The listing must be inside the selected territory. For a broad selection,
    -- compare the corresponding listing level; for a street selection, exact street.
    listing_matches := case filter_kind
      when 'street' then p_listing.street_id=filter_territory
      when 'neighborhood' then p_listing.neighborhood_id=filter_territory
      when 'municipality' then p_listing.municipality_id=filter_territory
      when 'province' then p_listing.province_id=filter_territory
      when 'country' then p_listing.country_id=filter_territory
      else true
    end;
    if not coalesce(listing_matches,false) then return false; end if;
  end if;

  return
    (category_filter is null or p_listing.category_id=category_filter)
    and (min_price is null or (p_listing.price is not null and p_listing.price>=min_price))
    and (max_price is null or (p_listing.price is not null and p_listing.price<=max_price))
    and (coalesce(trim(f->>'listingType'),'')='' or p_listing.listing_type=f->>'listingType')
    and (coalesce(trim(f->>'purpose'),'')='' or p_listing.purpose=f->>'purpose')
    and (coalesce(trim(f->>'query'),'')='' or lower(p_listing.title) like '%'||lower(trim(f->>'query'))||'%' or lower(coalesce(p_listing.description,'')) like '%'||lower(trim(f->>'query'))||'%')
    and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> f->'attributes');
end;
$$;

revoke execute on function public.classified_saved_search_matches_listing(jsonb,public.classified_listings) from anon,authenticated;