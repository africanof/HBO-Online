-- Resumo diário por email (Resend): uma vez por dia, quem tem notificações por ler recebe um email com
-- as últimas (até 10), com ligação para o Site. Nunca o mesmo aviso duas vezes.
--   • opcional: «Resumo diário por email» ligado/desligado nas preferências; cada email traz uma
--     ligação para cancelar com um toque (sem iniciar sessão)
--   • só para emails confirmados e contas ativas
--   • nunca passa do plano grátis do Resend (100/dia, 3 000/mês): contador com margem — no máximo
--     90 emails por dia e 2 700 por mês; ao chegar ao limite pára até ao dia (ou mês) seguinte
--   • enviado pela Edge Function «email-digest», que precisa dos segredos RESEND_API_KEY e EMAIL_FROM;
--     sem eles não envia nada

alter table public.notifications add column if not exists emailed_at timestamptz;
create index if not exists notifications_email_pending_idx on public.notifications (user_id, created_at) where read_at is null and emailed_at is null;

alter table public.notification_preferences add column if not exists email_digest boolean not null default true;
alter table public.notification_preferences add column if not exists email_token uuid not null default gen_random_uuid();
create unique index if not exists notification_preferences_email_token_idx on public.notification_preferences (email_token);

/** Contador de emails enviados por dia (hora de Angola), para nunca passar do plano grátis. */
create table if not exists public.email_send_log (
  day date primary key,
  sent integer not null default 0
);
alter table public.email_send_log enable row level security;
revoke all on public.email_send_log from public, anon, authenticated;

/** Limites (abaixo do plano grátis do Resend: 100 por dia e 3 000 por mês). */
create or replace function public.email_limits()
 returns table(per_day integer, per_month integer)
 language sql
 immutable
as $function$ select 90, 2700 $function$;

/** Reserva o envio de 1 email; devolve false se já se chegou ao limite do dia ou do mês. */
create or replace function public.email_quota_take()
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare today date := (now() at time zone 'Africa/Luanda')::date; d int; m int; lim record;
begin
  select * into lim from public.email_limits();
  insert into public.email_send_log(day, sent) values (today, 0) on conflict (day) do nothing;
  select sent into d from public.email_send_log where day = today for update;
  select coalesce(sum(sent), 0) into m from public.email_send_log where day >= date_trunc('month', today)::date;
  if d >= lim.per_day or m >= lim.per_month then return false; end if;
  update public.email_send_log set sent = sent + 1 where day = today;
  return true;
end $function$;
revoke all on function public.email_quota_take() from public, anon, authenticated;
grant execute on function public.email_quota_take() to service_role;

/** Devolve a reserva quando o envio falha (para não gastar a quota sem enviar). */
create or replace function public.email_quota_release()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.email_send_log set sent = greatest(0, sent - 1) where day = (now() at time zone 'Africa/Luanda')::date
$function$;
revoke all on function public.email_quota_release() from public, anon, authenticated;
grant execute on function public.email_quota_release() to service_role;

/** Liga ou desliga o resumo diário por email (pessoa com sessão iniciada). */
create or replace function public.set_email_digest(p_enabled boolean)
 returns public.notification_preferences
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.notification_preferences as np(user_id, email_digest, updated_at) values (auth.uid(), coalesce(p_enabled, false), now())
  on conflict (user_id) do update set email_digest = excluded.email_digest, updated_at = now()
  returning * into r;
  return r;
end $function$;
revoke all on function public.set_email_digest(boolean) from public, anon;
grant execute on function public.set_email_digest(boolean) to authenticated;

/** Cancelar os emails pela ligação do próprio email (sem sessão). Devolve se o código era válido. */
create or replace function public.unsubscribe_email(p_token uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.notification_preferences set email_digest = false, updated_at = now() where email_token = p_token;
  return found;
end $function$;
revoke all on function public.unsubscribe_email(uuid) from public;
grant execute on function public.unsubscribe_email(uuid) to anon, authenticated;

/** Pessoas com notificações por ler que ainda não foram por email (últimos 3 dias), com o email e o código para cancelar. */
create or replace function public.email_digest_queue(p_limit integer default 90)
 returns table(user_id uuid, email text, full_name text, unsubscribe_token uuid, notifications jsonb, total integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare lim int := greatest(1, least(coalesce(p_limit, 90), 500));
begin
  -- Garante preferências (e o código para cancelar) a quem ainda não tem.
  insert into public.notification_preferences(user_id)
  select distinct n.user_id from public.notifications n
  where n.read_at is null and n.emailed_at is null and n.created_at > now() - interval '3 days'
  on conflict do nothing;

  return query
  select u.id, u.email::text, p.full_name, np.email_token,
    (select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'body', x.body, 'data', x.data, 'created_at', x.created_at) order by x.created_at desc)
       from (select * from public.notifications n2 where n2.user_id = u.id and n2.read_at is null and n2.emailed_at is null
               and n2.created_at > now() - interval '3 days' order by n2.created_at desc limit 10) x),
    (select count(*)::int from public.notifications n3 where n3.user_id = u.id and n3.read_at is null and n3.emailed_at is null
       and n3.created_at > now() - interval '3 days')
  from auth.users u
  join public.profiles p on p.id = u.id and p.status = 'active'
  join public.notification_preferences np on np.user_id = u.id and np.enabled and np.email_digest
  where u.email is not null and u.email_confirmed_at is not null
    and exists (select 1 from public.notifications n where n.user_id = u.id and n.read_at is null and n.emailed_at is null
                and n.created_at > now() - interval '3 days')
  order by (select min(n4.created_at) from public.notifications n4 where n4.user_id = u.id and n4.read_at is null and n4.emailed_at is null) asc
  limit lim;
end $function$;
revoke all on function public.email_digest_queue(integer) from public, anon, authenticated;
grant execute on function public.email_digest_queue(integer) to service_role;

/** Marca como enviadas por email todas as notificações por ler da pessoa (as dos últimos 3 dias). */
create or replace function public.email_digest_mark(p_user uuid)
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with u as (
    update public.notifications set emailed_at = now()
    where user_id = p_user and read_at is null and emailed_at is null and created_at > now() - interval '3 days'
    returning 1
  ) select count(*)::int from u
$function$;
revoke all on function public.email_digest_mark(uuid) from public, anon, authenticated;
grant execute on function public.email_digest_mark(uuid) to service_role;

-- Todos os dias às 20:00 e 20:20 (hora de Angola), depois das «Novidades para si».
-- (A chave «anon» é pública — é a mesma do Site e da APP; a função só trabalha sobre a fila.)
select cron.schedule('huambo-online-email-digest', '0,20 19 * * *', $$
  select net.http_post('https://pewymvkowbdizdiyjmao.supabase.co/functions/v1/email-digest', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld3ltdmtvd2JkaXpkaXlqbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0OTg4MTYsImV4cCI6MjEwOTA3NDgxNn0.Lo8I9suwa7uqAub4UYmdeasDpHTvePAU23SI7rL43wk'),
    120000)
$$);
