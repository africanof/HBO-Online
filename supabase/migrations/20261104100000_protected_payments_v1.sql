-- Pagamento protegido (custódia) das encomendas da Loja — igual no Site e na APP.
--
-- 1. O comprador paga ao Huambo Online (hoje: transferência/Multicaixa Express com comprovativo, confirmado pela
--    administração; depois: referência ProxyPay confirmada sozinha pela Edge Function «payment-webhook»).
-- 2. O dinheiro fica «retido» (saldo pendente do vendedor). O vendedor só envia depois do aviso «Pagamento recebido».
-- 3. O comprador carrega em «Confirmar receção» → o dinheiro (menos a comissão, se houver) passa a «disponível».
--    Sem resposta X dias depois da entrega (definição, 3 por omissão) e sem reclamação, é libertado sozinho.
-- 4. Reclamação aberta congela o dinheiro; o reembolso de dinheiro retido é enviado pela administração.
-- 5. O vendedor pede o levantamento; a administração exporta um ficheiro com os IBAN e paga em lote no banco.
-- Tudo fica num livro de movimentos (wallet_entries) que ninguém pode alterar a partir do Site ou da APP.
-- Desligado por omissão: a administração ativa quando a parte legal estiver pronta.

-- Definições -------------------------------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists protected_enabled boolean not null default false,
  add column if not exists payment_provider text not null default 'manual' check (payment_provider in ('manual', 'proxypay')),
  add column if not exists proxypay_entity text check (proxypay_entity is null or proxypay_entity ~ '^[0-9]{3,6}$'),
  add column if not exists protected_fee_pct numeric not null default 0 check (protected_fee_pct >= 0 and protected_fee_pct <= 20),
  add column if not exists auto_release_days integer not null default 3 check (auto_release_days between 1 and 30),
  add column if not exists payment_window_hours integer not null default 48 check (payment_window_hours between 1 and 168),
  add column if not exists payout_min_kz numeric not null default 1000 check (payout_min_kz >= 0),
  add column if not exists payout_weekdays integer[] not null default '{2,5}'
    check (payout_weekdays <@ array[1, 2, 3, 4, 5, 6, 7] and cardinality(payout_weekdays) between 1 and 7);
grant update (protected_enabled, payment_provider, proxypay_entity, protected_fee_pct, auto_release_days, payment_window_hours,
  payout_min_kz, payout_weekdays) on public.platform_settings to authenticated;

-- Encomendas -------------------------------------------------------------------------------------------
alter table public.orders
  add column if not exists protected boolean not null default false,
  add column if not exists escrow_status text check (escrow_status is null or escrow_status in ('awaiting_payment', 'held', 'released', 'refunded')),
  add column if not exists platform_fee numeric not null default 0 check (platform_fee >= 0),
  add column if not exists pay_by timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists received_at timestamptz,
  add column if not exists release_at timestamptz,
  add column if not exists released_at timestamptz;
alter table public.orders add constraint orders_protected_escrow check (protected = (escrow_status is not null));
create index if not exists orders_escrow_release_due on public.orders(release_at) where escrow_status = 'held';
create index if not exists orders_escrow_pay_due on public.orders(pay_by) where escrow_status = 'awaiting_payment';

alter table public.order_disputes add column if not exists refund_to text check (refund_to is null or char_length(refund_to) <= 60);

-- Pagamentos das encomendas protegidas ----------------------------------------------------------------
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  provider text not null check (provider in ('manual', 'proxypay')),
  method text not null check (method in ('bank_transfer', 'multicaixa_express', 'reference')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'expired')),
  entity text check (entity is null or char_length(entity) <= 10),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'),
  provider_payment_id text unique,
  paid_amount numeric,
  expires_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create unique index if not exists order_payments_one_pending on public.order_payments(order_id) where status = 'pending';
create index if not exists order_payments_status on public.order_payments(status, created_at);
create index if not exists order_payments_buyer on public.order_payments(buyer_id);
create index if not exists order_payments_decided_by on public.order_payments(decided_by);
create index if not exists order_payments_reference on public.order_payments(reference) where provider = 'proxypay';
alter table public.order_payments enable row level security;
create policy order_payments_own_read on public.order_payments for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.order_payments from anon, authenticated;
grant select on public.order_payments to authenticated;

-- Contas para receber (vendedores) e pedidos de levantamento --------------------------------------------
create table if not exists public.payout_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  method text not null check (method in ('iban', 'express')),
  holder_name text not null check (char_length(holder_name) between 3 and 120),
  iban text check (iban is null or iban ~ '^[0-9]{21}$'),
  express_number text check (express_number is null or express_number ~ '^9[0-9]{8}$'),
  updated_at timestamptz not null default now(),
  check ((method = 'iban') = (iban is not null)),
  check ((method = 'express') = (express_number is not null))
);
alter table public.payout_accounts enable row level security;
create policy payout_accounts_own_read on public.payout_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.payout_accounts from anon, authenticated;
grant select on public.payout_accounts to authenticated;

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('iban', 'express')),
  holder_name text not null,
  destination text not null,
  status text not null default 'requested' check (status in ('requested', 'processing', 'paid', 'rejected', 'cancelled')),
  batch_id uuid,
  bank_reference text check (bank_reference is null or char_length(bank_reference) <= 120),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  paid_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create unique index if not exists payout_requests_one_open on public.payout_requests(user_id) where status in ('requested', 'processing');
create index if not exists payout_requests_user on public.payout_requests(user_id, created_at desc);
create index if not exists payout_requests_status on public.payout_requests(status, created_at);
create index if not exists payout_requests_decided_by on public.payout_requests(decided_by);
alter table public.payout_requests enable row level security;
create policy payout_requests_own_read on public.payout_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.payout_requests from anon, authenticated;
grant select on public.payout_requests to authenticated;

