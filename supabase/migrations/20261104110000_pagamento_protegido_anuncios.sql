-- Pagamento protegido OBRIGATÓRIO nos anúncios (venda, arrendamento, aluguer, propostas e leilões).
-- Cada compra passa a ser uma encomenda protegida (orders), com o mesmo motor da Loja: o comprador paga ao
-- Huambo Online, o dinheiro fica guardado, o vendedor entrega em mão (ou envia), o comprador confirma
-- (ou passam X dias sem reclamação) e o dinheiro passa ao saldo do vendedor, já sem a comissão.
--  • «Comprar/Arrendar com pagamento protegido» no anúncio → protected_buy_listing().
--  • Proposta aceite, leilão ganho e pedido de aluguer aceite → a encomenda é criada sozinha.
--  • Enquanto há uma encomenda por pagar ou paga, o anúncio fica «Reservado» (ninguém mais compra).
--  • Pago → o anúncio passa a vendido/arrendado e NÃO há a comissão separada (é descontada ao libertar).
--  • Arrendamento de imóveis continua grátis para o dono (sem comissão).
--  • Isentos: «Procura-se», emprego/estágios e trocas sem dinheiro.

-- ───────────── Encomendas com origem ─────────────
alter table public.orders add column if not exists source text not null default 'shop',
  add column if not exists listing_id uuid references public.classified_listings(id) on delete set null,
  add column if not exists source_ref uuid,
  add column if not exists title text,
  add column if not exists fee_free boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_source_check') then
    alter table public.orders add constraint orders_source_check check (source in ('shop', 'listing', 'offer', 'auction', 'rental'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_title_len') then
    alter table public.orders add constraint orders_title_len check (title is null or char_length(title) <= 200);
  end if;
end $$;
create index if not exists orders_listing_open_idx on public.orders (listing_id) where listing_id is not null and escrow_status in ('awaiting_payment', 'held');

-- Encomenda aberta (por pagar ou paga) de um anúncio.
create or replace function public.listing_open_order(p_listing uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select o.id from public.orders o where o.listing_id = p_listing and o.protected and o.status <> 'cancelled'
    and o.escrow_status in ('awaiting_payment', 'held') order by o.created_at desc limit 1;
$$;
-- Para o anúncio mostrar «Reservado» (sem dizer quem comprou).
create or replace function public.listing_reserved(p_listing uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$ select public.listing_open_order(p_listing) is not null; $$;
grant execute on function public.listing_reserved(uuid) to anon, authenticated;

-- Cria a encomenda protegida de um anúncio (uso interno).
create or replace function public.create_listing_order(l public.classified_listings, p_buyer uuid, p_amount numeric, p_source text, p_ref uuid,
  p_fulfillment text default 'pickup', p_phone text default null, p_delivery text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare st public.platform_settings; oid uuid; what text;
begin
  select * into st from public.platform_settings where id = 1;
  if p_amount is null or p_amount <= 0 then raise exception 'PRICE_REQUIRED'; end if;
  what := case when l.purpose = 'rent' then 'arrendamento' when l.purpose = 'lease' or p_source = 'rental' then 'aluguer' else 'compra' end;
  insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
    fulfillment_type, fulfillment_status, contact_phone, delivery_text, buyer_note, protected, escrow_status, pay_by,
    source, listing_id, source_ref, title, fee_free)
  values (p_buyer, l.owner_id, 'pending', coalesce(l.currency, 'AOA'), p_amount, 0, p_amount, 'unpaid', 'reference',
    case when p_fulfillment = 'delivery' then 'delivery' else 'pickup' end, 'pending', nullif(trim(coalesce(p_phone, '')), ''),
    case when p_fulfillment = 'delivery' then nullif(trim(coalesce(p_delivery, '')), '') end, nullif(left(trim(coalesce(p_note, '')), 500), ''),
    true, 'awaiting_payment', now() + make_interval(hours => coalesce(st.payment_window_hours, 24)),
    p_source, l.id, p_ref, left(l.title, 200), public.listing_commission_free(l))
  returning id into oid;
  insert into public.notifications(user_id, type, title, body, data) values
    (l.owner_id, 'order', 'Nova ' || what || ' 🛡️', '«' || left(l.title, 80) || '»: ' || p_amount || ' Kz com pagamento protegido. '
      || 'Espere pelo aviso «Pagamento recebido» antes de entregar.', jsonb_build_object('order_id', oid, 'for', 'sale')),
    (p_buyer, 'order', 'Pague para garantir 🛡️', '«' || left(l.title, 80) || '»: pague ' || p_amount || ' Kz em ' || coalesce(st.payment_window_hours, 24)
      || ' horas. O dinheiro fica guardado pelo Huambo Online até receber.', jsonb_build_object('order_id', oid, 'for', 'purchase'));
  return oid;
end $$;
revoke all on function public.create_listing_order(public.classified_listings, uuid, numeric, text, uuid, text, text, text, text) from public, anon, authenticated;

-- «Comprar / Arrendar / Alugar com pagamento protegido».
create or replace function public.protected_buy_listing(p_listing_id uuid, p_fulfillment text default 'pickup', p_contact_phone text default null,
  p_delivery_text text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare l public.classified_listings; st public.platform_settings; open_id uuid; open_buyer uuid; amt numeric; src text := 'listing'; ref uuid;
  off public.listing_offers; rr public.rental_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into st from public.platform_settings where id = 1;
  if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found or l.status <> 'published' then raise exception 'LISTING_NOT_AVAILABLE'; end if;
  if l.owner_id = auth.uid() then raise exception 'OWN_LISTING'; end if;
  if l.purpose not in ('sale', 'rent', 'lease') then raise exception 'NOT_FOR_SALE'; end if;
  if p_fulfillment not in ('pickup', 'delivery') then raise exception 'INVALID_FULFILLMENT'; end if;
  if nullif(trim(coalesce(p_contact_phone, '')), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and nullif(trim(coalesce(p_delivery_text, '')), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;

  select o.id, o.buyer_id into open_id, open_buyer from public.orders o where o.id = public.listing_open_order(l.id);
  if open_id is not null then
    if open_buyer = auth.uid() then return open_id; end if;  -- já tem a sua encomenda: segue para pagar
    raise exception 'LISTING_RESERVED';
  end if;

  -- Valor: proposta aceite > pedido de aluguer aceite > preço do anúncio.
  select * into off from public.listing_offers where listing_id = l.id and buyer_id = auth.uid() and status = 'accepted' and amount is not null
    order by responded_at desc nulls last limit 1;
  if off.id is not null then amt := off.amount; src := 'offer'; ref := off.id;
  else
    select * into rr from public.rental_requests where listing_id = l.id and renter_id = auth.uid() and status = 'accepted' and proposed_price > 0
      order by updated_at desc limit 1;
    if rr.id is not null then amt := rr.proposed_price; src := 'rental'; ref := rr.id;
    elsif l.sale_mode = 'offers' then raise exception 'OFFER_REQUIRED';
    elsif l.sale_mode = 'trade' and coalesce(l.price, 0) <= 0 then raise exception 'TRADE_ONLY';
    else amt := l.price;
    end if;
  end if;
  if amt is null or amt <= 0 then raise exception 'PRICE_REQUIRED'; end if;
  return public.create_listing_order(l, auth.uid(), amt, src, ref, p_fulfillment, p_contact_phone, p_delivery_text, p_note);
end $$;
revoke all on function public.protected_buy_listing(uuid, text, text, text, text) from public, anon;
grant execute on function public.protected_buy_listing(uuid, text, text, text, text) to authenticated;

-- ───────────── Encomendas criadas sozinhas ─────────────
-- Proposta aceite (com valor): encomenda para o comprador pagar.
create or replace function public.protected_order_on_offer() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare l public.classified_listings;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' and new.amount is not null
     and coalesce((select protected_enabled from public.platform_settings where id = 1), false) then
    select * into l from public.classified_listings where id = new.listing_id;
    if found and l.status = 'published' and public.listing_open_order(l.id) is null then
      perform public.create_listing_order(l, new.buyer_id, new.amount, 'offer', new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protected_order_on_offer on public.listing_offers;
create trigger protected_order_on_offer after update of status on public.listing_offers for each row execute function public.protected_order_on_offer();

-- Pedido de aluguer aceite: encomenda do valor combinado (a comissão sai do pagamento protegido).
create or replace function public.rental_commission_on_request() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare l public.classified_listings; prot boolean := coalesce((select protected_enabled from public.platform_settings where id = 1), false);
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select * into l from public.classified_listings where id = new.listing_id;
    if found then
      if prot then
        if new.proposed_price > 0 and not exists (select 1 from public.orders o where o.source = 'rental' and o.source_ref = new.id) then
          perform public.create_listing_order(l, new.renter_id, new.proposed_price, 'rental', new.id);
        end if;
      else
        perform public.listing_commission_add(l, new.proposed_price, 'rental', new.id);
      end if;
    end if;
  elsif old.status = 'accepted' and new.status is distinct from 'accepted' then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Aluguer cancelado.') where rental_request_id = new.id and status = 'due';
  end if;
  return new;
end $$;

-- Leilão terminado com vencedor: encomenda para o vencedor pagar (o anúncio só fica vendido depois de pago).
create or replace function public.auction_mark_listing_sold() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare l public.classified_listings;
begin
  if new.status = 'ended' and old.status is distinct from 'ended' and new.winner_id is not null and new.classified_listing_id is not null then
    if coalesce((select protected_enabled from public.platform_settings where id = 1), false) then
      select * into l from public.classified_listings where id = new.classified_listing_id;
      if found and l.status <> 'sold' and public.listing_open_order(l.id) is null then
        perform public.create_listing_order(l, new.winner_id, new.current_price, 'auction', new.id);
      end if;
    else
      update public.classified_listings set sale_amount = new.current_price, deal_with = coalesce(deal_with, new.winner_id), deal_at = coalesce(deal_at, now()), status = 'sold'
       where id = new.classified_listing_id and status <> 'sold';
    end if;
  end if;
  return new;
end $$;

-- ───────────── Pago: anúncio vendido/arrendado, sem comissão separada ─────────────
create or replace function public.listing_commission_on_sale() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare amt numeric; src text := 'sold'; offer_amt numeric;
begin
  -- vendido com pagamento protegido: a comissão é descontada do dinheiro guardado
  if coalesce(current_setting('huambo.protected_sale', true), '') = 'on' then return new; end if;
  if new.status = 'sold' and old.status is distinct from 'sold' and new.purpose in ('sale', 'auction') then
    if new.deal_with is not null then
      select o.amount into offer_amt from public.listing_offers o where o.listing_id = new.id and o.buyer_id = new.deal_with and o.status = 'accepted' and o.amount is not null
       order by o.responded_at desc nulls last limit 1;
    end if;
    amt := coalesce(new.sale_amount, offer_amt, new.price);
    if new.sale_amount is null and offer_amt is not null then src := 'offer'; end if;
    if new.purpose = 'auction' then src := 'auction'; end if;
    perform public.listing_commission_add(new, amt, src);
  elsif new.status = 'rented' and old.status is distinct from 'rented' and new.purpose in ('rent', 'lease') then
    if not exists (select 1 from public.listing_commissions c where c.listing_id = new.id and c.source = 'rental' and c.status <> 'cancelled'
                   and c.created_at > now() - interval '30 days') then
      perform public.listing_commission_add(new, coalesce(new.sale_amount, new.price), 'rented');
    end if;
  elsif (old.status = 'sold' and new.status is distinct from 'sold') or (old.status = 'rented' and new.status is distinct from 'rented') then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Anúncio deixou de estar vendido/arrendado.')
     where listing_id = new.id and status = 'due' and rental_request_id is null;
  end if;
  return new;
end $$;

create or replace function public.protected_listing_paid() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare l public.classified_listings;
begin
  if new.listing_id is null or new.escrow_status is distinct from 'held' or old.escrow_status is not distinct from 'held' or new.status = 'cancelled' then return new; end if;
  select * into l from public.classified_listings where id = new.listing_id;
  if not found or l.status <> 'published' then return new; end if;
  -- alugueres com datas (pedido de aluguer) não fecham o anúncio: pode voltar a ser alugado
  if new.source = 'rental' or l.purpose = 'lease' then return new; end if;
  perform set_config('huambo.protected_sale', 'on', true);
  perform set_config('huambo.allow_publish', 'on', true);
  update public.classified_listings set status = case when l.purpose = 'rent' then 'rented' else 'sold' end,
    deal_with = new.buyer_id, deal_at = now(), sale_amount = new.total where id = l.id;
  perform set_config('huambo.allow_publish', '', true);
  perform set_config('huambo.protected_sale', '', true);
  return new;
end $$;
drop trigger if exists protected_listing_paid on public.orders;
create trigger protected_listing_paid after update of escrow_status on public.orders for each row execute function public.protected_listing_paid();

-- ───────────── Libertar o dinheiro: sem comissão nos arrendamentos de imóveis ─────────────
create or replace function public.escrow_release(p_order_id uuid, p_by text, p_force boolean default false)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare o public.orders; net numeric; fee numeric; pct numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.escrow_status is distinct from 'held' then return false; end if;
  if o.status = 'cancelled' and not p_force then return false; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then return false; end if;
  net := o.total - o.refunded_amount;
  if net <= 0 then
    update public.orders set escrow_status = 'refunded', updated_at = now() where id = o.id;
    return false;
  end if;
  select protected_fee_pct into pct from public.platform_settings where id = 1;
  if o.fee_free then pct := 0; end if;
  fee := round(net * coalesce(pct, 0) / 100, 2);
  update public.orders set escrow_status = 'released', released_at = now(), platform_fee = fee,
    status = case when status = 'cancelled' then status else 'completed' end,
    fulfillment_status = case when status = 'cancelled' then fulfillment_status else 'delivered' end,
    completed_at = coalesce(completed_at, case when status = 'cancelled' then null else now() end), updated_at = now()
   where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'release', -net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'release', net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'fee', -fee, 'Comissão do pagamento protegido (' || coalesce(pct, 0) || '%) · ' || public.order_ref(o));
  insert into public.notifications(user_id, type, title, body, data)
  values (o.seller_id, 'system', 'Dinheiro disponível 💰', (net - fee) || ' Kz de ' || coalesce('«' || left(o.title, 60) || '»', 'a encomenda ' || public.order_ref(o)) || ' já podem ser levantados.',
    jsonb_build_object('order_id', o.id, 'for', 'wallet'));
  if p_by = 'auto' then
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento entregue ao vendedor', 'Passou o prazo depois da entrega de ' || coalesce('«' || left(o.title, 60) || '»', 'a encomenda ' || public.order_ref(o))
      || ' sem reclamação, por isso o pagamento foi entregue ao vendedor.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $$;

-- Encomendas não pagas a tempo: o texto já não fala da Loja quando é um anúncio.
create or replace function public.escrow_tick() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare o public.orders; cancelled integer := 0; released integer := 0;
begin
  for o in select * from public.orders x where x.escrow_status = 'awaiting_payment' and x.status <> 'cancelled' and x.pay_by < now()
      and not exists (select 1 from public.order_payments p where p.order_id = x.id and p.status = 'pending' and p.provider = 'manual')
      for update skip locked loop
    update public.products p set stock = p.stock + oi.quantity, updated_at = now() from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
    update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id;
    insert into public.notifications(user_id, type, title, body, data) values
      (o.buyer_id, 'order', 'Encomenda cancelada', 'A encomenda ' || public.order_ref(o) || coalesce(' («' || left(o.title, 60) || '»)', '') || ' foi cancelada porque o pagamento não chegou a tempo.',
        jsonb_build_object('order_id', o.id, 'for', 'purchase')),
      (o.seller_id, 'order', 'Encomenda cancelada', 'O cliente não pagou a encomenda ' || public.order_ref(o) || ' a tempo. '
        || case when o.listing_id is not null then 'O anúncio voltou a estar disponível.' else 'O stock voltou à Loja.' end,
        jsonb_build_object('order_id', o.id, 'for', 'sale'));
    cancelled := cancelled + 1;
  end loop;
  update public.order_payments set status = 'expired' where provider = 'proxypay' and status = 'pending' and expires_at < now();
  for o in select * from public.orders x where x.escrow_status = 'held' and x.status <> 'cancelled' and x.release_at <= now()
      and not exists (select 1 from public.order_disputes d where d.order_id = x.id and d.status <> 'resolved') loop
    if public.escrow_release(o.id, 'auto') then released := released + 1; end if;
  end loop;
  return jsonb_build_object('cancelled', cancelled, 'released', released);
end $$;

-- ───────────── Lista de encomendas: anúncios aparecem com o título ─────────────
create or replace function public.my_orders_v3(p_role text default 'buyer')
 returns table(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text, pay_by timestamp with time zone, paid_at timestamp with time zone, delivered_at timestamp with time zone, release_at timestamp with time zone, released_at timestamp with time zone, platform_fee numeric, payment jsonb)
 language sql stable security definer set search_path to 'public'
as $function$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, coalesce(o.delivery_text, case when p_role <> 'seller' then (select c.delivery_text from public.request_private_contacts c where c.kind = 'orders' and c.request_id = o.id) end), o.buyer_note,
         case when o.source = 'shop' then
           (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
              from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
         else jsonb_build_array(jsonb_build_object('name', coalesce(o.title, 'Anúncio'), 'quantity', 1, 'line_total', o.subtotal,
              'listing_id', o.listing_id, 'source', o.source)) end,
         o.fulfillment_status, o.protected, o.escrow_status, o.pay_by, o.paid_at, o.delivered_at, o.release_at, o.released_at,
         case when p_role = 'seller' then o.platform_fee else 0 end,
         case when p_role = 'seller' or not o.protected then null else
           (select jsonb_build_object('id', op.id, 'status', op.status, 'provider', op.provider, 'method', op.method, 'entity', op.entity,
              'reference', op.reference, 'amount', op.amount, 'expires_at', op.expires_at, 'admin_note', op.admin_note, 'created_at', op.created_at)
              from public.order_payments op where op.order_id = o.id order by op.created_at desc limit 1) end
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid() and o.team_forwarded_at is not null) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$;

-- A minha encomenda aberta deste anúncio (para o botão «Pagar agora»).
create or replace function public.my_listing_order(p_listing uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('id', o.id, 'total', o.total, 'escrow_status', o.escrow_status, 'pay_by', o.pay_by, 'source', o.source)
    from public.orders o where o.listing_id = p_listing and o.buyer_id = auth.uid() and o.status <> 'cancelled'
     and o.escrow_status in ('awaiting_payment', 'held') order by o.created_at desc limit 1;
$$;
grant execute on function public.my_listing_order(uuid) to authenticated;
