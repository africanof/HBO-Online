-- Huambo Online — arrendamentos e leilões seguros, com notificações e fecho automático

-- 1. Escritas diretas bloqueadas: tudo passa pelas funções do servidor (que validam)
create or replace function public.guard_server_only_write()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  raise exception 'USE_SERVER_FUNCTIONS';
end $$;
grant execute on function public.guard_server_only_write() to authenticated;
create trigger trg_guard_rental_write before insert or update on public.rental_requests
  for each row execute function public.guard_server_only_write();
create trigger trg_guard_auction_write before insert or update on public.auctions
  for each row execute function public.guard_server_only_write();
create trigger trg_guard_bid_write before insert or update on public.auction_bids
  for each row execute function public.guard_server_only_write();

-- 2. Arrendamentos
create or replace function public.request_classified_rental(p_listing_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_price numeric, p_message text default null)
returns public.rental_requests language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; r public.rental_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id and status = 'published' and purpose in ('rent','lease');
  if not found then raise exception 'LISTING_NOT_RENTABLE'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_RENT_OWN_LISTING'; end if;
  if p_ends_at <= p_starts_at or p_price < 0 or p_starts_at < now() - interval '1 day' then raise exception 'INVALID_RENTAL_REQUEST'; end if;
  if exists (select 1 from public.rental_requests x where x.listing_id = p_listing_id and x.status = 'accepted'
             and x.starts_at < p_ends_at and x.ends_at > p_starts_at) then raise exception 'RENTAL_WINDOW_UNAVAILABLE'; end if;
  insert into public.rental_requests(listing_id, renter_id, starts_at, ends_at, proposed_price, message)
  values (p_listing_id, auth.uid(), p_starts_at, p_ends_at, p_price, nullif(trim(p_message), '')) returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Novo pedido de aluguer', 'Recebeu um pedido para «' || l.title || '».', jsonb_build_object('rental_id', r.id, 'listing_id', l.id));
  return r;
end $$;

create or replace function public.respond_rental_request(p_request_id uuid, p_accept boolean)
returns public.rental_requests language plpgsql security definer set search_path = public as $$
declare r public.rental_requests; l public.classified_listings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = r.listing_id;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if r.status <> 'pending' then raise exception 'RENTAL_ALREADY_ANSWERED'; end if;
  if p_accept and exists (select 1 from public.rental_requests x where x.listing_id = r.listing_id and x.status = 'accepted'
                          and x.id <> r.id and x.starts_at < r.ends_at and x.ends_at > r.starts_at) then raise exception 'RENTAL_WINDOW_UNAVAILABLE'; end if;
  update public.rental_requests set status = case when p_accept then 'accepted' else 'rejected' end, updated_at = now()
   where id = r.id returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.renter_id, 'system', case when p_accept then 'Aluguer aceite' else 'Aluguer recusado' end,
          'O seu pedido para «' || l.title || '» foi ' || case when p_accept then 'aceite.' else 'recusado.' end,
          jsonb_build_object('rental_id', r.id, 'listing_id', l.id));
  return r;
end $$;

create or replace function public.cancel_rental_request(p_request_id uuid)
returns public.rental_requests language plpgsql security definer set search_path = public as $$
declare r public.rental_requests;
begin
  select * into r from public.rental_requests where id = p_request_id for update;
  if not found or r.renter_id <> auth.uid() then raise exception 'RENTAL_NOT_FOUND'; end if;
  if r.status not in ('pending','accepted') then raise exception 'RENTAL_ALREADY_ANSWERED'; end if;
  update public.rental_requests set status = 'cancelled', updated_at = now() where id = r.id returning * into r;
  return r;
end $$;

