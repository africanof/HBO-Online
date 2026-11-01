-- Fila de tarefas: os avisos em massa (pesquisas guardadas, «Procura-se», seguidores, aviso de combustível)
-- saem da transação de quem publica. O gatilho só guarda uma tarefa pequena; a fila é tratada a cada 30 s (pg_cron).
-- Se uma tarefa falhar, tenta de novo mais tarde (até 5 vezes) sem estragar a publicação.

create table if not exists public.job_queue (
  id bigserial primary key,
  kind text not null check (kind in ('saved_search', 'wanted', 'follow_listing', 'follow_product', 'follow_portfolio', 'fuel_alert')),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  done_at timestamptz
);
create unique index if not exists job_queue_pending_unique on public.job_queue(kind, ref_id) where done_at is null;
create index if not exists job_queue_pending on public.job_queue(run_after, id) where done_at is null;
alter table public.job_queue enable row level security;
revoke all on public.job_queue from anon, authenticated;

create or replace function public.enqueue_job(p_kind text, p_ref uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.job_queue(kind, ref_id) values (p_kind, p_ref) on conflict (kind, ref_id) where done_at is null do nothing
$$;

-- Os gatilhos passam a só guardar a tarefa (resposta imediata para quem publica).
create or replace function public.notify_classified_saved_searches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('saved_search', new.id); end if;
  return new;
end $$;
create or replace function public.notify_wanted_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.purpose = 'wanted' and new.status = 'published' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('wanted', new.id); end if;
  return new;
end $$;
create or replace function public.follow_notify_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and new.purpose <> 'wanted' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('follow_listing', new.id); end if;
  return new;
end $$;
create or replace function public.follow_notify_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active and not (tg_op = 'UPDATE' and old.active) then perform public.enqueue_job('follow_product', new.id); end if;
  return new;
end $$;
create or replace function public.follow_notify_portfolio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_job('follow_portfolio', new.id);
  return new;
end $$;
create or replace function public.fuel_product_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  if tg_op = 'UPDATE' and (new.status, new.price, new.queue, new.reservable_qty, new.note, new.max_per_order) is not distinct from (old.status, old.price, old.queue, old.reservable_qty, old.note, old.max_per_order) then return new; end if;
  new.updated_at := now();
  if new.status in ('available', 'low') and (tg_op = 'INSERT' or old.status in ('out', 'unknown')) then perform public.enqueue_job('fuel_alert', new.id); end if;
  return new;
end $$;

-- O trabalho pesado (igual ao de antes), feito pela fila. Cada função confirma que ainda faz sentido (ex.: o anúncio continua publicado).
create or replace function public.job_saved_search(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; s record;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.status <> 'published' then return; end if;
  for s in select id, user_id, name, coalesce(notification_frequency, 'immediate') frequency from public.classified_saved_searches
    where active = true and user_id <> l.owner_id and (notification_quiet_until is null or notification_quiet_until <= now())
      and public.classified_saved_search_matches_listing(filters, l) loop
    if s.frequency = 'daily' then
      insert into public.saved_search_notification_queue(saved_search_id, user_id, listing_id) values (s.id, s.user_id, l.id) on conflict do nothing;
    else
      insert into public.notifications(user_id, type, title, body, data)
      values (s.user_id, 'saved_search', 'Novo anúncio encontrado', 'Um novo anúncio corresponde à sua pesquisa guardada "' || s.name || '".',
        jsonb_build_object('saved_search_id', s.id, 'listing_id', l.id, 'listing_type', l.listing_type, 'purpose', l.purpose)) on conflict do nothing;
      if found then update public.classified_saved_searches set last_notified_at = now(), updated_at = now() where id = s.id; end if;
    end if;
  end loop;
end $$;

create or replace function public.job_wanted(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; words text[]; budget text;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.purpose <> 'wanted' or l.status <> 'published' then return; end if;
  words := public.wanted_keywords(l.title);
  if coalesce(array_length(words, 1), 0) = 0 then return; end if;
  budget := case
    when l.budget_min is not null and l.budget_max is not null then ' Orçamento: ' || l.budget_min || ' – ' || l.budget_max || ' Kz.'
    when l.budget_max is not null then ' Orçamento: até ' || l.budget_max || ' Kz.'
    when l.budget_min is not null then ' Orçamento: a partir de ' || l.budget_min || ' Kz.'
    else '' end;
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura o que vende', '«' || l.title || '».' || budget, jsonb_build_object('listing_id', l.id, 'for', 'wanted')
  from (
    select p.seller_id as uid from public.products p
     where p.active and p.seller_id <> l.owner_id and exists (select 1 from unnest(words) w where public.fold_text(p.name) like '%' || w || '%')
    union
    select x.owner_id from public.classified_listings x
     where x.status = 'published' and x.purpose in ('sale', 'rent', 'lease', 'auction') and x.owner_id <> l.owner_id
       and exists (select 1 from unnest(words) w where public.fold_text(x.title) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = l.id::text)
  limit 30;
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura os seus serviços', '«' || l.title || '».' || budget, jsonb_build_object('listing_id', l.id, 'for', 'wanted')
  from (
    select pp.user_id as uid from public.provider_profiles pp left join public.categories c on c.id = pp.category_id
     where pp.active and pp.user_id <> l.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, pp.custom_category, pp.headline, pp.display_name)) like '%' || w || '%'
       or exists (select 1 from public.services sv where sv.provider_id = pp.user_id and sv.active and public.fold_text(sv.title) like '%' || w || '%'))
    union
    select b.owner_id from public.businesses b left join public.categories c on c.id = b.category_id
     where b.active and b.owner_id <> l.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, b.custom_category, b.name, b.description)) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = l.id::text)
  limit 30;
