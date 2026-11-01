-- Verificação de identidade v2: BI (frente e verso) + selfie com o BI, tirados na hora com a câmara, e número do BI
-- (um BI só verifica uma conta). Autenticação em dois passos (APP autenticadora, ex.: Google Authenticator):
-- quem a ativou só tem poderes de administração com a sessão confirmada pelo código (aal2).

alter table public.verification_requests
  add column if not exists back_path text check (back_path is null or back_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  add column if not exists selfie_path text check (selfie_path is null or selfie_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  add column if not exists id_number text check (id_number is null or id_number ~ '^[0-9]{9}[A-Z]{2}[0-9]{3}$');
-- O mesmo BI não pode estar em dois pedidos de identidade ativos (à espera ou aprovados).
create unique index if not exists verification_id_number_once on public.verification_requests(id_number)
  where kind = 'identity' and id_number is not null and status in ('pending', 'approved');

-- Número do BI angolano: 9 algarismos, 2 letras (província) e 3 algarismos. Ex.: 004512345LA042.
create or replace function public.normalize_bi(p text) returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.request_identity_verification(p_front_path text, p_back_path text, p_selfie_path text, p_id_number text, p_note text default null)
returns public.verification_requests language plpgsql security definer set search_path = public as $$
declare v public.verification_requests; me uuid := auth.uid(); bi text := public.normalize_bi(p_id_number);
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if coalesce((select kyc_level from public.profiles where id = me), 0) >= 1 then raise exception 'ALREADY_VERIFIED'; end if;
  if p_front_path is null or p_back_path is null or p_selfie_path is null then raise exception 'IDENTITY_PHOTOS_REQUIRED'; end if;
  if split_part(p_front_path, '/', 1) <> me::text or split_part(p_back_path, '/', 1) <> me::text or split_part(p_selfie_path, '/', 1) <> me::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_front_path = p_back_path or p_front_path = p_selfie_path or p_back_path = p_selfie_path then raise exception 'IDENTITY_PHOTOS_REQUIRED'; end if;
  if bi !~ '^[0-9]{9}[A-Z]{2}[0-9]{3}$' then raise exception 'INVALID_BI_NUMBER'; end if;
  if exists (select 1 from public.verification_requests where user_id = me and kind = 'identity' and status = 'pending') then raise exception 'VERIFICATION_PENDING'; end if;
  if exists (select 1 from public.verification_requests where id_number = bi and kind = 'identity' and status in ('pending', 'approved') and user_id <> me) then raise exception 'BI_ALREADY_USED'; end if;
  insert into public.verification_requests(user_id, kind, document_path, back_path, selfie_path, id_number, note)
  values (me, 'identity', p_front_path, p_back_path, p_selfie_path, bi, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', 'Identidade (BI + selfie)', jsonb_build_object('verification_id', v.id));
  return v;
end $$;

-- A identidade passa a precisar do BI frente/verso e da selfie: o pedido antigo (um só documento) fica para profissional e empresa.
create or replace function public.request_verification(p_kind text, p_business_id uuid default null, p_document_path text default null, p_note text default null)
returns public.verification_requests language plpgsql security definer set search_path = public as $$
declare v public.verification_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind = 'identity' then raise exception 'IDENTITY_NEEDS_SELFIE'; end if;
  if p_kind not in ('provider', 'business') then raise exception 'INVALID_KIND'; end if;
  if p_kind = 'provider' and not exists (select 1 from public.provider_profiles where user_id = auth.uid()) then raise exception 'NO_PROVIDER_PROFILE'; end if;
  if p_kind = 'business' and not exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()) then raise exception 'NOT_BUSINESS_OWNER'; end if;
  if p_document_path is not null and split_part(p_document_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_document_path is null then raise exception 'DOCUMENT_REQUIRED'; end if;
  if exists (select 1 from public.verification_requests where user_id = auth.uid() and kind = p_kind and status = 'pending'
             and business_id is not distinct from case when p_kind = 'business' then p_business_id end) then raise exception 'VERIFICATION_PENDING'; end if;
  insert into public.verification_requests(user_id, kind, business_id, document_path, note)
  values (auth.uid(), p_kind, case when p_kind = 'business' then p_business_id end, p_document_path, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', case p_kind when 'provider' then 'Profissional' else 'Empresa' end, jsonb_build_object('verification_id', v.id));
  return v;
end $$;

-- Administração: tudo o que precisa para comparar o rosto da selfie com o do BI e o nome do BI com o da conta.
create or replace function public.admin_list_verifications_v2(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.pending desc, x.created_at), '[]') from (
    select v.id, v.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador') user_name, p.phone, p.created_at account_created_at, v.kind, v.business_id, b.name business_name,
      v.document_path, v.back_path, v.selfie_path, v.id_number, v.note, v.status, v.admin_note, v.created_at, v.decided_at, v.status = 'pending' pending,
      (select count(*) from public.verification_requests o where o.user_id = v.user_id and o.kind = v.kind and o.status = 'rejected') previous_rejections
    from public.verification_requests v left join public.profiles p on p.id = v.user_id left join public.businesses b on b.id = v.business_id
    where coalesce(p_status, '') = '' or v.status = p_status
    order by (v.status = 'pending') desc, v.created_at limit 200) x);
end $$;

-- Os meus pedidos: indica se a identidade já tem as três fotografias.
create or replace function public.my_verifications_v2() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select v.id, v.kind, v.business_id, b.name business_name, v.status, v.admin_note, v.created_at, v.decided_at,
      case when v.id_number is not null then '•••••' || right(v.id_number, 5) end id_number_hint, v.selfie_path is not null has_selfie
    from public.verification_requests v left join public.businesses b on b.id = v.business_id
    where v.user_id = auth.uid() order by v.created_at desc limit 50) x
$$;

-- Dois passos: quem ativou a APP autenticadora só tem poderes de administração com a sessão confirmada pelo código.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
create or replace function public.has_admin_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('moderator','admin'))
     and public.current_user_active() and public.mfa_ok();
$$;

revoke all on function public.request_identity_verification(text, text, text, text, text) from public, anon;
grant execute on function public.request_identity_verification(text, text, text, text, text) to authenticated;
revoke all on function public.admin_list_verifications_v2(text) from public, anon;
grant execute on function public.admin_list_verifications_v2(text) to authenticated;
revoke all on function public.my_verifications_v2() from public, anon;
grant execute on function public.my_verifications_v2() to authenticated;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;
