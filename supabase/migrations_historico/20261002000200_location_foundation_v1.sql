create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  country_code text not null default 'AO', created_at timestamptz not null default now()
);
create table if not exists public.municipalities (
  id uuid primary key default gen_random_uuid(), province_id uuid not null references public.provinces(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), unique(province_id,name)
);
create table if not exists public.neighborhoods (
  id uuid primary key default gen_random_uuid(), municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), unique(municipality_id,name)
);
create index if not exists municipalities_province_id_idx on public.municipalities(province_id);
create index if not exists neighborhoods_municipality_id_idx on public.neighborhoods(municipality_id);
alter table public.provinces enable row level security;
alter table public.municipalities enable row level security;
alter table public.neighborhoods enable row level security;
create policy "location_provinces_public_read" on public.provinces for select to anon, authenticated using (true);
create policy "location_municipalities_public_read" on public.municipalities for select to anon, authenticated using (true);
create policy "location_neighborhoods_public_read" on public.neighborhoods for select to anon, authenticated using (true);
insert into public.provinces(name,country_code) values ('Huambo','AO') on conflict(name) do nothing;
insert into public.municipalities (province_id,name)
select p.id,v.name from public.provinces p cross join (values
('Bailundo'),('Caála'),('Cachiungo'),('Chicala Choloanga'),('Chinjenje'),('Ecunha'),('Huambo'),('Londuimbali'),('Longonjo'),('Mungo'),('Ucuma'),('Bimbe'),('Sambo'),('Galanga'),('Alto Hama'),('Chilata'),('Cuima')
) v(name) where p.name='Huambo' on conflict(province_id,name) do nothing;