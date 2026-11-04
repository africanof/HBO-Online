-- Pagamento protegido também nos bilhetes de eventos, no combustível/gás e nas reservas (hotéis, restaurantes, armazéns).
-- Com o pagamento protegido ligado (platform_settings.protected_enabled):
--  • Não há «pagar no posto / no local / em dinheiro»: tudo é pago adiantado ao Huambo Online
--    (as contas mostradas ao cliente são as do Huambo Online). Reserva de mesa sem nada a pagar continua grátis.
--  • Quem confirma o pagamento é a equipa (não o vendedor). O valor fica guardado no saldo do vendedor (pendente).
--  • Liberta ao ler o código (gás levantado, reserva concluída) ou 1 dia depois do fim do evento — já sem a comissão.
--  • Cancelado depois de pago → a equipa devolve o dinheiro ao cliente (o saldo pendente do vendedor é anulado).
--  • As comissões destes pedidos já não entram nas faturas ao posto/estabelecimento/organizador.
-- As funções existentes são alteradas por substituição de texto verificada (falha se o texto não for encontrado).

create or replace function public.platform_collects() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select protected_enabled from public.platform_settings where id = 1), false);
$$;
grant execute on function public.platform_collects() to anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['fuel_orders', 'venue_orders', 'event_orders'] loop
    execute format('alter table public.%I add column if not exists escrow text, add column if not exists released_at timestamptz', t);
    if not exists (select 1 from pg_constraint where conname = t || '_escrow_check') then
      execute format('alter table public.%I add constraint %I check (escrow is null or escrow in (''held'', ''released'', ''refunded''))', t, t || '_escrow_check');
    end if;
  end loop;
end $$;

-- Substituição verificada no texto de uma função.
create or replace function public._patch_fn(p_fn regprocedure, p_old text, p_new text) returns void language plpgsql as $$
declare d text := pg_get_functiondef(p_fn);
begin
  if strpos(d, p_old) = 0 then raise exception 'PATCH_NOT_FOUND em %: %', p_fn, left(p_old, 80); end if;
  execute replace(d, p_old, p_new);
end $$;

-- ───────────── Combustível e gás ─────────────
select public._patch_fn('public.reserve_fuel(uuid,numeric,text,text,text,text)',
  $o$  if p_method not in ('at_station', 'prepaid') then raise exception 'INVALID_METHOD'; end if;$o$,
  $n$  if public.platform_collects() then p_method := 'prepaid'; end if;
  if p_method not in ('at_station', 'prepaid') then raise exception 'INVALID_METHOD'; end if;$n$);
