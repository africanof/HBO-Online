alter table public.provinces add column if not exists active boolean not null default false;
alter table public.provinces add column if not exists country_code text not null default 'AO';

insert into public.provinces(name,country_code,active) values
('Bengo','AO',false),('Benguela','AO',false),('Bié','AO',false),('Cabinda','AO',false),
('Cuando','AO',false),('Cuanza Norte','AO',false),('Cuanza Sul','AO',false),('Cubango','AO',false),
('Cunene','AO',false),('Huambo','AO',true),('Huíla','AO',false),('Icolo e Bengo','AO',false),
('Luanda','AO',false),('Lunda Norte','AO',false),('Lunda Sul','AO',false),('Malanje','AO',false),
('Moxico','AO',false),('Moxico Leste','AO',false),('Namibe','AO',false),('Uíge','AO',false),
('Zaire','AO',false)
on conflict(name) do update set active=excluded.active, country_code=excluded.country_code;

create index if not exists provinces_active_idx on public.provinces(active);
drop policy if exists "location_provinces_public_read" on public.provinces;
create policy "location_provinces_public_read" on public.provinces for select to anon, authenticated using (active = true);