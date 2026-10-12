-- 1) Lojas: mesmo critério das empresas — 1 mês grátis, depois mensalidade (5 000 Kz, a administração pode mudar).
--    A Loja de cada vendedor começa o mês grátis no 1.º produto sem empresa. Produtos de uma empresa ficam
--    cobertos pela mensalidade dessa empresa (não paga duas vezes). Sem pagamento, os produtos deixam de
--    aparecer e não se podem pôr no carrinho nem encomendar.
-- 2) Anúncios: comissão de 5% do valor da venda, depois de vendido (anúncio marcado «vendido» ou leilão
--    ganho). Paga-se em 7 dias; com comissões em atraso não se publicam anúncios novos.

alter table public.platform_settings add column if not exists store_monthly_kz numeric not null default 5000 check (store_monthly_kz >= 0);
alter table public.platform_settings add column if not exists listing_commission_pct numeric not null default 5 check (listing_commission_pct between 0 and 50);
alter table public.platform_settings add column if not exists commission_due_days integer not null default 7 check (commission_due_days between 1 and 90);
grant update (store_monthly_kz, listing_commission_pct, commission_due_days) on public.platform_settings to authenticated;

-- 1) Mensalidade das Lojas ------------------------------------------------------------------
alter table public.subscriptions add column if not exists seller_id uuid;
alter table public.subscriptions drop constraint if exists subscriptions_check;
alter table public.subscriptions drop constraint if exists subscriptions_kind_check;
alter table public.subscriptions add constraint subscriptions_kind_check check (kind in ('provider', 'business', 'store'));
alter table public.subscriptions add constraint subscriptions_subject_check check (num_nonnulls(provider_id, business_id, seller_id) = 1
  and (kind = 'provider') = (provider_id is not null) and (kind = 'business') = (business_id is not null) and (kind = 'store') = (seller_id is not null));
create unique index if not exists subscriptions_store on public.subscriptions(seller_id) where seller_id is not null;

