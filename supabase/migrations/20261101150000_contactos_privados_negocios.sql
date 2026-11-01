-- Telefone e WhatsApp de empresas (incluindo hotéis, restaurantes e armazéns) e de postos de
-- combustível: só o dono e a equipa (administradores e moderadores) os veem.
-- A localização (morada, indicações e ponto no mapa) continua pública.
-- Os eventos não têm telefone próprio; o organizador é contactado pela equipa.

-- ───────────── Empresas ─────────────
create table if not exists public.business_private_contacts (
  business_id uuid primary key references public.businesses(id) on delete cascade deferrable initially deferred,
  phone text,
  whatsapp text,
  updated_at timestamptz not null default now()
);
alter table public.business_private_contacts enable row level security;
revoke all on public.business_private_contacts from public, anon, authenticated;
grant select on public.business_private_contacts to authenticated;
create policy business_private_contacts_read on public.business_private_contacts for select to authenticated
  using ((select public.has_admin_role())
         or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create or replace function public.move_business_private_contact()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.phone is not null or new.whatsapp is not null then
    insert into public.business_private_contacts(business_id, phone, whatsapp)
    values (new.id, nullif(trim(new.phone), ''), nullif(trim(new.whatsapp), ''))
    on conflict (business_id) do update set
      phone = coalesce(excluded.phone, business_private_contacts.phone),
      whatsapp = coalesce(excluded.whatsapp, business_private_contacts.whatsapp), updated_at = now();
  end if;
  new.phone := null; new.whatsapp := null;
  return new;
end $function$;
revoke all on function public.move_business_private_contact() from public, anon, authenticated;
drop trigger if exists zz_business_private_contact on public.businesses;
create trigger zz_business_private_contact before insert or update on public.businesses
  for each row execute function public.move_business_private_contact();

create or replace function public.business_private_contact(p_business_id uuid)
 returns table(phone text, whatsapp text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.phone, c.whatsapp from public.business_private_contacts c join public.businesses b on b.id = c.business_id
  where c.business_id = p_business_id and (b.owner_id = auth.uid() or public.has_admin_role());
$function$;
revoke all on function public.business_private_contact(uuid) from public, anon, authenticated;
grant execute on function public.business_private_contact(uuid) to authenticated;

create or replace function public.set_business_private_contact(p_business_id uuid, p_phone text, p_whatsapp text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()) then raise exception 'NOT_OWNER'; end if;
  insert into public.business_private_contacts(business_id, phone, whatsapp)
  values (p_business_id, nullif(trim(left(p_phone, 30)), ''), nullif(trim(left(p_whatsapp, 30)), ''))
  on conflict (business_id) do update set phone = excluded.phone, whatsapp = excluded.whatsapp, updated_at = now();
end $function$;
revoke all on function public.set_business_private_contact(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_business_private_contact(uuid, text, text) to authenticated;

-- ───────────── Postos de combustível ─────────────
create table if not exists public.fuel_station_private_contacts (
  station_id uuid primary key references public.fuel_stations(id) on delete cascade deferrable initially deferred,
  phone text,
  whatsapp text,
  updated_at timestamptz not null default now()
);
alter table public.fuel_station_private_contacts enable row level security;
revoke all on public.fuel_station_private_contacts from public, anon, authenticated;
grant select on public.fuel_station_private_contacts to authenticated;
create policy fuel_station_private_contacts_read on public.fuel_station_private_contacts for select to authenticated
  using ((select public.has_admin_role())
         or exists (select 1 from public.fuel_stations s where s.id = station_id and s.owner_id = (select auth.uid())));

create or replace function public.move_fuel_station_private_contact()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.phone is not null or new.whatsapp is not null then
    insert into public.fuel_station_private_contacts(station_id, phone, whatsapp)
    values (new.id, nullif(trim(new.phone), ''), nullif(trim(new.whatsapp), ''))
    on conflict (station_id) do update set
      phone = coalesce(excluded.phone, fuel_station_private_contacts.phone),
      whatsapp = coalesce(excluded.whatsapp, fuel_station_private_contacts.whatsapp), updated_at = now();
  end if;
  new.phone := null; new.whatsapp := null;
  return new;
end $function$;
revoke all on function public.move_fuel_station_private_contact() from public, anon, authenticated;
drop trigger if exists zz_fuel_station_private_contact on public.fuel_stations;
create trigger zz_fuel_station_private_contact before insert or update on public.fuel_stations
  for each row execute function public.move_fuel_station_private_contact();

create or replace function public.fuel_station_private_contact(p_station_id uuid)
 returns table(phone text, whatsapp text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.phone, c.whatsapp from public.fuel_station_private_contacts c join public.fuel_stations s on s.id = c.station_id
  where c.station_id = p_station_id and (s.owner_id = auth.uid() or public.has_admin_role());
$function$;
revoke all on function public.fuel_station_private_contact(uuid) from public, anon, authenticated;
grant execute on function public.fuel_station_private_contact(uuid) to authenticated;

create or replace function public.set_fuel_station_private_contact(p_station_id uuid, p_phone text, p_whatsapp text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.fuel_stations where id = p_station_id and owner_id = auth.uid()) then raise exception 'NOT_OWNER'; end if;
  insert into public.fuel_station_private_contacts(station_id, phone, whatsapp)
  values (p_station_id, nullif(trim(left(p_phone, 30)), ''), nullif(trim(left(p_whatsapp, 30)), ''))
  on conflict (station_id) do update set phone = excluded.phone, whatsapp = excluded.whatsapp, updated_at = now();
end $function$;
revoke all on function public.set_fuel_station_private_contact(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_fuel_station_private_contact(uuid, text, text) to authenticated;

-- Dados que já existiam.
insert into public.business_private_contacts(business_id, phone, whatsapp)
select id, phone, whatsapp from public.businesses where phone is not null or whatsapp is not null
on conflict (business_id) do nothing;
update public.businesses set phone = null, whatsapp = null where phone is not null or whatsapp is not null;
insert into public.fuel_station_private_contacts(station_id, phone, whatsapp)
select id, phone, whatsapp from public.fuel_stations where phone is not null or whatsapp is not null
on conflict (station_id) do nothing;
update public.fuel_stations set phone = null, whatsapp = null where phone is not null or whatsapp is not null;
