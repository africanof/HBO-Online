-- Inspeção de artigos pela equipa do Huambo Online (todo o marketplace: anúncios e produtos da Loja).
--
-- Dois modos:
-- • VENDEDOR («seller»): pede antes de vender. Se for aprovada, o anúncio ganha o selo
--   «🔍 Inspecionado pelo Huambo Online» com o relatório (válido 90 dias).
-- • COMPRADOR («buyer»): junta a inspeção a uma encomenda com pagamento protegido. O dinheiro fica retido
--   até ao fim: aprovada → a equipa entrega o artigo (eletrónicos/artigos) ou acompanha a transferência de
--   propriedade (viaturas/imóveis) e a encomenda segue para entregue; não aprovada → abre-se o reembolso ao
--   comprador pelas reclamações (order_disputes) e o artigo volta ao vendedor.
--
-- Tipos e taxas (platform_settings, a equipa muda no painel): artigo/eletrónico 2 000 Kz, viatura 10 000 Kz,
-- imóvel/terreno 20 000 Kz. A taxa paga-se ao Huambo Online com comprovativo (a IA pode confirmar até ao limite).
-- Passos: awaiting_payment → payment_submitted → paid → scheduled → in_progress → approved | failed
--         (comprador, aprovada) → handed_over.  cancelled em qualquer passo antes de começar.

alter table public.platform_settings
  add column if not exists item_inspection_fee_item numeric not null default 2000,
  add column if not exists item_inspection_fee_vehicle numeric not null default 10000,
  add column if not exists item_inspection_fee_property numeric not null default 20000,
  add column if not exists item_inspection_valid_days int not null default 90;

create table if not exists public.item_inspections (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity,
  mode text not null check (mode in ('seller', 'buyer')),
  category text not null check (category in ('item', 'vehicle', 'property')),
  listing_id uuid references public.classified_listings(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  requester_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'payment_submitted', 'paid', 'scheduled', 'in_progress', 'approved', 'failed', 'handed_over', 'cancelled')),
  fee numeric not null check (fee >= 0),
  pay_by timestamptz, pay_method text, pay_reference text, pay_reference_norm text, pay_proof_path text, pay_proof_hash text, paid_at timestamptz,
  note text check (char_length(note) <= 500),
  scheduled_for timestamptz, place text check (char_length(place) <= 300),
  checklist jsonb not null default '{}'::jsonb,
  report text check (char_length(report) <= 2000),
  photos text[] not null default '{}',
  inspector_id uuid references auth.users(id) on delete set null,
  inspected_at timestamptz, valid_until timestamptz, handed_over_at timestamptz,
  team_note text check (char_length(team_note) <= 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (listing_id is not null or product_id is not null)
);
create index if not exists item_inspections_listing_idx on public.item_inspections(listing_id, status);
create index if not exists item_inspections_order_idx on public.item_inspections(order_id);
create index if not exists item_inspections_status_idx on public.item_inspections(status, updated_at desc);
create unique index if not exists item_inspections_ref_uq on public.item_inspections(pay_reference_norm) where pay_reference_norm is not null;
alter table public.item_inspections enable row level security;
drop policy if exists item_inspections_read on public.item_inspections;
create policy item_inspections_read on public.item_inspections for select to authenticated
  using (requester_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.has_admin_role()));
grant select on public.item_inspections to authenticated;

create or replace function public.item_inspection_ref(n bigint) returns text language sql immutable as $$ select 'INS-' || n $$;
create or replace function public.item_inspection_category(p_listing_type text) returns text language sql immutable as $$
  select case p_listing_type when 'vehicle' then 'vehicle' when 'real_estate' then 'property' else 'item' end $$;
create or replace function public.item_inspection_fee(p_category text) returns numeric language sql stable security definer set search_path = public as $$
  select case p_category when 'vehicle' then item_inspection_fee_vehicle when 'property' then item_inspection_fee_property else item_inspection_fee_item end
  from public.platform_settings where id = 1 $$;

create or replace function public._item_inspection_notify(i public.item_inspections, p_to uuid, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data)
  values (p_to, 'system', p_title, public.item_inspection_ref(i.ref_no) || coalesce(' · ' || left(i.title, 60), '') || coalesce(' · ' || p_body, ''),
    jsonb_build_object('for', 'inspections', 'item_inspection_id', i.id));
$$;

