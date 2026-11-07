-- APP 0.5.3: aviso «Baixou de preço», pontos do mapa, erros e uso da APP (para a equipa).

-- 1) «📉 Baixou de preço» para quem guardou o anúncio ou o produto.
alter table public.notification_preferences add column if not exists price_drop boolean not null default true;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check CHECK (type = ANY (ARRAY['order','auction','bid','message','delivery','review','system','saved_search','interests','price_drop']));

create or replace function public.apply_notification_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.notification_preferences;
begin
  select * into p from public.notification_preferences where user_id = new.user_id;
  if not found then return new; end if;
  if not p.enabled then return null; end if;
  if (new.type = 'saved_search' and not p.saved_search) or (new.type = 'message' and not p.messages)
     or (new.type in ('auction','bid') and not p.auctions) or (new.type in ('order','delivery') and not p.marketplace)
     or (new.type = 'review' and not p.reviews) or (new.type = 'system' and not p.system)
     or (new.type = 'interests' and p.interests_frequency = 'off')
     or (new.type = 'price_drop' and not p.price_drop) then
    return null;
  end if;
  return new;
end $$;

create or replace function public.set_price_drop_notifications(p_enabled boolean)
returns public.notification_preferences language plpgsql security definer set search_path = public as $$
declare v public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.notification_preferences(user_id, price_drop) values (auth.uid(), coalesce(p_enabled, true))
  on conflict (user_id) do update set price_drop = excluded.price_drop, updated_at = now()
  returning * into v;
  return v;
end $$;
revoke all on function public.set_price_drop_notifications(boolean) from public, anon;
grant execute on function public.set_price_drop_notifications(boolean) to authenticated;

create or replace function public.money_label(p numeric, cur text)
returns text language sql immutable set search_path = public as $$
  select replace(to_char(round(p), 'FM999G999G999G999'), ',', ' ') || ' ' || case when coalesce(cur, 'AOA') = 'AOA' then 'Kz' else cur end
$$;

create or replace function public.notify_price_drop()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text := tg_argv[0]; v_title text; v_owner uuid; v_live boolean; v_col text;
begin
  if new.price is null or old.price is null or old.price <= 0 or new.price <= 0 or new.price >= old.price * 0.99 then return new; end if;
  if v_kind = 'listing' then v_title := new.title; v_owner := new.owner_id; v_live := new.status = 'published'; v_col := 'listing_id';
  else v_title := new.name; v_owner := new.seller_id; v_live := new.active; v_col := 'product_id'; end if;
  if not v_live then return new; end if;
  insert into public.notifications(user_id, type, title, body, data)
  select s.user_id, 'price_drop', '📉 Baixou de preço',
         left('«' || v_title || '» passou de ' || public.money_label(old.price, new.currency) || ' para ' || public.money_label(new.price, new.currency) || '.', 300),
         jsonb_build_object('for', 'price_drop', v_col, new.id, 'old_price', old.price, 'new_price', new.price)
  from public.saved_items s
  where (case when v_kind = 'listing' then s.classified_listing_id else s.product_id end) = new.id
    and s.user_id is distinct from v_owner
    and not exists (select 1 from public.notifications n where n.user_id = s.user_id and n.type = 'price_drop'
                    and n.data ->> v_col = new.id::text and n.created_at > now() - interval '24 hours');
  return new;
exception when others then
  return new; -- o aviso nunca impede a mudança de preço
end $$;
revoke all on function public.notify_price_drop() from public, anon, authenticated;
drop trigger if exists price_drop_listing on public.classified_listings;
create trigger price_drop_listing after update of price on public.classified_listings for each row execute function public.notify_price_drop('listing');
drop trigger if exists price_drop_product on public.products;
create trigger price_drop_product after update of price on public.products for each row execute function public.notify_price_drop('product');

-- 2) Mapa: pontos públicos. Anúncios com o ponto arredondado (≈100 m) para proteger a morada.
create or replace function public.map_points(p_kind text default null)
returns table(kind text, id uuid, title text, subtitle text, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  (select 'listing', l.id, l.title, public.money_label(l.price, l.currency), round(l.geo_lat::numeric, 3)::float8, round(l.geo_lng::numeric, 3)::float8
     from public.classified_listings l where l.status = 'published' and l.geo_lat is not null and l.geo_lng is not null and (p_kind is null or p_kind = 'listing') order by l.created_at desc limit 400)
  union all
  (select 'business', b.id, b.name, null, b.geo_lat::float8, b.geo_lng::float8
     from public.businesses b where b.active and b.geo_lat is not null and b.geo_lng is not null and (p_kind is null or p_kind = 'business') limit 400)
  union all
  (select 'provider', p.user_id, p.display_name, null, p.geo_lat::float8, p.geo_lng::float8
     from public.provider_profiles p where p.active and p.geo_lat is not null and p.geo_lng is not null and (p_kind is null or p_kind = 'provider') limit 400)
  union all
  (select 'fuel', f.id, f.name, null, f.geo_lat::float8, f.geo_lng::float8
     from public.fuel_stations f where f.status = 'approved' and f.geo_lat is not null and f.geo_lng is not null and (p_kind is null or p_kind = 'fuel') limit 200)
  union all
  (select 'event', e.id, e.title, to_char(e.starts_at at time zone 'Africa/Luanda', 'DD/MM HH24:MI'), e.geo_lat::float8, e.geo_lng::float8
     from public.events e where e.status = 'published' and coalesce(e.ends_at, e.starts_at) > now() and e.geo_lat is not null and e.geo_lng is not null and (p_kind is null or p_kind = 'event') limit 200)
$$;
revoke all on function public.map_points(text) from public;
grant execute on function public.map_points(text) to anon, authenticated;

-- 3) Erros da APP: agrupados por dia e por erro, para a equipa saber o que falha.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  day date not null default (now() at time zone 'Africa/Luanda')::date,
  fingerprint text not null,
  message text not null,
  stack text,
  screen text,
  app_version text,
  platform text,
  fatal boolean not null default false,
  count int not null default 1,
  users int not null default 1,
  last_user uuid,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  unique (day, fingerprint)
);
alter table public.app_errors enable row level security;
revoke all on table public.app_errors from anon, authenticated;

