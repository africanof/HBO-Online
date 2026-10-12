-- Leilões, mais como no eBay (Site e APP):
-- 1) «Comprar já»: o vendedor pode pôr um preço para comprar logo; desaparece com o primeiro lance.
-- 2) «As minhas licitações»: todos os leilões em que licitei, com o meu estado (a ganhar, ultrapassado, ganhou, perdeu).
-- 3) Aviso «termina em menos de 1 hora» a quem licitou e a quem guardou o anúncio (uma vez por leilão).

alter table public.auctions add column if not exists buy_now_price numeric check (buy_now_price is null or buy_now_price > 0);
alter table public.auctions add column if not exists ending_notified_at timestamptz;
alter table public.auctions add column if not exists bought_now boolean not null default false;

-- 1) Comprar já -------------------------------------------------------------------------
create or replace function public.set_auction_buy_now(p_auction_id uuid, p_price numeric)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.seller_id <> auth.uid() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status not in ('live', 'scheduled') or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
  if p_price is not null and (p_price <= a.starting_price or p_price < coalesce(a.reserve_price, 0)) then raise exception 'INVALID_BUY_NOW_PRICE'; end if;
  update public.auctions set buy_now_price = p_price, updated_at = now() where id = a.id returning * into a;
  return a;
end $$;

create or replace function public.buy_auction_now(p_auction_id uuid)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  if a.buy_now_price is null then raise exception 'BUY_NOW_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'BUY_NOW_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_by is not null and retracted_by <> auth.uid()) then raise exception 'BIDDER_BLOCKED'; end if;
  update public.auctions set status = 'ended', winner_id = auth.uid(), current_price = buy_now_price, bought_now = true, ends_at = greatest(now(), starts_at + interval '1 second'), updated_at = now()
   where id = a.id returning * into a;
  insert into public.notifications(user_id, type, title, body, data)
  values (auth.uid(), 'auction', 'Comprou já! 🎉', 'Comprou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor para combinar a entrega.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id)),
         (a.seller_id, 'auction', 'Vendido com «Comprar já»', '«' || a.title || '» foi comprado por ' || a.current_price || ' Kz. O comprador vai contactá-lo.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $$;

-- Leilão do anúncio com «Comprar já» (a versão antiga continua igual).
create or replace function public.auction_for_listing_v2(p_listing_id uuid)
returns table(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, has_reserve boolean, min_increment numeric, current_price numeric,
  starts_at timestamptz, ends_at timestamptz, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean,
  buy_now_price numeric, buy_now_available boolean, bought_now boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or coalesce((select s.leader_max from public.auction_standing(a.id) s), 0) >= a.reserve_price), a.reserve_price is not null,
         public.auction_increment(a.current_price, a.min_increment), a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select m.max_amount from public.auction_max_bids m where m.auction_id = a.id and m.bidder_id = auth.uid() and m.retracted_at is null),
         coalesce((select s.leader = auth.uid() from public.auction_standing(a.id) s), false),
         a.buy_now_price,
         a.buy_now_price is not null and a.status = 'live' and now() < a.ends_at
           and not exists (select 1 from public.auction_max_bids m where m.auction_id = a.id and m.retracted_at is null),
         a.bought_now
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$$;

-- 2) As minhas licitações ---------------------------------------------------------------
create or replace function public.my_auction_bids()
returns table(auction_id uuid, listing_id uuid, ref_no bigint, title text, photo text, status text, ends_at timestamptz, current_price numeric,
  my_max numeric, standing text, bid_count bigint)
language sql stable security definer set search_path = public as $$
  select a.id, a.classified_listing_id, l.ref_no, a.title, l.media->>0, a.status, a.ends_at, a.current_price,
    case when m.retracted_at is null then m.max_amount end,
    case
      when m.retracted_at is not null then case when m.retracted_by = m.bidder_id then 'retracted' else 'cancelled' end
      when a.status = 'ended' and a.winner_id = m.bidder_id then 'won'
      when a.status = 'ended' then case when a.winner_id is null and s.leader = m.bidder_id then 'reserve_not_met' else 'lost' end
      when a.status = 'cancelled' then 'auction_cancelled'
      when s.leader = m.bidder_id then 'winning'
      else 'outbid' end,
    (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null)
  from public.auction_max_bids m
  join public.auctions a on a.id = m.auction_id
  left join public.classified_listings l on l.id = a.classified_listing_id
  cross join lateral public.auction_standing(a.id) s
  where m.bidder_id = auth.uid()
  order by (a.status = 'live') desc, a.ends_at asc limit 200;
$$;

-- 3) Aviso de fim + fecho automático (corre a cada 5 minutos) --------------------------------
create or replace function public.finalize_due_auctions()
returns integer language plpgsql security definer set search_path = public as $$
declare x record; n integer := 0; st record;
begin
  update public.auctions set status = 'live', updated_at = now() where status = 'scheduled' and starts_at <= now() and ends_at > now();
  for x in select * from public.auctions where status = 'live' and ending_notified_at is null and ends_at > now() and ends_at <= now() + interval '1 hour' for update skip locked loop
    select * into st from public.auction_standing(x.id);
    insert into public.notifications(user_id, type, title, body, data)
    select m.bidder_id, 'auction',
      case when m.bidder_id = st.leader then 'Leilão a terminar: está a ganhar' else 'Leilão a terminar: foi ultrapassado' end,
      '«' || x.title || '» termina em menos de 1 hora. Preço atual: ' || st.price || ' Kz.' || case when m.bidder_id = st.leader then '' else ' Suba o seu máximo para ganhar.' end,
      jsonb_build_object('auction_id', x.id, 'listing_id', x.classified_listing_id)
    from public.auction_max_bids m where m.auction_id = x.id and m.retracted_at is null;
    insert into public.notifications(user_id, type, title, body, data)
    select distinct si.user_id, 'auction', 'Leilão guardado a terminar', '«' || x.title || '» termina em menos de 1 hora. Preço atual: ' || st.price || ' Kz.',
      jsonb_build_object('auction_id', x.id, 'listing_id', x.classified_listing_id)
    from public.saved_items si
    where si.classified_listing_id = x.classified_listing_id and si.user_id <> x.seller_id
      and not exists (select 1 from public.auction_max_bids m where m.auction_id = x.id and m.bidder_id = si.user_id and m.retracted_at is null);
    update public.auctions set ending_notified_at = now() where id = x.id;
  end loop;
  for x in select id from public.auctions where status in ('live','scheduled') and ends_at <= now() loop
    perform public.close_auction(x.id); n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.set_auction_buy_now(uuid, numeric) from public, anon;
revoke all on function public.buy_auction_now(uuid) from public, anon;
revoke all on function public.my_auction_bids() from public, anon;
revoke all on function public.finalize_due_auctions() from public, anon, authenticated;
grant execute on function public.set_auction_buy_now(uuid, numeric) to authenticated;
grant execute on function public.buy_auction_now(uuid) to authenticated;
grant execute on function public.my_auction_bids() to authenticated;
grant execute on function public.auction_for_listing_v2(uuid) to anon, authenticated;
