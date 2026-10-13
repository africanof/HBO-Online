-- Seguir profissionais, empresas e lojas/vendedores (igual no Site e na APP).
-- Quem segue recebe um aviso quando há um anúncio novo, um produto novo na Loja ou um trabalho novo no portfólio.
-- No máximo um aviso por hora de cada perfil seguido (sem encher as notificações). O número de seguidores é público.

create table if not exists public.followed_sellers (
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, seller_id),
  check (user_id <> seller_id)
);
create index if not exists followed_sellers_seller_id_idx on public.followed_sellers(seller_id);
alter table public.followed_sellers enable row level security;
create policy followed_sellers_owner_all on public.followed_sellers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.followed_sellers from anon;
grant select, insert, delete on public.followed_sellers to authenticated;

-- Seguir / deixar de seguir. Devolve true se ficou a seguir.
create or replace function public.toggle_follow(p_kind text, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text; me uuid := auth.uid(); was boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'seller' then
    select id, coalesce(nullif(full_name, ''), 'Utilizador') into v_owner, v_name from public.profiles where id = p_id and status = 'active';
  elsif p_kind = 'provider' then
    select user_id, display_name into v_owner, v_name from public.provider_profiles where user_id = p_id and active;
  elsif p_kind = 'business' then
    select owner_id, b.name into v_owner, v_name from public.businesses b where id = p_id and active;
  else raise exception 'INVALID_FOLLOW'; end if;
  if v_owner is null then raise exception 'PROFILE_UNAVAILABLE'; end if;
  if v_owner = me then raise exception 'CANNOT_FOLLOW_SELF'; end if;
  if p_kind = 'seller' then
    delete from public.followed_sellers where user_id = me and seller_id = p_id; was := found;
    if not was then insert into public.followed_sellers(user_id, seller_id) values (me, p_id); end if;
  elsif p_kind = 'provider' then
    delete from public.followed_providers where user_id = me and provider_id = p_id; was := found;
    if not was then insert into public.followed_providers(user_id, provider_id) values (me, p_id); end if;
  else
    delete from public.followed_businesses where user_id = me and business_id = p_id; was := found;
    if not was then insert into public.followed_businesses(user_id, business_id) values (me, p_id); end if;
  end if;
  if not was and not exists (select 1 from public.notifications where user_id = v_owner and data->>'for' = 'new_follower' and created_at > now() - interval '1 day') then
    insert into public.notifications(user_id, type, title, body, data)
    values (v_owner, 'system', 'Tem novos seguidores 👋', 'Há pessoas a seguir «' || v_name || '». Recebem um aviso quando publicar algo novo.',
      jsonb_build_object('for', 'new_follower', 'kind', p_kind, 'id', p_id));
  end if;
  return not was;
end $$;

-- Número de seguidores (público) e se eu sigo.
create or replace function public.follow_info(p_kind text, p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'followers', case p_kind
      when 'seller' then (select count(*) from public.followed_sellers where seller_id = p_id)
      when 'provider' then (select count(*) from public.followed_providers where provider_id = p_id)
      when 'business' then (select count(*) from public.followed_businesses where business_id = p_id) else 0 end,
    'following', auth.uid() is not null and case p_kind
      when 'seller' then exists (select 1 from public.followed_sellers where seller_id = p_id and user_id = auth.uid())
      when 'provider' then exists (select 1 from public.followed_providers where provider_id = p_id and user_id = auth.uid())
      when 'business' then exists (select 1 from public.followed_businesses where business_id = p_id and user_id = auth.uid()) else false end);
$$;

-- O que eu sigo.
create or replace function public.my_follows()
returns table(kind text, id uuid, name text, picture text, detail text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'seller', f.seller_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url, p.municipality, f.created_at
    from public.followed_sellers f join public.profiles p on p.id = f.seller_id where f.user_id = auth.uid()
  union all
  select 'provider', f.provider_id, pp.display_name, pp.avatar_url, pp.headline, f.created_at
    from public.followed_providers f join public.provider_profiles pp on pp.user_id = f.provider_id where f.user_id = auth.uid()
  union all
  select 'business', f.business_id, b.name, b.logo_url, b.address_text, f.created_at
    from public.followed_businesses f join public.businesses b on b.id = f.business_id where f.user_id = auth.uid()
  order by 6 desc limit 500;
$$;

-- Aviso a quem segue (uso interno). Um aviso por hora de cada perfil seguido.
create or replace function public.notify_followers(p_followers uuid[], p_source text, p_title text, p_body text, p_data jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.notifications(user_id, type, title, body, data)
  select f, 'system', left(p_title, 120), left(p_body, 300), p_data || jsonb_build_object('for', 'follow', 'source', p_source)
  from (select distinct unnest(p_followers) f) x
  where f is not null and not exists (select 1 from public.notifications n where n.user_id = x.f and n.data->>'for' = 'follow'
    and n.data->>'source' = p_source and n.created_at > now() - interval '1 hour')
  limit 2000;
  get diagnostics n = row_count;
  return n;
end $$;

-- Anúncio publicado → seguidores do vendedor.
create or replace function public.follow_notify_listing() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') or new.purpose = 'wanted' then return new; end if;
  select coalesce(nullif(full_name, ''), 'Um vendedor que segue') into who from public.profiles where id = new.owner_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = new.owner_id), 'seller:' || new.owner_id,
    'Novo anúncio de ' || who, new.title, jsonb_build_object('listing_id', new.id));
  return new;
end $$;
create trigger follow_notify_listing after insert or update of status on public.classified_listings
  for each row execute function public.follow_notify_listing();

-- Produto novo na Loja → seguidores do vendedor e da empresa.
create or replace function public.follow_notify_product() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not new.active or (tg_op = 'UPDATE' and old.active) then return new; end if;
  select coalesce((select name from public.businesses where id = new.business_id), nullif(full_name, ''), 'Uma loja que segue') into who from public.profiles where id = new.seller_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = new.seller_id
      union select user_id from public.followed_businesses where business_id = new.business_id),
    'seller:' || new.seller_id, 'Novo produto de ' || coalesce(who, 'uma loja que segue'), new.name, jsonb_build_object('product_id', new.id));
  return new;
