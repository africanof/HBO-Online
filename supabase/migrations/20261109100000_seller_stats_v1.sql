-- Estatísticas para vendedores, lojas, empresas e profissionais (igual no Site e na APP).
-- Conta, por dia (hora de Angola), quantas vezes cada anúncio / produto / empresa / perfil foi visto e quantas
-- vezes carregaram em WhatsApp, Ligar ou Partilhar. Não guarda QUEM viu: só números.
-- As visitas do próprio dono não contam. O Site e a APP só contam uma vista por aparelho por dia.

create table if not exists public.item_stats_daily (
  kind text not null check (kind in ('listing', 'product', 'business', 'provider')),
  item_id uuid not null,
  day date not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  views integer not null default 0,
  whatsapp integer not null default 0,
  calls integer not null default 0,
  shares integer not null default 0,
  primary key (kind, item_id, day)
);
create index if not exists item_stats_daily_owner_idx on public.item_stats_daily(owner_id, day);
alter table public.item_stats_daily enable row level security;
-- Sem políticas: só se lê e escreve pelas funções abaixo.
revoke all on public.item_stats_daily from public, anon, authenticated;

create or replace function public.angola_today() returns date
language sql stable set search_path = public as $$ select (now() at time zone 'Africa/Luanda')::date $$;

-- Regista uma vista ou um clique. Pode ser chamada sem sessão (visitantes também contam).
create or replace function public.record_item_event(p_kind text, p_id uuid, p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if p_event not in ('view', 'whatsapp', 'call', 'share') then return; end if;
  if p_kind = 'listing' then select owner_id into v_owner from public.classified_listings where id = p_id and status = 'published';
  elsif p_kind = 'product' then select seller_id into v_owner from public.products where id = p_id and active;
  elsif p_kind = 'business' then select owner_id into v_owner from public.businesses where id = p_id and active;
  elsif p_kind = 'provider' then select user_id into v_owner from public.provider_profiles where user_id = p_id and active;
  else return; end if;
  if v_owner is null or v_owner = auth.uid() then return; end if;
  insert into public.item_stats_daily as s (kind, item_id, day, owner_id, views, whatsapp, calls, shares)
  values (p_kind, p_id, public.angola_today(), v_owner,
    (p_event = 'view')::int, (p_event = 'whatsapp')::int, (p_event = 'call')::int, (p_event = 'share')::int)
  on conflict (kind, item_id, day) do update set
    views = s.views + excluded.views, whatsapp = s.whatsapp + excluded.whatsapp,
    calls = s.calls + excluded.calls, shares = s.shares + excluded.shares, owner_id = excluded.owner_id;
end $$;

-- Tudo o que é meu (anúncios, produtos, empresas, perfil profissional), com os números dos últimos p_days dias.
create or replace function public.my_item_stats(p_days integer default 30)
returns table (kind text, item_id uuid, title text, status text, created_at timestamptz,
  views bigint, views_total bigint, whatsapp bigint, calls bigint, shares bigint,
  saves bigint, messages bigint, offers bigint, orders bigint, followers bigint)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); d integer := least(greatest(coalesce(p_days, 30), 1), 365); since date; since_ts timestamptz;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  since := public.angola_today() - (d - 1);
  since_ts := (since::timestamp at time zone 'Africa/Luanda');
  return query
  with items as (
    select 'listing'::text k, l.id, l.title::text t, l.status::text st, l.created_at c from public.classified_listings l
      where l.owner_id = me and l.status not in ('draft', 'cancelled')
    union all select 'product', p.id, p.name, case when p.active then 'active' else 'inactive' end, p.created_at from public.products p where p.seller_id = me
    union all select 'business', b.id, b.name, case when b.active then 'active' else 'inactive' end, b.created_at from public.businesses b where b.owner_id = me
    union all select 'provider', pp.user_id, pp.display_name, case when pp.active then 'active' else 'inactive' end, pp.created_at from public.provider_profiles pp where pp.user_id = me
  )
  select i.k, i.id, i.t, i.st, i.c,
    coalesce(sum(s.views) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.views), 0)::bigint,
    coalesce(sum(s.whatsapp) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.calls) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.shares) filter (where s.day >= since), 0)::bigint,
    (select count(*) from public.saved_items si where case i.k when 'listing' then si.classified_listing_id when 'product' then si.product_id
       when 'business' then si.business_id else si.provider_id end = i.id),
    (select count(*) from public.conversations cv where cv.created_at >= since_ts and cv.created_by <> me and case i.k when 'listing' then cv.classified_listing_id
       when 'product' then cv.product_id when 'business' then cv.business_id else cv.provider_id end = i.id),
    case when i.k = 'listing' then (select count(*) from public.listing_offers o where o.listing_id = i.id and o.created_at >= since_ts) else 0 end,
    case when i.k = 'product' then (select count(distinct oi.order_id) from public.order_items oi where oi.product_id = i.id and oi.created_at >= since_ts)
         when i.k = 'provider' then (select count(*) from public.service_requests r where r.provider_id = i.id and r.business_id is null and r.created_at >= since_ts)
         when i.k = 'business' then (select count(*) from public.service_requests r where r.business_id = i.id and r.created_at >= since_ts) else 0 end,
    case when i.k = 'business' then (select count(*) from public.followed_businesses f where f.business_id = i.id)
         when i.k = 'provider' then (select count(*) from public.followed_providers f where f.provider_id = i.id) else 0 end
  from items i
  left join public.item_stats_daily s on s.kind = i.k and s.item_id = i.id
  group by i.k, i.id, i.t, i.st, i.c;
