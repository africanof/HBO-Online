-- Huambo Online — marketplace: produtos, carrinho, encomendas por vendedor, estados e notificações

alter table public.products
  add column if not exists media jsonb not null default '[]'::jsonb,
  add column if not exists municipality_id uuid references public.municipalities(id);
create index if not exists products_active_idx on public.products(created_at desc) where active;
create index if not exists products_seller_idx on public.products(seller_id);

alter table public.orders
  add column if not exists seller_id uuid references auth.users(id),
  add column if not exists contact_phone text,
  add column if not exists delivery_text text,
  add column if not exists buyer_note text;
create index if not exists orders_seller_idx on public.orders(seller_id, created_at desc);
create index if not exists orders_buyer_idx on public.orders(buyer_id, created_at desc);
create unique index if not exists cart_items_cart_product_uidx on public.cart_items(cart_id, product_id);
create unique index if not exists carts_user_uidx on public.carts(user_id);

-- O vendedor vê as suas encomendas
create policy orders_seller_read on public.orders for select to authenticated using (seller_id = auth.uid());
create policy orders_admin_read on public.orders for select to authenticated using (public.has_admin_role());
create policy order_items_admin_read on public.order_items for select to authenticated using (public.has_admin_role());

-- Encomendas só mudam pelas funções do servidor (impede marcar "pago" por conta própria)
create or replace function public.guard_order_write()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  raise exception 'USE_ORDER_FUNCTIONS';
end $$;
-- apagar encomendas não tem regra RLS, por isso já é impossível pela API
create trigger trg_guard_order_write before insert or update on public.orders
  for each row execute function public.guard_order_write();
grant execute on function public.guard_order_write() to authenticated;

-- Atribuir entrega: só administração
create or replace function public.assign_delivery(p_delivery_id uuid, p_assignee uuid)
returns public.delivery_requests language plpgsql security definer set search_path = public as $$
declare v public.delivery_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into v from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v.status not in ('pending','assigned') then raise exception 'DELIVERY_NOT_ASSIGNABLE'; end if;
  update public.delivery_requests set assigned_to = p_assignee, status = 'assigned', assigned_at = now() where id = p_delivery_id returning * into v;
  return v;
end $$;

-- Catálogo de produtos com vendedor e localização
create or replace function public.product_catalog(p_query text default '', p_category_id uuid default null,
  p_municipality_id uuid default null, p_seller_id uuid default null, p_limit integer default 40)