-- Livro de movimentos (só as funções do servidor escrevem; ninguém apaga nem muda) ------------------------
create table if not exists public.wallet_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  payout_id uuid references public.payout_requests(id) on delete set null,
  bucket text not null check (bucket in ('pending', 'available')),
  kind text not null check (kind in ('sale', 'release', 'fee', 'refund', 'payout', 'payout_returned', 'adjustment')),
  amount numeric not null check (amount <> 0),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists wallet_entries_user on public.wallet_entries(user_id, id desc);
create index if not exists wallet_entries_order on public.wallet_entries(order_id);
create index if not exists wallet_entries_payout on public.wallet_entries(payout_id);
create index if not exists wallet_entries_created_by on public.wallet_entries(created_by);
alter table public.wallet_entries enable row level security;
create policy wallet_entries_own_read on public.wallet_entries for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.wallet_entries from anon, authenticated;
grant select on public.wallet_entries to authenticated;

-- Ajudantes ---------------------------------------------------------------------------------------------
create or replace function public.wallet_add(p_user uuid, p_order uuid, p_payout uuid, p_bucket text, p_kind text, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount = 0 then return; end if;
  insert into public.wallet_entries(user_id, order_id, payout_id, bucket, kind, amount, note, created_by)
  values (p_user, p_order, p_payout, p_bucket, p_kind, round(p_amount, 2), left(p_note, 300), auth.uid());
end $$;

/** IBAN angolano: 21 algarismos (com ou sem «AO06»), com o controlo do IBAN certo. Devolve os 21 algarismos ou null. */
create or replace function public.angola_iban_digits(p text) returns text
language plpgsql immutable set search_path = public as $$
declare s text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if s ~ '^AO06[0-9]{21}$' then s := substr(s, 5); end if;
  if s !~ '^[0-9]{21}$' then return null; end if;
  if mod((s || '102406')::numeric, 97) <> 1 then return null; end if;
  return s;
end $$;
create or replace function public.format_angola_iban(p_digits text) returns text
language sql immutable set search_path = public as $$
  select 'AO06 ' || trim(regexp_replace(p_digits, '(.{4})', '\1 ', 'g'));
$$;
/** Destino de um reembolso: IBAN angolano ou número Multicaixa Express. Devolve o texto arrumado ou null. */
create or replace function public.clean_refund_destination(p text) returns text
language plpgsql immutable set search_path = public as $$
declare d text := public.angola_iban_digits(p); n text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d is not null then return public.format_angola_iban(d); end if;
  if n ~ '^(244)?9[0-9]{8}$' then return 'Multicaixa Express ' || right(n, 9); end if;
  return null;
end $$;

create or replace function public.order_ref(o public.orders) returns text
language sql immutable set search_path = public as $$ select 'E-' || coalesce(o.ref_no::text, left(o.id::text, 8)) $$;

-- Regras automáticas nas encomendas protegidas ----------------------------------------------------------
create or replace function public.orders_escrow_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare days integer; diff numeric;
begin
  if not new.protected then return new; end if;
  if new.escrow_status = 'awaiting_payment' then
    if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then raise exception 'PROTECTED_PAID_BY_PLATFORM'; end if;
    if new.status in ('processing', 'ready', 'completed') or new.fulfillment_status in ('assigned', 'in_transit', 'delivered') then
      raise exception 'AWAITING_PAYMENT'; end if;
  end if;
  -- cancelada antes de pagar: a referência deixa de valer
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.escrow_status = 'awaiting_payment' then
    update public.order_payments set status = 'expired' where order_id = new.id and status = 'pending' and provider = 'proxypay';
  end if;
  -- entregue: começa a contagem para libertar o dinheiro
  if new.fulfillment_status = 'delivered' and old.fulfillment_status is distinct from 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
    if new.escrow_status = 'held' and new.release_at is null then
      select auto_release_days into days from public.platform_settings where id = 1;
      days := coalesce(days, 3);
      new.release_at := now() + make_interval(days => days);
      if new.received_at is null then
        insert into public.notifications(user_id, type, title, body, data)
        values (new.buyer_id, 'order', 'Recebeu a encomenda? 📦',
          'A encomenda ' || public.order_ref(new) || ' foi marcada como entregue. Carregue em «Confirmar receção» ou peça reembolso. Se não disser nada em '
          || days || ' dias, o pagamento é entregue ao vendedor.', jsonb_build_object('order_id', new.id, 'for', 'purchase'));
      end if;
    end if;
  end if;
  -- reembolso de dinheiro ainda retido: sai do saldo pendente do vendedor
  if new.refunded_amount > old.refunded_amount and old.escrow_status = 'held' then
    diff := new.refunded_amount - old.refunded_amount;
    perform public.wallet_add(new.seller_id, new.id, null, 'pending', 'refund', -diff, 'Reembolso ao cliente · ' || public.order_ref(new));
    if new.refunded_amount >= new.total then new.escrow_status := 'refunded'; end if;
  end if;
  return new;
end $$;
create trigger orders_escrow_guard before update on public.orders for each row execute function public.orders_escrow_guard();

-- Não se pede estafeta antes de o cliente pagar.
create or replace function public.delivery_requires_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders where id = new.order_id and escrow_status = 'awaiting_payment') then raise exception 'AWAITING_PAYMENT'; end if;
  return new;
end $$;
create trigger delivery_requires_payment before insert on public.delivery_requests for each row execute function public.delivery_requires_payment();