end $$;

create or replace function public.job_follow_listing(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; who text;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.status <> 'published' or l.purpose = 'wanted' then return; end if;
  select coalesce(nullif(full_name, ''), 'Um vendedor que segue') into who from public.profiles where id = l.owner_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = l.owner_id), 'seller:' || l.owner_id,
    'Novo anúncio de ' || coalesce(who, 'um vendedor que segue'), l.title, jsonb_build_object('listing_id', l.id));
end $$;

create or replace function public.job_follow_product(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.products; who text;
begin
  select * into p from public.products where id = p_id;
  if not found or not p.active then return; end if;
  select coalesce((select name from public.businesses where id = p.business_id), nullif(full_name, ''), 'Uma loja que segue') into who from public.profiles where id = p.seller_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = p.seller_id
      union select user_id from public.followed_businesses where business_id = p.business_id),
    'seller:' || p.seller_id, 'Novo produto de ' || coalesce(who, 'uma loja que segue'), p.name, jsonb_build_object('product_id', p.id));
end $$;

create or replace function public.job_follow_portfolio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it public.portfolio_items; who text;
begin
  select * into it from public.portfolio_items where id = p_id;
  if not found then return; end if;
  if it.provider_id is not null then
    select display_name into who from public.provider_profiles where user_id = it.provider_id;
    perform public.notify_followers(array(select user_id from public.followed_providers where provider_id = it.provider_id), 'provider:' || it.provider_id,
      'Trabalho novo de ' || coalesce(who, 'um profissional que segue'), it.title, jsonb_build_object('provider_id', it.provider_id));
  else
    select name into who from public.businesses where id = it.business_id;
    perform public.notify_followers(array(select user_id from public.followed_businesses where business_id = it.business_id), 'business:' || it.business_id,
      'Novidade de ' || coalesce(who, 'uma empresa que segue'), it.title, jsonb_build_object('business_id', it.business_id));
  end if;
end $$;

