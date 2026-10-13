-- Agentes no terreno (igual no Site e na APP): pessoas nas praças (ex.: Kapango) que ajudam os vendedores a pôr
-- anúncios e ganham uma pequena comissão por cada anúncio publicado.
--
-- Como funciona:
-- 1. A pessoa pede para ser agente (escolhe a praça) e a administração aprova. Recebe um código (ex.: AG1001).
-- 2. Ao publicar, o vendedor escreve o código do agente que o ajudou. O anúncio fica na conta do VENDEDOR.
-- 3. Quando o anúncio é publicado, nasce uma comissão «à espera». A administração confirma (o valor entra no
--    saldo do agente, que levanta pelo «O meu saldo») ou recusa (com o motivo).
-- Contra abusos: o agente não ganha com os próprios anúncios; no máximo agent_daily_cap comissões por dia e
-- 5 por dia do mesmo vendedor (as outras ficam recusadas com o motivo); a administração revê antes de pagar.

alter table public.platform_settings
  add column if not exists agent_fee_kz numeric not null default 100 check (agent_fee_kz >= 0 and agent_fee_kz <= 100000),
  add column if not exists agent_daily_cap integer not null default 20 check (agent_daily_cap between 1 and 500);
grant update (agent_fee_kz, agent_daily_cap) on public.platform_settings to authenticated;

create sequence if not exists public.field_agents_code_seq start 1001;
create table if not exists public.field_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique default ('AG' || nextval('public.field_agents_code_seq')),
  market_id uuid references public.markets(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 3 and 120),
  phone text not null check (char_length(phone) between 9 and 20),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index if not exists field_agents_market_idx on public.field_agents(market_id);
create index if not exists field_agents_decided_by_idx on public.field_agents(decided_by);
alter table public.field_agents enable row level security;
create policy field_agents_own_read on public.field_agents for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.field_agents from anon;
grant select on public.field_agents to authenticated;

alter table public.classified_listings add column if not exists agent_id uuid references public.field_agents(user_id) on delete set null;
create index if not exists classified_listings_agent_idx on public.classified_listings(agent_id);

create table if not exists public.agent_commissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.field_agents(user_id) on delete cascade,
  listing_id uuid unique references public.classified_listings(id) on delete set null,
  listing_title text not null,
  owner_id uuid references auth.users(id) on delete set null,
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index if not exists agent_commissions_agent_idx on public.agent_commissions(agent_id, created_at desc);
create index if not exists agent_commissions_owner_idx on public.agent_commissions(owner_id);
create index if not exists agent_commissions_decided_by_idx on public.agent_commissions(decided_by);
create index if not exists agent_commissions_status_idx on public.agent_commissions(status, created_at);
alter table public.agent_commissions enable row level security;
create policy agent_commissions_own_read on public.agent_commissions for select to authenticated using (agent_id = (select auth.uid()));
revoke all on public.agent_commissions from anon;
grant select on public.agent_commissions to authenticated;

-- Comissões de agente entram no mesmo livro de movimentos do saldo.
alter table public.wallet_entries drop constraint if exists wallet_entries_kind_check;
alter table public.wallet_entries add constraint wallet_entries_kind_check
  check (kind in ('sale', 'release', 'fee', 'refund', 'payout', 'payout_returned', 'adjustment', 'agent'));

-- Só as funções podem mudar o agente de um anúncio.
create or replace function public.guard_listing_agent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('huambo.allow_agent', true), '') = 'on' or public.has_admin_role() then return new; end if;
  if tg_op = 'INSERT' then new.agent_id := null; else new.agent_id := old.agent_id; end if;
  return new;
end $$;
create trigger guard_listing_agent before insert or update of agent_id on public.classified_listings
  for each row execute function public.guard_listing_agent();

