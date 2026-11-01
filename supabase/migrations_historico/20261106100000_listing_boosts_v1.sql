-- Destaques pagos: o vendedor paga (500 Kz por 7 dias, a administração pode mudar) para o anúncio aparecer
-- no topo das listas com o selo «⭐ Destaque». Paga por transferência/Multicaixa Express com referência ou
-- comprovativo; fica ativo quando a administração confirma. Termina sozinho no fim do prazo.

alter table public.platform_settings
  add column if not exists boost_price_kz numeric not null default 500 check (boost_price_kz >= 0),
  add column if not exists boost_days integer not null default 7 check (boost_days between 1 and 60);
grant update (boost_price_kz, boost_days) on public.platform_settings to authenticated;

alter table public.classified_listings add column if not exists featured_until timestamptz;
create index if not exists classified_listings_featured_until on public.classified_listings(featured_until) where featured_until is not null;

-- O dono não pode pôr destaque sozinho; as funções do servidor podem (huambo.allow_feature).
create or replace function public.guard_classified_listing() returns trigger
language plpgsql security definer set search_path = public as $$
declare admin boolean := public.has_admin_role(); allow_feature boolean := coalesce(current_setting('huambo.allow_feature', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not admin then
      if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
      new.status := 'draft'; new.featured := false; new.featured_until := null;
    end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  if not admin then
    if not allow_feature then new.featured := old.featured; new.featured_until := old.featured_until; end if;
    if new.status = 'published' and old.status is distinct from 'published'
       and coalesce(current_setting('huambo.allow_publish', true), '') <> 'on' then
      raise exception 'USE_PUBLISH_FUNCTION';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create table if not exists public.listing_boosts (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity (start with 1001) unique,
  listing_id uuid not null references public.classified_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  days integer not null check (days between 1 and 60),
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'expired', 'cancelled')),
  method text check (method is null or method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'),
  starts_at timestamptz,
  ends_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create unique index if not exists listing_boosts_one_pending on public.listing_boosts(listing_id) where status = 'pending';
create index if not exists listing_boosts_owner on public.listing_boosts(owner_id, created_at desc);
create index if not exists listing_boosts_status on public.listing_boosts(status, created_at);
create index if not exists listing_boosts_decided_by on public.listing_boosts(decided_by);
alter table public.listing_boosts enable row level security;
create policy listing_boosts_own_read on public.listing_boosts for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.listing_boosts from anon, authenticated;
grant select on public.listing_boosts to authenticated;

create or replace function public.request_listing_boost(p_listing_id uuid, p_method text, p_reference text default null, p_proof_path text default null)
returns public.listing_boosts language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; st public.platform_settings; b public.listing_boosts; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if l.status <> 'published' then raise exception 'LISTING_NOT_PUBLISHED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.listing_boosts where listing_id = l.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.listing_boosts(listing_id, owner_id, days, amount, method, reference, proof_path)
  values (l.id, auth.uid(), st.boost_days, st.boost_price_kz, p_method, ref, p_proof_path) returning * into b;
  perform public.notify_staff('Destaque para confirmar', b.amount || ' Kz · ' || l.title || ' · D-' || b.ref_no, jsonb_build_object('boost_id', b.id, 'listing_id', l.id));
  return b;
end $$;

create or replace function public.admin_decide_boost(p_boost_id uuid, p_confirm boolean, p_note text default null)
returns public.listing_boosts language plpgsql security definer set search_path = public as $$
declare b public.listing_boosts; l public.classified_listings; s timestamptz; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into b from public.listing_boosts where id = p_boost_id for update;
  if not found then raise exception 'BOOST_NOT_FOUND'; end if;
  if b.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  select * into l from public.classified_listings where id = b.listing_id for update;
  if p_confirm then
    s := greatest(now(), coalesce(l.featured_until, now()));
    update public.listing_boosts set status = 'active', starts_at = s, ends_at = s + make_interval(days => b.days), admin_note = txt,
      decided_at = now(), decided_by = auth.uid() where id = b.id returning * into b;
    perform set_config('huambo.allow_feature', 'on', true);
    update public.classified_listings set featured = true, featured_until = b.ends_at where id = l.id;
    perform set_config('huambo.allow_feature', '', true);
    insert into public.notifications(user_id, type, title, body, data)
    values (b.owner_id, 'system', 'Anúncio em destaque ⭐', '«' || l.title || '» aparece em destaque até ' || to_char(b.ends_at at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.',
      jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  else
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_boosts set status = 'rejected', admin_note = txt, decided_at = now(), decided_by = auth.uid() where id = b.id returning * into b;
    insert into public.notifications(user_id, type, title, body, data)
    values (b.owner_id, 'system', 'Destaque não confirmado', txt, jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'boost_confirmed' else 'boost_rejected' end, 'listing', l.id, jsonb_build_object('boost_id', b.id, 'amount', b.amount));
  return b;
end $$;

create or replace function public.my_listing_boosts()
returns table(id uuid, ref_no bigint, listing_id uuid, listing_title text, days integer, amount numeric, status text, method text, reference text,
  starts_at timestamptz, ends_at timestamptz, admin_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.ref_no, b.listing_id, l.title, b.days, b.amount, b.status, b.method, b.reference, b.starts_at, b.ends_at, b.admin_note, b.created_at
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id
  where b.owner_id = auth.uid() order by b.created_at desc limit 200;
$$;

create or replace function public.admin_list_boosts(p_status text default 'pending')
returns table(id uuid, ref_no bigint, listing_id uuid, listing_title text, owner_id uuid, owner_name text, phone text, days integer, amount numeric,
  status text, method text, reference text, proof_path text, starts_at timestamptz, ends_at timestamptz, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select b.id, b.ref_no, b.listing_id, l.title, b.owner_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.phone, b.days, b.amount,
    b.status, b.method, b.reference, b.proof_path, b.starts_at, b.ends_at, b.admin_note, b.created_at
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles p on p.id = b.owner_id
  where p_status is null or b.status = p_status order by b.created_at desc limit 300;
end $$;

-- Fim dos destaques (de hora a hora). Destaques postos à mão pela administração (sem prazo) não mudam.
create or replace function public.boost_expire()
returns integer language plpgsql security definer set search_path = public as $$
declare l record; n integer := 0;
begin
  perform set_config('huambo.allow_feature', 'on', true);
  for l in update public.classified_listings set featured = false, featured_until = null
      where featured_until is not null and featured_until <= now() returning id, owner_id, title loop
    n := n + 1;
    insert into public.notifications(user_id, type, title, body, data)
    values (l.owner_id, 'system', 'O destaque terminou', '«' || l.title || '» já não está em destaque. Pode destacar outra vez em «Os meus anúncios».',
      jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  end loop;
  perform set_config('huambo.allow_feature', '', true);
  update public.listing_boosts set status = 'expired' where status = 'active' and ends_at <= now();
  return n;
end $$;
select cron.schedule('huambo-online-boost-expire', '7 * * * *', 'select public.boost_expire();');

-- Receitas: junta os destaques.
create or replace function public.admin_revenue(p_from date, p_to date)
returns table(paid_at timestamptz, kind text, description text, payer_name text, amount numeric, method text, reference text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_PERIOD'; end if;
  return query
  select p.decided_at, 'plan_' || s.kind, public.plan_subject_name(s) || ' · ' || p.months || case when p.months = 1 then ' mês' else ' meses' end,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), p.amount, p.method, p.reference
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'confirmed' and (p.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select c.decided_at, 'commission', c.listing_title || ' · venda ' || c.sale_amount || ' Kz', coalesce(nullif(pr.full_name, ''), 'Utilizador'), c.amount, c.method, c.reference
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where c.status = 'paid' and (c.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select o.released_at, 'protected_fee', 'Pagamento protegido · ' || public.order_ref(o) || ' · ' || (o.total - o.refunded_amount) || ' Kz',
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), o.platform_fee, null::text, null::text
  from public.orders o left join public.profiles pr on pr.id = o.seller_id
  where o.platform_fee > 0 and (o.released_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select b.decided_at, 'boost', 'Destaque D-' || b.ref_no || ' · ' || l.title || ' · ' || b.days || ' dias', coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.method, b.reference
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles pr on pr.id = b.owner_id
  where b.status in ('active', 'expired') and b.amount > 0 and (b.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $$;

revoke all on function public.boost_expire() from public, anon, authenticated;
revoke all on function public.request_listing_boost(uuid, text, text, text) from public, anon;
revoke all on function public.admin_decide_boost(uuid, boolean, text) from public, anon;
revoke all on function public.my_listing_boosts() from public, anon;
revoke all on function public.admin_list_boosts(text) from public, anon;
grant execute on function public.request_listing_boost(uuid, text, text, text) to authenticated;
grant execute on function public.admin_decide_boost(uuid, boolean, text) to authenticated;
grant execute on function public.my_listing_boosts() to authenticated;
grant execute on function public.admin_list_boosts(text) to authenticated;
