-- Integrate active territorial ancestry into saved-search matching.
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
  raw_category text;
  raw_min text;
  raw_max text;
  territory_id uuid;
  territory_kind text;
begin
  raw_category:=nullif(trim(f->>'categoryId'),'');
  raw_min:=nullif(trim(f->>'minPrice'),'');
  raw_max:=nullif(trim(f->>'maxPrice'),'');
  if raw_category is not null then
    begin category_filter:=raw_category::uuid; exception when invalid_text_representation then return false; end;
  end if;
  if raw_min is not null then
    begin min_price:=raw_min::numeric; exception when invalid_text_representation then return false; end;
  end if;
  if raw_max is not null then
    begin max_price:=raw_max::numeric; exception when invalid_text_representation then return false; end;
  end if;

  -- Territory filters are accepted in most-specific-to-broad order.
  raw_category:=nullif(trim(f->>'streetId'),'');
  if raw_category is not null then
    begin territory_id:=raw_category::uuid; territory_kind:='street'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'neighborhoodId'),'') is not null then
    begin territory_id:=(f->>'neighborhoodId')::uuid; territory_kind:='neighborhood'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'municipalityId'),'') is not null then
    begin territory_id:=(f->>'municipalityId')::uuid; territory_kind:='municipality'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'provinceId'),'') is not null then
    begin territory_id:=(f->>'provinceId')::uuid; territory_kind:='province'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'countryId'),'') is not null then
    begin territory_id:=(f->>'countryId')::uuid; territory_kind:='country'; exception when invalid_text_representation then return false; end;
  end if;

  if territory_id is not null and not public.saved_search_territory_active(territory_id,territory_kind) then
    return false;
  end if;

  return
    (coalesce(f->>'listingType','')='' or p_listing.listing_type=f->>'listingType')
    and (coalesce(f->>'purpose','')='' or p_listing.purpose=f->>'purpose')
    and (category_filter is null or p_listing.category_id=category_filter)
    and (min_price is null or (p_listing.price is not null and p_listing.price>=min_price))
    and (max_price is null or (p_listing.price is not null and p_listing.price<=max_price))
    and (coalesce(trim(f->>'query'),'')='' or lower(p_listing.title) like '%'||lower(trim(f->>'query'))||'%' or lower(coalesce(p_listing.description,'')) like '%'||lower(trim(f->>'query'))||'%')
    and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> f->'attributes');
end;
$$;

revoke execute on function public.classified_saved_search_matches_listing(jsonb,public.classified_listings) from anon,authenticated;