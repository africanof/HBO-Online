-- Huambo Online — administração e moderação
-- Todas as funções verificam has_admin_role() (papéis 'admin' ou 'moderator' em user_roles).

-- Leitura administrativa
create policy profiles_admin_read on public.profiles for select to authenticated using (public.has_admin_role());
create policy categories_admin_read on public.categories for select to authenticated using (public.has_admin_role());
create policy categories_admin_insert on public.categories for insert to authenticated with check (public.has_admin_role());
create policy categories_admin_update on public.categories for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());

-- Contas suspensas/banidas não publicam nem enviam mensagens
create or replace function public.current_user_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), true);
$$;

create or replace function public.guard_classified_listing()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin boolean := public.has_admin_role();
begin
  if tg_op = 'INSERT' then
    if not admin then
      if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
      new.status := 'draft'; new.featured := false;
    end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  if not admin then
    new.featured := old.featured;
    if new.status = 'published' and old.status is distinct from 'published'
       and coalesce(current_setting('huambo.allow_publish', true), '') <> 'on' then
      raise exception 'USE_PUBLISH_FUNCTION';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.guard_message_sender()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  return new;
end $$;
create trigger trg_guard_message_sender before insert on public.messages
  for each row execute function public.guard_message_sender();

-- Estatísticas
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status <> 'active'),
    'listings_published', (select count(*) from public.classified_listings where status = 'published'),
    'listings_total', (select count(*) from public.classified_listings),
    'listings_7d', (select count(*) from public.classified_listings where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.moderation_reports where status in ('open','reviewing')),
    'conversations', (select count(*) from public.conversations),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days')
  );
end $$;

-- Denúncias
create or replace function public.admin_list_reports(p_status text default null)
returns table(id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamptz,
  reporter_name text, listing_title text, listing_status text, listing_owner uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
         p.full_name, l.title, l.status, l.owner_id
  from public.moderation_reports r
  left join public.profiles p on p.id = r.reporter_id
  left join public.classified_listings l on r.target_type = 'classified_listing' and l.id = r.target_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open','reviewing')) desc, r.created_at desc
  limit 200;
end $$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then raise exception 'INVALID_STATUS'; end if;
  update public.moderation_reports
     set status = p_status,
         resolved_by = case when p_status in ('resolved','dismissed') then auth.uid() else null end,
         resolved_at = case when p_status in ('resolved','dismissed') then now() else null end
   where id = p_report_id;
end $$;

-- Anúncios (moderação)
create or replace function public.admin_list_listings(p_status text default null, p_query text default '')
returns table(id uuid, title text, status text, featured boolean, price numeric, currency text, created_at timestamptz,
  owner_id uuid, owner_name text, reports bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select l.id, l.title, l.status, l.featured, l.price, l.currency, l.created_at, l.owner_id, p.full_name,
         (select count(*) from public.moderation_reports r where r.target_type = 'classified_listing' and r.target_id = l.id)
  from public.classified_listings l left join public.profiles p on p.id = l.owner_id
  where (p_status is null or l.status = p_status)
    and (coalesce(p_query,'') = '' or lower(l.title) like '%' || lower(p_query) || '%')
  order by l.created_at desc
  limit 200;
end $$;

create or replace function public.admin_moderate_listing(p_listing_id uuid, p_status text, p_featured boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status is not null and p_status not in ('draft','published','paused','sold','rented','closed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  update public.classified_listings
     set status = coalesce(p_status, status), featured = coalesce(p_featured, featured)
   where id = p_listing_id;
end $$;

-- Utilizadores
create or replace function public.admin_list_users(p_query text default '')
returns table(id uuid, email text, full_name text, phone text, municipality text, status text, role text,
  created_at timestamptz, last_sign_in_at timestamptz, listings bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select u.id, u.email::text, p.full_name, p.phone, p.municipality, coalesce(p.status,'active'),
         coalesce((select r.role from public.user_roles r where r.user_id = u.id), 'user'),
         u.created_at, u.last_sign_in_at,
         (select count(*) from public.classified_listings l where l.owner_id = u.id)
  from auth.users u left join public.profiles p on p.id = u.id
  where coalesce(p_query,'') = '' or lower(coalesce(u.email,'') || ' ' || coalesce(p.full_name,'')) like '%' || lower(p_query) || '%'
  order by u.created_at desc
  limit 200;
end $$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'INVALID_STATUS'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  update public.profiles set status = p_status where id = p_user_id;
  if p_status <> 'active' then
    update public.classified_listings set status = 'paused' where owner_id = p_user_id and status = 'published';
  end if;
end $$;

-- Só administradores (não moderadores) mudam papéis
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_role not in ('user','moderator','admin') then raise exception 'INVALID_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  insert into public.user_roles(user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
end $$;

create or replace function public.my_admin_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'user');
$$;

-- Permissões: nada disto é chamável por visitantes
do $$
declare f text;
begin
  foreach f in array array[
    'public.current_user_active()', 'public.admin_stats()', 'public.admin_list_reports(text)',
    'public.admin_resolve_report(uuid, text)', 'public.admin_list_listings(text, text)',
    'public.admin_moderate_listing(uuid, text, boolean)', 'public.admin_list_users(text)',
    'public.admin_set_user_status(uuid, text)', 'public.is_admin()', 'public.admin_set_user_role(uuid, text)',
    'public.my_admin_role()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.guard_message_sender() from public, anon, authenticated;

-- Uma conta suspensa perde também os poderes de moderação/administração
create or replace function public.has_admin_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('moderator','admin'))
     and public.current_user_active();
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') and public.current_user_active();
$$;
