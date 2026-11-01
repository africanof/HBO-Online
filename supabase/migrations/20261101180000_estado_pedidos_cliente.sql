-- O cliente vê os seus pedidos que ainda esperam pela equipa (ou que a equipa recusou, com o motivo).
create or replace function public.my_team_request_states()
 returns table(kind text, id uuid, ref_no bigint, created_at timestamptz, title text, amount numeric, state text, team_note text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with r as (
    select 'orders'::text k, o.id, o.ref_no, o.created_at, 'Encomenda da Loja'::text title, o.total amount, o.team_forwarded_at fa, o.team_declined_at da, o.team_note tn
      from public.orders o where o.buyer_id = auth.uid()
    union all select 'venue_orders', o.id, o.ref_no, o.created_at, 'Reserva: ' || coalesce(b.name, 'estabelecimento'), o.total, o.team_forwarded_at, o.team_declined_at, o.team_note
      from public.venue_orders o join public.venues v on v.id = o.venue_id left join public.businesses b on b.id = v.business_id where o.buyer_id = auth.uid()
    union all select 'fuel_orders', o.id, o.ref_no, o.created_at, 'Posto: ' || s.name, o.total, o.team_forwarded_at, o.team_declined_at, o.team_note
      from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id where o.buyer_id = auth.uid()
    union all select 'event_orders', o.id, o.ref_no, o.created_at, 'Bilhetes: ' || e.title, o.total, o.team_forwarded_at, o.team_declined_at, o.team_note
      from public.event_orders o join public.events e on e.id = o.event_id where o.buyer_id = auth.uid()
    union all select 'service_requests', s.id, null::bigint, s.created_at, 'Pedido de serviço: ' || coalesce(pp.display_name, b.name, ''), null::numeric, s.team_forwarded_at, s.team_declined_at, s.team_note
      from public.service_requests s left join public.provider_profiles pp on pp.user_id = s.provider_id left join public.businesses b on b.id = s.business_id where s.client_id = auth.uid()
    union all select 'listing_offers', o.id, null::bigint, o.created_at, 'Proposta: ' || l.title, o.amount, o.team_forwarded_at, o.team_declined_at, o.team_note
      from public.listing_offers o join public.classified_listings l on l.id = o.listing_id where o.buyer_id = auth.uid()
    union all select 'rental_requests', q.id, null::bigint, q.created_at, 'Aluguer: ' || l.title, q.proposed_price, q.team_forwarded_at, q.team_declined_at, q.team_note
      from public.rental_requests q join public.classified_listings l on l.id = q.listing_id where q.renter_id = auth.uid()
  )
  select r.k, r.id, r.ref_no, r.created_at, r.title, r.amount,
         case when r.da is not null then 'declined' else 'pending' end,
         case when r.da is not null then r.tn end
  from r
  where auth.uid() is not null and r.fa is null and (r.da is null or r.da > now() - interval '30 days')
  order by r.created_at desc
  limit 50;
$function$;
revoke all on function public.my_team_request_states() from public, anon;
grant execute on function public.my_team_request_states() to authenticated;
