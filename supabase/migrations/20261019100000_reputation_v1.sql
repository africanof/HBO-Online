-- Reputação: avaliações entre vendedores e compradores (só depois de um negócio real),
-- pedidos de serviço com confirmação, e números públicos de cada perfil.

-- 1) Avaliações entre pessoas -------------------------------------------------------
create table if not exists public.user_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('seller', 'buyer')),           -- papel de quem é avaliado
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  order_id uuid,                                                    -- encomenda da Loja
  listing_id uuid,                                                  -- anúncio vendido/arrendado
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  check (author_id <> target_id),
  check ((order_id is not null)::int + (listing_id is not null)::int = 1)
);
create unique index if not exists user_reviews_author_order on public.user_reviews(author_id, order_id) where order_id is not null;
create unique index if not exists user_reviews_author_listing on public.user_reviews(author_id, listing_id) where listing_id is not null;
create index if not exists user_reviews_target on public.user_reviews(target_id, role) where status = 'published';
alter table public.user_reviews enable row level security;
create policy user_reviews_public_read on public.user_reviews for select to anon, authenticated using (status = 'published');
revoke all on public.user_reviews from anon, authenticated;
grant select on public.user_reviews to anon, authenticated;

-- Com quem foi feito o negócio de um anúncio (escolhido pelo dono ao marcar vendido).
alter table public.classified_listings add column if not exists deal_with uuid references auth.users(id) on delete set null;
alter table public.classified_listings add column if not exists deal_at timestamptz;
create or replace function public.guard_listing_deal() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.deal_with is distinct from old.deal_with and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'USE_SERVER_FUNCTIONS';
  end if;
  return new;
end $$;
create trigger trg_guard_listing_deal before update of deal_with on public.classified_listings
  for each row execute function public.guard_listing_deal();

-- Pessoas que falaram com o dono sobre o anúncio (candidatas ao negócio).
create or replace function public.listing_deal_candidates(p_listing_id uuid)
returns table(user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select distinct cp.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador')
  from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
  left join public.profiles p on p.id = cp.user_id
  where c.classified_listing_id = p_listing_id and cp.user_id <> auth.uid();
end $$;

-- Fecha o anúncio com a pessoa do negócio (vendido, arrendado, ou pedido "Procuro" resolvido).
create or replace function public.set_listing_deal(p_listing_id uuid, p_status text, p_counterpart uuid)
returns public.classified_listings language plpgsql security definer set search_path = public as $$
declare l public.classified_listings;
begin
  if p_status not in ('sold', 'rented', 'closed') then raise exception 'INVALID_FINAL_STATUS'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if not exists (select 1 from public.listing_deal_candidates(p_listing_id) c where c.user_id = p_counterpart) then raise exception 'NOT_A_DEAL_PARTNER'; end if;
  update public.classified_listings set status = p_status, deal_with = p_counterpart, deal_at = now(), updated_at = now()
   where id = l.id returning * into l;
  insert into public.notifications(user_id, type, title, body, data)
  values (p_counterpart, 'system', 'Negócio concluído — avalie', 'Concluiu um negócio: «' || l.title || '». Deixe a sua avaliação.',
          jsonb_build_object('listing_id', l.id, 'for', 'review'));
  return l;
end $$;

-- Avaliar a outra pessoa de uma encomenda concluída ou de um anúncio com negócio.
create or replace function public.submit_deal_review(p_kind text, p_ref uuid, p_rating integer, p_comment text default null)
returns public.user_reviews language plpgsql security definer set search_path = public as $$
declare o public.orders; l public.classified_listings; target uuid; r_role text; rv public.user_reviews;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if p_kind = 'order' then
    select * into o from public.orders where id = p_ref;
    if not found or o.status <> 'completed' then raise exception 'DEAL_NOT_COMPLETED'; end if;
    if auth.uid() = o.buyer_id then target := o.seller_id; r_role := 'seller';
    elsif auth.uid() = o.seller_id then target := o.buyer_id; r_role := 'buyer';
    else raise exception 'NOT_DEAL_PARTY'; end if;
  elsif p_kind = 'listing' then
    select * into l from public.classified_listings where id = p_ref;
    if not found or l.deal_with is null or l.status not in ('sold', 'rented', 'closed') then raise exception 'DEAL_NOT_COMPLETED'; end if;
    if auth.uid() = l.owner_id then target := l.deal_with; r_role := case when l.purpose = 'wanted' then 'seller' else 'buyer' end;
    elsif auth.uid() = l.deal_with then target := l.owner_id; r_role := case when l.purpose = 'wanted' then 'buyer' else 'seller' end;
    else raise exception 'NOT_DEAL_PARTY'; end if;
  else raise exception 'INVALID_KIND'; end if;

  select * into rv from public.user_reviews where author_id = auth.uid()
    and ((p_kind = 'order' and order_id = p_ref) or (p_kind = 'listing' and listing_id = p_ref));
  if found then
    update public.user_reviews set rating = p_rating, comment = nullif(trim(coalesce(p_comment, '')), ''), created_at = now()
     where id = rv.id returning * into rv;
  else
    insert into public.user_reviews(author_id, target_id, role, rating, comment, order_id, listing_id)
    values (auth.uid(), target, r_role, p_rating, nullif(trim(coalesce(p_comment, '')), ''),
            case when p_kind = 'order' then p_ref end, case when p_kind = 'listing' then p_ref end)
    returning * into rv;
    insert into public.notifications(user_id, type, title, body, data)
    values (target, 'review', 'Recebeu uma avaliação', p_rating || ' estrela(s) como ' || case r_role when 'seller' then 'vendedor' else 'comprador' end
            || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 140), ''), jsonb_build_object('for', 'profile', 'user_id', target));
  end if;
  return rv;
