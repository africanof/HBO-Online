-- Disputas, devoluções e reembolsos das encomendas da Loja (igual no Site e na APP).
-- O comprador abre um pedido (reembolso, devolução + reembolso, ou troca por outro igual) com motivo,
-- explicação e fotografias. O vendedor aceita ou recusa; cada passo fica registado e avisa a outra parte.
-- Se não se entenderem, qualquer um chama a administração, que decide.
-- O dinheiro é pago fora da plataforma (entrega, transferência, Multicaixa): o vendedor marca
-- «reembolso enviado» e o comprador confirma que recebeu. Encomenda paga e cancelada → reembolso automático.

alter table public.orders add column if not exists refunded_amount numeric not null default 0 check (refunded_amount >= 0);
alter table public.orders add column if not exists completed_at timestamptz;

create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  request text not null check (request in ('refund', 'return_refund', 'replacement')),
  reason text not null check (reason in ('not_received', 'damaged', 'not_as_described', 'wrong_item', 'missing_items', 'other', 'seller_cancelled')),
  description text check (description is null or char_length(description) <= 1000),
  amount numeric check (amount is null or amount > 0),
  status text not null default 'open' check (status in ('open', 'declined', 'awaiting_return', 'returned', 'awaiting_refund', 'refund_sent', 'replacing', 'escalated', 'resolved')),
  outcome text check (outcome is null or outcome in ('refunded', 'replaced', 'rejected', 'withdrawn')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'resolved') = (outcome is not null)),
  check ((request = 'replacement') = (amount is null))
);
create unique index if not exists order_disputes_one_active on public.order_disputes(order_id) where status <> 'resolved';
create index if not exists order_disputes_buyer on public.order_disputes(buyer_id, created_at desc);
create index if not exists order_disputes_seller on public.order_disputes(seller_id, created_at desc);
create index if not exists order_disputes_status on public.order_disputes(status, updated_at);

create table if not exists public.order_dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.order_disputes(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('buyer', 'seller', 'admin', 'system')),
  action text not null check (action in ('opened', 'accepted', 'declined', 'returned', 'return_received', 'refund_sent', 'refund_confirmed',
    'replacement_received', 'escalated', 'decided', 'withdrawn', 'comment', 'auto_refund')),
  note text check (note is null or char_length(note) <= 1000),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  created_at timestamptz not null default now()
);
create index if not exists order_dispute_events_dispute on public.order_dispute_events(dispute_id, created_at);

alter table public.order_disputes enable row level security;
alter table public.order_dispute_events enable row level security;
create policy order_disputes_parties_read on public.order_disputes for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.has_admin_role()));
create policy order_dispute_events_parties_read on public.order_dispute_events for select to authenticated
  using (exists (select 1 from public.order_disputes d where d.id = dispute_id
    and (d.buyer_id = (select auth.uid()) or d.seller_id = (select auth.uid()) or (select public.has_admin_role()))));
revoke all on public.order_disputes, public.order_dispute_events from anon, authenticated;
grant select on public.order_disputes, public.order_dispute_events to authenticated;

-- Fotografias de prova: pasta "<encomenda>/<pessoa>/ficheiro"; só as duas partes e a administração as veem.
create or replace function public.is_order_party(p_order text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_order ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (select 1 from public.orders where id = p_order::uuid and auth.uid() in (buyer_id, seller_id)) else false end;
$$;
revoke all on function public.is_order_party(text) from public, anon;
grant execute on function public.is_order_party(text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy dispute_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_order_party((storage.foldername(name))[1]));
create policy dispute_evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and (public.is_order_party((storage.foldername(name))[1]) or public.has_admin_role()));

-- Ajudantes ------------------------------------------------------------------------------
create or replace function public.dispute_clean_photos(p_order_id uuid, p_photos text[]) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare p text; res text[] := '{}';
begin
  foreach p in array coalesce(p_photos, '{}') loop
    if p !~ ('^' || p_order_id::text || '/' || auth.uid()::text || '/[A-Za-z0-9._-]{1,120}$') then raise exception 'INVALID_PHOTO'; end if;
    res := res || p;
  end loop;
  if cardinality(res) > 4 then raise exception 'TOO_MANY_PHOTOS'; end if;
  return res;
