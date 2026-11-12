-- Perdidos e achados: quem perdeu alguma coisa (documentos, telemóvel, chaves, animal…) ou encontrou alguma
-- coisa publica um aviso gratuito, com fotografias, o sítio e a data. Não é uma venda: sem preço, sem compra,
-- sem comissão (pode haver uma recompensa, combinada entre as pessoas).
-- Os avisos abertos são públicos; o telefone só se vê com sessão iniciada (função lost_found_contact).
-- Quando alguém publica um «achado», quem tem um «perdido» aberto da mesma categoria recebe um aviso.
-- Os avisos fecham sozinhos ao fim de 90 dias.

create table if not exists public.lost_found_posts (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lost', 'found')),
  category text not null default 'outro' check (category in ('documentos', 'telemovel', 'carteira', 'chaves', 'animal', 'veiculo', 'mala', 'joias', 'eletronica', 'outro')),
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text check (char_length(description) <= 1500),
  place text not null check (char_length(trim(place)) between 3 and 200),
  municipality text check (municipality is null or municipality ~ '^[a-z0-9-]{2,40}$'),
  happened_on date not null default current_date,
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  reward numeric check (reward is null or (reward > 0 and reward <= 100000000)),
  phone text not null check (char_length(phone) between 6 and 30),
  status text not null default 'open' check (status in ('open', 'resolved', 'removed', 'expired')),
  resolved_at timestamptz,
  expires_at timestamptz not null default now() + interval '90 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lost_found_open_idx on public.lost_found_posts(status, created_at desc);
create index if not exists lost_found_user_idx on public.lost_found_posts(user_id, created_at desc);
create index if not exists lost_found_match_idx on public.lost_found_posts(kind, category, status);

alter table public.lost_found_posts enable row level security;
drop policy if exists lost_found_read on public.lost_found_posts;
create policy lost_found_read on public.lost_found_posts for select
  using ((status = 'open' and expires_at > now()) or user_id = (select auth.uid()) or (select public.has_admin_role()));
-- O telefone não faz parte da leitura pública: só pela função lost_found_contact.
revoke all on public.lost_found_posts from anon, authenticated;
grant select (id, ref_no, user_id, kind, category, title, description, place, municipality, happened_on, photos, reward,
  status, resolved_at, expires_at, created_at, updated_at) on public.lost_found_posts to anon, authenticated;
-- Tudo o resto passa pelas funções abaixo.

create or replace function public.lost_found_ref(n bigint) returns text language sql immutable set search_path = public as $$ select 'PA-' || n $$;

-- Novo aviso (perdido ou achado).
create or replace function public.lost_found_create(p_kind text, p_category text, p_title text, p_description text, p_place text,
  p_municipality text, p_happened_on date, p_photos text[], p_reward numeric, p_phone text)
returns public.lost_found_posts language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.lost_found_posts; pics text[] := coalesce(p_photos, '{}');
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('lost', 'found') then raise exception 'INVALID_INPUT'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'LOST_FOUND_TITLE_REQUIRED'; end if;
  if char_length(trim(coalesce(p_place, ''))) < 3 then raise exception 'LOST_FOUND_PLACE_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'LOST_FOUND_PHONE_REQUIRED'; end if;
  if p_happened_on is null or p_happened_on > current_date + 1 or p_happened_on < current_date - 365 then raise exception 'LOST_FOUND_DATE_INVALID'; end if;
  if cardinality(pics) > 4 or (cardinality(pics) > 0 and not public.portfolio_photos_ok(pics, me)) then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.lost_found_posts where user_id = me and status = 'open') >= 10 then raise exception 'LOST_FOUND_TOO_MANY'; end if;
  insert into public.lost_found_posts (user_id, kind, category, title, description, place, municipality, happened_on, photos, reward, phone)
  values (me, p_kind, coalesce(p_category, 'outro'), left(trim(p_title), 120), nullif(left(trim(coalesce(p_description, '')), 1500), ''),
    left(trim(p_place), 200), nullif(p_municipality, ''), p_happened_on, pics,
    case when p_kind = 'lost' and p_reward > 0 then round(p_reward) end, left(trim(p_phone), 30))
  returning * into r;
  -- Achado: avisa quem perdeu alguma coisa da mesma categoria (até 50 pessoas).
  if r.kind = 'found' then
    insert into public.notifications(user_id, type, title, body, data)
    select distinct on (l.user_id) l.user_id, 'system', '🔎 Alguém encontrou algo parecido com o que perdeu',
      '«' || r.title || '» · ' || r.place || '. Veja se é seu.', jsonb_build_object('for', 'lost_found', 'lost_found_id', r.id)
    from public.lost_found_posts l
    where l.kind = 'lost' and l.category = r.category and l.status = 'open' and l.expires_at > now() and l.user_id <> me
    order by l.user_id, l.created_at desc
    limit 50;
  end if;
  return r;
end $$;

-- Quem publicou: «já apareceu» / «já foi entregue».
create or replace function public.lost_found_resolve(p_id uuid)
returns public.lost_found_posts language plpgsql security definer set search_path = public as $$
declare r public.lost_found_posts;
begin
  select * into r from public.lost_found_posts where id = p_id for update;
  if not found or r.user_id <> auth.uid() then raise exception 'LOST_FOUND_NOT_FOUND'; end if;
  if r.status <> 'open' then raise exception 'INVALID_TRANSITION'; end if;
  update public.lost_found_posts set status = 'resolved', resolved_at = now(), updated_at = now() where id = r.id returning * into r;
  return r;
end $$;

-- Quem publicou ou a equipa: retirar o aviso.
create or replace function public.lost_found_remove(p_id uuid)
returns public.lost_found_posts language plpgsql security definer set search_path = public as $$
declare r public.lost_found_posts;
begin
  select * into r from public.lost_found_posts where id = p_id for update;
  if not found or (r.user_id <> auth.uid() and not public.has_admin_role()) then raise exception 'LOST_FOUND_NOT_FOUND'; end if;
  if r.status = 'removed' then return r; end if;
  update public.lost_found_posts set status = 'removed', updated_at = now() where id = r.id returning * into r;
  return r;
end $$;

-- Telefone de quem publicou (só com sessão iniciada e com o aviso aberto).
create or replace function public.lost_found_contact(p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare r public.lost_found_posts;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.lost_found_posts where id = p_id;
  if not found or not (r.status = 'open' and r.expires_at > now() or r.user_id = auth.uid() or public.has_admin_role()) then
    raise exception 'LOST_FOUND_NOT_FOUND'; end if;
  return r.phone;
end $$;

-- Fecha os avisos com mais de 90 dias (tarefa diária).
create or replace function public.lost_found_expire() returns int language sql security definer set search_path = public as $$
  with x as (update public.lost_found_posts set status = 'expired', updated_at = now() where status = 'open' and expires_at <= now() returning 1)
  select count(*)::int from x;
$$;

revoke all on function public.lost_found_create(text,text,text,text,text,text,date,text[],numeric,text), public.lost_found_resolve(uuid),
  public.lost_found_remove(uuid), public.lost_found_contact(uuid), public.lost_found_expire() from public, anon, authenticated;
grant execute on function public.lost_found_create(text,text,text,text,text,text,date,text[],numeric,text), public.lost_found_resolve(uuid),
  public.lost_found_remove(uuid), public.lost_found_contact(uuid) to authenticated;

select cron.schedule('huambo-online-lost-found-expire', '40 3 * * *', 'select public.lost_found_expire()');