-- Cria a comissão de um anúncio publicado com agente (uma por anúncio).
create or replace function public.agent_commission_create(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; a public.field_agents; st public.platform_settings; today_start timestamptz; n_day int; n_owner int; why text;
begin
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.agent_id is null or l.status <> 'published' then return; end if;
  if exists (select 1 from public.agent_commissions where listing_id = l.id) then return; end if;
  select * into a from public.field_agents where user_id = l.agent_id;
  if not found or a.status <> 'active' or a.user_id = l.owner_id then return; end if;
  select * into st from public.platform_settings where id = 1;
  today_start := (public.angola_today()::timestamp at time zone 'Africa/Luanda');
  select count(*) filter (where status <> 'rejected'), count(*) filter (where status <> 'rejected' and owner_id = l.owner_id)
    into n_day, n_owner from public.agent_commissions where agent_id = a.user_id and created_at >= today_start;
  if n_day >= st.agent_daily_cap then why := 'Passou o limite de ' || st.agent_daily_cap || ' anúncios por dia.';
  elsif n_owner >= 5 then why := 'Passou o limite de 5 anúncios por dia do mesmo vendedor.'; end if;
  insert into public.agent_commissions(agent_id, listing_id, listing_title, owner_id, amount, status, admin_note, decided_at)
  values (a.user_id, l.id, left(l.title, 200), l.owner_id, st.agent_fee_kz,
    case when why is null then 'pending' else 'rejected' end, why, case when why is null then null else now() end);
end $$;

create or replace function public.listing_agent_published() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.agent_id is not null and new.status = 'published' and old.status is distinct from 'published' then
    perform public.agent_commission_create(new.id);
  end if;
  return new;
end $$;
create trigger listing_agent_published after update of status on public.classified_listings
  for each row execute function public.listing_agent_published();

-- Pedir para ser agente (ou atualizar os dados).
create or replace function public.apply_field_agent(p_market_id uuid, p_full_name text, p_phone text, p_note text default null)
returns public.field_agents language plpgsql security definer set search_path = public as $$
declare a public.field_agents; me uuid := auth.uid(); ph text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 3 then raise exception 'NAME_REQUIRED'; end if;
  if char_length(ph) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if p_market_id is null or not exists (select 1 from public.markets where id = p_market_id and status = 'active') then raise exception 'MARKET_REQUIRED'; end if;
  select * into a from public.field_agents where user_id = me for update;
  if not found then
    insert into public.field_agents(user_id, market_id, full_name, phone, note)
    values (me, p_market_id, trim(p_full_name), ph, nullif(left(trim(coalesce(p_note, '')), 500), '')) returning * into a;
    perform public.notify_staff('Pedido para ser agente', a.full_name || ' · ' || a.code, jsonb_build_object('agent_id', me));
  elsif a.status = 'suspended' then raise exception 'AGENT_SUSPENDED';
  else
    update public.field_agents set market_id = p_market_id, full_name = trim(p_full_name), phone = ph,
      note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      status = case when a.status = 'rejected' then 'pending' else a.status end
    where user_id = me returning * into a;
    if a.status = 'pending' then perform public.notify_staff('Pedido para ser agente', a.full_name || ' · ' || a.code, jsonb_build_object('agent_id', me)); end if;
  end if;
  return a;
end $$;

-- O meu painel de agente.
create or replace function public.my_field_agent() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.field_agents; st public.platform_settings;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  select * into a from public.field_agents where user_id = me;
  if not found then return jsonb_build_object('agent', null, 'fee_kz', st.agent_fee_kz, 'daily_cap', st.agent_daily_cap); end if;
  return jsonb_build_object(
    'agent', jsonb_build_object('code', a.code, 'status', a.status, 'full_name', a.full_name, 'phone', a.phone, 'note', a.note,
      'admin_note', a.admin_note, 'market_id', a.market_id, 'market_name', (select m.name from public.markets m where m.id = a.market_id), 'created_at', a.created_at),
    'fee_kz', st.agent_fee_kz, 'daily_cap', st.agent_daily_cap,
    'pending_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'pending'),
    'approved_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'approved'),
    'listings', (select count(*) from public.classified_listings where agent_id = me),
    'commissions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select c.id, c.listing_id, c.listing_title, c.amount, c.status, c.admin_note, c.created_at, c.decided_at,
        (select l.status from public.classified_listings l where l.id = c.listing_id) listing_status
      from public.agent_commissions c where c.agent_id = me order by c.created_at desc limit 100) x));
end $$;

-- Confirmar um código (no formulário do anúncio): devolve o primeiro nome e a praça.
create or replace function public.check_agent_code(p_code text)
returns table (code text, first_name text, market_name text)
language sql stable security definer set search_path = public as $$
  select a.code, split_part(trim(a.full_name), ' ', 1), m.name
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where a.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and a.status = 'active'
$$;

