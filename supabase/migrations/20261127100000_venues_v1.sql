-- 🏨🍽️🏬 Reservas em estabelecimentos (Site e APP): hotéis e hospedagem, restaurantes e armazéns (comércio a grosso).
-- O estabelecimento é uma empresa do diretório (com o seu portfólio) que a administração aprova. Mostra quartos / menu / produtos,
-- se há ou não, e recebe reservas e encomendas. O cliente paga no local ou adiantado para as contas do estabelecimento
-- (com comprovativo), e cada pedido tem um código e um QR único. Taxa do APP: 10% = 5% pagos pelo cliente + 5% pelo estabelecimento;
-- o estabelecimento entrega os 10% à plataforma (como no combustível).

alter table public.platform_settings add column if not exists venue_client_fee_pct numeric not null default 5 check (venue_client_fee_pct between 0 and 20);
alter table public.platform_settings add column if not exists venue_business_fee_pct numeric not null default 5 check (venue_business_fee_pct between 0 and 20);
alter table public.platform_settings add column if not exists venue_pay_minutes integer not null default 120 check (venue_pay_minutes between 15 and 2880);
grant update (venue_client_fee_pct, venue_business_fee_pct, venue_pay_minutes) on public.platform_settings to authenticated;

insert into public.categories(name, slug, type, active)
select v.name, v.slug, 'business', true from (values ('Hotéis e hospedagem', 'hoteis'), ('Restaurantes', 'restaurantes'), ('Armazéns (comércio a grosso)', 'armazens')) v(name, slug)
where not exists (select 1 from public.categories c where c.slug = v.slug);

create sequence if not exists public.venues_ref_no_seq start 1001;
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.venues_ref_no_seq'),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hotel', 'restaurant', 'warehouse')),
  subtype text not null check (subtype in ('hotel', 'resort', 'hospedaria', 'casa_passagem', 'pensao', 'lodge', 'apartamento',
    'restaurante', 'snack_bar', 'churrasqueira', 'pastelaria', 'take_away', 'armazem', 'distribuidora', 'cash_carry')),
  accepts_reservations boolean not null default true,
  accepts_pay_at_place boolean not null default true,
  accepts_prepay boolean not null default false,
  hold_minutes integer not null default 60 check (hold_minutes between 15 and 1440),
  check_in_time text check (check_in_time is null or check_in_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  check_out_time text check (check_out_time is null or check_out_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 120),
  policies text check (policies is null or char_length(policies) <= 600),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venues_owner on public.venues(owner_id);
create index venues_status on public.venues(status, kind);
alter table public.venues enable row level security;
create policy venues_read on public.venues for select to anon, authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select public.has_admin_role()));
create policy venues_insert on public.venues for insert to authenticated with check (owner_id = (select auth.uid()));
create policy venues_update on public.venues for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select on public.venues to anon, authenticated;
grant insert, update on public.venues to authenticated;

-- Contas para onde os clientes pagam adiantado (só o dono vê; quem reservou recebe-as nos seus pedidos).
create table public.venue_pay (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  holder text check (holder is null or char_length(holder) <= 80),
  iban text check (iban is null or char_length(iban) <= 40),
  express text check (express is null or char_length(express) <= 20),
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.venue_pay enable row level security;
create policy venue_pay_owner on public.venue_pay for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));
grant select, insert, update on public.venue_pay to authenticated;

-- Quartos (hotel), pratos (restaurante) ou produtos (armazém).
create table public.venue_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text check (description is null or char_length(description) <= 600),
  section text check (section is null or char_length(section) <= 40),
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  price numeric not null check (price >= 0 and price <= 100000000),
  unit text check (unit is null or char_length(unit) <= 24),
  capacity integer check (capacity is null or capacity between 1 and 30),
  qty_total numeric check (qty_total is null or qty_total >= 0),
  min_qty numeric not null default 1 check (min_qty > 0),
  available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venue_items_venue on public.venue_items(venue_id, position);
alter table public.venue_items enable row level security;
create policy venue_items_read on public.venue_items for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and (v.status = 'approved' or v.owner_id = (select auth.uid()) or (select public.has_admin_role()))));
create policy venue_items_owner on public.venue_items for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));
grant select on public.venue_items to anon, authenticated;
grant insert, update, delete on public.venue_items to authenticated;

create sequence if not exists public.venue_orders_ref_no_seq start 1001;
create table public.venue_orders (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.venue_orders_ref_no_seq'),
  venue_id uuid not null references public.venues(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('stay', 'table', 'order')),
  buyer_name text not null check (char_length(buyer_name) between 2 and 80),
  buyer_phone text check (buyer_phone is null or char_length(buyer_phone) <= 20),
  guests integer check (guests is null or guests between 1 and 200),
  check_in date,
  check_out date,
  slot_at timestamptz,
  buyer_note text check (buyer_note is null or char_length(buyer_note) <= 300),
  subtotal numeric not null check (subtotal >= 0),
  client_fee_pct numeric not null,
  client_fee numeric not null default 0,
  business_fee_pct numeric not null,
  business_fee numeric not null default 0,
  total numeric not null check (total >= 0),
  method text not null check (method in ('at_place', 'prepaid')),
  status text not null check (status in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'completed', 'cancelled', 'expired', 'rejected')),
  code text unique,
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  hold_until timestamptz,
  pay_by timestamptz,
  pay_method text check (pay_method is null or pay_method in ('bank_transfer', 'multicaixa_express')),
  reference text check (reference is null or char_length(reference) <= 120),
  reference_norm text,
  proof_path text,
  proof_hash text,
  note text check (note is null or char_length(note) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'stay' or (check_in is not null and check_out > check_in))
);
create index venue_orders_venue on public.venue_orders(venue_id, status, created_at desc);
create index venue_orders_buyer on public.venue_orders(buyer_id, created_at desc);
create index venue_orders_reference_norm on public.venue_orders(reference_norm) where reference_norm is not null;
create index venue_orders_proof_hash on public.venue_orders(proof_hash) where proof_hash is not null;
alter table public.venue_orders enable row level security;
create policy venue_orders_read on public.venue_orders for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role())
    or exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));
