-- Pedidos mediados pela equipa (intermediária total).
--
-- Encomendas da Loja, reservas em hotéis/restaurantes, reservas nos postos, bilhetes de eventos,
-- pedidos de serviço, propostas em anúncios e pedidos de aluguer chegam primeiro à equipa
-- (administradores e moderadores). O vendedor/posto/organizador/profissional só vê o pedido
-- (e só recebe o aviso) depois de a equipa o reencaminhar.
-- O telefone e a morada/ponto de entrega do comprador ficam numa área privada; a equipa decide,
-- ao reencaminhar, se os partilha com quem vai tratar do pedido.

-- ───────────── Colunas de mediação ─────────────
do $$
declare t text;
begin
  foreach t in array array['orders','venue_orders','fuel_orders','event_orders','service_requests','listing_offers','rental_requests'] loop
    execute format('alter table public.%I add column if not exists team_forwarded_at timestamptz,
      add column if not exists team_forwarded_by uuid references auth.users(id) on delete set null,
      add column if not exists team_note text,
      add column if not exists team_shared_contact boolean not null default false,
      add column if not exists team_declined_at timestamptz', t);
    execute format('create index if not exists %I on public.%I (created_at) where team_forwarded_at is null and team_declined_at is null', t || '_team_pending_idx', t);
  end loop;
end $$;

-- Quem pediu (comprador/cliente) em cada tipo de pedido.
create or replace function public.request_requester(p_kind text, p_id uuid)
 returns uuid
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare r uuid;
begin
  case p_kind
    when 'orders' then select buyer_id into r from public.orders where id = p_id;
    when 'venue_orders' then select buyer_id into r from public.venue_orders where id = p_id;
    when 'fuel_orders' then select buyer_id into r from public.fuel_orders where id = p_id;
    when 'event_orders' then select buyer_id into r from public.event_orders where id = p_id;
    when 'service_requests' then select client_id into r from public.service_requests where id = p_id;
    when 'listing_offers' then select buyer_id into r from public.listing_offers where id = p_id;
    when 'rental_requests' then select renter_id into r from public.rental_requests where id = p_id;
    else r := null;
  end case;
  return r;
end $function$;
revoke all on function public.request_requester(text, uuid) from public, anon, authenticated;

-- Só a equipa mexe nas colunas de mediação; os pedidos novos começam sempre «à espera da equipa».
create or replace function public.guard_team_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    new.team_forwarded_at := null; new.team_forwarded_by := null; new.team_note := null;
    new.team_shared_contact := false; new.team_declined_at := null;
  elsif not public.has_admin_role() and coalesce(current_setting('huambo.team_action', true), '') <> 'on' then
    new.team_forwarded_at := old.team_forwarded_at; new.team_forwarded_by := old.team_forwarded_by; new.team_note := old.team_note;
    new.team_shared_contact := old.team_shared_contact; new.team_declined_at := old.team_declined_at;
  end if;
  return new;
end $function$;
revoke all on function public.guard_team_request() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['orders','venue_orders','fuel_orders','event_orders','service_requests','listing_offers','rental_requests'] loop
    execute format('drop trigger if exists trg_guard_team_request on public.%I', t);
    execute format('create trigger trg_guard_team_request before insert or update on public.%I for each row execute function public.guard_team_request()', t);
  end loop;
end $$;

-- ───────────── Contactos do comprador em privado ─────────────
create table if not exists public.request_private_contacts (
  kind text not null,
  request_id uuid not null,
  phone text,
  delivery_text text,
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_address_id uuid,
  delivery_notes text,
  updated_at timestamptz not null default now(),
  primary key (kind, request_id)
);
alter table public.request_private_contacts enable row level security;
revoke all on public.request_private_contacts from public, anon, authenticated;
grant select on public.request_private_contacts to authenticated;
create policy request_private_contacts_read on public.request_private_contacts for select to authenticated
  using ((select public.has_admin_role()) or public.request_requester(kind, request_id) = (select auth.uid()));

-- Encomendas da Loja: telefone, morada, ponto e notas de entrega.
create or replace function public.move_order_private_contact()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.team_shared_contact then return new; end if;
  if new.contact_phone is not null or new.delivery_text is not null or new.delivery_lat is not null
     or new.delivery_address_id is not null or new.delivery_notes is not null then
    insert into public.request_private_contacts(kind, request_id, phone, delivery_text, delivery_lat, delivery_lng, delivery_address_id, delivery_notes)
    values ('orders', new.id, new.contact_phone, new.delivery_text, new.delivery_lat, new.delivery_lng, new.delivery_address_id, new.delivery_notes)
    on conflict (kind, request_id) do update set
      phone = coalesce(excluded.phone, request_private_contacts.phone),
      delivery_text = coalesce(excluded.delivery_text, request_private_contacts.delivery_text),
      delivery_lat = coalesce(excluded.delivery_lat, request_private_contacts.delivery_lat),
      delivery_lng = coalesce(excluded.delivery_lng, request_private_contacts.delivery_lng),
      delivery_address_id = coalesce(excluded.delivery_address_id, request_private_contacts.delivery_address_id),
      delivery_notes = coalesce(excluded.delivery_notes, request_private_contacts.delivery_notes),
      updated_at = now();
  end if;
  new.contact_phone := null; new.delivery_text := null; new.delivery_lat := null; new.delivery_lng := null;
  new.delivery_address_id := null; new.delivery_notes := null;
  return new;
end $function$;
revoke all on function public.move_order_private_contact() from public, anon, authenticated;
drop trigger if exists zz_order_private_contact on public.orders;
create trigger zz_order_private_contact before insert or update on public.orders
  for each row execute function public.move_order_private_contact();

-- Reservas (hotéis/restaurantes, postos, bilhetes): telefone do comprador.
create or replace function public.move_buyer_phone_private()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.team_shared_contact then return new; end if;
  if new.buyer_phone is not null then
    insert into public.request_private_contacts(kind, request_id, phone) values (tg_table_name, new.id, new.buyer_phone)
    on conflict (kind, request_id) do update set phone = excluded.phone, updated_at = now();
  end if;
  new.buyer_phone := null;
  return new;
end $function$;
revoke all on function public.move_buyer_phone_private() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['venue_orders','fuel_orders','event_orders'] loop
    execute format('drop trigger if exists zz_buyer_phone_private on public.%I', t);
    execute format('create trigger zz_buyer_phone_private before insert or update on public.%I for each row execute function public.move_buyer_phone_private()', t);
  end loop;
end $$;

-- ───────────── Quem vê os pedidos ─────────────
-- Regra restritiva (soma-se às que já existem): enquanto a equipa não reencaminha,
-- só quem pediu e a equipa veem o pedido.
drop policy if exists orders_team_gate on public.orders;
create policy orders_team_gate on public.orders as restrictive for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists venue_orders_team_gate on public.venue_orders;
create policy venue_orders_team_gate on public.venue_orders as restrictive for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists fuel_orders_team_gate on public.fuel_orders;
create policy fuel_orders_team_gate on public.fuel_orders as restrictive for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists event_orders_team_gate on public.event_orders;
create policy event_orders_team_gate on public.event_orders as restrictive for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists service_requests_team_gate on public.service_requests;
create policy service_requests_team_gate on public.service_requests as restrictive for select to authenticated
  using (client_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists listing_offers_team_gate on public.listing_offers;
create policy listing_offers_team_gate on public.listing_offers as restrictive for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists rental_requests_team_gate on public.rental_requests;
create policy rental_requests_team_gate on public.rental_requests as restrictive for select to authenticated
  using (renter_id = (select auth.uid()) or (select public.has_admin_role()) or team_forwarded_at is not null);
drop policy if exists order_items_team_gate on public.order_items;
create policy order_items_team_gate on public.order_items as restrictive for select to authenticated
  using ((select public.has_admin_role()) or exists (select 1 from public.orders o where o.id = order_id
    and (o.buyer_id = (select auth.uid()) or o.team_forwarded_at is not null)));

-- Painéis e listas do lado de quem vende (funções que não passam pelas regras acima).
do $$
declare p record; def text;
begin
  for p in select * from (values
    ('public.venue_panel(uuid)'::regprocedure,
      'from public.venue_orders o where o.venue_id = v.id order by',
      'from public.venue_orders o where o.venue_id = v.id and (o.team_forwarded_at is not null or public.has_admin_role()) order by'),
    ('public.fuel_station_panel(uuid)'::regprocedure,
      'from public.fuel_orders o where o.station_id = s.id order by',
      'from public.fuel_orders o where o.station_id = s.id and (o.team_forwarded_at is not null or public.has_admin_role()) order by'),
    ('public.organizer_event_panel(uuid)'::regprocedure,
      'where o.event_id = e.id order by',
      'where o.event_id = e.id and (o.team_forwarded_at is not null or public.has_admin_role()) order by'),
    ('public.listing_offers_for(uuid)'::regprocedure,
      'where o.listing_id = p_listing_id order by',
      'where o.listing_id = p_listing_id and o.team_forwarded_at is not null order by'),
    ('public.my_listing_offer_counts()'::regprocedure,
      'and o.status = ''pending'' group by',
      'and o.status = ''pending'' and o.team_forwarded_at is not null group by'),
    ('public.listing_deal_candidates(uuid)'::regprocedure,
      'o.status in (''pending'', ''accepted'')',
      'o.status in (''pending'', ''accepted'') and o.team_forwarded_at is not null'),
    ('public.my_rental_requests(text)'::regprocedure,
      '(p_role = ''owner'' and l.owner_id = auth.uid())',
      '(p_role = ''owner'' and l.owner_id = auth.uid() and r.team_forwarded_at is not null)'),
    ('public.my_service_requests(text)'::regprocedure,
      'then (s.provider_id = auth.uid() or b.owner_id = auth.uid())',
      'then ((s.provider_id = auth.uid() or b.owner_id = auth.uid()) and s.team_forwarded_at is not null)'),
    ('public.my_service_requests_v2(text)'::regprocedure,
      'then (s.provider_id = auth.uid() or b.owner_id = auth.uid())',
      'then ((s.provider_id = auth.uid() or b.owner_id = auth.uid()) and s.team_forwarded_at is not null)'),
    ('public.my_orders(text)'::regprocedure,
      '(p_role = ''seller'' and o.seller_id = auth.uid())',
      '(p_role = ''seller'' and o.seller_id = auth.uid() and o.team_forwarded_at is not null)'),
    ('public.my_orders_v2(text)'::regprocedure,
      '(p_role = ''seller'' and o.seller_id = auth.uid())',
      '(p_role = ''seller'' and o.seller_id = auth.uid() and o.team_forwarded_at is not null)'),
    ('public.my_orders_v3(text)'::regprocedure,
      '(p_role = ''seller'' and o.seller_id = auth.uid())',
      '(p_role = ''seller'' and o.seller_id = auth.uid() and o.team_forwarded_at is not null)'),
    -- quem comprou continua a ver a sua morada de entrega
    ('public.my_orders(text)'::regprocedure, ' o.delivery_text, o.buyer_note,',
      ' coalesce(o.delivery_text, case when p_role <> ''seller'' then (select c.delivery_text from public.request_private_contacts c where c.kind = ''orders'' and c.request_id = o.id) end), o.buyer_note,'),
    ('public.my_orders_v2(text)'::regprocedure, ' o.delivery_text, o.buyer_note,',
      ' coalesce(o.delivery_text, case when p_role <> ''seller'' then (select c.delivery_text from public.request_private_contacts c where c.kind = ''orders'' and c.request_id = o.id) end), o.buyer_note,'),
    ('public.my_orders_v3(text)'::regprocedure, ' o.delivery_text, o.buyer_note,',
      ' coalesce(o.delivery_text, case when p_role <> ''seller'' then (select c.delivery_text from public.request_private_contacts c where c.kind = ''orders'' and c.request_id = o.id) end), o.buyer_note,'),
    -- leitura do QR: antes de a equipa reencaminhar, o posto/hotel/organizador vê só o resumo
    ('public.fuel_order_by_token(text)'::regprocedure,
      'when me is not null and s.owner_id = me then ''station''',
      'when me is not null and s.owner_id = me and o.team_forwarded_at is not null then ''station'''),
    ('public.venue_order_by_token(text)'::regprocedure,
      'when me is not null and v.owner_id = me then ''venue''',
      'when me is not null and v.owner_id = me and o.team_forwarded_at is not null then ''venue'''),
    ('public.ticket_by_code(text)'::regprocedure,
      'when me is not null and e.organizer_id = me then ''organizer''',
      'when me is not null and e.organizer_id = me and exists (select 1 from public.event_orders eo where eo.id = t.order_id and eo.team_forwarded_at is not null) then ''organizer''')
  ) as x(fn, old_text, new_text) loop
    def := pg_get_functiondef(p.fn);
    if position(p.old_text in def) = 0 then
      if position(p.new_text in def) > 0 then continue; end if; -- já aplicado
      raise exception 'Texto não encontrado em %: %', p.fn, p.old_text;
    end if;
    execute replace(def, p.old_text, p.new_text);
  end loop;
end $$;

-- ───────────── Avisos retidos ─────────────
-- Avisos ao vendedor sobre um pedido ainda não reencaminhado ficam guardados e só saem
-- quando a equipa reencaminha. Quem pediu e a equipa recebem os avisos normalmente.
create table if not exists public.held_notifications (
  id bigint generated always as identity primary key,
  kind text not null,
  request_id uuid not null,
  notification jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists held_notifications_request_idx on public.held_notifications (kind, request_id);
alter table public.held_notifications enable row level security;
revoke all on public.held_notifications from public, anon, authenticated;

create or replace function public.pending_request_for(p_value text)
 returns table(kind text, request_id uuid, requester uuid)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v uuid;
begin
  if p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
  v := p_value::uuid;
  return query
    select 'orders', id, buyer_id from public.orders where id = v and team_forwarded_at is null
    union all select 'venue_orders', id, buyer_id from public.venue_orders where id = v and team_forwarded_at is null
    union all select 'fuel_orders', id, buyer_id from public.fuel_orders where id = v and team_forwarded_at is null
    union all select 'event_orders', id, buyer_id from public.event_orders where id = v and team_forwarded_at is null
    union all select 'service_requests', id, client_id from public.service_requests where id = v and team_forwarded_at is null
    union all select 'listing_offers', id, buyer_id from public.listing_offers where id = v and team_forwarded_at is null
    union all select 'rental_requests', id, renter_id from public.rental_requests where id = v and team_forwarded_at is null;
end $function$;
revoke all on function public.pending_request_for(text) from public, anon, authenticated;

create or replace function public.hold_seller_notification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare kv record; pr record;
begin
  if coalesce(current_setting('huambo.release_notifications', true), '') = 'on' or new.data is null or jsonb_typeof(new.data) <> 'object' then
    return new;
  end if;
  if exists (select 1 from public.user_roles where user_id = new.user_id and role in ('admin', 'moderator')) then return new; end if;
  for kv in select value from jsonb_each_text(new.data) loop
    for pr in select * from public.pending_request_for(kv.value) loop
      if pr.requester is distinct from new.user_id then
        insert into public.held_notifications(kind, request_id, notification) values (pr.kind, pr.request_id, to_jsonb(new));
        return null;
      end if;
    end loop;
  end loop;
  return new;
end $function$;
revoke all on function public.hold_seller_notification() from public, anon, authenticated;
drop trigger if exists aa_hold_seller_notification on public.notifications;
create trigger aa_hold_seller_notification before insert on public.notifications
  for each row execute function public.hold_seller_notification();

-- ───────────── Ferramentas da equipa ─────────────

/** Pedidos para a equipa (os que esperam primeiro). */
create or replace function public.admin_list_team_requests(p_pending_only boolean default true, p_limit integer default 100)
 returns table(kind text, id uuid, ref_no bigint, created_at timestamptz, status text, requester_id uuid, requester_name text,
               counterpart_id uuid, counterpart_name text, title text, amount numeric, details text,
               phone text, delivery_text text, delivery_lat numeric, delivery_lng numeric,
               forwarded_at timestamptz, declined_at timestamptz, shared_contact boolean, team_note text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  with r as (
    select 'orders'::text k, o.id, o.ref_no, o.created_at, o.status, o.buyer_id req, o.seller_id cp,
           'Encomenda da Loja'::text title, o.total amount, o.buyer_note det, o.team_forwarded_at fa, o.team_declined_at da, o.team_shared_contact sc, o.team_note tn
      from public.orders o
    union all select 'venue_orders', o.id, o.ref_no, o.created_at, o.status, o.buyer_id, v.owner_id,
           'Reserva: ' || coalesce(b.name, 'estabelecimento'), o.total, o.buyer_note, o.team_forwarded_at, o.team_declined_at, o.team_shared_contact, o.team_note
      from public.venue_orders o join public.venues v on v.id = o.venue_id left join public.businesses b on b.id = v.business_id
    union all select 'fuel_orders', o.id, o.ref_no, o.created_at, o.status, o.buyer_id, s.owner_id,
           'Posto: ' || s.name || ' · ' || o.product || ' × ' || o.quantity, o.total, o.plate, o.team_forwarded_at, o.team_declined_at, o.team_shared_contact, o.team_note
      from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id
    union all select 'event_orders', o.id, o.ref_no, o.created_at, o.status, o.buyer_id, e.organizer_id,
           'Bilhetes: ' || e.title || ' × ' || o.quantity, o.total, o.note, o.team_forwarded_at, o.team_declined_at, o.team_shared_contact, o.team_note
      from public.event_orders o join public.events e on e.id = o.event_id
    union all select 'service_requests', s.id, null::bigint, s.created_at, s.status, s.client_id, coalesce(s.provider_id, b.owner_id),
           'Pedido de serviço: ' || coalesce(pp.display_name, b.name, ''), null::numeric, s.description, s.team_forwarded_at, s.team_declined_at, s.team_shared_contact, s.team_note
      from public.service_requests s left join public.provider_profiles pp on pp.user_id = s.provider_id left join public.businesses b on b.id = s.business_id
    union all select 'listing_offers', o.id, null::bigint, o.created_at, o.status, o.buyer_id, l.owner_id,
           'Proposta: ' || l.title, o.amount, concat_ws(' · ', o.trade_item, o.message), o.team_forwarded_at, o.team_declined_at, o.team_shared_contact, o.team_note
      from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
    union all select 'rental_requests', q.id, null::bigint, q.created_at, q.status, q.renter_id, l.owner_id,
           'Aluguer: ' || l.title, q.proposed_price, q.message, q.team_forwarded_at, q.team_declined_at, q.team_shared_contact, q.team_note
      from public.rental_requests q join public.classified_listings l on l.id = q.listing_id
  )
  select r.k, r.id, r.ref_no, r.created_at, r.status, r.req, coalesce(nullif(p1.full_name, ''), 'Utilizador'),
         r.cp, coalesce(nullif(p2.full_name, ''), 'Utilizador'), r.title, r.amount, r.det,
         c.phone, c.delivery_text, c.delivery_lat, c.delivery_lng, r.fa, r.da, r.sc, r.tn
  from r
  left join public.profiles p1 on p1.id = r.req
  left join public.profiles p2 on p2.id = r.cp
  left join public.request_private_contacts c on c.kind = r.k and c.request_id = r.id
  where not coalesce(p_pending_only, true) or (r.fa is null and r.da is null)
  order by (r.fa is null and r.da is null) desc, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
end $function$;
revoke all on function public.admin_list_team_requests(boolean, integer) from public, anon;
grant execute on function public.admin_list_team_requests(boolean, integer) to authenticated;

create or replace function public.admin_pending_requests_count()
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when not public.has_admin_role() then 0 else
    (select count(*) from public.orders where team_forwarded_at is null and team_declined_at is null)
  + (select count(*) from public.venue_orders where team_forwarded_at is null and team_declined_at is null)
  + (select count(*) from public.fuel_orders where team_forwarded_at is null and team_declined_at is null)
  + (select count(*) from public.event_orders where team_forwarded_at is null and team_declined_at is null)
  + (select count(*) from public.service_requests where team_forwarded_at is null and team_declined_at is null)
  + (select count(*) from public.listing_offers where team_forwarded_at is null and team_declined_at is null)
  + (select count(*) from public.rental_requests where team_forwarded_at is null and team_declined_at is null) end;
$function$;
revoke all on function public.admin_pending_requests_count() from public, anon;
grant execute on function public.admin_pending_requests_count() to authenticated;

/**
 * Reencaminhar um pedido a quem o vai tratar. Com p_share_contact, o telefone e a morada/ponto
 * de entrega do comprador passam a estar visíveis para essa pessoa. p_note vai no aviso.
 */
create or replace function public.team_forward_request(p_kind text, p_id uuid, p_note text default null, p_share_contact boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare c public.request_private_contacts; n record; cnt int; note text := nullif(trim(coalesce(p_note, '')), ''); cp uuid;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_kind not in ('orders','venue_orders','fuel_orders','event_orders','service_requests','listing_offers','rental_requests') then raise exception 'INVALID_KIND'; end if;
  perform set_config('huambo.team_action', 'on', true);
  select * into c from public.request_private_contacts where kind = p_kind and request_id = p_id;
  if p_kind = 'orders' then
    update public.orders set team_forwarded_at = now(), team_forwarded_by = auth.uid(), team_note = left(note, 1000), team_declined_at = null,
      team_shared_contact = coalesce(p_share_contact, false),
      contact_phone = case when p_share_contact then c.phone end, delivery_text = case when p_share_contact then c.delivery_text end,
      delivery_lat = case when p_share_contact then c.delivery_lat end, delivery_lng = case when p_share_contact then c.delivery_lng end,
      delivery_address_id = case when p_share_contact then c.delivery_address_id end, delivery_notes = case when p_share_contact then c.delivery_notes end
    where id = p_id and team_forwarded_at is null returning seller_id into cp;
  elsif p_kind in ('venue_orders','fuel_orders','event_orders') then
    execute format('update public.%I set team_forwarded_at = now(), team_forwarded_by = $1, team_note = left($2, 1000), team_declined_at = null,
      team_shared_contact = $3, buyer_phone = case when $3 then $4 end where id = $5 and team_forwarded_at is null', p_kind)
      using auth.uid(), note, coalesce(p_share_contact, false), c.phone, p_id;
  else
    execute format('update public.%I set team_forwarded_at = now(), team_forwarded_by = $1, team_note = left($2, 1000), team_declined_at = null
      where id = $3 and team_forwarded_at is null', p_kind) using auth.uid(), note, p_id;
  end if;
  get diagnostics cnt = row_count;
  if cnt = 0 then raise exception 'REQUEST_NOT_PENDING'; end if;

  -- Soltar os avisos retidos (com a nota da equipa, se houver).
  perform set_config('huambo.release_notifications', 'on', true);
  for n in select * from public.held_notifications where kind = p_kind and request_id = p_id order by id loop
    insert into public.notifications(user_id, type, title, body, data)
    values ((n.notification->>'user_id')::uuid, n.notification->>'type', n.notification->>'title',
            concat_ws(E'\n', n.notification->>'body', case when note is not null then '🛡️ Equipa Huambo Online: ' || note end),
            coalesce(n.notification->'data', '{}'::jsonb) || jsonb_build_object('team_note', note));
  end loop;
  delete from public.held_notifications where kind = p_kind and request_id = p_id;
  perform set_config('huambo.release_notifications', '', true);
  perform set_config('huambo.team_action', '', true);

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'forward_request', p_kind, p_id, jsonb_build_object('shared_contact', coalesce(p_share_contact, false), 'note', note));
end $function$;
revoke all on function public.team_forward_request(text, uuid, text, boolean) from public, anon;
grant execute on function public.team_forward_request(text, uuid, text, boolean) to authenticated;

/** Recusar um pedido sem o reencaminhar: avisa quem pediu com o motivo. */
create or replace function public.team_decline_request(p_kind text, p_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare cnt int; who uuid; reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_kind not in ('orders','venue_orders','fuel_orders','event_orders','service_requests','listing_offers','rental_requests') then raise exception 'INVALID_KIND'; end if;
  if reason is null then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('huambo.team_action', 'on', true);
  execute format('update public.%I set team_declined_at = now(), team_forwarded_by = $1, team_note = left($2, 1000)
    where id = $3 and team_forwarded_at is null and team_declined_at is null', p_kind) using auth.uid(), reason, p_id;
  get diagnostics cnt = row_count;
  perform set_config('huambo.team_action', '', true);
  if cnt = 0 then raise exception 'REQUEST_NOT_PENDING'; end if;
  delete from public.held_notifications where kind = p_kind and request_id = p_id;
  who := public.request_requester(p_kind, p_id);
  if who is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (who, 'system', 'O seu pedido não foi reencaminhado', '🛡️ Equipa Huambo Online: ' || left(reason, 300),
            jsonb_build_object('kind', p_kind, 'request_id', p_id));
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'decline_request', p_kind, p_id, jsonb_build_object('reason', reason));
end $function$;
revoke all on function public.team_decline_request(text, uuid, text) from public, anon;
grant execute on function public.team_decline_request(text, uuid, text) to authenticated;

-- Pedidos que já existiam continuam como estavam (já tinham chegado a quem os trata).
do $$
declare t text;
begin
  perform set_config('huambo.team_action', 'on', true);
  foreach t in array array['orders','venue_orders','fuel_orders','event_orders','service_requests','listing_offers','rental_requests'] loop
    execute format('update public.%I set team_forwarded_at = created_at, team_shared_contact = true where team_forwarded_at is null', t);
  end loop;
  perform set_config('huambo.team_action', '', true);
end $$;
