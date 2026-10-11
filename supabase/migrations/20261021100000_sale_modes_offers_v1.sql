-- Modo de venda escolhido ao publicar: preço fixo (compra direta), negociável, aberto a propostas,
-- leilão ou só troca; mais «também aceito troca». Propostas de compra/troca com resposta do vendedor.

alter table public.classified_listings add column if not exists sale_mode text
  check (sale_mode is null or sale_mode in ('fixed', 'negotiable', 'offers', 'auction', 'trade'));
alter table public.classified_listings add column if not exists accepts_trade boolean not null default false;
alter table public.classified_listings add column if not exists trade_wants text
  check (trade_wants is null or char_length(trade_wants) <= 300);

-- O leilão iniciado marca o modo «leilão».
create or replace function public.sync_auction_sale_mode() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.purpose = 'auction' and new.sale_mode is distinct from 'auction' then new.sale_mode := 'auction'; end if;
  return new;
end $$;
create trigger trg_sync_auction_sale_mode before insert or update of purpose on public.classified_listings
  for each row execute function public.sync_auction_sale_mode();

-- Propostas -----------------------------------------------------------------------------
create table if not exists public.listing_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.classified_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  amount numeric check (amount is null or amount > 0),
  trade_item text check (trade_item is null or char_length(trade_item) between 2 and 300),
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  seller_note text check (seller_note is null or char_length(seller_note) <= 300),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (amount is not null or trade_item is not null)
);
create unique index if not exists listing_offers_one_pending on public.listing_offers(listing_id, buyer_id) where status = 'pending';
create index if not exists listing_offers_listing on public.listing_offers(listing_id, created_at desc);
alter table public.listing_offers enable row level security;
create policy listing_offers_parties_read on public.listing_offers for select to authenticated using (
  buyer_id = auth.uid() or exists (select 1 from public.classified_listings l where l.id = listing_id and l.owner_id = auth.uid()));
revoke all on public.listing_offers from anon, authenticated;
grant select on public.listing_offers to authenticated;

create or replace function public.make_offer(p_listing_id uuid, p_amount numeric, p_trade_item text default null, p_message text default null)
returns public.listing_offers language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; o public.listing_offers; t text := nullif(left(trim(coalesce(p_trade_item, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.status <> 'published' then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_OFFER_OWN_LISTING'; end if;
  if l.purpose in ('wanted', 'auction') or coalesce(l.sale_mode, 'negotiable') in ('fixed', 'auction') and not l.accepts_trade then raise exception 'OFFERS_NOT_ACCEPTED'; end if;
  if p_amount is null and t is null then raise exception 'OFFER_REQUIRED'; end if;
  if p_amount is not null and p_amount <= 0 then raise exception 'INVALID_OFFER'; end if;
  if t is not null and not (l.accepts_trade or l.sale_mode in ('trade', 'offers')) then raise exception 'TRADE_NOT_ACCEPTED'; end if;
  if l.sale_mode = 'trade' and t is null then raise exception 'TRADE_REQUIRED'; end if;
  if l.sale_mode = 'fixed' and t is null then raise exception 'OFFERS_NOT_ACCEPTED'; end if; -- preço fixo: só propostas de troca
  if exists (select 1 from public.listing_offers where listing_id = l.id and buyer_id = auth.uid() and status = 'pending') then raise exception 'OFFER_PENDING'; end if;
  if (select count(*) from public.listing_offers where buyer_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then raise exception 'TOO_MANY_REQUESTS'; end if;
  insert into public.listing_offers(listing_id, buyer_id, amount, trade_item, message)
  values (l.id, auth.uid(), p_amount, t, nullif(left(trim(coalesce(p_message, '')), 500), '')) returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Nova proposta', '«' || l.title || '»: ' || concat_ws(' + ', case when p_amount is not null then replace(to_char(p_amount, 'FM999,999,999,990'), ',', ' ') || ' Kz' end, case when t is not null then 'troca por ' || t end),
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'offer'));
  return o;
end $$;

create or replace function public.respond_offer(p_offer_id uuid, p_accept boolean, p_note text default null)
returns public.listing_offers language plpgsql security definer set search_path = public as $$
declare o public.listing_offers; l public.classified_listings;
begin
  select * into o from public.listing_offers where id = p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = o.listing_id;
  if l.owner_id is distinct from auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if o.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  update public.listing_offers set status = case when p_accept then 'accepted' else 'declined' end,
    seller_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), responded_at = now()
   where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_accept then 'Proposta aceite ✔' else 'Proposta recusada' end,
          '«' || l.title || '»' || coalesce(': ' || o.seller_note, case when p_accept then '. Combine a entrega com o vendedor pelas mensagens.' else '' end),
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'my_offer'));
  return o;
end $$;

create or replace function public.withdraw_offer(p_offer_id uuid)
returns public.listing_offers language plpgsql security definer set search_path = public as $$
declare o public.listing_offers;
begin
  update public.listing_offers set status = 'withdrawn', responded_at = now()
   where id = p_offer_id and buyer_id = auth.uid() and status = 'pending' returning * into o;
  if not found then raise exception 'INVALID_TRANSITION'; end if;
  return o;
end $$;

-- Propostas de um anúncio (só o dono) e as minhas propostas.
create or replace function public.listing_offers_for(p_listing_id uuid)
returns table(id uuid, buyer_id uuid, buyer_name text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select o.id, o.buyer_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at
  from public.listing_offers o left join public.profiles p on p.id = o.buyer_id
  where o.listing_id = p_listing_id order by (o.status = 'pending') desc, o.created_at desc limit 100;
end $$;

create or replace function public.my_offers()
returns table(id uuid, listing_id uuid, listing_title text, listing_status text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.listing_id, l.title, l.status, o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at
  from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where o.buyer_id = auth.uid() order by o.created_at desc limit 100;
$$;

-- Contagem de propostas pendentes por anúncio (para «Os meus anúncios»).
create or replace function public.my_listing_offer_counts()
returns table(listing_id uuid, pending bigint)
language sql stable security definer set search_path = public as $$
  select o.listing_id, count(*) from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where l.owner_id = auth.uid() and o.status = 'pending' group by o.listing_id;
$$;

-- Quem fez proposta também pode ser escolhido em «Com quem fez negócio?».
create or replace function public.listing_deal_candidates(p_listing_id uuid)
returns table(user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select distinct x.uid, coalesce(nullif(p.full_name, ''), 'Utilizador') from (
    select cp.user_id as uid from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
     where c.classified_listing_id = p_listing_id
    union
    select o.buyer_id from public.listing_offers o where o.listing_id = p_listing_id and o.status in ('pending', 'accepted')
  ) x left join public.profiles p on p.id = x.uid
  where x.uid <> auth.uid();
end $$;

revoke all on function public.make_offer(uuid, numeric, text, text) from public, anon;
revoke all on function public.respond_offer(uuid, boolean, text) from public, anon;
revoke all on function public.withdraw_offer(uuid) from public, anon;
revoke all on function public.listing_offers_for(uuid) from public, anon;
revoke all on function public.my_offers() from public, anon;
revoke all on function public.my_listing_offer_counts() from public, anon;
revoke all on function public.sync_auction_sale_mode() from public, anon, authenticated;
grant execute on function public.make_offer(uuid, numeric, text, text) to authenticated;
grant execute on function public.respond_offer(uuid, boolean, text) to authenticated;
grant execute on function public.withdraw_offer(uuid) to authenticated;
grant execute on function public.listing_offers_for(uuid) to authenticated;
grant execute on function public.my_offers() to authenticated;
grant execute on function public.my_listing_offer_counts() to authenticated;
