-- 1) Cancelar lances (igual no Site e na APP):
--    • quem licitou pode retirar os seus lances com um motivo, se faltarem mais de 12 horas para o fim
--      ou se o lance foi feito há menos de 1 hora (engano no valor); no máximo 3 vezes em 30 dias;
--    • o vendedor (ou a administração) pode cancelar os lances de uma pessoa, com motivo, enquanto o leilão decorre.
--    Os lances cancelados ficam guardados (para histórico), mas deixam de contar.
-- 2) Número curto de referência: anúncios A-1001, produtos P-1001, encomendas E-1001.

alter table public.auction_bids add column if not exists retracted_at timestamptz;
alter table public.auction_bids add column if not exists retracted_by uuid references auth.users(id) on delete set null;
alter table public.auction_bids add column if not exists retract_reason text check (retract_reason is null or char_length(retract_reason) <= 300);
create index if not exists auction_bids_active on public.auction_bids(auction_id, amount desc, created_at) where retracted_at is null;

-- Recalcula o preço atual a partir dos lances que contam.
create or replace function public.auction_recalc(p_auction_id uuid) returns public.auctions
language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  update public.auctions x set current_price = coalesce((select max(b.amount) from public.auction_bids b where b.auction_id = x.id and b.retracted_at is null), x.starting_price),
    updated_at = now()
   where x.id = p_auction_id returning * into a;
  return a;
end $$;

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
  -- quem teve os lances cancelados pelo vendedor não volta a licitar neste leilão
  if exists (select 1 from public.auction_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_by = a.seller_id) then raise exception 'BIDDER_BLOCKED'; end if;
  select bidder_id into prev from public.auction_bids where auction_id = a.id and retracted_at is null order by amount desc, created_at asc limit 1;
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
    -- o vendedor pode cancelar antes do fim só se não houver lances que contem
    if exists (select 1 from public.auction_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
    update public.auctions set status = 'cancelled', updated_at = now() where id = a.id returning * into a;
    return a;
  end if;
  select * into b from public.auction_bids where auction_id = a.id and retracted_at is null order by amount desc, created_at asc limit 1;
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

create or replace function public.auction_for_listing(p_listing_id uuid)
returns table(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, min_increment numeric, current_price numeric,
  starts_at timestamptz, ends_at timestamptz, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or a.current_price >= a.reserve_price), a.min_increment, a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select max(amount) from public.auction_bids b where b.auction_id = a.id and b.bidder_id = auth.uid() and b.retracted_at is null),
         coalesce((select b.bidder_id = auth.uid() from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null order by amount desc, created_at asc limit 1), false)
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$$;

-- Lista de lances: nomes escondidos para o público («Licitador 1»); o vendedor e a administração veem o nome.
create or replace function public.auction_bids_for(p_auction_id uuid)
returns table(id uuid, bidder_label text, amount numeric, created_at timestamptz, is_mine boolean, retracted boolean, retract_reason text, retracted_by_seller boolean)
language plpgsql stable security definer set search_path = public as $$
declare a public.auctions; see_names boolean;
begin
  select * into a from public.auctions where auctions.id = p_auction_id;
  if not found or (a.status not in ('live', 'ended') and a.seller_id is distinct from auth.uid() and not public.has_admin_role()) then raise exception 'AUCTION_NOT_FOUND'; end if;
  see_names := a.seller_id = auth.uid() or public.has_admin_role();
  return query
  with ranked as (
    select b.*, dense_rank() over (order by first_bid.first_at, b.bidder_id) as n
    from public.auction_bids b
    join (select x.bidder_id, min(x.created_at) first_at from public.auction_bids x where x.auction_id = a.id group by x.bidder_id) first_bid on first_bid.bidder_id = b.bidder_id
    where b.auction_id = a.id)
  select r.id,
    case when r.bidder_id = auth.uid() then 'Você'
         when see_names then coalesce(nullif((select p.full_name from public.profiles p where p.id = r.bidder_id), ''), 'Licitador ' || r.n)
         else 'Licitador ' || r.n end,
    r.amount, r.created_at, r.bidder_id = auth.uid(), r.retracted_at is not null,
    case when r.retracted_at is not null then r.retract_reason end, r.retracted_by is not null and r.retracted_by <> r.bidder_id
  from ranked r order by r.amount desc, r.created_at asc limit 200;
end $$;

