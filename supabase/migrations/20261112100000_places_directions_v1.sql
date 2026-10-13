-- Morada por ponto de referência (igual no Site e na APP).
-- Muitas ruas não têm nome nem número: cada anúncio, empresa e perfil profissional pode ter «Como chegar»
-- (ex.: «atrás da igreja católica, portão azul») e um ponto no mapa (GPS do telemóvel ou coordenadas coladas).
-- A morada de entrega de uma encomenda também pode ter um ponto no mapa, que só o comprador, o vendedor e o
-- estafeta da entrega veem.
-- Segurança: o ponto dos ANÚNCIOS (muitas vezes a casa de um particular) é guardado arredondado a ~100 m.
-- Só se aceitam pontos dentro de Angola.

alter table public.classified_listings
  add column if not exists directions text check (directions is null or char_length(directions) <= 300),
  add column if not exists geo_lat numeric,
  add column if not exists geo_lng numeric;
alter table public.classified_listings add constraint classified_listings_geo_check
  check ((geo_lat is null and geo_lng is null) or (geo_lat is not null and geo_lng is not null and geo_lat between -18.1 and -4.3 and geo_lng between 11.6 and 24.2));

alter table public.businesses
  add column if not exists directions text check (directions is null or char_length(directions) <= 300),
  add column if not exists geo_lat numeric,
  add column if not exists geo_lng numeric;
alter table public.businesses add constraint businesses_geo_check
  check ((geo_lat is null and geo_lng is null) or (geo_lat is not null and geo_lng is not null and geo_lat between -18.1 and -4.3 and geo_lng between 11.6 and 24.2));

alter table public.provider_profiles
  add column if not exists directions text check (directions is null or char_length(directions) <= 300),
  add column if not exists geo_lat numeric,
  add column if not exists geo_lng numeric;
alter table public.provider_profiles add constraint provider_profiles_geo_check
  check ((geo_lat is null and geo_lng is null) or (geo_lat is not null and geo_lng is not null and geo_lat between -18.1 and -4.3 and geo_lng between 11.6 and 24.2));

alter table public.orders
  add column if not exists delivery_lat numeric,
  add column if not exists delivery_lng numeric;
alter table public.orders add constraint orders_delivery_geo_check
  check ((delivery_lat is null and delivery_lng is null) or (delivery_lat is not null and delivery_lng is not null and delivery_lat between -18.1 and -4.3 and delivery_lng between 11.6 and 24.2));

-- Anúncios: ponto aproximado (3 casas decimais ≈ 100 m) para não mostrar a casa exata de ninguém.
create or replace function public.round_listing_geo() returns trigger
language plpgsql set search_path = public as $$
begin
  new.geo_lat := round(new.geo_lat, 3);
  new.geo_lng := round(new.geo_lng, 3);
  return new;
end $$;
create trigger round_listing_geo before insert or update of geo_lat, geo_lng on public.classified_listings
  for each row execute function public.round_listing_geo();

-- Encomenda: o comprador marca o ponto de entrega (ou tira, com nulos) enquanto a encomenda não foi entregue.
create or replace function public.set_order_delivery_point(p_order_id uuid, p_lat numeric, p_lng numeric)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('completed', 'cancelled') or o.fulfillment_status = 'delivered' then raise exception 'ORDER_CLOSED'; end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and not (p_lat between -18.1 and -4.3 and p_lng between 11.6 and 24.2)) then
    raise exception 'INVALID_LOCATION';
  end if;
  update public.orders set delivery_lat = round(p_lat, 6), delivery_lng = round(p_lng, 6), updated_at = now() where id = o.id;
end $$;

-- Ponto de entrega para o comprador, o vendedor ou o estafeta que ficou com a entrega.
create or replace function public.order_delivery_point(p_order_id uuid)
returns table (lat numeric, lng numeric, delivery_text text)
language sql stable security definer set search_path = public as $$
  select o.delivery_lat, o.delivery_lng, o.delivery_text from public.orders o
  where o.id = p_order_id and auth.uid() is not null and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()
    or exists (select 1 from public.delivery_requests d where d.order_id = o.id and d.assigned_to = auth.uid() and d.status <> 'cancelled'))
$$;

revoke all on function public.round_listing_geo() from public, anon, authenticated;
revoke all on function public.set_order_delivery_point(uuid, numeric, numeric) from public, anon;
revoke all on function public.order_delivery_point(uuid) from public, anon;
grant execute on function public.set_order_delivery_point(uuid, numeric, numeric) to authenticated;
grant execute on function public.order_delivery_point(uuid) to authenticated;