grant select on public.venue_orders to authenticated;

create table public.venue_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.venue_orders(id) on delete cascade,
  item_id uuid not null references public.venue_items(id) on delete cascade,
  name text not null,
  unit text,
  qty numeric not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  line_total numeric not null check (line_total >= 0)
);
create index venue_order_lines_order on public.venue_order_lines(order_id);
create index venue_order_lines_item on public.venue_order_lines(item_id);
alter table public.venue_order_lines enable row level security;
create policy venue_order_lines_read on public.venue_order_lines for select to authenticated
  using (exists (select 1 from public.venue_orders o where o.id = order_id));
grant select on public.venue_order_lines to authenticated;

-- O estabelecimento pode ver o comprovativo que o cliente enviou para um pedido seu.
create policy payment_proofs_venue_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and exists (select 1 from public.venue_orders o join public.venues v on v.id = o.venue_id
    where o.proof_path = storage.objects.name and v.owner_id = (select auth.uid())));

-- O que o estabelecimento entrega à plataforma (os 10%).
create sequence if not exists public.venue_platform_payments_ref_no_seq start 1001;
create table public.venue_platform_payments (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.venue_platform_payments_ref_no_seq'),
  venue_id uuid not null references public.venues(id) on delete cascade,
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
create unique index venue_platform_payments_one_pending on public.venue_platform_payments(venue_id) where status = 'pending';
alter table public.venue_platform_payments enable row level security;
create policy venue_platform_payments_read on public.venue_platform_payments for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
grant select on public.venue_platform_payments to authenticated;

-- Proteções: só o dono da empresa a regista; aprovação sempre pela administração; mudar o tipo ou a conta volta a pedir aprovação.
create or replace function public.guard_venue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.has_admin_role() then new.updated_at := now(); return new; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.owner_id) then raise exception 'NOT_BUSINESS_OWNER'; end if;
    if (select count(*) from public.venues where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_VENUES'; end if;
    new.status := 'pending'; new.admin_note := null;
  else
    if new.owner_id <> old.owner_id or new.business_id <> old.business_id or new.ref_no <> old.ref_no then raise exception 'ADMIN_ONLY'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note)
       and coalesce(current_setting('app.venue_pay_changed', true), '') <> '1' then raise exception 'ADMIN_ONLY'; end if;
    if new.kind <> old.kind and old.status = 'approved' then
      new.status := 'pending'; new.admin_note := 'Mudou o tipo de estabelecimento: à espera de nova aprovação.';
      perform public.notify_staff('Estabelecimento mudou de tipo', 'E-' || new.ref_no || ' precisa de nova aprovação.', jsonb_build_object('venue_id', new.id));
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_guard_venue before insert or update on public.venues for each row execute function public.guard_venue();

create or replace function public.venue_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff('Novo estabelecimento para aprovar', 'E-' || new.ref_no || ' · ' || coalesce((select left(name, 80) from public.businesses where id = new.business_id), ''),
    jsonb_build_object('venue_id', new.id));
  return new;
end $$;
create trigger trg_venue_created after insert on public.venues for each row execute function public.venue_created();

create or replace function public.guard_venue_pay() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.venues;
begin
  if public.has_admin_role() then return new; end if;
  select * into v from public.venues where id = new.venue_id;
  if v.status = 'approved' and (tg_op = 'INSERT' or new.iban is distinct from old.iban or new.express is distinct from old.express or new.holder is distinct from old.holder) then
    perform set_config('app.venue_pay_changed', '1', true);
    update public.venues set status = 'pending', admin_note = 'Conta para pagamentos mudou: à espera de nova aprovação.' where id = v.id;
    perform set_config('app.venue_pay_changed', '', true);
    perform public.notify_staff('Estabelecimento mudou a conta para pagamentos', 'E-' || v.ref_no || ' precisa de nova aprovação.', jsonb_build_object('venue_id', v.id));
  end if;
  return new;
end $$;
create trigger trg_guard_venue_pay after insert or update on public.venue_pay for each row execute function public.guard_venue_pay();

-- Estados que ainda ocupam quarto ou stock.
create or replace function public.venue_open_status(s text) returns boolean language sql immutable as $$
  select s in ('reserved', 'awaiting_payment', 'submitted', 'paid')
$$;