-- Pedir uma inspeção: o vendedor para o seu anúncio/produto, ou o comprador para a sua encomenda protegida.
create or replace function public.request_item_inspection(p_listing_id uuid default null, p_product_id uuid default null, p_order_id uuid default null, p_note text default null)
returns public.item_inspections language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.classified_listings; p public.products; o public.orders; i public.item_inspections;
  v_mode text; v_cat text; v_seller uuid; v_title text; v_listing uuid := p_listing_id; v_product uuid := p_product_id;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_order_id is not null then
    select * into o from public.orders where id = p_order_id;
    if not found or o.buyer_id <> me then raise exception 'ORDER_NOT_FOUND'; end if;
    if not o.protected or o.status in ('completed', 'cancelled') or o.fulfillment_status = 'delivered' or o.escrow_status not in ('awaiting_payment', 'held') then raise exception 'INSPECTION_NOT_ALLOWED'; end if;
    v_mode := 'buyer'; v_seller := o.seller_id; v_title := o.title; v_listing := o.listing_id;
    if v_listing is null then select oi.product_id into v_product from public.order_items oi where oi.order_id = o.id limit 1; end if;
  else
    v_mode := 'seller';
  end if;
  if v_listing is not null then
    select * into l from public.classified_listings where id = v_listing;
    if not found then raise exception 'LISTING_NOT_FOUND'; end if;
    if v_mode = 'seller' and l.owner_id <> me then raise exception 'NOT_OWNER'; end if;
    v_cat := public.item_inspection_category(l.listing_type); v_seller := coalesce(v_seller, l.owner_id); v_title := coalesce(v_title, l.title);
  elsif v_product is not null then
    select * into p from public.products where id = v_product;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if v_mode = 'seller' and p.seller_id <> me then raise exception 'NOT_OWNER'; end if;
    v_cat := 'item'; v_seller := coalesce(v_seller, p.seller_id); v_title := coalesce(v_title, p.name);
  else
    raise exception 'INVALID_INPUT';
  end if;
  if exists (select 1 from public.item_inspections x where x.requester_id = me and x.status not in ('approved', 'failed', 'handed_over', 'cancelled')
             and coalesce(x.order_id::text, '') = coalesce(p_order_id::text, '') and coalesce(x.listing_id, x.product_id) = coalesce(v_listing, v_product)) then
    raise exception 'INSPECTION_EXISTS'; end if;
  insert into public.item_inspections(mode, category, listing_id, product_id, order_id, requester_id, seller_id, title, fee, pay_by, note)
  values (v_mode, v_cat, v_listing, case when v_listing is null then v_product end, p_order_id, me, v_seller, left(v_title, 200),
    public.item_inspection_fee(v_cat), now() + interval '48 hours', nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into i;
  if v_mode = 'buyer' then
    perform public._item_inspection_notify(i, v_seller, '🔍 O comprador pediu inspeção', 'A equipa do Huambo Online vai inspecionar o artigo antes da entrega. Aguarde o contacto da equipa.');
  end if;
  return i;
end $$;

-- Comprovativo da taxa.
create or replace function public.submit_item_inspection_payment(p_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text default null)
returns public.item_inspections language plpgsql security definer set search_path = public as $$
declare i public.item_inspections; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into i from public.item_inspections where id = p_id for update;
  if not found or i.requester_id <> me then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if i.status <> 'awaiting_payment' then raise exception 'INVALID_TRANSITION'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'FUEL_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.item_inspections x where x.id <> i.id and x.pay_reference_norm = ref_n) then raise exception 'FUEL_REFERENCE_USED'; end if;
  if h is not null and exists (select 1 from public.item_inspections x where x.id <> i.id and x.pay_proof_hash = h) then raise exception 'FUEL_PROOF_USED'; end if;
  update public.item_inspections set status = 'payment_submitted', pay_method = p_method, pay_reference = left(trim(p_reference), 120), pay_reference_norm = ref_n,
    pay_proof_path = p_proof_path, pay_proof_hash = h, team_note = null, updated_at = now() where id = i.id returning * into i;
  perform public.notify_staff('🔍 Taxa de inspeção para confirmar', public.item_inspection_ref(i.ref_no) || ' · ' || i.fee || ' Kz · ref. ' || i.pay_reference,
    jsonb_build_object('item_inspection_id', i.id, 'tab', 'inspections'));
  return i;
end $$;

-- Equipa (ou IA, até ao limite): taxa recebida / não recebida.
create or replace function public.decide_item_inspection_payment(p_id uuid, p_confirm boolean, p_note text default null)
returns public.item_inspections language plpgsql security definer set search_path = public as $$
declare i public.item_inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into i from public.item_inspections where id = p_id for update;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if i.status <> 'payment_submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.item_inspections set status = 'paid', paid_at = now(), updated_at = now() where id = i.id returning * into i;
    perform public._item_inspection_notify(i, i.requester_id, '🔍 Taxa de inspeção paga', 'A equipa vai contactar para marcar a inspeção.');
    perform public.notify_staff('🔍 Nova inspeção para marcar', public.item_inspection_ref(i.ref_no) || ' · ' || coalesce(i.title, ''), jsonb_build_object('item_inspection_id', i.id, 'tab', 'inspections'));
  else
    update public.item_inspections set status = 'awaiting_payment', pay_by = greatest(coalesce(pay_by, now()), now() + interval '24 hours'),
      pay_reference_norm = null, pay_proof_hash = null, team_note = txt, updated_at = now() where id = i.id returning * into i;
    perform public._item_inspection_notify(i, i.requester_id, 'Taxa de inspeção não confirmada', txt);
  end if;
  return i;
end $$;

-- Cancelar antes de começar (quem pediu; a taxa paga só é devolvida pela equipa).
create or replace function public.cancel_item_inspection(p_id uuid)
returns public.item_inspections language plpgsql security definer set search_path = public as $$
declare i public.item_inspections;
begin
  select * into i from public.item_inspections where id = p_id for update;
  if not found or (i.requester_id <> auth.uid() and not public.has_admin_role()) then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if i.status not in ('awaiting_payment', 'payment_submitted') and not public.has_admin_role() then raise exception 'INVALID_TRANSITION'; end if;
  if i.status in ('approved', 'failed', 'handed_over', 'cancelled') then raise exception 'INVALID_TRANSITION'; end if;
  update public.item_inspections set status = 'cancelled', updated_at = now() where id = i.id returning * into i;
  return i;
end $$;

-- Equipa: marcar (data e local), começar, concluir (aprovada/não aprovada) e entregar/transferir.
create or replace function public.admin_item_inspection_step(p_id uuid, p_step text, p_when timestamptz default null, p_place text default null,
  p_checklist jsonb default null, p_report text default null, p_photos text[] default null, p_note text default null)
returns public.item_inspections language plpgsql security definer set search_path = public as $$
declare i public.item_inspections; o public.orders; txt text := nullif(left(trim(coalesce(p_note, '')), 500), ''); days int;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into i from public.item_inspections where id = p_id for update;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if p_step = 'schedule' then
    if i.status not in ('paid', 'scheduled') or p_when is null then raise exception 'INVALID_TRANSITION'; end if;
    update public.item_inspections set status = 'scheduled', scheduled_for = p_when, place = nullif(left(trim(coalesce(p_place, '')), 300), ''), team_note = coalesce(txt, team_note), updated_at = now()
      where id = i.id returning * into i;
    perform public._item_inspection_notify(i, i.requester_id, '📅 Inspeção marcada', to_char(p_when at time zone 'Africa/Luanda', 'DD/MM HH24:MI') || coalesce(' · ' || i.place, ''));
    perform public._item_inspection_notify(i, i.seller_id, '📅 Inspeção marcada',
      to_char(p_when at time zone 'Africa/Luanda', 'DD/MM HH24:MI') || coalesce(' · ' || i.place, '') ||
      case when i.category = 'item' then ' · Leve o artigo ao Huambo Online.' when i.category = 'vehicle' then ' · Tenha a viatura e os documentos prontos.' else ' · Tenha os documentos do imóvel prontos.' end);
  elsif p_step = 'start' then
    if i.status not in ('paid', 'scheduled') then raise exception 'INVALID_TRANSITION'; end if;
    update public.item_inspections set status = 'in_progress', inspector_id = auth.uid(), updated_at = now() where id = i.id returning * into i;
  elsif p_step in ('approve', 'fail') then
    if i.status not in ('scheduled', 'in_progress', 'paid') then raise exception 'INVALID_TRANSITION'; end if;
    if char_length(trim(coalesce(p_report, ''))) < 10 then raise exception 'REPORT_REQUIRED'; end if;
    select item_inspection_valid_days into days from public.platform_settings where id = 1;
    update public.item_inspections set status = case when p_step = 'approve' then 'approved' else 'failed' end, inspector_id = coalesce(inspector_id, auth.uid()),
      checklist = coalesce(p_checklist, checklist), report = left(trim(p_report), 2000), photos = coalesce(p_photos, photos), inspected_at = now(),
      valid_until = case when p_step = 'approve' and i.mode = 'seller' then now() + make_interval(days => coalesce(days, 90)) end, updated_at = now()
      where id = i.id returning * into i;
    if i.mode = 'buyer' and p_step = 'fail' and i.order_id is not null then
      -- Não aprovada: reembolso ao comprador pelas reclamações (o dinheiro continua retido até lá).
      select * into o from public.orders where id = i.order_id for update;
      if o.escrow_status = 'held' and not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
        insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status, admin_note)
        values (o.id, o.buyer_id, o.seller_id, 'refund', 'not_as_described', left('Inspeção ' || public.item_inspection_ref(i.ref_no) || ' não aprovada: ' || i.report, 1000),
          o.total - o.refunded_amount, 'awaiting_refund', left('Inspeção do Huambo Online não aprovada.', 1000));
      elsif o.escrow_status = 'awaiting_payment' then
        update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id;
      end if;
    end if;
    perform public._item_inspection_notify(i, i.requester_id, case when p_step = 'approve' then '✅ Inspeção aprovada' else '❌ Inspeção não aprovada' end,
      case when i.mode = 'buyer' and p_step = 'fail' then 'Vai receber o seu dinheiro de volta. Indique a conta para o reembolso em «Reclamações».'
           when i.mode = 'buyer' then case when i.category = 'item' then 'A equipa vai entregar-lhe o artigo.' else 'A equipa vai acompanhar a transferência de propriedade.' end
           else 'O anúncio mostra agora o selo «Inspecionado pelo Huambo Online».' end);
    if i.mode = 'buyer' then
      perform public._item_inspection_notify(i, i.seller_id, case when p_step = 'approve' then '✅ Inspeção aprovada' else '❌ Inspeção não aprovada' end,
        case when p_step = 'approve' then 'A venda continua.' else 'A venda foi cancelada e o comprador é reembolsado. A equipa combina a devolução do artigo, se o tiver recebido.' end);
    end if;
  elsif p_step = 'handover' then
    if i.mode <> 'buyer' or i.status <> 'approved' then raise exception 'INVALID_TRANSITION'; end if;
    update public.item_inspections set status = 'handed_over', handed_over_at = now(), team_note = coalesce(txt, team_note), updated_at = now() where id = i.id returning * into i;
    if i.order_id is not null then
      perform set_config('huambo.inspection_handover', 'on', true);
      update public.orders set fulfillment_status = 'delivered', updated_at = now() where id = i.order_id and status <> 'cancelled';
      perform set_config('huambo.inspection_handover', 'off', true);
    end if;
    perform public._item_inspection_notify(i, i.requester_id, case when i.category = 'item' then '📦 Artigo entregue' else '🔑 Propriedade transferida' end,
      'Confirme a receção na encomenda para concluir a compra.');
  else
    raise exception 'INVALID_INPUT';
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'item_inspection_' || p_step, 'item_inspection', i.id, jsonb_build_object('status', i.status));
  return i;
