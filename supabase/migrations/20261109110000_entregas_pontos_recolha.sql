-- Compra como na Vinted: entrega em casa por estafeta ou num ponto de recolha, com preço.
-- O preço da entrega fica em orders.courier_fee: é do Huambo Online/estafeta, nunca entra no saldo de quem vende.

-- 1) Preços por município (a equipa muda na administração). Começa só com o município do Huambo.
create table if not exists public.delivery_fees (
  municipality_id uuid primary key references public.municipalities(id) on delete cascade,
  home_fee numeric check (home_fee is null or home_fee >= 0),
  point_fee numeric check (point_fee is null or point_fee >= 0),
  eta_text text not null default '1 a 2 dias úteis',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.delivery_fees enable row level security;
drop policy if exists delivery_fees_read on public.delivery_fees;
create policy delivery_fees_read on public.delivery_fees for select to anon, authenticated using (active);
revoke insert, update, delete on public.delivery_fees from anon, authenticated;
insert into public.delivery_fees(municipality_id, home_fee, point_fee)
select id, 2500, 1500 from public.municipalities where name = 'Huambo' and province_id in (select id from public.provinces where name = 'Huambo')
on conflict do nothing;

-- 2) Pontos de recolha (lojas parceiras).
create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 3 and 300),
  directions text check (directions is null or char_length(directions) <= 300),
  municipality_id uuid not null references public.municipalities(id),
  geo_lat numeric, geo_lng numeric,
  hours text check (hours is null or char_length(hours) <= 160),
  phone text check (phone is null or char_length(phone) <= 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((geo_lat is null and geo_lng is null) or (geo_lat between -18.1 and -4.3 and geo_lng between 11.6 and 24.2))
);
alter table public.pickup_points enable row level security;
drop policy if exists pickup_points_read on public.pickup_points;
create policy pickup_points_read on public.pickup_points for select to anon, authenticated using (active or public.has_admin_role());
revoke insert, update, delete on public.pickup_points from anon, authenticated;

create or replace function public.admin_save_pickup_point(p_id uuid, p_name text, p_address text, p_directions text, p_municipality_id uuid,
  p_lat numeric, p_lng numeric, p_hours text, p_phone text, p_active boolean)
returns public.pickup_points language plpgsql security definer set search_path = public as $$
declare v public.pickup_points;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_id is null then
    insert into public.pickup_points(name, address, directions, municipality_id, geo_lat, geo_lng, hours, phone, active)
    values (trim(p_name), trim(p_address), nullif(trim(coalesce(p_directions, '')), ''), p_municipality_id, p_lat, p_lng, nullif(trim(coalesce(p_hours, '')), ''), nullif(trim(coalesce(p_phone, '')), ''), coalesce(p_active, true))
    returning * into v;
  else
    update public.pickup_points set name = trim(p_name), address = trim(p_address), directions = nullif(trim(coalesce(p_directions, '')), ''), municipality_id = p_municipality_id,
      geo_lat = p_lat, geo_lng = p_lng, hours = nullif(trim(coalesce(p_hours, '')), ''), phone = nullif(trim(coalesce(p_phone, '')), ''), active = coalesce(p_active, true), updated_at = now()
     where id = p_id returning * into v;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return v;
end $$;
revoke all on function public.admin_save_pickup_point(uuid, text, text, text, uuid, numeric, numeric, text, text, boolean) from public, anon;
grant execute on function public.admin_save_pickup_point(uuid, text, text, text, uuid, numeric, numeric, text, text, boolean) to authenticated;

create or replace function public.admin_save_delivery_fee(p_municipality_id uuid, p_home_fee numeric, p_point_fee numeric, p_eta text, p_active boolean)
returns public.delivery_fees language plpgsql security definer set search_path = public as $$
declare v public.delivery_fees;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if (p_home_fee is not null and p_home_fee < 0) or (p_point_fee is not null and p_point_fee < 0) then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.delivery_fees(municipality_id, home_fee, point_fee, eta_text, active)
  values (p_municipality_id, p_home_fee, p_point_fee, coalesce(nullif(trim(coalesce(p_eta, '')), ''), '1 a 2 dias úteis'), coalesce(p_active, true))
  on conflict (municipality_id) do update set home_fee = excluded.home_fee, point_fee = excluded.point_fee, eta_text = excluded.eta_text, active = excluded.active, updated_at = now()
  returning * into v;
  return v;