-- Quartos livres de um tipo entre duas datas (a pior noite manda).
create or replace function public.venue_room_free(p_item_id uuid, p_from date, p_to date) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(floor(i.qty_total)::int, 0) - coalesce((
    select max(n.booked) from (
      select d::date night, sum(l.qty) booked
      from generate_series(p_from, p_to - 1, interval '1 day') d
      join public.venue_order_lines l on l.item_id = i.id
      join public.venue_orders o on o.id = l.order_id
      where o.kind = 'stay' and (public.venue_open_status(o.status) or (o.status = 'completed' and o.check_out > (now() at time zone 'Africa/Luanda')::date))
        and o.check_in <= d::date and o.check_out > d::date
      group by d) n), 0)::int)
  from public.venue_items i where i.id = p_item_id
$$;

-- Stock que ainda não está prometido (produtos e pratos com quantidade).
create or replace function public.venue_item_reserved(p_item_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.qty), 0) from public.venue_order_lines l join public.venue_orders o on o.id = l.order_id
  where l.item_id = p_item_id and o.kind <> 'stay' and public.venue_open_status(o.status)
$$;

create or replace function public.venue_fee_due(p_venue uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed'), 0)
    - coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0))
$$;
create or replace function public.venue_fees_overdue(p_venue uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed' and completed_at < now() - interval '7 days'), 0)
    > coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0)
$$;
create or replace function public.new_venue_code() returns text
language plpgsql set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'RV-';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.venue_orders where code = c);
  end loop;
  return c;
end $$;

create or replace function public.venue_kind_label(k text) returns text language sql immutable as $$
  select case k when 'stay' then 'Reserva de quarto' when 'table' then 'Reserva de mesa' else 'Encomenda' end
$$;

-- Lista pública: estabelecimentos aprovados, com o preço mais baixo e se há (quartos livres hoje / pratos / produtos).
create or replace function public.venue_feed(p_kind text, p_municipality_id uuid default null, p_query text default '', p_limit integer default 40)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.has_now desc, x.verified desc, x.created_at desc), '[]') from (
    select v.id, v.ref_no, v.kind, v.subtype, v.accepts_reservations, v.accepts_prepay, v.accepts_pay_at_place, v.opening_hours, v.created_at,
      b.id business_id, b.name, b.description, b.logo_url, b.phone, b.whatsapp, b.address_text, b.verified, b.directions, b.geo_lat, b.geo_lng, m.name municipality_name,
      (select min(i.price) from public.venue_items i where i.venue_id = v.id and i.available) price_from,
      (select i.photos[1] from public.venue_items i where i.venue_id = v.id and cardinality(i.photos) > 0 order by i.position, i.created_at limit 1) photo,
      case when v.kind = 'hotel' then (select coalesce(sum(public.venue_room_free(i.id, (now() at time zone 'Africa/Luanda')::date, (now() at time zone 'Africa/Luanda')::date + 1)), 0)
        from public.venue_items i where i.venue_id = v.id and i.available) end rooms_free,
      exists (select 1 from public.venue_items i where i.venue_id = v.id and i.available
        and (v.kind <> 'hotel' or public.venue_room_free(i.id, (now() at time zone 'Africa/Luanda')::date, (now() at time zone 'Africa/Luanda')::date + 1) > 0)) has_now
    from public.venues v join public.businesses b on b.id = v.business_id left join public.municipalities m on m.id = b.municipality_id
    where v.status = 'approved' and b.active and v.kind = p_kind
      and (p_municipality_id is null or b.municipality_id = p_municipality_id)
      and (coalesce(p_query, '') = '' or lower(b.name || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.address_text, '')) like '%' || lower(trim(p_query)) || '%')
    limit greatest(1, least(coalesce(p_limit, 40), 100))) x
$$;

-- Página do estabelecimento: dados, quartos/menu/produtos com o que está livre (para as datas pedidas, nos hotéis).
create or replace function public.venue_detail(p_venue_id uuid, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.venues; b public.businesses; me uuid := auth.uid(); st public.platform_settings; d1 date; d2 date;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or (v.status <> 'approved' and (me is null or (v.owner_id <> me and not public.has_admin_role()))) then return null; end if;
  select * into b from public.businesses where id = v.business_id;
  select * into st from public.platform_settings where id = 1;
  d1 := coalesce(p_from, (now() at time zone 'Africa/Luanda')::date);
  d2 := case when p_to is not null and p_to > d1 then p_to else d1 + 1 end;
  return jsonb_build_object('id', v.id, 'ref_no', v.ref_no, 'kind', v.kind, 'subtype', v.subtype, 'status', v.status, 'owner_id', v.owner_id,
    'accepts_reservations', v.accepts_reservations and not public.venue_fees_overdue(v.id), 'accepts_pay_at_place', v.accepts_pay_at_place,
    'accepts_prepay', v.accepts_prepay and exists (select 1 from public.venue_pay y where y.venue_id = v.id and (y.iban is not null or y.express is not null)),
    'hold_minutes', v.hold_minutes, 'check_in_time', v.check_in_time, 'check_out_time', v.check_out_time, 'opening_hours', v.opening_hours, 'policies', v.policies,
    'client_fee_pct', st.venue_client_fee_pct, 'business_fee_pct', st.venue_business_fee_pct, 'from', d1, 'to', d2,
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description, 'logo_url', b.logo_url, 'phone', b.phone, 'whatsapp', b.whatsapp,
      'address_text', b.address_text, 'verified', b.verified, 'directions', b.directions, 'geo_lat', b.geo_lat, 'geo_lng', b.geo_lng,
      'municipality_name', (select name from public.municipalities where id = b.municipality_id)),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'section', i.section, 'photos', i.photos,
        'price', i.price, 'unit', i.unit, 'capacity', i.capacity, 'qty_total', i.qty_total, 'min_qty', i.min_qty, 'available', i.available, 'position', i.position,
        'free', case when v.kind = 'hotel' then public.venue_room_free(i.id, d1, d2)::numeric when i.qty_total is null then null else greatest(0, i.qty_total - public.venue_item_reserved(i.id)) end)
        order by i.section nulls first, i.position, i.created_at), '[]') from public.venue_items i where i.venue_id = v.id));
