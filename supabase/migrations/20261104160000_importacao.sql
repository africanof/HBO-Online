-- Importação (compras no exterior): o cliente consulta o catálogo ou descreve o produto que procura,
-- a equipa do Huambo Online envia um orçamento (produto + transporte/alfândega + serviço), o cliente
-- aceita e paga ao Huambo Online (pagamento protegido, com comprovativo confirmado pela equipa) e a
-- equipa compra, importa e entrega, com o estado sempre à vista do cliente.
-- Se a equipa não conseguir comprar, devolve o valor (estado «refunded»).

-- Catálogo: o que a equipa costuma importar (para consultar e pedir com um toque).
create table if not exists public.import_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text check (char_length(description) <= 1000),
  icon text not null default '📦' check (char_length(icon) <= 8),
  origin text not null default 'any' check (origin in ('any', 'china', 'dubai', 'portugal', 'brasil', 'africa_sul', 'eua', 'europa')),
  days_min int not null default 15 check (days_min between 1 and 365),
  days_max int not null default 45 check (days_max between 1 and 365),
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
alter table public.import_catalog enable row level security;
drop policy if exists import_catalog_read on public.import_catalog;
create policy import_catalog_read on public.import_catalog for select using (active or (select public.has_admin_role()));
drop policy if exists import_catalog_admin on public.import_catalog;
create policy import_catalog_admin on public.import_catalog for all to authenticated
  using ((select public.has_admin_role())) with check ((select public.has_admin_role()));
grant select on public.import_catalog to anon, authenticated;
grant insert, update, delete on public.import_catalog to authenticated;

insert into public.import_catalog (title, description, icon, origin, days_min, days_max, sort)
select * from (values
  ('Peças e acessórios de automóvel', 'Peças originais ou compatíveis para a sua viatura (indique marca, modelo, ano e o número da peça, se souber).', '🚗', 'dubai', 15, 40, 10),
  ('Telemóveis, computadores e eletrónica', 'Telemóveis, portáteis, tablets, televisores e acessórios novos.', '📱', 'dubai', 10, 30, 20),
  ('Painéis solares e energia', 'Painéis solares, baterias, inversores e geradores.', '☀️', 'china', 30, 60, 30),
  ('Máquinas e equipamento agrícola', 'Motocultivadores, bombas de água, moinhos, debulhadoras e peças.', '🚜', 'china', 30, 75, 40),
  ('Material de construção e ferramentas', 'Ferramentas, canalização, eletricidade, mosaicos e acabamentos.', '🧱', 'china', 30, 60, 50),
  ('Roupa, calçado e cabelo por grosso', 'Para revenda: roupa, calçado, perucas e extensões, por grosso.', '👗', 'china', 25, 60, 60),
  ('Equipamento para restaurantes e lojas', 'Fogões industriais, arcas, vitrinas, balanças e máquinas.', '🍽️', 'china', 30, 70, 70),
  ('Produtos de Portugal e do Brasil', 'Livros, cosméticos, produtos alimentares e outros artigos.', '🇵🇹', 'portugal', 15, 40, 80)
) v(title, description, icon, origin, days_min, days_max, sort)
where not exists (select 1 from public.import_catalog);

-- Pedidos de importação.
create table if not exists public.import_requests (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid references public.import_catalog(id) on delete set null,
  title text not null check (char_length(trim(title)) between 3 and 140),
  details text check (char_length(details) <= 2000),
  links text check (char_length(links) <= 1000),
  photo_url text check (char_length(photo_url) <= 500),
  quantity int not null default 1 check (quantity between 1 and 100000),
  budget numeric check (budget is null or budget > 0),
  origin text not null default 'any' check (origin in ('any', 'china', 'dubai', 'portugal', 'brasil', 'africa_sul', 'eua', 'europa')),
  fulfillment text not null default 'pickup' check (fulfillment in ('pickup', 'delivery')),
  address text check (char_length(address) <= 300),
  phone text not null check (char_length(phone) between 6 and 30),
  status text not null default 'requested' check (status in ('requested', 'quoted', 'awaiting_payment', 'submitted', 'paid', 'purchased', 'in_transit', 'arrived', 'delivered', 'declined', 'cancelled', 'refunded')),
  product_cost numeric, shipping_cost numeric, service_fee numeric, total numeric,
  eta_days int, quote_note text, quoted_at timestamptz, quote_valid_until timestamptz,
  pay_by timestamptz, pay_method text, reference text, reference_norm text, proof_path text, proof_hash text, paid_at timestamptz,
  team_note text, tracking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists import_requests_user_idx on public.import_requests(user_id, created_at desc);
create index if not exists import_requests_status_idx on public.import_requests(status, updated_at desc);
create unique index if not exists import_requests_reference_uq on public.import_requests(reference_norm) where reference_norm is not null;
alter table public.import_requests enable row level security;
drop policy if exists import_requests_read on public.import_requests;
create policy import_requests_read on public.import_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));
grant select on public.import_requests to authenticated;
-- Tudo o resto passa pelas funções abaixo.