-- Reembolso de dinheiro retido: a administração tem de o enviar; o comprador diz para onde.
create or replace function public.escrow_refund_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if new.status <> 'awaiting_refund' or (tg_op = 'UPDATE' and old.status = 'awaiting_refund') then return new; end if;
  select * into o from public.orders where id = new.order_id;
  if o.escrow_status is distinct from 'held' then return new; end if;
  perform public.notify_staff('Reembolso a enviar (pagamento protegido)', coalesce(new.amount, o.total) || ' Kz · ' || public.order_ref(o),
    jsonb_build_object('dispute_id', new.id, 'order_id', o.id));
  if new.refund_to is null then
    insert into public.notifications(user_id, type, title, body, data)
    values (new.buyer_id, 'order', 'Para onde devolvemos o dinheiro?',
      'O Huambo Online vai devolver ' || coalesce(new.amount, o.total) || ' Kz da encomenda ' || public.order_ref(o) || '. Indique o seu IBAN ou número Multicaixa Express no pedido.',
      jsonb_build_object('order_id', o.id, 'dispute_id', new.id, 'for', 'dispute'));
  end if;
  return new;
end $$;
create trigger escrow_refund_alert after insert or update of status on public.order_disputes for each row execute function public.escrow_refund_alert();

-- Fazer a encomenda --------------------------------------------------------------------------------------
create or replace function public.place_orders_v2(p_fulfillment text, p_payment_method text, p_contact_phone text,
  p_delivery_text text default null, p_note text default null, p_protected boolean default false)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare ids uuid[]; st public.platform_settings;
begin
  if not coalesce(p_protected, false) then
    return public.place_orders(p_fulfillment, p_payment_method, p_contact_phone, p_delivery_text, p_note);
  end if;
  select * into st from public.platform_settings where id = 1;
  if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  ids := public.place_orders(p_fulfillment, 'reference', p_contact_phone, p_delivery_text, p_note);
  update public.orders set protected = true, escrow_status = 'awaiting_payment',
    pay_by = now() + make_interval(hours => st.payment_window_hours), updated_at = now()
   where id = any(ids);
  update public.notifications set body = body || ' 🛡️ Pagamento protegido: espere pelo aviso «Pagamento recebido» antes de enviar.',
    data = data || jsonb_build_object('for', 'sale')
   where type = 'order' and title = 'Nova encomenda' and data->>'order_id' = any(ids::text[]);
  return ids;
end $$;

-- Pagamento manual (transferência / Multicaixa Express com comprovativo) ---------------------------------
create or replace function public.submit_order_payment(p_order_id uuid, p_method text, p_reference text default null, p_proof_path text default null)
returns public.order_payments language plpgsql security definer set search_path = public as $$
declare o public.orders; pay public.order_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.order_payments where order_id = o.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.order_payments(order_id, buyer_id, amount, provider, method, reference, proof_path)
  values (o.id, auth.uid(), o.total, 'manual', p_method, ref, p_proof_path) returning * into pay;
  perform public.notify_staff('Pagamento protegido para confirmar', o.total || ' Kz · ' || public.order_ref(o),
    jsonb_build_object('payment_id', pay.id, 'order_id', o.id));
  return pay;
end $$;

-- Dinheiro recebido: fica retido (uso interno: administração ou ProxyPay) ---------------------------------
create or replace function public.escrow_mark_paid(p_payment_id uuid, p_paid_amount numeric, p_provider_payment_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare pay public.order_payments; o public.orders; d public.order_disputes;
begin
  select * into pay from public.order_payments where id = p_payment_id for update;
  if not found or pay.status not in ('pending', 'expired') then return false; end if;
  update public.order_payments set status = 'confirmed', decided_at = now(), decided_by = auth.uid(),
    paid_amount = coalesce(p_paid_amount, pay.amount), provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
   where id = pay.id returning * into pay;
  select * into o from public.orders where id = pay.order_id for update;
  if o.escrow_status <> 'awaiting_payment' then
    perform public.notify_staff('Pagamento a mais — devolver ao cliente', pay.paid_amount || ' Kz · ' || public.order_ref(o) || ' já estava paga.',
      jsonb_build_object('payment_id', pay.id, 'order_id', o.id));
    return false;
  end if;
  update public.orders set escrow_status = 'held', payment_status = 'paid', paid_at = now(), updated_at = now() where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'sale', o.total, 'Pagamento recebido · ' || public.order_ref(o));
  if o.status = 'cancelled' then
    if not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
      insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
      values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda foi paga depois de ser cancelada.', o.total, 'awaiting_refund')
      returning * into d;
      perform public.dispute_log(d, 'system', 'auto_refund', 'A encomenda foi paga depois de ser cancelada: o Huambo Online vai devolver o dinheiro.');
    end if;
  else
    insert into public.notifications(user_id, type, title, body, data) values
      (o.seller_id, 'order', 'Pagamento recebido 🛡️', 'O cliente pagou ' || o.total || ' Kz da encomenda ' || public.order_ref(o)
        || '. O dinheiro fica guardado pelo Huambo Online até o cliente receber. Já pode preparar e enviar.', jsonb_build_object('order_id', o.id, 'for', 'sale')),
      (o.buyer_id, 'order', 'Pagamento confirmado ✔', 'Recebemos ' || o.total || ' Kz da encomenda ' || public.order_ref(o)
        || '. O dinheiro fica guardado até confirmar que recebeu a encomenda.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $$;

create or replace function public.admin_decide_order_payment(p_payment_id uuid, p_confirm boolean, p_note text default null)
returns public.order_payments language plpgsql security definer set search_path = public as $$
declare pay public.order_payments; o public.orders; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into pay from public.order_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status <> 'pending' or pay.provider <> 'manual' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  select * into o from public.orders where id = pay.order_id;
  if p_confirm then
    perform public.escrow_mark_paid(pay.id, null, null);
  else
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.order_payments set status = 'rejected', admin_note = txt, decided_at = now(), decided_by = auth.uid() where id = pay.id;
    -- mais um dia para voltar a enviar
    update public.orders set pay_by = greatest(pay_by, now() + interval '24 hours'), updated_at = now() where id = o.id and escrow_status = 'awaiting_payment';
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento não confirmado', txt || ' Pode enviar o comprovativo outra vez.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'order_payment_confirmed' else 'order_payment_rejected' end, 'order', o.id,
    jsonb_build_object('payment_id', pay.id, 'amount', pay.amount, 'note', txt));
  select * into pay from public.order_payments where id = p_payment_id;
  return pay;