end $$;

-- Reservar / encomendar. p_lines = [{"item_id": "...", "qty": 2}].
create or replace function public.reserve_venue(p_venue_id uuid, p_kind text, p_lines jsonb, p_method text, p_name text, p_phone text default null,
  p_check_in date default null, p_check_out date default null, p_guests integer default null, p_slot_at timestamptz default null, p_note text default null)
returns public.venue_orders language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.venues; b public.businesses; st public.platform_settings; o public.venue_orders; i public.venue_items;
  ln jsonb; q numeric; nights int := 1; sub numeric := 0; cfee numeric; bfee numeric; today date := (now() at time zone 'Africa/Luanda')::date; n int := 0; free_ numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into v from public.venues where id = p_venue_id;
  if not found or v.status <> 'approved' then raise exception 'VENUE_NOT_FOUND'; end if;
  select * into b from public.businesses where id = v.business_id;
  if not b.active then raise exception 'VENUE_NOT_FOUND'; end if;
  if v.owner_id = me then raise exception 'CANNOT_BUY_OWN'; end if;
  if not v.accepts_reservations or public.venue_fees_overdue(v.id) then raise exception 'VENUE_NO_RESERVATIONS'; end if;
  if p_method not in ('at_place', 'prepaid') then raise exception 'INVALID_METHOD'; end if;
  if p_method = 'at_place' and not v.accepts_pay_at_place then raise exception 'VENUE_NO_PAY_AT_PLACE'; end if;
  if p_method = 'prepaid' and (not v.accepts_prepay or not exists (select 1 from public.venue_pay y where y.venue_id = v.id and (y.iban is not null or y.express is not null))) then raise exception 'VENUE_NO_PREPAY'; end if;
  if (v.kind = 'hotel' and p_kind <> 'stay') or (v.kind = 'restaurant' and p_kind not in ('table', 'order')) or (v.kind = 'warehouse' and p_kind <> 'order') then raise exception 'INVALID_KIND'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then p_lines := '[]'; end if;
  if jsonb_array_length(p_lines) > 40 then raise exception 'VENUE_TOO_MANY_LINES'; end if;
  if (select count(*) from public.venue_orders where buyer_id = me and venue_id = v.id and public.venue_open_status(status)) >= 3 then raise exception 'VENUE_ORDER_OPEN'; end if;
  if p_kind = 'stay' then
    if jsonb_array_length(p_lines) <> 1 then raise exception 'VENUE_ONE_ROOM_TYPE'; end if;
    if p_check_in is null or p_check_out is null or p_check_in < today or p_check_in > today + 365 or p_check_out <= p_check_in then raise exception 'VENUE_INVALID_DATES'; end if;
    nights := p_check_out - p_check_in;
    if nights > 60 then raise exception 'VENUE_INVALID_DATES'; end if;
    if p_guests is null or p_guests < 1 then raise exception 'VENUE_INVALID_GUESTS'; end if;
  elsif p_kind = 'table' then
    if p_guests is null or p_guests < 1 or p_guests > 100 then raise exception 'VENUE_INVALID_GUESTS'; end if;
    if p_slot_at is null or p_slot_at < now() or p_slot_at > now() + interval '60 days' then raise exception 'VENUE_INVALID_TIME'; end if;
  else
    if jsonb_array_length(p_lines) = 0 then raise exception 'VENUE_EMPTY_ORDER'; end if;
    if p_slot_at is null or p_slot_at < now() - interval '5 minutes' or p_slot_at > now() + interval '30 days' then raise exception 'VENUE_INVALID_TIME'; end if;
  end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.venue_orders(venue_id, buyer_id, kind, buyer_name, buyer_phone, guests, check_in, check_out, slot_at, buyer_note,
    subtotal, client_fee_pct, business_fee_pct, total, method, status)
  values (v.id, me, p_kind, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_guests,
    case when p_kind = 'stay' then p_check_in end, case when p_kind = 'stay' then p_check_out end, case when p_kind <> 'stay' then p_slot_at end,
    nullif(left(trim(coalesce(p_note, '')), 300), ''), 0, st.venue_client_fee_pct, st.venue_business_fee_pct, 0, p_method, 'reserved')
  returning * into o;
  for ln in select * from jsonb_array_elements(p_lines) loop
    begin q := (ln->>'qty')::numeric; exception when others then raise exception 'VENUE_INVALID_QUANTITY'; end;
    select * into i from public.venue_items where id = (ln->>'item_id')::uuid and venue_id = v.id for update;
    if not found then raise exception 'VENUE_ITEM_NOT_FOUND'; end if;
    if not i.available then raise exception 'VENUE_ITEM_NOT_AVAILABLE'; end if;
    if q is null or q <= 0 or q > 100000 then raise exception 'VENUE_INVALID_QUANTITY'; end if;
    if exists (select 1 from public.venue_order_lines where order_id = o.id and item_id = i.id) then raise exception 'VENUE_DUPLICATE_ITEM'; end if;
    if p_kind = 'stay' then
      if q <> trunc(q) or q > 20 then raise exception 'VENUE_INVALID_QUANTITY'; end if;
      if p_guests > coalesce(i.capacity, 2) * q then raise exception 'VENUE_TOO_MANY_GUESTS'; end if;
      if public.venue_room_free(i.id, p_check_in, p_check_out) < q then raise exception 'VENUE_NO_ROOMS'; end if;
    else
      if q < i.min_qty then raise exception 'VENUE_BELOW_MINIMUM'; end if;
      if i.qty_total is not null and q > i.qty_total - public.venue_item_reserved(i.id) then raise exception 'VENUE_NOT_ENOUGH'; end if;
    end if;
    insert into public.venue_order_lines(order_id, item_id, name, unit, qty, unit_price, line_total)
    values (o.id, i.id, i.name, i.unit, q, i.price, round(i.price * q * nights));
    sub := sub + round(i.price * q * nights);
    n := n + 1;
  end loop;
  cfee := round(sub * st.venue_client_fee_pct / 100);
  bfee := round(sub * st.venue_business_fee_pct / 100);
  if p_method = 'prepaid' and sub = 0 then raise exception 'VENUE_NOTHING_TO_PAY'; end if;
  update public.venue_orders set subtotal = sub, client_fee = cfee, business_fee = bfee, total = sub + cfee,
    status = case when p_method = 'at_place' then 'reserved' else 'awaiting_payment' end,
    code = case when p_method = 'at_place' then public.new_venue_code() end,
    hold_until = case when p_method = 'at_place' then
      case when p_kind = 'stay' then ((p_check_in + 1)::timestamp + time '12:00') at time zone 'Africa/Luanda' else p_slot_at + make_interval(mins => v.hold_minutes) end end,
    pay_by = case when p_method = 'prepaid' then now() + make_interval(mins => st.venue_pay_minutes) end
  where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', case p_kind when 'stay' then '🏨 Nova reserva de quarto' when 'table' then '🍽️ Nova reserva de mesa' else '📦 Nova encomenda' end,
    'R-' || o.ref_no || ' · ' || o.buyer_name || ' · ' || o.total || ' Kz' || case when p_method = 'prepaid' then ' (vai pagar adiantado)' else ' (paga no local)' end,
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  return o;
end $$;