create or replace function public.my_rental_requests(p_role text default 'renter')
returns table(id uuid, listing_id uuid, listing_title text, status text, starts_at timestamptz, ends_at timestamptz,
  proposed_price numeric, message text, other_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.listing_id, l.title, r.status, r.starts_at, r.ends_at, r.proposed_price, r.message,
         coalesce(nullif(p.full_name, ''), 'Utilizador'), r.created_at
  from public.rental_requests r
  join public.classified_listings l on l.id = r.listing_id
  left join public.profiles p on p.id = case when p_role = 'owner' then r.renter_id else l.owner_id end
  where (p_role = 'owner' and l.owner_id = auth.uid()) or (p_role <> 'owner' and r.renter_id = auth.uid())
  order by r.created_at desc limit 200;
$$;

-- 3. Leilões
create or replace function public.place_auction_bid(p_auction_id uuid, p_amount numeric)
returns public.auction_bids language plpgsql security definer set search_path = public as $$
declare a public.auctions; b public.auction_bids; prev uuid; min_bid numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  select bidder_id into prev from public.auction_bids where auction_id = a.id order by amount desc, created_at asc limit 1;
  min_bid := case when prev is null then a.starting_price else a.current_price + greatest(a.min_increment, 1) end;
  if p_amount < min_bid then raise exception 'BID_TOO_LOW'; end if;
  insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), p_amount) returning * into b;
  update public.auctions set current_price = p_amount, updated_at = now() where id = a.id;
  if prev is not null and prev <> auth.uid() then
    insert into public.notifications(user_id, type, title, body, data)
    values (prev, 'bid', 'A sua licitação foi ultrapassada', 'Nova licitação de ' || p_amount || ' Kz em «' || a.title || '».',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'bid', 'Nova licitação', p_amount || ' Kz em «' || a.title || '».', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return b;
end $$;

create or replace function public.close_auction(p_auction_id uuid)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; b public.auction_bids;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status not in ('live','scheduled') then return a; end if;
  if now() < a.ends_at then
    if auth.uid() is distinct from a.seller_id and not public.has_admin_role() then raise exception 'AUCTION_NOT_ENDED'; end if;
    -- o vendedor pode cancelar antes do fim só se ainda não houver licitações
    if exists (select 1 from public.auction_bids where auction_id = a.id) then raise exception 'AUCTION_HAS_BIDS'; end if;
    update public.auctions set status = 'cancelled', updated_at = now() where id = a.id returning * into a;
    return a;
  end if;
  select * into b from public.auction_bids where auction_id = a.id order by amount desc, created_at asc limit 1;
  update public.auctions set status = 'ended',
    winner_id = case when b.id is not null and (reserve_price is null or b.amount >= reserve_price) then b.bidder_id end,
    current_price = coalesce(b.amount, current_price), updated_at = now()
  where id = a.id returning * into a;
  if a.winner_id is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.winner_id, 'auction', 'Ganhou o leilão!', 'Ganhou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'auction', 'Leilão terminado',
          case when a.winner_id is not null then '«' || a.title || '» vendido por ' || a.current_price || ' Kz.' else '«' || a.title || '» terminou sem vencedor.' end,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $$;

-- Ativa leilões agendados e fecha os que terminaram (corre a cada 5 minutos)
create or replace function public.finalize_due_auctions()
returns integer language plpgsql security definer set search_path = public as $$
declare x record; n integer := 0;
begin
  update public.auctions set status = 'live', updated_at = now() where status = 'scheduled' and starts_at <= now() and ends_at > now();
  for x in select id from public.auctions where status in ('live','scheduled') and ends_at <= now() loop
    perform public.close_auction(x.id); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.finalize_due_auctions() from public, anon, authenticated;
revoke all on function public.activate_due_auctions() from public, anon, authenticated;
select cron.schedule('huambo-online-finalize-auctions', '*/5 * * * *', 'select public.finalize_due_auctions();');

create or replace function public.auction_for_listing(p_listing_id uuid)
returns table(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, min_increment numeric, current_price numeric,
  starts_at timestamptz, ends_at timestamptz, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or a.current_price >= a.reserve_price), a.min_increment, a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id),
         (select max(amount) from public.auction_bids b where b.auction_id = a.id and b.bidder_id = auth.uid()),
         coalesce((select b.bidder_id = auth.uid() from public.auction_bids b where b.auction_id = a.id order by amount desc, created_at asc limit 1), false)
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$$;

-- 4. Página pública do vendedor
create or replace function public.public_seller(p_user_id uuid)
returns table(id uuid, full_name text, avatar_url text, municipality text, member_since timestamptz, listings bigint, products bigint,
  is_provider boolean, rating numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, p.municipality, p.created_at,
         (select count(*) from public.classified_listings l where l.owner_id = p.id and l.status = 'published'),
         (select count(*) from public.products x where x.seller_id = p.id and x.active),
         exists (select 1 from public.provider_profiles pp where pp.user_id = p.id and pp.active),
         (select coalesce(round(avg(r.rating)::numeric, 1), 0) from public.reviews r where r.provider_id = p.id and r.status = 'published'),
         (select count(*) from public.reviews r where r.provider_id = p.id and r.status = 'published')
  from public.profiles p where p.id = p_user_id and p.status = 'active';
$$;

do $$
declare f text;
begin
  foreach f in array array['public.respond_rental_request(uuid, boolean)', 'public.cancel_rental_request(uuid)', 'public.my_rental_requests(text)',
    'public.request_classified_rental(uuid, timestamptz, timestamptz, numeric, text)', 'public.place_auction_bid(uuid, numeric)',
    'public.close_auction(uuid)', 'public.create_classified_auction(uuid, timestamptz, timestamptz, numeric, numeric, numeric)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.auction_for_listing(uuid) to anon, authenticated;
grant execute on function public.public_seller(uuid) to anon, authenticated;