-- Quem licitou retira os seus lances.
create or replace function public.retract_auction_bid(p_auction_id uuid, p_reason text)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; leader_before uuid; leader_after uuid; latest timestamptz; reason text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  reason := case p_reason when 'typo' then 'Enganei-me no valor' when 'listing_changed' then 'O vendedor mudou o anúncio'
    when 'cannot_contact' then 'Não consigo contactar o vendedor' end;
  if reason is null then raise exception 'INVALID_REASON'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  select max(created_at) into latest from public.auction_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_at is null;
  if latest is null then raise exception 'NO_BID_TO_RETRACT'; end if;
  if a.ends_at - now() <= interval '12 hours' and latest < now() - interval '1 hour' then raise exception 'RETRACT_TOO_LATE'; end if;
  if (select count(distinct auction_id) from public.auction_bids where bidder_id = auth.uid() and retracted_by = auth.uid() and retracted_at > now() - interval '30 days') >= 3 then raise exception 'TOO_MANY_RETRACTIONS'; end if;
  select bidder_id into leader_before from public.auction_bids where auction_id = a.id and retracted_at is null order by amount desc, created_at asc limit 1;
  update public.auction_bids set retracted_at = now(), retracted_by = auth.uid(), retract_reason = reason
   where auction_id = a.id and bidder_id = auth.uid() and retracted_at is null;
  a := public.auction_recalc(a.id);
  select bidder_id into leader_after from public.auction_bids where auction_id = a.id and retracted_at is null order by amount desc, created_at asc limit 1;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'bid', 'Lance retirado', 'Um licitador retirou os lances em «' || a.title || '» (' || reason || '). Preço atual: ' || a.current_price || ' Kz.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  if leader_after is not null and leader_after is distinct from leader_before then
    insert into public.notifications(user_id, type, title, body, data)
    values (leader_after, 'bid', 'Voltou a ganhar o leilão', 'Um lance maior foi retirado em «' || a.title || '». Está a ganhar com ' || a.current_price || ' Kz.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return a;
end $$;

-- O vendedor (ou a administração) cancela os lances de uma pessoa.
create or replace function public.seller_cancel_bid(p_bid_id uuid, p_reason text)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; b public.auction_bids; leader_before uuid; leader_after uuid; txt text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into b from public.auction_bids where id = p_bid_id;
  if not found then raise exception 'BID_NOT_FOUND'; end if;
  select * into a from public.auctions where id = b.auction_id for update;
  if a.seller_id is distinct from auth.uid() and not public.has_admin_role() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if b.retracted_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select bidder_id into leader_before from public.auction_bids where auction_id = a.id and retracted_at is null order by amount desc, created_at asc limit 1;
  update public.auction_bids set retracted_at = now(), retracted_by = auth.uid(), retract_reason = txt
   where auction_id = a.id and bidder_id = b.bidder_id and retracted_at is null;
  a := public.auction_recalc(a.id);
  select bidder_id into leader_after from public.auction_bids where auction_id = a.id and retracted_at is null order by amount desc, created_at asc limit 1;
  insert into public.notifications(user_id, type, title, body, data)
  values (b.bidder_id, 'bid', 'Os seus lances foram cancelados', '«' || a.title || '»: ' || txt,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  if leader_after is not null and leader_after is distinct from leader_before then
    insert into public.notifications(user_id, type, title, body, data)
    values (leader_after, 'bid', 'Voltou a ganhar o leilão', 'Um lance maior foi cancelado em «' || a.title || '». Está a ganhar com ' || a.current_price || ' Kz.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  if public.has_admin_role() and a.seller_id is distinct from auth.uid() then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'bid_cancelled', 'auction', a.id, jsonb_build_object('bidder_id', b.bidder_id, 'reason', txt));
  end if;
  return a;
end $$;

revoke all on function public.auction_recalc(uuid) from public, anon, authenticated;
revoke all on function public.retract_auction_bid(uuid, text) from public, anon;
revoke all on function public.seller_cancel_bid(uuid, text) from public, anon;
grant execute on function public.retract_auction_bid(uuid, text) to authenticated;
grant execute on function public.seller_cancel_bid(uuid, text) to authenticated;
grant execute on function public.auction_bids_for(uuid) to anon, authenticated;

-- 2) Números de referência ---------------------------------------------------------------
alter table public.classified_listings add column if not exists ref_no bigint generated by default as identity (start with 1001);
alter table public.products add column if not exists ref_no bigint generated by default as identity (start with 1001);
alter table public.orders add column if not exists ref_no bigint generated by default as identity (start with 1001);
create unique index if not exists classified_listings_ref_no on public.classified_listings(ref_no);
create unique index if not exists products_ref_no on public.products(ref_no);
create unique index if not exists orders_ref_no on public.orders(ref_no);

-- Encontrar pelo número: «A-1001», «P1001», «e 1001». Só devolve o que a pessoa pode ver.
create or replace function public.find_by_ref(p_ref text)
returns table(kind text, id uuid)
language plpgsql stable security definer set search_path = public as $$
declare m text[]; k text; n bigint;
begin
  m := regexp_match(upper(trim(coalesce(p_ref, ''))), '^([APE])[\s-]*0*([0-9]{1,12})$');
  if m is null then return; end if;
  k := m[1]; n := m[2]::bigint;
  if k = 'A' then
    return query select 'listing'::text, l.id from public.classified_listings l
      where l.ref_no = n and (l.status in ('published', 'sold', 'rented', 'closed') or l.owner_id = auth.uid() or public.has_admin_role());
  elsif k = 'P' then
    return query select 'product'::text, p.id from public.products p where p.ref_no = n and (p.active or p.seller_id = auth.uid() or public.has_admin_role());
  else
    return query select 'order'::text, o.id from public.orders o where o.ref_no = n and (auth.uid() in (o.buyer_id, o.seller_id) or public.has_admin_role());
  end if;
end $$;
grant execute on function public.find_by_ref(text) to anon, authenticated;

-- Encomendas com o número (e os dados de reembolso) para o Site e a APP.
create or replace function public.my_orders_v2(p_role text default 'buyer')
returns table(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text,
  created_at timestamptz, updated_at timestamptz, completed_at timestamptz, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text,
  contact_phone text, delivery_text text, buyer_note text, items jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$$;
revoke all on function public.my_orders_v2(text) from public, anon;
grant execute on function public.my_orders_v2(text) to authenticated;
