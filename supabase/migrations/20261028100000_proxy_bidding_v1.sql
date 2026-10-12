-- Leilões à moda do eBay (licitação automática), iguais no Site e na APP:
-- • cada pessoa indica o MÁXIMO que está disposta a pagar; esse máximo fica secreto;
-- • o sistema licita por ela só o necessário para ficar à frente: preço = 2.º maior máximo + incremento
--   (sem passar do máximo de quem ganha);
-- • em caso de empate ganha quem chegou primeiro a esse valor;
-- • o incremento sobe com o preço (tabela por escalões) e nunca é menor que o escolhido pelo vendedor;
-- • preço mínimo de venda (reserva): quando um máximo o atinge, o preço sobe logo até ele;
-- • quem já está a ganhar pode subir o seu máximo sem subir o preço;
-- • retirar e cancelar lances continuam com as mesmas regras e o preço é recalculado.

create table if not exists public.auction_max_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references auth.users(id) on delete cascade,
  max_amount numeric not null check (max_amount > 0),
  max_set_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  retracted_at timestamptz,
  retracted_by uuid references auth.users(id) on delete set null,
  retract_reason text check (retract_reason is null or char_length(retract_reason) <= 300),
  unique (auction_id, bidder_id)
);
create index if not exists auction_max_bids_rank on public.auction_max_bids(auction_id, max_amount desc, max_set_at) where retracted_at is null;
alter table public.auction_max_bids enable row level security;
-- máximos secretos: sem regras de leitura; só as funções do servidor os usam
revoke all on public.auction_max_bids from anon, authenticated;

alter table public.auction_bids add column if not exists is_auto boolean not null default false;

-- Lances que já existiam passam a ser o máximo de cada pessoa.
insert into public.auction_max_bids(auction_id, bidder_id, max_amount, max_set_at, created_at, retracted_at, retracted_by, retract_reason)
select auction_id, bidder_id, max(amount), max(created_at), min(created_at),
  case when bool_and(retracted_at is not null) then max(retracted_at) end,
  case when bool_and(retracted_at is not null) then (array_agg(retracted_by order by retracted_at desc))[1] end,
  case when bool_and(retracted_at is not null) then (array_agg(retract_reason order by retracted_at desc))[1] end
from public.auction_bids group by auction_id, bidder_id
on conflict (auction_id, bidder_id) do nothing;

-- Incremento por escalões de preço (Kz), nunca menor que o do vendedor.
create or replace function public.auction_increment(p_price numeric, p_min numeric default 0) returns numeric
language sql immutable as $$
  select greatest(coalesce(p_min, 0), case
    when p_price < 1000 then 50 when p_price < 5000 then 100 when p_price < 25000 then 250 when p_price < 100000 then 500
    when p_price < 250000 then 1000 when p_price < 1000000 then 2500 when p_price < 5000000 then 5000 else 10000 end);
$$;

-- Calcula quem ganha e o preço a partir dos máximos que contam.
create or replace function public.auction_standing(p_auction_id uuid, out leader uuid, out leader_max numeric, out price numeric)
language plpgsql stable security definer set search_path = public as $$
declare a public.auctions; second_max numeric;
begin
  select * into a from public.auctions where id = p_auction_id;
  select m.bidder_id, m.max_amount into leader, leader_max from public.auction_max_bids m
   where m.auction_id = p_auction_id and m.retracted_at is null order by m.max_amount desc, m.max_set_at asc limit 1;
  if leader is null then price := a.starting_price; return; end if;
  select m.max_amount into second_max from public.auction_max_bids m
   where m.auction_id = p_auction_id and m.retracted_at is null order by m.max_amount desc, m.max_set_at asc offset 1 limit 1;
  price := case when second_max is null then a.starting_price
                else least(leader_max, second_max + public.auction_increment(second_max, a.min_increment)) end;
  if a.reserve_price is not null and leader_max >= a.reserve_price then price := greatest(price, a.reserve_price); end if;
  price := least(greatest(price, a.starting_price), leader_max);
end $$;