-- Enviar o pagamento adiantado: referência + comprovativo; não se aceita referência ou comprovativo já usado (aqui ou no combustível).
create or replace function public.submit_venue_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text default null)
returns public.venue_orders language plpgsql security definer set search_path = public as $$
declare o public.venue_orders; v public.venues; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found or o.buyer_id <> me then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'VENUE_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'VENUE_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.venue_orders x where x.id <> o.id and x.reference_norm = ref_n)
     or exists (select 1 from public.fuel_orders x where x.reference_norm = ref_n) then raise exception 'VENUE_REFERENCE_USED'; end if;
  if h is not null and (exists (select 1 from public.venue_orders x where x.id <> o.id and x.proof_hash = h)
     or exists (select 1 from public.fuel_orders x where x.proof_hash = h)) then raise exception 'VENUE_PROOF_USED'; end if;
  update public.venue_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, code = coalesce(code, public.new_venue_code()), note = null, updated_at = now()
    where id = o.id returning * into o;
  select * into v from public.venues where id = o.venue_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', '💳 Pagamento com comprovativo para confirmar', 'R-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · confirme na sua conta bancária.',
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  return o;
end $$;

-- O estabelecimento confirma (o código/QR passa a valer) ou recusa o pagamento.
create or replace function public.decide_venue_payment(p_order_id uuid, p_confirm boolean, p_note text default null)
returns public.venue_orders language plpgsql security definer set search_path = public as $$
declare o public.venue_orders; v public.venues; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  select * into v from public.venues where id = o.venue_id;
  if v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if o.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select name into bname from public.businesses where id = v.business_id;
  if p_confirm then
    update public.venue_orders set status = 'paid', code = coalesce(code, public.new_venue_code()), note = txt, updated_at = now() where id = o.id returning * into o;
  else
    update public.venue_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '✔ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then bname || ': mostre o QR ou o código ' || o.code || ' ao chegar.' else bname || ': ' || txt end,
    jsonb_build_object('for', 'venue_orders'));
  return o;
end $$;

-- Entrada / atendimento / levantamento: o estabelecimento lê o QR ou escreve o código. A taxa passa a ser devida.
create or replace function public.complete_venue_order(p_venue_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.venues; o public.venue_orders; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if c like 'RV%' then c := substr(c, 3); end if;
  if char_length(c) <> 6 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'RV-' || c;
  select * into o from public.venue_orders where code = c for update;
  if not found or o.venue_id <> v.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  if o.status = 'completed' then return jsonb_build_object('result', 'used', 'code', c, 'at', o.completed_at, 'buyer', o.buyer_name); end if;
  if o.status not in ('reserved', 'paid') then return jsonb_build_object('result', o.status, 'code', c, 'buyer', o.buyer_name); end if;
  update public.venue_orders set status = 'completed', completed_at = now(), updated_at = now() where id = o.id returning * into o;
  if o.kind <> 'stay' then
    update public.venue_items i set qty_total = greatest(0, i.qty_total - l.qty), updated_at = now()
      from public.venue_order_lines l where l.order_id = o.id and l.item_id = i.id and i.qty_total is not null;
  end if;
  return jsonb_build_object('result', 'ok', 'code', c, 'kind', o.kind, 'buyer', o.buyer_name, 'guests', o.guests, 'check_in', o.check_in, 'check_out', o.check_out,
    'slot_at', o.slot_at, 'total', o.total, 'method', o.method,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'unit', l.unit)), '[]') from public.venue_order_lines l where l.order_id = o.id));
