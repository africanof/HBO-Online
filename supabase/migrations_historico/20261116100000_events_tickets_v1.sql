-- Eventos e venda de bilhetes (igual no Site e na APP).
-- • O organizador cria o evento (data, local, «Como chegar», fotografia) e os tipos de bilhete (preço, quantidade).
-- • Quem compra reserva os bilhetes e paga DIRETAMENTE ao organizador (IBAN / Multicaixa Express indicados no
--   evento), escreve a referência, e o organizador confirma → nascem os bilhetes com código (e QR no Site/APP).
--   Bilhetes grátis saem logo. Reservas não pagas caducam em event_payment_hours (48 h) e o lugar volta à venda.
-- • À entrada, o organizador valida o código: cada bilhete só entra uma vez.
-- • O Huambo Online cobra event_ticket_fee_pct (5%) dos bilhetes pagos confirmados; o organizador paga a comissão
--   (e os destaques do evento) por transferência / Multicaixa com comprovativo, confirmado pela administração.
--   Comissões de eventos terminados há mais de 7 dias por pagar impedem publicar eventos novos.
-- • Destaque do evento: o evento aparece primeiro e com «⭐ Destaque» até featured_until.

alter table public.platform_settings
  add column if not exists event_ticket_fee_pct numeric not null default 5 check (event_ticket_fee_pct between 0 and 30),
  add column if not exists event_boost_price_kz numeric not null default 1000 check (event_boost_price_kz >= 0),
  add column if not exists event_boost_days integer not null default 7 check (event_boost_days between 1 and 60),
  add column if not exists event_payment_hours integer not null default 48 check (event_payment_hours between 1 and 240);
grant update (event_ticket_fee_pct, event_boost_price_kz, event_boost_days, event_payment_hours) on public.platform_settings to authenticated;

create sequence if not exists public.events_ref_no_seq start 1001;
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.events_ref_no_seq'),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 4 and 120),
  description text check (description is null or char_length(description) <= 4000),
  category text not null default 'other' check (category in ('music', 'party', 'sport', 'culture', 'religion', 'business', 'training', 'family', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text not null check (char_length(trim(venue)) between 2 and 160),
  municipality_id uuid references public.municipalities(id) on delete set null,
  directions text check (directions is null or char_length(directions) <= 300),
  geo_lat numeric, geo_lng numeric,
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check ((geo_lat is null and geo_lng is null) or (geo_lat is not null and geo_lng is not null and geo_lat between -18.1 and -4.3 and geo_lng between 11.6 and 24.2))
);
create index if not exists events_list_idx on public.events(status, starts_at);
create index if not exists events_organizer_idx on public.events(organizer_id, created_at desc);
create index if not exists events_municipality_idx on public.events(municipality_id);
alter table public.events enable row level security;
create policy events_public_read on public.events for select to anon, authenticated using (status <> 'draft' or organizer_id = (select auth.uid()) or (select public.has_admin_role()));
create policy events_owner_insert on public.events for insert to authenticated with check (organizer_id = (select auth.uid()));
create policy events_owner_update on public.events for update to authenticated using (organizer_id = (select auth.uid()) or (select public.has_admin_role()))
  with check (organizer_id = (select auth.uid()) or (select public.has_admin_role()));
grant select on public.events to anon, authenticated;
grant insert, update on public.events to authenticated;

-- Para onde se paga (só o organizador vê aqui; quem reservou vê nos «Meus bilhetes»).
create table if not exists public.event_payment_info (
  event_id uuid primary key references public.events(id) on delete cascade,
  holder text check (holder is null or char_length(holder) <= 120),
  iban text check (iban is null or char_length(iban) <= 40),
  express text check (express is null or char_length(express) <= 20),
  note text check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.event_payment_info enable row level security;
create policy event_payment_info_owner on public.event_payment_info for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())));
revoke all on public.event_payment_info from anon;
grant select, insert, update on public.event_payment_info to authenticated;

create table if not exists public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  price numeric not null default 0 check (price >= 0),
  quantity integer not null check (quantity between 1 and 100000),
  max_per_order integer not null default 10 check (max_per_order between 1 and 50),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_ticket_types_event_idx on public.event_ticket_types(event_id, sort);
