-- Huambo Online — favoritos de tudo (anúncios, profissionais, empresas, produtos) numa só lista
create or replace function public.my_saved_items()
returns table(id uuid, kind text, target_id uuid, title text, subtitle text, image text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id,
    case when s.classified_listing_id is not null then 'listing' when s.provider_id is not null then 'provider'
         when s.business_id is not null then 'business' when s.product_id is not null then 'product' else 'other' end,
    coalesce(s.classified_listing_id, s.provider_id, s.business_id, s.product_id, s.service_id, s.auction_id),
    coalesce(l.title, pp.display_name, b.name, p.name, 'Item'),
    coalesce(case when l.id is not null then coalesce(l.price::text || ' Kz', 'Preço sob consulta') end,
             pp.headline, left(b.description, 100), case when p.id is not null then p.price::text || ' Kz' end, ''),
    coalesce(l.media->>0, p.media->>0, pp.avatar_url, b.logo_url),
    s.created_at
  from public.saved_items s
  left join public.classified_listings l on l.id = s.classified_listing_id and (l.status = 'published' or l.owner_id = auth.uid())
  left join public.provider_profiles pp on pp.user_id = s.provider_id and pp.active
  left join public.businesses b on b.id = s.business_id and b.active
  left join public.products p on p.id = s.product_id and p.active
  where s.user_id = auth.uid()
  order by s.created_at desc;
$$;
revoke all on function public.my_saved_items() from public, anon;
grant execute on function public.my_saved_items() to authenticated;
