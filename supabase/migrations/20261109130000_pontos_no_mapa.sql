-- A equipa vê todos os preços de entrega (também os desligados); os pontos de recolha aparecem no mapa.
drop policy if exists delivery_fees_read on public.delivery_fees;
create policy delivery_fees_read on public.delivery_fees for select to anon, authenticated using (active or public.has_admin_role());

create or replace function public.map_points(p_kind text default null)
returns table(kind text, id uuid, title text, subtitle text, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  (select 'listing', l.id, l.title, public.money_label(l.price, l.currency), round(l.geo_lat::numeric, 3)::float8, round(l.geo_lng::numeric, 3)::float8
     from public.classified_listings l where l.status = 'published' and l.geo_lat is not null and l.geo_lng is not null and (p_kind is null or p_kind = 'listing') order by l.created_at desc limit 400)
  union all
  (select 'business', b.id, b.name, null, b.geo_lat::float8, b.geo_lng::float8
     from public.businesses b where b.active and b.geo_lat is not null and b.geo_lng is not null and (p_kind is null or p_kind = 'business') limit 400)
  union all
  (select 'provider', p.user_id, p.display_name, null, p.geo_lat::float8, p.geo_lng::float8
     from public.provider_profiles p where p.active and p.geo_lat is not null and p.geo_lng is not null and (p_kind is null or p_kind = 'provider') limit 400)
  union all
  (select 'fuel', f.id, f.name, null, f.geo_lat::float8, f.geo_lng::float8
     from public.fuel_stations f where f.status = 'approved' and f.geo_lat is not null and f.geo_lng is not null and (p_kind is null or p_kind = 'fuel') limit 200)
  union all
  (select 'event', e.id, e.title, to_char(e.starts_at at time zone 'Africa/Luanda', 'DD/MM HH24:MI'), e.geo_lat::float8, e.geo_lng::float8
     from public.events e where e.status = 'published' and coalesce(e.ends_at, e.starts_at) > now() and e.geo_lat is not null and e.geo_lng is not null and (p_kind is null or p_kind = 'event') limit 200)
  union all
  (select 'pickup', pp.id, pp.name, concat_ws(' · ', pp.address, pp.hours), pp.geo_lat::float8, pp.geo_lng::float8
     from public.pickup_points pp where pp.active and pp.geo_lat is not null and pp.geo_lng is not null and (p_kind is null or p_kind = 'pickup') limit 200)
$$;
