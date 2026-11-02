-- Verificação de comprovativos de pagamento com IA (OpenAI gpt-4o-mini, Edge Function «ai-proof-check»).
--
-- A IA LÊ o talão/captura (valor, data, n.º da operação, conta de destino, beneficiário) e a base
-- de dados CONFERE com regras fixas: valor certo, conta de destino é uma das contas da plataforma,
-- data plausível e n.º de operação nunca usado antes (talão repetido = suspeito). A IA também pode
-- apontar sinais visuais de edição, mas isso só serve de aviso.
-- Quem confirma o pagamento é sempre a equipa (um comprovativo pode ser falsificado na perfeição;
-- só o extrato do banco prova que o dinheiro entrou).

create table if not exists public.payment_proof_checks (
  kind text not null check (kind in ('subscription', 'boost', 'promo_boost', 'event_fee', 'fuel_fee', 'venue_fee', 'commission', 'order')),
  payment_id uuid not null,
  proof_path text not null,
  expected_amount numeric,
  readable boolean not null default false,
  read_amount numeric,
  read_date date,
  read_operation text,
  read_destination text,
  read_beneficiary text,
  read_bank text,
  read_method text,
  amount_ok boolean,
  destination_ok boolean,
  date_ok boolean,
  duplicate_kind text,
  duplicate_id uuid,
  visual_flags text[] not null default '{}',
  verdict text not null check (verdict in ('match', 'check', 'suspicious', 'unreadable')),
  summary text,
  checked_at timestamptz not null default now(),
  primary key (kind, payment_id)
);
create index if not exists payment_proof_checks_operation_idx on public.payment_proof_checks (read_operation) where read_operation is not null;
alter table public.payment_proof_checks enable row level security;
revoke all on public.payment_proof_checks from public, anon, authenticated;
grant select on public.payment_proof_checks to authenticated;
create policy payment_proof_checks_staff_read on public.payment_proof_checks for select to authenticated using (public.has_admin_role());

