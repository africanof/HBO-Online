-- 🏅 Selo «Inspecionado»: a administração foi ao local e confirmou que o profissional, a loja,
-- a empresa ou a fábrica existe mesmo. Vale por um tempo (inspection_valid_months) e pode ser retirado.
-- E: postos de combustível voltam a «à espera de aprovação» quando mudam nome, local ou conta para pagamentos.

alter table public.platform_settings add column if not exists inspection_valid_months integer not null default 12 check (inspection_valid_months between 1 and 60);
grant update (inspection_valid_months) on public.platform_settings to authenticated;

create sequence if not exists public.inspections_ref_no_seq start 1001;
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.inspections_ref_no_seq'),
  kind text not null check (kind in ('provider', 'business', 'store')),
  target_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'approved', 'rejected', 'cancelled', 'revoked')),
  address text check (address is null or char_length(address) <= 300),
  phone text check (phone is null or char_length(phone) <= 20),
  preferred_time text check (preferred_time is null or char_length(preferred_time) <= 120),
  note text check (note is null or char_length(note) <= 500),
  scheduled_for timestamptz,
  inspector_name text check (inspector_name is null or char_length(inspector_name) <= 80),
  checklist jsonb not null default '{}'::jsonb,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  inspected_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspections_target on public.inspections(kind, target_id, status);
create index if not exists inspections_status on public.inspections(status, created_at desc);
create index if not exists inspections_owner on public.inspections(owner_id, created_at desc);
alter table public.inspections enable row level security;
create policy inspections_own_read on public.inspections for select to authenticated using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.inspections from anon, authenticated;
grant select on public.inspections to authenticated;