end $$;

create or replace function public.dispute_log(d public.order_disputes, p_role text, p_action text, p_note text, p_photos text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare who uuid; title text; body text;
begin
  insert into public.order_dispute_events(dispute_id, actor_id, actor_role, action, note, photos)
  values (d.id, case when p_role = 'system' then null else auth.uid() end, p_role, p_action, nullif(left(trim(coalesce(p_note, '')), 1000), ''), coalesce(p_photos, '{}'));
  title := case p_action
    when 'opened' then 'Pedido de devolução ou reembolso'
    when 'accepted' then 'O vendedor aceitou o seu pedido ✔'
    when 'declined' then 'O vendedor recusou o seu pedido'
    when 'returned' then 'O comprador devolveu o artigo'
    when 'return_received' then 'O vendedor recebeu a devolução'
    when 'refund_sent' then 'O vendedor diz que devolveu o dinheiro'
    when 'refund_confirmed' then 'Reembolso confirmado ✔'
    when 'replacement_received' then 'Troca confirmada ✔'
    when 'escalated' then 'Pedido enviado à administração'
    when 'decided' then 'A administração decidiu'
    when 'withdrawn' then 'O comprador desistiu do pedido'
    when 'auto_refund' then 'Encomenda paga cancelada: reembolso'
    else 'Nova mensagem no pedido de devolução' end;
  body := coalesce(nullif(left(trim(coalesce(p_note, '')), 200), ''), 'Encomenda de ' || replace(to_char(coalesce(d.amount, (select total from public.orders where id = d.order_id)), 'FM999,999,999,990'), ',', ' ') || ' Kz');
  -- avisa a(s) outra(s) parte(s)
  for who in select x from unnest(array[d.buyer_id, d.seller_id]) x
    where p_role in ('admin', 'system') or x is distinct from auth.uid() loop
    insert into public.notifications(user_id, type, title, body, data)
    values (who, 'order', title, body, jsonb_build_object('order_id', d.order_id, 'dispute_id', d.id, 'for', 'dispute'));
  end loop;
end $$;

-- Abrir um pedido -------------------------------------------------------------------------
create or replace function public.open_order_dispute(p_order_id uuid, p_request text, p_reason text, p_description text,
  p_amount numeric default null, p_photos text[] default '{}')
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare o public.orders; d public.order_disputes; ph text[]; amt numeric; txt text := nullif(left(trim(coalesce(p_description, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.buyer_id <> auth.uid() then raise exception 'NOT_ORDER_PARTY'; end if;
  if o.status in ('pending', 'cancelled') or (o.status <> 'completed' and o.payment_status <> 'paid') then raise exception 'DISPUTE_NOT_ALLOWED'; end if;
  if o.status = 'completed' and coalesce(o.completed_at, o.updated_at) < now() - interval '14 days' then raise exception 'DISPUTE_WINDOW_CLOSED'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and outcome <> 'withdrawn') then raise exception 'DISPUTE_ALREADY_DECIDED'; end if;
  if (select count(*) from public.order_disputes where order_id = o.id) >= 3 then raise exception 'TOO_MANY_REQUESTS'; end if;
  if p_request not in ('refund', 'return_refund', 'replacement') then raise exception 'INVALID_REQUEST'; end if;
  if p_reason not in ('not_received', 'damaged', 'not_as_described', 'wrong_item', 'missing_items', 'other') then raise exception 'INVALID_REASON'; end if;
  if p_reason = 'not_received' and p_request <> 'refund' then raise exception 'INVALID_REQUEST'; end if;
  if txt is null or char_length(txt) < 5 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_request = 'replacement' then amt := null;
  else
    amt := coalesce(p_amount, o.total - o.refunded_amount);
    if amt <= 0 or amt > o.total - o.refunded_amount then raise exception 'INVALID_AMOUNT'; end if;
  end if;
  ph := public.dispute_clean_photos(o.id, p_photos);
  insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount)
  values (o.id, o.buyer_id, o.seller_id, p_request, p_reason, txt, amt) returning * into d;
  perform public.dispute_log(d, 'buyer', 'opened', txt, ph);
  return d;
end $$;

-- Passos do pedido ------------------------------------------------------------------------
create or replace function public.dispute_action(p_dispute_id uuid, p_action text, p_note text default null, p_photos text[] default '{}')
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare d public.order_disputes; r text; ph text[]; nxt text; outc text; ev text; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  r := case when d.buyer_id = auth.uid() then 'buyer' when d.seller_id = auth.uid() then 'seller' when public.has_admin_role() then 'admin' end;
  if r is null then raise exception 'NOT_ORDER_PARTY'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  ph := case when r = 'admin' then '{}' else public.dispute_clean_photos(d.order_id, p_photos) end;
  ev := case p_action when 'accept' then 'accepted' when 'decline' then 'declined' when 'mark_returned' then 'returned'
    when 'confirm_return' then 'return_received' when 'mark_refunded' then 'refund_sent' when 'confirm_refund' then 'refund_confirmed'
    when 'confirm_replacement' then 'replacement_received' when 'escalate' then 'escalated' when 'withdraw' then 'withdrawn'
    when 'comment' then 'comment' end;
  if ev is null then raise exception 'INVALID_ACTION'; end if;

  if p_action = 'accept' and r = 'seller' and d.status = 'open' then
    nxt := case d.request when 'refund' then 'awaiting_refund' when 'return_refund' then 'awaiting_return' else 'replacing' end;
  elsif p_action = 'decline' and r = 'seller' and d.status = 'open' then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    nxt := 'declined';
  elsif p_action = 'mark_returned' and r = 'buyer' and d.status = 'awaiting_return' then nxt := 'returned';
  elsif p_action = 'confirm_return' and r = 'seller' and d.status = 'returned' then nxt := 'awaiting_refund';
  elsif p_action = 'mark_refunded' and r = 'seller' and d.status = 'awaiting_refund' then nxt := 'refund_sent';
  elsif p_action = 'confirm_refund' and r = 'buyer' and d.status = 'refund_sent' then nxt := 'resolved'; outc := 'refunded';
  elsif p_action = 'confirm_replacement' and r = 'buyer' and d.status = 'replacing' then nxt := 'resolved'; outc := 'replaced';
  elsif p_action = 'withdraw' and r = 'buyer' then nxt := 'resolved'; outc := 'withdrawn';
  elsif p_action = 'escalate' and r in ('buyer', 'seller') and d.status <> 'escalated' then
    -- o comprador pode chamar logo depois de uma recusa; de resto, só ao fim de 3 dias sem avanço
    if not ((r = 'buyer' and d.status = 'declined') or (d.status not in ('declined', 'open') and d.updated_at < now() - interval '3 days')
            or (r = 'buyer' and d.status = 'open' and d.updated_at < now() - interval '3 days')) then raise exception 'ESCALATE_TOO_EARLY'; end if;
    nxt := 'escalated';
  elsif p_action = 'comment' then
    if txt is null and cardinality(ph) = 0 then raise exception 'MESSAGE_REQUIRED'; end if;
    nxt := d.status;
  else raise exception 'INVALID_TRANSITION'; end if;

  update public.order_disputes set status = nxt, outcome = coalesce(outc, outcome),
    resolved_at = case when nxt = 'resolved' then now() else resolved_at end,
    updated_at = case when p_action = 'comment' then updated_at else now() end
   where id = d.id returning * into d;
  if outc = 'refunded' then
    update public.orders set refunded_amount = least(total, refunded_amount + d.amount),
      payment_status = case when refunded_amount + d.amount >= total then 'refunded' else payment_status end, updated_at = now()
     where id = d.order_id;
  end if;
  perform public.dispute_log(d, r, ev, txt, ph);
  if nxt = 'escalated' then
    perform public.notify_staff('Disputa para decidir', coalesce(txt, 'Encomenda com pedido de devolução ou reembolso.'), jsonb_build_object('dispute_id', d.id));
  end if;
  return d;
end $$;

-- Decisão da administração -----------------------------------------------------------------
create or replace function public.admin_decide_dispute(p_dispute_id uuid, p_decision text, p_amount numeric default null, p_note text default null)
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare d public.order_disputes; o public.orders; amt numeric; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  if p_decision not in ('refund', 'return_refund', 'replacement', 'reject') then raise exception 'INVALID_DECISION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into o from public.orders where id = d.order_id;
  if p_decision in ('refund', 'return_refund') then
    amt := coalesce(p_amount, d.amount, o.total - o.refunded_amount);
    if amt <= 0 or amt > o.total - o.refunded_amount then raise exception 'INVALID_AMOUNT'; end if;
  end if;
  update public.order_disputes set
    request = case when p_decision = 'reject' then request else p_decision end,
    amount = case when p_decision = 'reject' then amount when p_decision = 'replacement' then null else amt end,
    status = case p_decision when 'refund' then 'awaiting_refund' when 'return_refund' then 'awaiting_return' when 'replacement' then 'replacing' else 'resolved' end,
    outcome = case when p_decision = 'reject' then 'rejected' end,
    resolved_at = case when p_decision = 'reject' then now() end,
    admin_note = txt, updated_at = now()
   where id = d.id returning * into d;
  perform public.dispute_log(d, 'admin', 'decided', txt);
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'dispute_decided', 'order', d.order_id, jsonb_build_object('dispute_id', d.id, 'decision', p_decision, 'amount', d.amount));
  return d;
end $$;

-- Listas ----------------------------------------------------------------------------------
create or replace function public.dispute_events_json(p_dispute_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('actor_role', e.actor_role, 'action', e.action, 'note', e.note, 'photos', to_jsonb(e.photos), 'created_at', e.created_at) order by e.created_at), '[]')
  from public.order_dispute_events e where e.dispute_id = p_dispute_id;
$$;

create or replace function public.my_disputes()
returns table(id uuid, order_id uuid, my_role text, other_name text, request text, reason text, description text, amount numeric,
  status text, outcome text, admin_note text, created_at timestamptz, updated_at timestamptz, order_total numeric, order_items jsonb, events jsonb)
language sql stable security definer set search_path = public as $$
  select d.id, d.order_id, case when d.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note,
    d.created_at, d.updated_at, o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', oi.quantity) order by pr.name), '[]')
       from public.order_items oi join public.products pr on pr.id = oi.product_id where oi.order_id = o.id),
    public.dispute_events_json(d.id)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles p on p.id = case when d.buyer_id = auth.uid() then d.seller_id else d.buyer_id end
  where auth.uid() in (d.buyer_id, d.seller_id)
  order by (d.status <> 'resolved') desc, d.updated_at desc limit 100;
