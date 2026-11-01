-- ⛽ Combustível e gás (Site e APP).
-- Postos de combustível e pontos de venda de gás marcam quando há (e o preço e a fila); quem procura vê onde há,
-- pede aviso quando houver, confirma «há / já acabou», reserva (paga no posto) ou paga adiantado e levanta com código.
-- A plataforma cobra uma comissão sobre o que é levantado (o posto paga, como nos eventos).

alter table public.platform_settings add column if not exists fuel_fee_pct numeric not null default 5 check (fuel_fee_pct between 0 and 30);
alter table public.platform_settings add column if not exists fuel_pay_minutes integer not null default 60 check (fuel_pay_minutes between 10 and 1440);

create sequence if not exists public.fuel_stations_ref_no_seq start 1001;
create table public.fuel_stations (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.fuel_stations_ref_no_seq'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 100),
  kind text not null check (kind in ('fuel', 'gas', 'both')),
  municipality_id uuid references public.municipalities(id) on delete set null,
  address text check (address is null or char_length(address) <= 200),
  directions text check (directions is null or char_length(directions) <= 500),
  geo_lat numeric check (geo_lat is null or geo_lat between -18.1 and -4.3),
  geo_lng numeric check (geo_lng is null or geo_lng between 11.6 and 24.1),
  phone text check (phone is null or char_length(phone) <= 20),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 20),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 120),
  accepts_reservations boolean not null default false,
  accepts_prepay boolean not null default false,
  hold_minutes integer not null default 120 check (hold_minutes between 15 and 1440),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((geo_lat is null) = (geo_lng is null))
);
create index fuel_stations_owner on public.fuel_stations(owner_id);
create index fuel_stations_status on public.fuel_stations(status, municipality_id);
alter table public.fuel_stations enable row level security;
create policy fuel_stations_read on public.fuel_stations for select to anon, authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select public.has_admin_role()));
create policy fuel_stations_insert on public.fuel_stations for insert to authenticated with check (owner_id = (select auth.uid()));
create policy fuel_stations_update on public.fuel_stations for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Para onde os clientes pagam adiantado (só o dono vê; quem reservou recebe-os nos seus pedidos).
create table public.fuel_station_pay (
  station_id uuid primary key references public.fuel_stations(id) on delete cascade,
  holder text check (holder is null or char_length(holder) <= 80),
  iban text check (iban is null or char_length(iban) <= 40),
  express text check (express is null or char_length(express) <= 20),
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.fuel_station_pay enable row level security;
create policy fuel_station_pay_owner on public.fuel_station_pay for all to authenticated
  using (exists (select 1 from public.fuel_stations s where s.id = station_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.fuel_stations s where s.id = station_id and s.owner_id = (select auth.uid())));

create table public.fuel_products (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.fuel_stations(id) on delete cascade,
  product text not null check (product in ('gasolina', 'gasoleo', 'petroleo', 'gas_12kg', 'gas_6kg')),
  price numeric check (price is null or price >= 0),
  status text not null default 'unknown' check (status in ('available', 'low', 'out', 'unknown')),
  queue text check (queue is null or queue in ('none', 'short', 'medium', 'long')),
  reservable_qty numeric not null default 0 check (reservable_qty >= 0),
  max_per_order numeric not null default 40 check (max_per_order > 0),
  note text check (note is null or char_length(note) <= 160),
  status_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (station_id, product)
);
alter table public.fuel_products enable row level security;
create policy fuel_products_read on public.fuel_products for select to anon, authenticated
  using (exists (select 1 from public.fuel_stations s where s.id = station_id and (s.status = 'approved' or s.owner_id = (select auth.uid()) or (select public.has_admin_role()))));
create policy fuel_products_owner on public.fuel_products for all to authenticated
  using (exists (select 1 from public.fuel_stations s where s.id = station_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.fuel_stations s where s.id = station_id and s.owner_id = (select auth.uid())));

-- Confirmações de quem passou no posto («há» / «já acabou»).
create table public.fuel_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.fuel_products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  has boolean not null,
  created_at timestamptz not null default now()
);
create index fuel_reports_product on public.fuel_reports(product_id, created_at desc);
create index fuel_reports_user on public.fuel_reports(user_id, created_at desc);
alter table public.fuel_reports enable row level security;
revoke all on public.fuel_reports from anon, authenticated;