end $$;

-- Enquanto a inspeção do comprador não termina, a encomenda não pode ser dada como entregue nem confirmada.
create or replace function public.guard_order_inspection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fulfillment_status = 'delivered' and old.fulfillment_status is distinct from 'delivered'
     and coalesce(current_setting('huambo.inspection_handover', true), '') <> 'on'
     and exists (select 1 from public.item_inspections x where x.order_id = new.id and x.mode = 'buyer'
                 and x.status in ('awaiting_payment', 'payment_submitted', 'paid', 'scheduled', 'in_progress', 'approved')) then
    raise exception 'INSPECTION_PENDING';
  end if;
  return new;
end $$;
revoke all on function public.guard_order_inspection() from public, anon, authenticated;
drop trigger if exists guard_order_inspection on public.orders;
create trigger guard_order_inspection before update of fulfillment_status on public.orders for each row execute function public.guard_order_inspection();

-- Listas
create or replace function public.my_item_inspections()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(i) - 'pay_proof_path' - 'pay_proof_hash' - 'pay_reference_norm' || jsonb_build_object('role', case when i.requester_id = auth.uid() then 'requester' else 'seller' end)
  from public.item_inspections i where i.requester_id = auth.uid() or i.seller_id = auth.uid() order by i.created_at desc limit 100;
