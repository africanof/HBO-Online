create table if not exists public.communes (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), unique(municipality_id,name)
);
create table if not exists public.streets (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id) on delete cascade,
  name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), unique(neighborhood_id,name)
);
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  street_id uuid references public.streets(id) on delete set null,
  house_number text, address_label text not null,
  latitude double precision, longitude double precision, plus_code text,
  reference_point text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists communes_municipality_id_idx on public.communes(municipality_id);
create index if not exists streets_neighborhood_id_idx on public.streets(neighborhood_id);
create index if not exists addresses_street_id_idx on public.streets(neighborhood_id);
create index if not exists addresses_street_id_idx2 on public.addresses(street_id);
create index if not exists addresses_coordinates_idx on public.addresses(latitude,longitude);
alter table public.communes enable row level security;
alter table public.streets enable row level security;
alter table public.addresses enable row level security;
create policy "communes_public_read" on public.communes for select to anon, authenticated using (active = true);
create policy "streets_public_read" on public.streets for select to anon, authenticated using (active = true);
create policy "addresses_public_read" on public.addresses for select to anon, authenticated using (active = true);