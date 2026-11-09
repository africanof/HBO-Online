-- Propostas como na Vinted: limite de 20 por dia (com contador), contraproposta de quem vende.

alter table public.listing_offers add column if not exists counter_amount numeric;
alter table public.listing_offers add column if not exists countered_at timestamptz;
alter table public.listing_offers drop constraint if exists listing_offers_status_check;
alter table public.listing_offers add constraint listing_offers_status_check check (status = any (array['pending','accepted','declined','withdrawn','countered']));
alter table public.listing_offers drop constraint if exists listing_offers_counter_check;
alter table public.listing_offers add constraint listing_offers_counter_check check (counter_amount is null or counter_amount > 0);

-- Quantas propostas a pessoa ainda pode fazer hoje (últimas 24 horas).
create or replace function public.offers_left_today()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 20 - (select count(*) from public.listing_offers where buyer_id = auth.uid() and created_at > now() - interval '1 day' and not via_chat))::int
$$;
revoke all on function public.offers_left_today() from public, anon;
grant execute on function public.offers_left_today() to authenticated;

do $m$
declare src text;
begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'make_offer' and pronamespace = 'public'::regnamespace;
  src := replace(src, $a$and buyer_id = auth.uid() and status = 'pending') then raise exception 'OFFER_PENDING'$a$, $a$and buyer_id = auth.uid() and status in ('pending', 'countered')) then raise exception 'OFFER_PENDING'$a$);
  src := replace(src, $a$where buyer_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then$a$, $a$where buyer_id = auth.uid() and created_at > now() - interval '1 day' and not via_chat) >= 20 then$a$);
  if position($a$in ('pending', 'countered')$a$ in src) = 0 or position('>= 20' in src) = 0 then raise exception 'make_offer: texto esperado não encontrado'; end if;
  execute src;
end $m$;

-- Quem vende responde com outro valor.
create or replace function public.counter_offer(p_offer_id uuid, p_amount numeric, p_note text default null)
returns public.listing_offers language plpgsql security definer set search_path = public as $$
declare o public.listing_offers; l public.classified_listings;
begin
  select * into o from public.listing_offers where id = p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = o.listing_id;
  if l.owner_id is distinct from auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if o.status <> 'pending' or o.amount is null then raise exception 'INVALID_TRANSITION'; end if;
  if p_amount is null or p_amount <= o.amount then raise exception 'COUNTER_TOO_LOW'; end if;
  if coalesce(l.price, 0) > 0 and p_amount > l.price then raise exception 'ABOVE_LISTING_PRICE'; end if;
  update public.listing_offers set status = 'countered', counter_amount = p_amount, countered_at = now(),
    seller_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), responded_at = now()
   where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', 'Contraproposta 💬', '«' || l.title || '»: quem vende propõe ' || public.money_label(p_amount, l.currency) || '.',
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'my_offer'));
  return o;
end $$;
revoke all on function public.counter_offer(uuid, numeric, text) from public, anon;
grant execute on function public.counter_offer(uuid, numeric, text) to authenticated;

-- Quem compra aceita a contraproposta: a proposta fica aceite com o novo valor (cria a encomenda protegida, como uma proposta aceite).
create or replace function public.accept_counter_offer(p_offer_id uuid)
returns public.listing_offers language plpgsql security definer set search_path = public as $$
declare o public.listing_offers; l public.classified_listings;
begin
  select * into o from public.listing_offers where id = p_offer_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  if o.status <> 'countered' or o.counter_amount is null then raise exception 'INVALID_TRANSITION'; end if;
  select * into l from public.classified_listings where id = o.listing_id;
  if l.status <> 'published' then raise exception 'LISTING_NOT_AVAILABLE'; end if;
  update public.listing_offers set amount = o.counter_amount, status = 'accepted', responded_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Contraproposta aceite ✔', '«' || l.title || '»: ' || public.money_label(o.amount, l.currency) || '. Espere pelo aviso «Pagamento recebido» antes de entregar.',
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'offer'));
  return o;
end $$;
revoke all on function public.accept_counter_offer(uuid) from public, anon;
grant execute on function public.accept_counter_offer(uuid) to authenticated;

-- Retirar também serve para recusar a contraproposta.
create or replace function public.withdraw_offer(p_offer_id uuid)
returns public.listing_offers language plpgsql security definer set search_path = public as $$
declare o public.listing_offers;
begin
  update public.listing_offers set status = 'withdrawn', responded_at = now()
   where id = p_offer_id and buyer_id = auth.uid() and status in ('pending', 'countered') returning * into o;
  if not found then raise exception 'INVALID_TRANSITION'; end if;
  return o;
end $$;

drop function if exists public.my_offers();
create function public.my_offers()
returns table(id uuid, listing_id uuid, listing_title text, listing_status text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamptz, counter_amount numeric, listing_price numeric, currency text)
language sql stable security definer set search_path = public as $$
  select o.id, o.listing_id, l.title, l.status, o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at, o.counter_amount, l.price, coalesce(l.currency, 'AOA')
  from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where o.buyer_id = auth.uid() and not o.via_chat order by o.created_at desc limit 100;
$$;
revoke all on function public.my_offers() from public, anon;
grant execute on function public.my_offers() to authenticated;

drop function if exists public.listing_offers_for(uuid);
create function public.listing_offers_for(p_listing_id uuid)
returns table(id uuid, buyer_id uuid, buyer_name text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamptz, counter_amount numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select o.id, o.buyer_id, coalesce(nullif(public.viewer_name(p.id), ''), 'Utilizador'), o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at, o.counter_amount
  from public.listing_offers o left join public.profiles p on p.id = o.buyer_id
  where o.listing_id = p_listing_id and o.team_forwarded_at is not null and not o.via_chat
  order by (o.status = 'pending') desc, o.created_at desc limit 100;
end $$;
revoke all on function public.listing_offers_for(uuid) from public, anon;
grant execute on function public.listing_offers_for(uuid) to authenticated;
