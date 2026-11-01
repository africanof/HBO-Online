-- Contactos e localização privados.
--
-- O telefone, o WhatsApp e a localização (indicações, ponto no mapa, morada) das pessoas
-- e dos profissionais deixam de ser públicos. Só o próprio e a equipa (administradores e
-- moderadores) os veem. Os outros utilizadores falam pelas Mensagens da plataforma.
--
-- Como funciona:
-- • Anúncios: indicações, ponto no mapa e morada passam para listing_private_places.
-- • Perfis de profissional: telefone, WhatsApp, indicações, ponto no mapa e morada
--   passam para provider_private_contacts.
-- • Um gatilho tira estes dados das tabelas públicas sempre que alguém os grava
--   (também protege as versões antigas do Site e da APP, que ainda os enviam ali).
-- • O WhatsApp da conta pessoal (seller_whatsapp) passa a ser só para a equipa.
-- Empresas, postos de combustível, hotéis/restaurantes e eventos continuam públicos.

-- ───────────────────────── Anúncios ─────────────────────────
create table if not exists public.listing_private_places (
  listing_id uuid primary key references public.classified_listings(id) on delete cascade deferrable initially deferred,
  directions text,
  geo_lat numeric,
  geo_lng numeric,
  address_id uuid references public.addresses(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.listing_private_places enable row level security;
revoke all on public.listing_private_places from public, anon, authenticated;
grant select on public.listing_private_places to authenticated;
create policy listing_private_places_read on public.listing_private_places for select to authenticated
  using ((select public.has_admin_role())
         or exists (select 1 from public.classified_listings l where l.id = listing_id and l.owner_id = (select auth.uid())));

create or replace function public.move_listing_private_place()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.directions is not null or new.geo_lat is not null or new.geo_lng is not null then
    insert into public.listing_private_places(listing_id, directions, geo_lat, geo_lng)
    values (new.id, nullif(trim(new.directions), ''), round(new.geo_lat, 3), round(new.geo_lng, 3))
    on conflict (listing_id) do update set directions = excluded.directions, geo_lat = excluded.geo_lat,
      geo_lng = excluded.geo_lng, updated_at = now();
  end if;
  if new.address_id is not null then
    insert into public.listing_private_places(listing_id, address_id) values (new.id, new.address_id)
    on conflict (listing_id) do update set address_id = excluded.address_id, updated_at = now();
  end if;
  new.directions := null; new.geo_lat := null; new.geo_lng := null; new.address_id := null;
  return new;
end $function$;
revoke all on function public.move_listing_private_place() from public, anon, authenticated;

-- A chave estrangeira é verificada no fim da transação, por isso o BEFORE INSERT pode gravar já a linha privada.
drop trigger if exists zz_listing_private_place on public.classified_listings;
create trigger zz_listing_private_place before insert or update on public.classified_listings
  for each row execute function public.move_listing_private_place();

/** Ler a localização de um anúncio: só o dono e a equipa. */
create or replace function public.listing_private_place(p_listing_id uuid)
 returns table(directions text, geo_lat numeric, geo_lng numeric)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.directions, p.geo_lat, p.geo_lng
  from public.listing_private_places p join public.classified_listings l on l.id = p.listing_id
  where p.listing_id = p_listing_id and (l.owner_id = auth.uid() or public.has_admin_role());
$function$;
revoke all on function public.listing_private_place(uuid) from public, anon, authenticated;
grant execute on function public.listing_private_place(uuid) to authenticated;

/** Gravar (ou apagar, com nulos) a localização do próprio anúncio. */
create or replace function public.set_listing_private_place(p_listing_id uuid, p_directions text, p_geo_lat numeric, p_geo_lng numeric)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then
    raise exception 'NOT_OWNER';
  end if;
  insert into public.listing_private_places(listing_id, directions, geo_lat, geo_lng)
  values (p_listing_id, nullif(trim(left(p_directions, 500)), ''), round(p_geo_lat, 3), round(p_geo_lng, 3))
  on conflict (listing_id) do update set directions = excluded.directions, geo_lat = excluded.geo_lat,
    geo_lng = excluded.geo_lng, updated_at = now();
end $function$;
revoke all on function public.set_listing_private_place(uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.set_listing_private_place(uuid, text, numeric, numeric) to authenticated;

-- A pesquisa por zona usa a morada guardada em privado (sem a mostrar).
create or replace function public.search_classified_by_location(p_province_id uuid default null::uuid, p_municipality_id uuid default null::uuid,
  p_neighborhood_id uuid default null::uuid, p_listing_type text default null::text, p_purpose text default null::text, p_limit integer default 30)
 returns setof public.classified_listings
 language sql
 stable security definer
 set search_path to 'public'
as $function$
 select l.*
 from public.classified_listings l
 join public.listing_private_places pp on pp.listing_id = l.id
 join public.addresses a on a.id = pp.address_id
 join public.streets s on s.id = a.street_id
 join public.neighborhoods n on n.id = s.neighborhood_id
 join public.municipalities m on m.id = n.municipality_id
 where l.status = 'published'
 and (p_province_id is null or m.province_id = p_province_id)
 and (p_municipality_id is null or n.municipality_id = p_municipality_id)
 and (p_neighborhood_id is null or s.neighborhood_id = p_neighborhood_id)
 and (p_listing_type is null or l.listing_type = p_listing_type)
 and (p_purpose is null or l.purpose = p_purpose)
 order by l.featured desc, l.created_at desc
 limit greatest(1, least(p_limit, 100));
$function$;

-- ─────────────────── Perfis de profissional ───────────────────
create table if not exists public.provider_private_contacts (
  user_id uuid primary key references public.provider_profiles(user_id) on delete cascade deferrable initially deferred,
  phone text,
  whatsapp text,
  directions text,
  geo_lat numeric,
  geo_lng numeric,
  address_id uuid references public.addresses(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.provider_private_contacts enable row level security;
revoke all on public.provider_private_contacts from public, anon, authenticated;
grant select on public.provider_private_contacts to authenticated;
create policy provider_private_contacts_read on public.provider_private_contacts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));

create or replace function public.move_provider_private_contact()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.phone is not null or new.whatsapp is not null or new.directions is not null
     or new.geo_lat is not null or new.geo_lng is not null or new.address_id is not null then
    insert into public.provider_private_contacts(user_id, phone, whatsapp, directions, geo_lat, geo_lng, address_id)
    values (new.user_id, nullif(trim(new.phone), ''), nullif(trim(new.whatsapp), ''), nullif(trim(new.directions), ''),
            new.geo_lat, new.geo_lng, new.address_id)
    on conflict (user_id) do update set
      phone = coalesce(excluded.phone, provider_private_contacts.phone),
      whatsapp = coalesce(excluded.whatsapp, provider_private_contacts.whatsapp),
      directions = coalesce(excluded.directions, provider_private_contacts.directions),
      geo_lat = coalesce(excluded.geo_lat, provider_private_contacts.geo_lat),
      geo_lng = coalesce(excluded.geo_lng, provider_private_contacts.geo_lng),
      address_id = coalesce(excluded.address_id, provider_private_contacts.address_id),
      updated_at = now();
  end if;
  new.phone := null; new.whatsapp := null; new.directions := null;
  new.geo_lat := null; new.geo_lng := null; new.address_id := null;
  return new;
end $function$;
revoke all on function public.move_provider_private_contact() from public, anon, authenticated;

drop trigger if exists zz_provider_private_contact on public.provider_profiles;
create trigger zz_provider_private_contact before insert or update on public.provider_profiles
  for each row execute function public.move_provider_private_contact();

/** Contactos e localização de um profissional: só o próprio e a equipa. */
create or replace function public.provider_private_contact(p_user_id uuid)
 returns table(phone text, whatsapp text, directions text, geo_lat numeric, geo_lng numeric)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.phone, c.whatsapp, c.directions, c.geo_lat, c.geo_lng
  from public.provider_private_contacts c
  where c.user_id = p_user_id and (p_user_id = auth.uid() or public.has_admin_role());
$function$;
revoke all on function public.provider_private_contact(uuid) from public, anon, authenticated;
grant execute on function public.provider_private_contact(uuid) to authenticated;

/** Gravar (ou apagar, com nulos) os contactos do próprio perfil de profissional. */
create or replace function public.set_my_provider_contact(p_phone text, p_whatsapp text, p_directions text, p_geo_lat numeric, p_geo_lng numeric)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.provider_profiles where user_id = auth.uid()) then raise exception 'NOT_OWNER'; end if;
  insert into public.provider_private_contacts(user_id, phone, whatsapp, directions, geo_lat, geo_lng)
  values (auth.uid(), nullif(trim(left(p_phone, 30)), ''), nullif(trim(left(p_whatsapp, 30)), ''),
          nullif(trim(left(p_directions, 500)), ''), p_geo_lat, p_geo_lng)
  on conflict (user_id) do update set phone = excluded.phone, whatsapp = excluded.whatsapp, directions = excluded.directions,
    geo_lat = excluded.geo_lat, geo_lng = excluded.geo_lng, updated_at = now();
end $function$;
revoke all on function public.set_my_provider_contact(text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.set_my_provider_contact(text, text, text, numeric, numeric) to authenticated;

-- ─────────────────── WhatsApp da conta pessoal ───────────────────
create or replace function public.seller_whatsapp(p_user_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.whatsapp from public.profiles p
  where public.has_admin_role() and p.id = p_user_id;
$function$;

-- Dados que já existiam: passar para as tabelas privadas e limpar as públicas.
insert into public.listing_private_places(listing_id, directions, geo_lat, geo_lng, address_id)
select id, directions, geo_lat, geo_lng, address_id from public.classified_listings
where directions is not null or geo_lat is not null or geo_lng is not null or address_id is not null
on conflict (listing_id) do nothing;
update public.classified_listings set directions = null, geo_lat = null, geo_lng = null, address_id = null
where directions is not null or geo_lat is not null or geo_lng is not null or address_id is not null;

insert into public.provider_private_contacts(user_id, phone, whatsapp, directions, geo_lat, geo_lng, address_id)
select user_id, phone, whatsapp, directions, geo_lat, geo_lng, address_id from public.provider_profiles
where phone is not null or whatsapp is not null or directions is not null or geo_lat is not null or geo_lng is not null or address_id is not null
on conflict (user_id) do nothing;
update public.provider_profiles set phone = null, whatsapp = null, directions = null, geo_lat = null, geo_lng = null, address_id = null
where phone is not null or whatsapp is not null or directions is not null or geo_lat is not null or geo_lng is not null or address_id is not null;
