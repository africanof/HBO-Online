-- WhatsApp da equipa: no Site e na APP, o botão «💬 WhatsApp» abre sempre a conversa com a
-- administração (nunca com o vendedor), com uma mensagem já escrita e a ligação direta para o
-- anúncio, produto ou pedido. O número é público (é o contacto oficial) e só a equipa o muda.

alter table public.platform_settings add column if not exists team_whatsapp text
  check (team_whatsapp is null or team_whatsapp ~ '^[0-9]{9,15}$');

/** A equipa define o número de WhatsApp oficial (ex.: 923 000 000 → 244923000000); vazio apaga. */
create or replace function public.admin_set_team_whatsapp(p_number text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n text;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if nullif(trim(coalesce(p_number, '')), '') is null then n := null;
  else n := public.normalize_whatsapp(p_number); if n is null then raise exception 'INVALID_WHATSAPP'; end if; end if;
  update public.platform_settings set team_whatsapp = n, updated_at = now() where id = 1;
  return n;
end $function$;
revoke all on function public.admin_set_team_whatsapp(text) from public, anon;
grant execute on function public.admin_set_team_whatsapp(text) to authenticated;

-- Os pedidos do cliente passam a trazer a ligação para a página do anúncio, posto, evento… (link).
drop function if exists public.my_team_request_states();
create or replace function public.my_team_request_states()
 returns table(kind text, id uuid, ref_no bigint, created_at timestamptz, title text, amount numeric, state text, team_note text, link text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with r as (
    select 'orders'::text k, o.id, o.ref_no, o.created_at, 'Encomenda da Loja'::text title, o.total amount, o.team_forwarded_at fa, o.team_declined_at da, o.team_note tn, '/encomendas'::text lk
      from public.orders o where o.buyer_id = auth.uid()
    union all select 'venue_orders', o.id, o.ref_no, o.created_at, 'Reserva: ' || coalesce(b.name, 'estabelecimento'), o.total, o.team_forwarded_at, o.team_declined_at, o.team_note, '/reservas/' || v.id
      from public.venue_orders o join public.venues v on v.id = o.venue_id left join public.businesses b on b.id = v.business_id where o.buyer_id = auth.uid()
    union all select 'fuel_orders', o.id, o.ref_no, o.created_at, 'Posto: ' || s.name, o.total, o.team_forwarded_at, o.team_declined_at, o.team_note, '/combustivel/' || s.id
      from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id where o.buyer_id = auth.uid()
    union all select 'event_orders', o.id, o.ref_no, o.created_at, 'Bilhetes: ' || e.title, o.total, o.team_forwarded_at, o.team_declined_at, o.team_note, '/eventos/' || e.id
      from public.event_orders o join public.events e on e.id = o.event_id where o.buyer_id = auth.uid()
    union all select 'service_requests', s.id, null::bigint, s.created_at, 'Pedido de serviço: ' || coalesce(pp.display_name, b.name, ''), null::numeric, s.team_forwarded_at, s.team_declined_at, s.team_note,
      case when s.business_id is not null then '/empresas/' || s.business_id else '/profissionais/' || s.provider_id end
      from public.service_requests s left join public.provider_profiles pp on pp.user_id = s.provider_id left join public.businesses b on b.id = s.business_id where s.client_id = auth.uid()
    union all select 'listing_offers', o.id, null::bigint, o.created_at, 'Proposta: ' || l.title, o.amount, o.team_forwarded_at, o.team_declined_at, o.team_note, '/classificados/' || l.id
      from public.listing_offers o join public.classified_listings l on l.id = o.listing_id where o.buyer_id = auth.uid()
    union all select 'rental_requests', q.id, null::bigint, q.created_at, 'Aluguer: ' || l.title, q.proposed_price, q.team_forwarded_at, q.team_declined_at, q.team_note, '/classificados/' || l.id
      from public.rental_requests q join public.classified_listings l on l.id = q.listing_id where q.renter_id = auth.uid()
  )
  select r.k, r.id, r.ref_no, r.created_at, r.title, r.amount,
         case when r.da is not null then 'declined' when r.fa is not null then 'approved' else 'pending' end,
         case when r.da is not null then r.tn end,
         r.lk
  from r
  where auth.uid() is not null
    and ((r.fa is null and r.da is null) or r.da > now() - interval '30 days' or r.fa > now() - interval '30 days')
  order by (r.fa is null and r.da is null) desc, r.created_at desc
  limit 50;
$function$;
revoke all on function public.my_team_request_states() from public, anon;
grant execute on function public.my_team_request_states() to authenticated;