-- Licitar = indicar o máximo. Devolve o lance visível registado para quem licitou.
create or replace function public.place_auction_bid(p_auction_id uuid, p_amount numeric)
returns public.auction_bids language plpgsql security definer set search_path = public as $$
declare a public.auctions; b public.auction_bids; mine public.auction_max_bids; before record; after record; min_bid numeric; has_bids boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'BID_TOO_LOW'; end if;
  select * into mine from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid();
  if found and mine.retracted_by is not null and mine.retracted_by <> auth.uid() then raise exception 'BIDDER_BLOCKED'; end if;
  select * into before from public.auction_standing(a.id);
  has_bids := before.leader is not null;
  if before.leader = auth.uid() then
    if p_amount <= before.leader_max then raise exception 'MAX_MUST_INCREASE'; end if;
  else
    min_bid := case when not has_bids then a.starting_price else a.current_price + public.auction_increment(a.current_price, a.min_increment) end;
    if p_amount < min_bid then raise exception 'BID_TOO_LOW'; end if;
  end if;
  insert into public.auction_max_bids(auction_id, bidder_id, max_amount, max_set_at)
  values (a.id, auth.uid(), p_amount, now())
  on conflict (auction_id, bidder_id) do update set max_amount = excluded.max_amount, max_set_at = now(), retracted_at = null, retracted_by = null, retract_reason = null;
  select * into after from public.auction_standing(a.id);
  update public.auctions set current_price = after.price, updated_at = now() where id = a.id;

  if after.leader = auth.uid() then
    if before.leader is distinct from auth.uid() or after.price <> a.current_price then
      insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), after.price) returning * into b;
    else
      b := row(null, a.id, auth.uid(), after.price, now(), null, null, null, false)::public.auction_bids; -- só subiu o máximo
    end if;
  else
    -- ultrapassado de imediato pela licitação automática de quem já ganhava
    insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), p_amount) returning * into b;
    insert into public.auction_bids(auction_id, bidder_id, amount, is_auto, created_at) values (a.id, after.leader, after.price, true, now() + interval '1 millisecond');
  end if;

  if before.leader is not null and before.leader is distinct from after.leader then
    insert into public.notifications(user_id, type, title, body, data)
    values (before.leader, 'bid', 'A sua licitação foi ultrapassada', 'O preço de «' || a.title || '» está agora em ' || after.price || ' Kz. Pode subir o seu máximo.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  if after.price <> a.current_price or before.leader is distinct from after.leader then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.seller_id, 'bid', 'Nova licitação', 'Preço atual de «' || a.title || '»: ' || after.price || ' Kz.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return b;
end $$;

create or replace function public.close_auction(p_auction_id uuid)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; st record;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status not in ('live','scheduled') then return a; end if;
  if now() < a.ends_at then
    if auth.uid() is distinct from a.seller_id and not public.has_admin_role() then raise exception 'AUCTION_NOT_ENDED'; end if;
    if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
    update public.auctions set status = 'cancelled', updated_at = now() where id = a.id returning * into a;
    return a;
  end if;
  select * into st from public.auction_standing(a.id);
  update public.auctions set status = 'ended',
    winner_id = case when st.leader is not null and (reserve_price is null or st.leader_max >= reserve_price) then st.leader end,
    current_price = st.price, updated_at = now()
  where id = a.id returning * into a;
  if a.winner_id is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.winner_id, 'auction', 'Ganhou o leilão!', 'Ganhou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'auction', 'Leilão terminado',
          case when a.winner_id is not null then '«' || a.title || '» vendido por ' || a.current_price || ' Kz.'
               when st.leader is not null then '«' || a.title || '» terminou sem atingir o preço mínimo de venda.' else '«' || a.title || '» terminou sem vencedor.' end,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $$;

-- my_best = o MEU máximo (só eu o vejo).
create or replace function public.auction_for_listing(p_listing_id uuid)
returns table(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, min_increment numeric, current_price numeric,
  starts_at timestamptz, ends_at timestamptz, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or coalesce((select s.leader_max from public.auction_standing(a.id) s), 0) >= a.reserve_price),
         public.auction_increment(a.current_price, a.min_increment), a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select m.max_amount from public.auction_max_bids m where m.auction_id = a.id and m.bidder_id = auth.uid() and m.retracted_at is null),
         coalesce((select s.leader = auth.uid() from public.auction_standing(a.id) s), false)
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$$;