$$;
create or replace function public.admin_list_item_inspections(p_open boolean default true)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select to_jsonb(i) || jsonb_build_object('requester_name', rp.full_name, 'seller_name', sp.full_name)
    from public.item_inspections i left join public.profiles rp on rp.id = i.requester_id left join public.profiles sp on sp.id = i.seller_id
    where not coalesce(p_open, true) or i.status in ('payment_submitted', 'paid', 'scheduled', 'in_progress', 'approved') and not (i.status = 'approved' and i.mode = 'seller')
    order by case i.status when 'payment_submitted' then 0 when 'paid' then 1 when 'scheduled' then 2 when 'in_progress' then 3 else 4 end, i.updated_at desc limit 200;
end $$;

-- Selo público do anúncio/produto (só inspeções de vendedor aprovadas e válidas).
create or replace function public.item_inspection_badge(p_listing_id uuid default null, p_product_id uuid default null)
returns table(ref_no bigint, category text, inspected_at timestamptz, valid_until timestamptz, checklist jsonb, report text, photos text[])
language sql stable security definer set search_path = public as $$
  select i.ref_no, i.category, i.inspected_at, i.valid_until, i.checklist, i.report, i.photos from public.item_inspections i
  where i.mode = 'seller' and i.status = 'approved' and i.valid_until > now()
    and ((p_listing_id is not null and i.listing_id = p_listing_id) or (p_product_id is not null and i.product_id = p_product_id))
  order by i.inspected_at desc limit 1;
