-- Canonical territorial matching for saved searches.
-- A selected territory only matches when its entire ancestry is active.
create or replace function public.saved_search_territory_active(p_territory_id uuid,p_kind text)
returns boolean language plpgsql stable security invoker set search_path=public
as $$
declare ok boolean;
begin
  if p_territory_id is null then return true; end if;
  if p_kind='street' then
    select s.active and n.active and m.active and p.active and c.active into ok
    from public.streets s
    join public.neighborhoods n on n.id=s.neighborhood_id
    join public.municipalities m on m.id=n.municipality_id
    join public.provinces p on p.id=m.province_id
    join public.countries c on c.id=p.country_id
    where s.id=p_territory_id;
  elsif p_kind='neighborhood' then
    select n.active and m.active and p.active and c.active into ok
    from public.neighborhoods n
    join public.municipalities m on m.id=n.municipality_id
    join public.provinces p on p.id=m.province_id
    join public.countries c on c.id=p.country_id
    where n.id=p_territory_id;
  elsif p_kind='municipality' then
    select m.active and p.active and c.active into ok
    from public.municipalities m
    join public.provinces p on p.id=m.province_id
    join public.countries c on c.id=p.country_id
    where m.id=p_territory_id;
  elsif p_kind='province' then
    select p.active and c.active into ok from public.provinces p join public.countries c on c.id=p.country_id where p.id=p_territory_id;
  elsif p_kind='country' then
    select active into ok from public.countries where id=p_territory_id;
  else return false;
  end if;
  return coalesce(ok,false);
end;
$$;

revoke execute on function public.saved_search_territory_active(uuid,text) from anon,authenticated;

-- Ensure the public territorial reference tables expose only active records.
drop policy if exists "communes_public_read" on public.communes;
create policy "communes_public_read" on public.communes for select to anon,authenticated using (active=true);

drop policy if exists "streets_public_read" on public.streets;
create policy "streets_public_read" on public.streets for select to anon,authenticated using (active=true);

drop policy if exists "addresses_public_read" on public.addresses;
create policy "addresses_public_read" on public.addresses for select to anon,authenticated using (active=true);