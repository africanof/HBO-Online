-- Garantia de conformidade (igual no Site e na APP): o anúncio tem de corresponder ao artigo.
-- • Para publicar um anúncio (venda, aluguer, arrendamento, leilão…) ou pôr um produto à venda na Loja, o dono
--   declara que a descrição é verdadeira e completa, incluindo defeitos (conformity_accepted_at).
-- • Se houver omissão ou erro, quem comprou/arrendou abre uma reclamação até claim_days dias depois do negócio
--   e pede TROCA, DEVOLUÇÃO com reembolso ou REEMBOLSO. O dono aceita ou recusa (com o motivo); se recusar ou não
--   responder em 3 dias, a reclamação vai para a administração, que decide. A decisão a favor do comprador obriga
--   o dono a cumprir (sob pena de suspensão da conta).
-- • Na Loja (encomendas) continua a valer o sistema de devoluções e reembolsos que já existe.

alter table public.platform_settings
  add column if not exists claim_days integer not null default 7 check (claim_days between 1 and 60);
grant update (claim_days) on public.platform_settings to authenticated;

alter table public.classified_listings add column if not exists conformity_accepted_at timestamptz;
alter table public.products add column if not exists conformity_accepted_at timestamptz;

-- Sem a declaração não se publica (os pedidos «Procura-se» não precisam).
create or replace function public.require_listing_conformity() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.purpose <> 'wanted' and new.conformity_accepted_at is null then
    raise exception 'CONFORMITY_REQUIRED';
  end if;
  return new;
end $$;
create trigger require_listing_conformity before insert or update of status on public.classified_listings
  for each row execute function public.require_listing_conformity();

create or replace function public.require_product_conformity() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.active and (tg_op = 'INSERT' or not old.active or old.conformity_accepted_at is null) and new.conformity_accepted_at is null then
    raise exception 'CONFORMITY_REQUIRED';
  end if;
  return new;
end $$;
create trigger require_product_conformity before insert or update on public.products
  for each row execute function public.require_product_conformity();

create sequence if not exists public.listing_claims_ref_no_seq start 1001;
create table if not exists public.listing_claims (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.listing_claims_ref_no_seq'),
  listing_id uuid references public.classified_listings(id) on delete set null,
  listing_title text not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  request text not null check (request in ('exchange', 'return_refund', 'refund')),
  reason text not null check (reason in ('omitted_defect', 'not_as_described', 'wrong_item', 'missing_parts', 'other')),
  description text not null check (char_length(trim(description)) between 10 and 1000),
  amount numeric check (amount is null or amount > 0),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'escalated', 'resolved')),
  outcome text check (outcome is null or outcome in ('done', 'rejected', 'withdrawn')),
  seller_note text check (seller_note is null or char_length(seller_note) <= 1000),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  decided_by_admin boolean not null default false,
  respond_by timestamptz not null default now() + interval '3 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'resolved') = (outcome is not null))
);
create unique index if not exists listing_claims_one_active on public.listing_claims(listing_id, buyer_id) where status <> 'resolved';
create index if not exists listing_claims_buyer_idx on public.listing_claims(buyer_id, created_at desc);
create index if not exists listing_claims_seller_idx on public.listing_claims(seller_id, created_at desc);
create index if not exists listing_claims_status_idx on public.listing_claims(status, respond_by);
alter table public.listing_claims enable row level security;
create policy listing_claims_parties_read on public.listing_claims for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.listing_claims from anon;
grant select on public.listing_claims to authenticated;

