-- 🚚 Regras de entrega de cada vendedor (lojas, empresas, anunciantes), no Site e na APP.
-- Cada vendedor escolhe: levantamento no local (onde), entrega (sim/não), preço por município, preço para os outros
-- municípios (ou «só entrego nos municípios da lista»), entrega grátis a partir de um valor, valor mínimo para entregar,
-- prazo e uma nota. O carrinho calcula a taxa por vendedor conforme o município do comprador; a encomenda guarda-a.
-- Vendedores sem regras continuam como antes: levantamento e entrega a combinar (taxa 0).

create table public.seller_delivery_settings (
  seller_id uuid primary key references auth.users(id) on delete cascade,
  pickup_enabled boolean not null default true,
  pickup_place text check (pickup_place is null or char_length(pickup_place) <= 300),
  delivery_enabled boolean not null default false,
  default_fee numeric check (default_fee is null or (default_fee >= 0 and default_fee <= 10000000)),
  free_over numeric check (free_over is null or (free_over > 0 and free_over <= 1000000000)),
  min_order numeric check (min_order is null or (min_order > 0 and min_order <= 1000000000)),
  delivery_days text check (delivery_days is null or char_length(delivery_days) <= 120),
  note text check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  check (pickup_enabled or delivery_enabled)
);
alter table public.seller_delivery_settings enable row level security;
create policy seller_delivery_settings_read on public.seller_delivery_settings for select to anon, authenticated using (true);
create policy seller_delivery_settings_own on public.seller_delivery_settings for all to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
grant select on public.seller_delivery_settings to anon, authenticated;
grant insert, update, delete on public.seller_delivery_settings to authenticated;