end $$;
revoke all on function public.admin_save_delivery_fee(uuid, numeric, numeric, text, boolean) from public, anon;
grant execute on function public.admin_save_delivery_fee(uuid, numeric, numeric, text, boolean) to authenticated;

-- 3) Opções de entrega que a pessoa vê na compra.
create or replace function public.delivery_options()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'home', coalesce((select jsonb_agg(jsonb_build_object('municipality_id', f.municipality_id, 'municipality', m.name, 'fee', f.home_fee, 'eta', f.eta_text) order by m.name)
                      from public.delivery_fees f join public.municipalities m on m.id = f.municipality_id where f.active and f.home_fee is not null), '[]'::jsonb),
    'points', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address, 'directions', p.directions, 'municipality', m.name,
                        'lat', p.geo_lat, 'lng', p.geo_lng, 'hours', p.hours, 'fee', f.point_fee, 'eta', f.eta_text) order by m.name, p.name)
                      from public.pickup_points p join public.municipalities m on m.id = p.municipality_id
                      join public.delivery_fees f on f.municipality_id = p.municipality_id and f.active and f.point_fee is not null
                      where p.active), '[]'::jsonb))
$$;
revoke all on function public.delivery_options() from public;
grant execute on function public.delivery_options() to anon, authenticated;

-- 4) Encomendas: ponto de recolha e preço do estafeta.
alter table public.orders add column if not exists courier_fee numeric not null default 0 check (courier_fee >= 0);
alter table public.orders add column if not exists pickup_point_id uuid references public.pickup_points(id);
alter table public.orders add column if not exists delivery_municipality_id uuid references public.municipalities(id);
alter table public.orders drop constraint if exists orders_fulfillment_type_check;
alter table public.orders add constraint orders_fulfillment_type_check check (fulfillment_type = any (array['delivery', 'pickup', 'point']));
create index if not exists orders_pickup_point_idx on public.orders(pickup_point_id) where pickup_point_id is not null;

-- O saldo de quem vende não inclui o preço da entrega (pagamento recebido e libertação).
do $m$
declare src text;
begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'escrow_mark_paid' and pronamespace = 'public'::regnamespace;
  if position('courier_fee' in src) = 0 then
    src := replace(src, $a$'pending', 'sale', o.total, 'Pagamento recebido · '$a$, $a$'pending', 'sale', o.total - coalesce(o.courier_fee, 0), 'Pagamento recebido · '$a$);
    if position('courier_fee' in src) = 0 then raise exception 'escrow_mark_paid: texto esperado não encontrado'; end if;
    execute src;
  end if;
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'escrow_release' and pronamespace = 'public'::regnamespace;
  if position('courier_fee' in src) = 0 then
    src := replace(src, $a$net := o.total - o.refunded_amount;$a$, $a$net := o.total - coalesce(o.courier_fee, 0) - o.refunded_amount;$a$);
    if position('courier_fee' in src) = 0 then raise exception 'escrow_release: texto esperado não encontrado'; end if;
    execute src;
  end if;
end $m$;

