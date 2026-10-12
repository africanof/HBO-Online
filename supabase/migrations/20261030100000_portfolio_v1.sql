-- Portfólio (trabalhos realizados) de profissionais e empresas, igual no Site e na APP.
-- Cada trabalho: título, descrição, data e 1 a 8 fotografias (na pasta da pessoa no bucket classified-media).
-- Todos veem os trabalhos de perfis ativos; só o dono cria, muda ou apaga. Máximo 40 trabalhos por perfil.

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid references public.provider_profiles(user_id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  photos text[] not null check (cardinality(photos) between 1 and 8),
  done_on date check (done_on is null or done_on <= current_date + 1),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_id is null) <> (business_id is null))
);
create index if not exists portfolio_provider on public.portfolio_items(provider_id, position, created_at desc) where provider_id is not null;
create index if not exists portfolio_business on public.portfolio_items(business_id, position, created_at desc) where business_id is not null;
create index if not exists portfolio_owner on public.portfolio_items(owner_id);

-- As fotografias têm de estar na pasta do próprio dono no bucket público classified-media.
create or replace function public.portfolio_photos_ok(p_photos text[], p_owner uuid) returns boolean
language sql immutable as $$
  select coalesce(bool_and(p ~ ('^https://[a-z0-9.-]+/storage/v1/object/public/classified-media/' || p_owner::text || '/[A-Za-z0-9._-]{1,120}$')), false)
  from unnest(p_photos) p;
$$;

-- O perfil é do dono?
create or replace function public.portfolio_target_owned(p_provider uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_provider is not null then p_provider = auth.uid() and exists (select 1 from public.provider_profiles where user_id = p_provider)
              else exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) end;
$$;
-- O perfil está visível ao público?
create or replace function public.portfolio_target_public(p_provider uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_provider is not null then exists (select 1 from public.provider_profiles where user_id = p_provider and active)
              else exists (select 1 from public.businesses where id = p_business and active) end;
$$;

alter table public.portfolio_items enable row level security;
create policy portfolio_public_read on public.portfolio_items for select to anon, authenticated
  using (public.portfolio_target_public(provider_id, business_id) or owner_id = (select auth.uid()));
create policy portfolio_owner_insert on public.portfolio_items for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.portfolio_target_owned(provider_id, business_id) and public.portfolio_photos_ok(photos, owner_id));
create policy portfolio_owner_update on public.portfolio_items for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.portfolio_target_owned(provider_id, business_id) and public.portfolio_photos_ok(photos, owner_id));
create policy portfolio_owner_delete on public.portfolio_items for delete to authenticated using (owner_id = (select auth.uid()));
create policy portfolio_admin_delete on public.portfolio_items for delete to authenticated using ((select public.has_admin_role()));
revoke all on public.portfolio_items from anon, authenticated;
grant select on public.portfolio_items to anon, authenticated;
grant insert, update, delete on public.portfolio_items to authenticated;

-- Limite de 40 trabalhos por perfil e data de atualização.
create or replace function public.portfolio_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.portfolio_items
      where provider_id is not distinct from new.provider_id and business_id is not distinct from new.business_id) >= 40 then
    raise exception 'PORTFOLIO_FULL';
  end if;
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id; new.provider_id := old.provider_id; new.business_id := old.business_id; new.created_at := old.created_at;
  end if;
  new.title := trim(new.title); new.description := nullif(trim(coalesce(new.description, '')), ''); new.updated_at := now();
  return new;
end $$;
create trigger trg_portfolio_guard before insert or update on public.portfolio_items for each row execute function public.portfolio_guard();

revoke all on function public.portfolio_guard() from public, anon, authenticated;
grant execute on function public.portfolio_photos_ok(text[], uuid) to anon, authenticated;
grant execute on function public.portfolio_target_owned(uuid, uuid) to authenticated;
grant execute on function public.portfolio_target_public(uuid, uuid) to anon, authenticated;
