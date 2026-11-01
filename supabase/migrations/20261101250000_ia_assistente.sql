-- Mais inteligência artificial (OpenAI gpt-4o-mini, através das Edge Functions «ai-assist» e «ai-triage»):
--   • limites diários por pessoa e por função (ai_usage / consume_ai)
--   • triagem automática dos anúncios novos ou alterados (listing_ai_reviews): a IA só assinala,
--     quem decide é a equipa
--   • traduções guardadas dos anúncios (listing_translations), feitas uma vez por idioma
--   • ajuda no preço (price_hint), sem IA: preços de anúncios parecidos dos últimos 6 meses

-- ---------------------------------------------------------------------------------------------
-- Limites diários
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  feature text not null,
  count integer not null default 0,
  primary key (user_id, day, feature)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public, anon, authenticated;
grant select on public.ai_usage to authenticated;
create policy ai_usage_own_read on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

/** Quantos usos por dia cada função permite (null = função desconhecida). */
create or replace function public.ai_feature_limit(p_feature text)
 returns integer
 language sql
 immutable
as $function$
  select case p_feature
    when 'photo_fill' then 15
    when 'smart_search' then 30
    when 'help' then 30
    when 'staff_reply' then 300
    when 'dispute_summary' then 100
  end
$function$;

/** Gasta um uso da função de IA indicada; devolve quantos restam hoje. */
create or replace function public.consume_ai(p_feature text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare lim int := public.ai_feature_limit(p_feature); n int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if lim is null then raise exception 'INVALID_INPUT'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_feature in ('staff_reply', 'dispute_summary') and not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  insert into public.ai_usage(user_id, day, feature, count) values (auth.uid(), current_date, p_feature, 1)
  on conflict (user_id, day, feature) do update set count = ai_usage.count + 1
  returning count into n;
  if n > lim then raise exception 'AI_LIMIT'; end if;
  return lim - n;
end $function$;
revoke all on function public.consume_ai(text) from public, anon;
grant execute on function public.consume_ai(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Triagem automática de anúncios
create table if not exists public.listing_ai_reviews (
  listing_id uuid primary key references public.classified_listings(id) on delete cascade,
  source_hash text not null,
  risk text not null check (risk in ('ok', 'attention', 'high')),
  reasons text[] not null default '{}',
  suggested_category text,
  summary text,
  checked_at timestamptz not null default now(),
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null
);
create index if not exists listing_ai_reviews_open_idx on public.listing_ai_reviews (checked_at desc) where risk <> 'ok' and dismissed_at is null;
alter table public.listing_ai_reviews enable row level security;
revoke all on public.listing_ai_reviews from public, anon, authenticated;
grant select on public.listing_ai_reviews to authenticated;
create policy listing_ai_reviews_staff_read on public.listing_ai_reviews for select to authenticated using (public.has_admin_role());

/** Impressão digital do que a IA analisa (só volta a analisar se o texto ou o preço mudarem). */
create or replace function public.listing_ai_hash(l public.classified_listings)
 returns text
 language sql
 immutable
as $function$
  select md5(coalesce(l.title, '') || '|' || coalesce(l.description, '') || '|' || coalesce(l.price::text, '') || '|' || coalesce(l.category_id::text, '') || '|' || coalesce(l.attributes::text, ''))
$function$;

/** Anúncios publicados nos últimos 7 dias que ainda não foram analisados (ou mudaram). Só o servidor. */
create or replace function public.ai_triage_queue(p_limit integer default 15)
 returns table(id uuid, source_hash text, title text, description text, price numeric, listing_type text, purpose text,
               category_name text, category_slug text, attributes jsonb, owner_created_at timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select l.id, public.listing_ai_hash(l), l.title, l.description, l.price, l.listing_type, l.purpose,
         c.name, c.slug, l.attributes, u.created_at
  from public.classified_listings l
  left join public.categories c on c.id = l.category_id
  left join auth.users u on u.id = l.owner_id
  left join public.listing_ai_reviews r on r.listing_id = l.id
  where l.status = 'published' and l.updated_at > now() - interval '7 days'
    and (r.listing_id is null or r.source_hash <> public.listing_ai_hash(l))
  order by l.updated_at
  limit greatest(1, least(coalesce(p_limit, 15), 30))
$function$;
revoke all on function public.ai_triage_queue(integer) from public, anon, authenticated;
grant execute on function public.ai_triage_queue(integer) to service_role;

/** Guarda o resultado da IA; risco alto avisa a equipa. Só o servidor. */
create or replace function public.ai_save_review(p_listing_id uuid, p_source_hash text, p_risk text, p_reasons text[], p_suggested_category text, p_summary text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t text; ref bigint; was_high boolean;
begin
  if p_risk not in ('ok', 'attention', 'high') then raise exception 'INVALID_INPUT'; end if;
  select risk = 'high' and dismissed_at is null into was_high from public.listing_ai_reviews where listing_id = p_listing_id;
  insert into public.listing_ai_reviews(listing_id, source_hash, risk, reasons, suggested_category, summary, checked_at)
  values (p_listing_id, p_source_hash, p_risk, coalesce(p_reasons[1:6], '{}'), left(p_suggested_category, 80), left(p_summary, 500), now())
  on conflict (listing_id) do update set source_hash = excluded.source_hash, risk = excluded.risk, reasons = excluded.reasons,
    suggested_category = excluded.suggested_category, summary = excluded.summary, checked_at = now(), dismissed_at = null, dismissed_by = null;
  if p_risk = 'high' and not coalesce(was_high, false) then
    select title, ref_no into t, ref from public.classified_listings where id = p_listing_id;
    perform public.notify_staff('🤖 Anúncio suspeito', coalesce('#' || ref || ' · ', '') || coalesce(t, ''),
      jsonb_build_object('kind', 'ai_flag', 'listing_id', p_listing_id));
  end if;
end $function$;
revoke all on function public.ai_save_review(uuid, text, text, text[], text, text) from public, anon, authenticated;
grant execute on function public.ai_save_review(uuid, text, text, text[], text, text) to service_role;

/** Anúncios que a IA assinalou e a equipa ainda não viu. */
create or replace function public.admin_list_ai_flags(p_limit integer default 50)
 returns table(listing_id uuid, ref_no bigint, title text, status text, owner_id uuid, owner_name text, price numeric,
               risk text, reasons text[], suggested_category text, summary text, checked_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.listing_id, l.ref_no, l.title, l.status, l.owner_id, p.full_name, l.price, r.risk, r.reasons, r.suggested_category, r.summary, r.checked_at
  from public.listing_ai_reviews r
  join public.classified_listings l on l.id = r.listing_id
  left join public.profiles p on p.id = l.owner_id
  where r.risk <> 'ok' and r.dismissed_at is null
  order by (r.risk = 'high') desc, r.checked_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end $function$;
revoke all on function public.admin_list_ai_flags(integer) from public, anon;
grant execute on function public.admin_list_ai_flags(integer) to authenticated;

/** A equipa viu o aviso (o anúncio fica como está, ou foi tratado à parte). */
create or replace function public.admin_dismiss_ai_flag(p_listing_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.listing_ai_reviews set dismissed_at = now(), dismissed_by = auth.uid() where listing_id = p_listing_id;
end $function$;
revoke all on function public.admin_dismiss_ai_flag(uuid) from public, anon;
grant execute on function public.admin_dismiss_ai_flag(uuid) to authenticated;

-- A cada 10 minutos o servidor pede à função «ai-triage» que analise os anúncios em fila.
-- (A chave «anon» é pública — é a mesma do Site e da APP; a função só trabalha sobre a fila.)
select cron.schedule('huambo-online-ai-triage', '*/10 * * * *', $$
  select net.http_post('https://pewymvkowbdizdiyjmao.supabase.co/functions/v1/ai-triage', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld3ltdmtvd2JkaXpkaXlqbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0OTg4MTYsImV4cCI6MjEwOTA3NDgxNn0.Lo8I9suwa7uqAub4UYmdeasDpHTvePAU23SI7rL43wk'),
    20000)
  where exists (select 1 from public.ai_triage_queue(1))
$$);

-- ---------------------------------------------------------------------------------------------
-- Traduções dos anúncios (em, zh), guardadas para não traduzir duas vezes
create table if not exists public.listing_translations (
  listing_id uuid not null references public.classified_listings(id) on delete cascade,
  lang text not null check (lang in ('en', 'zh', 'pt')),
  source_hash text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  primary key (listing_id, lang)
);
alter table public.listing_translations enable row level security;
revoke all on public.listing_translations from public, anon, authenticated;
grant select on public.listing_translations to anon, authenticated;
create policy listing_translations_public_read on public.listing_translations for select to anon, authenticated
  using (exists (select 1 from public.classified_listings l where l.id = listing_id and l.status in ('published', 'sold', 'rented')));

/** Impressão digital do texto a traduzir (a tradução é refeita se o título ou a descrição mudarem). */
create or replace function public.listing_text_hash(p_listing_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select md5(coalesce(title, '') || '|' || coalesce(description, '')) from public.classified_listings
  where id = p_listing_id and status in ('published', 'sold', 'rented')
$function$;
revoke all on function public.listing_text_hash(uuid) from public;
grant execute on function public.listing_text_hash(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Ajuda no preço (sem IA)
/** Preços de anúncios parecidos (mesmo tipo, finalidade e categoria) dos últimos 6 meses. Precisa de 3 ou mais. */
create or replace function public.price_hint(p_category_id uuid, p_listing_type text, p_purpose text default 'sale')
 returns table(samples integer, low numeric, median numeric, high numeric)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with s as (
    select l.price from public.classified_listings l
    where l.price > 0 and l.status in ('published', 'sold', 'rented', 'closed')
      and l.created_at > now() - interval '180 days'
      and l.listing_type = p_listing_type
      and l.purpose = coalesce(nullif(p_purpose, ''), 'sale')
      and (p_category_id is null or l.category_id = p_category_id)
  )
  select count(*)::int,
         round(percentile_cont(0.25) within group (order by price)::numeric, -2),
         round(percentile_cont(0.5) within group (order by price)::numeric, -2),
         round(percentile_cont(0.75) within group (order by price)::numeric, -2)
  from s
  having count(*) >= 3
$function$;
revoke all on function public.price_hint(uuid, text, text) from public;
grant execute on function public.price_hint(uuid, text, text) to anon, authenticated;

-- Limpeza: usos de IA com mais de 30 dias.
select cron.schedule('huambo-online-ai-usage-cleanup', '23 3 * * *',
  $$delete from public.ai_usage where day < current_date - 30; delete from public.ai_writer_usage where day < current_date - 30$$);