returns table(id uuid, seller_id uuid, seller_name text, business_id uuid, business_name text, name text, description text,
  category_id uuid, category_name text, price numeric, currency text, stock integer, media jsonb,
  municipality_id uuid, municipality_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'), p.business_id, b.name, p.name, p.description,
         p.category_id, c.name, p.price, p.currency, p.stock, p.media, p.municipality_id, m.name, p.created_at
  from public.products p
  left join public.profiles pr on pr.id = p.seller_id
  left join public.businesses b on b.id = p.business_id
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  where p.active and coalesce(pr.status, 'active') = 'active'
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (p_seller_id is null or p.seller_id = p_seller_id)
    and (coalesce(p_query, '') = '' or lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(p_query) || '%')
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
grant execute on function public.product_catalog(text, uuid, uuid, uuid, integer) to anon, authenticated;

-- Carrinho
create or replace function public.cart_add(p_product_id uuid, p_quantity integer default 1)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; p public.products;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.products where id = p_product_id and active;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p.seller_id = auth.uid() then raise exception 'CANNOT_BUY_OWN_PRODUCT'; end if;
  insert into public.carts(user_id) values (auth.uid()) on conflict (user_id) do update set updated_at = now() returning id into cid;
  insert into public.cart_items(cart_id, product_id, quantity) values (cid, p_product_id, least(p_quantity, greatest(p.stock, 1)))
  on conflict (cart_id, product_id) do update set quantity = least(public.cart_items.quantity + excluded.quantity, greatest(p.stock, 1));
end $$;

-- Tirar do carrinho: a app apaga a linha diretamente (RLS: só o próprio carrinho)
create or replace function public.cart_set_quantity(p_product_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_quantity, 0) < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null then return; end if;
  update public.cart_items ci set quantity = least(p_quantity, greatest(p.stock, 1))
  from public.products p where ci.cart_id = cid and ci.product_id = p_product_id and p.id = ci.product_id;
end $$;

create or replace function public.cart_contents()
returns table(product_id uuid, name text, price numeric, currency text, stock integer, active boolean, media jsonb,
  seller_id uuid, seller_name text, quantity integer, line_total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.price, p.currency, p.stock, p.active, p.media, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'),
         ci.quantity, p.price * ci.quantity
  from public.carts c join public.cart_items ci on ci.cart_id = c.id join public.products p on p.id = ci.product_id
  left join public.profiles pr on pr.id = p.seller_id
  where c.user_id = auth.uid()
  order by pr.full_name, p.name;
$$;

-- Finalizar compra: uma encomenda por vendedor, stock descontado, vendedores notificados
create or replace function public.place_orders(p_fulfillment text, p_payment_method text, p_contact_phone text,
  p_delivery_text text default null, p_note text default null)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_fulfillment not in ('delivery','pickup') then raise exception 'INVALID_FULFILLMENT'; end if;
  if p_payment_method not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and nullif(trim(p_delivery_text), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid) then raise exception 'CART_EMPTY'; end if;
  -- trava os produtos e valida o stock
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid loop
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and p.seller_id = s.seller_id;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, 0, sub, 'unpaid', p_payment_method,
      p_fulfillment, 'pending', trim(p_contact_phone), nullif(trim(p_delivery_text), ''), nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || sub || ' Kz.', jsonb_build_object('order_id', oid));
    ids := ids || oid;
  end loop;
  return ids;
end $$;

-- Estados da encomenda: vendedor avança; comprador cancela enquanto está pendente
create or replace function public.update_order_status(p_order_id uuid, p_status text, p_paid boolean default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; is_seller boolean; is_buyer boolean; label text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  is_seller := o.seller_id = auth.uid() or public.has_admin_role();
  is_buyer := o.buyer_id = auth.uid();
  if not (is_seller or is_buyer) then raise exception 'NOT_ORDER_PARTY'; end if;
  if p_status not in ('pending','confirmed','processing','ready','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if o.status in ('completed','cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if not is_seller and not (p_status = 'cancelled' and o.status = 'pending') then raise exception 'BUYER_CAN_ONLY_CANCEL_PENDING'; end if;
  if p_status = 'cancelled' then
    update public.products p set stock = p.stock + oi.quantity, updated_at = now()
    from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
  end if;
  update public.orders set status = p_status,
    fulfillment_status = case p_status when 'completed' then 'delivered' when 'cancelled' then 'cancelled' else fulfillment_status end,
    payment_status = case when is_seller and p_paid is true then 'paid' when p_status = 'completed' and payment_method = 'cash_on_delivery' then 'paid' else payment_status end,
    updated_at = now()
  where id = o.id returning * into o;
  label := case p_status when 'confirmed' then 'confirmada' when 'processing' then 'em preparação' when 'ready' then 'pronta'
    when 'completed' then 'concluída' when 'cancelled' then 'cancelada' else p_status end;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when auth.uid() = o.buyer_id then o.seller_id else o.buyer_id end, 'order', 'Encomenda ' || label,
          'A encomenda de ' || o.total || ' Kz foi ' || label || '.', jsonb_build_object('order_id', o.id));
  return o;
end $$;

create or replace function public.my_orders(p_role text default 'buyer')
returns table(id uuid, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text,
  created_at timestamptz, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.buyer_id, o.seller_id,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.cart_add(uuid, integer)', 'public.cart_set_quantity(uuid, integer)', 'public.cart_contents()',
    'public.place_orders(text, text, text, text, text)', 'public.update_order_status(uuid, text, boolean)', 'public.my_orders(text)',
    'public.assign_delivery(uuid, uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- checkout_cart antigo (sem vendedor por encomenda) fica desativado; usar place_orders
revoke all on function public.checkout_cart(uuid, uuid, numeric) from public, anon, authenticated;

-- Artigos já encomendados ficam marcados (ordered_at) e deixam de contar no carrinho;
-- a app limpa-os depois. Assim uma falha da app nunca gera encomendas repetidas.
alter table public.cart_items add column if not exists ordered_at timestamptz;

create or replace function public.cart_add(p_product_id uuid, p_quantity integer default 1)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; p public.products;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.products where id = p_product_id and active;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p.seller_id = auth.uid() then raise exception 'CANNOT_BUY_OWN_PRODUCT'; end if;
  insert into public.carts(user_id) values (auth.uid()) on conflict (user_id) do update set updated_at = now() returning id into cid;
  insert into public.cart_items(cart_id, product_id, quantity) values (cid, p_product_id, least(p_quantity, greatest(p.stock, 1)))
  on conflict (cart_id, product_id) do update set
    quantity = least(case when public.cart_items.ordered_at is null then public.cart_items.quantity else 0 end + excluded.quantity, greatest(p.stock, 1)),
    ordered_at = null;
end $$;

create or replace function public.cart_contents()
returns table(product_id uuid, name text, price numeric, currency text, stock integer, active boolean, media jsonb,
  seller_id uuid, seller_name text, quantity integer, line_total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.price, p.currency, p.stock, p.active, p.media, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'),
         ci.quantity, p.price * ci.quantity
  from public.carts c join public.cart_items ci on ci.cart_id = c.id join public.products p on p.id = ci.product_id
  left join public.profiles pr on pr.id = p.seller_id
  where c.user_id = auth.uid() and ci.ordered_at is null
  order by pr.full_name, p.name;
$$;

create or replace function public.place_orders(p_fulfillment text, p_payment_method text, p_contact_phone text,
  p_delivery_text text default null, p_note text default null)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_fulfillment not in ('delivery','pickup') then raise exception 'INVALID_FULFILLMENT'; end if;
  if p_payment_method not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and nullif(trim(p_delivery_text), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid and ordered_at is null) then raise exception 'CART_EMPTY'; end if;
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid and ci.ordered_at is null for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and ci.ordered_at is null and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null loop
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, 0, sub, 'unpaid', p_payment_method,
      p_fulfillment, 'pending', trim(p_contact_phone), nullif(trim(p_delivery_text), ''), nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.ordered_at is null and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || sub || ' Kz.', jsonb_build_object('order_id', oid));
    ids := ids || oid;
  end loop;
  update public.cart_items set ordered_at = now() where cart_id = cid and ordered_at is null;
  return ids;
end $$;