end $$;

-- Avaliações recebidas por uma pessoa (públicas).
create or replace function public.user_reviews_for(p_user_id uuid)
returns table(id uuid, role text, rating smallint, comment text, created_at timestamptz, author_name text, kind text)
language sql stable security definer set search_path = public as $$
  select r.id, r.role, r.rating, r.comment, r.created_at, coalesce(nullif(p.full_name, ''), 'Utilizador'),
         case when r.order_id is not null then 'order' else 'listing' end
  from public.user_reviews r left join public.profiles p on p.id = r.author_id
  where r.target_id = p_user_id and r.status = 'published'
  order by r.created_at desc limit 100;
$$;

revoke all on function public.listing_deal_candidates(uuid) from public, anon;
revoke all on function public.set_listing_deal(uuid, text, uuid) from public, anon;
revoke all on function public.submit_deal_review(text, uuid, integer, text) from public, anon;
grant execute on function public.listing_deal_candidates(uuid) to authenticated;
grant execute on function public.set_listing_deal(uuid, text, uuid) to authenticated;
grant execute on function public.submit_deal_review(text, uuid, integer, text) to authenticated;
grant execute on function public.user_reviews_for(uuid) to anon, authenticated;

-- 2) Pedidos de serviço (profissionais e empresas) -------------------------------------
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete cascade,        -- profissional (user_id)
  business_id uuid references public.businesses(id) on delete cascade, -- empresa
  description text not null check (char_length(trim(description)) between 3 and 1000),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'done', 'confirmed', 'cancelled')),
  provider_note text check (provider_note is null or char_length(provider_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_id is not null)::int + (business_id is not null)::int = 1)
);
create index if not exists service_requests_client on public.service_requests(client_id, created_at desc);
create index if not exists service_requests_provider on public.service_requests(provider_id, created_at desc) where provider_id is not null;
create index if not exists service_requests_business on public.service_requests(business_id, created_at desc) where business_id is not null;
alter table public.service_requests enable row level security;
create policy service_requests_parties_read on public.service_requests for select to authenticated using (
  client_id = auth.uid() or provider_id = auth.uid()
  or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
revoke all on public.service_requests from anon, authenticated;
grant select on public.service_requests to authenticated;

-- Avaliações confirmadas por um serviço prestado.
alter table public.reviews add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;
create unique index if not exists reviews_service_request_once on public.reviews(service_request_id) where service_request_id is not null;

-- Dono do lado que presta o serviço.
create or replace function public.service_request_owner(r public.service_requests) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(r.provider_id, (select b.owner_id from public.businesses b where b.id = r.business_id));
$$;
revoke all on function public.service_request_owner(public.service_requests) from public, anon, authenticated;

create or replace function public.request_service(p_provider_id uuid, p_business_id uuid, p_description text)
returns public.service_requests language plpgsql security definer set search_path = public as $$
declare r public.service_requests; owner uuid; who text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'INVALID_TARGET'; end if;
  if char_length(trim(coalesce(p_description, ''))) < 3 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_provider_id is not null then
    select pp.user_id, pp.display_name into owner, who from public.provider_profiles pp where pp.user_id = p_provider_id and pp.active;
  else
    select b.owner_id, b.name into owner, who from public.businesses b where b.id = p_business_id and b.active;
  end if;
  if owner is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_REQUEST_OWN_SERVICE'; end if;
  if (select count(*) from public.service_requests s where s.client_id = auth.uid() and s.created_at > now() - interval '1 day') >= 20 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.service_requests(client_id, provider_id, business_id, description)
  values (auth.uid(), p_provider_id, p_business_id, left(trim(p_description), 1000)) returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'system', 'Novo pedido de serviço', left(trim(p_description), 160), jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $$;

-- O profissional/empresa aceita, recusa ou marca como concluído; o cliente cancela.
create or replace function public.update_service_request(p_id uuid, p_action text, p_note text default null)
returns public.service_requests language plpgsql security definer set search_path = public as $$
declare r public.service_requests; owner uuid; next_status text; notify_to uuid; msg text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  owner := public.service_request_owner(r);
  if p_action in ('accept', 'decline', 'done') then
    if auth.uid() <> owner then raise exception 'NOT_SERVICE_PROVIDER'; end if;
    if p_action = 'accept' and r.status = 'requested' then next_status := 'accepted'; msg := 'O seu pedido de serviço foi aceite.';
    elsif p_action = 'decline' and r.status in ('requested', 'accepted') then next_status := 'declined'; msg := 'O seu pedido de serviço foi recusado.';
    elsif p_action = 'done' and r.status in ('requested', 'accepted') then next_status := 'done'; msg := 'Serviço concluído: confirme e avalie.';
    else raise exception 'INVALID_TRANSITION'; end if;
    notify_to := r.client_id;
  elsif p_action = 'cancel' then
    if auth.uid() <> r.client_id then raise exception 'NOT_SERVICE_CLIENT'; end if;
    if r.status not in ('requested', 'accepted') then raise exception 'INVALID_TRANSITION'; end if;
    next_status := 'cancelled'; msg := 'O cliente cancelou o pedido de serviço.'; notify_to := owner;
  else raise exception 'INVALID_ACTION'; end if;
  update public.service_requests set status = next_status, updated_at = now(),
    provider_note = case when p_action in ('accept', 'decline', 'done') then coalesce(nullif(left(trim(coalesce(p_note, '')), 500), ''), provider_note) else provider_note end
   where id = r.id returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (notify_to, 'system', 'Pedido de serviço', msg || coalesce(' ' || nullif(left(trim(coalesce(p_note, '')), 140), ''), ''),
          jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $$;

-- O cliente confirma que o serviço foi feito e avalia (avaliação «Serviço confirmado»).
create or replace function public.confirm_service(p_id uuid, p_rating integer, p_comment text default null)
returns public.service_requests language plpgsql security definer set search_path = public as $$
declare r public.service_requests; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.client_id <> auth.uid() then raise exception 'NOT_SERVICE_CLIENT'; end if;
  if r.status not in ('accepted', 'done') then raise exception 'INVALID_TRANSITION'; end if;
  owner := public.service_request_owner(r);
  update public.service_requests set status = 'confirmed', updated_at = now() where id = r.id returning * into r;
  -- Uma avaliação por pessoa e profissional/empresa: a mais recente substitui a anterior.
  update public.reviews set rating = p_rating, comment = nullif(left(trim(coalesce(p_comment, '')), 1000), ''),
         status = 'published', service_request_id = r.id, created_at = now()
   where author_id = auth.uid() and ((r.provider_id is not null and provider_id = r.provider_id) or (r.business_id is not null and business_id = r.business_id));
  if not found then
    insert into public.reviews(author_id, provider_id, business_id, rating, comment, status, service_request_id)
    values (auth.uid(), r.provider_id, r.business_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''), 'published', r.id);
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'review', 'Serviço confirmado e avaliado', p_rating || ' estrela(s)' || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 140), ''),
          jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $$;

