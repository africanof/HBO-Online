-- Estafetas e entregas (Huambo Online). Escritas só por funções do servidor.

create table if not exists public.couriers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  phone text not null check (char_length(phone) between 6 and 30),
  vehicle text not null default 'moto' check (vehicle in ('moto', 'carro', 'carrinha', 'bicicleta', 'a_pe')),
  municipality_id uuid references public.municipalities(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.couriers enable row level security;
create policy couriers_self_read on public.couriers for select to authenticated using (user_id = auth.uid() or public.has_admin_role());
revoke all on public.couriers from anon;
revoke insert, update, delete on public.couriers from authenticated;
grant select on public.couriers to authenticated;
create trigger trg_guard_couriers_write before insert or update on public.couriers
  for each row execute function public.guard_server_only_write();
create trigger trg_guard_delivery_write before insert or update on public.delivery_requests
  for each row execute function public.guard_server_only_write();
create index if not exists delivery_requests_status_idx on public.delivery_requests(status, requested_at desc);
create index if not exists delivery_requests_order_idx on public.delivery_requests(order_id);

create or replace function public.is_approved_courier() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.couriers where user_id = auth.uid() and status = 'approved');
$$;

create or replace function public.register_courier(p_name text, p_phone text, p_vehicle text, p_municipality_id uuid)
returns public.couriers language plpgsql security definer set search_path = public as $$
declare c public.couriers;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.couriers(user_id, display_name, phone, vehicle, municipality_id)
  values (auth.uid(), trim(p_name), trim(p_phone), coalesce(p_vehicle, 'moto'), p_municipality_id)
  on conflict (user_id) do update set display_name = excluded.display_name, phone = excluded.phone,
    vehicle = excluded.vehicle, municipality_id = excluded.municipality_id, updated_at = now()
  returning * into c;
  return c;
end $$;

create or replace function public.set_courier_available(p_available boolean)
returns public.couriers language plpgsql security definer set search_path = public as $$
declare c public.couriers;
begin
  update public.couriers set available = p_available, updated_at = now() where user_id = auth.uid() returning * into c;
  if not found then raise exception 'NOT_COURIER'; end if;
  return c;
end $$;

create or replace function public.admin_list_couriers()
returns table(user_id uuid, display_name text, phone text, vehicle text, municipality text, status text, available boolean,
  created_at timestamptz, delivered bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.user_id, c.display_name, c.phone, c.vehicle, m.name, c.status, c.available, c.created_at,
    (select count(*) from public.delivery_requests d where d.assigned_to = c.user_id and d.status = 'delivered')
  from public.couriers c left join public.municipalities m on m.id = c.municipality_id
  order by (c.status = 'pending') desc, c.created_at desc limit 300;
end $$;

create or replace function public.admin_set_courier_status(p_user_id uuid, p_status text)
returns public.couriers language plpgsql security definer set search_path = public as $$
declare c public.couriers;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  update public.couriers set status = p_status, updated_at = now() where user_id = p_user_id returning * into c;
  if not found then raise exception 'NOT_COURIER'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (p_user_id, 'delivery', case p_status when 'approved' then 'Conta de estafeta aprovada' else 'Conta de estafeta suspensa' end,
    case p_status when 'approved' then 'Já pode aceitar entregas no Huambo Online.' else 'Contacte a administração para mais informações.' end,
    jsonb_build_object('for', 'courier'));
  return c;
end $$;

-- O vendedor pede um estafeta para uma encomenda com entrega ao domicílio.
create or replace function public.request_order_delivery(p_order_id uuid, p_notes text default null)
returns public.delivery_requests language plpgsql security definer set search_path = public as $$
declare o public.orders; d public.delivery_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.seller_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_ORDER_PARTY'; end if;
  if o.fulfillment_type <> 'delivery' then raise exception 'ORDER_IS_PICKUP'; end if;
  if o.status in ('completed', 'cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.delivery_requests x where x.order_id = o.id and x.status not in ('delivered', 'cancelled')) then
    raise exception 'DELIVERY_ALREADY_REQUESTED';
  end if;
  insert into public.delivery_requests(order_id, requester_id, status, notes)
  values (o.id, auth.uid(), 'pending', nullif(trim(coalesce(p_notes, '')), '')) returning * into d;
  update public.orders set fulfillment_status = 'pending', updated_at = now() where id = o.id;
  insert into public.notifications(user_id, type, title, body, data)
  select c.user_id, 'delivery', 'Nova entrega disponível', 'Encomenda de ' || o.total || ' Kz para entregar.',
         jsonb_build_object('delivery_id', d.id, 'for', 'courier')
  from public.couriers c where c.status = 'approved' and c.available and c.user_id <> o.seller_id limit 100;
  return d;
end $$;

create or replace function public.cancel_delivery_request(p_delivery_id uuid)
returns public.delivery_requests language plpgsql security definer set search_path = public as $$
declare d public.delivery_requests;
begin
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.requester_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  if d.status not in ('pending', 'assigned', 'accepted') then raise exception 'DELIVERY_IN_PROGRESS'; end if;
  update public.delivery_requests set status = 'cancelled' where id = d.id returning * into d;
  if d.assigned_to is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (d.assigned_to, 'delivery', 'Entrega cancelada', 'O vendedor cancelou o pedido de entrega.', jsonb_build_object('delivery_id', d.id, 'for', 'courier'));
  end if;
  return d;
end $$;

-- Entregas à espera de estafeta (o telefone do cliente só aparece depois de aceitar).
create or replace function public.available_deliveries()
returns table(id uuid, order_id uuid, requested_at timestamptz, notes text, total numeric, currency text,
  delivery_text text, seller_name text, seller_municipality text, items jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_approved_courier() then raise exception 'NOT_APPROVED_COURIER'; end if;
  return query select d.id, d.order_id, d.requested_at, d.notes, o.total, o.currency, o.delivery_text,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), sp.municipality,
    (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity) order by p.name), '[]')
       from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id
  where d.status = 'pending' and o.seller_id <> auth.uid() and o.buyer_id <> auth.uid()
  order by d.requested_at limit 100;
