-- Vídeos de publicidade e lives de profissionais, lojas e empresas (Site e APP), com destaque pago opcional.
-- • Vídeo: enviado para o Storage (media-videos, até 60 s / 30 MB) ou ligação do YouTube/Facebook/TikTok/Instagram.
-- • Live: a transmissão acontece no YouTube/Facebook/TikTok/Instagram; aqui fica o anúncio, a hora e a ligação.
--   Os seguidores recebem aviso quando se publica e quando a live começa.
-- • Destaque: pago à plataforma (como os outros destaques), confirmado pela administração.

alter table public.platform_settings add column if not exists promo_boost_price_kz numeric not null default 1000 check (promo_boost_price_kz >= 0);
alter table public.platform_settings add column if not exists promo_boost_days integer not null default 7 check (promo_boost_days between 1 and 60);

create sequence if not exists public.promo_posts_ref_no_seq start 1001;
create table public.promo_posts (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.promo_posts_ref_no_seq'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('provider', 'business', 'store')),
  subject_id uuid not null,
  kind text not null check (kind in ('video', 'live')),
  title text not null check (char_length(title) between 4 and 120),
  description text check (description is null or char_length(description) <= 1000),
  video_url text check (video_url is null or video_url ~ '^https://[^ ]+/storage/v1/object/public/media-videos/'),
  external_url text check (external_url is null or external_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|instagram\.com)(/|$)'),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  live_starts_at timestamptz,
  live_ends_at timestamptz,
  live_notified boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden')),
  hidden_reason text,
  featured_until timestamptz,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'video' or video_url is not null or external_url is not null),
  check (kind <> 'live' or (external_url is not null and live_starts_at is not null and live_ends_at > live_starts_at))
);
create index promo_posts_subject on public.promo_posts(subject_kind, subject_id, created_at desc);
create index promo_posts_feed on public.promo_posts(status, created_at desc);
alter table public.promo_posts enable row level security;
-- Leitura pública só pelas funções (o dono e a administração leem tudo); escrita só pelas funções.
create policy promo_posts_owner_read on public.promo_posts for select to authenticated using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke insert, update, delete on public.promo_posts from anon, authenticated;

create trigger trg_queue_video_cleanup_promo after update of video_url or delete on public.promo_posts
  for each row execute function public.queue_video_cleanup();