-- «Avisar-me quando houver».
create table public.fuel_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('gasolina', 'gasoleo', 'petroleo', 'gas_12kg', 'gas_6kg')),
  municipality_id uuid references public.municipalities(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index fuel_alerts_one on public.fuel_alerts(user_id, product, coalesce(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index fuel_alerts_product on public.fuel_alerts(product, municipality_id);
alter table public.fuel_alerts enable row level security;
create policy fuel_alerts_own on public.fuel_alerts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create sequence if not exists public.fuel_orders_ref_no_seq start 1001;
create table public.fuel_orders (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.fuel_orders_ref_no_seq'),
  station_id uuid not null references public.fuel_stations(id) on delete cascade,
  product_id uuid not null references public.fuel_products(id) on delete cascade,
  product text not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null check (char_length(buyer_name) between 2 and 80),
  buyer_phone text check (buyer_phone is null or char_length(buyer_phone) <= 20),
  plate text check (plate is null or char_length(plate) <= 20),
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  total numeric not null check (total >= 0),
  method text not null check (method in ('at_station', 'prepaid')),
  status text not null check (status in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'collected', 'cancelled', 'expired', 'rejected')),
  code text unique,
  hold_until timestamptz,
  pay_by timestamptz,
  pay_method text check (pay_method is null or pay_method in ('bank_transfer', 'multicaixa_express')),
  reference text check (reference is null or char_length(reference) <= 120),
  note text check (note is null or char_length(note) <= 500),
  fee_pct numeric,
  fee_amount numeric not null default 0,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fuel_orders_station on public.fuel_orders(station_id, status, created_at desc);
create index fuel_orders_buyer on public.fuel_orders(buyer_id, created_at desc);
create index fuel_orders_product on public.fuel_orders(product_id, status);
alter table public.fuel_orders enable row level security;
create policy fuel_orders_read on public.fuel_orders for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role())
    or exists (select 1 from public.fuel_stations s where s.id = station_id and s.owner_id = (select auth.uid())));
revoke insert, update, delete on public.fuel_orders from anon, authenticated;

create sequence if not exists public.fuel_platform_payments_ref_no_seq start 1001;
create table public.fuel_platform_payments (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.fuel_platform_payments_ref_no_seq'),
  station_id uuid not null references public.fuel_stations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  method text not null check (method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index fuel_platform_payments_one_pending on public.fuel_platform_payments(station_id) where status = 'pending';
alter table public.fuel_platform_payments enable row level security;
create policy fuel_platform_payments_read on public.fuel_platform_payments for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke insert, update, delete on public.fuel_platform_payments from anon, authenticated;

-- Proteções do posto: só a administração aprova/suspende; o dono não muda de dono.
create or replace function public.guard_fuel_station() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.has_admin_role() then new.status := 'pending'; new.admin_note := null; end if;
    if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if (select count(*) from public.fuel_stations where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_STATIONS'; end if;
  else
    if new.owner_id <> old.owner_id then raise exception 'NOT_ALLOWED'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note) and not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger trg_guard_fuel_station before insert or update on public.fuel_stations for each row execute function public.guard_fuel_station();

create or replace function public.fuel_product_label(p text) returns text language sql immutable as $$
  select case p when 'gasolina' then 'Gasolina' when 'gasoleo' then 'Gasóleo' when 'petroleo' then 'Petróleo'
    when 'gas_12kg' then 'Gás (botija 12 kg)' when 'gas_6kg' then 'Gás (botija 6 kg)' else p end
$$;

-- Quando o posto marca «há» (ou «a acabar») depois de não haver: avisa quem pediu aviso nesse município (no máximo 1 aviso por posto e produto a cada 2 horas).
create or replace function public.fuel_product_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.fuel_stations;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  if tg_op = 'UPDATE' and (new.status, new.price, new.queue, new.reservable_qty, new.note, new.max_per_order) is not distinct from (old.status, old.price, old.queue, old.reservable_qty, old.note, old.max_per_order) then return new; end if;
  new.updated_at := now();
  if new.status in ('available', 'low') and (tg_op = 'INSERT' or old.status in ('out', 'unknown')) then
    select * into s from public.fuel_stations where id = new.station_id;
    if s.status = 'approved' and not exists (select 1 from public.notifications n where n.data->>'for' = 'fuel' and n.data->>'product_id' = new.id::text and n.created_at > now() - interval '2 hours') then
      insert into public.notifications(user_id, type, title, body, data)
      select distinct a.user_id, 'system', '⛽ Há ' || lower(public.fuel_product_label(new.product)) || '!',
        s.name || coalesce(' · ' || (select m.name from public.municipalities m where m.id = s.municipality_id), '') || case when new.price is not null then ' · ' || new.price || ' Kz' else '' end,
        jsonb_build_object('for', 'fuel', 'station_id', s.id, 'product_id', new.id)
      from public.fuel_alerts a
      where a.product = new.product and (a.municipality_id is null or a.municipality_id = s.municipality_id) and a.user_id <> s.owner_id
      limit 5000;
    end if;
  end if;
  return new;
end $$;
create trigger trg_fuel_product_changed before insert or update on public.fuel_products for each row execute function public.fuel_product_changed();

-- Quantidade ainda disponível para reservas.
create or replace function public.fuel_reserved_qty(p_product uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity), 0) from public.fuel_orders where product_id = p_product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')
$$;
create or replace function public.fuel_fee_due(p_station uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected'), 0)
    - coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0))
$$;
-- Comissão em atraso: comissões de levantamentos com mais de 7 dias ainda por pagar.
create or replace function public.fuel_fees_overdue(p_station uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected' and collected_at < now() - interval '7 days'), 0)
    > coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0)
$$;

create or replace function public.new_fuel_code() returns text
language plpgsql set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'CB-';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.fuel_orders where code = c);
  end loop;
  return c;
