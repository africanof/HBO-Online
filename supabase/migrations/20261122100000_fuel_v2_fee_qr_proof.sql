-- Combustível v2: taxa do APP (10%) paga pelo comprador e mostrada antes de reservar,
-- pagamento sempre para as contas do posto, comprovativo obrigatório, QR único por pedido
-- e bloqueio de referências/comprovativos repetidos (anti-burla).

update public.platform_settings set fuel_fee_pct = 10 where id = 1;
alter table public.platform_settings alter column fuel_fee_pct set default 10;

alter table public.fuel_orders
  add column if not exists subtotal numeric,
  add column if not exists qr_token text,
  add column if not exists proof_path text,
  add column if not exists proof_hash text,
  add column if not exists reference_norm text;
update public.fuel_orders set subtotal = total where subtotal is null;
update public.fuel_orders set qr_token = replace(gen_random_uuid()::text, '-', '') where qr_token is null;
alter table public.fuel_orders alter column subtotal set not null;
alter table public.fuel_orders alter column qr_token set not null;
alter table public.fuel_orders alter column qr_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.fuel_orders add constraint fuel_orders_qr_token_key unique (qr_token);
create index if not exists fuel_orders_reference_norm on public.fuel_orders(reference_norm) where reference_norm is not null;
create index if not exists fuel_orders_proof_hash on public.fuel_orders(proof_hash) where proof_hash is not null;

-- O posto pode ver o comprovativo que o comprador enviou para um pedido do seu posto.
create policy payment_proofs_fuel_station_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and exists (select 1 from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id
    where o.proof_path = storage.objects.name and s.owner_id = (select auth.uid())));

-- Reservar: total = combustível + taxa do APP. O código e o QR nascem já aqui (no posto) ou ao pagar (adiantado).
create or replace function public.reserve_fuel(p_product_id uuid, p_quantity numeric, p_method text, p_name text, p_phone text default null, p_plate text default null)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.fuel_products; s public.fuel_stations; st public.platform_settings; o public.fuel_orders; left_ numeric; sub numeric; fee numeric;
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
  if exists (select 1 from public.fuel_orders where buyer_id = me and product = p.product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')) then raise exception 'FUEL_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  sub := round(p.price * p_quantity);
  fee := round(sub * st.fuel_fee_pct / 100);
  insert into public.fuel_orders(station_id, product_id, product, buyer_id, buyer_name, buyer_phone, plate, quantity, unit_price, subtotal, fee_pct, fee_amount, total,
    method, status, code, hold_until, pay_by)
  values (s.id, p.id, p.product, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), nullif(upper(trim(coalesce(p_plate, ''))), ''),
    p_quantity, p.price, sub, st.fuel_fee_pct, fee, sub + fee, p_method,
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

-- A versão antiga (sem comprovativo) deixa de servir.
create or replace function public.submit_fuel_payment(p_order_id uuid, p_method text, p_reference text)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
begin raise exception 'FUEL_PROOF_REQUIRED'; end $$;

-- Enviar o pagamento: referência + comprovativo obrigatórios; não se aceita uma referência ou um comprovativo já usado.
create or replace function public.submit_fuel_payment_v2(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text default null)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found or o.buyer_id <> me then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'FUEL_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'FUEL_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.fuel_orders x where x.id <> o.id and x.reference_norm = ref_n) then raise exception 'FUEL_REFERENCE_USED'; end if;
  if h is not null and exists (select 1 from public.fuel_orders x where x.id <> o.id and x.proof_hash = h) then raise exception 'FUEL_PROOF_USED'; end if;
  update public.fuel_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, code = coalesce(code, public.new_fuel_code()), note = null, updated_at = now()
    where id = o.id returning * into o;
  select * into s from public.fuel_stations where id = o.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', '⛽ Pagamento com comprovativo para confirmar', 'C-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · confirme na sua conta bancária.',
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $$;

-- O posto confirma (o código/QR já existe) ou recusa.
create or replace function public.decide_fuel_payment(p_order_id uuid, p_confirm boolean, p_note text default null)
returns public.fuel_orders language plpgsql security definer set search_path = public as $$
declare o public.fuel_orders; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if o.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.fuel_orders set status = 'paid', code = coalesce(code, public.new_fuel_code()), hold_until = now() + make_interval(mins => s.hold_minutes), note = txt, updated_at = now()
      where id = o.id returning * into o;
  else
    update public.fuel_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '⛽ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': levante ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' até ' || to_char(o.hold_until at time zone 'Africa/Luanda', 'DD/MM HH24:MI') || '. Mostre o QR no posto.'
         else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_orders'));
  return o;
end $$;

