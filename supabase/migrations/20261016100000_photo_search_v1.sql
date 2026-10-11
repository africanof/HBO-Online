-- Pesquisa por fotografia (Claude Haiku 5.5): só com sessão iniciada e no máximo
-- 20 pesquisas por pessoa por dia (dia de Angola). A contagem é feita no servidor.

create table if not exists public.photo_search_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.photo_search_usage enable row level security;
create policy photo_search_usage_own_read on public.photo_search_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.photo_search_usage from anon;
revoke insert, update, delete on public.photo_search_usage from authenticated;
grant select on public.photo_search_usage to authenticated;

create or replace function public.photo_search_limit() returns integer
language sql immutable as $$ select 20 $$;

-- Gasta uma pesquisa do dia (devolve quantas restam) ou recusa com PHOTO_SEARCH_LIMIT.
create or replace function public.consume_photo_search()
returns integer language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Africa/Luanda')::date; used integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  insert into public.photo_search_usage(user_id, day, count) values (auth.uid(), d, 1)
  on conflict (user_id, day) do update set count = public.photo_search_usage.count + 1
    where public.photo_search_usage.count < public.photo_search_limit()
  returning count into used;
  if used is null then raise exception 'PHOTO_SEARCH_LIMIT'; end if;
  return public.photo_search_limit() - used;
end $$;

-- Quantas pesquisas por foto restam hoje.
create or replace function public.photo_searches_left()
returns integer language sql stable security definer set search_path = public as $$
  select public.photo_search_limit() - coalesce((select count from public.photo_search_usage
    where user_id = auth.uid() and day = (now() at time zone 'Africa/Luanda')::date), 0);
$$;

revoke all on function public.consume_photo_search() from public, anon;
revoke all on function public.photo_searches_left() from public, anon;
grant execute on function public.consume_photo_search() to authenticated;
grant execute on function public.photo_searches_left() to authenticated;