-- Pedidos de serviço de quem está com sessão (como cliente ou como quem presta).
create or replace function public.my_service_requests(p_as text default 'client')
returns table(id uuid, status text, description text, provider_note text, created_at timestamptz, updated_at timestamptz,
  provider_id uuid, business_id uuid, target_name text, client_id uuid, client_name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente')
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  where auth.uid() is not null and case when p_as = 'provider'
    then (s.provider_id = auth.uid() or b.owner_id = auth.uid()) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$$;

-- 3) O que falta avaliar ------------------------------------------------------------
create or replace function public.my_pending_reviews()
returns table(kind text, ref_id uuid, title text, other_id uuid, other_name text, other_role text, done_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'order'::text, o.id, 'Encomenda de ' || to_char(o.created_at, 'DD/MM/YYYY'),
           case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end,
           coalesce(nullif(p.full_name, ''), 'Utilizador'),
           case when o.buyer_id = auth.uid() then 'seller' else 'buyer' end, o.updated_at
    from public.orders o left join public.profiles p on p.id = case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end
    where o.status = 'completed' and auth.uid() in (o.buyer_id, o.seller_id) and o.seller_id is not null
      and not exists (select 1 from public.user_reviews r where r.author_id = auth.uid() and r.order_id = o.id)
    union all
    select 'listing', l.id, l.title,
           case when l.owner_id = auth.uid() then l.deal_with else l.owner_id end,
           coalesce(nullif(p.full_name, ''), 'Utilizador'),
           case when (l.owner_id = auth.uid()) = (l.purpose = 'wanted') then 'seller' else 'buyer' end, l.deal_at
    from public.classified_listings l left join public.profiles p on p.id = case when l.owner_id = auth.uid() then l.deal_with else l.owner_id end
    where l.deal_with is not null and auth.uid() in (l.owner_id, l.deal_with)
      and not exists (select 1 from public.user_reviews r where r.author_id = auth.uid() and r.listing_id = l.id)
  ) t where auth.uid() is not null order by 7 desc nulls last limit 100;
