-- «✨ Novidades para si»: avisos com anúncios novos de que cada pessoa pode gostar, a partir do que viu,
-- pesquisou e guardou nos últimos 30 dias (o mesmo histórico das recomendações).
--   • a base de dados escolhe por regras até 15 candidatos por pessoa (sem custo)
--   • a Edge Function «ai-interests» (OpenAI gpt-4o-mini) escolhe os que fazem mesmo sentido (até 5);
--     se a IA não escolher nenhum, não se envia nada; se a IA falhar, usam-se as regras
--   • opcional: «Diário», «Semanal» ou «Desligado» nas preferências de notificações
--   • no máximo um aviso por dia (ou por semana); se os 3 últimos ficaram por ler, pára até a pessoa ler

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check CHECK (type = ANY (ARRAY['order', 'auction', 'bid', 'message', 'delivery', 'review', 'system', 'saved_search', 'interests']));

alter table public.notification_preferences add column if not exists interests_frequency text not null default 'daily';
alter table public.notification_preferences drop constraint if exists notification_preferences_interests_frequency_check;
alter table public.notification_preferences add constraint notification_preferences_interests_frequency_check check (interests_frequency in ('off', 'daily', 'weekly'));

/** As preferências também valem para «Novidades para si». */
create or replace function public.apply_notification_preferences()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare p public.notification_preferences;
begin
  select * into p from public.notification_preferences where user_id = new.user_id;
  if not found then return new; end if;
  if not p.enabled then return null; end if;
  if (new.type = 'saved_search' and not p.saved_search) or (new.type = 'message' and not p.messages)
     or (new.type in ('auction','bid') and not p.auctions) or (new.type in ('order','delivery') and not p.marketplace)
     or (new.type = 'review' and not p.reviews) or (new.type = 'system' and not p.system)
     or (new.type = 'interests' and p.interests_frequency = 'off') then
    return null;
  end if;
  return new;
end $function$;

/** Escolhe a frequência de «Novidades para si»: off, daily ou weekly. */
create or replace function public.set_interest_notifications(p_frequency text)
 returns public.notification_preferences
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_frequency not in ('off', 'daily', 'weekly') then raise exception 'INVALID_INPUT'; end if;
  insert into public.notification_preferences as np(user_id, interests_frequency, updated_at) values (auth.uid(), p_frequency, now())
  on conflict (user_id) do update set interests_frequency = excluded.interests_frequency, updated_at = now()
  returning * into r;
  return r;
end $function$;
revoke all on function public.set_interest_notifications(text) from public, anon;
grant execute on function public.set_interest_notifications(text) to authenticated;