end $$;

create or replace function public.cancel_venue_order(p_order_id uuid, p_reason text default null)
returns public.venue_orders language plpgsql security definer set search_path = public as $$
declare o public.venue_orders; v public.venues; me uuid := auth.uid(); was text; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  select * into v from public.venues where id = o.venue_id;
  was := o.status;
  if o.buyer_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  elsif v.owner_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
  else raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  update public.venue_orders set status = 'cancelled', note = coalesce(txt, note), updated_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when o.buyer_id = me then v.owner_id else o.buyer_id end, 'system', 'Pedido cancelado',
    'R-' || o.ref_no || coalesce(': ' || txt, '') || case when v.owner_id = me and was in ('submitted', 'paid') then ' O estabelecimento deve devolver o dinheiro.' else '' end,
    case when o.buyer_id = me then jsonb_build_object('for', 'venue', 'venue_id', v.id) else jsonb_build_object('for', 'venue_orders') end);
  return o;
end $$;

-- Ler o QR: o estabelecimento (ou a administração) vê tudo; o cliente vê o seu pedido; outra pessoa só sabe se o QR é verdadeiro.
create or replace function public.venue_order_by_token(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.venue_orders; v public.venues; bname text; me uuid := auth.uid(); t text := lower(regexp_replace(coalesce(p_token, ''), '[^A-Fa-f0-9]', '', 'g')); role_ text;
begin
  if char_length(t) <> 32 then return jsonb_build_object('result', 'invalid'); end if;
  select * into o from public.venue_orders where qr_token = t;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into v from public.venues where id = o.venue_id;
  select name into bname from public.businesses where id = v.business_id;
  role_ := case when me is not null and v.owner_id = me then 'venue' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and o.buyer_id = me then 'buyer' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'ref_no', o.ref_no, 'status', o.status, 'kind', o.kind, 'venue_id', v.id, 'venue_name', bname,
      'check_in', o.check_in, 'check_out', o.check_out, 'slot_at', o.slot_at);
  end if;
  return jsonb_build_object('result', 'ok', 'role', role_, 'id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'kind', o.kind, 'method', o.method,
    'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'guests', o.guests, 'check_in', o.check_in, 'check_out', o.check_out, 'slot_at', o.slot_at,
    'buyer_note', o.buyer_note, 'subtotal', o.subtotal, 'client_fee_pct', o.client_fee_pct, 'client_fee', o.client_fee, 'business_fee', o.business_fee, 'total', o.total,
    'code', o.code, 'hold_until', o.hold_until, 'pay_method', o.pay_method, 'reference', o.reference, 'proof_path', o.proof_path, 'note', o.note,
    'created_at', o.created_at, 'completed_at', o.completed_at, 'venue_id', v.id, 'venue_name', bname, 'venue_kind', v.kind,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
      from public.venue_order_lines l where l.order_id = o.id));
end $$;

create or replace function public.my_venue_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.kind, o.status, o.method, o.guests, o.check_in, o.check_out, o.slot_at, o.buyer_note, o.subtotal, o.client_fee_pct, o.client_fee, o.total, o.code,
      case when o.status in ('reserved', 'submitted', 'paid') then o.qr_token end qr_token,
      o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.completed_at,
      v.id venue_id, v.kind venue_kind, b.name venue_name, b.address_text, b.directions, b.geo_lat, b.geo_lng, b.phone,
      (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
        from public.venue_order_lines l where l.order_id = o.id) lines,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.venue_orders o join public.venues v on v.id = o.venue_id join public.businesses b on b.id = v.business_id
      left join public.venue_pay y on y.venue_id = v.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$$;

create or replace function public.venue_panel(p_venue_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.venues; st public.platform_settings;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or (v.owner_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_VENUE_OWNER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'client_fee_pct', st.venue_client_fee_pct, 'business_fee_pct', st.venue_business_fee_pct,
    'completed_total', (select coalesce(sum(total), 0) from public.venue_orders where venue_id = v.id and status = 'completed'),
    'fee_total', (select coalesce(sum(client_fee + business_fee), 0) from public.venue_orders where venue_id = v.id and status = 'completed'),
    'fee_due', public.venue_fee_due(v.id),
    'fee_overdue', public.venue_fees_overdue(v.id),
    'fee_pending', exists (select 1 from public.venue_platform_payments where venue_id = v.id and status = 'pending'),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.kind, o.status, o.method, o.guests, o.check_in, o.check_out, o.slot_at, o.buyer_note, o.subtotal, o.client_fee, o.business_fee, o.total,
        o.buyer_name, o.buyer_phone, o.code, o.qr_token, o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.completed_at,
        (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
          from public.venue_order_lines l where l.order_id = o.id) lines
      from public.venue_orders o where o.venue_id = v.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.venue_platform_payments p where p.venue_id = v.id order by p.created_at desc limit 50) x));
