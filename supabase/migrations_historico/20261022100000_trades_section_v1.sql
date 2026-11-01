-- Secção «Trocas»: anúncios só para troca e anúncios que também aceitam troca (pesquisa sem acentos).
create or replace function public.search_trades(p_query text default '', p_only_trade boolean default false, p_limit integer default 40)
returns setof public.classified_listings
language sql stable set search_path = public as $$
  select l.* from public.classified_listings l
  where l.status = 'published' and l.purpose <> 'wanted'
    and (l.sale_mode = 'trade' or (not coalesce(p_only_trade, false) and l.accepts_trade))
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', l.title, l.description, l.trade_wants)) like '%' || public.fold_text(trim(p_query)) || '%')
  order by l.featured desc, (l.sale_mode = 'trade') desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
grant execute on function public.search_trades(text, boolean, integer) to anon, authenticated;