create or replace function public.job_fuel_alert(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.fuel_products; s public.fuel_stations;
begin
  select * into p from public.fuel_products where id = p_id;
  if not found or p.status not in ('available', 'low') then return; end if;
  select * into s from public.fuel_stations where id = p.station_id;
  if s.status <> 'approved' then return; end if;
  if exists (select 1 from public.notifications n where n.data->>'for' = 'fuel' and n.data->>'product_id' = p.id::text and n.created_at > now() - interval '2 hours') then return; end if;
  insert into public.notifications(user_id, type, title, body, data)
  select distinct a.user_id, 'system', '⛽ Há ' || lower(public.fuel_product_label(p.product)) || '!',
    s.name || coalesce(' · ' || (select m.name from public.municipalities m where m.id = s.municipality_id), '') || case when p.price is not null then ' · ' || p.price || ' Kz' else '' end,
    jsonb_build_object('for', 'fuel', 'station_id', s.id, 'product_id', p.id)
  from public.fuel_alerts a
  where a.product = p.product and (a.municipality_id is null or a.municipality_id = s.municipality_id) and a.user_id <> s.owner_id
  limit 5000;
end $$;

-- Trabalhador da fila: apanha tarefas sem bloquear outros trabalhadores; cada tarefa é independente.
create or replace function public.process_job_queue(p_limit integer default 300) returns integer
language plpgsql security definer set search_path = public as $$
declare j public.job_queue; n integer := 0;
begin
  for j in select * from public.job_queue where done_at is null and run_after <= now() order by id limit greatest(1, least(p_limit, 2000)) for update skip locked loop
    begin
      case j.kind
        when 'saved_search' then perform public.job_saved_search(j.ref_id);
        when 'wanted' then perform public.job_wanted(j.ref_id);
        when 'follow_listing' then perform public.job_follow_listing(j.ref_id);
        when 'follow_product' then perform public.job_follow_product(j.ref_id);
        when 'follow_portfolio' then perform public.job_follow_portfolio(j.ref_id);
        when 'fuel_alert' then perform public.job_fuel_alert(j.ref_id);
      end case;
      update public.job_queue set done_at = now(), attempts = attempts + 1 where id = j.id;
      n := n + 1;
    exception when others then
      update public.job_queue set attempts = attempts + 1, last_error = left(sqlerrm, 500),
        run_after = now() + make_interval(mins => power(2, least(attempts, 6))::int),
        done_at = case when attempts + 1 >= 5 then now() end
      where id = j.id;
    end;
  end loop;
  return n;
end $$;

-- Estado da fila para a administração.
create or replace function public.admin_job_queue_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'pending', (select count(*) from public.job_queue where done_at is null),
    'oldest_pending_seconds', (select extract(epoch from now() - min(created_at))::int from public.job_queue where done_at is null),
    'done_last_hour', (select count(*) from public.job_queue where done_at > now() - interval '1 hour' and last_error is null),
    'failed', (select count(*) from public.job_queue where done_at is not null and last_error is not null and attempts >= 5));
end $$;

revoke all on function public.enqueue_job(text, uuid) from public, anon, authenticated;
revoke all on function public.job_saved_search(uuid) from public, anon, authenticated;
revoke all on function public.job_wanted(uuid) from public, anon, authenticated;
revoke all on function public.job_follow_listing(uuid) from public, anon, authenticated;
revoke all on function public.job_follow_product(uuid) from public, anon, authenticated;
revoke all on function public.job_follow_portfolio(uuid) from public, anon, authenticated;
revoke all on function public.job_fuel_alert(uuid) from public, anon, authenticated;
revoke all on function public.process_job_queue(integer) from public, anon, authenticated;
revoke all on function public.admin_job_queue_stats() from public, anon;
grant execute on function public.admin_job_queue_stats() to authenticated;

select cron.schedule('huambo-online-job-queue', '30 seconds', 'select public.process_job_queue(300)');

-- Limpeza diária das tarefas feitas há mais de 7 dias.
create or replace function public.job_queue_cleanup() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.job_queue where done_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.job_queue_cleanup() from public, anon, authenticated;
select cron.schedule('huambo-online-job-queue-cleanup', '41 3 * * *', 'select public.job_queue_cleanup()');
