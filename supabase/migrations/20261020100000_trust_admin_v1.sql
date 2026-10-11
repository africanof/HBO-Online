-- Confiança e administração:
-- 1) denúncias de perfis, empresas, profissionais e produtos (não só anúncios);
-- 2) pedidos de verificação (identidade, profissional, empresa) com documento privado;
-- 3) respostas do dono às avaliações;
-- 4) registo das ações da administração (auditoria) e mais números no painel;
-- 5) data pretendida nos pedidos de serviço.

-- Avisa moderadores e administradores.
create or replace function public.notify_staff(p_title text, p_body text, p_data jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data)
  select distinct r.user_id, 'system', p_title, p_body, p_data || jsonb_build_object('for', 'admin')
  from public.user_roles r where r.role in ('moderator', 'admin') limit 20;
$$;
revoke all on function public.notify_staff(text, text, jsonb) from public, anon, authenticated;

-- 1) Denúncias ---------------------------------------------------------------------
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
    else null end;
  if p_target_type not in ('user', 'provider', 'business', 'product', 'classified_listing') then raise exception 'INVALID_TARGET'; end if;
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
revoke all on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

-- Lista de denúncias com o nome do alvo (todos os tipos).
create or replace function public.admin_list_reports_v2(p_status text default null)
returns table(id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamptz,
  reporter_name text, target_title text, target_active boolean, target_owner uuid)
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
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.status not in ('cancelled') from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.active from public.products p where p.id = r.target_id)
      when 'business' then (select b.active from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.active from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select u.status = 'active' from public.profiles u where u.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.owner_id from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.seller_id from public.products p where p.id = r.target_id)
      when 'business' then (select b.owner_id from public.businesses b where b.id = r.target_id)
      when 'provider' then r.target_id
      when 'user' then r.target_id
      else null end
  from public.moderation_reports r left join public.profiles rp on rp.id = r.reporter_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open', 'reviewing')) desc, r.created_at desc limit 200;
end $$;

-- Esconder (ou voltar a mostrar) um produto, empresa ou perfil profissional denunciado.
create or replace function public.admin_set_target_active(p_target_type text, p_target_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_target_type = 'product' then update public.products set active = p_active where id = p_target_id;
  elsif p_target_type = 'business' then update public.businesses set active = p_active where id = p_target_id;
  elsif p_target_type = 'provider' then update public.provider_profiles set active = p_active where user_id = p_target_id;
  else raise exception 'INVALID_TARGET'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_active then 'show' else 'hide' end, p_target_type, p_target_id, '{}'::jsonb);
end $$;

-- 2) Verificações --------------------------------------------------------------------
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('identity', 'provider', 'business')),
  business_id uuid references public.businesses(id) on delete cascade,
  document_path text check (document_path is null or document_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'business') = (business_id is not null))
);
create unique index if not exists verification_one_pending on public.verification_requests(user_id, kind, coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'pending';
alter table public.verification_requests enable row level security;
create policy verification_own_read on public.verification_requests for select to authenticated using (user_id = auth.uid());
revoke all on public.verification_requests from anon, authenticated;
grant select on public.verification_requests to authenticated;

-- Documentos privados: cada pessoa só escreve na sua pasta; só ela e a administração leem.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy verification_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy verification_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_admin_role()));