create or replace function public.log_app_error(p_message text, p_stack text default null, p_screen text default null, p_version text default null, p_platform text default null, p_fatal boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Africa/Luanda')::date; v_msg text := left(coalesce(nullif(trim(p_message), ''), 'Erro'), 500); v_fp text;
begin
  if (select count(*) from public.app_errors where day = v_day) >= 2000 then return; end if; -- limite diário
  v_fp := md5(v_msg || '|' || coalesce(left(p_stack, 300), '') || '|' || coalesce(p_version, ''));
  insert into public.app_errors(day, fingerprint, message, stack, screen, app_version, platform, fatal, last_user)
  values (v_day, v_fp, v_msg, left(p_stack, 4000), left(p_screen, 200), left(p_version, 20), left(p_platform, 20), coalesce(p_fatal, false), auth.uid())
  on conflict (day, fingerprint) do update set
    count = least(public.app_errors.count + 1, 1000000), last_at = now(), screen = coalesce(excluded.screen, public.app_errors.screen),
    fatal = public.app_errors.fatal or excluded.fatal,
    users = public.app_errors.users + case when excluded.last_user is distinct from public.app_errors.last_user then 1 else 0 end,
    last_user = coalesce(excluded.last_user, public.app_errors.last_user);
end $$;
revoke all on function public.log_app_error(text, text, text, text, text, boolean) from public;
grant execute on function public.log_app_error(text, text, text, text, text, boolean) to anon, authenticated;

-- 4) Uso da APP: só contagens por ecrã e por dia (sem saber quem).
create table if not exists public.app_screen_views (
  day date not null,
  screen text not null,
  views int not null default 0,
  primary key (day, screen)
);
alter table public.app_screen_views enable row level security;
revoke all on table public.app_screen_views from anon, authenticated;

create or replace function public.track_app_screens(p_counts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Africa/Luanda')::date; r record; n int := 0;
begin
  if jsonb_typeof(p_counts) <> 'object' then return; end if;
  for r in select key, value from jsonb_each(p_counts) loop
    n := n + 1; exit when n > 60;
    continue when r.key !~ '^/[A-Za-z0-9_/\[\]-]{0,80}$' or jsonb_typeof(r.value) <> 'number';
    insert into public.app_screen_views(day, screen, views) values (v_day, r.key, greatest(1, least((r.value)::text::int, 200)))
    on conflict (day, screen) do update set views = public.app_screen_views.views + excluded.views;
  end loop;
end $$;
revoke all on function public.track_app_screens(jsonb) from public;
grant execute on function public.track_app_screens(jsonb) to anon, authenticated;

create or replace function public.admin_app_health(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from date := (now() at time zone 'Africa/Luanda')::date - greatest(0, least(coalesce(p_days, 7), 90)) + 1;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'errors', coalesce((select jsonb_agg(x order by x.total desc) from (
        select fingerprint, max(message) message, max(stack) stack, max(screen) screen, max(app_version) app_version, bool_or(fatal) fatal,
               sum(count)::int total, sum(users)::int users, max(last_at) last_at
        from public.app_errors where day >= v_from group by fingerprint order by sum(count) desc limit 50) x), '[]'::jsonb),
    'screens', coalesce((select jsonb_agg(x order by x.views desc) from (
        select screen, sum(views)::int views from public.app_screen_views where day >= v_from group by screen order by sum(views) desc limit 40) x), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(x order by x.day) from (
        select d.day, coalesce((select sum(views) from public.app_screen_views v where v.day = d.day), 0)::int views,
               coalesce((select sum(count) from public.app_errors e where e.day = d.day), 0)::int errors
        from generate_series(v_from, (now() at time zone 'Africa/Luanda')::date, interval '1 day') d(day)) x), '[]'::jsonb));
end $$;
revoke all on function public.admin_app_health(int) from public, anon;
grant execute on function public.admin_app_health(int) to authenticated;

-- Limpeza: guardar 90 dias.
do $$ begin
  perform cron.unschedule('app_health_cleanup') where exists (select 1 from cron.job where jobname = 'app_health_cleanup');
  perform cron.schedule('app_health_cleanup', '17 3 * * *', $c$delete from public.app_errors where day < current_date - 90; delete from public.app_screen_views where day < current_date - 90;$c$);
end $$;
