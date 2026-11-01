CREATE OR REPLACE FUNCTION public.submit_venue_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found or o.buyer_id <> me then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'VENUE_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'VENUE_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.venue_orders x where x.id <> o.id and x.reference_norm = ref_n)
     or exists (select 1 from public.fuel_orders x where x.reference_norm = ref_n) then raise exception 'VENUE_REFERENCE_USED'; end if;
  if h is not null and (exists (select 1 from public.venue_orders x where x.id <> o.id and x.proof_hash = h)
     or exists (select 1 from public.fuel_orders x where x.proof_hash = h)) then raise exception 'VENUE_PROOF_USED'; end if;
  update public.venue_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, code = coalesce(code, public.new_venue_code()), note = null, updated_at = now()
    where id = o.id returning * into o;
  select * into v from public.venues where id = o.venue_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', '💳 Pagamento com comprovativo para confirmar', 'R-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · confirme na sua conta bancária.',
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.subscription_active_until(s subscriptions)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at)); $function$
;

CREATE OR REPLACE FUNCTION public.subscription_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; c record; tag text; n integer := 0; ends timestamptz; title text; body text; price numeric;
begin
  for s in select x.*, public.subscription_active_until(x) as until, public.plan_subject_name(x) as name
    from public.subscriptions x where public.plan_subject_exists(x) loop
    ends := s.until;
    tag := case when ends <= now() then 'end' when ends <= now() + interval '1 day' then 'd1' when ends <= now() + interval '7 days' then 'd7' end;
    continue when tag is null or s.last_reminder = tag || ':' || ends::date;
    continue when tag = 'end' and ends < now() - interval '3 days';
    price := public.plan_monthly_price(s.kind);
    title := case tag when 'end' then case when s.kind = 'store' then 'Os seus produtos deixaram de aparecer' else 'O seu perfil deixou de aparecer' end
                      when 'd1' then 'O seu plano termina amanhã' else 'O seu plano termina em 7 dias' end;
    body := '«' || s.name || '»: ' || case when tag = 'end' then 'pague a mensalidade de ' || price || ' Kz para voltar a aparecer aos clientes.'
                                          else (case when s.paid_until is null then 'o mês grátis' else 'o período pago' end) || ' termina a ' || to_char(ends at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '. Mensalidade: ' || price || ' Kz.' end;
    insert into public.notifications(user_id, type, title, body, data) values (s.owner_id, 'system', title, body, jsonb_build_object('subscription_id', s.id, 'for', 'plan'));
    update public.subscriptions set last_reminder = tag || ':' || ends::date where id = s.id;
    n := n + 1;
  end loop;
  for c in select * from public.listing_commissions where status = 'due' loop
    tag := case when c.due_at <= now() then 'late' when c.due_at <= now() + interval '2 days' then 'd2' end;
    continue when tag is null or c.last_reminder = tag;
    insert into public.notifications(user_id, type, title, body, data)
    values (c.owner_id, 'system', case tag when 'late' then 'Comissão em atraso' else 'Comissão a pagar em 2 dias' end,
            '«' || c.listing_title || '»: ' || c.amount || ' Kz.' || case when tag = 'late' then ' Enquanto não pagar, não pode publicar anúncios novos.' else '' end,
            jsonb_build_object('listing_id', c.listing_id, 'for', 'commission'));
    update public.listing_commissions set last_reminder = tag where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.subscription_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_days integer := coalesce((select trial_days from public.platform_settings where id = 1), 30);
begin
  if tg_table_name = 'provider_profiles' then
    insert into public.subscriptions(kind, owner_id, provider_id, trial_ends_at) values ('provider', new.user_id, new.user_id, now() + make_interval(days => v_days))
    on conflict do nothing;
  else
    insert into public.subscriptions(kind, owner_id, business_id, trial_ends_at) values ('business', new.owner_id, new.id, now() + make_interval(days => v_days))
    on conflict do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.suggest_market(p_name text, p_municipality_id uuid, p_address text DEFAULT NULL::text, p_description text DEFAULT NULL::text)
 RETURNS markets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.markets;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_MARKET'; end if;
  if exists (select 1 from public.markets x where lower(trim(x.name)) = lower(trim(p_name))) then raise exception 'MARKET_EXISTS'; end if;
  if (select count(*) from public.markets x where x.suggested_by = auth.uid() and x.status = 'pending') >= 5 then raise exception 'TOO_MANY_SUGGESTIONS'; end if;
  insert into public.markets(name, municipality_id, address_text, description, status, suggested_by)
  values (trim(p_name), p_municipality_id, nullif(trim(coalesce(p_address, '')), ''), nullif(trim(coalesce(p_description, '')), ''), 'pending', auth.uid())
  returning * into m;
  insert into public.notifications(user_id, type, title, body, data)
  select r.user_id, 'system', 'Nova praça sugerida', '«' || m.name || '» está à espera de aprovação.', jsonb_build_object('market_id', m.id, 'for', 'admin')
  from public.user_roles r where r.role in ('admin', 'moderator') limit 20;
  return m;
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_auction_sale_mode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.purpose = 'auction' and new.sale_mode is distinct from 'auction' then new.sale_mode := 'auction'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.ticket_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.event_tickets; e public.events; me uuid := auth.uid(); role_ text; tn text; holder text;
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if c like 'HO%' then c := substr(c, 3); end if;
  if char_length(c) <> 8 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'HO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into t from public.event_tickets where code = c;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into e from public.events where id = t.event_id;
  role_ := case when me is not null and e.organizer_id = me then 'organizer' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and t.holder_id = me then 'holder' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'code', c, 'status', t.status, 'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at, 'event_status', e.status);
  end if;
  select name into tn from public.event_ticket_types where id = t.ticket_type_id;
  select buyer_name into holder from public.event_orders where id = t.order_id;
  return jsonb_build_object('result', 'ok', 'role', role_, 'code', c, 'status', t.status, 'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at,
    'venue', e.venue, 'event_status', e.status, 'type', tn, 'holder', holder, 'checked_in_at', t.checked_in_at);
end $function$
;

CREATE OR REPLACE FUNCTION public.ticket_type_taken(p_type uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(quantity), 0)::int from public.event_orders where ticket_type_id = p_type and status in ('reserved', 'submitted', 'confirmed')
$function$
;

CREATE OR REPLACE FUNCTION public.toggle_block(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); was boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user_id is null or p_user_id = me then raise exception 'CANNOT_BLOCK_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  select active into was from public.user_blocks where blocker_id = me and blocked_id = p_user_id;
  insert into public.user_blocks(blocker_id, blocked_id, active, created_at) values (me, p_user_id, true, now())
  on conflict (blocker_id, blocked_id) do update set active = not coalesce(was, false), created_at = now();
  return not coalesce(was, false);
end $function$
;

CREATE OR REPLACE FUNCTION public.toggle_follow(p_kind text, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid; v_name text; me uuid := auth.uid(); was boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'seller' then
    select id, coalesce(nullif(full_name, ''), 'Utilizador') into v_owner, v_name from public.profiles where id = p_id and status = 'active';
  elsif p_kind = 'provider' then
    select user_id, display_name into v_owner, v_name from public.provider_profiles where user_id = p_id and active;
  elsif p_kind = 'business' then
    select owner_id, b.name into v_owner, v_name from public.businesses b where id = p_id and active;
  else raise exception 'INVALID_FOLLOW'; end if;
  if v_owner is null then raise exception 'PROFILE_UNAVAILABLE'; end if;
  if v_owner = me then raise exception 'CANNOT_FOLLOW_SELF'; end if;
  if p_kind = 'seller' then
    delete from public.followed_sellers where user_id = me and seller_id = p_id; was := found;
    if not was then insert into public.followed_sellers(user_id, seller_id) values (me, p_id); end if;
  elsif p_kind = 'provider' then
    delete from public.followed_providers where user_id = me and provider_id = p_id; was := found;
    if not was then insert into public.followed_providers(user_id, provider_id) values (me, p_id); end if;
  else
    delete from public.followed_businesses where user_id = me and business_id = p_id; was := found;
    if not was then insert into public.followed_businesses(user_id, business_id) values (me, p_id); end if;
  end if;
  if not was and not exists (select 1 from public.notifications where user_id = v_owner and data->>'for' = 'new_follower' and created_at > now() - interval '1 day') then
    insert into public.notifications(user_id, type, title, body, data)
    values (v_owner, 'system', 'Tem novos seguidores 👋', 'Há pessoas a seguir «' || v_name || '». Recebem um aviso quando publicar algo novo.',
      jsonb_build_object('for', 'new_follower', 'kind', p_kind, 'id', p_id));
  end if;
  return not was;
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_delivery_status(p_delivery_id uuid, p_status text)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.delivery_requests; o public.orders; label text; allowed boolean;
begin
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.assigned_to is distinct from auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  allowed := case p_status
    when 'picked_up' then d.status in ('assigned', 'accepted')
    when 'in_transit' then d.status in ('assigned', 'accepted', 'picked_up')
    when 'delivered' then d.status in ('picked_up', 'in_transit')
    when 'released' then d.status in ('assigned', 'accepted')
    else false end;
  if not allowed then raise exception 'INVALID_DELIVERY_STEP'; end if;
  select * into o from public.orders where id = d.order_id;
  if p_status = 'released' then
    update public.delivery_requests set status = 'pending', assigned_to = null, assigned_at = null where id = d.id returning * into d;
    update public.orders set fulfillment_status = 'pending', updated_at = now() where id = o.id;
    label := 'O estafeta desistiu. A entrega voltou à lista de espera.';
  else
    update public.delivery_requests set status = p_status, delivered_at = case when p_status = 'delivered' then now() else delivered_at end
    where id = d.id returning * into d;
    update public.orders set fulfillment_status = case p_status when 'delivered' then 'delivered' else 'in_transit' end, updated_at = now() where id = o.id;
    label := case p_status when 'picked_up' then 'O estafeta recolheu a encomenda.' when 'in_transit' then 'A encomenda está a caminho.'
      else 'A encomenda foi entregue.' end;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  select u, 'delivery', 'Entrega atualizada', label, jsonb_build_object('delivery_id', d.id, 'order_id', o.id)
  from unnest(array[o.seller_id, o.buyer_id]) u;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_status text, p_paid boolean DEFAULT NULL::boolean)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; is_seller boolean; is_buyer boolean; label text; was_paid boolean; held boolean; d public.order_disputes;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  is_seller := o.seller_id = auth.uid() or public.has_admin_role();
  is_buyer := o.buyer_id = auth.uid();
  if not (is_seller or is_buyer) then raise exception 'NOT_ORDER_PARTY'; end if;
  if p_status not in ('pending','confirmed','processing','ready','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if o.status in ('completed','cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if not is_seller and not (p_status = 'cancelled' and o.status = 'pending') then raise exception 'BUYER_CAN_ONLY_CANCEL_PENDING'; end if;
  was_paid := o.payment_status = 'paid';
  held := o.escrow_status = 'held';
  if p_status = 'cancelled' then
    update public.products p set stock = p.stock + oi.quantity, updated_at = now()
    from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
  end if;
  update public.orders set status = p_status,
    fulfillment_status = case p_status when 'completed' then 'delivered' when 'cancelled' then 'cancelled' else fulfillment_status end,
    payment_status = case when is_seller and p_paid is true then 'paid' when p_status = 'completed' and payment_method = 'cash_on_delivery' then 'paid' else payment_status end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    updated_at = now()
  where id = o.id returning * into o;
  label := case p_status when 'confirmed' then 'confirmada' when 'processing' then 'em preparação' when 'ready' then 'pronta'
    when 'completed' then case when o.protected then 'entregue' else 'concluída' end when 'cancelled' then 'cancelada' else p_status end;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when auth.uid() = o.buyer_id then o.seller_id else o.buyer_id end, 'order', 'Encomenda ' || label,
          'A encomenda de ' || o.total || ' Kz foi ' || label || '.', jsonb_build_object('order_id', o.id));
  if p_status = 'cancelled' and was_paid and o.total > o.refunded_amount
     and not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
    insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
    values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda já estava paga e foi cancelada.', o.total - o.refunded_amount, 'awaiting_refund')
    returning * into d;
    perform public.dispute_log(d, 'system', 'auto_refund', case when held
      then 'A encomenda já estava paga e foi cancelada: o Huambo Online vai devolver o dinheiro guardado.'
      else 'A encomenda já estava paga e foi cancelada: o vendedor tem de devolver o dinheiro.' end);
  end if;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_service_request(p_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.upsert_notification_preferences(p_enabled boolean, p_saved_search boolean, p_messages boolean, p_rentals boolean, p_auctions boolean, p_marketplace boolean, p_reviews boolean, p_system boolean)
 RETURNS notification_preferences
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.notification_preferences as np(user_id, enabled, saved_search, messages, rentals, auctions, marketplace, reviews, system, updated_at)
  values (auth.uid(), coalesce(p_enabled,true), coalesce(p_saved_search,true), coalesce(p_messages,true), coalesce(p_rentals,true),
          coalesce(p_auctions,true), coalesce(p_marketplace,true), coalesce(p_reviews,true), coalesce(p_system,true), now())
  on conflict (user_id) do update set enabled = excluded.enabled, saved_search = excluded.saved_search, messages = excluded.messages,
    rentals = excluded.rentals, auctions = excluded.auctions, marketplace = excluded.marketplace, reviews = excluded.reviews,
    system = excluded.system, updated_at = now()
  returning * into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.user_reviews_for(p_user_id uuid)
 RETURNS TABLE(id uuid, role text, rating smallint, comment text, created_at timestamp with time zone, author_name text, kind text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.role, r.rating, r.comment, r.created_at, coalesce(nullif(p.full_name, ''), 'Utilizador'),
         case when r.order_id is not null then 'order' else 'listing' end
  from public.user_reviews r left join public.profiles p on p.id = r.author_id
  where r.target_id = p_user_id and r.status = 'published'
  order by r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.user_reviews_for_v2(p_user_id uuid)
 RETURNS TABLE(id uuid, role text, rating smallint, comment text, created_at timestamp with time zone, author_name text, kind text, reply text, reply_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.role, r.rating, r.comment, r.created_at, coalesce(nullif(p.full_name, ''), 'Utilizador'),
         case when r.order_id is not null then 'order' else 'listing' end, r.reply, r.reply_at
  from public.user_reviews r left join public.profiles p on p.id = r.author_id
  where r.target_id = p_user_id and r.status = 'published'
  order by r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_classified_attributes(p_listing_type text, p_attributes jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
begin
 if p_attributes is null or jsonb_typeof(p_attributes)<>'object' then return false; end if;
 if p_listing_type='vehicle' then
   if nullif(trim(coalesce(p_attributes->>'brand','')),'') is null then return false; end if;
   if p_attributes ? 'year' and (p_attributes->>'year')::int not between 1900 and extract(year from now())::int+1 then return false; end if;
   if p_attributes ? 'mileage' and (p_attributes->>'mileage')::numeric < 0 then return false; end if;
 end if;
 if p_listing_type='real_estate' then
   if p_attributes ? 'area_m2' and (p_attributes->>'area_m2')::numeric <= 0 then return false; end if;
   if p_attributes ? 'bedrooms' and (p_attributes->>'bedrooms')::int < 0 then return false; end if;
   if p_attributes ? 'bathrooms' and (p_attributes->>'bathrooms')::int < 0 then return false; end if;
 end if;
 return true;
exception when others then return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.venue_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.notify_staff('Novo estabelecimento para aprovar', 'E-' || new.ref_no || ' · ' || coalesce((select left(name, 80) from public.businesses where id = new.business_id), ''),
    jsonb_build_object('venue_id', new.id));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_detail(p_venue_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; b public.businesses; me uuid := auth.uid(); st public.platform_settings; d1 date; d2 date;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or (v.status <> 'approved' and (me is null or (v.owner_id <> me and not public.has_admin_role()))) then return null; end if;
  select * into b from public.businesses where id = v.business_id;
  select * into st from public.platform_settings where id = 1;
  d1 := coalesce(p_from, (now() at time zone 'Africa/Luanda')::date);
  d2 := case when p_to is not null and p_to > d1 then p_to else d1 + 1 end;
  return jsonb_build_object('id', v.id, 'ref_no', v.ref_no, 'kind', v.kind, 'subtype', v.subtype, 'status', v.status, 'owner_id', v.owner_id,
    'accepts_reservations', v.accepts_reservations and not public.venue_fees_overdue(v.id), 'accepts_pay_at_place', v.accepts_pay_at_place,
    'accepts_prepay', v.accepts_prepay and exists (select 1 from public.venue_pay y where y.venue_id = v.id and (y.iban is not null or y.express is not null)),
    'hold_minutes', v.hold_minutes, 'check_in_time', v.check_in_time, 'check_out_time', v.check_out_time, 'opening_hours', v.opening_hours, 'policies', v.policies,
    'client_fee_pct', st.venue_client_fee_pct, 'business_fee_pct', st.venue_business_fee_pct, 'from', d1, 'to', d2,
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description, 'logo_url', b.logo_url, 'phone', b.phone, 'whatsapp', b.whatsapp,
      'address_text', b.address_text, 'verified', b.verified, 'directions', b.directions, 'geo_lat', b.geo_lat, 'geo_lng', b.geo_lng,
      'municipality_name', (select name from public.municipalities where id = b.municipality_id)),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'section', i.section, 'photos', i.photos,
        'price', i.price, 'unit', i.unit, 'capacity', i.capacity, 'qty_total', i.qty_total, 'min_qty', i.min_qty, 'available', i.available, 'position', i.position,
        'free', case when v.kind = 'hotel' then public.venue_room_free(i.id, d1, d2)::numeric when i.qty_total is null then null else greatest(0, i.qty_total - public.venue_item_reserved(i.id)) end)
        order by i.section nulls first, i.position, i.created_at), '[]') from public.venue_items i where i.venue_id = v.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_fee_due(p_venue uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed'), 0)
    - coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0))
$function$
;

CREATE OR REPLACE FUNCTION public.venue_feed(p_kind text, p_municipality_id uuid DEFAULT NULL::uuid, p_query text DEFAULT ''::text, p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.has_now desc, x.verified desc, x.created_at desc), '[]') from (
    select v.id, v.ref_no, v.kind, v.subtype, v.accepts_reservations, v.accepts_prepay, v.accepts_pay_at_place, v.opening_hours, v.created_at,
      b.id business_id, b.name, b.description, b.logo_url, b.phone, b.whatsapp, b.address_text, b.verified, b.directions, b.geo_lat, b.geo_lng, m.name municipality_name,
      (select min(i.price) from public.venue_items i where i.venue_id = v.id and i.available) price_from,
      (select i.photos[1] from public.venue_items i where i.venue_id = v.id and cardinality(i.photos) > 0 order by i.position, i.created_at limit 1) photo,
      case when v.kind = 'hotel' then (select coalesce(sum(public.venue_room_free(i.id, (now() at time zone 'Africa/Luanda')::date, (now() at time zone 'Africa/Luanda')::date + 1)), 0)
        from public.venue_items i where i.venue_id = v.id and i.available) end rooms_free,
      exists (select 1 from public.venue_items i where i.venue_id = v.id and i.available
        and (v.kind <> 'hotel' or public.venue_room_free(i.id, (now() at time zone 'Africa/Luanda')::date, (now() at time zone 'Africa/Luanda')::date + 1) > 0)) has_now
    from public.venues v join public.businesses b on b.id = v.business_id left join public.municipalities m on m.id = b.municipality_id
    where v.status = 'approved' and b.active and v.kind = p_kind
      and (p_municipality_id is null or b.municipality_id = p_municipality_id)
      and (coalesce(p_query, '') = '' or lower(b.name || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.address_text, '')) like '%' || lower(trim(p_query)) || '%')
    limit greatest(1, least(coalesce(p_limit, 40), 100))) x
