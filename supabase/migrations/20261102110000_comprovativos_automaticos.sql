-- Comprovativos com IA, 2.ª camada:
--  • impressão digital (SHA-256) de cada ficheiro: o mesmo ficheiro enviado noutro pagamento fica
--    suspeito, mesmo quando a IA não consegue ler o n.º da operação;
--  • aprovação automática SÓ para taxas pequenas da plataforma (destaques, mensalidades, comissões,
--    eventos, postos, reservas) até ao valor definido pela equipa (1 000 Kz de início; 0 desliga),
--    quando tudo bate certo e no máximo 3 por pessoa em 24 horas. O pagamento protegido das
--    encomendas é sempre confirmado por uma pessoa. As aprovações automáticas ficam registadas em
--    nome da conta interna «Verificação automática (IA)» (sem acesso: não entra no Site nem na APP)
--    e aparecem à equipa para conferir com o extrato.

alter table public.payment_proof_checks
  add column if not exists file_sha256 text,
  add column if not exists payment_label text,
  add column if not exists payer_id uuid,
  add column if not exists auto_confirmed_at timestamptz;
create index if not exists payment_proof_checks_file_idx on public.payment_proof_checks (file_sha256) where file_sha256 is not null;
alter table public.payment_proof_checks drop constraint if exists payment_proof_checks_verdict_check;
alter table public.payment_proof_checks add constraint payment_proof_checks_verdict_check check (verdict in ('match', 'check', 'suspicious', 'unreadable'));

alter table public.platform_settings add column if not exists proof_auto_max_kz numeric not null default 1000
  check (proof_auto_max_kz >= 0 and proof_auto_max_kz <= 50000);

-- Conta interna para as aprovações automáticas (moderador; bloqueada para sempre, sem palavra-passe).
do $$
declare sys uuid;
begin
  select id into sys from auth.users where email = 'verificacao-automatica@huambo.invalid';
  if sys is null then
    sys := gen_random_uuid();
    insert into auth.users(instance_id, id, aud, role, email, encrypted_password, banned_until, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', sys, 'authenticated', 'authenticated', 'verificacao-automatica@huambo.invalid', '', 'infinity',
      '{"provider":"email","providers":["email"]}', '{"full_name":"Verificação automática (IA)"}', now(), now(), '', '', '', '', '', '', '', '');
  end if;
  update public.profiles set full_name = 'Verificação automática (IA)' where id = sys;
  insert into public.user_roles(user_id, role) values (sys, 'moderator') on conflict (user_id) do update set role = 'moderator', updated_at = now();
end $$;

drop function if exists public.ai_save_proof_check(text, uuid, text, boolean, numeric, date, text, text, text, text, text, text[]);
create or replace function public.ai_save_proof_check(p_kind text, p_payment_id uuid, p_proof_path text, p_readable boolean,
  p_amount numeric, p_date date, p_operation text, p_destination text, p_beneficiary text, p_bank text, p_method text, p_visual_flags text[], p_file_hash text default null)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare q record; op text := public.proof_clean(p_operation); dup record; fdup record; s public.platform_settings; auto_ok boolean := false; sys uuid; old_claims text; today_auto int; v text; amt_ok boolean; dest_ok boolean; d_ok boolean;
  flags text[] := coalesce(p_visual_flags[1:4], '{}'); notes text[] := '{}';
