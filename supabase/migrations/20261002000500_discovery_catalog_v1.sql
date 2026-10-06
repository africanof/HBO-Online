create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique,
  type text not null check (type in ('business','professional','service','product','classified')),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null, name text not null, description text,
  category_id uuid references public.categories(id) on delete set null, address_id uuid references public.addresses(id) on delete set null,
  verified boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), provider_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null, title text not null, description text,
  category_id uuid references public.categories(id) on delete set null, price_from numeric(14,2),
  currency text not null default 'AOA', address_id uuid references public.addresses(id) on delete set null,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null, name text not null, description text,
  category_id uuid references public.categories(id) on delete set null, price numeric(14,2) not null,
  currency text not null default 'AOA', stock integer not null default 0 check (stock >= 0),
  address_id uuid references public.addresses(id) on delete set null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists businesses_category_idx on public.businesses(category_id);
create index if not exists businesses_address_idx on public.businesses(address_id);
create index if not exists services_category_idx on public.services(category_id);
create index if not exists services_provider_idx on public.services(provider_id);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_seller_idx on public.products(seller_id);
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (active = true);
create policy "businesses_public_read" on public.businesses for select to anon, authenticated using (active = true);
create policy "businesses_owner_insert" on public.businesses for insert to authenticated with check (owner_id = auth.uid());
create policy "businesses_owner_update" on public.businesses for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "businesses_owner_delete" on public.businesses for delete to authenticated using (owner_id = auth.uid());
create policy "services_public_read" on public.services for select to anon, authenticated using (active = true);
create policy "services_provider_insert" on public.services for insert to authenticated with check (provider_id = auth.uid());
create policy "services_provider_update" on public.services for update to authenticated using (provider_id = auth.uid()) with check (provider_id = auth.uid());
create policy "services_provider_delete" on public.services for delete to authenticated using (provider_id = auth.uid());
create policy "products_public_read" on public.products for select to anon, authenticated using (active = true);
create policy "products_seller_insert" on public.products for insert to authenticated with check (seller_id = auth.uid());
create policy "products_seller_update" on public.products for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "products_seller_delete" on public.products for delete to authenticated using (seller_id = auth.uid());
insert into public.categories(name,slug,type) values
('Advogados','advogados','professional'),('Contabilistas','contabilistas','professional'),('Professores','professores','professional'),
('Domésticas','domesticas','professional'),('Lojas','lojas','business'),('Escolas','escolas','business'),
('Farmácias','farmacias','business'),('Clínicas','clinicas','business'),('Oficinas','oficinas','business'),
('Construção','construcao','service'),('Limpeza','limpeza','service'),('Transporte','transporte','service'),
('Tecnologia','tecnologia','service'),('Alimentação','alimentacao','business'),('Moda','moda','business'),
('Eletrónica','eletronica','product') on conflict(slug) do nothing;