/** Anúncios já enviados a cada pessoa em «Novidades para si» (para não repetir). Apagados ao fim de 60 dias. */
create table if not exists public.interest_notified (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.classified_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists interest_notified_listing_idx on public.interest_notified (listing_id);
alter table public.interest_notified enable row level security;
revoke all on public.interest_notified from public, anon, authenticated;

/** Até 15 anúncios novos (desde p_since) ligados aos interesses da pessoa, do mais para o menos relevante. */
create or replace function public.interest_candidates(p_user uuid, p_since timestamptz)
 returns table(id uuid, title text, category text, listing_type text, purpose text, price numeric, relevance numeric)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with hist as (
    select i.*, case i.kind when 'save' then 3 when 'search' then 2 else 1 end as w
    from public.user_interests i where i.user_id = p_user and i.created_at > now() - interval '30 days'
  ),
  cats as (select category_id, sum(w) as score from hist where category_id is not null group by 1 order by 2 desc limit 3),
  types as (select listing_type, sum(w) as score from hist where listing_type is not null group by 1 order by 2 desc limit 1),
  terms as (select distinct on (query) query from (select query, created_at from hist where query is not null order by created_at desc limit 20) x limit 5),
  pool as (
    select l.*, (
        coalesce((select c.score from cats c where c.category_id = l.category_id), 0)
      + coalesce((select t.score from types t where t.listing_type = l.listing_type), 0) * 0.5
      + case when exists (select 1 from terms q where l.title ilike '%' || q.query || '%' or coalesce(l.description, '') ilike '%' || q.query || '%') then 4 else 0 end
    )::numeric as rel
    from public.classified_listings l
    where l.status = 'published' and l.purpose <> 'wanted' and l.owner_id <> p_user and l.created_at > p_since
      and not exists (select 1 from hist h where h.listing_id = l.id)
      and not exists (select 1 from public.interest_notified n where n.user_id = p_user and n.listing_id = l.id)
      and not exists (select 1 from public.saved_items s where s.user_id = p_user and s.classified_listing_id = l.id)
      and not exists (select 1 from public.saved_search_notification_queue q where q.user_id = p_user and q.listing_id = l.id)
  )
  select p.id, p.title, c.name, p.listing_type, p.purpose, p.price, p.rel
  from pool p left join public.categories c on c.id = p.category_id
  where p.rel >= 1
  order by p.rel desc, p.featured desc, p.created_at desc
  limit 15
$function$;
revoke all on function public.interest_candidates(uuid, timestamptz) from public, anon, authenticated;

/** Pessoas que devem receber «Novidades para si» agora, com o resumo dos interesses e os candidatos. */
create or replace function public.interest_digest_queue(p_limit integer default 100)
 returns table(user_id uuid, frequency text, interests jsonb, candidates jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare u record; since timestamptz; last_sent timestamptz; cands jsonb; n int := 0; lim int := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  for u in
    select distinct i.user_id as uid, coalesce(np.interests_frequency, 'daily') as freq
    from public.user_interests i
    join public.profiles pr on pr.id = i.user_id and pr.status = 'active'
    left join public.notification_preferences np on np.user_id = i.user_id
    where i.created_at > now() - interval '30 days'
      and coalesce(np.interests_frequency, 'daily') <> 'off' and coalesce(np.enabled, true)
  loop
    select max(created_at) into last_sent from public.notifications where notifications.user_id = u.uid and type = 'interests';
    if last_sent is not null and last_sent > now() - case when u.freq = 'weekly' then interval '6 days 12 hours' else interval '20 hours' end then continue; end if;
    -- Sem resposta: os 3 últimos avisos ficaram por ler → pausa até a pessoa ler um.
    if (select count(*) from (select read_at from public.notifications where notifications.user_id = u.uid and type = 'interests' order by created_at desc limit 3) x where x.read_at is null) >= 3 then continue; end if;
    since := greatest(coalesce(last_sent, '-infinity'), now() - case when u.freq = 'weekly' then interval '7 days' else interval '2 days' end);
    select coalesce(jsonb_agg(to_jsonb(c)), '[]') into cands from public.interest_candidates(u.uid, since) c;
    if jsonb_array_length(cands) = 0 then continue; end if;
    user_id := u.uid; frequency := u.freq; candidates := cands;
    interests := jsonb_build_object(
      'categories', (select coalesce(jsonb_agg(x.name), '[]') from (select c.name from public.user_interests i join public.categories c on c.id = i.category_id
                       where i.user_id = u.uid and i.created_at > now() - interval '30 days'
                       group by c.name order by sum(case i.kind when 'save' then 3 when 'search' then 2 else 1 end) desc limit 3) x),
      'searches', (select coalesce(jsonb_agg(x.query), '[]') from (select query from public.user_interests i where i.user_id = u.uid and i.query is not null
                       and i.created_at > now() - interval '30 days' group by query order by max(created_at) desc limit 8) x),
      'viewed', (select coalesce(jsonb_agg(x.title), '[]') from (select l.title from public.user_interests i join public.classified_listings l on l.id = i.listing_id
                       where i.user_id = u.uid and i.created_at > now() - interval '30 days' group by l.title order by max(i.created_at) desc limit 6) x));
    return next;
    n := n + 1; exit when n >= lim;
  end loop;
end $function$;
revoke all on function public.interest_digest_queue(integer) from public, anon, authenticated;
grant execute on function public.interest_digest_queue(integer) to service_role;

/** Envia o aviso «✨ Novidades para si» com os anúncios escolhidos (só aceita candidatos válidos). */
create or replace function public.send_interest_digest(p_user uuid, p_listing_ids uuid[])
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare ids uuid[]; first_title text; k int;
begin
  select array_agg(l.id order by array_position(p_listing_ids, l.id)) into ids
  from public.classified_listings l
  where l.id = any(p_listing_ids[1:5]) and l.status = 'published' and l.owner_id <> p_user
    and not exists (select 1 from public.interest_notified n where n.user_id = p_user and n.listing_id = l.id);
  k := coalesce(array_length(ids, 1), 0);
  if k = 0 then return false; end if;
  select title into first_title from public.classified_listings where id = ids[1];
  first_title := left(regexp_replace(first_title, '\s+', ' ', 'g'), 60);
  insert into public.notifications(user_id, type, title, body, data)
  values (p_user, 'interests', '✨ Novidades para si',
    case when k = 1 then 'Um anúncio novo de que pode gostar: ' || first_title
         else k || ' anúncios novos de que pode gostar, como ' || first_title || '.' end,
    jsonb_build_object('for', 'interests', 'digest', true, 'listing_ids', to_jsonb(ids), 'count', k));
  if not found then return false; end if; -- desligado nas preferências
  insert into public.interest_notified(user_id, listing_id) select p_user, x from unnest(ids) x on conflict do nothing;
  return true;
end $function$;
revoke all on function public.send_interest_digest(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.send_interest_digest(uuid, uuid[]) to service_role;

-- Todos os dias às 18:30, 19:30 e 20:30 (hora de Angola) o servidor pede à função «ai-interests» que
-- prepare os avisos (cada chamada trata até 100 pessoas; quem já recebeu sai da fila).
-- (A chave «anon» é pública — é a mesma do Site e da APP; a função só trabalha sobre a fila.)
select cron.schedule('huambo-online-ai-interests', '30 17,18,19 * * *', $$
  select net.http_post('https://pewymvkowbdizdiyjmao.supabase.co/functions/v1/ai-interests', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld3ltdmtvd2JkaXpkaXlqbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0OTg4MTYsImV4cCI6MjEwOTA3NDgxNn0.Lo8I9suwa7uqAub4UYmdeasDpHTvePAU23SI7rL43wk'),
    120000)
$$);

-- Limpeza: anúncios já enviados há mais de 60 dias.
select cron.schedule('huambo-online-interests-notified-cleanup', '41 3 * * *',
  $$delete from public.interest_notified where created_at < now() - interval '60 days'$$);