alter table public.event_ticket_types enable row level security;
create policy event_ticket_types_read on public.event_ticket_types for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (e.status <> 'draft' or e.organizer_id = (select auth.uid()))));
create policy event_ticket_types_owner_write on public.event_ticket_types for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())));
grant select on public.event_ticket_types to anon, authenticated;
grant insert, update, delete on public.event_ticket_types to authenticated;

create sequence if not exists public.event_orders_ref_no_seq start 1001;
create table if not exists public.event_orders (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.event_orders_ref_no_seq'),
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null check (char_length(trim(buyer_name)) between 2 and 120),
  buyer_phone text check (buyer_phone is null or char_length(buyer_phone) <= 20),
  quantity integer not null check (quantity between 1 and 50),
  unit_price numeric not null check (unit_price >= 0),
  total numeric not null check (total >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'submitted', 'confirmed', 'rejected', 'cancelled', 'expired')),
  method text check (method is null or method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  pay_by timestamptz,
  fee_pct numeric, fee_amount numeric not null default 0,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  submitted_at timestamptz, decided_at timestamptz
);
create index if not exists event_orders_event_idx on public.event_orders(event_id, status);
create index if not exists event_orders_buyer_idx on public.event_orders(buyer_id, created_at desc);
create index if not exists event_orders_type_idx on public.event_orders(ticket_type_id, status);
alter table public.event_orders enable row level security;
create policy event_orders_parties_read on public.event_orders for select to authenticated
  using (buyer_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())) or (select public.has_admin_role()));
revoke all on public.event_orders from anon, authenticated;
grant select on public.event_orders to authenticated;

create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^HO-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  order_id uuid not null references public.event_orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types(id) on delete restrict,
  holder_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'valid' check (status in ('valid', 'used', 'void')),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists event_tickets_order_idx on public.event_tickets(order_id);
create index if not exists event_tickets_event_idx on public.event_tickets(event_id, status);
create index if not exists event_tickets_holder_idx on public.event_tickets(holder_id);
create index if not exists event_tickets_type_idx on public.event_tickets(ticket_type_id);
create index if not exists event_tickets_checker_idx on public.event_tickets(checked_in_by);
alter table public.event_tickets enable row level security;
create policy event_tickets_parties_read on public.event_tickets for select to authenticated
  using (holder_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())));
revoke all on public.event_tickets from anon, authenticated;
grant select on public.event_tickets to authenticated;