select public._patch_fn('public.reserve_fuel(uuid,numeric,text,text,text,text)',
  $o$if p_method = 'prepaid' and (not s.accepts_prepay or$o$, $n$if p_method = 'prepaid' and not public.platform_collects() and (not s.accepts_prepay or$n$);
select public._patch_fn('public.submit_fuel_payment_v2(uuid,text,text,text,text)',
  $o$  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', '⛽ Pagamento com comprovativo para confirmar'$o$,
  $n$  if public.platform_collects() then
    perform public.notify_staff('⛽ Pagamento de combustível para confirmar', 'C-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · ' || s.name,
      jsonb_build_object('fuel_order_id', o.id));
    return o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', '⛽ Pagamento com comprovativo para confirmar'$n$);
select public._patch_fn('public.decide_fuel_payment(uuid,boolean,text)',
  $o$  if s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;$o$,
  $n$  if public.platform_collects() then
    if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  elsif s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;$n$);
select public._patch_fn('public.decide_fuel_payment(uuid,boolean,text)',
  $o$      where id = o.id returning * into o;
  else$o$,
  $n$      where id = o.id returning * into o;
    if public.platform_collects() then
      update public.fuel_orders set escrow = 'held' where id = o.id returning * into o;
      perform public.wallet_add(s.owner_id, null, null, 'pending', 'sale', o.subtotal, 'Combustível pago (guardado) · C-' || o.ref_no);
      insert into public.notifications(user_id, type, title, body, data) values (s.owner_id, 'system', '⛽ Pagamento recebido 🛡️',
        'C-' || o.ref_no || ' · ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' · ' || o.buyer_name || '. Entregue ao ler o código; o valor passa ao seu saldo.',
        jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
    end if;
  else$n$);
select public._patch_fn('public.cancel_fuel_order(uuid,text)',
  $o$then ' O posto deve devolver o dinheiro.'$o$, $n$then case when o.escrow is not null then ' O Huambo Online vai devolver o dinheiro.' else ' O posto deve devolver o dinheiro.' end$n$);
create or replace function public.fuel_fee_due(p_station uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select greatest(0, coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected' and escrow is null), 0)
    - coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0))
$$;

-- ───────────── Reservas (hotéis, restaurantes, armazéns) ─────────────
select public._patch_fn('public.reserve_venue(uuid,text,jsonb,text,text,text,date,date,integer,timestamp with time zone,text)',
  $o$  if p_method not in ('at_place', 'prepaid') then raise exception 'INVALID_METHOD'; end if;$o$,
  $n$  if public.platform_collects() then p_method := 'prepaid'; end if;
  if p_method not in ('at_place', 'prepaid') then raise exception 'INVALID_METHOD'; end if;$n$);
select public._patch_fn('public.reserve_venue(uuid,text,jsonb,text,text,text,date,date,integer,timestamp with time zone,text)',
  $o$if p_method = 'prepaid' and (not v.accepts_prepay or$o$, $n$if p_method = 'prepaid' and not public.platform_collects() and (not v.accepts_prepay or$n$);
-- reserva de mesa sem nada a pagar: continua uma reserva simples (grátis)
select public._patch_fn('public.reserve_venue(uuid,text,jsonb,text,text,text,date,date,integer,timestamp with time zone,text)',
  $o$  if p_method = 'prepaid' and sub = 0 then raise exception 'VENUE_NOTHING_TO_PAY'; end if;$o$,
  $n$  if sub = 0 and public.platform_collects() then p_method := 'at_place'; end if;
  if p_method = 'prepaid' and sub = 0 then raise exception 'VENUE_NOTHING_TO_PAY'; end if;$n$);
select public._patch_fn('public.submit_venue_payment(uuid,text,text,text,text)',
  $o$  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', '💳 Pagamento com comprovativo para confirmar'$o$,
  $n$  if public.platform_collects() then
    perform public.notify_staff('💳 Pagamento de reserva para confirmar', 'R-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference,
      jsonb_build_object('venue_order_id', o.id));
    return o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', '💳 Pagamento com comprovativo para confirmar'$n$);
select public._patch_fn('public.decide_venue_payment(uuid,boolean,text)',
  $o$  if v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;$o$,
  $n$  if public.platform_collects() then
    if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  elsif v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;$n$);
select public._patch_fn('public.decide_venue_payment(uuid,boolean,text)',
  $o$ where id = o.id returning * into o;
  else$o$,
  $n$ where id = o.id returning * into o;
    if public.platform_collects() then
      update public.venue_orders set escrow = 'held' where id = o.id returning * into o;
      perform public.wallet_add(v.owner_id, null, null, 'pending', 'sale', o.subtotal - o.business_fee, 'Reserva paga (guardada) · R-' || o.ref_no);
      insert into public.notifications(user_id, type, title, body, data) values (v.owner_id, 'system', '💳 Pagamento recebido 🛡️',
        'R-' || o.ref_no || ' · ' || o.buyer_name || ' · ' || o.total || ' Kz. O valor passa ao seu saldo quando ler o código do cliente.',
        jsonb_build_object('for', 'venue', 'venue_id', v.id));
    end if;
  else$n$);
select public._patch_fn('public.cancel_venue_order(uuid,text)',
  $o$then ' O estabelecimento deve devolver o dinheiro.'$o$, $n$then case when o.escrow is not null then ' O Huambo Online vai devolver o dinheiro.' else ' O estabelecimento deve devolver o dinheiro.' end$n$);
create or replace function public.venue_fee_due(p_venue uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select greatest(0, coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed' and escrow is null), 0)
    - coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0))
$$;

-- ───────────── Bilhetes de eventos ─────────────
select public._patch_fn('public.reserve_event_tickets(uuid,integer,text,text)',
  $o$'. Confirme quando receber o pagamento.'$o$,
  $n$case when public.platform_collects() then '. O cliente paga ao Huambo Online; o valor chega ao seu saldo depois do evento.' else '. Confirme quando receber o pagamento.' end$n$);
select public._patch_fn('public.submit_event_ticket_payment(uuid,text,text)',
  $o$  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;$o$,
  $n$  if public.platform_collects() and p_method = 'cash' then raise exception 'INVALID_METHOD'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;$n$);
select public._patch_fn('public.submit_event_ticket_payment(uuid,text,text)',
  $o$  insert into public.notifications(user_id, type, title, body, data)
  values (e.organizer_id, 'system', 'Pagamento de bilhetes para confirmar'$o$,
  $n$  if public.platform_collects() then
    perform public.notify_staff('🎟️ Pagamento de bilhetes para confirmar', 'B-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · «' || left(e.title, 60) || '»',
      jsonb_build_object('event_order_id', o.id));
    return o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (e.organizer_id, 'system', 'Pagamento de bilhetes para confirmar'$n$);
select public._patch_fn('public.decide_event_ticket_order(uuid,boolean,text)',
  $o$  if e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;$o$,
  $n$  if public.platform_collects() then
    if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  elsif e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;$n$);
select public._patch_fn('public.decide_event_ticket_order(uuid,boolean,text)',
  $o$    perform public.issue_event_tickets(o);
  else$o$,
  $n$    perform public.issue_event_tickets(o);
    if public.platform_collects() and o.total > 0 then
      update public.event_orders set escrow = 'held' where id = o.id returning * into o;
      perform public.wallet_add(e.organizer_id, null, null, 'pending', 'sale', o.total - o.fee_amount, 'Bilhetes pagos (guardado) · B-' || o.ref_no);
      insert into public.notifications(user_id, type, title, body, data) values (e.organizer_id, 'system', 'Bilhetes pagos 🛡️',
        'B-' || o.ref_no || ' · ' || o.quantity || ' bilhete(s) · ' || o.total || ' Kz. O valor (sem a comissão) passa ao seu saldo 1 dia depois do evento.',
        jsonb_build_object('for', 'event_orders', 'event_id', e.id));
    end if;
  else$n$);
create or replace function public.event_fee_due(p_event uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select greatest(0, coalesce((select sum(fee_amount) from public.event_orders where event_id = p_event and status = 'confirmed' and escrow is null), 0)
    - coalesce((select sum(amount) from public.event_platform_payments where event_id = p_event and kind = 'fee' and status = 'confirmed'), 0))
$$;

-- ───────────── Contas mostradas ao cliente: as do Huambo Online ─────────────
select public._patch_fn('public.my_fuel_orders()', $o$then y.holder end pay_holder$o$, $n$then case when public.platform_collects() then (select account_holder from public.platform_settings where id = 1) else y.holder end end pay_holder$n$);
select public._patch_fn('public.my_fuel_orders()', $o$then y.iban end pay_iban$o$, $n$then case when public.platform_collects() then (select iban from public.platform_settings where id = 1) else y.iban end end pay_iban$n$);
select public._patch_fn('public.my_fuel_orders()', $o$then y.express end pay_express$o$, $n$then case when public.platform_collects() then (select express_number from public.platform_settings where id = 1) else y.express end end pay_express$n$);
select public._patch_fn('public.my_fuel_orders()', $o$then y.note end pay_note$o$, $n$then case when public.platform_collects() then '🛡️ Huambo Online (pagamento protegido) · ' || coalesce((select payment_note from public.platform_settings where id = 1), '') else y.note end end pay_note$n$);
select public._patch_fn('public.my_venue_orders()', $o$then y.holder end pay_holder$o$, $n$then case when public.platform_collects() then (select account_holder from public.platform_settings where id = 1) else y.holder end end pay_holder$n$);
select public._patch_fn('public.my_venue_orders()', $o$then y.iban end pay_iban$o$, $n$then case when public.platform_collects() then (select iban from public.platform_settings where id = 1) else y.iban end end pay_iban$n$);
select public._patch_fn('public.my_venue_orders()', $o$then y.express end pay_express$o$, $n$then case when public.platform_collects() then (select express_number from public.platform_settings where id = 1) else y.express end end pay_express$n$);
select public._patch_fn('public.my_venue_orders()', $o$then y.note end pay_note$o$, $n$then case when public.platform_collects() then '🛡️ Huambo Online (pagamento protegido) · ' || coalesce((select payment_note from public.platform_settings where id = 1), '') else y.note end end pay_note$n$);
select public._patch_fn('public.my_event_tickets()',
  $o$pi.holder pay_holder, pi.iban pay_iban, pi.express pay_express, pi.note pay_note$o$,
  $n$case when public.platform_collects() then (select account_holder from public.platform_settings where id = 1) else pi.holder end pay_holder,
      case when public.platform_collects() then (select iban from public.platform_settings where id = 1) else pi.iban end pay_iban,
      case when public.platform_collects() then (select express_number from public.platform_settings where id = 1) else pi.express end pay_express,
      case when public.platform_collects() then '🛡️ Huambo Online (pagamento protegido) · ' || coalesce((select payment_note from public.platform_settings where id = 1), '') else pi.note end pay_note$n$);

drop function public._patch_fn(regprocedure, text, text);

-- ───────────── Libertar e devolver ─────────────
-- Combustível: levantado → liberta; cancelado/expirado/recusado depois de pago → devolve.
create or replace function public.fuel_escrow_move() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare s public.fuel_stations;
begin
  if new.escrow is distinct from 'held' or new.status is not distinct from old.status then return new; end if;
  select * into s from public.fuel_stations where id = new.station_id;
  if new.status = 'collected' then
    perform public.wallet_add(s.owner_id, null, null, 'pending', 'release', -new.subtotal, 'Libertado · C-' || new.ref_no);
    perform public.wallet_add(s.owner_id, null, null, 'available', 'release', new.subtotal, 'Libertado · C-' || new.ref_no);
    update public.fuel_orders set escrow = 'released', released_at = now() where id = new.id;
  elsif new.status in ('cancelled', 'expired', 'rejected') then
    perform public.wallet_add(s.owner_id, null, null, 'pending', 'refund', -new.subtotal, 'Devolvido ao cliente · C-' || new.ref_no);
    update public.fuel_orders set escrow = 'refunded' where id = new.id;
    perform public.notify_staff('Devolver dinheiro ao cliente', 'C-' || new.ref_no || ' · ' || new.total || ' Kz · ' || new.buyer_name || coalesce(' · ' || new.buyer_phone, ''),
      jsonb_build_object('fuel_order_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists fuel_escrow_move on public.fuel_orders;
create trigger fuel_escrow_move after update of status on public.fuel_orders for each row execute function public.fuel_escrow_move();

-- Reservas: concluída (código lido) → liberta; cancelada/expirada/recusada depois de paga → devolve.
create or replace function public.venue_escrow_move() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v public.venues; net numeric;
begin
  if new.escrow is distinct from 'held' or new.status is not distinct from old.status then return new; end if;
  select * into v from public.venues where id = new.venue_id;
  net := new.subtotal - new.business_fee;
  if new.status = 'completed' then
    perform public.wallet_add(v.owner_id, null, null, 'pending', 'release', -net, 'Libertado · R-' || new.ref_no);
    perform public.wallet_add(v.owner_id, null, null, 'available', 'release', net, 'Libertado · R-' || new.ref_no);
    update public.venue_orders set escrow = 'released', released_at = now() where id = new.id;
  elsif new.status in ('cancelled', 'expired', 'rejected') then
    perform public.wallet_add(v.owner_id, null, null, 'pending', 'refund', -net, 'Devolvido ao cliente · R-' || new.ref_no);
    update public.venue_orders set escrow = 'refunded' where id = new.id;
    perform public.notify_staff('Devolver dinheiro ao cliente', 'R-' || new.ref_no || ' · ' || new.total || ' Kz · ' || new.buyer_name || coalesce(' · ' || new.buyer_phone, ''),
      jsonb_build_object('venue_order_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists venue_escrow_move on public.venue_orders;
create trigger venue_escrow_move after update of status on public.venue_orders for each row execute function public.venue_escrow_move();

-- Bilhetes: libertados 1 dia depois do fim do evento; evento cancelado → devolve.
create or replace function public.event_escrow_release(o public.event_orders, p_refund boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare e public.events; net numeric := o.total - o.fee_amount;
begin
  if o.escrow is distinct from 'held' then return; end if;
  select * into e from public.events where id = o.event_id;
  if p_refund then
    perform public.wallet_add(e.organizer_id, null, null, 'pending', 'refund', -net, 'Devolvido ao cliente · B-' || o.ref_no);
    update public.event_orders set escrow = 'refunded' where id = o.id;
    perform public.notify_staff('Devolver dinheiro ao cliente', 'B-' || o.ref_no || ' · ' || o.total || ' Kz · ' || o.buyer_name || coalesce(' · ' || o.buyer_phone, ''),
      jsonb_build_object('event_order_id', o.id));
  else
    perform public.wallet_add(e.organizer_id, null, null, 'pending', 'release', -net, 'Libertado · B-' || o.ref_no);
    perform public.wallet_add(e.organizer_id, null, null, 'available', 'release', net, 'Libertado · B-' || o.ref_no);
    update public.event_orders set escrow = 'released', released_at = now() where id = o.id;
  end if;
end $$;
revoke all on function public.event_escrow_release(public.event_orders, boolean) from public, anon, authenticated;

create or replace function public.events_tick() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer; o public.event_orders;
begin
  with x as (update public.event_orders set status = 'expired', decided_at = now() where status = 'reserved' and pay_by < now() returning 1)
  select count(*) into n from x;
  for o in select eo.* from public.event_orders eo join public.events e on e.id = eo.event_id
      where eo.escrow = 'held' and eo.status = 'confirmed' and e.status <> 'cancelled'
        and coalesce(e.ends_at, e.starts_at + interval '6 hours') + interval '1 day' < now() for update of eo skip locked loop
    perform public.event_escrow_release(o, false);
  end loop;
  return n;
end $$;

create or replace function public.event_cancel_refunds() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare o public.event_orders;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for o in select * from public.event_orders where event_id = new.id and escrow = 'held' for update loop
      perform public.event_escrow_release(o, true);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists event_cancel_refunds on public.events;
create trigger event_cancel_refunds after update of status on public.events for each row execute function public.event_cancel_refunds();

-- Lista para a equipa confirmar os pagamentos de bilhetes.
create or replace function public.admin_list_event_orders(p_status text default 'submitted') returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.quantity, o.total, o.method, o.reference, o.submitted_at, o.created_at, o.buyer_name, o.buyer_phone, o.escrow,
      e.title event_title, e.starts_at
    from public.event_orders o join public.events e on e.id = o.event_id
    where (coalesce(p_status, '') = '' or o.status = p_status) and o.total > 0 order by o.created_at desc limit 200) x);
end $$;
grant execute on function public.admin_list_event_orders(text) to authenticated;