end $$;

-- Referências ProxyPay (só a Edge Function, com a chave de serviço do servidor) ----------------------------
-- Pedido pelo comprador (com a sessão dele): diz o valor a pôr na referência.
create or replace function public.order_payment_quote(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders; pay public.order_payments;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  select * into pay from public.order_payments where order_id = o.id and status = 'pending' and provider = 'proxypay' and (expires_at is null or expires_at > now());
  return jsonb_build_object('order_id', o.id, 'buyer_id', o.buyer_id, 'amount', o.total, 'ref', public.order_ref(o), 'pay_by', o.pay_by,
    'existing', case when pay.id is null then null else jsonb_build_object('entity', pay.entity, 'reference', pay.reference, 'amount', pay.amount, 'expires_at', pay.expires_at) end);
end $$;

create or replace function public.provider_register_reference(p_order_id uuid, p_entity text, p_reference text, p_amount numeric, p_expires_at timestamptz)
returns public.order_payments language plpgsql security definer set search_path = public as $$
declare o public.orders; pay public.order_payments;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  if p_amount <> o.total then raise exception 'INVALID_AMOUNT'; end if;
  update public.order_payments set status = 'expired' where order_id = o.id and status = 'pending' and provider = 'proxypay';
  if exists (select 1 from public.order_payments where order_id = o.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.order_payments(order_id, buyer_id, amount, provider, method, entity, reference, expires_at)
  values (o.id, o.buyer_id, o.total, 'proxypay', 'reference', p_entity, p_reference, p_expires_at) returning * into pay;
  return pay;
end $$;

-- Aviso de pagamento da ProxyPay. Pode chegar repetido: só conta uma vez.
create or replace function public.provider_confirm_payment(p_reference text, p_amount numeric, p_provider_payment_id text)
returns text language plpgsql security definer set search_path = public as $$
declare pay public.order_payments;
begin
  if p_provider_payment_id is null or p_reference is null then return 'invalid'; end if;
  if exists (select 1 from public.order_payments where provider_payment_id = p_provider_payment_id) then return 'duplicate'; end if;
  select * into pay from public.order_payments where provider = 'proxypay' and reference = p_reference and status in ('pending', 'expired')
   order by created_at desc limit 1 for update;
  if not found then
    perform public.notify_staff('Pagamento ProxyPay sem encomenda', p_amount || ' Kz · referência ' || p_reference, jsonb_build_object('reference', p_reference));
    return 'unknown_reference';
  end if;
  if p_amount < pay.amount then
    update public.order_payments set paid_amount = p_amount, provider_payment_id = p_provider_payment_id,
      admin_note = 'Pagou ' || p_amount || ' Kz em vez de ' || pay.amount || ' Kz.' where id = pay.id;
    perform public.notify_staff('Pagamento com valor errado', p_amount || ' Kz em vez de ' || pay.amount || ' Kz · referência ' || p_reference,
      jsonb_build_object('payment_id', pay.id, 'order_id', pay.order_id));
    return 'amount_mismatch';
  end if;
  perform public.escrow_mark_paid(pay.id, p_amount, p_provider_payment_id);
  return 'ok';
end $$;

-- Libertar o dinheiro ao vendedor --------------------------------------------------------------------------
create or replace function public.escrow_release(p_order_id uuid, p_by text, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
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
  fee := round(net * coalesce(pct, 0) / 100, 2);
  update public.orders set escrow_status = 'released', released_at = now(), platform_fee = fee,
    status = case when status = 'cancelled' then status else 'completed' end,
    fulfillment_status = case when status = 'cancelled' then fulfillment_status else 'delivered' end,
    completed_at = coalesce(completed_at, case when status = 'cancelled' then null else now() end), updated_at = now()
   where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'release', -net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'release', net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'fee', -fee, 'Comissão do pagamento protegido (' || pct || '%) · ' || public.order_ref(o));
  insert into public.notifications(user_id, type, title, body, data)
  values (o.seller_id, 'system', 'Dinheiro disponível 💰', (net - fee) || ' Kz da encomenda ' || public.order_ref(o) || ' já podem ser levantados.',
    jsonb_build_object('order_id', o.id, 'for', 'wallet'));
  if p_by = 'auto' then
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento entregue ao vendedor', 'Passou o prazo depois da entrega da encomenda ' || public.order_ref(o)
      || ' sem reclamação, por isso o pagamento foi entregue ao vendedor.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $$;

create or replace function public.confirm_order_received(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected then raise exception 'NOT_PROTECTED'; end if;
  if o.escrow_status = 'awaiting_payment' then raise exception 'AWAITING_PAYMENT'; end if;
  if o.escrow_status <> 'held' or o.status = 'cancelled' then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  update public.orders set received_at = now(), status = 'completed', fulfillment_status = 'delivered',
    completed_at = coalesce(completed_at, now()), updated_at = now() where id = o.id;
  perform public.escrow_release(o.id, 'buyer');
  select * into o from public.orders where id = p_order_id;
  return o;
end $$;

create or replace function public.admin_release_escrow(p_order_id uuid, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  if exists (select 1 from public.order_disputes where order_id = p_order_id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  ok := public.escrow_release(p_order_id, 'admin', true);
  if not ok then raise exception 'NOTHING_TO_RELEASE'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'escrow_released', 'order', p_order_id, jsonb_build_object('note', txt));
  return true;
end $$;

-- Disputas: o reembolso de dinheiro retido é enviado pela administração --------------------------------------
create or replace function public.set_dispute_refund_account(p_dispute_id uuid, p_account text)
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare d public.order_disputes; dest text := public.clean_refund_destination(p_account);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found or d.buyer_id <> auth.uid() then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  if dest is null then raise exception 'INVALID_REFUND_ACCOUNT'; end if;
  update public.order_disputes set refund_to = dest where id = d.id returning * into d;
  perform public.dispute_log(d, 'buyer', 'comment', 'Devolver o dinheiro para: ' || dest);
  return d;
end $$;

create or replace function public.dispute_action(p_dispute_id uuid, p_action text, p_note text default null, p_photos text[] default '{}')
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare d public.order_disputes; r text; ph text[]; nxt text; outc text; ev text; held boolean; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  r := case when d.buyer_id = auth.uid() then 'buyer' when d.seller_id = auth.uid() then 'seller' when public.has_admin_role() then 'admin' end;
  if r is null then raise exception 'NOT_ORDER_PARTY'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  -- dinheiro ainda guardado pelo Huambo Online (pagamento protegido): o reembolso sai da plataforma
  held := exists (select 1 from public.orders where id = d.order_id and escrow_status = 'held');
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
  elsif p_action = 'mark_refunded' and d.status = 'awaiting_refund' and ((r = 'seller' and not held) or (r = 'admin' and held)) then
    if held and d.refund_to is null then raise exception 'REFUND_ACCOUNT_REQUIRED'; end if;
    nxt := 'refund_sent';
  elsif p_action = 'confirm_refund' and d.status = 'refund_sent' and (r = 'buyer' or (r = 'admin' and held)) then nxt := 'resolved'; outc := 'refunded';
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

create or replace function public.my_disputes_v2()
returns table(id uuid, order_id uuid, my_role text, other_name text, request text, reason text, description text, amount numeric,
  status text, outcome text, admin_note text, created_at timestamptz, updated_at timestamptz, order_total numeric, order_items jsonb, events jsonb,
  protected boolean, escrow_status text, refund_to text)
language sql stable security definer set search_path = public as $$
  select d.id, d.order_id, case when d.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note,
    d.created_at, d.updated_at, o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', oi.quantity) order by pr.name), '[]')
       from public.order_items oi join public.products pr on pr.id = oi.product_id where oi.order_id = o.id),
    public.dispute_events_json(d.id), o.protected, o.escrow_status,
    case when d.buyer_id = auth.uid() then d.refund_to end
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles p on p.id = case when d.buyer_id = auth.uid() then d.seller_id else d.buyer_id end
  where auth.uid() in (d.buyer_id, d.seller_id)
  order by (d.status <> 'resolved') desc, d.updated_at desc limit 100;
$$;

create or replace function public.admin_list_disputes_v2(p_status text default 'escalated')
returns table(id uuid, order_id uuid, buyer_id uuid, buyer_name text, seller_id uuid, seller_name text, request text, reason text, description text,
  amount numeric, status text, outcome text, admin_note text, created_at timestamptz, updated_at timestamptz, order_total numeric,
  payment_method text, order_status text, events jsonb, protected boolean, escrow_status text, refund_to text, order_ref text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), d.seller_id, coalesce(nullif(s.full_name, ''), 'Utilizador'),
    d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note, d.created_at, d.updated_at, o.total, o.payment_method, o.status,
    public.dispute_events_json(d.id), o.protected, o.escrow_status, d.refund_to, public.order_ref(o)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles b on b.id = d.buyer_id left join public.profiles s on s.id = d.seller_id
  where p_status is null or (p_status = 'active' and d.status <> 'resolved') or d.status = p_status
    or (p_status = 'escrow_refunds' and o.escrow_status = 'held' and d.status in ('awaiting_refund', 'refund_sent'))
  order by (d.status = 'escalated') desc, d.updated_at limit 200;
end $$;

-- Encomendas com o estado do pagamento protegido ---------------------------------------------------------
create or replace function public.my_orders_v3(p_role text default 'buyer')
returns table(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text,
  created_at timestamptz, updated_at timestamptz, completed_at timestamptz, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text,
  contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text,
  pay_by timestamptz, paid_at timestamptz, delivered_at timestamptz, release_at timestamptz, released_at timestamptz, platform_fee numeric, payment jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id),
         o.fulfillment_status, o.protected, o.escrow_status, o.pay_by, o.paid_at, o.delivered_at, o.release_at, o.released_at,
         case when p_role = 'seller' then o.platform_fee else 0 end,
         case when p_role = 'seller' or not o.protected then null else
           (select jsonb_build_object('id', op.id, 'status', op.status, 'provider', op.provider, 'method', op.method, 'entity', op.entity,
              'reference', op.reference, 'amount', op.amount, 'expires_at', op.expires_at, 'admin_note', op.admin_note, 'created_at', op.created_at)
              from public.order_payments op where op.order_id = o.id order by op.created_at desc limit 1) end
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$$;

-- Encomenda paga e cancelada: com pagamento protegido, quem devolve é o Huambo Online.
create or replace function public.update_order_status(p_order_id uuid, p_status text, p_paid boolean default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; is_seller boolean; is_buyer boolean; label text; was_paid boolean; held boolean; d public.order_disputes;
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
  held := o.escrow_status = 'held';
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
    when 'completed' then case when o.protected then 'entregue' else 'concluída' end when 'cancelled' then 'cancelada' else p_status end;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when auth.uid() = o.buyer_id then o.seller_id else o.buyer_id end, 'order', 'Encomenda ' || label,
          'A encomenda de ' || o.total || ' Kz foi ' || label || '.', jsonb_build_object('order_id', o.id));
  if p_status = 'cancelled' and was_paid and o.total > o.refunded_amount
     and not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
    insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
    values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda já estava paga e foi cancelada.', o.total - o.refunded_amount, 'awaiting_refund')
    returning * into d;
    perform public.dispute_log(d, 'system', 'auto_refund', case when held
      then 'A encomenda já estava paga e foi cancelada: o Huambo Online vai devolver o dinheiro guardado.'
      else 'A encomenda já estava paga e foi cancelada: o vendedor tem de devolver o dinheiro.' end);
  end if;
  return o;
end $$;

-- Saldo e levantamentos (vendedor) ------------------------------------------------------------------------
create or replace function public.save_payout_account(p_method text, p_holder text, p_destination text)
returns public.payout_accounts language plpgsql security definer set search_path = public as $$
declare a public.payout_accounts; holder text := nullif(left(trim(coalesce(p_holder, '')), 120), ''); dig text; num text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if holder is null or char_length(holder) < 3 then raise exception 'HOLDER_REQUIRED'; end if;
  if p_method = 'iban' then
    dig := public.angola_iban_digits(p_destination);
    if dig is null then raise exception 'INVALID_IBAN'; end if;
  elsif p_method = 'express' then
    num := right(regexp_replace(coalesce(p_destination, ''), '[^0-9]', '', 'g'), 9);
    if num !~ '^9[0-9]{8}$' then raise exception 'INVALID_EXPRESS_NUMBER'; end if;
  else raise exception 'INVALID_PAYOUT_METHOD'; end if;
  insert into public.payout_accounts(user_id, method, holder_name, iban, express_number, updated_at)
  values (auth.uid(), p_method, holder, dig, num, now())
  on conflict (user_id) do update set method = excluded.method, holder_name = excluded.holder_name, iban = excluded.iban,
    express_number = excluded.express_number, updated_at = now()
  returning * into a;
  return a;
end $$;

create or replace function public.my_wallet()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare st public.platform_settings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'pending', (select coalesce(sum(amount), 0) from public.wallet_entries where user_id = uid and bucket = 'pending'),
    'available', (select coalesce(sum(amount), 0) from public.wallet_entries where user_id = uid and bucket = 'available'),
    'in_payout', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = uid and status in ('requested', 'processing')),
    'paid_out', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = uid and status = 'paid'),
    'account', (select jsonb_build_object('method', a.method, 'holder_name', a.holder_name,
        'destination', case when a.method = 'iban' then public.format_angola_iban(a.iban) else a.express_number end, 'updated_at', a.updated_at)
      from public.payout_accounts a where a.user_id = uid),
    'entries', (select coalesce(jsonb_agg(x order by x.id desc), '[]') from (
        select e.id, e.bucket, e.kind, e.amount, e.note, e.created_at, e.order_id from public.wallet_entries e where e.user_id = uid order by e.id desc limit 100) x),
    'payouts', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select p.id, p.ref_no, p.amount, p.method, p.destination, p.status, p.admin_note, p.bank_reference, p.created_at, p.paid_at
          from public.payout_requests p where p.user_id = uid order by p.created_at desc limit 50) x),
    'payout_min_kz', st.payout_min_kz, 'payout_weekdays', to_jsonb(st.payout_weekdays), 'fee_pct', st.protected_fee_pct,
    'auto_release_days', st.auto_release_days);
