-- Agentes no terreno v2: o agente ganha por cada VENDA de um anúncio que ajudou a pôr (não só por publicar).
--
-- Quando o anúncio passa a «vendido» (o vendedor marca como vendido, ou o leilão termina), nasce uma comissão
-- do agente = agent_sale_pct % do valor da venda (o valor que o vendedor indicou, senão a proposta aceite,
-- senão o preço do anúncio). A administração confirma (o valor entra no saldo do agente) ou recusa.
-- Se o anúncio deixar de estar vendido, a comissão ainda não confirmada é anulada.
-- O vendedor só pode indicar/mudar o agente antes de vender. As colunas agent_fee_kz e agent_daily_cap (v1)
-- deixam de ser usadas.

alter table public.platform_settings
  add column if not exists agent_sale_pct numeric not null default 2 check (agent_sale_pct >= 0 and agent_sale_pct <= 20);
grant update (agent_sale_pct) on public.platform_settings to authenticated;

alter table public.agent_commissions
  add column if not exists sale_amount numeric check (sale_amount is null or sale_amount >= 0),
  add column if not exists rate_pct numeric check (rate_pct is null or (rate_pct >= 0 and rate_pct <= 20));
-- Um anúncio pode voltar a ser vendido depois de uma venda anulada: só uma comissão ativa por anúncio.
alter table public.agent_commissions drop constraint if exists agent_commissions_listing_id_key;
alter table public.agent_commissions drop constraint if exists agent_commissions_status_check;
alter table public.agent_commissions add constraint agent_commissions_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'));
create unique index if not exists agent_commissions_one_active on public.agent_commissions(listing_id) where status <> 'cancelled';

-- Cria a comissão quando o anúncio é vendido (uma por venda).
create or replace function public.agent_commission_create(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; a public.field_agents; st public.platform_settings; offer_amt numeric; amt numeric; fee numeric;
begin
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.agent_id is null or l.status <> 'sold' or l.purpose not in ('sale', 'auction') then return; end if;
  if exists (select 1 from public.agent_commissions where listing_id = l.id and status <> 'cancelled') then return; end if;
  select * into a from public.field_agents where user_id = l.agent_id;
  if not found or a.status <> 'active' or a.user_id = l.owner_id then return; end if;
  select * into st from public.platform_settings where id = 1;
  if l.deal_with is not null then
    select o.amount into offer_amt from public.listing_offers o where o.listing_id = l.id and o.buyer_id = l.deal_with and o.status = 'accepted' and o.amount is not null
     order by o.responded_at desc nulls last limit 1;
  end if;
  amt := coalesce(l.sale_amount, offer_amt, l.price);
  if amt is null or amt <= 0 or st.agent_sale_pct <= 0 then return; end if;
  fee := round(amt * st.agent_sale_pct / 100);
  if fee <= 0 then return; end if;
  insert into public.agent_commissions(agent_id, listing_id, listing_title, owner_id, amount, sale_amount, rate_pct)
  values (a.user_id, l.id, left(l.title, 200), l.owner_id, fee, amt, st.agent_sale_pct);
  insert into public.notifications(user_id, type, title, body, data)
  values (a.user_id, 'system', 'Venda! 🎉', '«' || left(l.title, 120) || '» foi vendido por ' || amt || ' Kz. A sua comissão de ' || fee
    || ' Kz está à espera de confirmação.', jsonb_build_object('for', 'agent'));
end $$;

-- O mesmo gatilho (criado na v1 ao publicar) passa a reagir à VENDA.
create or replace function public.listing_agent_published() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.agent_id is not null and new.status = 'sold' and old.status is distinct from 'sold' then
    perform public.agent_commission_create(new.id);
  elsif old.status = 'sold' and new.status is distinct from 'sold' then
    update public.agent_commissions set status = 'cancelled', admin_note = 'O anúncio deixou de estar vendido.', decided_at = now()
     where listing_id = new.id and status = 'pending';
  end if;
  return new;
end $$;

-- O vendedor indica o agente (código vazio = tirar). Só antes de vender.
create or replace function public.set_listing_agent(p_listing_id uuid, p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.classified_listings; a public.field_agents; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if c = '' and l.agent_id is null then return null; end if;
  if l.agent_id is not null and exists (select 1 from public.field_agents x where x.user_id = l.agent_id and x.code = c) then return l.agent_id; end if;
  if l.status = 'sold' or exists (select 1 from public.agent_commissions where listing_id = l.id and status <> 'cancelled') then raise exception 'AGENT_LOCKED'; end if;
  if c = '' then a := null;
  else
    select * into a from public.field_agents where code = c and status = 'active';
    if not found then raise exception 'AGENT_NOT_FOUND'; end if;
    if a.user_id = auth.uid() then raise exception 'CANNOT_BE_OWN_AGENT'; end if;
  end if;
  perform set_config('huambo.allow_agent', 'on', true);
  update public.classified_listings set agent_id = a.user_id where id = l.id;
  perform set_config('huambo.allow_agent', '', true);
  return a.user_id;
end $$;

-- Painel do agente: números, anúncios que ajudou (vendidos ou não) e comissões.
create or replace function public.my_field_agent() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.field_agents; st public.platform_settings;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  select * into a from public.field_agents where user_id = me;
  if not found then return jsonb_build_object('agent', null, 'sale_pct', st.agent_sale_pct); end if;
  return jsonb_build_object(
    'agent', jsonb_build_object('code', a.code, 'status', a.status, 'full_name', a.full_name, 'phone', a.phone, 'note', a.note,
      'admin_note', a.admin_note, 'market_id', a.market_id, 'market_name', (select m.name from public.markets m where m.id = a.market_id), 'created_at', a.created_at),
    'sale_pct', st.agent_sale_pct,
    'pending_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'pending'),
    'approved_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'approved'),
    'listings', (select count(*) from public.classified_listings where agent_id = me),
    'sold', (select count(*) from public.classified_listings where agent_id = me and status = 'sold'),
    'helped', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select l.id, l.title, l.status, l.price, l.currency, l.created_at from public.classified_listings l
      where l.agent_id = me and l.status <> 'draft' order by l.created_at desc limit 100) x),
    'commissions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select c.id, c.listing_id, c.listing_title, c.amount, c.sale_amount, c.rate_pct, c.status, c.admin_note, c.created_at, c.decided_at,
        (select l.status from public.classified_listings l where l.id = c.listing_id) listing_status
      from public.agent_commissions c where c.agent_id = me order by c.created_at desc limit 100) x));
