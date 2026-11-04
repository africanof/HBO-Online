-- Serviços (profissionais e empresas) com orçamento e pagamento protegido OBRIGATÓRIO.
-- 1) O cliente pede o serviço (como antes). 2) O profissional/empresa envia um orçamento (valor + nota).
-- 3) O cliente aceita e paga ao Huambo Online (encomenda protegida, origem «service»).
-- 4) Depois de pago, o profissional faz o serviço e marca «Serviço concluído» (conta como entregue).
-- 5) O cliente confirma e avalia → o dinheiro passa ao saldo do profissional (sem a comissão).
--    Se o cliente não disser nada, o dinheiro é libertado sozinho uns dias depois (como na Loja).
-- Reclamações e reembolsos fazem-se em «Encomendas», como em qualquer compra.

alter table public.service_requests add column if not exists quote_amount numeric,
  add column if not exists quote_note text,
  add column if not exists quoted_at timestamptz,
  add column if not exists order_id uuid references public.orders(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'service_requests_quote_check') then
    alter table public.service_requests add constraint service_requests_quote_check check (quote_amount is null or quote_amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_requests_quote_note_len') then
    alter table public.service_requests add constraint service_requests_quote_note_len check (quote_note is null or char_length(quote_note) <= 500);
  end if;
  alter table public.orders drop constraint if exists orders_source_check;
  alter table public.orders add constraint orders_source_check check (source in ('shop', 'listing', 'offer', 'auction', 'rental', 'service'));
end $$;

-- Encomenda do serviço ainda aberta (por pagar ou paga).
create or replace function public.service_open_order(r public.service_requests) returns public.orders
language sql stable security definer set search_path to 'public' as $$
  select o.* from public.orders o where o.id = r.order_id and o.status <> 'cancelled' and o.escrow_status in ('awaiting_payment', 'held');
$$;

-- O profissional/empresa envia (ou muda, enquanto não está pago) o orçamento.
create or replace function public.send_service_quote(p_id uuid, p_amount numeric, p_note text default null)
returns public.service_requests language plpgsql security definer set search_path to 'public' as $$
declare r public.service_requests; o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if auth.uid() <> public.service_request_owner(r) then raise exception 'NOT_SERVICE_PROVIDER'; end if;
  if r.status not in ('requested', 'accepted') then raise exception 'INVALID_TRANSITION'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then raise exception 'QUOTE_AMOUNT_INVALID'; end if;
  o := public.service_open_order(r);
  if o.id is not null and o.escrow_status = 'held' then raise exception 'SERVICE_ALREADY_PAID'; end if;
  -- orçamento novo: a encomenda antiga por pagar deixa de valer
  if o.id is not null then update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id; end if;
  update public.service_requests set quote_amount = round(p_amount, 2), quote_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
    quoted_at = now(), status = 'accepted', order_id = null, updated_at = now() where id = r.id returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.client_id, 'system', 'Orçamento recebido 🧾', 'Orçamento de ' || r.quote_amount || ' Kz para o seu pedido de serviço. '
    || 'Aceite e pague com pagamento protegido: o dinheiro só chega ao profissional depois de confirmar o serviço.'
    || coalesce(' Nota: ' || left(r.quote_note, 140), ''), jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $$;
revoke all on function public.send_service_quote(uuid, numeric, text) from public, anon;
grant execute on function public.send_service_quote(uuid, numeric, text) to authenticated;

-- O cliente aceita o orçamento: cria a encomenda protegida (ou devolve a que já existe). Devolve o id da encomenda.
create or replace function public.accept_service_quote(p_id uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare r public.service_requests; o public.orders; st public.platform_settings; owner uuid; oid uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found or r.client_id <> auth.uid() then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.status <> 'accepted' or r.quote_amount is null then raise exception 'QUOTE_REQUIRED'; end if;
  o := public.service_open_order(r);
  if o.id is not null then return o.id; end if;
  select * into st from public.platform_settings where id = 1;
  if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  owner := public.service_request_owner(r);
  insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
    fulfillment_type, fulfillment_status, protected, escrow_status, pay_by, source, source_ref, title)
  values (r.client_id, owner, 'pending', 'AOA', r.quote_amount, 0, r.quote_amount, 'unpaid', 'reference', 'pickup', 'pending',
    true, 'awaiting_payment', now() + make_interval(hours => coalesce(st.payment_window_hours, 24)), 'service', r.id,
    left('Serviço: ' || r.description, 200))
  returning id into oid;
  update public.service_requests set order_id = oid, updated_at = now() where id = r.id;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'system', 'Orçamento aceite 🧾', 'O cliente aceitou o orçamento de ' || r.quote_amount || ' Kz. Espere pelo aviso «Pagamento recebido» antes de fazer o serviço.',
    jsonb_build_object('service_request_id', r.id, 'order_id', oid, 'for', 'service'));
  return oid;
end $$;
revoke all on function public.accept_service_quote(uuid) from public, anon;
grant execute on function public.accept_service_quote(uuid) to authenticated;