create or replace function public.import_ref(n bigint) returns text language sql immutable as $$ select 'IMP-' || n $$;

-- Cliente: novo pedido.
create or replace function public.import_request_create(p_title text, p_details text, p_links text, p_quantity int, p_budget numeric,
  p_origin text, p_fulfillment text, p_address text, p_phone text, p_catalog_id uuid default null, p_photo_url text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.import_requests;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'IMPORT_TITLE_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'IMPORT_PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and char_length(trim(coalesce(p_address, ''))) < 5 then raise exception 'IMPORT_ADDRESS_REQUIRED'; end if;
  if p_photo_url is not null and p_photo_url not like '%/storage/v1/object/public/classified-media/' || me::text || '/%' then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.import_requests where user_id = me and status in ('requested', 'quoted', 'awaiting_payment', 'submitted')) >= 10 then
    raise exception 'IMPORT_TOO_MANY'; end if;
  insert into public.import_requests (user_id, catalog_id, title, details, links, photo_url, quantity, budget, origin, fulfillment, address, phone)
  values (me, p_catalog_id, left(trim(p_title), 140), nullif(left(trim(coalesce(p_details, '')), 2000), ''), nullif(left(trim(coalesce(p_links, '')), 1000), ''),
    p_photo_url, greatest(1, coalesce(p_quantity, 1)), case when p_budget > 0 then p_budget end, coalesce(p_origin, 'any'), coalesce(p_fulfillment, 'pickup'),
    nullif(left(trim(coalesce(p_address, '')), 300), ''), left(trim(p_phone), 30))
  returning * into r;
  perform public.notify_staff('✈️ Novo pedido de importação', public.import_ref(r.ref_no) || ' · ' || r.title || ' · ' || r.quantity || ' un.',
    jsonb_build_object('import_request_id', r.id, 'tab', 'imports'));
  return r;
end $$;

create or replace function public._import_notify(r public.import_requests, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data)
  values (r.user_id, 'system', p_title, public.import_ref(r.ref_no) || ' · ' || r.title || coalesce(' · ' || p_body, ''), jsonb_build_object('for', 'imports', 'import_request_id', r.id));
$$;