create sequence if not exists public.promo_boosts_ref_no_seq start 1001;
create table public.promo_boosts (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.promo_boosts_ref_no_seq'),
  post_id uuid not null references public.promo_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  days integer not null check (days between 1 and 60),
  method text not null check (method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index promo_boosts_one_pending on public.promo_boosts(post_id) where status = 'pending';
alter table public.promo_boosts enable row level security;
create policy promo_boosts_owner_read on public.promo_boosts for select to authenticated using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke insert, update, delete on public.promo_boosts from anon, authenticated;

-- Quem é o dono do perfil/empresa/loja, o nome, a fotografia, se está ativo e com a mensalidade em dia.
create or replace function public.promo_subject(p_kind text, p_id uuid, out owner uuid, out name text, out picture text, out visible boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind = 'provider' then
    select pp.user_id, pp.display_name, pp.avatar_url, pp.active and public.subject_paid_up(pp.user_id, null) into owner, name, picture, visible
      from public.provider_profiles pp where pp.user_id = p_id;
  elsif p_kind = 'business' then
    select b.owner_id, b.name, b.logo_url, b.active and public.subject_paid_up(null, b.id) into owner, name, picture, visible
      from public.businesses b where b.id = p_id;
  elsif p_kind = 'store' then
    select pr.id, coalesce(nullif(pr.full_name, ''), 'Loja'), pr.avatar_url, pr.status = 'active' and public.store_paid_up(pr.id) into owner, name, picture, visible
      from public.profiles pr where pr.id = p_id and exists (select 1 from public.subscriptions s where s.seller_id = pr.id and s.kind = 'store');
  end if;
end $$;

-- Perfis em nome dos quais a pessoa pode publicar.
create or replace function public.my_promo_subjects()
returns table (kind text, id uuid, name text) language sql stable security definer set search_path = public as $$
  select 'provider', pp.user_id, pp.display_name from public.provider_profiles pp where pp.user_id = auth.uid() and pp.active
  union all select 'business', b.id, b.name from public.businesses b where b.owner_id = auth.uid() and b.active
  union all select 'store', pr.id, coalesce(nullif(pr.full_name, ''), 'A minha loja') from public.profiles pr
    where pr.id = auth.uid() and exists (select 1 from public.subscriptions s where s.seller_id = pr.id and s.kind = 'store');
$$;

-- Avisa os seguidores do perfil (os da loja são os seguidores do vendedor).
create or replace function public.promo_notify_followers(p public.promo_posts, p_source text, p_title text, p_body text)
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.notify_followers(
    case p.subject_kind
      when 'provider' then array(select user_id from public.followed_providers where provider_id = p.subject_id)
      when 'business' then array(select user_id from public.followed_businesses where business_id = p.subject_id)
      else array(select user_id from public.followed_sellers where seller_id = p.subject_id) end,
    p_source, p_title, p_body, jsonb_build_object('post_id', p.id));
end $$;

-- Criar ou editar um vídeo/live.
create or replace function public.save_promo_post(p_id uuid, p_subject_kind text, p_subject_id uuid, p_kind text, p_title text, p_description text default null,
  p_video_url text default null, p_external_url text default null, p_cover_url text default null, p_live_starts_at timestamptz default null, p_live_minutes integer default null)
returns public.promo_posts language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s record; p public.promo_posts; old public.promo_posts; who text;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('video', 'live') then raise exception 'INVALID_KIND'; end if;
  select * into s from public.promo_subject(p_subject_kind, p_subject_id);
  if s.owner is null or s.owner <> me then raise exception 'NOT_SUBJECT_OWNER'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 4 then raise exception 'TITLE_REQUIRED'; end if;
  if p_kind = 'video' and p_video_url is null and p_external_url is null then raise exception 'VIDEO_REQUIRED'; end if;
  if p_kind = 'live' then
    if p_external_url is null then raise exception 'LIVE_LINK_REQUIRED'; end if;
    if p_live_starts_at is null then raise exception 'LIVE_TIME_REQUIRED'; end if;
    if coalesce(p_live_minutes, 0) not between 10 and 480 then raise exception 'LIVE_DURATION_INVALID'; end if;
  end if;
  if p_id is null then
    if p_kind = 'live' and p_live_starts_at < now() - interval '10 minutes' then raise exception 'LIVE_IN_PAST'; end if;
    if p_kind = 'live' and p_live_starts_at > now() + interval '60 days' then raise exception 'LIVE_TOO_FAR'; end if;
    if (select count(*) from public.promo_posts x where x.owner_id = me and x.created_at > now() - interval '1 day') >= 5 then raise exception 'TOO_MANY_POSTS'; end if;
    insert into public.promo_posts(owner_id, subject_kind, subject_id, kind, title, description, video_url, external_url, cover_url, live_starts_at, live_ends_at)
    values (me, p_subject_kind, p_subject_id, p_kind, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_video_url, p_external_url, p_cover_url,
      case when p_kind = 'live' then p_live_starts_at end, case when p_kind = 'live' then p_live_starts_at + make_interval(mins => p_live_minutes) end)
    returning * into p;
    if s.visible then
      perform public.promo_notify_followers(p, 'promo:' || p.id,
        case when p.kind = 'live' then '🔴 Live de ' || s.name || ' — ' || to_char(p.live_starts_at at time zone 'Africa/Luanda', 'DD/MM HH24:MI')
             else '🎬 Vídeo novo de ' || s.name end, p.title);
    end if;
  else
    select * into old from public.promo_posts where id = p_id for update;
    if not found or old.owner_id <> me then raise exception 'POST_NOT_FOUND'; end if;
    if old.kind <> p_kind or old.subject_kind <> p_subject_kind or old.subject_id <> p_subject_id then raise exception 'CANNOT_CHANGE_KIND'; end if;
    update public.promo_posts set title = trim(p_title), description = nullif(trim(coalesce(p_description, '')), ''), video_url = p_video_url, external_url = p_external_url,
      cover_url = p_cover_url,
      live_starts_at = case when p_kind = 'live' then p_live_starts_at end,
      live_ends_at = case when p_kind = 'live' then p_live_starts_at + make_interval(mins => p_live_minutes) end,
      live_notified = case when p_kind = 'live' and p_live_starts_at is distinct from old.live_starts_at then false else old.live_notified end,
      updated_at = now()
    where id = p_id returning * into p;
  end if;
  return p;
end $$;

create or replace function public.delete_promo_post(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.promo_posts where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'POST_NOT_FOUND'; end if;
end $$;

-- Feed público: lives a decorrer, destaques, próximas lives e vídeos recentes.
create or replace function public.promo_feed(p_kind text default null, p_subject_kind text default null, p_subject_id uuid default null, p_limit integer default 40)
returns table (id uuid, ref_no bigint, subject_kind text, subject_id uuid, subject_name text, subject_picture text, kind text, title text, description text,
  video_url text, external_url text, cover_url text, live_starts_at timestamptz, live_ends_at timestamptz, live_state text, featured boolean, views integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.id, x.ref_no, x.subject_kind, x.subject_id, s.name, s.picture, x.kind, x.title, x.description, x.video_url, x.external_url, x.cover_url,
    x.live_starts_at, x.live_ends_at,
    case when x.kind <> 'live' then null when now() < x.live_starts_at then 'upcoming' when now() <= x.live_ends_at then 'live' else 'ended' end,
    coalesce(x.featured_until > now(), false), x.views, x.created_at
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where x.status = 'published' and s.visible
    and (p_kind is null or x.kind = p_kind)
    and (p_subject_kind is null or (x.subject_kind = p_subject_kind and x.subject_id = p_subject_id))
    and (x.kind <> 'live' or x.live_ends_at > now() - interval '3 days' or p_subject_id is not null)
  order by (x.kind = 'live' and now() between x.live_starts_at and x.live_ends_at) desc,
    coalesce(x.featured_until > now(), false) desc,
    (x.kind = 'live' and now() < x.live_starts_at) desc,
    case when x.kind = 'live' and now() < x.live_starts_at then x.live_starts_at end asc,
    x.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

create or replace function public.get_promo_post(p_id uuid)
returns table (id uuid, ref_no bigint, owner_id uuid, subject_kind text, subject_id uuid, subject_name text, subject_picture text, kind text, title text, description text,
  video_url text, external_url text, cover_url text, live_starts_at timestamptz, live_ends_at timestamptz, live_state text, featured boolean, featured_until timestamptz,
  views integer, status text, hidden_reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.id, x.ref_no, x.owner_id, x.subject_kind, x.subject_id, s.name, s.picture, x.kind, x.title, x.description, x.video_url, x.external_url, x.cover_url,
    x.live_starts_at, x.live_ends_at,
    case when x.kind <> 'live' then null when now() < x.live_starts_at then 'upcoming' when now() <= x.live_ends_at then 'live' else 'ended' end,
    coalesce(x.featured_until > now(), false), x.featured_until, x.views, x.status, x.hidden_reason, x.created_at
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where x.id = p_id and ((x.status = 'published' and s.visible) or x.owner_id = auth.uid() or public.has_admin_role());
$$;

create or replace function public.record_promo_view(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.promo_posts set views = views + 1 where id = p_id and status = 'published' and owner_id is distinct from auth.uid();
$$;

-- Os meus vídeos e lives (com o estado do destaque).
create or replace function public.my_promo_posts()
returns table (id uuid, ref_no bigint, subject_kind text, subject_id uuid, subject_name text, kind text, title text, live_starts_at timestamptz, live_ends_at timestamptz,
  status text, hidden_reason text, featured_until timestamptz, views integer, created_at timestamptz, boost_status text, boost_note text)
language sql stable security definer set search_path = public as $$
  select x.id, x.ref_no, x.subject_kind, x.subject_id, s.name, x.kind, x.title, x.live_starts_at, x.live_ends_at, x.status, x.hidden_reason, x.featured_until, x.views, x.created_at,
    b.status, b.admin_note
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  left join lateral (select pb.status, pb.admin_note from public.promo_boosts pb where pb.post_id = x.id order by pb.created_at desc limit 1) b on true
  where x.owner_id = auth.uid()
  order by x.created_at desc;
$$;

-- Pedir destaque (paga à plataforma; a administração confirma).
create or replace function public.submit_promo_boost(p_post_id uuid, p_method text, p_reference text default null, p_proof_path text default null)
returns public.promo_boosts language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.promo_posts; st public.platform_settings; b public.promo_boosts;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from public.promo_posts where id = p_post_id;
  if not found or p.owner_id <> me then raise exception 'POST_NOT_FOUND'; end if;
  if p.status <> 'published' then raise exception 'POST_HIDDEN'; end if;
  if p.kind = 'live' and p.live_ends_at < now() then raise exception 'LIVE_ENDED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and p_proof_path !~ ('^' || me::text || '/') then raise exception 'INVALID_PROOF'; end if;
  if exists (select 1 from public.promo_boosts where post_id = p.id and status = 'pending') then raise exception 'BOOST_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.promo_boosts(post_id, owner_id, amount, days, method, reference, proof_path)
  values (p.id, me, st.promo_boost_price_kz, st.promo_boost_days, p_method, nullif(trim(coalesce(p_reference, '')), ''), p_proof_path)
  returning * into b;
  perform public.notify_staff('Destaque de vídeo por confirmar', 'V-' || p.ref_no || ' · ' || st.promo_boost_price_kz || ' Kz', jsonb_build_object('for', 'admin_promo'));
  return b;
end $$;

create or replace function public.admin_list_promo_boosts(p_status text default 'pending')
returns table (id uuid, ref_no bigint, post_id uuid, post_ref bigint, post_title text, post_kind text, owner_name text, amount numeric, days integer, method text,
  reference text, proof_path text, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select b.id, b.ref_no, b.post_id, p.ref_no, p.title, p.kind, coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.days, b.method,
    b.reference, b.proof_path, b.status, b.admin_note, b.created_at
  from public.promo_boosts b join public.promo_posts p on p.id = b.post_id left join public.profiles pr on pr.id = b.owner_id
  where p_status is null or b.status = p_status order by b.created_at desc limit 200;
end $$;

create or replace function public.admin_decide_promo_boost(p_boost_id uuid, p_confirm boolean, p_note text default null)
returns public.promo_boosts language plpgsql security definer set search_path = public as $$
declare b public.promo_boosts; p public.promo_posts;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_confirm and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into b from public.promo_boosts where id = p_boost_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  update public.promo_boosts set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = nullif(trim(coalesce(p_note, '')), ''),
    decided_by = auth.uid(), decided_at = now() where id = b.id returning * into b;
  if p_confirm then
    update public.promo_posts set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => b.days) where id = b.post_id returning * into p;
  else select * into p from public.promo_posts where id = b.post_id; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (b.owner_id, 'system', case when p_confirm then '⭐ Destaque ativo' else 'Destaque não confirmado' end,
    case when p_confirm then '«' || p.title || '» fica em destaque até ' || to_char(p.featured_until at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.'
         else '«' || p.title || '»: ' || trim(p_note) end,
    jsonb_build_object('for', 'promo', 'post_id', p.id));
  return b;
end $$;

-- Administração: ver e esconder vídeos/lives.
create or replace function public.admin_list_promo_posts(p_status text default null)
returns table (id uuid, ref_no bigint, kind text, title text, subject_kind text, subject_id uuid, subject_name text, video_url text, external_url text, status text,
  hidden_reason text, views integer, featured_until timestamptz, created_at timestamptz, reports bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select x.id, x.ref_no, x.kind, x.title, x.subject_kind, x.subject_id, s.name, x.video_url, x.external_url, x.status, x.hidden_reason, x.views, x.featured_until, x.created_at,
    (select count(*) from public.moderation_reports r where r.target_type = 'promo_post' and r.target_id = x.id and r.status in ('open', 'reviewing'))
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where p_status is null or x.status = p_status
  order by 15 desc, x.created_at desc limit 200;
end $$;

create or replace function public.admin_set_promo_hidden(p_id uuid, p_hidden boolean, p_reason text default null)
returns public.promo_posts language plpgsql security definer set search_path = public as $$
declare p public.promo_posts;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_hidden and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
  update public.promo_posts set status = case when p_hidden then 'hidden' else 'published' end, hidden_reason = case when p_hidden then trim(p_reason) end, updated_at = now()
   where id = p_id returning * into p;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_hidden then
    insert into public.notifications(user_id, type, title, body, data)
    values (p.owner_id, 'system', 'Vídeo escondido pela administração', '«' || p.title || '»: ' || trim(p_reason), jsonb_build_object('for', 'promo', 'post_id', p.id));
  end if;
  return p;
end $$;

-- Aviso aos seguidores quando a live começa (de 5 em 5 minutos).
create or replace function public.promo_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare p public.promo_posts; s record; n integer := 0;
begin
  for p in select * from public.promo_posts where kind = 'live' and status = 'published' and not live_notified
             and live_starts_at <= now() + interval '5 minutes' and live_ends_at > now() for update skip locked loop
    select * into s from public.promo_subject(p.subject_kind, p.subject_id);
    if s.visible then perform public.promo_notify_followers(p, 'live:' || p.id, '🔴 ' || s.name || ' está em direto agora', p.title); end if;
    update public.promo_posts set live_notified = true where id = p.id;
    n := n + 1;
  end loop;
  return n;
end $$;
select cron.schedule('huambo-online-promo-tick', '*/5 * * * *', 'select public.promo_tick()');

-- Denúncias também para vídeos e lives.
alter table public.moderation_reports drop constraint if exists moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check
  check (target_type in ('user', 'business', 'provider', 'product', 'service', 'auction', 'classified_listing', 'message', 'promo_post'));

create or replace function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text default null)
returns public.moderation_reports language plpgsql security definer set search_path = public as $$
declare r public.moderation_reports; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;
  owner := case p_target_type
    when 'user' then (select id from public.profiles where id = p_target_id)
    when 'provider' then (select user_id from public.provider_profiles where user_id = p_target_id)
    when 'business' then (select owner_id from public.businesses where id = p_target_id)
    when 'product' then (select seller_id from public.products where id = p_target_id)
    when 'classified_listing' then (select owner_id from public.classified_listings where id = p_target_id)
    when 'promo_post' then (select owner_id from public.promo_posts where id = p_target_id)
    else null end;
  if p_target_type not in ('user', 'provider', 'business', 'product', 'classified_listing', 'promo_post') then raise exception 'INVALID_TARGET'; end if;
  if owner is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_REPORT_SELF'; end if;
  if exists (select 1 from public.moderation_reports where reporter_id = auth.uid() and target_type = p_target_type and target_id = p_target_id and status in ('open', 'reviewing')) then
    raise exception 'ALREADY_REPORTED';
  end if;
  if (select count(*) from public.moderation_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.moderation_reports(reporter_id, target_type, target_id, reason, details, status)
  values (auth.uid(), p_target_type, p_target_id, left(trim(p_reason), 200), nullif(left(trim(coalesce(p_details, '')), 1000), ''), 'open')
  returning * into r;
  perform public.notify_staff('Nova denúncia', left(trim(p_reason), 140), jsonb_build_object('report_id', r.id));
  return r;
end $$;

create or replace function public.admin_list_reports_v2(p_status text default null)
returns table (id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamptz, reporter_name text, target_title text, target_active boolean, target_owner uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, coalesce(nullif(rp.full_name, ''), 'Utilizador'),
    case r.target_type
      when 'classified_listing' then (select l.title from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.name from public.products p where p.id = r.target_id)
      when 'business' then (select b.name from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select coalesce(nullif(u.full_name, ''), 'Utilizador') from public.profiles u where u.id = r.target_id)
      when 'promo_post' then (select x.title from public.promo_posts x where x.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.status not in ('cancelled') from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.active from public.products p where p.id = r.target_id)
      when 'business' then (select b.active from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.active from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select u.status = 'active' from public.profiles u where u.id = r.target_id)
      when 'promo_post' then (select x.status = 'published' from public.promo_posts x where x.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.owner_id from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.seller_id from public.products p where p.id = r.target_id)
      when 'business' then (select b.owner_id from public.businesses b where b.id = r.target_id)
      when 'promo_post' then (select x.owner_id from public.promo_posts x where x.id = r.target_id)
      when 'provider' then r.target_id
      when 'user' then r.target_id
      else null end
  from public.moderation_reports r left join public.profiles rp on rp.id = r.reporter_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open', 'reviewing')) desc, r.created_at desc limit 200;
end $$;

revoke all on function public.promo_subject(text, uuid) from public, anon, authenticated;
revoke all on function public.promo_notify_followers(public.promo_posts, text, text, text) from public, anon, authenticated;
revoke all on function public.promo_tick() from public, anon, authenticated;
revoke all on function public.my_promo_subjects() from public, anon;
revoke all on function public.save_promo_post(uuid, text, uuid, text, text, text, text, text, text, timestamptz, integer) from public, anon;
revoke all on function public.delete_promo_post(uuid) from public, anon;
revoke all on function public.my_promo_posts() from public, anon;
revoke all on function public.submit_promo_boost(uuid, text, text, text) from public, anon;
revoke all on function public.admin_list_promo_boosts(text) from public, anon;
revoke all on function public.admin_decide_promo_boost(uuid, boolean, text) from public, anon;
revoke all on function public.admin_list_promo_posts(text) from public, anon;
revoke all on function public.admin_set_promo_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.my_promo_subjects() to authenticated;
grant execute on function public.save_promo_post(uuid, text, uuid, text, text, text, text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.delete_promo_post(uuid) to authenticated;
grant execute on function public.my_promo_posts() to authenticated;
grant execute on function public.submit_promo_boost(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_promo_boosts(text) to authenticated;
grant execute on function public.admin_decide_promo_boost(uuid, boolean, text) to authenticated;
grant execute on function public.admin_list_promo_posts(text) to authenticated;
grant execute on function public.admin_set_promo_hidden(uuid, boolean, text) to authenticated;
grant execute on function public.promo_feed(text, text, uuid, integer) to anon, authenticated;
grant execute on function public.get_promo_post(uuid) to anon, authenticated;
grant execute on function public.record_promo_view(uuid) to anon, authenticated;
