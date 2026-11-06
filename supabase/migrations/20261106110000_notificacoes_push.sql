-- Notificações no telemóvel (push) pela Expo: cada aviso que entra em «notifications» (mensagens, encomendas,
-- pagamentos, suporte…) segue também para os telemóveis da pessoa onde a APP tem sessão iniciada.
-- • push_tokens: os telemóveis de cada pessoa (a APP regista-se ao entrar e apaga-se ao sair da conta).
-- • As preferências continuam a valer (os avisos desligados nem chegam a ser criados) e há um interruptor próprio
--   «Notificações no telemóvel» (notification_preferences.push).
-- • Telemóveis que já não existem (APP desinstalada) são retirados sozinhos a partir das respostas da Expo.
-- No Android, a Expo precisa das credenciais do Firebase (FCM) no projeto da Expo; sem elas o envio falha sem
-- estragar nada (o aviso continua na APP e no Site).

alter table public.notification_preferences add column if not exists push boolean not null default true;

create table if not exists public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own_read on public.push_tokens;
create policy push_tokens_own_read on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

-- Envios à espera da resposta da Expo (para limpar telemóveis que já não existem).
create table if not exists public.push_sends (
  request_id bigint primary key,
  tokens text[] not null,
  created_at timestamptz not null default now()
);
alter table public.push_sends enable row level security;
revoke all on public.push_sends from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t text := trim(coalesce(p_token, ''));
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if t !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'INVALID_INPUT'; end if;
  insert into public.push_tokens(token, user_id, platform) values (t, me, case when p_platform in ('android', 'ios', 'web') then p_platform else 'android' end)
  on conflict (token) do update set user_id = me, platform = excluded.platform, updated_at = now();
  -- No máximo 10 telemóveis por pessoa (ficam os mais recentes).
  delete from public.push_tokens where user_id = me and token in (
    select token from public.push_tokens where user_id = me order by updated_at desc offset 10);
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = trim(coalesce(p_token, '')) and user_id = auth.uid();
$$;

create or replace function public.set_push_notifications(p_enabled boolean)
returns public.notification_preferences language plpgsql security definer set search_path = public as $$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.notification_preferences as np(user_id, push, updated_at) values (auth.uid(), coalesce(p_enabled, true), now())
  on conflict (user_id) do update set push = excluded.push, updated_at = now()
  returning * into r;
  return r;
end $$;

revoke all on function public.register_push_token(text, text), public.unregister_push_token(text), public.set_push_notifications(boolean) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text), public.set_push_notifications(boolean) to authenticated;

-- Cada aviso novo segue para os telemóveis da pessoa (nunca impede o aviso de ser guardado).
create or replace function public.send_push_for_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare toks text[]; msgs jsonb; rid bigint;
begin
  if exists (select 1 from public.notification_preferences p where p.user_id = new.user_id and (not p.push or not p.enabled)) then return new; end if;
  select array_agg(token order by updated_at desc) into toks from public.push_tokens where user_id = new.user_id;
  if toks is null then return new; end if;
  select jsonb_agg(jsonb_build_object(
      'to', tk, 'title', left(coalesce(new.title, 'Huambo Online'), 100), 'body', left(coalesce(new.body, ''), 180),
      'sound', 'default', 'channelId', 'default', 'priority', 'high',
      'data', coalesce(case when jsonb_typeof(new.data) = 'object' then new.data end, '{}'::jsonb)
              || jsonb_build_object('notification_id', new.id, 'type', new.type, 'title', new.title)))
    into msgs from unnest(toks) tk;
  select net.http_post(url := 'https://exp.host/--/api/v2/push/send', body := msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb, timeout_milliseconds := 10000) into rid;
  insert into public.push_sends(request_id, tokens) values (rid, toks) on conflict do nothing;
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.send_push_for_notification() from public, anon, authenticated;
drop trigger if exists zz_send_push on public.notifications;
create trigger zz_send_push after insert on public.notifications for each row execute function public.send_push_for_notification();

-- Limpeza: lê as respostas da Expo e retira os telemóveis que já não existem.
create or replace function public.push_cleanup()
returns void language plpgsql security definer set search_path = public as $$
declare s record; tk jsonb; i int; arr jsonb;
begin
  for s in select ps.request_id, ps.tokens, h.status_code, h.content from public.push_sends ps join net._http_response h on h.id = ps.request_id loop
    begin
      if s.status_code = 200 then
        arr := coalesce(s.content::jsonb -> 'data', '[]'::jsonb);
        i := 0;
        for tk in select value from jsonb_array_elements(case when jsonb_typeof(arr) = 'array' then arr else '[]'::jsonb end) loop
          i := i + 1;
          if tk ->> 'status' = 'error' and tk -> 'details' ->> 'error' = 'DeviceNotRegistered' then
            delete from public.push_tokens where token = s.tokens[i];
          end if;
        end loop;
      end if;
    exception when others then null;
    end;
    delete from public.push_sends where request_id = s.request_id;
  end loop;
  delete from public.push_sends where created_at < now() - interval '1 day';
end $$;
revoke all on function public.push_cleanup() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'huambo-online-push-cleanup') then perform cron.unschedule('huambo-online-push-cleanup'); end if;
  perform cron.schedule('huambo-online-push-cleanup', '*/15 * * * *', 'select public.push_cleanup()');
end $$;
