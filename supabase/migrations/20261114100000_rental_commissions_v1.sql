-- Comissão também nos ARRENDAMENTOS e ALUGUERES (bens móveis e imóveis), com a mesma percentagem das vendas
-- (platform_settings.listing_commission_pct, hoje 5%).
-- • Pedido de aluguer aceite pelo dono → comissão sobre o valor total aceite para o período.
-- • Anúncio marcado como «Arrendado» → comissão sobre o valor do arrendamento que o dono indica (por omissão,
--   o preço do anúncio). Se nos 30 dias antes já houve um pedido de aluguer aceite com comissão, não cobra outra vez.
-- • Pedido aceite e depois cancelado, ou anúncio que deixa de estar «Arrendado» → a comissão por pagar é anulada.

alter table public.listing_commissions add column if not exists rental_request_id uuid references public.rental_requests(id) on delete set null;
create unique index if not exists listing_commissions_one_per_rental on public.listing_commissions(rental_request_id) where rental_request_id is not null and status <> 'cancelled';
alter table public.listing_commissions drop constraint if exists listing_commissions_source_check;
alter table public.listing_commissions add constraint listing_commissions_source_check check (source in ('sold', 'auction', 'offer', 'rental', 'rented'));
-- PENDENTE (ver 20261118100000_commissions_sales_only_index.sql; o índice novo já existe): trocar
-- listing_commissions_one_open (uma comissão por anúncio) por uma só para vendas, para o mesmo anúncio
-- poder ter várias comissões de aluguer:
--   create unique index listing_commissions_one_sale on public.listing_commissions(listing_id)
--     where status <> 'cancelled' and source in ('sold', 'auction', 'offer');
--   drop index public.listing_commissions_one_open;
-- Até lá, cada anúncio só gera a comissão do primeiro aluguer ou venda.

-- Cria uma comissão (vendas e arrendamentos) e avisa o dono.
create or replace function public.listing_commission_add(l public.classified_listings, p_amount numeric, p_source text, p_rental uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare st public.platform_settings; fee numeric; due timestamptz; what text;
begin
  select * into st from public.platform_settings where id = 1;
  if p_amount is null or p_amount <= 0 or st.listing_commission_pct <= 0 then return; end if;
  fee := round(p_amount * st.listing_commission_pct / 100);
  due := now() + make_interval(days => st.commission_due_days);
  insert into public.listing_commissions(listing_id, owner_id, listing_title, listed_price, sale_amount, rate_pct, amount, source, due_at, rental_request_id)
  values (l.id, l.owner_id, l.title, l.price, p_amount, st.listing_commission_pct, fee, p_source, due, p_rental)
  on conflict do nothing;
  if not found then return; end if;
  what := case when p_source in ('rental', 'rented') then 'Arrendamento registado' else 'Venda registada' end;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', what || ': comissão de ' || st.listing_commission_pct || '%',
          '«' || l.title || '» ' || case when p_source in ('rental', 'rented') then 'arrendado' else 'vendido' end || ' por ' || p_amount || ' Kz. Comissão a pagar: '
          || fee || ' Kz até ' || to_char(due at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.',
          jsonb_build_object('listing_id', l.id, 'for', 'commission'));
end $$;

-- Vendas (como antes) e agora também «Arrendado».
create or replace function public.listing_commission_on_sale() returns trigger
language plpgsql security definer set search_path = public as $$
declare amt numeric; src text := 'sold'; offer_amt numeric;
begin
  if new.status = 'sold' and old.status is distinct from 'sold' and new.purpose in ('sale', 'auction') then
    if new.deal_with is not null then
      select o.amount into offer_amt from public.listing_offers o where o.listing_id = new.id and o.buyer_id = new.deal_with and o.status = 'accepted' and o.amount is not null
       order by o.responded_at desc nulls last limit 1;
    end if;
    amt := coalesce(new.sale_amount, offer_amt, new.price);
    if new.sale_amount is null and offer_amt is not null then src := 'offer'; end if;
    if new.purpose = 'auction' then src := 'auction'; end if;
    perform public.listing_commission_add(new, amt, src);
  elsif new.status = 'rented' and old.status is distinct from 'rented' and new.purpose in ('rent', 'lease') then
    if not exists (select 1 from public.listing_commissions c where c.listing_id = new.id and c.source = 'rental' and c.status <> 'cancelled'
                   and c.created_at > now() - interval '30 days') then
      perform public.listing_commission_add(new, coalesce(new.sale_amount, new.price), 'rented');
    end if;
  elsif (old.status = 'sold' and new.status is distinct from 'sold') or (old.status = 'rented' and new.status is distinct from 'rented') then
    -- marcado por engano: anula a comissão ainda não paga (vendas e «Arrendado»; os pedidos de aluguer têm a sua)
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Anúncio deixou de estar vendido/arrendado.')
     where listing_id = new.id and status = 'due' and rental_request_id is null;
  end if;
  return new;
end $$;

-- Pedido de aluguer aceite → comissão; cancelado depois de aceite → anula.
create or replace function public.rental_commission_on_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare l public.classified_listings;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select * into l from public.classified_listings where id = new.listing_id;
    if found then perform public.listing_commission_add(l, new.proposed_price, 'rental', new.id); end if;
  elsif old.status = 'accepted' and new.status is distinct from 'accepted' then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Aluguer cancelado.')
     where rental_request_id = new.id and status = 'due';
  end if;
  return new;
end $$;
create trigger rental_commission_on_request after update of status on public.rental_requests
  for each row execute function public.rental_commission_on_request();

-- «Arrendado» também guarda o valor indicado pelo dono.
create or replace function public.set_listing_deal_v2(p_listing_id uuid, p_status text, p_counterpart uuid, p_sale_amount numeric default null)
returns public.classified_listings language plpgsql security definer set search_path = public as $$
declare l public.classified_listings;
begin
  if p_sale_amount is not null and p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if p_status in ('sold', 'rented') then update public.classified_listings set sale_amount = p_sale_amount where id = l.id; end if;
  return public.set_listing_deal(p_listing_id, p_status, p_counterpart);
end $$;

revoke all on function public.listing_commission_add(public.classified_listings, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.rental_commission_on_request() from public, anon, authenticated;