-- Até quando posso reclamar deste anúncio? (null = não posso)
create or replace function public.listing_claim_deadline(p_listing_id uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.classified_listings; days int; since timestamptz;
begin
  if me is null then return null; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.owner_id = me then return null; end if;
  select claim_days into days from public.platform_settings where id = 1;
  if l.deal_with = me and l.status in ('sold', 'rented') then since := l.deal_at; end if;
  select greatest(since, max(r.starts_at)) into since from public.rental_requests r where r.listing_id = l.id and r.renter_id = me and r.status = 'accepted';
  if since is null then return null; end if;
  if since + make_interval(days => days) < now() then return null; end if;
  return since + make_interval(days => days);
end $$;

create or replace function public.open_listing_claim(p_listing_id uuid, p_request text, p_reason text, p_description text, p_amount numeric default null)
returns public.listing_claims language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.classified_listings; c public.listing_claims;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if public.listing_claim_deadline(p_listing_id) is null then raise exception 'CLAIM_NOT_ALLOWED'; end if;
  if p_request not in ('exchange', 'return_refund', 'refund') or p_reason not in ('omitted_defect', 'not_as_described', 'wrong_item', 'missing_parts', 'other') then raise exception 'INVALID_CLAIM'; end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then raise exception 'CLAIM_DESCRIPTION_REQUIRED'; end if;
  if exists (select 1 from public.listing_claims where listing_id = l.id and buyer_id = me and status <> 'resolved') then raise exception 'CLAIM_ALREADY_OPEN'; end if;
  insert into public.listing_claims(listing_id, listing_title, buyer_id, seller_id, request, reason, description, amount)
  values (l.id, left(l.title, 200), me, l.owner_id, p_request, p_reason, left(trim(p_description), 1000), case when p_request = 'exchange' then null else p_amount end)
  returning * into c;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Reclamação: o artigo não corresponde ao anúncio',
    '«' || left(l.title, 120) || '» (R-' || c.ref_no || '). Responda em 3 dias; se não responder, a administração decide.', jsonb_build_object('for', 'claim'));
  return c;
end $$;

-- Dono: aceitar (com o que vai fazer) ou recusar (com o motivo).
create or replace function public.respond_listing_claim(p_claim_id uuid, p_accept boolean, p_note text default null)
returns public.listing_claims language plpgsql security definer set search_path = public as $$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found or c.seller_id <> auth.uid() then raise exception 'CLAIM_NOT_FOUND'; end if;
  if c.status <> 'open' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_accept and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.listing_claims set status = case when p_accept then 'accepted' else 'declined' end, seller_note = txt, updated_at = now()
   where id = c.id returning * into c;
  insert into public.notifications(user_id, type, title, body, data)
  values (c.buyer_id, 'system', case when p_accept then 'Reclamação aceite ✔' else 'Reclamação recusada' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): ' || coalesce(txt, case when p_accept then 'o vendedor aceitou.' else '' end)
    || case when p_accept then '' else ' Pode pedir à administração para decidir.' end, jsonb_build_object('for', 'claim'));
  return c;
end $$;

-- Comprador: resolvido (confirmar), desistir, ou pedir à administração.
create or replace function public.buyer_listing_claim(p_claim_id uuid, p_action text, p_note text default null)
returns public.listing_claims language plpgsql security definer set search_path = public as $$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found or c.buyer_id <> auth.uid() then raise exception 'CLAIM_NOT_FOUND'; end if;
  if p_action = 'confirm' and c.status in ('accepted', 'open', 'escalated', 'declined') then
    update public.listing_claims set status = 'resolved', outcome = 'done', resolved_at = now(), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'withdraw' and c.status <> 'resolved' then
    update public.listing_claims set status = 'resolved', outcome = 'withdrawn', resolved_at = now(), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'escalate' and (c.status = 'declined' or (c.status in ('open', 'accepted') and (c.respond_by < now() or c.status = 'accepted'))) then
    update public.listing_claims set status = 'escalated', admin_note = coalesce(admin_note, txt), updated_at = now() where id = c.id returning * into c;
    perform public.notify_staff('Reclamação de anúncio para decidir', 'R-' || c.ref_no || ' · ' || left(c.listing_title, 100), jsonb_build_object('claim_id', c.id));
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (c.seller_id, 'system', case p_action when 'confirm' then 'Reclamação resolvida ✔' when 'withdraw' then 'Reclamação retirada' else 'Reclamação enviada à administração' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || ')' || case when txt is not null then ': ' || txt else '.' end, jsonb_build_object('for', 'claim'));
  return c;
end $$;

