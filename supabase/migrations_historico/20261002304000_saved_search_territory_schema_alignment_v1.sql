-- Align territorial matching with the actual Huambo Online schema.
-- classified_listings stores address_id; address -> street -> neighborhood ->
-- municipality -> province is the canonical hierarchy. Country is represented
-- by provinces.country_code and provinces.active.
create or replace function public.saved_search_territory_active(p_territory_id uuid,p_kind text)
returns boolean
language plpgsql stable security invoker set search_path=public
as $$
declare ok boolean;
begin
  if p_territory_id is null then return true; end if;

  if p_kind='street' then
    select s.active and p.active into ok
    from public.streets s
    join public.neighborhoods n on n.id=s.neighborhood_id
    join public.municipalities m on m.id=n.municipality_id
    join public.provinces p on p.id=m.province_id
    where s.id=p_territory_id;
  elsif p_kind='neighborhood' then
    select p.active into ok
    from public.neighborhoods n
    join public.municipalities m on m.id=n.municipality_id
    join public.provinces p on p.id=m.province_id
    where n.id=p_territory_id;
  elsif p_kind='municipality' then
    select p.active into ok
    from public.municipalities m
    join public.provinces p on p.id=m.province_id
    where m.id=p_territory_id;
  elsif p_kind='province' then
    select p.active into ok from public.provinces p where p.id=p_territory_id;
  else
    return false;
  end if;

  return coalesce(ok,false);
end;
$$;

create or replace function public.listing_territory_active(p_listing public.classified_listings)
returns boolean
language plpgsql stable security invoker set search_path=public
as $$
declare ok boolean;
begin
  if p_listing.address_id is null then return true; end if;

  select a.active and s.active and p.active into ok
  from public.addresses a
  left join public.streets s on s.id=a.street_id
  left join public.neighborhoods n on n.id=s.neighborhood_id
  left join public.municipalities m on m.id=n.municipality_id
  left join public.provinces p on p.id=m.province_id
  where a.id=p_listing.address_id;

  return coalesce(ok,false);
end;
$$;

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
  listing_territory uuid;
  listing_neighborhood uuid;
  listing_municipality uuid;
  listing_province uuid;
  listing_country_code text;
  listing_matches boolean := true;
begin
  begin
    if nullif(trim(f->>'categoryId'),'') is not null then category_filter:=(f->>'categoryId')::uuid; end if;
    if nullif(trim(f->>'minPrice'),'') is not null then min_price:=(f->>'minPrice')::numeric; end if;
    if nullif(trim(f->>'maxPrice'),'') is not null then max_price:=(f->>'maxPrice')::numeric; end if;
  exception when invalid_text_representation then return false; end;

  select a.street_id,n.id,m.id,p.id,p.country_code
  into listing_territory,listing_neighborhood,listing_municipality,listing_province,listing_country_code
  from public.addresses a
  left join public.streets s on s.id=a.street_id
  left join public.neighborhoods n on n.id=s.neighborhood_id
  left join public.municipalities m on m.id=n.municipality_id
  left join public.provinces p on p.id=m.province_id
  where a.id=p_listing.address_id;

  if p_listing.address_id is not null and not public.listing_territory_active(p_listing) then return false; end if;

  if nullif(trim(f->>'streetId'),'') is not null then
    begin filter_territory:=(f->>'streetId')::uuid; filter_kind:='street'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'neighborhoodId'),'') is not null then
    begin filter_territory:=(f->>'neighborhoodId')::uuid; filter_kind:='neighborhood'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'municipalityId'),'') is not null then
    begin filter_territory:=(f->>'municipalityId')::uuid; filter_kind:='municipality'; exception when invalid_text_representation then return false; end;
  elsif nullif(trim(f->>'provinceId'),'') is not null then
    begin filter_territory:=(f->>'provinceId')::uuid; filter_kind:='province'; exception when invalid_text_representation then return false; end;
  end if;

  if filter_territory is not null then
    if not public.saved_search_territory_active(filter_territory,filter_kind) then return false; end if;
    listing_matches := case filter_kind
      when 'street' then listing_territory=filter_territory
      when 'neighborhood' then listing_neighborhood=filter_territory
      when 'municipality' then listing_municipality=filter_territory
      when 'province' then listing_province=filter_territory
      else false
    end;
    if not coalesce(listing_matches,false) then return false; end if;
  elsif nullif(trim(f->>'countryCode'),'') is not null then
    if not exists(select 1 from public.provinces p where p.country_code=f->>'countryCode' and p.active) then return false; end if;
    if listing_country_code is distinct from f->>'countryCode' then return false; end if;
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

revoke execute on function public.saved_search_territory_active(uuid,text) from anon,authenticated;
revoke execute on function public.listing_territory_active(public.classified_listings) from anon,authenticated;
revoke execute on function public.classified_saved_search_matches_listing(jsonb,public.classified_listings) from anon,authenticated;