end $$;

create or replace function public.request_payout(p_amount numeric default null)
returns public.payout_requests language plpgsql security definer set search_path = public as $$
declare a public.payout_accounts; st public.platform_settings; avail numeric; amt numeric; pr public.payout_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payout:' || auth.uid()::text, 0));
  select * into a from public.payout_accounts where user_id = auth.uid();
  if not found then raise exception 'PAYOUT_ACCOUNT_REQUIRED'; end if;
  if exists (select 1 from public.payout_requests where user_id = auth.uid() and status in ('requested', 'processing')) then raise exception 'PAYOUT_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  select coalesce(sum(amount), 0) into avail from public.wallet_entries where user_id = auth.uid() and bucket = 'available';
  amt := round(coalesce(p_amount, avail), 2);
  if amt <= 0 or amt > avail then raise exception 'NOT_ENOUGH_BALANCE'; end if;
  if amt < st.payout_min_kz then raise exception 'PAYOUT_TOO_SMALL'; end if;
  insert into public.payout_requests(user_id, amount, method, holder_name, destination)
  values (auth.uid(), amt, a.method, a.holder_name, case when a.method = 'iban' then public.format_angola_iban(a.iban) else a.express_number end)
  returning * into pr;
  perform public.wallet_add(auth.uid(), null, pr.id, 'available', 'payout', -amt, 'Levantamento L-' || pr.ref_no);
  perform public.notify_staff('Pedido de levantamento', amt || ' Kz · ' || a.holder_name || ' · L-' || pr.ref_no, jsonb_build_object('payout_id', pr.id));
  return pr;