-- Histórico com as licitações automáticas assinaladas.
create or replace function public.auction_bids_for_v2(p_auction_id uuid)
returns table(id uuid, bidder_label text, amount numeric, created_at timestamptz, is_mine boolean, is_auto boolean, retracted boolean, retract_reason text, retracted_by_seller boolean)
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
    r.amount, r.created_at, r.bidder_id = auth.uid(), r.is_auto, r.retracted_at is not null,
    case when r.retracted_at is not null then r.retract_reason end, r.retracted_by is not null and r.retracted_by <> r.bidder_id
  from ranked r order by r.created_at desc, r.amount desc limit 200;
end $$;

-- Retirar / cancelar: marca o máximo e o histórico dessa pessoa, recalcula o preço.
create or replace function public.auction_drop_bidder(a public.auctions, p_bidder uuid, p_by uuid, p_reason text) returns public.auctions
language plpgsql security definer set search_path = public as $$
declare before record; after record;
begin
  select * into before from public.auction_standing(a.id);
  update public.auction_max_bids set retracted_at = now(), retracted_by = p_by, retract_reason = p_reason
   where auction_id = a.id and bidder_id = p_bidder and retracted_at is null;
  update public.auction_bids set retracted_at = now(), retracted_by = p_by, retract_reason = p_reason
   where auction_id = a.id and bidder_id = p_bidder and retracted_at is null;
  select * into after from public.auction_standing(a.id);
  update public.auctions set current_price = after.price, updated_at = now() where id = a.id returning * into a;
  if after.leader is not null and after.leader is distinct from before.leader then
    insert into public.auction_bids(auction_id, bidder_id, amount, is_auto) values (a.id, after.leader, after.price, true);
    insert into public.notifications(user_id, type, title, body, data)
    values (after.leader, 'bid', 'Voltou a ganhar o leilão', 'Um lance maior foi retirado em «' || a.title || '». Está a ganhar com ' || after.price || ' Kz.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return a;
end $$;

create or replace function public.retract_auction_bid(p_auction_id uuid, p_reason text)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; latest timestamptz; reason text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  reason := case p_reason when 'typo' then 'Enganei-me no valor' when 'listing_changed' then 'O vendedor mudou o anúncio'
    when 'cannot_contact' then 'Não consigo contactar o vendedor' end;
  if reason is null then raise exception 'INVALID_REASON'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  select max_set_at into latest from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_at is null;
  if latest is null then raise exception 'NO_BID_TO_RETRACT'; end if;
  if a.ends_at - now() <= interval '12 hours' and latest < now() - interval '1 hour' then raise exception 'RETRACT_TOO_LATE'; end if;
  if (select count(*) from public.auction_max_bids where bidder_id = auth.uid() and retracted_by = auth.uid() and retracted_at > now() - interval '30 days') >= 3 then raise exception 'TOO_MANY_RETRACTIONS'; end if;
  a := public.auction_drop_bidder(a, auth.uid(), auth.uid(), reason);
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'bid', 'Lance retirado', 'Um licitador retirou os lances em «' || a.title || '» (' || reason || '). Preço atual: ' || a.current_price || ' Kz.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $$;

create or replace function public.seller_cancel_bid(p_bid_id uuid, p_reason text)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; b public.auction_bids; txt text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into b from public.auction_bids where id = p_bid_id;
  if not found then raise exception 'BID_NOT_FOUND'; end if;
  select * into a from public.auctions where id = b.auction_id for update;
  if a.seller_id is distinct from auth.uid() and not public.has_admin_role() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if b.retracted_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  a := public.auction_drop_bidder(a, b.bidder_id, auth.uid(), txt);
  insert into public.notifications(user_id, type, title, body, data)
  values (b.bidder_id, 'bid', 'Os seus lances foram cancelados', '«' || a.title || '»: ' || txt,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  if public.has_admin_role() and a.seller_id is distinct from auth.uid() then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'bid_cancelled', 'auction', a.id, jsonb_build_object('bidder_id', b.bidder_id, 'reason', txt));
  end if;
  return a;
end $$;

revoke all on function public.auction_standing(uuid) from public, anon, authenticated;
revoke all on function public.auction_drop_bidder(public.auctions, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.auction_increment(numeric, numeric) to anon, authenticated;
grant execute on function public.auction_bids_for_v2(uuid) to anon, authenticated;