end $$;

-- Os meus estabelecimentos (com o nome da empresa).
create or replace function public.my_venues() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select v.*, b.name business_name, (select to_jsonb(y) - 'venue_id' - 'updated_at' from public.venue_pay y where y.venue_id = v.id) pay
    from public.venues v join public.businesses b on b.id = v.business_id where v.owner_id = auth.uid()) x
$$;

create or replace function public.submit_venue_fee_payment(p_venue_id uuid, p_method text, p_reference text default null, p_proof_path text default null)
returns public.venue_platform_payments language plpgsql security definer set search_path = public as $$
declare v public.venues; p public.venue_platform_payments; amt numeric;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  amt := public.venue_fee_due(v.id);
  if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  insert into public.venue_platform_payments(venue_id, owner_id, amount, method, reference, proof_path)
  values (v.id, v.owner_id, amt, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path) returning * into p;
  perform public.notify_staff('Taxa de reservas paga', 'E-' || v.ref_no || ' · ' || amt || ' Kz', jsonb_build_object('venue_payment_id', p.id));
  return p;
end $$;

create or replace function public.admin_list_venues(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select v.id, v.ref_no, v.kind, v.subtype, v.status, v.admin_note, v.accepts_prepay, v.created_at, b.id business_id, b.name, b.phone, b.address_text, b.verified,
      coalesce(nullif(pr.full_name, ''), '—') owner_name, (select to_jsonb(y) - 'venue_id' - 'updated_at' from public.venue_pay y where y.venue_id = v.id) pay,
      public.venue_fee_due(v.id) fee_due, public.venue_fees_overdue(v.id) fee_overdue
    from public.venues v join public.businesses b on b.id = v.business_id left join public.profiles pr on pr.id = v.owner_id
    where coalesce(p_status, '') = '' or v.status = p_status order by v.created_at limit 300) x);
end $$;

create or replace function public.admin_set_venue_status(p_venue_id uuid, p_status text, p_note text default null)
returns public.venues language plpgsql security definer set search_path = public as $$
declare v public.venues; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'suspended' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.venues set status = p_status, admin_note = txt where id = p_venue_id returning * into v;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  select name into bname from public.businesses where id = v.business_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', case p_status when 'approved' then 'Estabelecimento aprovado ✔' when 'suspended' then 'Estabelecimento suspenso' else 'Estabelecimento à espera de revisão' end,
    bname || case p_status when 'approved' then ': já recebe reservas e encomendas.' else coalesce(': ' || txt, '') end,
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'venue_' || p_status, 'venue', v.id, jsonb_build_object('note', txt));
  return v;
end $$;

create or replace function public.admin_list_venue_payments(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select p.id, p.ref_no, p.venue_id, v.ref_no venue_ref, b.name venue_name, coalesce(nullif(pr.full_name, ''), 'Dono') owner_name, p.amount, p.method, p.reference,
      p.proof_path, p.status, p.admin_note, p.created_at
    from public.venue_platform_payments p join public.venues v on v.id = p.venue_id join public.businesses b on b.id = v.business_id left join public.profiles pr on pr.id = p.owner_id
    where coalesce(p_status, '') = '' or p.status = p_status order by p.created_at limit 300) x);
end $$;

create or replace function public.admin_decide_venue_payment(p_payment_id uuid, p_confirm boolean, p_note text default null)
returns public.venue_platform_payments language plpgsql security definer set search_path = public as $$
declare p public.venue_platform_payments; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.venue_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.venue_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  select b.name into bname from public.venues v join public.businesses b on b.id = v.business_id where v.id = p.venue_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Taxa paga ✔' else 'Pagamento não confirmado' end,
    case when p_confirm then bname || ': pagamento de ' || p.amount || ' Kz confirmado.' else bname || ': ' || txt end,
    jsonb_build_object('for', 'venue', 'venue_id', p.venue_id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'venue_fee' || case when p_confirm then '_confirmed' else '_rejected' end, 'venue', p.venue_id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $$;

-- Administração: pagamentos adiantados com comprovativo (auditoria contra burlas).
create or replace function public.admin_list_venue_orders(p_status text default 'submitted') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.kind, o.status, o.method, o.subtotal, o.client_fee, o.business_fee, o.total, o.buyer_name, o.buyer_phone, o.reference, o.proof_path,
      o.qr_token, o.note, o.created_at, v.id venue_id, v.ref_no venue_ref, b.name venue_name
    from public.venue_orders o join public.venues v on v.id = o.venue_id join public.businesses b on b.id = v.business_id
    where o.method = 'prepaid' and (coalesce(p_status, '') = '' or o.status = p_status) order by o.created_at desc limit 200) x);
end $$;

-- Reservas que passaram da hora caducam (o quarto/stock volta a ficar livre). Pagas não caducam: o estabelecimento atende ou devolve.
create or replace function public.venue_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (update public.venue_orders set status = 'expired', updated_at = now()
    where (status = 'reserved' and hold_until < now()) or (status = 'awaiting_payment' and pay_by < now()) returning 1)
  select count(*) into n from x;
  return n;
end $$;
select cron.schedule('huambo-online-venue-tick', '*/5 * * * *', 'select public.venue_tick()');

