CREATE OR REPLACE FUNCTION public.activate_due_auctions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer;
begin
  update public.auctions
  set status='live', updated_at=now()
  where status='scheduled' and starts_at <= now() and ends_at > now();
  get diagnostics v_count = row_count;

  update public.auctions
  set status='ended', updated_at=now()
  where status='live' and ends_at <= now();

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_agent(p_user_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS field_agents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_agent_commissions(p_ids uuid[], p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_boost(p_boost_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS listing_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_dispute(p_dispute_id uuid, p_decision text, p_amount numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.order_disputes; o public.orders; amt numeric; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  if p_decision not in ('refund', 'return_refund', 'replacement', 'reject') then raise exception 'INVALID_DECISION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into o from public.orders where id = d.order_id;
  if p_decision in ('refund', 'return_refund') then
    amt := coalesce(p_amount, d.amount, o.total - o.refunded_amount);
    if amt <= 0 or amt > o.total - o.refunded_amount then raise exception 'INVALID_AMOUNT'; end if;
  end if;
  update public.order_disputes set
    request = case when p_decision = 'reject' then request else p_decision end,
    amount = case when p_decision = 'reject' then amount when p_decision = 'replacement' then null else amt end,
    status = case p_decision when 'refund' then 'awaiting_refund' when 'return_refund' then 'awaiting_return' when 'replacement' then 'replacing' else 'resolved' end,
    outcome = case when p_decision = 'reject' then 'rejected' end,
    resolved_at = case when p_decision = 'reject' then now() end,
    admin_note = txt, updated_at = now()
   where id = d.id returning * into d;
  perform public.dispute_log(d, 'admin', 'decided', txt);
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'dispute_decided', 'order', d.order_id, jsonb_build_object('dispute_id', d.id, 'decision', p_decision, 'amount', d.amount));
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_event_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS event_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.event_platform_payments; e public.events; txt text := nullif(left(trim(coalesce(p_note, '')), 500), ''); until_ timestamptz;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.event_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into e from public.events where id = p.event_id for update;
  update public.event_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  if p_confirm and p.kind = 'boost' then
    until_ := greatest(now(), coalesce(e.featured_until, now())) + make_interval(days => coalesce(p.days, 7));
    perform set_config('huambo.allow_feature', 'on', true);
    update public.events set featured_until = until_ where id = e.id;
    perform set_config('huambo.allow_feature', '', true);
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.organizer_id, 'system',
    case when not p_confirm then 'Pagamento não confirmado' when p.kind = 'boost' then 'Evento em destaque ⭐' else 'Comissão do evento paga ✔' end,
    case when not p_confirm then '«' || left(e.title, 80) || '»: ' || txt
         when p.kind = 'boost' then '«' || left(e.title, 80) || '» aparece em destaque até ' || to_char(until_ at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.'
         else '«' || left(e.title, 80) || '»: pagamento de ' || p.amount || ' Kz confirmado.' end,
    jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'event_' || p.kind || case when p_confirm then '_confirmed' else '_rejected' end, 'event', e.id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_fuel_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS fuel_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.fuel_platform_payments; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.fuel_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.fuel_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  select * into s from public.fuel_stations where id = p.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Comissão paga ✔' else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': pagamento de ' || p.amount || ' Kz confirmado.' else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fuel_fee' || case when p_confirm then '_confirmed' else '_rejected' end, 'fuel_station', s.id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_inspection(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text, p_checklist jsonb DEFAULT '{}'::jsonb)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; st public.platform_settings; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_approve and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_approve and not coalesce((p_checklist->>'exists')::boolean, false) then raise exception 'INSPECTION_CHECKLIST'; end if;
  select * into st from public.platform_settings where id = 1;
  update public.inspections set status = case when p_approve then 'approved' else 'rejected' end, admin_note = txt, checklist = coalesce(p_checklist, '{}'::jsonb),
    inspected_at = now(), valid_until = case when p_approve then now() + make_interval(months => st.inspection_valid_months) end, updated_at = now()
    where id = p_id and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'inspection_approved' else 'inspection_rejected' end, i.kind, i.target_id, jsonb_build_object('inspection', i.ref_no, 'note', txt, 'checklist', i.checklist));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', case when p_approve then '🏅 Inspeção aprovada' else 'Inspeção não aprovada' end,
    coalesce(public.inspection_target_name(i.kind, i.target_id), '') || case when p_approve then ': já mostra o selo «Inspecionado» até ' || to_char(i.valid_until at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.' else ': ' || txt end,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_inspection_payment(p_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.inspections set status = case when p_confirm then 'requested' else 'awaiting_payment' end, paid_at = case when p_confirm then now() end,
    admin_note = txt, updated_at = now() where id = p_id and status = 'payment_submitted' returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'inspection_payment_confirmed' else 'inspection_payment_rejected' end, i.kind, i.target_id,
    jsonb_build_object('inspection', i.ref_no, 'amount', i.fee_amount, 'reference', i.pay_reference, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', case when p_confirm then '🏅 Taxa de inspeção confirmada' else 'Pagamento da inspeção não confirmado' end,
    coalesce(public.inspection_target_name(i.kind, i.target_id), '') || case when p_confirm then ': vamos ligar para marcar a visita.' else ': ' || txt end,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_listing_claim(p_claim_id uuid, p_uphold boolean, p_note text)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_order_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS order_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.order_payments; o public.orders; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into pay from public.order_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status <> 'pending' or pay.provider <> 'manual' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  select * into o from public.orders where id = pay.order_id;
  if p_confirm then
    perform public.escrow_mark_paid(pay.id, null, null);
  else
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.order_payments set status = 'rejected', admin_note = txt, decided_at = now(), decided_by = auth.uid() where id = pay.id;
    -- mais um dia para voltar a enviar
    update public.orders set pay_by = greatest(pay_by, now() + interval '24 hours'), updated_at = now() where id = o.id and escrow_status = 'awaiting_payment';
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento não confirmado', txt || ' Pode enviar o comprovativo outra vez.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'order_payment_confirmed' else 'order_payment_rejected' end, 'order', o.id,
    jsonb_build_object('payment_id', pay.id, 'amount', pay.amount, 'note', txt));
  select * into pay from public.order_payments where id = p_payment_id;
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_promo_boost(p_boost_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS promo_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b public.promo_boosts; p public.promo_posts;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_confirm and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into b from public.promo_boosts where id = p_boost_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  update public.promo_boosts set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = nullif(trim(coalesce(p_note, '')), ''),
    decided_by = auth.uid(), decided_at = now() where id = b.id returning * into b;
  if p_confirm then
    update public.promo_posts set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => b.days) where id = b.post_id returning * into p;
  else select * into p from public.promo_posts where id = b.post_id; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (b.owner_id, 'system', case when p_confirm then '⭐ Destaque ativo' else 'Destaque não confirmado' end,
    case when p_confirm then '«' || p.title || '» fica em destaque até ' || to_char(p.featured_until at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.'
         else '«' || p.title || '»: ' || trim(p_note) end,
    jsonb_build_object('for', 'promo', 'post_id', p.id));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_subscription_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS subscription_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.subscription_payments; s public.subscriptions; new_end timestamptz; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p.subscription_id for update;
  if p_confirm then
    new_end := greatest(now(), public.subscription_active_until(s)) + make_interval(months => p.months);
    update public.subscriptions set paid_until = new_end, last_reminder = null where id = s.id;
  end if;
  update public.subscription_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt,
    period_end = new_end, decided_by = auth.uid(), decided_at = now() where id = p.id returning * into p;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'subscription_payment_confirmed' else 'subscription_payment_rejected' end, s.kind, coalesce(s.provider_id, s.business_id),
          jsonb_build_object('payment_id', p.id, 'amount', p.amount, 'months', p.months));
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Pagamento confirmado ✔' else 'Pagamento não confirmado' end,
          case when p_confirm then 'A mensalidade está paga até ' || to_char(new_end at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.' else txt end,
          jsonb_build_object('payment_id', p.id, 'for', 'plan'));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_venue_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS venue_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.venue_platform_payments; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.venue_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.venue_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  select b.name into bname from public.venues v join public.businesses b on b.id = v.business_id where v.id = p.venue_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Taxa paga ✔' else 'Pagamento não confirmado' end,
    case when p_confirm then bname || ': pagamento de ' || p.amount || ' Kz confirmado.' else bname || ': ' || txt end,
    jsonb_build_object('for', 'venue', 'venue_id', p.venue_id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'venue_fee' || case when p_confirm then '_confirmed' else '_rejected' end, 'venue', p.venue_id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_verification(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.verification_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into v from public.verification_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  update public.verification_requests set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), decided_by = auth.uid(), decided_at = now()
   where id = v.id returning * into v;
  if p_approve then
    if v.kind = 'identity' then update public.profiles set kyc_level = greatest(kyc_level, 1) where id = v.user_id;
    elsif v.kind = 'provider' then update public.provider_profiles set verified = true where user_id = v.user_id;
    else update public.businesses set verified = true where id = v.business_id; end if;
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'verification_approved' else 'verification_rejected' end, v.kind, coalesce(v.business_id, v.user_id), jsonb_build_object('request_id', v.id));
  insert into public.notifications(user_id, type, title, body, data)
  values (v.user_id, 'system', case when p_approve then 'Verificação aprovada ✔' else 'Verificação recusada' end,
          case when p_approve then 'O seu perfil passa a mostrar o selo de verificado.' else coalesce(v.admin_note, 'Envie um documento legível e tente novamente.') end,
          jsonb_build_object('verification_id', v.id, 'for', 'verification'));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_escrow_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'held', (select coalesce(sum(amount), 0) from public.wallet_entries where bucket = 'pending'),
    'available', (select coalesce(sum(amount), 0) from public.wallet_entries where bucket = 'available'),
    'payouts_open', (select coalesce(sum(amount), 0) from public.payout_requests where status in ('requested', 'processing')),
    'payouts_requested', (select count(*) from public.payout_requests where status = 'requested'),
    'payouts_processing', (select count(*) from public.payout_requests where status = 'processing'),
    'payments_pending', (select count(*) from public.order_payments where status = 'pending' and provider = 'manual'),
    'awaiting_payment', (select count(*) from public.orders where escrow_status = 'awaiting_payment' and status <> 'cancelled'),
    'refunds_to_send', (select count(*) from public.order_disputes d join public.orders o on o.id = d.order_id
                         where o.escrow_status = 'held' and d.status = 'awaiting_refund'),
    'fees_30d', (select coalesce(sum(platform_fee), 0) from public.orders where released_at > now() - interval '30 days'));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_job_queue_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'pending', (select count(*) from public.job_queue where done_at is null),
    'oldest_pending_seconds', (select extract(epoch from now() - min(created_at))::int from public.job_queue where done_at is null),
    'done_last_hour', (select count(*) from public.job_queue where done_at > now() - interval '1 hour' and last_error is null),
    'failed', (select count(*) from public.job_queue where done_at is not null and last_error is not null and attempts >= 5));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agent_commissions(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, agent_id uuid, agent_code text, agent_name text, listing_id uuid, listing_title text, listing_status text, listing_ref bigint, owner_name text, amount numeric, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.agent_id, a.code, a.full_name, c.listing_id, c.listing_title, l.status, l.ref_no,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.amount, c.status, c.admin_note, c.created_at
  from public.agent_commissions c join public.field_agents a on a.user_id = c.agent_id
    left join public.classified_listings l on l.id = c.listing_id left join public.profiles p on p.id = c.owner_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agent_commissions_v2(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, agent_id uuid, agent_code text, agent_name text, listing_id uuid, listing_title text, listing_status text, listing_ref bigint, owner_name text, amount numeric, sale_amount numeric, rate_pct numeric, seller_commission_status text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agents(p_status text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, code text, full_name text, phone text, note text, status text, admin_note text, market_name text, created_at timestamp with time zone, listings bigint, pending_count bigint, pending_kz numeric, approved_kz numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agents_v2(p_status text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, code text, full_name text, phone text, note text, status text, admin_note text, market_name text, created_at timestamp with time zone, listings bigint, sold bigint, pending_count bigint, pending_kz numeric, approved_kz numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit integer DEFAULT 100)
 RETURNS TABLE(id bigint, actor_name text, action text, target_type text, target_id uuid, details jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.id, coalesce(nullif(p.full_name, ''), 'Administração'), a.action, a.target_type, a.target_id, a.details, a.created_at
  from public.admin_audit_log a left join public.profiles p on p.id = a.actor_id
  order by a.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 500));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_boosts(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, owner_id uuid, owner_name text, phone text, days integer, amount numeric, status text, method text, reference text, proof_path text, starts_at timestamp with time zone, ends_at timestamp with time zone, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select b.id, b.ref_no, b.listing_id, l.title, b.owner_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.phone, b.days, b.amount,
    b.status, b.method, b.reference, b.proof_path, b.starts_at, b.ends_at, b.admin_note, b.created_at
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles p on p.id = b.owner_id
  where p_status is null or b.status = p_status order by b.created_at desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_commissions(p_status text DEFAULT 'submitted'::text)
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, owner_id uuid, owner_name text, phone text, listed_price numeric, sale_amount numeric, rate_pct numeric, amount numeric, source text, status text, due_at timestamp with time zone, method text, reference text, proof_path text, admin_note text, submitted_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.listing_id, c.listing_title, c.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone, c.listed_price, c.sale_amount, c.rate_pct,
    c.amount, c.source, c.status, c.due_at, c.method, c.reference, c.proof_path, c.admin_note, c.submitted_at, c.created_at
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where p_status is null or c.status = p_status or (p_status = 'overdue' and c.status = 'due' and c.due_at < now())
  order by (c.status = 'submitted') desc, c.due_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_couriers()
 RETURNS TABLE(user_id uuid, display_name text, phone text, vehicle text, municipality text, status text, available boolean, created_at timestamp with time zone, delivered bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.user_id, c.display_name, c.phone, c.vehicle, m.name, c.status, c.available, c.created_at,
    (select count(*) from public.delivery_requests d where d.assigned_to = c.user_id and d.status = 'delivered')
  from public.couriers c left join public.municipalities m on m.id = c.municipality_id
  order by (c.status = 'pending') desc, c.created_at desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_deliveries()
 RETURNS TABLE(id uuid, order_id uuid, status text, requested_at timestamp with time zone, total numeric, delivery_text text, seller_name text, courier_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.status, d.requested_at, o.total, o.delivery_text,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), c.display_name
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id left join public.couriers c on c.user_id = d.assigned_to
  where d.status not in ('delivered', 'cancelled') order by d.requested_at limit 200;
end $function$
;
