-- 🏅 A marcação da inspeção é paga (profissionais: inspection_fee_provider_kz, 2 000 Kz; lojas, empresas e fábricas: inspection_fee_kz, 5 000 Kz): o dono paga à plataforma, envia a referência/comprovativo,
-- a administração confirma e só depois marca a visita. A taxa entra nas Receitas.

alter table public.platform_settings add column if not exists inspection_fee_kz numeric not null default 5000 check (inspection_fee_kz >= 0);
grant update (inspection_fee_kz) on public.platform_settings to authenticated;
alter table public.platform_settings add column if not exists inspection_fee_provider_kz numeric not null default 2000 check (inspection_fee_provider_kz >= 0);
grant update (inspection_fee_provider_kz) on public.platform_settings to authenticated;

alter table public.inspections
  add column if not exists fee_amount numeric not null default 0,
  add column if not exists pay_method text check (pay_method is null or pay_method in ('bank_transfer', 'multicaixa_express', 'cash')),
  add column if not exists pay_reference text check (pay_reference is null or char_length(pay_reference) <= 120),
  add column if not exists pay_proof_path text,
  add column if not exists pay_submitted_at timestamptz,
  add column if not exists paid_at timestamptz;
alter table public.inspections drop constraint if exists inspections_status_check;
alter table public.inspections add constraint inspections_status_check
  check (status in ('awaiting_payment', 'payment_submitted', 'requested', 'scheduled', 'approved', 'rejected', 'cancelled', 'revoked'));