$$;

create or replace function public.admin_list_disputes(p_status text default 'escalated')
returns table(id uuid, order_id uuid, buyer_id uuid, buyer_name text, seller_id uuid, seller_name text, request text, reason text, description text,
  amount numeric, status text, outcome text, admin_note text, created_at timestamptz, updated_at timestamptz, order_total numeric,
  payment_method text, order_status text, events jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), d.seller_id, coalesce(nullif(s.full_name, ''), 'Utilizador'),
    d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note, d.created_at, d.updated_at, o.total, o.payment_method, o.status,
    public.dispute_events_json(d.id)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles b on b.id = d.buyer_id left join public.profiles s on s.id = d.seller_id
  where p_status is null or (p_status = 'active' and d.status <> 'resolved') or d.status = p_status
  order by (d.status = 'escalated') desc, d.updated_at limit 200;
end $$;

-- Encomenda paga e cancelada → pedido de reembolso automático; data de conclusão. -----------
create or replace function public.update_order_status(p_order_id uuid, p_status text, p_paid boolean default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; is_seller boolean; is_buyer boolean; label text; was_paid boolean; d public.order_disputes;
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
  was_paid := o.payment_status = 'paid';
  if p_status = 'cancelled' then
    update public.products p set stock = p.stock + oi.quantity, updated_at = now()
    from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
  end if;
  update public.orders set status = p_status,
    fulfillment_status = case p_status when 'completed' then 'delivered' when 'cancelled' then 'cancelled' else fulfillment_status end,
    payment_status = case when is_seller and p_paid is true then 'paid' when p_status = 'completed' and payment_method = 'cash_on_delivery' then 'paid' else payment_status end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    updated_at = now()
  where id = o.id returning * into o;
  label := case p_status when 'confirmed' then 'confirmada' when 'processing' then 'em preparação' when 'ready' then 'pronta'
    when 'completed' then 'concluída' when 'cancelled' then 'cancelada' else p_status end;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when auth.uid() = o.buyer_id then o.seller_id else o.buyer_id end, 'order', 'Encomenda ' || label,
          'A encomenda de ' || o.total || ' Kz foi ' || label || '.', jsonb_build_object('order_id', o.id));
  if p_status = 'cancelled' and was_paid and o.total > o.refunded_amount
     and not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
    insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
    values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda já estava paga e foi cancelada.', o.total - o.refunded_amount, 'awaiting_refund')
    returning * into d;
    perform public.dispute_log(d, 'system', 'auto_refund', 'A encomenda já estava paga e foi cancelada: o vendedor tem de devolver o dinheiro.');
  end if;
  return o;