-- 5) Compra protegida com a escolha de entrega (a versão antiga continua a funcionar para APPs antigas).
create or replace function public.protected_buy_listing_v2(p_listing_id uuid, p_fulfillment text, p_contact_phone text, p_delivery_text text default null,
  p_note text default null, p_municipality_id uuid default null, p_pickup_point_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare oid uuid; fee numeric := 0; mun uuid; pt public.pickup_points; o public.orders; base_ful text;
begin
  if p_fulfillment not in ('pickup', 'delivery', 'point') then raise exception 'INVALID_FULFILLMENT'; end if;
  if p_fulfillment = 'point' then
    select * into pt from public.pickup_points where id = p_pickup_point_id and active;
    if not found then raise exception 'PICKUP_POINT_REQUIRED'; end if;
    select point_fee into fee from public.delivery_fees where municipality_id = pt.municipality_id and active;
    if fee is null then raise exception 'DELIVERY_NOT_AVAILABLE'; end if;
    mun := pt.municipality_id;
  elsif p_fulfillment = 'delivery' then
    select home_fee into fee from public.delivery_fees where municipality_id = p_municipality_id and active;
    if fee is null then raise exception 'DELIVERY_NOT_AVAILABLE'; end if;
    mun := p_municipality_id;
  end if;
  -- A compra normal valida tudo (anúncio, preço, proposta aceite, reserva…). «Ponto» entra como levantamento.
  base_ful := case when p_fulfillment = 'point' then 'pickup' else p_fulfillment end;
  oid := public.protected_buy_listing(p_listing_id, base_ful, p_contact_phone,
           case when p_fulfillment = 'point' then null else p_delivery_text end, p_note);
  select * into o from public.orders where id = oid for update;
  -- Encomenda já existente desta pessoa (ainda por pagar): só atualiza a escolha de entrega.
  if o.escrow_status = 'awaiting_payment' then
    update public.orders set fulfillment_type = p_fulfillment, courier_fee = coalesce(fee, 0), delivery_fee = coalesce(fee, 0),
      total = subtotal + coalesce(fee, 0), pickup_point_id = pt.id, delivery_municipality_id = mun,
      contact_phone = coalesce(nullif(trim(coalesce(p_contact_phone, '')), ''), contact_phone),
      delivery_text = case when p_fulfillment = 'delivery' then nullif(trim(coalesce(p_delivery_text, '')), '') when p_fulfillment = 'point' then left(pt.name || ' — ' || pt.address, 300) else delivery_text end,
      updated_at = now()
     where id = o.id;
  end if;
  return oid;
end $$;
revoke all on function public.protected_buy_listing_v2(uuid, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.protected_buy_listing_v2(uuid, text, text, text, text, uuid, uuid) to authenticated;

-- 6) Depois do pagamento, a entrega aparece aos estafetas; ao chegar ao ponto, quem compra é avisado.
create or replace function public.courier_delivery_on_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.delivery_requests; pt public.pickup_points;
begin
  if new.escrow_status = 'held' and old.escrow_status is distinct from 'held' and new.courier_fee > 0 and new.fulfillment_type in ('delivery', 'point')
     and not exists (select 1 from public.delivery_requests x where x.order_id = new.id and x.status <> 'cancelled') then
    if new.fulfillment_type = 'point' then select * into pt from public.pickup_points where id = new.pickup_point_id; end if;
    insert into public.delivery_requests(order_id, requester_id, status, notes)
    values (new.id, new.buyer_id, 'pending', left(case when new.fulfillment_type = 'point' then '📦 Levar ao ponto de recolha: ' || coalesce(pt.name || ' — ' || pt.address, '')
                                                    else '🏠 Entregar em: ' || coalesce(new.delivery_text, '') end, 500))
    returning * into d;
    insert into public.notifications(user_id, type, title, body, data)
    select c.user_id, 'delivery', 'Nova entrega disponível', 'Encomenda ' || public.order_ref(new) || ' · ' || public.money_label(new.courier_fee, new.currency) || ' de entrega.',
           jsonb_build_object('delivery_id', d.id, 'for', 'courier')
    from public.couriers c where c.status = 'approved' and c.available and c.user_id not in (new.seller_id, new.buyer_id) limit 100;
    insert into public.notifications(user_id, type, title, body, data) values
      (new.seller_id, 'delivery', 'Um estafeta vai buscar o artigo 🛵', 'Prepare «' || left(coalesce(new.title, ''), 60) || '». O estafeta do Huambo Online vai buscá-lo e levá-lo a quem comprou.',
       jsonb_build_object('order_id', new.id, 'for', 'sale'));
  end if;
  return new;
end $$;
revoke all on function public.courier_delivery_on_paid() from public, anon, authenticated;
drop trigger if exists courier_delivery_on_paid on public.orders;
create trigger courier_delivery_on_paid after update of escrow_status on public.orders for each row execute function public.courier_delivery_on_paid();

create or replace function public.pickup_ready_notice()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; pt public.pickup_points;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    select * into o from public.orders where id = new.order_id;
    if o.fulfillment_type = 'point' then
      select * into pt from public.pickup_points where id = o.pickup_point_id;
      insert into public.notifications(user_id, type, title, body, data)
      values (o.buyer_id, 'delivery', '📦 Já pode levantar', '«' || left(coalesce(o.title, ''), 60) || '» está em ' || coalesce(pt.name || ' (' || pt.address || ')', 'o ponto de recolha')
                || coalesce('. Horário: ' || pt.hours, '') || '. Depois de levantar, confirme a receção na encomenda.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pickup_ready_notice() from public, anon, authenticated;
drop trigger if exists pickup_ready_notice on public.delivery_requests;
create trigger pickup_ready_notice after update of status on public.delivery_requests for each row execute function public.pickup_ready_notice();
