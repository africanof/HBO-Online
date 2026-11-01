-- Alertas de pesquisas guardadas: passam a respeitar o modo de venda (saleMode: fixed, negotiable,
-- offers, auction, trade) e a comparar o texto sem acentos, tal como a pesquisa em «Explorar».
-- Corrige também a precedência de «@>» com «->» (faltavam parênteses nos atributos).
create or replace function public.classified_saved_search_matches_listing(p_filters jsonb, p_listing public.classified_listings)
returns boolean language plpgsql stable set search_path = public as $$
declare
 f jsonb:=case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end;
 category_filter uuid; min_price numeric; max_price numeric; filter_territory uuid; filter_kind text;
 listing_territory uuid; listing_neighborhood uuid; listing_municipality uuid; listing_province uuid; listing_country_code text;
 listing_matches boolean:=true; mode text := nullif(trim(coalesce(f->>'saleMode','')),'');
begin
 begin
  if nullif(trim(f->>'categoryId'),'') is not null then category_filter:=(f->>'categoryId')::uuid; end if;
  if nullif(trim(f->>'minPrice'),'') is not null then min_price:=(f->>'minPrice')::numeric; end if;
  if nullif(trim(f->>'maxPrice'),'') is not null then max_price:=(f->>'maxPrice')::numeric; end if;
 exception when invalid_text_representation then return false; end;
 select a.street_id,n.id,m.id,p.id,p.country_code into listing_territory,listing_neighborhood,listing_municipality,listing_province,listing_country_code
 from public.addresses a left join public.streets s on s.id=a.street_id left join public.neighborhoods n on n.id=s.neighborhood_id left join public.municipalities m on m.id=n.municipality_id left join public.provinces p on p.id=m.province_id where a.id=p_listing.address_id;
 if p_listing.address_id is not null and not public.listing_territory_active(p_listing) then return false; end if;
 begin
  listing_municipality:=coalesce(listing_municipality,nullif(p_listing.attributes->>'municipalityId','')::uuid);
  listing_province:=coalesce(listing_province,nullif(p_listing.attributes->>'provinceId','')::uuid);
 exception when invalid_text_representation then null; end;
 if listing_province is null and listing_municipality is not null then select m.province_id into listing_province from public.municipalities m where m.id=listing_municipality; end if;
 if listing_country_code is null and listing_province is not null then select p.country_code into listing_country_code from public.provinces p where p.id=listing_province; end if;
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
  listing_matches:=case filter_kind when 'street' then listing_territory=filter_territory when 'neighborhood' then listing_neighborhood=filter_territory when 'municipality' then listing_municipality=filter_territory when 'province' then listing_province=filter_territory else false end;
  if not coalesce(listing_matches,false) then return false; end if;
 elsif nullif(trim(f->>'countryCode'),'') is not null then
  if not exists(select 1 from public.provinces p where p.country_code=f->>'countryCode' and p.active) then return false; end if;
  if listing_country_code is distinct from f->>'countryCode' then return false; end if;
 end if;
 return (category_filter is null or p_listing.category_id=category_filter)
 and (min_price is null or (p_listing.price is not null and p_listing.price>=min_price))
 and (max_price is null or (p_listing.price is not null and p_listing.price<=max_price))
 and (coalesce(trim(f->>'listingType'),'')='' or p_listing.listing_type=f->>'listingType')
 and (coalesce(trim(f->>'purpose'),'')='' or p_listing.purpose=f->>'purpose')
 and (coalesce(trim(f->>'query'),'')='' or public.fold_text(concat_ws(' ', p_listing.title, p_listing.description, p_listing.trade_wants)) like '%'||public.fold_text(trim(f->>'query'))||'%')
 and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> (f->'attributes'))
 and (mode is null or p_listing.purpose <> 'wanted' and case mode
       when 'trade' then p_listing.sale_mode = 'trade' or p_listing.accepts_trade
       when 'auction' then p_listing.purpose = 'auction' or p_listing.sale_mode = 'auction'
       when 'negotiable' then p_listing.purpose <> 'auction' and coalesce(p_listing.sale_mode, 'negotiable') = 'negotiable'
       else p_listing.purpose <> 'auction' and p_listing.sale_mode = mode end);
end;
$$;