end $$;

create or replace function public.cancel_payout(p_payout_id uuid)
returns public.payout_requests language plpgsql security definer set search_path = public as $$
declare pr public.payout_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into pr from public.payout_requests where id = p_payout_id for update;
  if not found or pr.user_id <> auth.uid() then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if pr.status <> 'requested' then raise exception 'PAYOUT_IN_PROGRESS'; end if;
  update public.payout_requests set status = 'cancelled' where id = pr.id returning * into pr;
  perform public.wallet_add(pr.user_id, null, pr.id, 'available', 'payout_returned', pr.amount, 'Levantamento L-' || pr.ref_no || ' cancelado');
  return pr;
end $$;

-- Administração -----------------------------------------------------------------------------------------
create or replace function public.admin_list_order_payments(p_status text default 'pending')
returns table(id uuid, order_id uuid, order_ref text, buyer_id uuid, buyer_name text, buyer_phone text, seller_name text, amount numeric,
  paid_amount numeric, provider text, method text, status text, entity text, reference text, proof_path text, admin_note text,
  created_at timestamptz, decided_at timestamptz, order_status text, escrow_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.order_id, public.order_ref(o), p.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), o.contact_phone,
    coalesce(nullif(s.full_name, ''), 'Utilizador'), p.amount, p.paid_amount, p.provider, p.method, p.status, p.entity, p.reference, p.proof_path,
    p.admin_note, p.created_at, p.decided_at, o.status, o.escrow_status
  from public.order_payments p join public.orders o on o.id = p.order_id
  left join public.profiles b on b.id = p.buyer_id left join public.profiles s on s.id = o.seller_id
  where p_status is null or p.status = p_status
  order by p.created_at desc limit 200;