end $$;

-- Números no painel.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status <> 'active'),
    'listings_published', (select count(*) from public.classified_listings where status = 'published'),
    'listings_total', (select count(*) from public.classified_listings),
    'listings_7d', (select count(*) from public.classified_listings where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.moderation_reports where status in ('open', 'reviewing')),
    'conversations', (select count(*) from public.conversations),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'products_active', (select count(*) from public.products where active),
    'providers', (select count(*) from public.provider_profiles where active),
    'businesses', (select count(*) from public.businesses where active),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
    'orders_completed_30d', (select count(*) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'sales_value_30d', (select coalesce(sum(total), 0) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'services_30d', (select count(*) from public.service_requests where created_at > now() - interval '30 days'),
    'services_done_30d', (select count(*) from public.service_requests where status in ('done', 'confirmed') and updated_at > now() - interval '30 days'),
    'deals_30d', (select count(*) from public.classified_listings where deal_at > now() - interval '30 days'),
    'reviews_30d', (select count(*) from public.user_reviews where created_at > now() - interval '30 days')
                  + (select count(*) from public.reviews where created_at > now() - interval '30 days'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'disputes_open', (select count(*) from public.order_disputes where status <> 'resolved'),
    'disputes_escalated', (select count(*) from public.order_disputes where status = 'escalated'),
    'refunds_30d', (select coalesce(sum(amount), 0) from public.order_disputes where outcome = 'refunded' and resolved_at > now() - interval '30 days')
  );
end $$;

revoke all on function public.dispute_clean_photos(uuid, text[]) from public, anon, authenticated;
revoke all on function public.dispute_log(public.order_disputes, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.dispute_events_json(uuid) from public, anon, authenticated;
revoke all on function public.open_order_dispute(uuid, text, text, text, numeric, text[]) from public, anon;
revoke all on function public.dispute_action(uuid, text, text, text[]) from public, anon;
revoke all on function public.admin_decide_dispute(uuid, text, numeric, text) from public, anon;
revoke all on function public.my_disputes() from public, anon;
revoke all on function public.admin_list_disputes(text) from public, anon;
grant execute on function public.open_order_dispute(uuid, text, text, text, numeric, text[]) to authenticated;
grant execute on function public.dispute_action(uuid, text, text, text[]) to authenticated;
grant execute on function public.admin_decide_dispute(uuid, text, numeric, text) to authenticated;
grant execute on function public.my_disputes() to authenticated;
grant execute on function public.admin_list_disputes(text) to authenticated;