-- Pagamentos do organizador ao Huambo Online: comissão dos bilhetes ou destaque do evento.
create sequence if not exists public.event_platform_payments_ref_no_seq start 1001;
create table if not exists public.event_platform_payments (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.event_platform_payments_ref_no_seq'),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('fee', 'boost')),
  amount numeric not null check (amount >= 0),
  days integer check (days is null or days between 1 and 60),
  method text not null check (method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create unique index if not exists event_platform_payments_one_pending on public.event_platform_payments(event_id, kind) where status = 'pending';
create index if not exists event_platform_payments_org_idx on public.event_platform_payments(organizer_id, created_at desc);
create index if not exists event_platform_payments_status_idx on public.event_platform_payments(status, created_at);
create index if not exists event_platform_payments_decided_by_idx on public.event_platform_payments(decided_by);
alter table public.event_platform_payments enable row level security;
create policy event_platform_payments_read on public.event_platform_payments for select to authenticated
  using (organizer_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.event_platform_payments from anon, authenticated;
grant select on public.event_platform_payments to authenticated;

-- Bilhetes ainda disponíveis de um tipo (reservados, à espera e confirmados contam como vendidos).
create or replace function public.ticket_type_taken(p_type uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity), 0)::int from public.event_orders where ticket_type_id = p_type and status in ('reserved', 'submitted', 'confirmed')
$$;

-- Comissão por pagar de um evento (bilhetes pagos confirmados − pagamentos de comissão confirmados).
create or replace function public.event_fee_due(p_event uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce((select sum(fee_amount) from public.event_orders where event_id = p_event and status = 'confirmed'), 0)
    - coalesce((select sum(amount) from public.event_platform_payments where event_id = p_event and kind = 'fee' and status = 'confirmed'), 0))
$$;

-- Proteções: só a administração mexe no destaque; publicar exige bilhetes, data futura e comissões em dia.
create or replace function public.guard_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare admin boolean := public.has_admin_role();
begin
  if tg_op = 'UPDATE' then
    new.organizer_id := old.organizer_id; new.ref_no := old.ref_no;
    if old.status = 'cancelled' and new.status <> 'cancelled' and not admin then raise exception 'EVENT_CANCELLED'; end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' and coalesce(current_setting('huambo.allow_cancel', true), '') <> 'on' then raise exception 'USE_CANCEL_FUNCTION'; end if;
  end if;
  if not admin and coalesce(current_setting('huambo.allow_feature', true), '') <> 'on' then
    new.featured_until := case when tg_op = 'UPDATE' then old.featured_until else null end;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.current_user_active() and not admin then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if new.starts_at < now() then raise exception 'EVENT_IN_PAST'; end if;
    if tg_op = 'UPDATE' and not exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active) then raise exception 'EVENT_NEEDS_TICKETS'; end if;
    if tg_op = 'INSERT' then raise exception 'EVENT_NEEDS_TICKETS'; end if;
    if exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active and t.price > 0)
       and not exists (select 1 from public.event_payment_info pi where pi.event_id = new.id and (nullif(trim(pi.iban), '') is not null or nullif(trim(pi.express), '') is not null)) then
      raise exception 'EVENT_NEEDS_PAYMENT_INFO';
    end if;
    if exists (select 1 from public.events e where e.organizer_id = new.organizer_id and e.id <> new.id
               and coalesce(e.ends_at, e.starts_at) < now() - interval '7 days' and public.event_fee_due(e.id) > 0) then raise exception 'EVENT_FEES_OVERDUE'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger guard_event before insert or update on public.events for each row execute function public.guard_event();

-- Não se baixa a quantidade abaixo do que já foi reservado/vendido, nem se muda o preço com bilhetes vendidos.
create or replace function public.guard_ticket_type() returns trigger
language plpgsql security definer set search_path = public as $$
declare taken int;
begin
  if tg_op = 'DELETE' then
    if public.ticket_type_taken(old.id) > 0 or exists (select 1 from public.event_orders where ticket_type_id = old.id) then raise exception 'TICKET_TYPE_HAS_ORDERS'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.event_id := old.event_id;
    taken := public.ticket_type_taken(old.id);
    if new.quantity < taken then raise exception 'TICKETS_ALREADY_SOLD'; end if;
    if new.price <> old.price and exists (select 1 from public.event_orders where ticket_type_id = old.id and status in ('reserved', 'submitted', 'confirmed')) then raise exception 'TICKET_PRICE_LOCKED'; end if;
  end if;
  return new;
end $$;
create trigger guard_ticket_type before insert or update or delete on public.event_ticket_types for each row execute function public.guard_ticket_type();

-- Código do bilhete: HO-XXXX-XXXX (sem letras que se confundem).
create or replace function public.new_ticket_code() returns text
language plpgsql set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'HO-';
    for i in 1..8 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); if i = 4 then c := c || '-'; end if; end loop;
    exit when not exists (select 1 from public.event_tickets where code = c);
  end loop;
  return c;
end $$;

create or replace function public.issue_event_tickets(o public.event_orders) returns void
language plpgsql security definer set search_path = public as $$
declare i int;
begin
  for i in 1..o.quantity loop
    insert into public.event_tickets(code, order_id, event_id, ticket_type_id, holder_id) values (public.new_ticket_code(), o.id, o.event_id, o.ticket_type_id, o.buyer_id);
  end loop;
end $$;

