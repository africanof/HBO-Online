-- Importação: taxa de pesquisa e orçamento, paga ANTES de a equipa pesquisar (evita pedidos sem intenção
-- de compra). Valor em platform_settings.import_research_fee_kz (0 = sem taxa). Se o cliente aceitar o
-- orçamento, a taxa é descontada no total (import_research_deduct). Não é devolvida se o cliente desistir
-- ou se o produto não for encontrado (o trabalho de pesquisa foi feito).
-- Novos estados: research_payment (por pagar a taxa) → research_submitted (comprovativo enviado) → requested.
-- O comprovativo da taxa (valor pequeno) pode ser confirmado sozinho pela IA, como as outras taxas.

alter table public.platform_settings add column if not exists import_research_fee_kz numeric not null default 2000 check (import_research_fee_kz >= 0 and import_research_fee_kz <= 100000);
alter table public.platform_settings add column if not exists import_research_deduct boolean not null default true;

alter table public.import_requests add column if not exists research_fee numeric not null default 0,
  add column if not exists research_credit numeric not null default 0,
  add column if not exists research_method text, add column if not exists research_reference text, add column if not exists research_reference_norm text,
  add column if not exists research_proof_path text, add column if not exists research_proof_hash text,
  add column if not exists research_pay_by timestamptz, add column if not exists research_paid_at timestamptz;
create unique index if not exists import_requests_research_ref_uq on public.import_requests(research_reference_norm) where research_reference_norm is not null;
alter table public.import_requests drop constraint if exists import_requests_status_check;
alter table public.import_requests add constraint import_requests_status_check check (status in ('research_payment', 'research_submitted', 'requested', 'quoted', 'awaiting_payment',
  'submitted', 'paid', 'purchased', 'in_transit', 'arrived', 'delivered', 'declined', 'cancelled', 'refunded'));

-- Novo pedido: com taxa, fica à espera do pagamento da pesquisa; a equipa só é avisada depois.
create or replace function public.import_request_create(p_title text, p_details text, p_links text, p_quantity int, p_budget numeric,
  p_origin text, p_fulfillment text, p_address text, p_phone text, p_catalog_id uuid default null, p_photo_url text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.import_requests; fee numeric := coalesce((select import_research_fee_kz from public.platform_settings where id = 1), 0);
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'IMPORT_TITLE_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'IMPORT_PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and char_length(trim(coalesce(p_address, ''))) < 5 then raise exception 'IMPORT_ADDRESS_REQUIRED'; end if;
  if p_photo_url is not null and p_photo_url not like '%/storage/v1/object/public/classified-media/' || me::text || '/%' then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.import_requests where user_id = me and status in ('research_payment', 'research_submitted', 'requested', 'quoted', 'awaiting_payment', 'submitted')) >= 10 then
    raise exception 'IMPORT_TOO_MANY'; end if;
  insert into public.import_requests (user_id, catalog_id, title, details, links, photo_url, quantity, budget, origin, fulfillment, address, phone, status, research_fee, research_pay_by)
  values (me, p_catalog_id, left(trim(p_title), 140), nullif(left(trim(coalesce(p_details, '')), 2000), ''), nullif(left(trim(coalesce(p_links, '')), 1000), ''),
    p_photo_url, greatest(1, coalesce(p_quantity, 1)), case when p_budget > 0 then p_budget end, coalesce(p_origin, 'any'), coalesce(p_fulfillment, 'pickup'),
    nullif(left(trim(coalesce(p_address, '')), 300), ''), left(trim(p_phone), 30),
    case when fee > 0 then 'research_payment' else 'requested' end, fee, case when fee > 0 then now() + interval '72 hours' end)
  returning * into r;
  if r.status = 'requested' then
    perform public.notify_staff('✈️ Novo pedido de importação', public.import_ref(r.ref_no) || ' · ' || r.title || ' · ' || r.quantity || ' un.',
      jsonb_build_object('import_request_id', r.id, 'tab', 'imports'));
  end if;
  return r;
end $$;