-- Dono do alvo (perfil profissional, empresa/fábrica ou loja do vendedor).
create or replace function public.inspection_target_owner(p_kind text, p_target uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'provider' then (select user_id from public.provider_profiles where user_id = p_target)
    when 'business' then (select owner_id from public.businesses where id = p_target)
    when 'store' then (select id from public.profiles where id = p_target and exists (select 1 from public.products x where x.seller_id = p_target))
  end
$$;
create or replace function public.inspection_target_name(p_kind text, p_target uuid) returns text
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'provider' then (select display_name from public.provider_profiles where user_id = p_target)
    when 'business' then (select name from public.businesses where id = p_target)
    when 'store' then (select 'Loja de ' || coalesce(nullif(full_name, ''), 'vendedor') from public.profiles where id = p_target)
  end
$$;

-- Público: quem tem o selo válido (para listas e páginas).
create or replace function public.inspected_targets(p_kind text, p_ids uuid[])
returns table(target_id uuid, inspected_at timestamptz, valid_until timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (i.target_id) i.target_id, i.inspected_at, i.valid_until
  from public.inspections i
  where i.kind = p_kind and i.target_id = any(p_ids[1:200]) and i.status = 'approved' and i.valid_until > now()
  order by i.target_id, i.valid_until desc
$$;

create or replace function public.request_inspection(p_kind text, p_target uuid, p_address text, p_phone text, p_preferred_time text default null, p_note text default null)
returns public.inspections language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); i public.inspections;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('provider', 'business', 'store') then raise exception 'INVALID_KIND'; end if;
  if public.inspection_target_owner(p_kind, p_target) is distinct from me then raise exception 'INSPECTION_NOT_OWNER'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 5 then raise exception 'INSPECTION_ADDRESS_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status in ('requested', 'scheduled')) then raise exception 'INSPECTION_OPEN'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status = 'approved' and valid_until > now() + interval '30 days') then raise exception 'INSPECTION_STILL_VALID'; end if;
  insert into public.inspections(kind, target_id, owner_id, address, phone, preferred_time, note)
  values (p_kind, p_target, me, left(trim(p_address), 300), left(regexp_replace(p_phone, '[^0-9+]', '', 'g'), 20),
    nullif(left(trim(coalesce(p_preferred_time, '')), 120), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into i;
  perform public.notify_staff('🏅 Pedido de inspeção', 'I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(p_kind, p_target), ''), jsonb_build_object('inspection_id', i.id));
  return i;
end $$;

create or replace function public.cancel_inspection(p_id uuid) returns public.inspections
language plpgsql security definer set search_path = public as $$
declare i public.inspections;
begin
  update public.inspections set status = 'cancelled', updated_at = now() where id = p_id and owner_id = auth.uid() and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  return i;
end $$;

create or replace function public.my_inspections() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name, i.status, i.address, i.phone, i.preferred_time,
      i.note, i.scheduled_for, i.admin_note, i.inspected_at, i.valid_until, i.created_at
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
      i.checklist, i.admin_note, i.inspected_at, i.valid_until, i.created_at, coalesce(i.scheduled_for, i.created_at) sort_at
    from public.inspections i left join public.profiles p on p.id = i.owner_id
    where coalesce(p_status, '') = '' or i.status = p_status or (p_status = 'approved' and i.status = 'approved' and i.valid_until > now())
    order by coalesce(i.scheduled_for, i.created_at) limit 300) x);
end $$;

-- Marcar a visita (dia e hora, quem vai).
create or replace function public.admin_schedule_inspection(p_id uuid, p_when timestamptz, p_inspector text default null, p_note text default null)
returns public.inspections language plpgsql security definer set search_path = public as $$
declare i public.inspections;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_when is null or p_when < now() - interval '1 day' then raise exception 'INSPECTION_DATE_REQUIRED'; end if;
  update public.inspections set status = 'scheduled', scheduled_for = p_when, inspector_name = nullif(left(trim(coalesce(p_inspector, '')), 80), ''),
    admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), updated_at = now()
    where id = p_id and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', '🏅 Inspeção marcada', coalesce(public.inspection_target_name(i.kind, i.target_id), '') || ': ' ||
    to_char(i.scheduled_for at time zone 'Africa/Luanda', 'DD/MM "às" HH24:MI') || coalesce(' · ' || i.inspector_name, '') || '. Esteja no local.',
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $$;

-- Resultado da visita: aprovado (selo) ou recusado, com a lista do que foi visto.
create or replace function public.admin_decide_inspection(p_id uuid, p_approve boolean, p_note text default null, p_checklist jsonb default '{}'::jsonb)
returns public.inspections language plpgsql security definer set search_path = public as $$
declare i public.inspections; st public.platform_settings; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_approve and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_approve and not coalesce((p_checklist->>'exists')::boolean, false) then raise exception 'INSPECTION_CHECKLIST'; end if;
  select * into st from public.platform_settings where id = 1;
  update public.inspections set status = case when p_approve then 'approved' else 'rejected' end, admin_note = txt, checklist = coalesce(p_checklist, '{}'::jsonb),
    inspected_at = now(), valid_until = case when p_approve then now() + make_interval(months => st.inspection_valid_months) end, updated_at = now()
    where id = p_id and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'inspection_approved' else 'inspection_rejected' end, i.kind, i.target_id, jsonb_build_object('inspection', i.ref_no, 'note', txt, 'checklist', i.checklist));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', case when p_approve then '🏅 Inspeção aprovada' else 'Inspeção não aprovada' end,
    coalesce(public.inspection_target_name(i.kind, i.target_id), '') || case when p_approve then ': já mostra o selo «Inspecionado» até ' || to_char(i.valid_until at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.' else ': ' || txt end,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $$;

-- Retirar o selo (por exemplo, fechou ou houve queixas).
create or replace function public.admin_revoke_inspection(p_id uuid, p_note text) returns public.inspections
language plpgsql security definer set search_path = public as $$
declare i public.inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.inspections set status = 'revoked', admin_note = txt, updated_at = now() where id = p_id and status = 'approved' returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'inspection_revoked', i.kind, i.target_id, jsonb_build_object('inspection', i.ref_no, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', 'Selo «Inspecionado» retirado', coalesce(public.inspection_target_name(i.kind, i.target_id), '') || ': ' || txt,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $$;

-- Postos de combustível: mudar nome, local ou tipo volta a precisar de aprovação.
create or replace function public.guard_fuel_station() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.has_admin_role() then new.status := 'pending'; new.admin_note := null; end if;
    if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if (select count(*) from public.fuel_stations where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_STATIONS'; end if;
  else
    if new.owner_id <> old.owner_id then raise exception 'NOT_ALLOWED'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note) and not public.has_admin_role()
       and coalesce(current_setting('app.fuel_pay_changed', true), '') <> '1' then raise exception 'ADMIN_ONLY'; end if;
    if not public.has_admin_role() and old.status = 'approved' and (new.name is distinct from old.name or new.kind is distinct from old.kind
        or new.municipality_id is distinct from old.municipality_id or new.address is distinct from old.address or new.directions is distinct from old.directions
        or new.geo_lat is distinct from old.geo_lat or new.geo_lng is distinct from old.geo_lng) then
      new.status := 'pending'; new.admin_note := 'Dados do posto mudaram: à espera de nova aprovação.';
      perform public.notify_staff('⛽ Posto mudou dados', 'S-' || new.ref_no || ' · ' || new.name || ' precisa de nova aprovação.', jsonb_build_object('fuel_station_id', new.id));
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Mudar a conta para pagamentos de um posto aprovado também volta a precisar de aprovação (evita trocar o IBAN para burlar).
create or replace function public.guard_fuel_station_pay() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.fuel_stations;
begin
  if public.has_admin_role() then return new; end if;
  if tg_op = 'UPDATE' and new.holder is not distinct from old.holder and new.iban is not distinct from old.iban and new.express is not distinct from old.express then return new; end if;
  select * into s from public.fuel_stations where id = new.station_id;
  if s.status = 'approved' and (tg_op = 'UPDATE' or new.iban is not null or new.express is not null) then
    perform set_config('app.fuel_pay_changed', '1', true);
    update public.fuel_stations set status = 'pending', admin_note = 'Conta para pagamentos mudou: à espera de nova aprovação.' where id = s.id;
    perform set_config('app.fuel_pay_changed', '', true);
    perform public.notify_staff('⛽ Posto mudou a conta para pagamentos', 'S-' || s.ref_no || ' · ' || s.name || ' precisa de nova aprovação.', jsonb_build_object('fuel_station_id', s.id));
  end if;
  return new;
end $$;
create trigger trg_guard_fuel_station_pay after insert or update on public.fuel_station_pay for each row execute function public.guard_fuel_station_pay();

revoke all on function public.inspection_target_owner(text, uuid) from public, anon, authenticated;
revoke all on function public.inspection_target_name(text, uuid) from public, anon, authenticated;
revoke all on function public.guard_fuel_station_pay() from public, anon, authenticated;
revoke all on function public.inspected_targets(text, uuid[]) from public;
grant execute on function public.inspected_targets(text, uuid[]) to anon, authenticated;
revoke all on function public.request_inspection(text, uuid, text, text, text, text) from public, anon;
revoke all on function public.cancel_inspection(uuid) from public, anon;
revoke all on function public.my_inspections() from public, anon;
revoke all on function public.admin_list_inspections(text) from public, anon;
revoke all on function public.admin_schedule_inspection(uuid, timestamptz, text, text) from public, anon;
revoke all on function public.admin_decide_inspection(uuid, boolean, text, jsonb) from public, anon;
revoke all on function public.admin_revoke_inspection(uuid, text) from public, anon;
grant execute on function public.request_inspection(text, uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_inspection(uuid) to authenticated;
grant execute on function public.my_inspections() to authenticated;
grant execute on function public.admin_list_inspections(text) to authenticated;
grant execute on function public.admin_schedule_inspection(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.admin_decide_inspection(uuid, boolean, text, jsonb) to authenticated;
grant execute on function public.admin_revoke_inspection(uuid, text) to authenticated;