create table public.seller_delivery_zones (
  seller_id uuid not null references auth.users(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  fee numeric not null check (fee >= 0 and fee <= 10000000),
  primary key (seller_id, municipality_id)
);
alter table public.seller_delivery_zones enable row level security;
create policy seller_delivery_zones_read on public.seller_delivery_zones for select to anon, authenticated using (true);
create policy seller_delivery_zones_own on public.seller_delivery_zones for all to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
grant select on public.seller_delivery_zones to anon, authenticated;
grant insert, update, delete on public.seller_delivery_zones to authenticated;

alter table public.orders add column if not exists delivery_municipality_id uuid references public.municipalities(id) on delete set null;

-- Quanto custa a entrega deste vendedor para este município e este valor de compra.
-- result: configured, pickup, delivery, fee, free, reason (no_delivery | min_order | area | needs_area), min_order, free_over, missing_for_free…
create or replace function public.seller_delivery_quote(p_seller_id uuid, p_municipality_id uuid default null, p_subtotal numeric default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.seller_delivery_settings; zfee numeric; fee numeric; sub numeric := greatest(coalesce(p_subtotal, 0), 0); reason text;
begin
  select * into s from public.seller_delivery_settings where seller_id = p_seller_id;
  if not found then
    return jsonb_build_object('configured', false, 'pickup', true, 'delivery', true, 'fee', 0, 'free', false, 'reason', null);
  end if;
  if p_municipality_id is not null then select z.fee into zfee from public.seller_delivery_zones z where z.seller_id = s.seller_id and z.municipality_id = p_municipality_id; end if;
  fee := coalesce(zfee, s.default_fee);
  reason := case
    when not s.delivery_enabled then 'no_delivery'
    when s.min_order is not null and sub < s.min_order then 'min_order'
    when p_municipality_id is null then 'needs_area'
    when fee is null then 'area' end;
  if reason is null and s.free_over is not null and sub >= s.free_over then fee := 0; end if;
  return jsonb_build_object('configured', true, 'pickup', s.pickup_enabled, 'pickup_place', s.pickup_place,
    'delivery', reason is null, 'fee', case when reason is null then fee end, 'free', reason is null and fee = 0,
    'reason', reason, 'min_order', s.min_order, 'free_over', s.free_over,
    'missing_for_free', case when s.delivery_enabled and s.free_over is not null and sub < s.free_over then s.free_over - sub end,
    'delivery_days', s.delivery_days, 'note', s.note);
end $$;

-- Regras públicas de um vendedor (página do produto, do anúncio e do vendedor).
create or replace function public.seller_delivery_policy(p_seller_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when s.seller_id is null then null else jsonb_build_object(
    'pickup_enabled', s.pickup_enabled, 'pickup_place', s.pickup_place, 'delivery_enabled', s.delivery_enabled, 'default_fee', s.default_fee,
    'free_over', s.free_over, 'min_order', s.min_order, 'delivery_days', s.delivery_days, 'note', s.note,
    'zones', (select coalesce(jsonb_agg(jsonb_build_object('municipality_id', z.municipality_id, 'municipality_name', m.name, 'fee', z.fee) order by m.name), '[]')
      from public.seller_delivery_zones z join public.municipalities m on m.id = z.municipality_id where z.seller_id = s.seller_id)) end
  from (select 1) one left join public.seller_delivery_settings s on s.seller_id = p_seller_id
$$;

-- Carrinho: para cada vendedor, o subtotal e as opções de entrega para o município escolhido.
create or replace function public.cart_delivery_quote(p_municipality_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('seller_id', x.seller_id, 'seller_name', x.seller_name, 'subtotal', x.sub,
    'quote', public.seller_delivery_quote(x.seller_id, p_municipality_id, x.sub)) order by x.seller_name), '[]')
  from (select p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor') seller_name, sum(p.price * ci.quantity) sub
        from public.carts c join public.cart_items ci on ci.cart_id = c.id and ci.ordered_at is null join public.products p on p.id = ci.product_id
        left join public.profiles pr on pr.id = p.seller_id
        where c.user_id = auth.uid() group by p.seller_id, pr.full_name) x
$$;

-- Fazer a encomenda com a escolha de cada vendedor: p_choices = {"<seller_id>": "pickup" | "delivery"}.
create or replace function public.place_orders_v3(p_choices jsonb, p_payment_method text, p_contact_phone text, p_municipality_id uuid default null,
  p_delivery_text text default null, p_note text default null, p_protected boolean default false)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric; choice text; q jsonb; fee numeric; st public.platform_settings;
  pay text := case when coalesce(p_protected, false) then 'reference' else p_payment_method end;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if pay not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_choices is null or jsonb_typeof(p_choices) <> 'object' then raise exception 'INVALID_FULFILLMENT'; end if;
  if coalesce(p_protected, false) then
    select * into st from public.platform_settings where id = 1;
    if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid and ordered_at is null) then raise exception 'CART_EMPTY'; end if;
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid and ci.ordered_at is null for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and ci.ordered_at is null and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null loop
    choice := p_choices ->> s.seller_id::text;
    if choice is null or choice not in ('pickup', 'delivery') then raise exception 'FULFILLMENT_REQUIRED'; end if;
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    q := public.seller_delivery_quote(s.seller_id, p_municipality_id, sub);
    if choice = 'pickup' then
      if not (q->>'pickup')::boolean then raise exception 'SELLER_NO_PICKUP'; end if;
      fee := 0;
    else
      if nullif(trim(coalesce(p_delivery_text, '')), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
      if not (q->>'delivery')::boolean then
        raise exception '%', case q->>'reason' when 'no_delivery' then 'SELLER_NO_DELIVERY' when 'min_order' then 'DELIVERY_BELOW_MINIMUM'
          when 'needs_area' then 'DELIVERY_AREA_REQUIRED' else 'DELIVERY_AREA_NOT_COVERED' end;
      end if;
      fee := coalesce((q->>'fee')::numeric, 0);
    end if;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, delivery_municipality_id, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, fee, sub + fee, 'unpaid', pay,
      choice, 'pending', trim(p_contact_phone), case when choice = 'delivery' then nullif(trim(p_delivery_text), '') end,
      case when choice = 'delivery' then p_municipality_id end, nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.ordered_at is null and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || (sub + fee) || ' Kz'
      || case when choice = 'pickup' then ' (levantamento no local).' when fee > 0 then ' (inclui entrega: ' || fee || ' Kz).' else ' (entrega grátis).' end
      || case when coalesce(p_protected, false) then ' 🛡️ Pagamento protegido: espere pelo aviso «Pagamento recebido» antes de enviar.' else '' end,
      jsonb_build_object('order_id', oid) || case when coalesce(p_protected, false) then jsonb_build_object('for', 'sale') else '{}'::jsonb end);
    ids := ids || oid;
  end loop;
  update public.cart_items set ordered_at = now() where cart_id = cid and ordered_at is null;
  if coalesce(p_protected, false) then
    update public.orders set protected = true, escrow_status = 'awaiting_payment',
      pay_by = now() + make_interval(hours => st.payment_window_hours), updated_at = now()
     where id = any(ids);
  end if;
  return ids;
end $$;

revoke all on function public.seller_delivery_quote(uuid, uuid, numeric) from public;
grant execute on function public.seller_delivery_quote(uuid, uuid, numeric) to anon, authenticated;
revoke all on function public.seller_delivery_policy(uuid) from public;
grant execute on function public.seller_delivery_policy(uuid) to anon, authenticated;
revoke all on function public.cart_delivery_quote(uuid) from public, anon;
grant execute on function public.cart_delivery_quote(uuid) to authenticated;
revoke all on function public.place_orders_v3(jsonb, text, text, uuid, text, text, boolean) from public, anon;
grant execute on function public.place_orders_v3(jsonb, text, text, uuid, text, text, boolean) to authenticated;

-- As minhas encomendas com o subtotal, a taxa de entrega e o município da entrega.
create or replace function public.my_orders_v4(p_role text)
returns table(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text,
  created_at timestamptz, updated_at timestamptz, completed_at timestamptz, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text,
  contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text, pay_by timestamptz,
  paid_at timestamptz, delivered_at timestamptz, release_at timestamptz, released_at timestamptz, platform_fee numeric, payment jsonb,
  subtotal numeric, delivery_fee numeric, delivery_municipality_name text)
language sql stable security definer set search_path = public as $$
  select v.*, o.subtotal, o.delivery_fee, m.name
  from public.my_orders_v3(p_role) v join public.orders o on o.id = v.id left join public.municipalities m on m.id = o.delivery_municipality_id
$$;
revoke all on function public.my_orders_v4(text) from public, anon;
grant execute on function public.my_orders_v4(text) to authenticated;
