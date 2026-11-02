-- Rastreio de encomendas: o comprador (e o vendedor e a equipa) veem o caminho da encomenda passo a
-- passo, com a hora de cada passo, e — durante a entrega — onde está o estafeta.
--   • order_tracking_events: histórico gravado sozinho por gatilhos nas encomendas e nas entregas
--   • courier_share_location: o estafeta partilha a posição (só enquanto a entrega está ativa)
--   • order_tracking(id): tudo o que o ecrã de rastreio precisa, só para as partes e a equipa
-- A posição do estafeta só é mostrada durante a entrega e se tiver menos de 30 minutos.

create table if not exists public.order_tracking_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_tracking_events_order_idx on public.order_tracking_events (order_id, created_at);
alter table public.order_tracking_events enable row level security;
revoke all on public.order_tracking_events from public, anon, authenticated;
grant select on public.order_tracking_events to authenticated;
create policy order_tracking_events_parties_read on public.order_tracking_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and ((select auth.uid()) in (o.buyer_id, o.seller_id) or public.has_admin_role())));
grant usage, select on all sequences in schema public to authenticated, service_role;

alter table public.delivery_requests
  add column if not exists courier_lat numeric,
  add column if not exists courier_lng numeric,
  add column if not exists courier_located_at timestamptz;

/** Grava os passos da encomenda (criada, paga, aprovada pela equipa, estados do vendedor, recebida…). */
create or replace function public.track_order_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.order_tracking_events(order_id, kind) values (new.id, 'placed');
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status and new.payment_status in ('paid', 'refunded') then
    insert into public.order_tracking_events(order_id, kind) values (new.id, new.payment_status);
  end if;
  if new.team_forwarded_at is not null and old.team_forwarded_at is null then
    insert into public.order_tracking_events(order_id, kind) values (new.id, 'team_approved');
  end if;
  if new.team_declined_at is not null and old.team_declined_at is null then
    insert into public.order_tracking_events(order_id, kind, note) values (new.id, 'team_declined', left(new.team_note, 300));
  end if;
  if new.status is distinct from old.status and new.status in ('confirmed', 'processing', 'ready', 'completed', 'cancelled') then
    insert into public.order_tracking_events(order_id, kind) values (new.id, 'status_' || new.status);
  end if;
  if new.received_at is not null and old.received_at is null then
    insert into public.order_tracking_events(order_id, kind) values (new.id, 'received');
  end if;
  return new;
end $function$;
revoke all on function public.track_order_change() from public, anon, authenticated;
drop trigger if exists zz_track_order_change on public.orders;
create trigger zz_track_order_change after insert or update on public.orders for each row execute function public.track_order_change();

/** Grava os passos da entrega (estafeta pedido, atribuído, recolheu, a caminho, entregue…). */
create or replace function public.track_delivery_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare who text;
begin
  if new.order_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.order_tracking_events(order_id, kind) values (new.order_id, 'courier_requested');
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('assigned', 'accepted') and new.assigned_to is not null then
      select display_name into who from public.couriers where user_id = new.assigned_to;
    end if;
    if new.status = 'pending' and old.status in ('assigned', 'accepted') then
      insert into public.order_tracking_events(order_id, kind) values (new.order_id, 'courier_released');
    elsif new.status in ('assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled') then
      insert into public.order_tracking_events(order_id, kind, note) values (new.order_id, 'courier_' || new.status, who);
    end if;
  end if;
  return new;
end $function$;
revoke all on function public.track_delivery_change() from public, anon, authenticated;
drop trigger if exists zz_track_delivery_change on public.delivery_requests;
create trigger zz_track_delivery_change after insert or update on public.delivery_requests for each row execute function public.track_delivery_change();

/** Terminada a entrega, a posição do estafeta é apagada. */
create or replace function public.clear_courier_location()
 returns trigger
 language plpgsql
 as $function$