-- Receitas: junta as taxas de reservas confirmadas.
create or replace function public.admin_revenue(p_from date, p_to date)
returns table(paid_at timestamp with time zone, kind text, description text, payer_name text, amount numeric, method text, reference text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_PERIOD'; end if;
  return query
  select p.decided_at, 'plan_' || s.kind, public.plan_subject_name(s) || ' · ' || p.months || case when p.months = 1 then ' mês' else ' meses' end,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), p.amount, p.method, p.reference
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'confirmed' and (p.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select c.decided_at, 'commission', c.listing_title || ' · venda ' || c.sale_amount || ' Kz', coalesce(nullif(pr.full_name, ''), 'Utilizador'), c.amount, c.method, c.reference
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where c.status = 'paid' and (c.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select o.released_at, 'protected_fee', 'Pagamento protegido · ' || public.order_ref(o) || ' · ' || (o.total - o.refunded_amount) || ' Kz',
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), o.platform_fee, null::text, null::text
  from public.orders o left join public.profiles pr on pr.id = o.seller_id
  where o.platform_fee > 0 and (o.released_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select b.decided_at, 'boost', 'Destaque D-' || b.ref_no || ' · ' || l.title || ' · ' || b.days || ' dias', coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.method, b.reference
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles pr on pr.id = b.owner_id
  where b.status in ('active', 'expired') and b.amount > 0 and (b.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select i.paid_at, 'inspection', 'Inspeção I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''), coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         i.fee_amount, i.pay_method, i.pay_reference
  from public.inspections i left join public.profiles pr on pr.id = i.owner_id
  where i.paid_at is not null and i.fee_amount > 0 and (i.paid_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select vp.decided_at, 'venue_fee', 'Taxa de reservas E-' || v.ref_no || ' · ' || bz.name, coalesce(nullif(pr.full_name, ''), 'Utilizador'), vp.amount, vp.method, vp.reference
  from public.venue_platform_payments vp join public.venues v on v.id = vp.venue_id join public.businesses bz on bz.id = v.business_id left join public.profiles pr on pr.id = vp.owner_id
  where vp.status = 'confirmed' and (vp.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $$;

revoke all on function public.guard_venue() from public, anon, authenticated;
revoke all on function public.venue_created() from public, anon, authenticated;
revoke all on function public.guard_venue_pay() from public, anon, authenticated;
revoke all on function public.venue_room_free(uuid, date, date) from public, anon, authenticated;
revoke all on function public.venue_item_reserved(uuid) from public, anon, authenticated;
revoke all on function public.venue_fee_due(uuid) from public, anon, authenticated;
revoke all on function public.venue_fees_overdue(uuid) from public, anon, authenticated;
revoke all on function public.new_venue_code() from public, anon, authenticated;
revoke all on function public.venue_tick() from public, anon, authenticated;
revoke all on function public.venue_feed(text, uuid, text, integer) from public;
revoke all on function public.venue_detail(uuid, date, date) from public;
revoke all on function public.venue_order_by_token(text) from public;
revoke all on function public.reserve_venue(uuid, text, jsonb, text, text, text, date, date, integer, timestamptz, text) from public, anon;
revoke all on function public.submit_venue_payment(uuid, text, text, text, text) from public, anon;
revoke all on function public.decide_venue_payment(uuid, boolean, text) from public, anon;
revoke all on function public.complete_venue_order(uuid, text) from public, anon;
revoke all on function public.cancel_venue_order(uuid, text) from public, anon;
revoke all on function public.my_venue_orders() from public, anon;
revoke all on function public.my_venues() from public, anon;
revoke all on function public.venue_panel(uuid) from public, anon;
revoke all on function public.submit_venue_fee_payment(uuid, text, text, text) from public, anon;
revoke all on function public.admin_list_venues(text) from public, anon;
revoke all on function public.admin_set_venue_status(uuid, text, text) from public, anon;
revoke all on function public.admin_list_venue_payments(text) from public, anon;
revoke all on function public.admin_decide_venue_payment(uuid, boolean, text) from public, anon;
revoke all on function public.admin_list_venue_orders(text) from public, anon;
grant execute on function public.venue_feed(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.venue_detail(uuid, date, date) to anon, authenticated;
grant execute on function public.venue_order_by_token(text) to anon, authenticated;
grant execute on function public.reserve_venue(uuid, text, jsonb, text, text, text, date, date, integer, timestamptz, text) to authenticated;
grant execute on function public.submit_venue_payment(uuid, text, text, text, text) to authenticated;
grant execute on function public.decide_venue_payment(uuid, boolean, text) to authenticated;
grant execute on function public.complete_venue_order(uuid, text) to authenticated;
grant execute on function public.cancel_venue_order(uuid, text) to authenticated;
grant execute on function public.my_venue_orders() to authenticated;
grant execute on function public.my_venues() to authenticated;
grant execute on function public.venue_panel(uuid) to authenticated;
grant execute on function public.submit_venue_fee_payment(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_venues(text) to authenticated;
grant execute on function public.admin_set_venue_status(uuid, text, text) to authenticated;
grant execute on function public.admin_list_venue_payments(text) to authenticated;
grant execute on function public.admin_decide_venue_payment(uuid, boolean, text) to authenticated;
grant execute on function public.admin_list_venue_orders(text) to authenticated;

alter function public.venue_open_status(text) set search_path = public;
alter function public.venue_kind_label(text) set search_path = public;