end $$;

-- Administração: comissões com o valor da venda e se o vendedor já pagou a comissão da venda ao Huambo Online.
create or replace function public.admin_list_agent_commissions_v2(p_status text default 'pending')
returns table (id uuid, agent_id uuid, agent_code text, agent_name text, listing_id uuid, listing_title text, listing_status text, listing_ref bigint,
  owner_name text, amount numeric, sale_amount numeric, rate_pct numeric, seller_commission_status text, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.agent_id, a.code, a.full_name, c.listing_id, c.listing_title, l.status, l.ref_no,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.amount, c.sale_amount, c.rate_pct,
    (select lc.status from public.listing_commissions lc where lc.listing_id = c.listing_id and lc.status <> 'cancelled' order by lc.created_at desc limit 1),
    c.status, c.admin_note, c.created_at
  from public.agent_commissions c join public.field_agents a on a.user_id = c.agent_id
    left join public.classified_listings l on l.id = c.listing_id left join public.profiles p on p.id = c.owner_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 500;
end $$;

-- Lista de agentes: anúncios ajudados e vendidos.
create or replace function public.admin_list_agents_v2(p_status text default null)
returns table (user_id uuid, code text, full_name text, phone text, note text, status text, admin_note text, market_name text, created_at timestamptz,
  listings bigint, sold bigint, pending_count bigint, pending_kz numeric, approved_kz numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.user_id, a.code, a.full_name, a.phone, a.note, a.status, a.admin_note, m.name, a.created_at,
    (select count(*) from public.classified_listings l where l.agent_id = a.user_id),
    (select count(*) from public.classified_listings l where l.agent_id = a.user_id and l.status = 'sold'),
    (select count(*) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'approved')
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where p_status is null or a.status = p_status
  order by case a.status when 'pending' then 0 when 'active' then 1 else 2 end, a.created_at desc limit 300;
end $$;

-- As versões v1 deixam de ser usadas pelo Site e pela APP.
revoke all on function public.admin_list_agent_commissions(text) from authenticated;
revoke all on function public.admin_list_agents(text) from authenticated;
revoke all on function public.admin_list_agent_commissions_v2(text) from public, anon;
revoke all on function public.admin_list_agents_v2(text) from public, anon;
grant execute on function public.admin_list_agent_commissions_v2(text) to authenticated;
grant execute on function public.admin_list_agents_v2(text) to authenticated;
