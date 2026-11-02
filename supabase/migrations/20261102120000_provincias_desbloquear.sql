-- Províncias: a equipa (administradores e moderadores) desbloqueia as outras províncias de Angola
-- no painel e gere os municípios de cada uma. Uma província só pode ser ligada se tiver pelo menos
-- um município (sem municípios ninguém conseguiria escolher onde está). Cada ligar/desligar fica no
-- registo da administração (admin_audit_log).

/** Todas as províncias (ligadas e desligadas) com o n.º de municípios e de anúncios. */
create or replace function public.admin_list_provinces()
 returns table(id uuid, name text, active boolean, municipalities integer, listings integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select p.id, p.name, p.active,
    (select count(*)::int from public.municipalities m where m.province_id = p.id),
    (select count(*)::int from public.classified_listings l where l.attributes->>'provinceId' = p.id::text and l.status = 'published')
  from public.provinces p where p.country_code = 'AO'
  order by p.active desc, p.name;
end $function$;
revoke all on function public.admin_list_provinces() from public, anon;
grant execute on function public.admin_list_provinces() to authenticated;

/** Liga ou desliga uma província (ligar exige municípios). */
create or replace function public.admin_set_province_active(p_province_id uuid, p_active boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_active and not exists (select 1 from public.municipalities where province_id = p_province_id) then
    raise exception 'PROVINCE_NEEDS_MUNICIPALITIES';
  end if;
  if not p_active and (select count(*) from public.provinces where active and id <> p_province_id) = 0 then
    raise exception 'LAST_ACTIVE_PROVINCE';
  end if;
  update public.provinces set active = p_active where id = p_province_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $function$;
revoke all on function public.admin_set_province_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_province_active(uuid, boolean) to authenticated;

/** Junta municípios a uma província (nomes repetidos são ignorados). Devolve quantos entraram. */
create or replace function public.admin_add_municipalities(p_province_id uuid, p_names text[])
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n text; added int := 0;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not exists (select 1 from public.provinces where id = p_province_id) then raise exception 'NOT_FOUND'; end if;
  foreach n in array coalesce(p_names[1:400], '{}') loop
    n := regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g');
    if char_length(n) between 2 and 80 and not exists (select 1 from public.municipalities m where m.province_id = p_province_id and lower(m.name) = lower(n)) then
      insert into public.municipalities(province_id, name) values (p_province_id, n);
      added := added + 1;
    end if;
  end loop;
  return added;
end $function$;
revoke all on function public.admin_add_municipalities(uuid, text[]) from public, anon;
grant execute on function public.admin_add_municipalities(uuid, text[]) to authenticated;

/** Muda o nome de um município. */
create or replace function public.admin_rename_municipality(p_municipality_id uuid, p_name text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); prov uuid;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if char_length(n) not between 2 and 80 then raise exception 'INVALID_INPUT'; end if;
  select province_id into prov from public.municipalities where id = p_municipality_id;
  if prov is null then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from public.municipalities where province_id = prov and lower(name) = lower(n) and id <> p_municipality_id) then raise exception 'MUNICIPALITY_EXISTS'; end if;
  update public.municipalities set name = n where id = p_municipality_id;
end $function$;
revoke all on function public.admin_rename_municipality(uuid, text) from public, anon;
grant execute on function public.admin_rename_municipality(uuid, text) to authenticated;

/** Apaga um município que ninguém usa (anúncios, empresas, postos, moradas…). */
create or replace function public.admin_delete_municipality(p_municipality_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  -- Algumas ligações apagariam ou esvaziariam dados em cadeia: só se apaga se ninguém o usar.
  if exists (select 1 from public.classified_listings where attributes->>'municipalityId' = p_municipality_id::text)
    or exists (select 1 from public.communes where municipality_id = p_municipality_id)
    or exists (select 1 from public.neighborhoods where municipality_id = p_municipality_id)
    or exists (select 1 from public.couriers where municipality_id = p_municipality_id)
    or exists (select 1 from public.events where municipality_id = p_municipality_id)
    or exists (select 1 from public.businesses where municipality_id = p_municipality_id)
    or exists (select 1 from public.fuel_alerts where municipality_id = p_municipality_id)
    or exists (select 1 from public.fuel_stations where municipality_id = p_municipality_id)
    or exists (select 1 from public.markets where municipality_id = p_municipality_id)
    or exists (select 1 from public.orders where delivery_municipality_id = p_municipality_id)
    or exists (select 1 from public.products where municipality_id = p_municipality_id)
    or exists (select 1 from public.provider_profiles where municipality_id = p_municipality_id)
    or exists (select 1 from public.seller_delivery_zones where municipality_id = p_municipality_id)
    or exists (select 1 from public.services where municipality_id = p_municipality_id)
  then raise exception 'MUNICIPALITY_IN_USE'; end if;
  delete from public.municipalities where id = p_municipality_id;
end $function$;
revoke all on function public.admin_delete_municipality(uuid) from public, anon;
grant execute on function public.admin_delete_municipality(uuid) to authenticated;

/** Municípios de qualquer província (também das desligadas), para a equipa os preparar. */
create or replace function public.admin_list_municipalities(p_province_id uuid)
 returns table(id uuid, name text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select m.id, m.name from public.municipalities m where m.province_id = p_province_id order by m.name;
end $function$;
revoke all on function public.admin_list_municipalities(uuid) from public, anon;
grant execute on function public.admin_list_municipalities(uuid) to authenticated;

-- Ligar/desligar províncias fica no registo da administração.
drop trigger if exists trg_audit_provinces on public.provinces;
create trigger trg_audit_provinces after update on public.provinces for each row execute function public.audit_admin_change();