create or replace function public.request_verification(p_kind text, p_business_id uuid default null, p_document_path text default null, p_note text default null)
returns public.verification_requests language plpgsql security definer set search_path = public as $$
declare v public.verification_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind = 'provider' and not exists (select 1 from public.provider_profiles where user_id = auth.uid()) then raise exception 'NO_PROVIDER_PROFILE'; end if;
  if p_kind = 'business' and not exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()) then raise exception 'NOT_BUSINESS_OWNER'; end if;
  if p_document_path is not null and split_part(p_document_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_document_path is null then raise exception 'DOCUMENT_REQUIRED'; end if;
  if exists (select 1 from public.verification_requests where user_id = auth.uid() and kind = p_kind and status = 'pending'
             and business_id is not distinct from case when p_kind = 'business' then p_business_id end) then raise exception 'VERIFICATION_PENDING'; end if;
  insert into public.verification_requests(user_id, kind, business_id, document_path, note)
  values (auth.uid(), p_kind, case when p_kind = 'business' then p_business_id end, p_document_path, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', case p_kind when 'identity' then 'Identidade' when 'provider' then 'Profissional' else 'Empresa' end, jsonb_build_object('verification_id', v.id));
  return v;
end $$;

create or replace function public.my_verifications()
returns table(id uuid, kind text, business_id uuid, business_name text, status text, admin_note text, created_at timestamptz, decided_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.id, v.kind, v.business_id, b.name, v.status, v.admin_note, v.created_at, v.decided_at
  from public.verification_requests v left join public.businesses b on b.id = v.business_id
  where v.user_id = auth.uid() order by v.created_at desc limit 50;
$$;

create or replace function public.admin_list_verifications(p_status text default 'pending')
returns table(id uuid, user_id uuid, user_name text, phone text, kind text, business_id uuid, business_name text, document_path text,
  note text, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select v.id, v.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.phone, v.kind, v.business_id, b.name, v.document_path,
    v.note, v.status, v.admin_note, v.created_at
  from public.verification_requests v left join public.profiles p on p.id = v.user_id left join public.businesses b on b.id = v.business_id
  where p_status is null or v.status = p_status
  order by (v.status = 'pending') desc, v.created_at limit 200;
end $$;

create or replace function public.admin_decide_verification(p_id uuid, p_approve boolean, p_note text default null)
returns public.verification_requests language plpgsql security definer set search_path = public as $$
declare v public.verification_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into v from public.verification_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  update public.verification_requests set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), decided_by = auth.uid(), decided_at = now()
   where id = v.id returning * into v;
  if p_approve then
    if v.kind = 'identity' then update public.profiles set kyc_level = greatest(kyc_level, 1) where id = v.user_id;
    elsif v.kind = 'provider' then update public.provider_profiles set verified = true where user_id = v.user_id;
    else update public.businesses set verified = true where id = v.business_id; end if;
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'verification_approved' else 'verification_rejected' end, v.kind, coalesce(v.business_id, v.user_id), jsonb_build_object('request_id', v.id));
  insert into public.notifications(user_id, type, title, body, data)
  values (v.user_id, 'system', case when p_approve then 'Verificação aprovada ✔' else 'Verificação recusada' end,
          case when p_approve then 'O seu perfil passa a mostrar o selo de verificado.' else coalesce(v.admin_note, 'Envie um documento legível e tente novamente.') end,
          jsonb_build_object('verification_id', v.id, 'for', 'verification'));
  return v;
end $$;

-- Sinais de confiança públicos de uma pessoa.
create or replace function public.public_trust_signals(p_user_id uuid)
returns table(identity_verified boolean, phone_verified boolean, provider_verified boolean, businesses_verified bigint)
language sql stable security definer set search_path = public as $$
  select coalesce((select kyc_level >= 1 from public.profiles where id = p_user_id), false),
         coalesce((select phone_verified from public.profiles where id = p_user_id), false),
         coalesce((select verified from public.provider_profiles where user_id = p_user_id), false),
         (select count(*) from public.businesses where owner_id = p_user_id and verified and active);
$$;

-- 3) Respostas às avaliações ---------------------------------------------------------
alter table public.reviews add column if not exists owner_reply text check (owner_reply is null or char_length(owner_reply) <= 1000);
alter table public.reviews add column if not exists owner_reply_at timestamptz;
alter table public.user_reviews add column if not exists reply text check (reply is null or char_length(reply) <= 1000);
alter table public.user_reviews add column if not exists reply_at timestamptz;

create or replace function public.reply_to_review(p_kind text, p_review_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := nullif(left(trim(coalesce(p_reply, '')), 1000), ''); author uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'service' then
    select r.author_id into author from public.reviews r left join public.businesses b on b.id = r.business_id
     where r.id = p_review_id and (r.provider_id = auth.uid() or b.owner_id = auth.uid());
    if not found then raise exception 'NOT_REVIEW_TARGET'; end if;
    update public.reviews set owner_reply = t, owner_reply_at = case when t is null then null else now() end where id = p_review_id;
  elsif p_kind = 'deal' then
    select r.author_id into author from public.user_reviews r where r.id = p_review_id and r.target_id = auth.uid();
    if not found then raise exception 'NOT_REVIEW_TARGET'; end if;
    update public.user_reviews set reply = t, reply_at = case when t is null then null else now() end where id = p_review_id;
  else raise exception 'INVALID_KIND'; end if;
  if t is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (author, 'review', 'Responderam à sua avaliação', left(t, 140), jsonb_build_object('for', 'reply'));
  end if;
end $$;

create or replace function public.list_reviews_v3(p_provider_id uuid default null, p_business_id uuid default null)
returns table(id uuid, rating smallint, comment text, created_at timestamptz, author_id uuid, author_name text, confirmed boolean, owner_reply text, owner_reply_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), r.service_request_id is not null, r.owner_reply, r.owner_reply_at
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published' and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by (r.service_request_id is not null) desc, r.created_at desc limit 100;
$$;

create or replace function public.user_reviews_for_v2(p_user_id uuid)
returns table(id uuid, role text, rating smallint, comment text, created_at timestamptz, author_name text, kind text, reply text, reply_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.role, r.rating, r.comment, r.created_at, coalesce(nullif(p.full_name, ''), 'Utilizador'),
         case when r.order_id is not null then 'order' else 'listing' end, r.reply, r.reply_at
  from public.user_reviews r left join public.profiles p on p.id = r.author_id
  where r.target_id = p_user_id and r.status = 'published'
  order by r.created_at desc limit 100;
$$;

-- 4) Auditoria ------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created on public.admin_audit_log(created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

-- Regista mudanças feitas pela administração em contas, papéis, denúncias, anúncios e estafetas.
create or replace function public.audit_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare n jsonb := to_jsonb(new); o jsonb := to_jsonb(old); owner text; changes jsonb := '{}'::jsonb; k text;
begin
  if auth.uid() is null or not public.has_admin_role() then return new; end if;
  owner := coalesce(n->>'owner_id', n->>'user_id', case when tg_table_name = 'profiles' then n->>'id' end);
  if owner is not null and owner = auth.uid()::text and tg_table_name <> 'user_roles' then return new; end if;
  foreach k in array array['status', 'role', 'featured', 'active', 'verified', 'kyc_level'] loop
    if n ? k and (o is null or (n->k) is distinct from (o->k)) then changes := changes || jsonb_build_object(k, n->k); end if;
  end loop;
  if changes = '{}'::jsonb then return new; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'update', tg_table_name, coalesce((n->>'id')::uuid, (n->>'user_id')::uuid), changes);
  return new;
end $$;
revoke all on function public.audit_admin_change() from public, anon, authenticated;
create trigger trg_audit_profiles after update on public.profiles for each row execute function public.audit_admin_change();
create trigger trg_audit_user_roles after insert or update on public.user_roles for each row execute function public.audit_admin_change();
create trigger trg_audit_reports after update on public.moderation_reports for each row execute function public.audit_admin_change();
create trigger trg_audit_listings after update on public.classified_listings for each row execute function public.audit_admin_change();
create trigger trg_audit_couriers after update on public.couriers for each row execute function public.audit_admin_change();
create trigger trg_audit_categories after insert or update on public.categories for each row execute function public.audit_admin_change();

create or replace function public.admin_list_audit(p_limit integer default 100)
returns table(id bigint, actor_name text, action text, target_type text, target_id uuid, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.id, coalesce(nullif(p.full_name, ''), 'Administração'), a.action, a.target_type, a.target_id, a.details, a.created_at
  from public.admin_audit_log a left join public.profiles p on p.id = a.actor_id
  order by a.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

-- Mais números no painel.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status <> 'active'),
    'listings_published', (select count(*) from public.classified_listings where status = 'published'),
    'listings_total', (select count(*) from public.classified_listings),
    'listings_7d', (select count(*) from public.classified_listings where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.moderation_reports where status in ('open', 'reviewing')),
    'conversations', (select count(*) from public.conversations),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'products_active', (select count(*) from public.products where active),
    'providers', (select count(*) from public.provider_profiles where active),
    'businesses', (select count(*) from public.businesses where active),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
    'orders_completed_30d', (select count(*) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'sales_value_30d', (select coalesce(sum(total), 0) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'services_30d', (select count(*) from public.service_requests where created_at > now() - interval '30 days'),
    'services_done_30d', (select count(*) from public.service_requests where status in ('done', 'confirmed') and updated_at > now() - interval '30 days'),
    'deals_30d', (select count(*) from public.classified_listings where deal_at > now() - interval '30 days'),
    'reviews_30d', (select count(*) from public.user_reviews where created_at > now() - interval '30 days')
                  + (select count(*) from public.reviews where created_at > now() - interval '30 days'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending')
  );
end $$;

-- 5) Data pretendida nos pedidos de serviço -----------------------------------------
alter table public.service_requests add column if not exists preferred_date date;
create or replace function public.request_service_v2(p_provider_id uuid, p_business_id uuid, p_description text, p_preferred_date date default null)
returns public.service_requests language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  if p_preferred_date is not null and (p_preferred_date < (now() at time zone 'Africa/Luanda')::date or p_preferred_date > (now() at time zone 'Africa/Luanda')::date + 365) then
    raise exception 'INVALID_DATE';
  end if;
  r := public.request_service(p_provider_id, p_business_id, p_description);
  if p_preferred_date is not null then
    update public.service_requests set preferred_date = p_preferred_date where id = r.id returning * into r;
  end if;
  return r;
end $$;

create or replace function public.my_service_requests_v2(p_as text default 'client')
returns table(id uuid, status text, description text, provider_note text, created_at timestamptz, updated_at timestamptz,
  provider_id uuid, business_id uuid, target_name text, client_id uuid, client_name text, preferred_date date)
language sql stable security definer set search_path = public as $$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente'), s.preferred_date
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  where auth.uid() is not null and case when p_as = 'provider'
    then (s.provider_id = auth.uid() or b.owner_id = auth.uid()) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$$;

-- Permissões ----------------------------------------------------------------------------
revoke all on function public.admin_list_reports_v2(text) from public, anon;
revoke all on function public.admin_set_target_active(text, uuid, boolean) from public, anon;
revoke all on function public.request_verification(text, uuid, text, text) from public, anon;
revoke all on function public.my_verifications() from public, anon;
revoke all on function public.admin_list_verifications(text) from public, anon;
revoke all on function public.admin_decide_verification(uuid, boolean, text) from public, anon;
revoke all on function public.reply_to_review(text, uuid, text) from public, anon;
revoke all on function public.admin_list_audit(integer) from public, anon;
revoke all on function public.request_service_v2(uuid, uuid, text, date) from public, anon;
revoke all on function public.my_service_requests_v2(text) from public, anon;
grant execute on function public.admin_list_reports_v2(text) to authenticated;
grant execute on function public.admin_set_target_active(text, uuid, boolean) to authenticated;
grant execute on function public.request_verification(text, uuid, text, text) to authenticated;
grant execute on function public.my_verifications() to authenticated;
grant execute on function public.admin_list_verifications(text) to authenticated;
grant execute on function public.admin_decide_verification(uuid, boolean, text) to authenticated;
grant execute on function public.reply_to_review(text, uuid, text) to authenticated;
grant execute on function public.admin_list_audit(integer) to authenticated;
grant execute on function public.request_service_v2(uuid, uuid, text, date) to authenticated;
grant execute on function public.my_service_requests_v2(text) to authenticated;
grant execute on function public.public_trust_signals(uuid) to anon, authenticated;
grant execute on function public.list_reviews_v3(uuid, uuid) to anon, authenticated;
grant execute on function public.user_reviews_for_v2(uuid) to anon, authenticated;