/** Pagamentos à plataforma com comprovativo, ainda por decidir (todas as tabelas). */
create or replace function public.pending_proof_payments()
 returns table(kind text, payment_id uuid, proof_path text, amount numeric, method text, reference text, payer_id uuid, created_at timestamptz, label text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select 'subscription', p.id, p.proof_path, p.amount, p.method, p.reference, p.owner_id, p.created_at, 'Mensalidade (' || p.months || ' mês/meses)'
    from public.subscription_payments p where p.status = 'pending' and p.proof_path is not null
  union all select 'boost', b.id, b.proof_path, b.amount, b.method, b.reference, b.owner_id, b.created_at, 'Destaque de anúncio' || coalesce(' #' || b.ref_no, '')
    from public.listing_boosts b where b.status = 'pending' and b.proof_path is not null
  union all select 'promo_boost', b.id, b.proof_path, b.amount, b.method, b.reference, b.owner_id, b.created_at, 'Destaque de vídeo' || coalesce(' #' || b.ref_no, '')
    from public.promo_boosts b where b.status = 'pending' and b.proof_path is not null
  union all select 'event_fee', p.id, p.proof_path, p.amount, p.method, p.reference, p.organizer_id, p.created_at, 'Evento' || coalesce(' #' || p.ref_no, '')
    from public.event_platform_payments p where p.status = 'pending' and p.proof_path is not null
  union all select 'fuel_fee', p.id, p.proof_path, p.amount, p.method, p.reference, p.owner_id, p.created_at, 'Posto de combustível' || coalesce(' #' || p.ref_no, '')
    from public.fuel_platform_payments p where p.status = 'pending' and p.proof_path is not null
  union all select 'venue_fee', p.id, p.proof_path, p.amount, p.method, p.reference, p.owner_id, p.created_at, 'Hotel/restaurante/armazém' || coalesce(' #' || p.ref_no, '')
    from public.venue_platform_payments p where p.status = 'pending' and p.proof_path is not null
  union all select 'commission', c.id, c.proof_path, c.amount, c.method, c.reference, c.owner_id, coalesce(c.submitted_at, c.created_at), 'Comissão: ' || coalesce(c.listing_title, 'anúncio')
    from public.listing_commissions c where c.status = 'submitted' and c.proof_path is not null
  union all select 'order', p.id, p.proof_path, p.amount, p.method, p.reference, p.buyer_id, p.created_at, 'Pagamento protegido da encomenda'
    from public.order_payments p where p.status = 'pending' and p.provider = 'manual' and p.proof_path is not null
$function$;
revoke all on function public.pending_proof_payments() from public, anon, authenticated;

/** Fila para a IA: comprovativos ainda não lidos (ou trocados). Só o servidor. */
create or replace function public.ai_proof_queue(p_limit integer default 10)
 returns table(kind text, payment_id uuid, proof_path text, amount numeric, method text, reference text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select q.kind, q.payment_id, q.proof_path, q.amount, q.method, q.reference
  from public.pending_proof_payments() q
  left join public.payment_proof_checks c on c.kind = q.kind and c.payment_id = q.payment_id
  where c.payment_id is null or c.proof_path <> q.proof_path
  order by q.created_at
  limit greatest(1, least(coalesce(p_limit, 10), 20))
$function$;
revoke all on function public.ai_proof_queue(integer) from public, anon, authenticated;
grant execute on function public.ai_proof_queue(integer) to service_role;

/** Só algarismos e letras, em maiúsculas (para comparar n.º de operação e contas). */
create or replace function public.proof_clean(p text)
 returns text
 language sql
 immutable
as $function$ select nullif(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), '') $function$;

/** A conta de destino lida no talão é uma das contas da plataforma (IBAN ou Multicaixa Express)? */
create or replace function public.proof_destination_ok(p_read text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare s public.platform_settings; d text := regexp_replace(coalesce(p_read, ''), '\D', '', 'g'); acc jsonb; ib text; ex text;
begin
  if length(d) < 6 then return null; end if;
  select * into s from public.platform_settings where id = 1;
  ex := regexp_replace(coalesce(s.express_number, ''), '\D', '', 'g');
  if length(ex) >= 9 and right(d, 9) = right(ex, 9) then return true; end if;
  for acc in select * from jsonb_array_elements(coalesce(s.payment_accounts, '[]'::jsonb) || coalesce(jsonb_build_array(jsonb_build_object('iban', s.iban)), '[]'::jsonb)) loop
    ib := regexp_replace(coalesce(acc->>'iban', ''), '\D', '', 'g');
    -- Os talões costumam mostrar o IBAN inteiro ou só os últimos algarismos: comparamos o fim.
    if length(ib) >= 8 and length(d) >= 8 and (right(ib, least(length(d), 21)) = right(d, least(length(d), 21)) or right(ib, 8) = right(d, 8)) then return true; end if;
  end loop;
  -- Há contas registadas e nenhuma bate certo: destino errado.
  if length(ex) >= 9 or jsonb_array_length(coalesce(s.payment_accounts, '[]'::jsonb)) > 0 or coalesce(s.iban, '') <> '' then return false; end if;
  return null;
end $function$;
revoke all on function public.proof_destination_ok(text) from public, anon, authenticated;

/** Guarda a leitura da IA e confere com regras fixas. Só o servidor. */
create or replace function public.ai_save_proof_check(p_kind text, p_payment_id uuid, p_proof_path text, p_readable boolean,
  p_amount numeric, p_date date, p_operation text, p_destination text, p_beneficiary text, p_bank text, p_method text, p_visual_flags text[])
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare q record; op text := public.proof_clean(p_operation); dup record; v text; amt_ok boolean; dest_ok boolean; d_ok boolean;
  flags text[] := coalesce(p_visual_flags[1:4], '{}'); notes text[] := '{}';
begin
  select * into q from public.pending_proof_payments() x where x.kind = p_kind and x.payment_id = p_payment_id;
  if not found then return 'gone'; end if;
  if op is not null and length(op) < 5 then op := null; end if;
  amt_ok := case when p_amount is null then null else abs(p_amount - q.amount) < 1 end;
  dest_ok := public.proof_destination_ok(p_destination);
  d_ok := case when p_date is null then null else p_date between (q.created_at::date - 10) and (current_date + 1) end;
  if op is not null then
    select c.kind, c.payment_id into dup from public.payment_proof_checks c
     where c.read_operation = op and not (c.kind = p_kind and c.payment_id = p_payment_id) limit 1;
  end if;

  if not coalesce(p_readable, false) or p_amount is null then v := 'unreadable'; notes := array['Não foi possível ler o valor no comprovativo.'];
  else
    if dup.payment_id is not null then notes := notes || 'Este n.º de operação já foi usado noutro pagamento (talão repetido).'; end if;
    if amt_ok = false then notes := notes || format('Valor no talão: %s Kz; esperado: %s Kz.', p_amount, q.amount); end if;
    if dest_ok = false then notes := notes || 'A conta de destino não é nenhuma das contas da plataforma.'; end if;
    if d_ok = false then notes := notes || 'A data do talão não bate com a data do pedido.'; end if;
    if cardinality(flags) > 0 then notes := notes || ('Sinais visuais: ' || array_to_string(flags, '; ')); end if;
    v := case
      when dup.payment_id is not null or dest_ok = false or (amt_ok = false and p_amount < q.amount) then 'suspicious'
      when amt_ok and dest_ok is distinct from false and d_ok is distinct from false and cardinality(flags) = 0 and dest_ok and op is not null then 'match'
      else 'check' end;
    if v = 'match' then notes := array['Valor, conta de destino e data batem certo; n.º de operação nunca usado.'];
    elsif v = 'check' and cardinality(notes) = 0 then notes := array['Faltam dados no talão (conta de destino ou n.º da operação): confirme no extrato.']; end if;
  end if;

  insert into public.payment_proof_checks(kind, payment_id, proof_path, expected_amount, readable, read_amount, read_date, read_operation,
    read_destination, read_beneficiary, read_bank, read_method, amount_ok, destination_ok, date_ok, duplicate_kind, duplicate_id, visual_flags, verdict, summary, checked_at)
  values (p_kind, p_payment_id, p_proof_path, q.amount, coalesce(p_readable, false), p_amount, p_date, op, left(p_destination, 60), left(p_beneficiary, 120),
    left(p_bank, 60), left(p_method, 40), amt_ok, dest_ok, d_ok, dup.kind, dup.payment_id, flags, v, left(array_to_string(notes, ' '), 600), now())
  on conflict (kind, payment_id) do update set proof_path = excluded.proof_path, expected_amount = excluded.expected_amount, readable = excluded.readable,
    read_amount = excluded.read_amount, read_date = excluded.read_date, read_operation = excluded.read_operation, read_destination = excluded.read_destination,
    read_beneficiary = excluded.read_beneficiary, read_bank = excluded.read_bank, read_method = excluded.read_method, amount_ok = excluded.amount_ok,
    destination_ok = excluded.destination_ok, date_ok = excluded.date_ok, duplicate_kind = excluded.duplicate_kind, duplicate_id = excluded.duplicate_id,
    visual_flags = excluded.visual_flags, verdict = excluded.verdict, summary = excluded.summary, checked_at = now();

  if v = 'suspicious' then
    perform public.notify_staff('🚩 Comprovativo suspeito', q.label || ' · ' || q.amount || ' Kz',
      jsonb_build_object('kind', 'proof_check', 'payment_kind', p_kind, 'payment_id', p_payment_id));
  end if;
  return v;
end $function$;
revoke all on function public.ai_save_proof_check(text, uuid, text, boolean, numeric, date, text, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.ai_save_proof_check(text, uuid, text, boolean, numeric, date, text, text, text, text, text, text[]) to service_role;

/** Equipa: comprovativos por decidir, com o resultado da verificação (suspeitos primeiro). */
create or replace function public.admin_list_proof_checks()
 returns table(kind text, payment_id uuid, label text, amount numeric, method text, reference text, payer_id uuid, payer_name text, created_at timestamptz,
   proof_path text, verdict text, summary text, read_amount numeric, read_date date, read_operation text, read_destination text, read_beneficiary text,
   read_bank text, amount_ok boolean, destination_ok boolean, date_ok boolean, duplicate_kind text, duplicate_id uuid, checked_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select q.kind, q.payment_id, q.label, q.amount, q.method, q.reference, q.payer_id, pr.full_name, q.created_at, q.proof_path,
         coalesce(c.verdict, 'pending'), c.summary, c.read_amount, c.read_date, c.read_operation, c.read_destination, c.read_beneficiary, c.read_bank,
         c.amount_ok, c.destination_ok, c.date_ok, c.duplicate_kind, c.duplicate_id, c.checked_at
  from public.pending_proof_payments() q
  left join public.payment_proof_checks c on c.kind = q.kind and c.payment_id = q.payment_id and c.proof_path = q.proof_path
  left join public.profiles pr on pr.id = q.payer_id
  order by case coalesce(c.verdict, 'pending') when 'suspicious' then 0 when 'unreadable' then 1 when 'check' then 2 when 'pending' then 3 else 4 end, q.created_at
  limit 200;
end $function$;
revoke all on function public.admin_list_proof_checks() from public, anon;
grant execute on function public.admin_list_proof_checks() to authenticated;

-- A cada 5 minutos, se houver comprovativos novos, a função «ai-proof-check» lê-os.
select cron.schedule('huambo-online-ai-proof-check', '*/5 * * * *', $$
  select net.http_post('https://pewymvkowbdizdiyjmao.supabase.co/functions/v1/ai-proof-check', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld3ltdmtvd2JkaXpkaXlqbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0OTg4MTYsImV4cCI6MjEwOTA3NDgxNn0.Lo8I9suwa7uqAub4UYmdeasDpHTvePAU23SI7rL43wk'),
    30000)
  where exists (select 1 from public.ai_proof_queue(1))
$$);