-- O vendedor diz que agente o ajudou (código vazio = tirar). Só antes de haver comissão.
create or replace function public.set_listing_agent(p_listing_id uuid, p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; a public.field_agents; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if exists (select 1 from public.agent_commissions where listing_id = l.id) then
    if (c = '' and l.agent_id is null) or exists (select 1 from public.field_agents x where x.user_id = l.agent_id and x.code = c) then return l.agent_id; end if;
    raise exception 'AGENT_LOCKED';
  end if;
  if c = '' then a := null;
  else
    select * into a from public.field_agents where code = c and status = 'active';
    if not found then raise exception 'AGENT_NOT_FOUND'; end if;
    if a.user_id = auth.uid() then raise exception 'CANNOT_BE_OWN_AGENT'; end if;
  end if;
  perform set_config('huambo.allow_agent', 'on', true);
  update public.classified_listings set agent_id = a.user_id where id = l.id;
  perform set_config('huambo.allow_agent', '', true);
  perform public.agent_commission_create(l.id);
  return a.user_id;
end $$;

-- Administração --------------------------------------------------------------------------------
create or replace function public.admin_list_agents(p_status text default null)
returns table (user_id uuid, code text, full_name text, phone text, note text, status text, admin_note text, market_name text, created_at timestamptz,
  listings bigint, pending_count bigint, pending_kz numeric, approved_kz numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.user_id, a.code, a.full_name, a.phone, a.note, a.status, a.admin_note, m.name, a.created_at,
    (select count(*) from public.classified_listings l where l.agent_id = a.user_id),
    (select count(*) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'approved')
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where p_status is null or a.status = p_status
  order by case a.status when 'pending' then 0 when 'active' then 1 else 2 end, a.created_at desc limit 300;
end $$;

create or replace function public.admin_decide_agent(p_user_id uuid, p_status text, p_note text default null)
returns public.field_agents language plpgsql security definer set search_path = public as $$
declare a public.field_agents; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('active', 'suspended', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  if p_status <> 'active' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.field_agents set status = p_status, admin_note = txt, decided_at = now(), decided_by = auth.uid()
  where user_id = p_user_id returning * into a;
  if not found then raise exception 'AGENT_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.user_id, 'system',
    case p_status when 'active' then 'Já é agente do Huambo Online 🤝' when 'suspended' then 'Conta de agente suspensa' else 'Pedido de agente não aceite' end,
    case p_status when 'active' then 'O seu código é ' || a.code || '. Peça aos vendedores que o escrevam ao publicar.' else txt end,
    jsonb_build_object('for', 'agent'));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'agent_' || p_status, 'user', a.user_id, jsonb_build_object('code', a.code));
  return a;
end $$;

create or replace function public.admin_list_agent_commissions(p_status text default 'pending')
returns table (id uuid, agent_id uuid, agent_code text, agent_name text, listing_id uuid, listing_title text, listing_status text, listing_ref bigint,
  owner_name text, amount numeric, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.agent_id, a.code, a.full_name, c.listing_id, c.listing_title, l.status, l.ref_no,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.amount, c.status, c.admin_note, c.created_at
  from public.agent_commissions c join public.field_agents a on a.user_id = c.agent_id
    left join public.classified_listings l on l.id = c.listing_id left join public.profiles p on p.id = c.owner_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 500;
end $$;

-- Confirmar (o valor entra no saldo do agente) ou recusar várias comissões de uma vez.
create or replace function public.admin_decide_agent_commissions(p_ids uuid[], p_approve boolean, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare c public.agent_commissions; n integer := 0; done uuid[] := '{}'; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_approve and txt is null then raise exception 'REASON_REQUIRED'; end if;
  for c in select * from public.agent_commissions where id = any(coalesce(p_ids, '{}')) and status = 'pending' for update loop
    update public.agent_commissions set status = case when p_approve then 'approved' else 'rejected' end, admin_note = txt,
      decided_at = now(), decided_by = auth.uid() where id = c.id;
    if p_approve and c.amount > 0 then
      perform public.wallet_add(c.agent_id, null, null, 'available', 'agent', c.amount, 'Comissão de agente: ' || left(c.listing_title, 200));
    end if;
    n := n + 1; done := done || c.id;
  end loop;
  if n > 0 then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), case when p_approve then 'agent_commissions_approved' else 'agent_commissions_rejected' end, 'user', auth.uid(), jsonb_build_object('count', n, 'ids', done));
    insert into public.notifications(user_id, type, title, body, data)
    select x.agent_id, 'system', case when p_approve then 'Comissões confirmadas 💰' else 'Comissões recusadas' end,
      case when x.k = 1 then '1 comissão' else x.k || ' comissões' end || case when p_approve then ' · ' || x.s || ' Kz já no seu saldo.' else ' recusada' || case when x.k = 1 then '' else 's' end || ': ' || txt end,
      jsonb_build_object('for', case when p_approve then 'wallet' else 'agent' end)
    from (select agent_id, count(*) k, sum(amount) s from public.agent_commissions where id = any(done) group by agent_id) x;
  end if;
  return n;
end $$;

revoke all on function public.guard_listing_agent() from public, anon, authenticated;
revoke all on function public.agent_commission_create(uuid) from public, anon, authenticated;
revoke all on function public.listing_agent_published() from public, anon, authenticated;
revoke all on function public.apply_field_agent(uuid, text, text, text) from public, anon;
revoke all on function public.my_field_agent() from public, anon;
revoke all on function public.check_agent_code(text) from public, anon;
revoke all on function public.set_listing_agent(uuid, text) from public, anon;
revoke all on function public.admin_list_agents(text) from public, anon;
revoke all on function public.admin_decide_agent(uuid, text, text) from public, anon;
revoke all on function public.admin_list_agent_commissions(text) from public, anon;
revoke all on function public.admin_decide_agent_commissions(uuid[], boolean, text) from public, anon;
grant execute on function public.apply_field_agent(uuid, text, text, text) to authenticated;
grant execute on function public.my_field_agent() to authenticated;
grant execute on function public.check_agent_code(text) to authenticated;
grant execute on function public.set_listing_agent(uuid, text) to authenticated;
grant execute on function public.admin_list_agents(text) to authenticated;
grant execute on function public.admin_decide_agent(uuid, text, text) to authenticated;
grant execute on function public.admin_list_agent_commissions(text) to authenticated;
grant execute on function public.admin_decide_agent_commissions(uuid[], boolean, text) to authenticated;