$function$
;

CREATE OR REPLACE FUNCTION public.venue_fees_overdue(p_venue uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed' and completed_at < now() - interval '7 days'), 0)
    > coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.venue_item_reserved(p_item_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(l.qty), 0) from public.venue_order_lines l join public.venue_orders o on o.id = l.order_id
  where l.item_id = p_item_id and o.kind <> 'stay' and public.venue_open_status(o.status)
$function$
;

CREATE OR REPLACE FUNCTION public.venue_kind_label(k text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case k when 'stay' then 'Reserva de quarto' when 'table' then 'Reserva de mesa' else 'Encomenda' end
$function$
;

CREATE OR REPLACE FUNCTION public.venue_open_status(s text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select s in ('reserved', 'awaiting_payment', 'submitted', 'paid')
$function$
;

CREATE OR REPLACE FUNCTION public.venue_order_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; bname text; me uuid := auth.uid(); t text := lower(regexp_replace(coalesce(p_token, ''), '[^A-Fa-f0-9]', '', 'g')); role_ text;
begin
  if char_length(t) <> 32 then return jsonb_build_object('result', 'invalid'); end if;
  select * into o from public.venue_orders where qr_token = t;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into v from public.venues where id = o.venue_id;
  select name into bname from public.businesses where id = v.business_id;
  role_ := case when me is not null and v.owner_id = me then 'venue' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and o.buyer_id = me then 'buyer' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'ref_no', o.ref_no, 'status', o.status, 'kind', o.kind, 'venue_id', v.id, 'venue_name', bname,
      'check_in', o.check_in, 'check_out', o.check_out, 'slot_at', o.slot_at);
  end if;
  return jsonb_build_object('result', 'ok', 'role', role_, 'id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'kind', o.kind, 'method', o.method,
    'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'guests', o.guests, 'check_in', o.check_in, 'check_out', o.check_out, 'slot_at', o.slot_at,
    'buyer_note', o.buyer_note, 'subtotal', o.subtotal, 'client_fee_pct', o.client_fee_pct, 'client_fee', o.client_fee, 'business_fee', o.business_fee, 'total', o.total,
    'code', o.code, 'hold_until', o.hold_until, 'pay_method', o.pay_method, 'reference', o.reference, 'proof_path', o.proof_path, 'note', o.note,
    'created_at', o.created_at, 'completed_at', o.completed_at, 'venue_id', v.id, 'venue_name', bname, 'venue_kind', v.kind,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
      from public.venue_order_lines l where l.order_id = o.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_panel(p_venue_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; st public.platform_settings;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or (v.owner_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_VENUE_OWNER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'client_fee_pct', st.venue_client_fee_pct, 'business_fee_pct', st.venue_business_fee_pct,
    'completed_total', (select coalesce(sum(total), 0) from public.venue_orders where venue_id = v.id and status = 'completed'),
    'fee_total', (select coalesce(sum(client_fee + business_fee), 0) from public.venue_orders where venue_id = v.id and status = 'completed'),
    'fee_due', public.venue_fee_due(v.id),
    'fee_overdue', public.venue_fees_overdue(v.id),
    'fee_pending', exists (select 1 from public.venue_platform_payments where venue_id = v.id and status = 'pending'),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.kind, o.status, o.method, o.guests, o.check_in, o.check_out, o.slot_at, o.buyer_note, o.subtotal, o.client_fee, o.business_fee, o.total,
        o.buyer_name, o.buyer_phone, o.code, o.qr_token, o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.completed_at,
        (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
          from public.venue_order_lines l where l.order_id = o.id) lines
      from public.venue_orders o where o.venue_id = v.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.venue_platform_payments p where p.venue_id = v.id order by p.created_at desc limit 50) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_room_free(p_item_id uuid, p_from date, p_to date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce(floor(i.qty_total)::int, 0) - coalesce((
    select max(n.booked) from (
      select d::date night, sum(l.qty) booked
      from generate_series(p_from, p_to - 1, interval '1 day') d
      join public.venue_order_lines l on l.item_id = i.id
      join public.venue_orders o on o.id = l.order_id
      where o.kind = 'stay' and (public.venue_open_status(o.status) or (o.status = 'completed' and o.check_out > (now() at time zone 'Africa/Luanda')::date))
        and o.check_in <= d::date and o.check_out > d::date
      group by d) n), 0)::int)
  from public.venue_items i where i.id = p_item_id
$function$
;

CREATE OR REPLACE FUNCTION public.venue_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with x as (update public.venue_orders set status = 'expired', updated_at = now()
    where (status = 'reserved' and hold_until < now()) or (status = 'awaiting_payment' and pay_by < now()) returning 1)
  select count(*) into n from x;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.video_path(p_url text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select substring(p_url from '/storage/v1/object/public/media-videos/(.+)$');
$function$
;

CREATE OR REPLACE FUNCTION public.videos_due_for_cleanup()
 RETURNS TABLE(path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select q.path from public.media_cleanup_queue q where q.due_at <= now() and q.done_at is null and q.path is not null
  union
  select public.video_path(l.video_url) from public.classified_listings l
   where l.video_url is not null and l.status in ('sold', 'rented', 'closed', 'cancelled') and l.updated_at < now() - interval '7 days'
  union
  select public.video_path(p.video_url) from public.products p
   where p.video_url is not null and not p.active and p.updated_at < now() - interval '30 days'
  limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_add(p_user uuid, p_order uuid, p_payout uuid, p_bucket text, p_kind text, p_amount numeric, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_amount is null or p_amount = 0 then return; end if;
  insert into public.wallet_entries(user_id, order_id, payout_id, bucket, kind, amount, note, created_by)
  values (p_user, p_order, p_payout, p_bucket, p_kind, round(p_amount, 2), left(p_note, 300), auth.uid());
end $function$
;

CREATE OR REPLACE FUNCTION public.wanted_keywords(p_title text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(distinct left(w, 6)), '{}') from (
    select w from regexp_split_to_table(public.fold_text(p_title), '[^a-z0-9]+') w
  ) t
  where char_length(w) >= 4 and w not in (
    'preciso','precisa','procuro','procura','compro','comprar','quero','pago','pagar','alguem','vende','vendo','venda',
    'estado','bons','boas','usado','usada','novo','nova','urgente','urgencia','para','mais','menos','como','desde',
    'entre','kwanzas','preco','barato','barata','qualquer','tipo','servico','servicos','profissional','pessoa',
    'senhor','senhora','trabalho','fazer','minha','minhas','meus','numa','numas','esta','este','isto','aqui','zona','bairro');
$function$
;

CREATE OR REPLACE FUNCTION public.withdraw_offer(p_offer_id uuid)
 RETURNS listing_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.listing_offers;
begin
  update public.listing_offers set status = 'withdrawn', responded_at = now()
   where id = p_offer_id and buyer_id = auth.uid() and status = 'pending' returning * into o;
  if not found then raise exception 'INVALID_TRANSITION'; end if;
  return o;
end $function$
;