$$;

-- 4) Números públicos --------------------------------------------------------------
create or replace function public.public_user_stats(p_user_id uuid)
returns table(seller_rating numeric, seller_reviews bigint, buyer_rating numeric, buyer_reviews bigint,
  sales_done bigint, purchases_done bigint, listings_sold bigint, listings_active bigint,
  services_requested bigint, services_done bigint, service_rating numeric, service_reviews bigint, member_since timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select round(avg(rating)::numeric, 1) from public.user_reviews where target_id = p_user_id and role = 'seller' and status = 'published'),
    (select count(*) from public.user_reviews where target_id = p_user_id and role = 'seller' and status = 'published'),
    (select round(avg(rating)::numeric, 1) from public.user_reviews where target_id = p_user_id and role = 'buyer' and status = 'published'),
    (select count(*) from public.user_reviews where target_id = p_user_id and role = 'buyer' and status = 'published'),
    (select count(*) from public.orders where seller_id = p_user_id and status = 'completed'),
    (select count(*) from public.orders where buyer_id = p_user_id and status = 'completed')
      + (select count(*) from public.classified_listings where deal_with = p_user_id and purpose <> 'wanted')
      + (select count(*) from public.classified_listings where owner_id = p_user_id and purpose = 'wanted' and deal_with is not null),
    (select count(*) from public.classified_listings where owner_id = p_user_id and purpose <> 'wanted' and status in ('sold', 'rented'))
      + (select count(*) from public.classified_listings where deal_with = p_user_id and purpose = 'wanted'),
    (select count(*) from public.classified_listings where owner_id = p_user_id and status = 'published'),
    (select count(*) from public.service_requests where provider_id = p_user_id),
    (select count(*) from public.service_requests where provider_id = p_user_id and status in ('done', 'confirmed')),
    (select round(avg(rating)::numeric, 1) from public.reviews where provider_id = p_user_id and status = 'published'),
    (select count(*) from public.reviews where provider_id = p_user_id and status = 'published'),
    (select created_at from public.profiles where id = p_user_id);
$$;

create or replace function public.business_stats(p_business_id uuid)
returns table(rating numeric, review_count bigint, confirmed_reviews bigint, services_requested bigint, services_done bigint,
  sales_done bigint, member_since timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select round(avg(rating)::numeric, 1) from public.reviews where business_id = p_business_id and status = 'published'),
    (select count(*) from public.reviews where business_id = p_business_id and status = 'published'),
    (select count(*) from public.reviews where business_id = p_business_id and status = 'published' and service_request_id is not null),
    (select count(*) from public.service_requests where business_id = p_business_id),
    (select count(*) from public.service_requests where business_id = p_business_id and status in ('done', 'confirmed')),
    (select count(*) from public.orders o join public.businesses b on b.owner_id = o.seller_id where b.id = p_business_id and o.status = 'completed'),
    (select created_at from public.businesses where id = p_business_id);
$$;

-- Avaliações dos profissionais/empresas com a marca «Serviço confirmado».
create or replace function public.list_reviews_v2(p_provider_id uuid default null, p_business_id uuid default null)
returns table(id uuid, rating smallint, comment text, created_at timestamptz, author_id uuid, author_name text, confirmed boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), r.service_request_id is not null
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published' and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by (r.service_request_id is not null) desc, r.created_at desc limit 100;
$$;

revoke all on function public.request_service(uuid, uuid, text) from public, anon;
revoke all on function public.update_service_request(uuid, text, text) from public, anon;
revoke all on function public.confirm_service(uuid, integer, text) from public, anon;
revoke all on function public.my_service_requests(text) from public, anon;
revoke all on function public.my_pending_reviews() from public, anon;
grant execute on function public.request_service(uuid, uuid, text) to authenticated;
grant execute on function public.update_service_request(uuid, text, text) to authenticated;
grant execute on function public.confirm_service(uuid, integer, text) to authenticated;
grant execute on function public.my_service_requests(text) to authenticated;
grant execute on function public.my_pending_reviews() to authenticated;
grant execute on function public.public_user_stats(uuid) to anon, authenticated;
grant execute on function public.business_stats(uuid) to anon, authenticated;
grant execute on function public.list_reviews_v2(uuid, uuid) to anon, authenticated;
grant execute on function public.user_reviews_for(uuid) to anon, authenticated;