create or replace function public.store_paid_up(p_seller uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.subscription_active_until(s) > now() from public.subscriptions s where s.seller_id = p_seller limit 1), true);
$$;
create or replace function public.product_paid_up(p_seller uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_business is not null then public.subject_paid_up(null, p_business) else public.store_paid_up(p_seller) end;
$$;
grant execute on function public.store_paid_up(uuid) to anon, authenticated;
grant execute on function public.product_paid_up(uuid, uuid) to anon, authenticated;

create or replace function public.store_subscription_start() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_days integer := coalesce((select trial_days from public.platform_settings where id = 1), 30);
begin
  if new.business_id is null then
    insert into public.subscriptions(kind, owner_id, seller_id, trial_ends_at) values ('store', new.seller_id, new.seller_id, now() + make_interval(days => v_days))
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger trg_store_subscription_start after insert or update of business_id on public.products for each row execute function public.store_subscription_start();
revoke all on function public.store_subscription_start() from public, anon, authenticated;
insert into public.subscriptions(kind, owner_id, seller_id, trial_ends_at)
select distinct 'store', seller_id, seller_id, now() + interval '30 days' from public.products where business_id is null and seller_id is not null on conflict do nothing;

-- Produtos: o público só vê os de Lojas/empresas em dia; o vendedor e a administração veem sempre.
alter policy products_public_read on public.products using (active = true and public.product_paid_up(seller_id, business_id));
create policy products_owner_admin_read on public.products for select to authenticated using (seller_id = (select auth.uid()) or (select public.has_admin_role()));

create or replace function public.product_catalog(p_query text default '', p_category_id uuid default null, p_municipality_id uuid default null, p_seller_id uuid default null, p_limit integer default 40)
returns table(id uuid, seller_id uuid, seller_name text, business_id uuid, business_name text, name text, description text, category_id uuid, category_name text,
  price numeric, currency text, stock integer, media jsonb, municipality_id uuid, municipality_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'), p.business_id, b.name, p.name, p.description,
         p.category_id, c.name, p.price, p.currency, p.stock, p.media, p.municipality_id, m.name, p.created_at
  from public.products p
  left join public.profiles pr on pr.id = p.seller_id
  left join public.businesses b on b.id = p.business_id
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  where p.active and coalesce(pr.status, 'active') = 'active' and public.product_paid_up(p.seller_id, p.business_id)
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (p_seller_id is null or p.seller_id = p_seller_id)
    and (coalesce(p_query, '') = '' or lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(p_query) || '%')
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

-- Carrinho e encomendas só de Lojas/empresas em dia.
create or replace function public.guard_store_paid_up() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.products;
begin
  -- só verifica quando entra um produto novo ou a quantidade sobe
  if tg_op = 'UPDATE' and new.product_id = old.product_id and new.quantity <= old.quantity then return new; end if;
  select * into p from public.products where id = new.product_id;
  if found and not public.product_paid_up(p.seller_id, p.business_id) then raise exception 'STORE_UNAVAILABLE'; end if;
  return new;
end $$;
create trigger trg_cart_store_paid_up before insert or update on public.cart_items for each row execute function public.guard_store_paid_up();
create trigger trg_order_store_paid_up before insert on public.order_items for each row execute function public.guard_store_paid_up();
revoke all on function public.guard_store_paid_up() from public, anon, authenticated;

-- Funções dos planos, agora com a Loja.
create or replace function public.plan_subject_name(s public.subscriptions) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(case s.kind when 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = s.provider_id)
                              when 'business' then (select b.name from public.businesses b where b.id = s.business_id)
                              else 'A minha Loja' end, 'Perfil apagado');
$$;
create or replace function public.plan_subject_exists(s public.subscriptions) returns boolean
language sql stable security definer set search_path = public as $$
  select case s.kind when 'provider' then exists (select 1 from public.provider_profiles pp where pp.user_id = s.provider_id)
                     when 'business' then exists (select 1 from public.businesses b where b.id = s.business_id)
                     else exists (select 1 from public.products p where p.seller_id = s.seller_id and p.business_id is null) end;
$$;
create or replace function public.plan_monthly_price(p_kind text) returns numeric
language sql stable security definer set search_path = public as $$
  select case p_kind when 'provider' then provider_monthly_kz when 'business' then business_monthly_kz else store_monthly_kz end from public.platform_settings where id = 1;
$$;
revoke all on function public.plan_subject_name(public.subscriptions) from public, anon, authenticated;
revoke all on function public.plan_subject_exists(public.subscriptions) from public, anon, authenticated;
grant execute on function public.plan_monthly_price(text) to anon, authenticated;

create or replace function public.my_subscriptions()
returns table(id uuid, kind text, subject_id uuid, name text, trial_ends_at timestamptz, paid_until timestamptz, active_until timestamptz,
  state text, monthly_price numeric, pending_payment_id uuid, pending_amount numeric, last_rejected_note text)
language sql stable security definer set search_path = public as $$
  select s.id, s.kind, coalesce(s.provider_id, s.business_id, s.seller_id), public.plan_subject_name(s),
    s.trial_ends_at, s.paid_until, public.subscription_active_until(s),
    case when public.subscription_active_until(s) <= now() then 'expired'
         when s.paid_until is not null and s.paid_until > now() then case when s.paid_until < now() + interval '7 days' then 'expiring' else 'paid' end
         when s.trial_ends_at < now() + interval '7 days' then 'trial_ending' else 'trial' end,
    public.plan_monthly_price(s.kind), p.id, p.amount,
    (select r.admin_note from public.subscription_payments r where r.subscription_id = s.id and r.status = 'rejected' order by r.decided_at desc limit 1)
  from public.subscriptions s
  left join public.subscription_payments p on p.subscription_id = s.id and p.status = 'pending'
  where s.owner_id = auth.uid() and public.plan_subject_exists(s)
  order by case s.kind when 'provider' then 0 when 'store' then 1 else 2 end, s.created_at;
$$;

create or replace function public.submit_subscription_payment(p_subscription_id uuid, p_months integer, p_method text, p_reference text default null, p_proof_path text default null)
returns public.subscription_payments language plpgsql security definer set search_path = public as $$
declare s public.subscriptions; pay public.subscription_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p_subscription_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if p_months is null or p_months not between 1 and 12 then raise exception 'INVALID_MONTHS'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.subscription_payments where subscription_id = s.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.subscription_payments(subscription_id, owner_id, months, amount, method, reference, proof_path)
  values (s.id, auth.uid(), p_months, p_months * public.plan_monthly_price(s.kind), p_method, ref, p_proof_path)
  returning * into pay;
  perform public.notify_staff('Pagamento de mensalidade para confirmar', pay.amount || ' Kz · ' || p_months || ' mês(es)', jsonb_build_object('payment_id', pay.id));
  return pay;
end $$;

create or replace function public.admin_list_subscription_payments(p_status text default 'pending')
returns table(id uuid, subscription_id uuid, kind text, subject_id uuid, subject_name text, owner_id uuid, owner_name text, phone text,
  months integer, amount numeric, method text, reference text, proof_path text, status text, admin_note text, created_at timestamptz, active_until timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, s.id, s.kind, coalesce(s.provider_id, s.business_id, s.seller_id), public.plan_subject_name(s),
    p.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone,
    p.months, p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at, public.subscription_active_until(s)
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
  left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status
  order by (p.status = 'pending') desc, p.created_at limit 200;
end $$;

-- 2) Comissões dos anúncios vendidos ------------------------------------------------------------
alter table public.classified_listings add column if not exists sale_amount numeric check (sale_amount is null or sale_amount >= 0);

create table if not exists public.listing_commissions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.classified_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  listing_title text not null,
  listed_price numeric,
  sale_amount numeric not null check (sale_amount >= 0),
  rate_pct numeric not null check (rate_pct between 0 and 50),
  amount numeric not null check (amount >= 0),
  source text not null check (source in ('sold', 'auction', 'offer')),
  status text not null default 'due' check (status in ('due', 'submitted', 'paid', 'waived', 'cancelled')),
  due_at timestamptz not null,
  method text check (method is null or method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'),
  submitted_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  last_reminder text,
  created_at timestamptz not null default now()
);
create unique index if not exists listing_commissions_one_open on public.listing_commissions(listing_id) where status <> 'cancelled';
create index if not exists listing_commissions_owner on public.listing_commissions(owner_id, status, due_at);
create index if not exists listing_commissions_status on public.listing_commissions(status, created_at);
alter table public.listing_commissions enable row level security;
create policy listing_commissions_own_read on public.listing_commissions for select to authenticated using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.listing_commissions from anon, authenticated;
grant select on public.listing_commissions to authenticated;

-- Valor da venda: o que o vendedor indicou, senão a proposta aceite do comprador, senão o preço do anúncio.
create or replace function public.listing_commission_on_sale() returns trigger
language plpgsql security definer set search_path = public as $$
declare st public.platform_settings; amt numeric; src text := 'sold'; offer_amt numeric;
begin
  if new.status = 'sold' and old.status is distinct from 'sold' and new.purpose in ('sale', 'auction') then
    select * into st from public.platform_settings where id = 1;
    if new.deal_with is not null then
      select o.amount into offer_amt from public.listing_offers o where o.listing_id = new.id and o.buyer_id = new.deal_with and o.status = 'accepted' and o.amount is not null
       order by o.responded_at desc nulls last limit 1;
    end if;
    amt := coalesce(new.sale_amount, offer_amt, new.price);
    if new.sale_amount is null and offer_amt is not null then src := 'offer'; end if;
    if new.purpose = 'auction' then src := 'auction'; end if;
    if amt is not null and amt > 0 and st.listing_commission_pct > 0 then
      insert into public.listing_commissions(listing_id, owner_id, listing_title, listed_price, sale_amount, rate_pct, amount, source, due_at)
      values (new.id, new.owner_id, new.title, new.price, amt, st.listing_commission_pct, round(amt * st.listing_commission_pct / 100), src, now() + make_interval(days => st.commission_due_days))
      on conflict do nothing;
      insert into public.notifications(user_id, type, title, body, data)
      values (new.owner_id, 'system', 'Venda registada: comissão de ' || st.listing_commission_pct || '%',
              '«' || new.title || '» vendido por ' || amt || ' Kz. Comissão a pagar: ' || round(amt * st.listing_commission_pct / 100) || ' Kz até ' || to_char((now() + make_interval(days => st.commission_due_days)) at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.',
              jsonb_build_object('listing_id', new.id, 'for', 'commission'));
    end if;
  elsif old.status = 'sold' and new.status is distinct from 'sold' then
    -- marcado como vendido por engano: anula a comissão ainda não paga
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Anúncio deixou de estar vendido.')
     where listing_id = new.id and status = 'due';
  end if;
  return new;
end $$;
create trigger trg_listing_commission_on_sale after update of status on public.classified_listings for each row execute function public.listing_commission_on_sale();
revoke all on function public.listing_commission_on_sale() from public, anon, authenticated;

-- Leilão ganho (ou «Comprar já») → o anúncio fica vendido com o preço final.
create or replace function public.auction_mark_listing_sold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ended' and old.status is distinct from 'ended' and new.winner_id is not null and new.classified_listing_id is not null then
    update public.classified_listings set sale_amount = new.current_price, deal_with = coalesce(deal_with, new.winner_id), deal_at = coalesce(deal_at, now()), status = 'sold'
     where id = new.classified_listing_id and status <> 'sold';
  end if;
  return new;
end $$;
create trigger trg_auction_mark_listing_sold after update of status on public.auctions for each row execute function public.auction_mark_listing_sold();
revoke all on function public.auction_mark_listing_sold() from public, anon, authenticated;

-- Marcar vendido com o valor da venda (usa a função de negócio que já existe).
create or replace function public.set_listing_deal_v2(p_listing_id uuid, p_status text, p_counterpart uuid, p_sale_amount numeric default null)
returns public.classified_listings language plpgsql security definer set search_path = public as $$
declare l public.classified_listings;
begin
  if p_sale_amount is not null and p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if p_status = 'sold' then update public.classified_listings set sale_amount = p_sale_amount where id = l.id; end if;
  return public.set_listing_deal(p_listing_id, p_status, p_counterpart);
end $$;
revoke all on function public.set_listing_deal_v2(uuid, text, uuid, numeric) from public, anon;
grant execute on function public.set_listing_deal_v2(uuid, text, uuid, numeric) to authenticated;

-- Com comissões em atraso, não se publicam anúncios novos.
create or replace function public.guard_commission_overdue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' and not public.has_admin_role()
     and exists (select 1 from public.listing_commissions c where c.owner_id = new.owner_id and c.status = 'due' and c.due_at < now()) then
    raise exception 'COMMISSION_OVERDUE';
  end if;
  return new;
end $$;
create trigger trg_guard_commission_overdue before update of status on public.classified_listings for each row execute function public.guard_commission_overdue();
revoke all on function public.guard_commission_overdue() from public, anon, authenticated;

create or replace function public.my_commissions()
returns table(id uuid, listing_id uuid, listing_title text, listed_price numeric, sale_amount numeric, rate_pct numeric, amount numeric, source text,
  status text, due_at timestamptz, overdue boolean, reference text, admin_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.listing_id, c.listing_title, c.listed_price, c.sale_amount, c.rate_pct, c.amount, c.source, c.status, c.due_at,
    c.status = 'due' and c.due_at < now(), c.reference, c.admin_note, c.created_at
  from public.listing_commissions c where c.owner_id = auth.uid() and c.status <> 'cancelled'
  order by (c.status = 'due') desc, c.due_at, c.created_at desc limit 200;
$$;

create or replace function public.submit_commission_payment(p_ids uuid[], p_method text, p_reference text default null, p_proof_path text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare ref text := nullif(left(trim(coalesce(p_reference, '')), 120), ''); n integer; total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  update public.listing_commissions set status = 'submitted', method = p_method, reference = ref, proof_path = p_proof_path, submitted_at = now(), admin_note = null
   where id = any(coalesce(p_ids, '{}')) and owner_id = auth.uid() and status = 'due';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOTHING_TO_PAY'; end if;
  select sum(amount) into total from public.listing_commissions where id = any(p_ids) and owner_id = auth.uid() and status = 'submitted';
  perform public.notify_staff('Pagamento de comissões para confirmar', total || ' Kz · ' || n || ' venda(s)', jsonb_build_object('commission_ids', to_jsonb(p_ids), 'payment_id', p_ids[1]));
  return n;
end $$;

create or replace function public.admin_list_commissions(p_status text default 'submitted')
returns table(id uuid, listing_id uuid, listing_title text, owner_id uuid, owner_name text, phone text, listed_price numeric, sale_amount numeric, rate_pct numeric,
  amount numeric, source text, status text, due_at timestamptz, method text, reference text, proof_path text, admin_note text, submitted_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.listing_id, c.listing_title, c.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone, c.listed_price, c.sale_amount, c.rate_pct,
    c.amount, c.source, c.status, c.due_at, c.method, c.reference, c.proof_path, c.admin_note, c.submitted_at, c.created_at
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where p_status is null or c.status = p_status or (p_status = 'overdue' and c.status = 'due' and c.due_at < now())
  order by (c.status = 'submitted') desc, c.due_at limit 300;
end $$;

-- confirm / reject (volta a «por pagar») / waive (perdoar) / adjust (corrigir o valor da venda)
create or replace function public.admin_update_commission(p_id uuid, p_action text, p_note text default null, p_sale_amount numeric default null)
returns public.listing_commissions language plpgsql security definer set search_path = public as $$
declare c public.listing_commissions; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into c from public.listing_commissions where id = p_id for update;
  if not found then raise exception 'COMMISSION_NOT_FOUND'; end if;
  if p_action = 'confirm' and c.status in ('submitted', 'due') then
    update public.listing_commissions set status = 'paid', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'reject' and c.status = 'submitted' then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_commissions set status = 'due', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'waive' and c.status in ('due', 'submitted') then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_commissions set status = 'waived', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'adjust' and c.status in ('due', 'submitted') then
    if p_sale_amount is null or p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
    update public.listing_commissions set sale_amount = p_sale_amount, amount = round(p_sale_amount * rate_pct / 100), admin_note = coalesce(txt, admin_note)
     where id = c.id returning * into c;
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'commission_' || p_action, 'classified_listing', c.listing_id, jsonb_build_object('commission_id', c.id, 'amount', c.amount, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (c.owner_id, 'system',
    case p_action when 'confirm' then 'Comissão paga ✔' when 'reject' then 'Pagamento da comissão não confirmado' when 'waive' then 'Comissão anulada' else 'Comissão corrigida' end,
    '«' || c.listing_title || '»: ' || case p_action when 'confirm' then 'pagamento de ' || c.amount || ' Kz confirmado.' when 'adjust' then 'nova comissão ' || c.amount || ' Kz.' else coalesce(txt, '') end,
    jsonb_build_object('listing_id', c.listing_id, 'for', 'commission'));
  return c;
end $$;

-- Lembretes diários: mensalidades (com a Loja) e comissões (2 dias antes do prazo e quando passa).
create or replace function public.subscription_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare s record; c record; tag text; n integer := 0; ends timestamptz; title text; body text; price numeric;
begin
  for s in select x.*, public.subscription_active_until(x) as until, public.plan_subject_name(x) as name
    from public.subscriptions x where public.plan_subject_exists(x) loop
    ends := s.until;
    tag := case when ends <= now() then 'end' when ends <= now() + interval '1 day' then 'd1' when ends <= now() + interval '7 days' then 'd7' end;
    continue when tag is null or s.last_reminder = tag || ':' || ends::date;
    continue when tag = 'end' and ends < now() - interval '3 days';
    price := public.plan_monthly_price(s.kind);
    title := case tag when 'end' then case when s.kind = 'store' then 'Os seus produtos deixaram de aparecer' else 'O seu perfil deixou de aparecer' end
                      when 'd1' then 'O seu plano termina amanhã' else 'O seu plano termina em 7 dias' end;
    body := '«' || s.name || '»: ' || case when tag = 'end' then 'pague a mensalidade de ' || price || ' Kz para voltar a aparecer aos clientes.'
                                          else (case when s.paid_until is null then 'o mês grátis' else 'o período pago' end) || ' termina a ' || to_char(ends at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '. Mensalidade: ' || price || ' Kz.' end;
    insert into public.notifications(user_id, type, title, body, data) values (s.owner_id, 'system', title, body, jsonb_build_object('subscription_id', s.id, 'for', 'plan'));
    update public.subscriptions set last_reminder = tag || ':' || ends::date where id = s.id;
    n := n + 1;
  end loop;
  for c in select * from public.listing_commissions where status = 'due' loop
    tag := case when c.due_at <= now() then 'late' when c.due_at <= now() + interval '2 days' then 'd2' end;
    continue when tag is null or c.last_reminder = tag;
    insert into public.notifications(user_id, type, title, body, data)
    values (c.owner_id, 'system', case tag when 'late' then 'Comissão em atraso' else 'Comissão a pagar em 2 dias' end,
            '«' || c.listing_title || '»: ' || c.amount || ' Kz.' || case when tag = 'late' then ' Enquanto não pagar, não pode publicar anúncios novos.' else '' end,
            jsonb_build_object('listing_id', c.listing_id, 'for', 'commission'));
    update public.listing_commissions set last_reminder = tag where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.my_commissions() from public, anon;
revoke all on function public.submit_commission_payment(uuid[], text, text, text) from public, anon;
revoke all on function public.admin_list_commissions(text) from public, anon;
revoke all on function public.admin_update_commission(uuid, text, text, numeric) from public, anon;
grant execute on function public.my_commissions() to authenticated;
grant execute on function public.submit_commission_payment(uuid[], text, text, text) to authenticated;
grant execute on function public.admin_list_commissions(text) to authenticated;
grant execute on function public.admin_update_commission(uuid, text, text, numeric) to authenticated;