end $$;

-- Totais por dia (para o gráfico): vistas e contactos (mensagens + WhatsApp + chamadas).
create or replace function public.my_stats_daily(p_days integer default 30)
returns table (day date, views bigint, contacts bigint)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); d integer := least(greatest(coalesce(p_days, 30), 1), 365); since date;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  since := public.angola_today() - (d - 1);
  return query
  with days as (select g::date dd from generate_series(since, public.angola_today(), interval '1 day') g),
  ev as (select s.day dd, sum(s.views) v, sum(s.whatsapp + s.calls) c from public.item_stats_daily s where s.owner_id = me and s.day >= since group by s.day),
  mine as (
    select l.id from public.classified_listings l where l.owner_id = me
    union all select p.id from public.products p where p.seller_id = me
    union all select b.id from public.businesses b where b.owner_id = me
    union all select me),
  msg as (select (cv.created_at at time zone 'Africa/Luanda')::date dd, count(*) c from public.conversations cv
    where cv.created_by <> me and cv.created_at >= (since::timestamp at time zone 'Africa/Luanda')
      and coalesce(cv.classified_listing_id, cv.product_id, cv.business_id, cv.provider_id) in (select id from mine)
    group by 1)
  select days.dd, coalesce(ev.v, 0)::bigint, (coalesce(ev.c, 0) + coalesce(msg.c, 0))::bigint
  from days left join ev on ev.dd = days.dd left join msg on msg.dd = days.dd order by days.dd;
end $$;

-- Seguidores do vendedor (perfil «seller»).
create or replace function public.my_follower_count() returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.followed_sellers where seller_id = auth.uid()
$$;

revoke all on function public.angola_today() from public;
grant execute on function public.angola_today() to anon, authenticated;
revoke all on function public.record_item_event(text, uuid, text) from public;
grant execute on function public.record_item_event(text, uuid, text) to anon, authenticated;
revoke all on function public.my_item_stats(integer) from public, anon;
grant execute on function public.my_item_stats(integer) to authenticated;
revoke all on function public.my_stats_daily(integer) from public, anon;
grant execute on function public.my_stats_daily(integer) to authenticated;
revoke all on function public.my_follower_count() from public, anon;
grant execute on function public.my_follower_count() to authenticated;