end $$;

create or replace function public.admin_list_payouts(p_status text default 'requested')
returns table(id uuid, ref_no bigint, user_id uuid, user_name text, phone text, amount numeric, method text, holder_name text, destination text,
  status text, batch_id uuid, bank_reference text, admin_note text, created_at timestamptz, processed_at timestamptz, paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.user_id, coalesce(nullif(pf.full_name, ''), 'Utilizador'), pf.phone, p.amount, p.method, p.holder_name,
    p.destination, p.status, p.batch_id, p.bank_reference, p.admin_note, p.created_at, p.processed_at, p.paid_at
  from public.payout_requests p left join public.profiles pf on pf.id = p.user_id
  where p_status is null or p.status = p_status
  order by p.created_at limit 500;
end $$;

-- Junta todos os pedidos novos num lote (para o ficheiro do banco).
create or replace function public.admin_start_payout_batch()
returns uuid language plpgsql security definer set search_path = public as $$
declare b uuid := gen_random_uuid(); n integer;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.payout_requests set status = 'processing', batch_id = b, processed_at = now(), decided_by = auth.uid() where status = 'requested';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NO_PAYOUTS'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout_batch_started', 'payout_batch', b, jsonb_build_object('count', n));
  return b;
end $$;

create or replace function public.admin_mark_payouts_paid(p_ids uuid[], p_bank_reference text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare pr public.payout_requests; n integer := 0; ref text := nullif(left(trim(coalesce(p_bank_reference, '')), 120), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  for pr in update public.payout_requests set status = 'paid', paid_at = now(), bank_reference = coalesce(ref, bank_reference), decided_by = auth.uid()
    where id = any(p_ids) and status in ('requested', 'processing') returning * loop
    n := n + 1;
    insert into public.notifications(user_id, type, title, body, data)
    values (pr.user_id, 'system', 'Levantamento pago 💸', pr.amount || ' Kz foram enviados para ' || pr.destination || ' (L-' || pr.ref_no || ').',
      jsonb_build_object('payout_id', pr.id, 'for', 'wallet'));
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'payout_paid', 'payout', pr.id, jsonb_build_object('amount', pr.amount, 'reference', ref));
  end loop;
  return n;
end $$;

create or replace function public.admin_reject_payout(p_payout_id uuid, p_note text)
returns public.payout_requests language plpgsql security definer set search_path = public as $$
declare pr public.payout_requests; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into pr from public.payout_requests where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if pr.status not in ('requested', 'processing') then raise exception 'PAYOUT_ALREADY_DECIDED'; end if;
  update public.payout_requests set status = 'rejected', admin_note = txt, decided_by = auth.uid() where id = pr.id returning * into pr;
  perform public.wallet_add(pr.user_id, null, pr.id, 'available', 'payout_returned', pr.amount, 'Levantamento L-' || pr.ref_no || ' não feito');
  insert into public.notifications(user_id, type, title, body, data)
  values (pr.user_id, 'system', 'Levantamento não feito', txt || ' O dinheiro voltou ao seu saldo.', jsonb_build_object('payout_id', pr.id, 'for', 'wallet'));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout_rejected', 'payout', pr.id, jsonb_build_object('amount', pr.amount, 'note', txt));
  return pr;
end $$;

create or replace function public.admin_escrow_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'held', (select coalesce(sum(amount), 0) from public.wallet_entries where bucket = 'pending'),
    'available', (select coalesce(sum(amount), 0) from public.wallet_entries where bucket = 'available'),
    'payouts_open', (select coalesce(sum(amount), 0) from public.payout_requests where status in ('requested', 'processing')),
    'payouts_requested', (select count(*) from public.payout_requests where status = 'requested'),
    'payouts_processing', (select count(*) from public.payout_requests where status = 'processing'),
    'payments_pending', (select count(*) from public.order_payments where status = 'pending' and provider = 'manual'),
    'awaiting_payment', (select count(*) from public.orders where escrow_status = 'awaiting_payment' and status <> 'cancelled'),
    'refunds_to_send', (select count(*) from public.order_disputes d join public.orders o on o.id = d.order_id
                         where o.escrow_status = 'held' and d.status = 'awaiting_refund'),
    'fees_30d', (select coalesce(sum(platform_fee), 0) from public.orders where released_at > now() - interval '30 days'));
end $$;