-- Equipa: orçamento (pode ser refeito enquanto o cliente não aceitar).
create or replace function public.import_admin_quote(p_id uuid, p_product numeric, p_shipping numeric, p_fee numeric, p_eta_days int, p_note text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('requested', 'quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  if coalesce(p_product, 0) <= 0 or coalesce(p_shipping, 0) < 0 or coalesce(p_fee, 0) < 0 or coalesce(p_eta_days, 0) not between 1 and 365 then raise exception 'INVALID_INPUT'; end if;
  update public.import_requests set status = 'quoted', product_cost = round(p_product), shipping_cost = round(coalesce(p_shipping, 0)), service_fee = round(coalesce(p_fee, 0)),
    total = round(p_product) + round(coalesce(p_shipping, 0)) + round(coalesce(p_fee, 0)), eta_days = p_eta_days,
    quote_note = nullif(left(trim(coalesce(p_note, '')), 1000), ''), quoted_at = now(), quote_valid_until = now() + interval '7 days', pay_by = null, team_note = null, updated_at = now()
  where id = r.id returning * into r;
  perform public._import_notify(r, '✈️ Orçamento de importação pronto', r.total || ' Kz · cerca de ' || r.eta_days || ' dias. Aceite para pagar.');
  return r;
end $$;

-- Equipa: não é possível (com motivo).
create or replace function public.import_admin_decline(p_id uuid, p_reason text)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('requested', 'quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  update public.import_requests set status = 'declined', team_note = txt, updated_at = now() where id = r.id returning * into r;
  perform public._import_notify(r, 'Pedido de importação não disponível', txt);
  return r;
end $$;

-- Cliente: aceita o orçamento (também volta a aceitar se o prazo de pagamento passou).
create or replace function public.import_accept_quote(p_id uuid)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; hrs int := coalesce((select payment_window_hours from public.platform_settings where id = 1), 24);
begin
  select * into r from public.import_requests where id = p_id for update;
  if not found or r.user_id <> auth.uid() then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  if r.quote_valid_until < now() then raise exception 'IMPORT_QUOTE_EXPIRED'; end if;
  update public.import_requests set status = 'awaiting_payment', pay_by = now() + make_interval(hours => greatest(hrs, 24)), updated_at = now()
  where id = r.id returning * into r;
  return r;
end $$;

-- Cliente: comprovativo do pagamento ao Huambo Online.
create or replace function public.import_submit_payment(p_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into r from public.import_requests where id = p_id for update;
  if not found or r.user_id <> me then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status <> 'awaiting_payment' then raise exception 'INVALID_TRANSITION'; end if;
  if r.pay_by < now() then raise exception 'IMPORT_PAY_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'FUEL_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.import_requests x where x.id <> r.id and x.reference_norm = ref_n) then raise exception 'FUEL_REFERENCE_USED'; end if;
  if h is not null and exists (select 1 from public.import_requests x where x.id <> r.id and x.proof_hash = h) then raise exception 'FUEL_PROOF_USED'; end if;
  update public.import_requests set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, team_note = null, updated_at = now()
  where id = r.id returning * into r;
  perform public.notify_staff('✈️ Pagamento de importação para confirmar', public.import_ref(r.ref_no) || ' · ' || r.total || ' Kz · ref. ' || r.reference,
    jsonb_build_object('import_request_id', r.id, 'tab', 'imports'));
  return r;
end $$;

-- Equipa: pagamento recebido / não recebido (também usada pelo painel de comprovativos).
create or replace function public.decide_import_payment(p_id uuid, p_confirm boolean, p_note text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.import_requests set status = 'paid', paid_at = now(), team_note = txt, updated_at = now() where id = r.id returning * into r;
    perform public._import_notify(r, '✈️ Pagamento confirmado 🛡️', 'Vamos comprar o seu produto. Avisamos em cada passo.');
  else
    -- Volta a «por pagar» com mais 24 horas para enviar o comprovativo certo.
    update public.import_requests set status = 'awaiting_payment', pay_by = greatest(coalesce(pay_by, now()), now() + interval '24 hours'),
      reference_norm = null, proof_hash = null, team_note = txt, updated_at = now() where id = r.id returning * into r;
    perform public._import_notify(r, 'Pagamento de importação não confirmado', txt);
  end if;
  return r;
end $$;

-- Equipa: acompanhamento (comprado → a caminho → chegou → entregue) ou devolução do dinheiro.
create or replace function public.import_admin_progress(p_id uuid, p_status text, p_note text default null, p_tracking text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if not ((r.status = 'paid' and p_status in ('purchased', 'refunded'))
       or (r.status = 'purchased' and p_status in ('in_transit', 'arrived', 'refunded'))
       or (r.status = 'in_transit' and p_status = 'arrived')
       or (r.status = 'arrived' and p_status = 'delivered')) then raise exception 'INVALID_TRANSITION'; end if;
  if p_status = 'refunded' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.import_requests set status = p_status, team_note = coalesce(txt, team_note),
    tracking = coalesce(nullif(left(trim(coalesce(p_tracking, '')), 200), ''), tracking), updated_at = now()
  where id = r.id returning * into r;
  perform public._import_notify(r, case p_status
      when 'purchased' then '✈️ Produto comprado'
      when 'in_transit' then '✈️ A sua importação está a caminho'
      when 'arrived' then '✈️ A sua importação chegou ao Huambo'
      when 'delivered' then '✅ Importação entregue'
      else '↩️ Importação cancelada: o valor vai ser devolvido' end,
    coalesce(txt, case p_status when 'arrived' then case when r.fulfillment = 'delivery' then 'Vamos combinar a entrega.' else 'Pode levantar: ligamos para combinar.' end end));
  return r;
end $$;

-- Cliente: cancelar antes de pagar.
create or replace function public.import_cancel(p_id uuid)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests;
begin
  select * into r from public.import_requests where id = p_id for update;
  if not found or r.user_id <> auth.uid() then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('requested', 'quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  update public.import_requests set status = 'cancelled', updated_at = now() where id = r.id returning * into r;
  return r;
end $$;

-- Equipa: lista com o nome do cliente.
create or replace function public.admin_list_import_requests(p_status text default null)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select to_jsonb(x) || jsonb_build_object('buyer_name', p.full_name) from public.import_requests x left join public.profiles p on p.id = x.user_id
    where p_status is null or (p_status = 'open' and x.status in ('requested', 'quoted', 'awaiting_payment', 'submitted', 'paid', 'purchased', 'in_transit', 'arrived'))
       or x.status = p_status
    order by case x.status when 'submitted' then 0 when 'requested' then 1 when 'paid' then 2 else 3 end, x.updated_at desc limit 200;
end $$;

revoke all on function public.import_request_create(text,text,text,int,numeric,text,text,text,text,uuid,text), public.import_admin_quote(uuid,numeric,numeric,numeric,int,text),
  public.import_admin_decline(uuid,text), public.import_accept_quote(uuid), public.import_submit_payment(uuid,text,text,text,text), public.decide_import_payment(uuid,boolean,text),
  public.import_admin_progress(uuid,text,text,text), public.import_cancel(uuid), public.admin_list_import_requests(text), public._import_notify(public.import_requests,text,text) from public, anon;
grant execute on function public.import_request_create(text,text,text,int,numeric,text,text,text,text,uuid,text), public.import_admin_quote(uuid,numeric,numeric,numeric,int,text),
  public.import_admin_decline(uuid,text), public.import_accept_quote(uuid), public.import_submit_payment(uuid,text,text,text,text), public.decide_import_payment(uuid,boolean,text),
  public.import_admin_progress(uuid,text,text,text), public.import_cancel(uuid), public.admin_list_import_requests(text) to authenticated;

-- Os comprovativos das importações aparecem no painel de comprovativos (a IA lê-os e confere,
-- mas quem confirma é sempre a equipa: valores grandes e compras no exterior).
do $$ declare d text := regexp_replace(pg_get_functiondef('public.pending_proof_payments()'::regprocedure), '\s+', ' ', 'g');
  o text := $o$ from public.venue_orders v where v.status = 'submitted' and v.proof_path is not null and public.platform_collects()$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND pending_proof_payments'; end if;
  if strpos(d, 'import_order') = 0 then
    execute replace(d, o, o || $n$ union all select 'import_order', i.id, i.proof_path, i.total, i.pay_method, i.reference, i.user_id, i.updated_at, 'Importação IMP-' || i.ref_no from public.import_requests i where i.status = 'submitted' and i.proof_path is not null$n$);
  end if;
end $$;

do $$ declare d text := pg_get_functiondef('public.ai_save_proof_check(text,uuid,text,boolean,numeric,date,text,text,text,text,text,text[],text)'::regprocedure);
  o text := $o$p_kind <> 'order' and$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND ai_save_proof_check'; end if;
  execute replace(d, o, $n$p_kind not in ('order', 'import_order') and$n$);
end $$;

alter table public.payment_proof_checks drop constraint if exists payment_proof_checks_kind_check;
alter table public.payment_proof_checks add constraint payment_proof_checks_kind_check
  check (kind in ('subscription', 'boost', 'promo_boost', 'event_fee', 'fuel_fee', 'venue_fee', 'commission', 'order', 'fuel_order', 'venue_order', 'import_order'));