-- Reservar (ou receber logo, se for grátis).
create or replace function public.reserve_event_tickets(p_ticket_type_id uuid, p_quantity integer, p_name text, p_phone text default null)
returns public.event_orders language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t public.event_ticket_types; e public.events; o public.event_orders; st public.platform_settings; left_ int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into t from public.event_ticket_types where id = p_ticket_type_id for update;
  if not found or not t.active then raise exception 'TICKET_TYPE_NOT_FOUND'; end if;
  select * into e from public.events where id = t.event_id;
  if e.status <> 'published' or coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then raise exception 'EVENT_NOT_ON_SALE'; end if;
  if e.organizer_id = me then raise exception 'CANNOT_BUY_OWN_TICKETS'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > t.max_per_order then raise exception 'INVALID_TICKET_QUANTITY'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  left_ := t.quantity - public.ticket_type_taken(t.id);
  if p_quantity > left_ then raise exception 'NOT_ENOUGH_TICKETS'; end if;
  if t.price > 0 and exists (select 1 from public.event_orders where buyer_id = me and event_id = e.id and status in ('reserved', 'submitted')) then raise exception 'TICKET_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.event_orders(event_id, ticket_type_id, buyer_id, buyer_name, buyer_phone, quantity, unit_price, total, status, pay_by, decided_at)
  values (e.id, t.id, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_quantity, t.price, t.price * p_quantity,
    case when t.price = 0 then 'confirmed' else 'reserved' end,
    case when t.price = 0 then null else now() + make_interval(hours => st.event_payment_hours) end,
    case when t.price = 0 then now() end)
  returning * into o;
  if t.price = 0 then
    perform public.issue_event_tickets(o);
  else
    insert into public.notifications(user_id, type, title, body, data)
    values (e.organizer_id, 'system', 'Nova reserva de bilhetes 🎟️', o.quantity || ' × ' || t.name || ' · «' || left(e.title, 80) || '» · B-' || o.ref_no || '. Confirme quando receber o pagamento.',
      jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  end if;
  return o;
end $$;

-- Quem compra diz como pagou.
create or replace function public.submit_event_ticket_payment(p_order_id uuid, p_method text, p_reference text)
returns public.event_orders language plpgsql security definer set search_path = public as $$
declare o public.event_orders; e public.events;
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  if o.status not in ('reserved', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'reserved' and o.pay_by < now() then raise exception 'TICKET_RESERVATION_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'REFERENCE_REQUIRED'; end if;
  if o.status = 'rejected' and o.quantity > (select quantity from public.event_ticket_types where id = o.ticket_type_id) - public.ticket_type_taken(o.ticket_type_id) then raise exception 'NOT_ENOUGH_TICKETS'; end if;
  update public.event_orders set status = 'submitted', method = p_method, reference = left(trim(p_reference), 120), submitted_at = now() where id = o.id returning * into o;
  select * into e from public.events where id = o.event_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (e.organizer_id, 'system', 'Pagamento de bilhetes para confirmar', 'B-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · «' || left(e.title, 80) || '».',
    jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  return o;
end $$;

-- Organizador confirma (recebeu o dinheiro) ou recusa (não recebeu).
create or replace function public.decide_event_ticket_order(p_order_id uuid, p_confirm boolean, p_note text default null)
returns public.event_orders language plpgsql security definer set search_path = public as $$
declare o public.event_orders; e public.events; st public.platform_settings; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  select * into e from public.events where id = o.event_id;
  if e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if o.status not in ('reserved', 'submitted') then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  if p_confirm then
    update public.event_orders set status = 'confirmed', decided_at = now(), note = txt, fee_pct = st.event_ticket_fee_pct,
      fee_amount = round(total * st.event_ticket_fee_pct / 100), method = coalesce(method, 'cash') where id = o.id returning * into o;
    perform public.issue_event_tickets(o);
  else
    update public.event_orders set status = 'rejected', decided_at = now(), note = txt where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then 'Bilhetes confirmados 🎟️' else 'Pagamento dos bilhetes não confirmado' end,
    case when p_confirm then o.quantity || ' bilhete(s) para «' || left(e.title, 80) || '». Mostre o código à entrada.' else '«' || left(e.title, 80) || '»: ' || txt end,
    jsonb_build_object('for', 'tickets', 'event_id', e.id));
  return o;
end $$;

create or replace function public.cancel_event_ticket_order(p_order_id uuid)
returns public.event_orders language plpgsql security definer set search_path = public as $$
declare o public.event_orders;
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  if o.status not in ('reserved', 'submitted', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  update public.event_orders set status = 'cancelled', decided_at = now() where id = o.id returning * into o;
  return o;
end $$;

-- Validar à entrada.
create or replace function public.check_in_event_ticket(p_event_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; t public.event_tickets; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); tn text; holder text;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if c like 'HO%' then c := substr(c, 3); end if;
  if char_length(c) <> 8 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'HO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into t from public.event_tickets where code = c for update;
  if not found or t.event_id <> e.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  select name into tn from public.event_ticket_types where id = t.ticket_type_id;
  select buyer_name into holder from public.event_orders where id = t.order_id;
  if t.status = 'void' then return jsonb_build_object('result', 'void', 'code', c, 'type', tn, 'holder', holder); end if;
  if t.status = 'used' then return jsonb_build_object('result', 'used', 'code', c, 'type', tn, 'holder', holder, 'at', t.checked_in_at); end if;
  update public.event_tickets set status = 'used', checked_in_at = now(), checked_in_by = auth.uid() where id = t.id;
  return jsonb_build_object('result', 'ok', 'code', c, 'type', tn, 'holder', holder);
end $$;

-- Organizador cancela o evento: os bilhetes ficam anulados e quem comprou recebe aviso (o organizador devolve o dinheiro).
create or replace function public.cancel_event(p_event_id uuid, p_reason text)
returns public.events language plpgsql security definer set search_path = public as $$
declare e public.events; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into e from public.events where id = p_event_id for update;
  if not found or (e.organizer_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('huambo.allow_cancel', 'on', true);
  update public.events set status = 'cancelled', cancel_reason = txt where id = e.id returning * into e;
  perform set_config('huambo.allow_cancel', '', true);
  update public.event_tickets set status = 'void' where event_id = e.id and status = 'valid';
  update public.event_orders set status = 'cancelled', decided_at = now() where event_id = e.id and status in ('reserved', 'submitted');
  insert into public.notifications(user_id, type, title, body, data)
  select distinct o.buyer_id, 'system', 'Evento cancelado', '«' || left(e.title, 80) || '» foi cancelado: ' || txt || ' Se já pagou, o organizador tem de devolver o dinheiro.',
    jsonb_build_object('for', 'tickets', 'event_id', e.id)
  from public.event_orders o where o.event_id = e.id and o.status in ('confirmed', 'cancelled');
  return e;
end $$;

-- Lista pública: ticket mais barato, bilhetes que restam, destaque primeiro.
create or replace function public.list_events(p_category text default null, p_municipality uuid default null, p_query text default null, p_limit integer default 60)
returns table (id uuid, ref_no bigint, title text, category text, starts_at timestamptz, ends_at timestamptz, venue text, municipality_name text,
  cover_url text, featured boolean, price_from numeric, tickets_left bigint, status text)
language sql stable security definer set search_path = public as $$
  select e.id, e.ref_no, e.title, e.category, e.starts_at, e.ends_at, e.venue, m.name, e.cover_url, coalesce(e.featured_until > now(), false),
    (select min(t.price) from public.event_ticket_types t where t.event_id = e.id and t.active),
    (select coalesce(sum(t.quantity - public.ticket_type_taken(t.id)), 0) from public.event_ticket_types t where t.event_id = e.id and t.active),
    e.status
  from public.events e left join public.municipalities m on m.id = e.municipality_id
  where e.status = 'published' and coalesce(e.ends_at, e.starts_at + interval '6 hours') > now()
    and (p_category is null or e.category = p_category) and (p_municipality is null or e.municipality_id = p_municipality)
    and (p_query is null or e.title ilike '%' || p_query || '%' or e.venue ilike '%' || p_query || '%')
  order by coalesce(e.featured_until > now(), false) desc, e.starts_at
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
$$;

create or replace function public.event_ticket_availability(p_event_id uuid)
returns table (id uuid, name text, price numeric, quantity integer, left_count integer, max_per_order integer, active boolean, sort integer)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.price, t.quantity, greatest(t.quantity - public.ticket_type_taken(t.id), 0), t.max_per_order, t.active, t.sort
  from public.event_ticket_types t join public.events e on e.id = t.event_id
  where t.event_id = p_event_id and (e.status <> 'draft' or e.organizer_id = auth.uid())
  order by t.sort, t.price
$$;

-- Os meus bilhetes (compras e códigos).
create or replace function public.my_event_tickets()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.starts_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.quantity, o.total, o.unit_price, o.method, o.reference, o.pay_by, o.note, o.created_at,
      e.id event_id, e.title, e.starts_at, e.ends_at, e.venue, e.status event_status, e.cancel_reason,
      pi.holder pay_holder, pi.iban pay_iban, pi.express pay_express, pi.note pay_note, t.name type_name,
      (select coalesce(jsonb_agg(jsonb_build_object('code', k.code, 'status', k.status) order by k.code), '[]') from public.event_tickets k where k.order_id = o.id) tickets
    from public.event_orders o join public.events e on e.id = o.event_id join public.event_ticket_types t on t.id = o.ticket_type_id
      left join public.event_payment_info pi on pi.event_id = e.id
    where o.buyer_id = auth.uid() order by e.starts_at desc limit 200) x
$$;

-- Painel do organizador: vendas, pedidos, comissão.
create or replace function public.organizer_event_panel(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.events; st public.platform_settings;
begin
  select * into e from public.events where id = p_event_id;
  if not found or (e.organizer_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'sold', (select coalesce(sum(quantity), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'revenue', (select coalesce(sum(total), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'checked_in', (select count(*) from public.event_tickets where event_id = e.id and status = 'used'),
    'fee_pct', st.event_ticket_fee_pct,
    'fee_total', (select coalesce(sum(fee_amount), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'fee_due', public.event_fee_due(e.id),
    'fee_pending', exists (select 1 from public.event_platform_payments where event_id = e.id and kind = 'fee' and status = 'pending'),
    'boost_pending', exists (select 1 from public.event_platform_payments where event_id = e.id and kind = 'boost' and status = 'pending'),
    'boost_price_kz', st.event_boost_price_kz, 'boost_days', st.event_boost_days,
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.status, o.quantity, o.total, o.buyer_name, o.buyer_phone, o.method, o.reference, o.pay_by, o.note, o.created_at, t.name type_name
      from public.event_orders o join public.event_ticket_types t on t.id = o.ticket_type_id where o.event_id = e.id order by o.created_at desc limit 500) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.kind, p.amount, p.days, p.status, p.admin_note, p.created_at from public.event_platform_payments p where p.event_id = e.id order by p.created_at desc limit 50) x));
end $$;

-- Organizador paga a comissão ou o destaque.
create or replace function public.submit_event_platform_payment(p_event_id uuid, p_kind text, p_method text, p_reference text default null, p_proof_path text default null)
returns public.event_platform_payments language plpgsql security definer set search_path = public as $$
declare e public.events; st public.platform_settings; p public.event_platform_payments; amt numeric;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if p_kind not in ('fee', 'boost') or p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  select * into st from public.platform_settings where id = 1;
  if p_kind = 'fee' then
    amt := public.event_fee_due(e.id);
    if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  else
    if e.status <> 'published' or e.starts_at < now() then raise exception 'EVENT_NOT_ON_SALE'; end if;
    amt := st.event_boost_price_kz;
  end if;
  insert into public.event_platform_payments(event_id, organizer_id, kind, amount, days, method, reference, proof_path)
  values (e.id, e.organizer_id, p_kind, amt, case when p_kind = 'boost' then st.event_boost_days end, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path)
  returning * into p;
  perform public.notify_staff(case when p_kind = 'fee' then 'Comissão de evento paga' else 'Pedido de destaque de evento' end,
    'E-' || e.ref_no || ' · ' || amt || ' Kz · «' || left(e.title, 80) || '»', jsonb_build_object('event_payment_id', p.id));
  return p;
end $$;

create or replace function public.admin_list_event_payments(p_status text default 'pending')
returns table (id uuid, ref_no bigint, event_id uuid, event_ref bigint, event_title text, organizer_name text, kind text, amount numeric, days integer,
  method text, reference text, proof_path text, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.event_id, e.ref_no, e.title, coalesce(nullif(pr.full_name, ''), 'Organizador'), p.kind, p.amount, p.days,
    p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at
  from public.event_platform_payments p join public.events e on e.id = p.event_id left join public.profiles pr on pr.id = p.organizer_id
  where p_status is null or p.status = p_status order by p.created_at limit 300;
end $$;

create or replace function public.admin_decide_event_payment(p_payment_id uuid, p_confirm boolean, p_note text default null)
returns public.event_platform_payments language plpgsql security definer set search_path = public as $$
declare p public.event_platform_payments; e public.events; txt text := nullif(left(trim(coalesce(p_note, '')), 500), ''); until_ timestamptz;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.event_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into e from public.events where id = p.event_id for update;
  update public.event_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  if p_confirm and p.kind = 'boost' then
    until_ := greatest(now(), coalesce(e.featured_until, now())) + make_interval(days => coalesce(p.days, 7));
    perform set_config('huambo.allow_feature', 'on', true);
    update public.events set featured_until = until_ where id = e.id;
    perform set_config('huambo.allow_feature', '', true);
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.organizer_id, 'system',
    case when not p_confirm then 'Pagamento não confirmado' when p.kind = 'boost' then 'Evento em destaque ⭐' else 'Comissão do evento paga ✔' end,
    case when not p_confirm then '«' || left(e.title, 80) || '»: ' || txt
         when p.kind = 'boost' then '«' || left(e.title, 80) || '» aparece em destaque até ' || to_char(until_ at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.'
         else '«' || left(e.title, 80) || '»: pagamento de ' || p.amount || ' Kz confirmado.' end,
    jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'event_' || p.kind || case when p_confirm then '_confirmed' else '_rejected' end, 'event', e.id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $$;

-- Reservas não pagas caducam (o lugar volta à venda).
create or replace function public.events_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (update public.event_orders set status = 'expired', decided_at = now() where status = 'reserved' and pay_by < now() returning 1)
  select count(*) into n from x;
  return n;
end $$;
select cron.schedule('huambo-online-events-tick', '*/15 * * * *', 'select public.events_tick()');

revoke all on function public.ticket_type_taken(uuid) from public, anon, authenticated;
revoke all on function public.event_fee_due(uuid) from public, anon, authenticated;
revoke all on function public.guard_event() from public, anon, authenticated;
revoke all on function public.guard_ticket_type() from public, anon, authenticated;
revoke all on function public.new_ticket_code() from public, anon, authenticated;
revoke all on function public.issue_event_tickets(public.event_orders) from public, anon, authenticated;
revoke all on function public.events_tick() from public, anon, authenticated;
revoke all on function public.reserve_event_tickets(uuid, integer, text, text) from public, anon;
revoke all on function public.submit_event_ticket_payment(uuid, text, text) from public, anon;
revoke all on function public.decide_event_ticket_order(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_event_ticket_order(uuid) from public, anon;
revoke all on function public.check_in_event_ticket(uuid, text) from public, anon;
revoke all on function public.cancel_event(uuid, text) from public, anon;
revoke all on function public.list_events(text, uuid, text, integer) from public;
revoke all on function public.event_ticket_availability(uuid) from public;
revoke all on function public.my_event_tickets() from public, anon;
revoke all on function public.organizer_event_panel(uuid) from public, anon;
revoke all on function public.submit_event_platform_payment(uuid, text, text, text, text) from public, anon;
revoke all on function public.admin_list_event_payments(text) from public, anon;
revoke all on function public.admin_decide_event_payment(uuid, boolean, text) from public, anon;
grant execute on function public.reserve_event_tickets(uuid, integer, text, text) to authenticated;
grant execute on function public.submit_event_ticket_payment(uuid, text, text) to authenticated;
grant execute on function public.decide_event_ticket_order(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_event_ticket_order(uuid) to authenticated;
grant execute on function public.check_in_event_ticket(uuid, text) to authenticated;
grant execute on function public.cancel_event(uuid, text) to authenticated;
grant execute on function public.list_events(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.event_ticket_availability(uuid) to anon, authenticated;
grant execute on function public.my_event_tickets() to authenticated;
grant execute on function public.organizer_event_panel(uuid) to authenticated;
grant execute on function public.submit_event_platform_payment(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_list_event_payments(text) to authenticated;
grant execute on function public.admin_decide_event_payment(uuid, boolean, text) to authenticated;
