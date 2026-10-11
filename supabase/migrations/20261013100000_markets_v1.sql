-- Praças (mercados) do Huambo: lista pública, sugestões dos utilizadores e ligação opcional
-- de anúncios, produtos e empresas à praça onde se vende.

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  municipality_id uuid references public.municipalities(id),
  address_text text check (address_text is null or char_length(address_text) <= 200),
  description text check (description is null or char_length(description) <= 2000),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 120),
  photo_url text check (photo_url is null or photo_url ~ '^https://'),
  status text not null default 'pending' check (status in ('pending', 'active', 'hidden')),
  suggested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists markets_name_unique on public.markets (lower(trim(name)));
alter table public.markets enable row level security;
create policy markets_public_read on public.markets for select to authenticated
  using (status = 'active' or public.has_admin_role() or suggested_by = auth.uid());
create policy markets_anon_read on public.markets for select to anon using (status = 'active');
create policy markets_admin_insert on public.markets for insert to authenticated with check (public.has_admin_role());
create policy markets_admin_update on public.markets for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
revoke all on public.markets from anon;
grant select on public.markets to anon;
revoke delete on public.markets from authenticated;
grant select, insert, update on public.markets to authenticated;

alter table public.classified_listings add column if not exists market_id uuid references public.markets(id) on delete set null;
alter table public.products add column if not exists market_id uuid references public.markets(id) on delete set null;
alter table public.businesses add column if not exists market_id uuid references public.markets(id) on delete set null;
create index if not exists classified_listings_market_idx on public.classified_listings(market_id) where market_id is not null;
create index if not exists products_market_idx on public.products(market_id) where market_id is not null;
create index if not exists businesses_market_idx on public.businesses(market_id) where market_id is not null;

-- Lista das praças ativas com o número de anúncios, produtos e empresas de cada uma.
create or replace function public.market_directory(p_query text default '', p_municipality_id uuid default null)
returns table(id uuid, name text, municipality_id uuid, municipality_name text, address_text text, description text,
  opening_hours text, photo_url text, listings bigint, products bigint, businesses bigint)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.municipality_id, mu.name, m.address_text, m.description, m.opening_hours, m.photo_url,
    (select count(*) from public.classified_listings l where l.market_id = m.id and l.status = 'published'),
    (select count(*) from public.products p where p.market_id = m.id and p.active),
    (select count(*) from public.businesses b where b.market_id = m.id and b.active)
  from public.markets m left join public.municipalities mu on mu.id = m.municipality_id
  where m.status = 'active'
    and (coalesce(trim(p_query), '') = '' or m.name ilike '%' || trim(p_query) || '%' or m.address_text ilike '%' || trim(p_query) || '%')
    and (p_municipality_id is null or m.municipality_id = p_municipality_id)
  order by m.name limit 200;
$$;

-- Qualquer utilizador com sessão pode sugerir uma praça; fica à espera da aprovação da administração.
create or replace function public.suggest_market(p_name text, p_municipality_id uuid, p_address text default null, p_description text default null)
returns public.markets language plpgsql security definer set search_path = public as $$
declare m public.markets;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_MARKET'; end if;
  if exists (select 1 from public.markets x where lower(trim(x.name)) = lower(trim(p_name))) then raise exception 'MARKET_EXISTS'; end if;
  if (select count(*) from public.markets x where x.suggested_by = auth.uid() and x.status = 'pending') >= 5 then raise exception 'TOO_MANY_SUGGESTIONS'; end if;
  insert into public.markets(name, municipality_id, address_text, description, status, suggested_by)
  values (trim(p_name), p_municipality_id, nullif(trim(coalesce(p_address, '')), ''), nullif(trim(coalesce(p_description, '')), ''), 'pending', auth.uid())
  returning * into m;
  insert into public.notifications(user_id, type, title, body, data)
  select r.user_id, 'system', 'Nova praça sugerida', '«' || m.name || '» está à espera de aprovação.', jsonb_build_object('market_id', m.id, 'for', 'admin')
  from public.user_roles r where r.role in ('admin', 'moderator') limit 20;
  return m;
end $$;

revoke all on function public.market_directory(text, uuid) from public;
grant execute on function public.market_directory(text, uuid) to anon, authenticated;
revoke all on function public.suggest_market(text, uuid, text, text) from public, anon;
grant execute on function public.suggest_market(text, uuid, text, text) to authenticated;

-- Praças iniciais (município do Huambo). A administração pode completar morada, horário e fotografia.
insert into public.markets(name, municipality_id, status)
select v.name, (select id from public.municipalities where name = 'Huambo' limit 1), 'active'
from (values ('Praça do Kapango'), ('Praça do Ferro'), ('Praça das Cassilhas'), ('Praça da Alemanha')) as v(name)
on conflict do nothing;