-- Levantar: a taxa já foi calculada ao reservar; aqui só passa a contar como devida pelo posto.
create or replace function public.collect_fuel(p_station_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.fuel_stations; o public.fuel_orders; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
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
  update public.fuel_orders set status = 'collected', collected_at = now(), updated_at = now() where id = o.id returning * into o;
  update public.fuel_products set reservable_qty = greatest(0, reservable_qty - o.quantity) where id = o.product_id;
  return jsonb_build_object('result', 'ok', 'code', c, 'buyer', o.buyer_name, 'plate', o.plate, 'product', o.product, 'quantity', o.quantity,
    'total', o.total, 'fee', o.fee_amount, 'method', o.method);
end $$;

-- Ler o QR: o posto (ou a administração) vê tudo; o comprador vê o seu pedido; outra pessoa só sabe se o QR é verdadeiro.
create or replace function public.fuel_order_by_token(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid(); t text := lower(regexp_replace(coalesce(p_token, ''), '[^A-Fa-f0-9]', '', 'g')); role_ text;
begin
  if char_length(t) <> 32 then return jsonb_build_object('result', 'invalid'); end if;
  select * into o from public.fuel_orders where qr_token = t;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into s from public.fuel_stations where id = o.station_id;
  role_ := case when me is not null and s.owner_id = me then 'station' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and o.buyer_id = me then 'buyer' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'ref_no', o.ref_no, 'status', o.status, 'product', o.product, 'quantity', o.quantity,
      'station_id', s.id, 'station_name', s.name);
  end if;
  return jsonb_build_object('result', 'ok', 'role', role_, 'id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'method', o.method, 'product', o.product,
    'quantity', o.quantity, 'unit_price', o.unit_price, 'subtotal', o.subtotal, 'fee_pct', o.fee_pct, 'fee_amount', o.fee_amount, 'total', o.total,
    'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'plate', o.plate, 'code', o.code, 'hold_until', o.hold_until, 'pay_method', o.pay_method,
    'reference', o.reference, 'proof_path', o.proof_path, 'note', o.note, 'created_at', o.created_at, 'collected_at', o.collected_at,
    'station_id', s.id, 'station_name', s.name);
end $$;

-- Os meus pedidos: agora com taxa, QR e comprovativo.
create or replace function public.my_fuel_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.unit_price, o.subtotal, o.fee_pct, o.fee_amount, o.total, o.code,
      case when o.status in ('reserved', 'submitted', 'paid') then o.qr_token end qr_token,
      o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.plate,
      o.created_at, s.id station_id, s.name station_name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id left join public.fuel_station_pay y on y.station_id = s.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$$;

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
      select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.subtotal, o.fee_amount, o.total, o.buyer_name, o.buyer_phone, o.plate, o.code, o.qr_token,
        o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.collected_at
      from public.fuel_orders o where o.station_id = s.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.fuel_platform_payments p where p.station_id = s.id order by p.created_at desc limit 50) x));
end $$;

-- Administração: ver os pagamentos adiantados com comprovativo (auditoria contra burlas).
create or replace function public.admin_list_fuel_orders(p_status text default 'submitted') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.subtotal, o.fee_amount, o.total, o.buyer_name, o.buyer_phone, o.reference, o.proof_path,
      o.qr_token, o.note, o.created_at, s.id station_id, s.ref_no station_ref, s.name station_name
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id
    where o.method = 'prepaid' and (coalesce(p_status, '') = '' or o.status = p_status) order by o.created_at desc limit 200) x);
end $$;

revoke all on function public.submit_fuel_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.submit_fuel_payment_v2(uuid, text, text, text, text) from public, anon;
grant execute on function public.submit_fuel_payment_v2(uuid, text, text, text, text) to authenticated;
revoke all on function public.admin_list_fuel_orders(text) from public, anon;
grant execute on function public.admin_list_fuel_orders(text) to authenticated;
revoke all on function public.fuel_order_by_token(text) from public;
grant execute on function public.fuel_order_by_token(text) to anon, authenticated;

-- Correção: as tabelas do combustível ficaram sem permissões para a API (as regras RLS continuam a decidir o que cada um vê).
grant select on public.fuel_stations to anon, authenticated;
grant insert, update on public.fuel_stations to authenticated;
grant select, insert, update on public.fuel_station_pay to authenticated;
grant select on public.fuel_products to anon, authenticated;
grant insert, update, delete on public.fuel_products to authenticated;
grant select, insert, delete on public.fuel_alerts to authenticated;
grant select on public.fuel_orders to authenticated;
grant select on public.fuel_platform_payments to authenticated;
grant update (fuel_fee_pct, fuel_pay_minutes) on public.platform_settings to authenticated;