-- Cliente: comprovativo da taxa de pesquisa.
create or replace function public.import_submit_research_payment(p_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into r from public.import_requests where id = p_id for update;
  if not found or r.user_id <> me then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status <> 'research_payment' then raise exception 'INVALID_TRANSITION'; end if;
  if r.research_pay_by < now() then raise exception 'IMPORT_PAY_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'FUEL_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.import_requests x where (x.id <> r.id and x.research_reference_norm = ref_n) or x.reference_norm = ref_n) then raise exception 'FUEL_REFERENCE_USED'; end if;
  if h is not null and exists (select 1 from public.import_requests x where (x.id <> r.id and x.research_proof_hash = h) or x.proof_hash = h) then raise exception 'FUEL_PROOF_USED'; end if;
  update public.import_requests set status = 'research_submitted', research_method = p_method, research_reference = left(trim(p_reference), 120), research_reference_norm = ref_n,
    research_proof_path = p_proof_path, research_proof_hash = h, team_note = null, updated_at = now()
  where id = r.id returning * into r;
  perform public.notify_staff('✈️ Taxa de pesquisa para confirmar', public.import_ref(r.ref_no) || ' · ' || r.research_fee || ' Kz · ref. ' || r.research_reference,
    jsonb_build_object('import_request_id', r.id, 'tab', 'imports'));
  return r;
end $$;

