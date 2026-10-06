-- Huambo Online: foundation identity v1
create table if not exists public.account_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability in ('customer','provider','seller','business_owner','business_staff','courier')),
  created_at timestamptz not null default now(),
  primary key (user_id, capability)
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('business','store','organization')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.account_capabilities enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "capabilities_select_own" on public.account_capabilities for select to authenticated using (user_id = auth.uid());
create policy "capabilities_insert_own" on public.account_capabilities for insert to authenticated with check (user_id = auth.uid());
create policy "capabilities_delete_own" on public.account_capabilities for delete to authenticated using (user_id = auth.uid());

create policy "organizations_select_member" on public.organizations for select to authenticated using (
  owner_id = auth.uid() or exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid()
  )
);
create policy "organizations_insert_owner" on public.organizations for insert to authenticated with check (owner_id = auth.uid());
create policy "organizations_update_owner" on public.organizations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "organizations_delete_owner" on public.organizations for delete to authenticated using (owner_id = auth.uid());

create policy "members_select_member" on public.organization_members for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.organizations o
    where o.id = organization_members.organization_id and o.owner_id = auth.uid()
  )
);
create policy "members_insert_owner" on public.organization_members for insert to authenticated with check (
  exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid())
);
create policy "members_delete_owner" on public.organization_members for delete to authenticated using (
  exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid())
);

create index if not exists account_capabilities_user_id_idx on public.account_capabilities(user_id);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists organizations_owner_id_idx on public.organizations(owner_id);