-- Receitas: junta a comissão do pagamento protegido.
create or replace function public.admin_revenue(p_from date, p_to date)
returns table(paid_at timestamptz, kind text, description text, payer_name text, amount numeric, method text, reference text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_PERIOD'; end if;
  return query
  select p.decided_at, 'plan_' || s.kind, public.plan_subject_name(s) || ' · ' || p.months || case when p.months = 1 then ' mês' else ' meses' end,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), p.amount, p.method, p.reference
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'confirmed' and (p.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select c.decided_at, 'commission', c.listing_title || ' · venda ' || c.sale_amount || ' Kz', coalesce(nullif(pr.full_name, ''), 'Utilizador'), c.amount, c.method, c.reference
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where c.status = 'paid' and (c.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select o.released_at, 'protected_fee', 'Pagamento protegido · ' || public.order_ref(o) || ' · ' || (o.total - o.refunded_amount) || ' Kz',
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), o.platform_fee, null::text, null::text
  from public.orders o left join public.profiles pr on pr.id = o.seller_id
  where o.platform_fee > 0 and (o.released_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $$;

-- Tarefas automáticas (a cada 15 minutos) -------------------------------------------------------------------
create or replace function public.escrow_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; cancelled integer := 0; released integer := 0;
begin
  -- 1) encomendas protegidas não pagas a tempo (e sem comprovativo à espera) são canceladas e o stock volta
  for o in select * from public.orders x where x.escrow_status = 'awaiting_payment' and x.status <> 'cancelled' and x.pay_by < now()
      and not exists (select 1 from public.order_payments p where p.order_id = x.id and p.status = 'pending' and p.provider = 'manual')
      for update skip locked loop
    update public.products p set stock = p.stock + oi.quantity, updated_at = now() from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
    update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id;
    insert into public.notifications(user_id, type, title, body, data) values
      (o.buyer_id, 'order', 'Encomenda cancelada', 'A encomenda ' || public.order_ref(o) || ' foi cancelada porque o pagamento não chegou a tempo.',
        jsonb_build_object('order_id', o.id, 'for', 'purchase')),
      (o.seller_id, 'order', 'Encomenda cancelada', 'O cliente não pagou a encomenda ' || public.order_ref(o) || ' a tempo. O stock voltou à Loja.',
        jsonb_build_object('order_id', o.id, 'for', 'sale'));
    cancelled := cancelled + 1;
  end loop;
  -- 2) referências ProxyPay vencidas
  update public.order_payments set status = 'expired' where provider = 'proxypay' and status = 'pending' and expires_at < now();
  -- 3) dinheiro libertado depois do prazo, sem reclamação
  for o in select * from public.orders x where x.escrow_status = 'held' and x.status <> 'cancelled' and x.release_at <= now()
      and not exists (select 1 from public.order_disputes d where d.order_id = x.id and d.status <> 'resolved') loop
    if public.escrow_release(o.id, 'auto') then released := released + 1; end if;
  end loop;
  return jsonb_build_object('cancelled', cancelled, 'released', released);
end $$;
select cron.schedule('huambo-online-escrow-tick', '*/15 * * * *', 'select public.escrow_tick();');

-- Permissões -----------------------------------------------------------------------------------------------
revoke all on function public.wallet_add(uuid, uuid, uuid, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.angola_iban_digits(text) from public, anon;
revoke all on function public.format_angola_iban(text) from public, anon;
revoke all on function public.clean_refund_destination(text) from public, anon;
revoke all on function public.order_ref(public.orders) from public, anon;
revoke all on function public.orders_escrow_guard() from public, anon, authenticated;
revoke all on function public.delivery_requires_payment() from public, anon, authenticated;
revoke all on function public.escrow_refund_alert() from public, anon, authenticated;
revoke all on function public.escrow_mark_paid(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.escrow_release(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.escrow_tick() from public, anon, authenticated;
revoke all on function public.provider_register_reference(uuid, text, text, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.provider_confirm_payment(text, numeric, text) from public, anon, authenticated;
grant execute on function public.provider_register_reference(uuid, text, text, numeric, timestamptz) to service_role;
grant execute on function public.provider_confirm_payment(text, numeric, text) to service_role;

revoke all on function public.place_orders_v2(text, text, text, text, text, boolean) from public, anon;
revoke all on function public.submit_order_payment(uuid, text, text, text) from public, anon;
revoke all on function public.admin_decide_order_payment(uuid, boolean, text) from public, anon;
revoke all on function public.order_payment_quote(uuid) from public, anon;
revoke all on function public.confirm_order_received(uuid) from public, anon;
revoke all on function public.admin_release_escrow(uuid, text) from public, anon;
revoke all on function public.set_dispute_refund_account(uuid, text) from public, anon;
revoke all on function public.my_disputes_v2() from public, anon;
revoke all on function public.admin_list_disputes_v2(text) from public, anon;
revoke all on function public.my_orders_v3(text) from public, anon;
revoke all on function public.save_payout_account(text, text, text) from public, anon;
revoke all on function public.my_wallet() from public, anon;
revoke all on function public.request_payout(numeric) from public, anon;
revoke all on function public.cancel_payout(uuid) from public, anon;
revoke all on function public.admin_list_order_payments(text) from public, anon;
revoke all on function public.admin_list_payouts(text) from public, anon;
revoke all on function public.admin_start_payout_batch() from public, anon;
revoke all on function public.admin_mark_payouts_paid(uuid[], text) from public, anon;
revoke all on function public.admin_reject_payout(uuid, text) from public, anon;
revoke all on function public.admin_escrow_summary() from public, anon;
grant execute on function public.place_orders_v2(text, text, text, text, text, boolean) to authenticated;
grant execute on function public.submit_order_payment(uuid, text, text, text) to authenticated;
grant execute on function public.admin_decide_order_payment(uuid, boolean, text) to authenticated;
grant execute on function public.order_payment_quote(uuid) to authenticated;
grant execute on function public.confirm_order_received(uuid) to authenticated;
grant execute on function public.admin_release_escrow(uuid, text) to authenticated;
grant execute on function public.set_dispute_refund_account(uuid, text) to authenticated;
grant execute on function public.my_disputes_v2() to authenticated;
grant execute on function public.admin_list_disputes_v2(text) to authenticated;
grant execute on function public.my_orders_v3(text) to authenticated;
grant execute on function public.save_payout_account(text, text, text) to authenticated;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.request_payout(numeric) to authenticated;
grant execute on function public.cancel_payout(uuid) to authenticated;
grant execute on function public.admin_list_order_payments(text) to authenticated;
grant execute on function public.admin_list_payouts(text) to authenticated;
grant execute on function public.admin_start_payout_batch() to authenticated;
grant execute on function public.admin_mark_payouts_paid(uuid[], text) to authenticated;
grant execute on function public.admin_reject_payout(uuid, text) to authenticated;
grant execute on function public.admin_escrow_summary() to authenticated;