end $$;
create trigger follow_notify_product after insert or update of active on public.products
  for each row execute function public.follow_notify_product();

-- Trabalho novo no portfólio → seguidores do profissional ou da empresa.
create or replace function public.follow_notify_portfolio() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.provider_id is not null then
    select display_name into who from public.provider_profiles where user_id = new.provider_id;
    perform public.notify_followers(array(select user_id from public.followed_providers where provider_id = new.provider_id), 'provider:' || new.provider_id,
      'Trabalho novo de ' || coalesce(who, 'um profissional que segue'), new.title, jsonb_build_object('provider_id', new.provider_id));
  else
    select name into who from public.businesses where id = new.business_id;
    perform public.notify_followers(array(select user_id from public.followed_businesses where business_id = new.business_id), 'business:' || new.business_id,
      'Novidade de ' || coalesce(who, 'uma empresa que segue'), new.title, jsonb_build_object('business_id', new.business_id));
  end if;
  return new;
end $$;
create trigger follow_notify_portfolio after insert on public.portfolio_items
  for each row execute function public.follow_notify_portfolio();

revoke all on function public.notify_followers(uuid[], text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.follow_notify_listing() from public, anon, authenticated;
revoke all on function public.follow_notify_product() from public, anon, authenticated;
revoke all on function public.follow_notify_portfolio() from public, anon, authenticated;
revoke all on function public.toggle_follow(text, uuid) from public, anon;
revoke all on function public.my_follows() from public, anon;
grant execute on function public.toggle_follow(text, uuid) to authenticated;
grant execute on function public.my_follows() to authenticated;
grant execute on function public.follow_info(text, uuid) to anon, authenticated;