$$;

-- Taxas (equipa)
create or replace function public.admin_set_item_inspection_fees(p_item numeric, p_vehicle numeric, p_property numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if least(p_item, p_vehicle, p_property) < 0 or greatest(p_item, p_vehicle, p_property) > 1000000 then raise exception 'INVALID_INPUT'; end if;
  update public.platform_settings set item_inspection_fee_item = round(p_item), item_inspection_fee_vehicle = round(p_vehicle), item_inspection_fee_property = round(p_property), updated_at = now() where id = 1;
end $$;

revoke all on function public.request_item_inspection(uuid,uuid,uuid,text), public.submit_item_inspection_payment(uuid,text,text,text,text), public.decide_item_inspection_payment(uuid,boolean,text),
  public.cancel_item_inspection(uuid), public.admin_item_inspection_step(uuid,text,timestamptz,text,jsonb,text,text[],text), public.my_item_inspections(), public.admin_list_item_inspections(boolean),
  public.admin_set_item_inspection_fees(numeric,numeric,numeric), public._item_inspection_notify(public.item_inspections,uuid,text,text) from public, anon;
grant execute on function public.request_item_inspection(uuid,uuid,uuid,text), public.submit_item_inspection_payment(uuid,text,text,text,text), public.decide_item_inspection_payment(uuid,boolean,text),
  public.cancel_item_inspection(uuid), public.admin_item_inspection_step(uuid,text,timestamptz,text,jsonb,text,text[],text), public.my_item_inspections(), public.admin_list_item_inspections(boolean),
  public.admin_set_item_inspection_fees(numeric,numeric,numeric) to authenticated;
grant execute on function public.item_inspection_badge(uuid,uuid), public.item_inspection_fee(text) to anon, authenticated;

-- Comprovativos: a taxa entra no painel e pode ser confirmada pela IA (valores pequenos).
do $$ declare d text := regexp_replace(pg_get_functiondef('public.pending_proof_payments()'::regprocedure), '\s+', ' ', 'g');
  o text := $o$ from public.import_requests i where i.status = 'research_submitted' and i.research_proof_path is not null$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND pending_proof_payments'; end if;
  if strpos(d, 'item_inspection') = 0 then
    execute replace(d, o, o || $n$ union all select 'item_inspection', x.id, x.pay_proof_path, x.fee, x.pay_method, x.pay_reference, x.requester_id, x.updated_at, 'Inspeção INS-' || x.ref_no from public.item_inspections x where x.status = 'payment_submitted' and x.pay_proof_path is not null$n$);
  end if;
end $$;
do $$ declare d text := pg_get_functiondef('public.ai_save_proof_check(text,uuid,text,boolean,numeric,date,text,text,text,text,text,text[],text)'::regprocedure);
  o text := $o$        when 'commission' then$o$;
begin
  if strpos(d, 'item_inspection') = 0 then
    execute replace(d, o, $n$        when 'item_inspection' then perform public.decide_item_inspection_payment(p_payment_id, true, null);
$n$ || o);
  end if;
end $$;
alter table public.payment_proof_checks drop constraint if exists payment_proof_checks_kind_check;
alter table public.payment_proof_checks add constraint payment_proof_checks_kind_check
  check (kind in ('subscription', 'boost', 'promo_boost', 'event_fee', 'fuel_fee', 'venue_fee', 'commission', 'order', 'fuel_order', 'venue_order', 'import_order', 'import_research', 'item_inspection'));