begin
  -- Registos vazios para poder perguntar «dup.payment_id is null» mesmo sem procura.
  select null::text as kind, null::uuid as payment_id into dup;
  select null::text as kind, null::uuid as payment_id into fdup;
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
  if p_file_hash is not null then
    select c.kind, c.payment_id into fdup from public.payment_proof_checks c
     where c.file_sha256 = p_file_hash and not (c.kind = p_kind and c.payment_id = p_payment_id) limit 1;
    if dup.payment_id is null and fdup.payment_id is not null then dup := fdup; end if;
  end if;

  if fdup.payment_id is not null then
    -- O mesmo ficheiro já foi enviado noutro pagamento: suspeito, mesmo sem ler nada.
    v := 'suspicious'; notes := array['Este mesmo ficheiro de comprovativo já foi enviado noutro pagamento (talão repetido).'];
  elsif not coalesce(p_readable, false) or p_amount is null then v := 'unreadable'; notes := array['Não foi possível ler o valor no comprovativo.'];
  else
    if dup.payment_id is not null then notes := notes || 'Este n.º de operação já foi usado noutro pagamento (talão repetido).'::text; end if;
    if amt_ok = false then notes := notes || format('Valor no talão: %s Kz; esperado: %s Kz.', p_amount, q.amount); end if;
    if dest_ok = false then notes := notes || 'A conta de destino não é nenhuma das contas da plataforma.'::text; end if;
    if d_ok = false then notes := notes || 'A data do talão não bate com a data do pedido.'::text; end if;
    if cardinality(flags) > 0 then notes := notes || ('Sinais visuais: ' || array_to_string(flags, '; ')); end if;
    v := case
      when dup.payment_id is not null or dest_ok = false or (amt_ok = false and p_amount < q.amount) then 'suspicious'
      when amt_ok and dest_ok is distinct from false and d_ok is distinct from false and cardinality(flags) = 0 and dest_ok and op is not null then 'match'
      else 'check' end;
    if v = 'match' then notes := array['Valor, conta de destino e data batem certo; n.º de operação nunca usado.'];
    elsif v = 'check' and cardinality(notes) = 0 then notes := array['Faltam dados no talão (conta de destino ou n.º da operação): confirme no extrato.']; end if;
  end if;

  insert into public.payment_proof_checks(kind, payment_id, file_sha256, payment_label, payer_id, proof_path, expected_amount, readable, read_amount, read_date, read_operation,
    read_destination, read_beneficiary, read_bank, read_method, amount_ok, destination_ok, date_ok, duplicate_kind, duplicate_id, visual_flags, verdict, summary, checked_at)
  values (p_kind, p_payment_id, p_file_hash, q.label, q.payer_id, p_proof_path, q.amount, coalesce(p_readable, false), p_amount, p_date, op, left(p_destination, 60), left(p_beneficiary, 120),
    left(p_bank, 60), left(p_method, 40), amt_ok, dest_ok, d_ok, dup.kind, dup.payment_id, flags, v, left(array_to_string(notes, ' '), 600), now())
  on conflict (kind, payment_id) do update set file_sha256 = excluded.file_sha256, payment_label = excluded.payment_label, payer_id = excluded.payer_id, proof_path = excluded.proof_path, expected_amount = excluded.expected_amount, readable = excluded.readable,
    read_amount = excluded.read_amount, read_date = excluded.read_date, read_operation = excluded.read_operation, read_destination = excluded.read_destination,
    read_beneficiary = excluded.read_beneficiary, read_bank = excluded.read_bank, read_method = excluded.read_method, amount_ok = excluded.amount_ok,
    destination_ok = excluded.destination_ok, date_ok = excluded.date_ok, duplicate_kind = excluded.duplicate_kind, duplicate_id = excluded.duplicate_id,
    visual_flags = excluded.visual_flags, verdict = excluded.verdict, summary = excluded.summary, checked_at = now();

  -- Aprovação automática: só taxas pequenas da plataforma (nunca o pagamento protegido de
  -- encomendas), só quando tudo bate certo e no máximo 3 por pessoa em 24 horas.
  select * into s from public.platform_settings where id = 1;
  if v = 'match' and p_kind <> 'order' and coalesce(s.proof_auto_max_kz, 0) > 0 and q.amount <= s.proof_auto_max_kz then
    select count(*) into today_auto from public.payment_proof_checks c
     where c.payer_id = q.payer_id and c.auto_confirmed_at > now() - interval '24 hours';
    auto_ok := today_auto < 3;
  end if;
  if auto_ok then
    select id into sys from auth.users where email = 'verificacao-automatica@huambo.invalid';
    old_claims := current_setting('request.jwt.claims', true);
    perform set_config('request.jwt.claims', json_build_object('sub', sys, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    perform set_config('request.jwt.claim.sub', sys::text, true);
    begin
      case p_kind
        when 'subscription' then perform public.admin_decide_subscription_payment(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'boost' then perform public.admin_decide_boost(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'promo_boost' then perform public.admin_decide_promo_boost(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'event_fee' then perform public.admin_decide_event_payment(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'fuel_fee' then perform public.admin_decide_fuel_payment(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'venue_fee' then perform public.admin_decide_venue_payment(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'commission' then perform public.admin_update_commission(p_payment_id, 'confirm', 'Confirmado automaticamente: o comprovativo bate certo.', null);
      end case;
      update public.payment_proof_checks set auto_confirmed_at = now() where kind = p_kind and payment_id = p_payment_id;
      v := 'auto_confirmed';
    exception when others then
      -- Se a confirmação falhar, fica para a equipa como «bate certo».
      raise warning 'auto-confirm % %: %', p_kind, p_payment_id, sqlerrm;
    end;
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  if v = 'suspicious' then
    perform public.notify_staff('🚩 Comprovativo suspeito', q.label || ' · ' || q.amount || ' Kz',
      jsonb_build_object('kind', 'proof_check', 'payment_kind', p_kind, 'payment_id', p_payment_id));
  end if;
  return v;
end $function$;
revoke all on function public.ai_save_proof_check(text, uuid, text, boolean, numeric, date, text, text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.ai_save_proof_check(text, uuid, text, boolean, numeric, date, text, text, text, text, text, text[], text) to service_role;

/** Equipa: pagamentos aprovados automaticamente nos últimos dias (para conferir com o extrato). */
create or replace function public.admin_list_auto_confirmed(p_days integer default 7)
 returns table(kind text, payment_id uuid, label text, amount numeric, payer_id uuid, payer_name text, read_operation text, read_bank text, read_date date, proof_path text, auto_confirmed_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select c.kind, c.payment_id, c.payment_label, c.expected_amount, c.payer_id, pr.full_name, c.read_operation, c.read_bank, c.read_date, c.proof_path, c.auto_confirmed_at
  from public.payment_proof_checks c left join public.profiles pr on pr.id = c.payer_id
  where c.auto_confirmed_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 60)))
  order by c.auto_confirmed_at desc limit 200;
end $function$;
revoke all on function public.admin_list_auto_confirmed(integer) from public, anon;
grant execute on function public.admin_list_auto_confirmed(integer) to authenticated;