-- Equipa (ou a IA, até ao limite): taxa recebida → a equipa começa a pesquisar.
create or replace function public.decide_import_research(p_id uuid, p_confirm boolean, p_note text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status <> 'research_submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.import_requests set status = 'requested', research_paid_at = now(), updated_at = now() where id = r.id returning * into r;
    perform public._import_notify(r, '✈️ Taxa de pesquisa paga', 'A equipa vai procurar o produto e enviar o orçamento.');
    perform public.notify_staff('✈️ Novo pedido de importação (pesquisa paga)', public.import_ref(r.ref_no) || ' · ' || r.title || ' · ' || r.quantity || ' un.',
      jsonb_build_object('import_request_id', r.id, 'tab', 'imports'));
  else
    update public.import_requests set status = 'research_payment', research_pay_by = greatest(coalesce(research_pay_by, now()), now() + interval '24 hours'),
      research_reference_norm = null, research_proof_hash = null, team_note = txt, updated_at = now() where id = r.id returning * into r;
    perform public._import_notify(r, 'Taxa de pesquisa não confirmada', txt);
  end if;
  return r;
end $$;

-- Orçamento: desconta a taxa de pesquisa já paga (se a regra estiver ligada).
create or replace function public.import_admin_quote(p_id uuid, p_product numeric, p_shipping numeric, p_fee numeric, p_eta_days int, p_note text default null)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; credit numeric; gross numeric;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('requested', 'quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  if coalesce(p_product, 0) <= 0 or coalesce(p_shipping, 0) < 0 or coalesce(p_fee, 0) < 0 or coalesce(p_eta_days, 0) not between 1 and 365 then raise exception 'INVALID_INPUT'; end if;
  gross := round(p_product) + round(coalesce(p_shipping, 0)) + round(coalesce(p_fee, 0));
  credit := case when r.research_paid_at is not null and coalesce((select import_research_deduct from public.platform_settings where id = 1), true)
    then least(r.research_fee, gross) else 0 end;
  update public.import_requests set status = 'quoted', product_cost = round(p_product), shipping_cost = round(coalesce(p_shipping, 0)), service_fee = round(coalesce(p_fee, 0)),
    research_credit = credit, total = gross - credit, eta_days = p_eta_days,
    quote_note = nullif(left(trim(coalesce(p_note, '')), 1000), ''), quoted_at = now(), quote_valid_until = now() + interval '7 days', pay_by = null, team_note = null, updated_at = now()
  where id = r.id returning * into r;
  perform public._import_notify(r, '✈️ Orçamento de importação pronto', r.total || ' Kz · cerca de ' || r.eta_days || ' dias. Aceite para pagar.');
  return r;
end $$;

-- Recusar e cancelar passam a valer também antes de a taxa ser paga.
create or replace function public.import_admin_decline(p_id uuid, p_reason text)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into r from public.import_requests where id = p_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('research_payment', 'requested', 'quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  update public.import_requests set status = 'declined', team_note = txt, updated_at = now() where id = r.id returning * into r;
  perform public._import_notify(r, 'Pedido de importação não disponível', txt);
  return r;
end $$;

create or replace function public.import_cancel(p_id uuid)
returns public.import_requests language plpgsql security definer set search_path = public as $$
declare r public.import_requests;
begin
  select * into r from public.import_requests where id = p_id for update;
  if not found or r.user_id <> auth.uid() then raise exception 'IMPORT_NOT_FOUND'; end if;
  if r.status not in ('research_payment', 'requested', 'quoted', 'awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  update public.import_requests set status = 'cancelled', updated_at = now() where id = r.id returning * into r;
  return r;
end $$;

create or replace function public.admin_list_import_requests(p_status text default null)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select to_jsonb(x) || jsonb_build_object('buyer_name', p.full_name) from public.import_requests x left join public.profiles p on p.id = x.user_id
    where p_status is null or (p_status = 'open' and x.status in ('research_submitted', 'requested', 'quoted', 'awaiting_payment', 'submitted', 'paid', 'purchased', 'in_transit', 'arrived'))
       or x.status = p_status
    order by case x.status when 'submitted' then 0 when 'research_submitted' then 1 when 'requested' then 2 when 'paid' then 3 else 4 end, x.updated_at desc limit 200;
end $$;

-- Equipa: valor da taxa e se é descontada.
create or replace function public.admin_set_import_research(p_fee numeric, p_deduct boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_fee is null or p_fee < 0 or p_fee > 100000 then raise exception 'INVALID_INPUT'; end if;
  update public.platform_settings set import_research_fee_kz = round(p_fee), import_research_deduct = coalesce(p_deduct, true), updated_at = now() where id = 1;
end $$;

revoke all on function public.import_submit_research_payment(uuid,text,text,text,text), public.decide_import_research(uuid,boolean,text), public.admin_set_import_research(numeric,boolean) from public, anon;
grant execute on function public.import_submit_research_payment(uuid,text,text,text,text), public.decide_import_research(uuid,boolean,text), public.admin_set_import_research(numeric,boolean) to authenticated;

-- Comprovativos: a taxa de pesquisa entra no painel e pode ser confirmada pela IA (valor pequeno).
do $$ declare d text := regexp_replace(pg_get_functiondef('public.pending_proof_payments()'::regprocedure), '\s+', ' ', 'g');
  o text := $o$ from public.import_requests i where i.status = 'submitted' and i.proof_path is not null$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND pending_proof_payments'; end if;
  if strpos(d, 'import_research') = 0 then
    execute replace(d, o, o || $n$ union all select 'import_research', i.id, i.research_proof_path, i.research_fee, i.research_method, i.research_reference, i.user_id, i.updated_at, 'Taxa de pesquisa IMP-' || i.ref_no from public.import_requests i where i.status = 'research_submitted' and i.research_proof_path is not null$n$);
  end if;
end $$;

do $$ declare d text := pg_get_functiondef('public.ai_save_proof_check(text,uuid,text,boolean,numeric,date,text,text,text,text,text,text[],text)'::regprocedure);
  o text := $o$        when 'commission' then$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND ai_save_proof_check'; end if;
  if strpos(d, 'import_research') = 0 then
    execute replace(d, o, $n$        when 'import_research' then perform public.decide_import_research(p_payment_id, true, null);
$n$ || o);
  end if;
end $$;

alter table public.payment_proof_checks drop constraint if exists payment_proof_checks_kind_check;
alter table public.payment_proof_checks add constraint payment_proof_checks_kind_check
  check (kind in ('subscription', 'boost', 'promo_boost', 'event_fee', 'fuel_fee', 'venue_fee', 'commission', 'order', 'fuel_order', 'venue_order', 'import_order', 'import_research'));