end $$;

-- Lista pública: onde há (os que têm primeiro), com confirmações das últimas 2 horas.
create or replace function public.fuel_feed(p_product text default null, p_municipality uuid default null, p_station uuid default null, p_limit integer default 100)
returns table (product_id uuid, station_id uuid, station_ref bigint, station_name text, kind text, municipality_name text, address text, directions text,
  geo_lat numeric, geo_lng numeric, phone text, whatsapp text, opening_hours text, product text, price numeric, status text, queue text, note text,
  status_at timestamptz, updated_at timestamptz, reservable_left numeric, max_per_order numeric, accepts_reservations boolean, accepts_prepay boolean,
  hold_minutes integer, yes_2h bigint, no_2h bigint, last_report_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, s.id, s.ref_no, s.name, s.kind, m.name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone, s.whatsapp, s.opening_hours,
    p.product, p.price, p.status, p.queue, p.note, p.status_at, p.updated_at,
    greatest(0, p.reservable_qty - public.fuel_reserved_qty(p.id)), p.max_per_order,
    s.accepts_reservations and not public.fuel_fees_overdue(s.id), s.accepts_prepay and exists (select 1 from public.fuel_station_pay x where x.station_id = s.id and (x.iban is not null or x.express is not null)),
    s.hold_minutes,
    (select count(*) from public.fuel_reports r where r.product_id = p.id and r.has and r.created_at > now() - interval '2 hours'),
    (select count(*) from public.fuel_reports r where r.product_id = p.id and not r.has and r.created_at > now() - interval '2 hours'),
    (select max(r.created_at) from public.fuel_reports r where r.product_id = p.id)
  from public.fuel_products p join public.fuel_stations s on s.id = p.station_id left join public.municipalities m on m.id = s.municipality_id
  where s.status = 'approved'
    and (p_product is null or p.product = p_product)
    and (p_municipality is null or s.municipality_id = p_municipality)
    and (p_station is null or s.id = p_station)
  order by case p.status when 'available' then 0 when 'low' then 1 when 'unknown' then 2 else 3 end, p.status_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$$;

-- «Há» / «Já acabou» de quem passou no posto (1 por produto a cada 30 minutos; até 20 por dia).
create or replace function public.report_fuel(p_product_id uuid, p_has boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not exists (select 1 from public.fuel_products p join public.fuel_stations s on s.id = p.station_id where p.id = p_product_id and s.status = 'approved') then raise exception 'FUEL_NOT_FOUND'; end if;
  if exists (select 1 from public.fuel_reports where product_id = p_product_id and user_id = me and created_at > now() - interval '30 minutes') then raise exception 'FUEL_REPORT_TOO_SOON'; end if;
  if (select count(*) from public.fuel_reports where user_id = me and created_at > now() - interval '1 day') >= 20 then raise exception 'TOO_MANY_REQUESTS'; end if;
  insert into public.fuel_reports(product_id, user_id, has) values (p_product_id, me, p_has);
end $$;

-- Reservar (pagar no posto) ou comprar adiantado.
create or replace function public.reserve_fuel(p_product_id uuid, p_quantity numeric, p_method text, p_name text, p_phone text default null, p_plate text default null)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.fuel_products; s public.fuel_stations; st public.platform_settings; o public.fuel_orders; left_ numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into p from public.fuel_products where id = p_product_id for update;
  if not found then raise exception 'FUEL_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = p.station_id;
  if s.status <> 'approved' then raise exception 'FUEL_NOT_FOUND'; end if;
  if s.owner_id = me then raise exception 'CANNOT_BUY_OWN'; end if;
  if p_method not in ('at_station', 'prepaid') then raise exception 'INVALID_METHOD'; end if;
  if not s.accepts_reservations or public.fuel_fees_overdue(s.id) then raise exception 'FUEL_NO_RESERVATIONS'; end if;
  if p_method = 'prepaid' and (not s.accepts_prepay or not exists (select 1 from public.fuel_station_pay x where x.station_id = s.id and (x.iban is not null or x.express is not null))) then raise exception 'FUEL_NO_PREPAY'; end if;
  if p.status not in ('available', 'low') then raise exception 'FUEL_NOT_AVAILABLE'; end if;
  if p.price is null then raise exception 'FUEL_NO_PRICE'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > p.max_per_order then raise exception 'FUEL_INVALID_QUANTITY'; end if;
  if p.product like 'gas_%' and p_quantity <> trunc(p_quantity) then raise exception 'FUEL_INVALID_QUANTITY'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  left_ := p.reservable_qty - public.fuel_reserved_qty(p.id);
  if p_quantity > left_ then raise exception 'FUEL_NOT_ENOUGH'; end if;
  -- Uma reserva ativa por pessoa e produto (evita açambarcar).
  if exists (select 1 from public.fuel_orders where buyer_id = me and product = p.product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')) then raise exception 'FUEL_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.fuel_orders(station_id, product_id, product, buyer_id, buyer_name, buyer_phone, plate, quantity, unit_price, total, method, status, code, hold_until, pay_by)
  values (s.id, p.id, p.product, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), nullif(upper(trim(coalesce(p_plate, ''))), ''),
    p_quantity, p.price, round(p.price * p_quantity), p_method,
    case when p_method = 'at_station' then 'reserved' else 'awaiting_payment' end,
    case when p_method = 'at_station' then public.new_fuel_code() end,
    case when p_method = 'at_station' then now() + make_interval(mins => s.hold_minutes) end,
    case when p_method = 'prepaid' then now() + make_interval(mins => st.fuel_pay_minutes) end)
  returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', case when p_method = 'at_station' then '⛽ Nova reserva' else '⛽ Nova compra adiantada' end,
    'C-' || o.ref_no || ' · ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' · ' || o.total || ' Kz · ' || o.buyer_name,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $$;

create or replace function public.submit_fuel_payment(p_order_id uuid, p_method text, p_reference text)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare o public.fuel_orders; s public.fuel_stations;
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'FUEL_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'REFERENCE_REQUIRED'; end if;
  update public.fuel_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), updated_at = now() where id = o.id returning * into o;
  select * into s from public.fuel_stations where id = o.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', '⛽ Pagamento para confirmar', 'C-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference, jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $$;

-- O posto confirma que recebeu (o cliente recebe o código) ou recusa.
create or replace function public.decide_fuel_payment(p_order_id uuid, p_confirm boolean, p_note text default null)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare o public.fuel_orders; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if o.status not in ('awaiting_payment', 'submitted') then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.fuel_orders set status = 'paid', code = public.new_fuel_code(), hold_until = now() + make_interval(mins => s.hold_minutes), note = txt, updated_at = now()
      where id = o.id returning * into o;
  else
    update public.fuel_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '⛽ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': levante ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' até ' || to_char(o.hold_until at time zone 'Africa/Luanda', 'DD/MM HH24:MI') || '.'
         else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_orders'));
  return o;
end $$;

-- O posto valida o código quando o cliente levanta (a comissão nasce aqui).
create or replace function public.collect_fuel(p_station_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.fuel_stations; o public.fuel_orders; st public.platform_settings; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if c like 'CB%' then c := substr(c, 3); end if;
  if char_length(c) <> 6 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'CB-' || c;
  select * into o from public.fuel_orders where code = c for update;
  if not found or o.station_id <> s.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  if o.status = 'collected' then return jsonb_build_object('result', 'used', 'code', c, 'at', o.collected_at, 'buyer', o.buyer_name); end if;
  if o.status not in ('reserved', 'paid') then return jsonb_build_object('result', o.status, 'code', c, 'buyer', o.buyer_name); end if;
  select * into st from public.platform_settings where id = 1;
  update public.fuel_orders set status = 'collected', collected_at = now(), fee_pct = st.fuel_fee_pct, fee_amount = round(total * st.fuel_fee_pct / 100), updated_at = now()
    where id = o.id returning * into o;
  update public.fuel_products set reservable_qty = greatest(0, reservable_qty - o.quantity) where id = o.product_id;
  return jsonb_build_object('result', 'ok', 'code', c, 'buyer', o.buyer_name, 'plate', o.plate, 'product', o.product, 'quantity', o.quantity,
    'total', o.total, 'method', o.method);
end $$;

-- Cancelar: o cliente (antes de pagar) ou o posto (com motivo).
create or replace function public.cancel_fuel_order(p_order_id uuid, p_reason text default null)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid(); txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if o.buyer_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  elsif s.owner_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
  else raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  update public.fuel_orders set status = 'cancelled', note = coalesce(txt, note), updated_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when o.buyer_id = me then s.owner_id else o.buyer_id end, 'system', '⛽ Pedido cancelado',
    'C-' || o.ref_no || ' · ' || s.name || coalesce(': ' || txt, '') || case when s.owner_id = me and o.status = 'cancelled' and o.method = 'prepaid' and o.reference is not null then ' O posto deve devolver o dinheiro.' else '' end,
    jsonb_build_object('for', case when o.buyer_id = me then 'fuel_station' else 'fuel_orders' end, 'station_id', s.id));
  return o;
end $$;

-- Os meus pedidos (com os dados para pagar adiantado).
create or replace function public.my_fuel_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.unit_price, o.total, o.code, o.hold_until, o.pay_by, o.pay_method, o.reference, o.note, o.plate,
      o.created_at, s.id station_id, s.name station_name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id left join public.fuel_station_pay y on y.station_id = s.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$$;

-- Painel do posto.
create or replace function public.fuel_station_panel(p_station_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.fuel_stations; st public.platform_settings;
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or (s.owner_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_STATION_OWNER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'fee_pct', st.fuel_fee_pct,
    'collected_today', (select coalesce(sum(total), 0) from public.fuel_orders where station_id = s.id and status = 'collected' and collected_at > date_trunc('day', now() at time zone 'Africa/Luanda') at time zone 'Africa/Luanda'),
    'collected_total', (select coalesce(sum(total), 0) from public.fuel_orders where station_id = s.id and status = 'collected'),
    'fee_total', (select coalesce(sum(fee_amount), 0) from public.fuel_orders where station_id = s.id and status = 'collected'),
    'fee_due', public.fuel_fee_due(s.id),
    'fee_overdue', public.fuel_fees_overdue(s.id),
    'fee_pending', exists (select 1 from public.fuel_platform_payments where station_id = s.id and status = 'pending'),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.total, o.buyer_name, o.buyer_phone, o.plate, o.code, o.hold_until, o.pay_by,
        o.pay_method, o.reference, o.note, o.created_at, o.collected_at
      from public.fuel_orders o where o.station_id = s.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.fuel_platform_payments p where p.station_id = s.id order by p.created_at desc limit 50) x));