begin
  if new.status in ('delivered', 'cancelled', 'pending') then
    new.courier_lat := null; new.courier_lng := null; new.courier_located_at := null;
  end if;
  return new;
end $function$;
drop trigger if exists trg_clear_courier_location on public.delivery_requests;
create trigger trg_clear_courier_location before update on public.delivery_requests for each row execute function public.clear_courier_location();

/** O estafeta partilha onde está (só o estafeta da entrega, só enquanto ela está ativa, só em Angola). */
create or replace function public.courier_share_location(p_delivery_id uuid, p_lat numeric, p_lng numeric)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare d public.delivery_requests;
begin
  select * into d from public.delivery_requests where id = p_delivery_id;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.assigned_to is distinct from auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  if d.status not in ('assigned', 'accepted', 'picked_up', 'in_transit') then raise exception 'INVALID_DELIVERY_STEP'; end if;
  if p_lat is null or p_lng is null or p_lat not between -18.1 and -4.3 or p_lng not between 11.6 and 24.2 then raise exception 'INVALID_LOCATION'; end if;
  update public.delivery_requests set courier_lat = round(p_lat, 5), courier_lng = round(p_lng, 5), courier_located_at = now() where id = d.id;
end $function$;
revoke all on function public.courier_share_location(uuid, numeric, numeric) from public, anon;
grant execute on function public.courier_share_location(uuid, numeric, numeric) to authenticated;

/** Rastreio de uma encomenda: passos, entrega e posição do estafeta. Só comprador, vendedor e equipa. */
create or replace function public.order_tracking(p_order_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare o public.orders; d public.delivery_requests; c public.couriers; live boolean;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not (auth.uid() in (o.buyer_id, o.seller_id) or public.has_admin_role()) then raise exception 'NOT_FOUND'; end if;
  select * into d from public.delivery_requests where order_id = o.id order by requested_at desc limit 1;
  if d.assigned_to is not null then select * into c from public.couriers where user_id = d.assigned_to; end if;
  live := d.id is not null and d.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
          and d.courier_located_at is not null and d.courier_located_at > now() - interval '30 minutes';
  return jsonb_build_object(
    'order', jsonb_build_object('id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'payment_status', o.payment_status, 'payment_method', o.payment_method,
      'fulfillment_type', o.fulfillment_type, 'fulfillment_status', o.fulfillment_status, 'protected', o.protected, 'escrow_status', o.escrow_status,
      'created_at', o.created_at, 'paid_at', o.paid_at, 'delivered_at', o.delivered_at, 'received_at', o.received_at,
      'team_forwarded_at', o.team_forwarded_at, 'team_declined_at', o.team_declined_at),
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'note', e.note, 'at', e.created_at) order by e.created_at, e.id)
                        from public.order_tracking_events e where e.order_id = o.id), '[]'::jsonb),
    'delivery', case when d.id is null then null else jsonb_build_object('status', d.status, 'requested_at', d.requested_at, 'assigned_at', d.assigned_at,
      'delivered_at', d.delivered_at, 'courier_name', c.display_name, 'courier_vehicle', c.vehicle,
      'lat', case when live then d.courier_lat end, 'lng', case when live then d.courier_lng end, 'located_at', case when live then d.courier_located_at end) end
  );
end $function$;
revoke all on function public.order_tracking(uuid) from public, anon;
grant execute on function public.order_tracking(uuid) to authenticated;

-- Encomendas que já existem: reconstruir os passos a partir das datas guardadas.
insert into public.order_tracking_events(order_id, kind, created_at)
select o.id, x.kind, x.at from public.orders o
cross join lateral (values ('placed', o.created_at), ('paid', o.paid_at), ('team_approved', o.team_forwarded_at), ('team_declined', o.team_declined_at),
  ('status_completed', o.completed_at), ('received', o.received_at)) as x(kind, at)
where x.at is not null and not exists (select 1 from public.order_tracking_events e where e.order_id = o.id);