create or replace function public.request_inspection(p_kind text, p_target uuid, p_address text, p_phone text, p_preferred_time text default null, p_note text default null)
returns public.inspections language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); i public.inspections; fee numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('provider', 'business', 'store') then raise exception 'INVALID_KIND'; end if;
  if public.inspection_target_owner(p_kind, p_target) is distinct from me then raise exception 'INSPECTION_NOT_OWNER'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 5 then raise exception 'INSPECTION_ADDRESS_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status in ('awaiting_payment', 'payment_submitted', 'requested', 'scheduled')) then raise exception 'INSPECTION_OPEN'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status = 'approved' and valid_until > now() + interval '30 days') then raise exception 'INSPECTION_STILL_VALID'; end if;
  select coalesce(case when p_kind = 'provider' then inspection_fee_provider_kz else inspection_fee_kz end, 0) into fee from public.platform_settings where id = 1;
  insert into public.inspections(kind, target_id, owner_id, status, fee_amount, address, phone, preferred_time, note)
  values (p_kind, p_target, me, case when fee > 0 then 'awaiting_payment' else 'requested' end, fee, left(trim(p_address), 300), left(regexp_replace(p_phone, '[^0-9+]', '', 'g'), 20),
    nullif(left(trim(coalesce(p_preferred_time, '')), 120), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into i;
  if fee = 0 then
    perform public.notify_staff('🏅 Pedido de inspeção', 'I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(p_kind, p_target), ''), jsonb_build_object('inspection_id', i.id));
  end if;
  return i;
end $$;

-- O dono diz como pagou a taxa (referência e/ou comprovativo).
create or replace function public.submit_inspection_payment(p_id uuid, p_method text, p_reference text default null, p_proof_path text default null)
returns public.inspections language plpgsql security definer set search_path = public as $$
declare i public.inspections; me uuid := auth.uid(); ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  select * into i from public.inspections where id = p_id for update;
  if not found or i.owner_id <> me then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if i.status <> 'awaiting_payment' then raise exception 'INVALID_TRANSITION'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and p_proof_path not like me::text || '/%' then raise exception 'INVALID_PROOF'; end if;
  update public.inspections set status = 'payment_submitted', pay_method = p_method, pay_reference = ref, pay_proof_path = p_proof_path,
    pay_submitted_at = now(), admin_note = null, updated_at = now() where id = i.id returning * into i;
  perform public.notify_staff('🏅 Taxa de inspeção para confirmar', 'I-' || i.ref_no || ' · ' || i.fee_amount || ' Kz · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''),
    jsonb_build_object('inspection_id', i.id));
  return i;
end $$;

-- A administração confirma (passa a «pedido», pronto para marcar a visita) ou recusa (volta a «falta pagar»).
create or replace function public.admin_decide_inspection_payment(p_id uuid, p_confirm boolean, p_note text default null)
returns public.inspections language plpgsql security definer set search_path = public as $$
declare i public.inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.inspections set status = case when p_confirm then 'requested' else 'awaiting_payment' end, paid_at = case when p_confirm then now() end,
    admin_note = txt, updated_at = now() where id = p_id and status = 'payment_submitted' returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'inspection_payment_confirmed' else 'inspection_payment_rejected' end, i.kind, i.target_id,
    jsonb_build_object('inspection', i.ref_no, 'amount', i.fee_amount, 'reference', i.pay_reference, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', case when p_confirm then '🏅 Taxa de inspeção confirmada' else 'Pagamento da inspeção não confirmado' end,
    coalesce(public.inspection_target_name(i.kind, i.target_id), '') || case when p_confirm then ': vamos ligar para marcar a visita.' else ': ' || txt end,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $$;

-- Cancelar: só antes de pagar (depois de pago, fala com a administração).
create or replace function public.cancel_inspection(p_id uuid) returns public.inspections
language plpgsql security definer set search_path = public as $$
declare i public.inspections;
begin
  update public.inspections set status = 'cancelled', updated_at = now()
    where id = p_id and owner_id = auth.uid() and (status = 'awaiting_payment' or (fee_amount = 0 and status in ('requested', 'scheduled'))) returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  return i;
end $$;

create or replace function public.my_inspections() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name, i.status, i.address, i.phone, i.preferred_time,
      i.note, i.scheduled_for, i.admin_note, i.inspected_at, i.valid_until, i.created_at, i.fee_amount, i.pay_method, i.pay_reference, i.paid_at
    from public.inspections i where i.owner_id = auth.uid() order by i.created_at desc limit 50) x
$$;

create or replace function public.admin_list_inspections(p_status text default 'requested') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.sort_at), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name,
      case when i.kind = 'business' then (select c.slug from public.businesses b join public.categories c on c.id = b.category_id where b.id = i.target_id) end category_slug,
      i.owner_id, coalesce(nullif(p.full_name, ''), '—') owner_name, i.status, i.address, i.phone, i.preferred_time, i.note, i.scheduled_for, i.inspector_name,
      i.checklist, i.admin_note, i.inspected_at, i.valid_until, i.created_at, i.fee_amount, i.pay_method, i.pay_reference, i.pay_proof_path, i.pay_submitted_at, i.paid_at,
      coalesce(i.scheduled_for, i.pay_submitted_at, i.created_at) sort_at
    from public.inspections i left join public.profiles p on p.id = i.owner_id
    where coalesce(p_status, '') = '' or i.status = p_status or (p_status = 'approved' and i.status = 'approved' and i.valid_until > now())
    order by coalesce(i.scheduled_for, i.pay_submitted_at, i.created_at) limit 300) x);
end $$;

-- Receitas: junta as taxas de inspeção confirmadas.
create or replace function public.admin_revenue(p_from date, p_to date)
returns table(paid_at timestamp with time zone, kind text, description text, payer_name text, amount numeric, method text, reference text)
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
  union all
  select b.decided_at, 'boost', 'Destaque D-' || b.ref_no || ' · ' || l.title || ' · ' || b.days || ' dias', coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.method, b.reference
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles pr on pr.id = b.owner_id
  where b.status in ('active', 'expired') and b.amount > 0 and (b.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select i.paid_at, 'inspection', 'Inspeção I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''), coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         i.fee_amount, i.pay_method, i.pay_reference
  from public.inspections i left join public.profiles pr on pr.id = i.owner_id
  where i.paid_at is not null and i.fee_amount > 0 and (i.paid_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $$;

revoke all on function public.submit_inspection_payment(uuid, text, text, text) from public, anon;
revoke all on function public.admin_decide_inspection_payment(uuid, boolean, text) from public, anon;
grant execute on function public.submit_inspection_payment(uuid, text, text, text) to authenticated;
grant execute on function public.admin_decide_inspection_payment(uuid, boolean, text) to authenticated;
