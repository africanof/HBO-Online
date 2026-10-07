-- Huambo Online — diretório de empresas e verificação reservada à administração
alter table public.businesses
  add column if not exists municipality_id uuid references public.municipalities(id),
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists logo_url text,
  add column if not exists address_text text;
create index if not exists businesses_category_idx on public.businesses(category_id) where active;
create index if not exists businesses_municipality_idx on public.businesses(municipality_id) where active;

create or replace function public.business_directory(p_query text default '', p_category_id uuid default null,
  p_municipality_id uuid default null, p_limit integer default 30)
returns table(id uuid, owner_id uuid, name text, description text, category_id uuid, category_name text,
  municipality_id uuid, municipality_name text, phone text, whatsapp text, logo_url text, address_text text,
  verified boolean, rating numeric, review_count bigint, created_at timestamptz)
language sql stable set search_path = public as $$
  select b.id, b.owner_id, b.name, b.description, b.category_id, c.name, b.municipality_id, m.name,
         b.phone, b.whatsapp, b.logo_url, b.address_text, b.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id), b.created_at
  from public.businesses b
  left join public.categories c on c.id = b.category_id
  left join public.municipalities m on m.id = b.municipality_id
  left join public.reviews r on r.business_id = b.id and r.status = 'published'
  where b.active
    and (p_category_id is null or b.category_id = p_category_id)
    and (p_municipality_id is null or b.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or lower(b.name || ' ' || coalesce(b.description, '')) like '%' || lower(p_query) || '%')
  group by b.id, c.name, m.name
  order by b.verified desc, count(distinct r.id) desc, b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
grant execute on function public.business_directory(text, uuid, uuid, integer) to anon, authenticated;

create or replace function public.guard_verified_flag()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if public.has_admin_role() or current_user in ('postgres', 'supabase_admin') then return new; end if;
  if tg_op = 'INSERT' then new.verified := false; else new.verified := old.verified; end if;
  return new;
end $$;
create trigger trg_guard_provider_verified before insert or update on public.provider_profiles
  for each row execute function public.guard_verified_flag();
create trigger trg_guard_business_verified before insert or update on public.businesses
  for each row execute function public.guard_verified_flag();

create policy provider_profiles_admin_update on public.provider_profiles for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy businesses_admin_update on public.businesses for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
