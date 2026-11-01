-- Pesquisa de anúncios com filtro do modo de venda (preço fixo, negociável, propostas, leilão, troca)
-- e texto sem acentos. A versão antiga continua a existir.
create or replace function public.search_classified_listings_v2(
  p_listing_type text default null, p_purpose text default null, p_category_id uuid default null,
  p_min_price numeric default null, p_max_price numeric default null, p_query text default '',
  p_attributes jsonb default '{}'::jsonb, p_limit integer default 30, p_sale_mode text default null)
returns setof public.classified_listings
language sql stable set search_path = public as $$
  select * from public.classified_listings l
  where l.status = 'published'
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_purpose is null or l.purpose = p_purpose)
    and (p_category_id is null or l.category_id = p_category_id)
    and (p_min_price is null or l.price >= p_min_price)
    and (p_max_price is null or l.price <= p_max_price)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', l.title, l.description, l.trade_wants)) like '%' || public.fold_text(trim(p_query)) || '%')
    and (coalesce(p_attributes, '{}'::jsonb) = '{}'::jsonb or l.attributes @> p_attributes)
    and (p_sale_mode is null or l.purpose <> 'wanted' and case p_sale_mode
          when 'trade' then l.sale_mode = 'trade' or l.accepts_trade
          when 'auction' then l.purpose = 'auction' or l.sale_mode = 'auction'
          when 'negotiable' then l.purpose <> 'auction' and coalesce(l.sale_mode, 'negotiable') = 'negotiable'
          else l.purpose <> 'auction' and l.sale_mode = p_sale_mode end)
  order by l.featured desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
grant execute on function public.search_classified_listings_v2(text, text, uuid, numeric, numeric, text, jsonb, integer, text) to anon, authenticated;