create or replace function public.my_listing_claims()
returns table (id uuid, ref_no bigint, listing_id uuid, listing_title text, role text, other_name text, request text, reason text, description text,
  amount numeric, status text, outcome text, seller_note text, admin_note text, decided_by_admin boolean, respond_by timestamptz, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.ref_no, c.listing_id, c.listing_title, case when c.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.request, c.reason, c.description, c.amount, c.status, c.outcome, c.seller_note, c.admin_note,
    c.decided_by_admin, c.respond_by, c.created_at, c.updated_at
  from public.listing_claims c left join public.profiles p on p.id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  where c.buyer_id = auth.uid() or c.seller_id = auth.uid()
  order by c.updated_at desc limit 200
$$;

-- Administração.
create or replace function public.admin_list_listing_claims(p_status text default 'escalated')
returns table (id uuid, ref_no bigint, listing_id uuid, listing_title text, buyer_name text, seller_name text, seller_id uuid, request text, reason text,
  description text, amount numeric, status text, outcome text, seller_note text, admin_note text, created_at timestamptz, seller_claims bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.ref_no, c.listing_id, c.listing_title, coalesce(nullif(b.full_name, ''), 'Comprador'), coalesce(nullif(s.full_name, ''), 'Vendedor'),
    c.seller_id, c.request, c.reason, c.description, c.amount, c.status, c.outcome, c.seller_note, c.admin_note, c.created_at,
    (select count(*) from public.listing_claims x where x.seller_id = c.seller_id)
  from public.listing_claims c left join public.profiles b on b.id = c.buyer_id left join public.profiles s on s.id = c.seller_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 300;
end $$;

-- Decisão: a favor do comprador (o dono tem de cumprir) ou contra (fica resolvida).
create or replace function public.admin_decide_listing_claim(p_claim_id uuid, p_uphold boolean, p_note text)
returns public.listing_claims language plpgsql security definer set search_path = public as $$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found then raise exception 'CLAIM_NOT_FOUND'; end if;
  if c.status = 'resolved' then raise exception 'INVALID_TRANSITION'; end if;
  if p_uphold then
    update public.listing_claims set status = 'accepted', admin_note = txt, decided_by_admin = true, updated_at = now() where id = c.id returning * into c;
  else
    update public.listing_claims set status = 'resolved', outcome = 'rejected', admin_note = txt, decided_by_admin = true, resolved_at = now(), updated_at = now()
     where id = c.id returning * into c;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  select x.u, 'system', case when p_uphold then 'Decisão: o comprador tem razão' else 'Decisão: reclamação recusada' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): ' || txt
    || case when p_uphold and x.u = c.seller_id then ' Tem de fazer a troca, a devolução ou o reembolso pedido; se não cumprir, a conta pode ser suspensa.' else '' end,
    jsonb_build_object('for', 'claim')
  from (values (c.buyer_id), (c.seller_id)) x(u);
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_uphold then 'claim_upheld' else 'claim_rejected' end, 'listing', c.listing_id, jsonb_build_object('claim_id', c.id, 'ref', c.ref_no));
  return c;
end $$;

-- Sem resposta do dono em 3 dias → administração.
create or replace function public.listing_claims_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; c record;
begin
  for c in select * from public.listing_claims where status = 'open' and respond_by < now() for update skip locked loop
    update public.listing_claims set status = 'escalated', updated_at = now() where id = c.id;
    insert into public.notifications(user_id, type, title, body, data)
    select x.u, 'system', 'Reclamação enviada à administração', '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): o vendedor não respondeu em 3 dias.',
      jsonb_build_object('for', 'claim') from (values (c.buyer_id), (c.seller_id)) x(u);
    perform public.notify_staff('Reclamação de anúncio para decidir', 'R-' || c.ref_no || ' · sem resposta do vendedor', jsonb_build_object('claim_id', c.id));
    n := n + 1;
  end loop;
  return n;
end $$;
select cron.schedule('huambo-online-claims-tick', '23 * * * *', 'select public.listing_claims_tick()');

revoke all on function public.require_listing_conformity() from public, anon, authenticated;
revoke all on function public.require_product_conformity() from public, anon, authenticated;
revoke all on function public.listing_claims_tick() from public, anon, authenticated;
revoke all on function public.listing_claim_deadline(uuid) from public, anon;
revoke all on function public.open_listing_claim(uuid, text, text, text, numeric) from public, anon;
revoke all on function public.respond_listing_claim(uuid, boolean, text) from public, anon;
revoke all on function public.buyer_listing_claim(uuid, text, text) from public, anon;
revoke all on function public.my_listing_claims() from public, anon;
revoke all on function public.admin_list_listing_claims(text) from public, anon;
revoke all on function public.admin_decide_listing_claim(uuid, boolean, text) from public, anon;
grant execute on function public.listing_claim_deadline(uuid) to authenticated;
grant execute on function public.open_listing_claim(uuid, text, text, text, numeric) to authenticated;
grant execute on function public.respond_listing_claim(uuid, boolean, text) to authenticated;
grant execute on function public.buyer_listing_claim(uuid, text, text) to authenticated;
grant execute on function public.my_listing_claims() to authenticated;
grant execute on function public.admin_list_listing_claims(text) to authenticated;
grant execute on function public.admin_decide_listing_claim(uuid, boolean, text) to authenticated;