end $$;

create or replace function public.claim_delivery(p_delivery_id uuid)
returns public.delivery_requests language plpgsql security definer set search_path = public as $$
declare d public.delivery_requests; o public.orders; c public.couriers;
begin
  select * into c from public.couriers where user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'NOT_APPROVED_COURIER'; end if;
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.status <> 'pending' then raise exception 'DELIVERY_ALREADY_TAKEN'; end if;
  select * into o from public.orders where id = d.order_id;
  if o.seller_id = auth.uid() or o.buyer_id = auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  update public.delivery_requests set assigned_to = auth.uid(), status = 'accepted', assigned_at = now() where id = d.id returning * into d;
  update public.orders set fulfillment_status = 'assigned', updated_at = now() where id = o.id;
  insert into public.notifications(user_id, type, title, body, data)
  select u, 'delivery', 'Estafeta a caminho', c.display_name || ' (' || c.phone || ') vai fazer a entrega.', jsonb_build_object('delivery_id', d.id, 'order_id', o.id)
  from unnest(array[o.seller_id, o.buyer_id]) u;
  return d;
end $$;

-- O estafeta atualiza o estado: picked_up, in_transit, delivered, ou released (devolve a entrega à lista).
create or replace function public.update_delivery_status(p_delivery_id uuid, p_status text)
returns public.delivery_requests language plpgsql security definer set search_path = public as $$
declare d public.delivery_requests; o public.orders; label text; allowed boolean;
begin
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.assigned_to is distinct from auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  allowed := case p_status
    when 'picked_up' then d.status in ('assigned', 'accepted')
    when 'in_transit' then d.status in ('assigned', 'accepted', 'picked_up')
    when 'delivered' then d.status in ('picked_up', 'in_transit')
    when 'released' then d.status in ('assigned', 'accepted')
    else false end;
  if not allowed then raise exception 'INVALID_DELIVERY_STEP'; end if;
  select * into o from public.orders where id = d.order_id;
  if p_status = 'released' then
    update public.delivery_requests set status = 'pending', assigned_to = null, assigned_at = null where id = d.id returning * into d;
    update public.orders set fulfillment_status = 'pending', updated_at = now() where id = o.id;
    label := 'O estafeta desistiu. A entrega voltou à lista de espera.';
  else
    update public.delivery_requests set status = p_status, delivered_at = case when p_status = 'delivered' then now() else delivered_at end
    where id = d.id returning * into d;
    update public.orders set fulfillment_status = case p_status when 'delivered' then 'delivered' else 'in_transit' end, updated_at = now() where id = o.id;
    label := case p_status when 'picked_up' then 'O estafeta recolheu a encomenda.' when 'in_transit' then 'A encomenda está a caminho.'
      else 'A encomenda foi entregue.' end;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  select u, 'delivery', 'Entrega atualizada', label, jsonb_build_object('delivery_id', d.id, 'order_id', o.id)
  from unnest(array[o.seller_id, o.buyer_id]) u;
  return d;
end $$;

-- p_role: 'courier' (as minhas entregas como estafeta) ou 'party' (entregas das minhas encomendas, como vendedor ou comprador).
create or replace function public.my_deliveries(p_role text default 'courier')
returns table(id uuid, order_id uuid, status text, notes text, requested_at timestamptz, assigned_at timestamptz, delivered_at timestamptz,
  total numeric, currency text, delivery_text text, contact_phone text, seller_name text, buyer_name text, courier_name text, courier_phone text)
language sql stable security definer set search_path = public as $$
  select d.id, d.order_id, d.status, d.notes, d.requested_at, d.assigned_at, d.delivered_at, o.total, o.currency, o.delivery_text,
    case when p_role = 'courier' or o.seller_id = auth.uid() then o.contact_phone end,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), coalesce(nullif(bp.full_name, ''), 'Cliente'), c.display_name, c.phone
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id
  left join public.profiles bp on bp.id = o.buyer_id
  left join public.couriers c on c.user_id = d.assigned_to
  where (p_role = 'courier' and d.assigned_to = auth.uid())
     or (p_role <> 'courier' and (o.seller_id = auth.uid() or o.buyer_id = auth.uid()))
  order by d.requested_at desc limit 200;
$$;

create or replace function public.admin_list_deliveries()
returns table(id uuid, order_id uuid, status text, requested_at timestamptz, total numeric, delivery_text text, seller_name text, courier_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.status, d.requested_at, o.total, o.delivery_text,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), c.display_name
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id left join public.couriers c on c.user_id = d.assigned_to
  where d.status not in ('delivered', 'cancelled') order by d.requested_at limit 200;
end $$;

do $$ declare f text; begin
  foreach f in array array['public.is_approved_courier()', 'public.register_courier(text, text, text, uuid)', 'public.set_courier_available(boolean)',
    'public.admin_list_couriers()', 'public.admin_set_courier_status(uuid, text)', 'public.request_order_delivery(uuid, text)',
    'public.cancel_delivery_request(uuid)', 'public.available_deliveries()', 'public.claim_delivery(uuid)',
    'public.update_delivery_status(uuid, text)', 'public.my_deliveries(text)', 'public.admin_list_deliveries()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