-- Aceitar / recusar / concluir / cancelar, agora com o pagamento protegido.
create or replace function public.update_service_request(p_id uuid, p_action text, p_note text default null)
returns public.service_requests language plpgsql security definer set search_path to 'public' as $$
declare r public.service_requests; owner uuid; next_status text; notify_to uuid; msg text; o public.orders;
  prot boolean := coalesce((select protected_enabled from public.platform_settings where id = 1), false);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  owner := public.service_request_owner(r);
  o := public.service_open_order(r);
  if p_action in ('accept', 'decline', 'done') then
    if auth.uid() <> owner then raise exception 'NOT_SERVICE_PROVIDER'; end if;
    if p_action = 'accept' and r.status = 'requested' then next_status := 'accepted'; msg := 'O seu pedido de serviço foi aceite. Espere pelo orçamento.';
    elsif p_action = 'decline' and r.status in ('requested', 'accepted') then
      if o.escrow_status = 'held' then raise exception 'SERVICE_ALREADY_PAID'; end if;
      next_status := 'declined'; msg := 'O seu pedido de serviço foi recusado.';
    elsif p_action = 'done' and r.status in ('requested', 'accepted') then
      if prot and o.escrow_status is distinct from 'held' then raise exception 'SERVICE_NOT_PAID'; end if;
      next_status := 'done'; msg := 'Serviço concluído: confirme e avalie para libertar o pagamento.';
    else raise exception 'INVALID_TRANSITION'; end if;
    notify_to := r.client_id;
  elsif p_action = 'cancel' then
    if auth.uid() <> r.client_id then raise exception 'NOT_SERVICE_CLIENT'; end if;
    if r.status not in ('requested', 'accepted') then raise exception 'INVALID_TRANSITION'; end if;
    if o.escrow_status = 'held' then raise exception 'SERVICE_ALREADY_PAID'; end if;
    next_status := 'cancelled'; msg := 'O cliente cancelou o pedido de serviço.'; notify_to := owner;
  else raise exception 'INVALID_ACTION'; end if;
  update public.service_requests set status = next_status, updated_at = now(),
    provider_note = case when p_action in ('accept', 'decline', 'done') then coalesce(nullif(left(trim(coalesce(p_note, '')), 500), ''), provider_note) else provider_note end
   where id = r.id returning * into r;
  -- recusado/cancelado antes de pagar: a encomenda deixa de valer
  if next_status in ('declined', 'cancelled') and o.id is not null and o.escrow_status = 'awaiting_payment' then
    update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id;
  end if;
  -- serviço feito: conta como entregue (começa o prazo para libertar o dinheiro)
  if next_status = 'done' and o.id is not null then
    update public.orders set status = 'completed', fulfillment_status = 'delivered', completed_at = now(), updated_at = now() where id = o.id;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (notify_to, 'system', 'Pedido de serviço', msg || coalesce(' ' || nullif(left(trim(coalesce(p_note, '')), 140), ''), ''),
          jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $$;

-- O cliente confirma o serviço: o dinheiro guardado passa ao profissional.
create or replace function public.service_confirmed_release() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' and new.order_id is not null then
    update public.orders set received_at = coalesce(received_at, now()), updated_at = now() where id = new.order_id and escrow_status = 'held';
    perform public.escrow_release(new.order_id, 'buyer');
  end if;
  return new;
end $$;
drop trigger if exists service_confirmed_release on public.service_requests;
create trigger service_confirmed_release after update of status on public.service_requests for each row execute function public.service_confirmed_release();

-- Lista com o orçamento e o estado do pagamento.
create or replace function public.my_service_requests_v3(p_as text default 'client')
returns table(id uuid, status text, description text, provider_note text, created_at timestamptz, updated_at timestamptz, provider_id uuid, business_id uuid,
  target_name text, client_id uuid, client_name text, preferred_date date, quote_amount numeric, quote_note text, quoted_at timestamptz, order_id uuid, escrow_status text)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente'), s.preferred_date,
         s.quote_amount, s.quote_note, s.quoted_at, o.id, o.escrow_status
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  left join public.orders o on o.id = s.order_id and o.status <> 'cancelled'
  where auth.uid() is not null and case when p_as = 'provider'
    then ((s.provider_id = auth.uid() or b.owner_id = auth.uid()) and s.team_forwarded_at is not null) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$$;
grant execute on function public.my_service_requests_v3(text) to authenticated;

-- Encomendas nascidas de pedidos que a equipa já reencaminhou (serviço, proposta, aluguer) ou de leilões:
-- ficam logo visíveis ao vendedor, sem segundo reencaminhamento.
create or replace function public.orders_auto_forward() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.source in ('service', 'offer', 'rental', 'auction') and new.team_forwarded_at is null then new.team_forwarded_at := now(); end if;
  return new;
end $$;
drop trigger if exists orders_auto_forward on public.orders;
create trigger orders_auto_forward before insert on public.orders for each row execute function public.orders_auto_forward();
