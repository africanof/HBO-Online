-- «✨ Melhorar com IA» ao criar anúncios: limite de usos por pessoa e por dia (controlo de custos).
-- A função de servidor generate-ad chama consume_ai_writer() antes de pedir o texto à OpenAI.
create table if not exists public.ai_writer_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_writer_usage enable row level security;
revoke all on public.ai_writer_usage from public, anon, authenticated;
grant select on public.ai_writer_usage to authenticated;
create policy ai_writer_usage_own_read on public.ai_writer_usage for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.ai_writer_limit()
 returns integer
 language sql
 immutable
 set search_path to 'public'
as $function$ select 15 $function$;

/** Gasta um uso do dia (hora de Angola) e devolve quantos sobram; recusa depois do limite. */
create or replace function public.consume_ai_writer()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare d date := (now() at time zone 'Africa/Luanda')::date; used integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  insert into public.ai_writer_usage(user_id, day, count) values (auth.uid(), d, 1)
  on conflict (user_id, day) do update set count = public.ai_writer_usage.count + 1
    where public.ai_writer_usage.count < public.ai_writer_limit()
  returning count into used;
  if used is null then raise exception 'AI_WRITER_LIMIT'; end if;
  return public.ai_writer_limit() - used;
end $function$;
revoke all on function public.consume_ai_writer() from public, anon;
grant execute on function public.consume_ai_writer() to authenticated;