end $$;

create or replace function public.submit_fuel_fee_payment(p_station_id uuid, p_method text, p_reference text default null, p_proof_path text default null)
returns public.fuel_platform_payments language plpgsql security definer set search_path = public as $$
declare s public.fuel_stations; p public.fuel_platform_payments; amt numeric;
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  amt := public.fuel_fee_due(s.id);
  if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  insert into public.fuel_platform_payments(station_id, owner_id, amount, method, reference, proof_path)
  values (s.id, s.owner_id, amt, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path) returning * into p;
  perform public.notify_staff('Comissão de combustível paga', 'S-' || s.ref_no || ' · ' || amt || ' Kz · ' || left(s.name, 80), jsonb_build_object('fuel_payment_id', p.id));
  return p;
end $$;

create or replace function public.admin_list_fuel_payments(p_status text default 'pending')
returns table (id uuid, ref_no bigint, station_id uuid, station_ref bigint, station_name text, owner_name text, amount numeric, method text, reference text,
  proof_path text, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.station_id, s.ref_no, s.name, coalesce(nullif(pr.full_name, ''), 'Dono'), p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at
  from public.fuel_platform_payments p join public.fuel_stations s on s.id = p.station_id left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status order by p.created_at limit 300;
end $$;

create or replace function public.admin_decide_fuel_payment(p_payment_id uuid, p_confirm boolean, p_note text default null)
returns public.fuel_platform_payments language plpgsql security definer set search_path = public as $$
declare p public.fuel_platform_payments; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.fuel_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.fuel_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  select * into s from public.fuel_stations where id = p.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Comissão paga ✔' else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': pagamento de ' || p.amount || ' Kz confirmado.' else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fuel_fee' || case when p_confirm then '_confirmed' else '_rejected' end, 'fuel_station', s.id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $$;

-- Administração: aprovar, suspender ou voltar a pôr à espera um posto.
create or replace function public.admin_set_fuel_station_status(p_station_id uuid, p_status text, p_note text default null)
returns public.fuel_stations language plpgsql security definer set search_path = public as $$
declare s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'suspended' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.fuel_stations set status = p_status, admin_note = txt where id = p_station_id returning * into s;
  if not found then raise exception 'FUEL_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', case p_status when 'approved' then '⛽ Posto aprovado ✔' when 'suspended' then 'Posto suspenso' else 'Posto à espera de revisão' end,
    s.name || case p_status when 'approved' then ': já aparece em «Combustível e gás». Marque quando houver!' else coalesce(': ' || txt, '') end,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fuel_station_' || p_status, 'fuel_station', s.id, jsonb_build_object('note', txt));
  return s;
end $$;

-- Novo posto: avisa a administração para aprovar.
create or replace function public.fuel_station_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff('Novo posto para aprovar', 'S-' || new.ref_no || ' · ' || left(new.name, 80), jsonb_build_object('fuel_station_id', new.id));
  return new;
end $$;
create trigger trg_fuel_station_created after insert on public.fuel_stations for each row execute function public.fuel_station_created();

-- Reservas que passaram da hora caducam (a quantidade volta a ficar livre). Pagas não caducam: o posto levanta ou devolve.
create or replace function public.fuel_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (update public.fuel_orders set status = 'expired', updated_at = now()
    where (status = 'reserved' and hold_until < now()) or (status = 'awaiting_payment' and pay_by < now()) returning 1)
  select count(*) into n from x;
  return n;
end $$;
select cron.schedule('huambo-online-fuel-tick', '*/5 * * * *', 'select public.fuel_tick()');

revoke all on function public.guard_fuel_station() from public, anon, authenticated;
revoke all on function public.fuel_product_changed() from public, anon, authenticated;
revoke all on function public.fuel_station_created() from public, anon, authenticated;
revoke all on function public.fuel_reserved_qty(uuid) from public, anon, authenticated;
revoke all on function public.fuel_fee_due(uuid) from public, anon, authenticated;
revoke all on function public.fuel_fees_overdue(uuid) from public, anon, authenticated;
revoke all on function public.new_fuel_code() from public, anon, authenticated;
revoke all on function public.fuel_tick() from public, anon, authenticated;
revoke all on function public.report_fuel(uuid, boolean) from public, anon;
revoke all on function public.reserve_fuel(uuid, numeric, text, text, text, text) from public, anon;
revoke all on function public.submit_fuel_payment(uuid, text, text) from public, anon;
revoke all on function public.decide_fuel_payment(uuid, boolean, text) from public, anon;
revoke all on function public.collect_fuel(uuid, text) from public, anon;
revoke all on function public.cancel_fuel_order(uuid, text) from public, anon;
revoke all on function public.my_fuel_orders() from public, anon;
revoke all on function public.fuel_station_panel(uuid) from public, anon;
revoke all on function public.submit_fuel_fee_payment(uuid, text, text, text) from public, anon;
revoke all on function public.admin_list_fuel_payments(text) from public, anon;
revoke all on function public.admin_decide_fuel_payment(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_fuel_station_status(uuid, text, text) from public, anon;
grant execute on function public.fuel_feed(text, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.report_fuel(uuid, boolean) to authenticated;
grant execute on function public.reserve_fuel(uuid, numeric, text, text, text, text) to authenticated;
grant execute on function public.submit_fuel_payment(uuid, text, text) to authenticated;
grant execute on function public.decide_fuel_payment(uuid, boolean, text) to authenticated;
grant execute on function public.collect_fuel(uuid, text) to authenticated;
grant execute on function public.cancel_fuel_order(uuid, text) to authenticated;
grant execute on function public.my_fuel_orders() to authenticated;
grant execute on function public.fuel_station_panel(uuid) to authenticated;
grant execute on function public.submit_fuel_fee_payment(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_fuel_payments(text) to authenticated;
grant execute on function public.admin_decide_fuel_payment(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_fuel_station_status(uuid, text, text) to authenticated;
