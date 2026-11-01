CREATE OR REPLACE FUNCTION public.seller_cancel_bid(p_bid_id uuid, p_reason text)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; b public.auction_bids; txt text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into b from public.auction_bids where id = p_bid_id;
  if not found then raise exception 'BID_NOT_FOUND'; end if;
  select * into a from public.auctions where id = b.auction_id for update;
  if a.seller_id is distinct from auth.uid() and not public.has_admin_role() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if b.retracted_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  a := public.auction_drop_bidder(a, b.bidder_id, auth.uid(), txt);
  insert into public.notifications(user_id, type, title, body, data)
  values (b.bidder_id, 'bid', 'Os seus lances foram cancelados', '«' || a.title || '»: ' || txt,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  if public.has_admin_role() and a.seller_id is distinct from auth.uid() then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'bid_cancelled', 'auction', a.id, jsonb_build_object('bidder_id', b.bidder_id, 'reason', txt));
  end if;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.seller_delivery_policy(p_seller_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when s.seller_id is null then null else jsonb_build_object(
    'pickup_enabled', s.pickup_enabled, 'pickup_place', s.pickup_place, 'delivery_enabled', s.delivery_enabled, 'default_fee', s.default_fee,
    'free_over', s.free_over, 'min_order', s.min_order, 'delivery_days', s.delivery_days, 'note', s.note,
    'zones', (select coalesce(jsonb_agg(jsonb_build_object('municipality_id', z.municipality_id, 'municipality_name', m.name, 'fee', z.fee) order by m.name), '[]')
      from public.seller_delivery_zones z join public.municipalities m on m.id = z.municipality_id where z.seller_id = s.seller_id)) end
  from (select 1) one left join public.seller_delivery_settings s on s.seller_id = p_seller_id
$function$
;

CREATE OR REPLACE FUNCTION public.seller_delivery_quote(p_seller_id uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_subtotal numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.seller_delivery_settings; zfee numeric; fee numeric; sub numeric := greatest(coalesce(p_subtotal, 0), 0); reason text;
begin
  select * into s from public.seller_delivery_settings where seller_id = p_seller_id;
  if not found then
    return jsonb_build_object('configured', false, 'pickup', true, 'delivery', true, 'fee', 0, 'free', false, 'reason', null);
  end if;
  if p_municipality_id is not null then select z.fee into zfee from public.seller_delivery_zones z where z.seller_id = s.seller_id and z.municipality_id = p_municipality_id; end if;
  fee := coalesce(zfee, s.default_fee);
  reason := case
    when not s.delivery_enabled then 'no_delivery'
    when s.min_order is not null and sub < s.min_order then 'min_order'
    when p_municipality_id is null then 'needs_area'
    when fee is null then 'area' end;
  if reason is null and s.free_over is not null and sub >= s.free_over then fee := 0; end if;
  return jsonb_build_object('configured', true, 'pickup', s.pickup_enabled, 'pickup_place', s.pickup_place,
    'delivery', reason is null, 'fee', case when reason is null then fee end, 'free', reason is null and fee = 0,
    'reason', reason, 'min_order', s.min_order, 'free_over', s.free_over,
    'missing_for_free', case when s.delivery_enabled and s.free_over is not null and sub < s.free_over then s.free_over - sub end,
    'delivery_days', s.delivery_days, 'note', s.note);
end $function$
;

CREATE OR REPLACE FUNCTION public.seller_whatsapp(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.whatsapp from public.profiles p
  where auth.uid() is not null and p.id = p_user_id and p.whatsapp_public and p.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.service_request_owner(r service_requests)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(r.provider_id, (select b.owner_id from public.businesses b where b.id = r.business_id));
$function$
;

CREATE OR REPLACE FUNCTION public.service_request_paid_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.subject_paid_up(new.provider_id, new.business_id) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_auction_buy_now(p_auction_id uuid, p_price numeric)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.seller_id <> auth.uid() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status not in ('live', 'scheduled') or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
  if p_price is not null and (p_price <= a.starting_price or p_price < coalesce(a.reserve_price, 0)) then raise exception 'INVALID_BUY_NOW_PRICE'; end if;
  update public.auctions set buy_now_price = p_price, updated_at = now() where id = a.id returning * into a;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_courier_available(p_available boolean)
 RETURNS couriers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.couriers;
begin
  update public.couriers set available = p_available, updated_at = now() where user_id = auth.uid() returning * into c;
  if not found then raise exception 'NOT_COURIER'; end if;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_dispute_refund_account(p_dispute_id uuid, p_account text)
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.order_disputes; dest text := public.clean_refund_destination(p_account);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found or d.buyer_id <> auth.uid() then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  if dest is null then raise exception 'INVALID_REFUND_ACCOUNT'; end if;
  update public.order_disputes set refund_to = dest where id = d.id returning * into d;
  perform public.dispute_log(d, 'buyer', 'comment', 'Devolver o dinheiro para: ' || dest);
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_listing_agent(p_listing_id uuid, p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.set_listing_deal(p_listing_id uuid, p_status text, p_counterpart uuid)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
  if p_status not in ('sold', 'rented', 'closed') then raise exception 'INVALID_FINAL_STATUS'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if l.deal_with is not null then raise exception 'DEAL_ALREADY_SET'; end if;
  if not exists (select 1 from public.listing_deal_candidates(p_listing_id) c where c.user_id = p_counterpart) then raise exception 'NOT_A_DEAL_PARTNER'; end if;
  update public.classified_listings set status = p_status, deal_with = p_counterpart, deal_at = now(), updated_at = now()
   where id = l.id returning * into l;
  insert into public.notifications(user_id, type, title, body, data)
  values (p_counterpart, 'system', 'Negócio concluído — avalie', 'Concluiu um negócio: «' || l.title || '». Deixe a sua avaliação.',
          jsonb_build_object('listing_id', l.id, 'for', 'review'));
  return l;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_listing_deal_v2(p_listing_id uuid, p_status text, p_counterpart uuid, p_sale_amount numeric DEFAULT NULL::numeric)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
  if p_sale_amount is not null and p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if p_status in ('sold', 'rented') then update public.classified_listings set sale_amount = p_sale_amount where id = l.id; end if;
  return public.set_listing_deal(p_listing_id, p_status, p_counterpart);
end $function$
;

CREATE OR REPLACE FUNCTION public.set_my_whatsapp(p_number text, p_public boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_number, '')), '') is null then
    update public.profiles set whatsapp = null, whatsapp_public = false where id = auth.uid();
    return jsonb_build_object('whatsapp', null, 'whatsapp_public', false);
  end if;
  n := public.normalize_whatsapp(p_number);
  if n is null then raise exception 'INVALID_WHATSAPP'; end if;
  update public.profiles set whatsapp = n, whatsapp_public = coalesce(p_public, false) where id = auth.uid();
  return jsonb_build_object('whatsapp', n, 'whatsapp_public', coalesce(p_public, false));
end $function$
;

CREATE OR REPLACE FUNCTION public.set_order_delivery_point(p_order_id uuid, p_lat numeric, p_lng numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('completed', 'cancelled') or o.fulfillment_status = 'delivered' then raise exception 'ORDER_CLOSED'; end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and not (p_lat between -18.1 and -4.3 and p_lng between 11.6 and 24.2)) then
    raise exception 'INVALID_LOCATION';
  end if;
  update public.orders set delivery_lat = round(p_lat, 6), delivery_lng = round(p_lng, 6), updated_at = now() where id = o.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.start_classified_conversation(p_listing_id uuid, p_message text)
 RETURNS conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; c public.conversations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'MESSAGE_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id and status = 'published';
  if not found then raise exception 'LISTING_NOT_FOUND_OR_NOT_PUBLISHED'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_CONTACT_SELF'; end if;
  select * into c from public.conversations
   where classified_listing_id = p_listing_id and created_by = auth.uid()
   order by created_at limit 1;
  if not found then
    insert into public.conversations(created_by, subject, context_type, classified_listing_id)
    values (auth.uid(), l.title, 'classified', p_listing_id) returning * into c;
  end if;
  insert into public.conversation_participants(conversation_id, user_id)
  values (c.id, auth.uid()), (c.id, l.owner_id) on conflict do nothing;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, auth.uid(), trim(p_message));
  update public.conversation_participants set last_read_at = now() where conversation_id = c.id and user_id = auth.uid();
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.start_directory_conversation(p_provider_id uuid, p_business_id uuid, p_message text)
 RETURNS conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.conversations; owner uuid; subj text; ctx text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'CONTACT_TARGET_REQUIRED'; end if;
  if p_provider_id is not null then
    select user_id, display_name into owner, subj from public.provider_profiles where user_id = p_provider_id and active;
    ctx := 'provider';
  else
    select owner_id, name into owner, subj from public.businesses where id = p_business_id and active;
    ctx := 'business';
  end if;
  if owner is null then raise exception 'NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_CONTACT_SELF'; end if;
  select * into c from public.conversations
   where created_by = auth.uid() and context_type = ctx
     and provider_id is not distinct from p_provider_id and business_id is not distinct from p_business_id
   order by created_at limit 1;
  if not found then
    insert into public.conversations(created_by, subject, context_type, provider_id, business_id)
    values (auth.uid(), subj, ctx, p_provider_id, p_business_id) returning * into c;
  end if;
  insert into public.conversation_participants(conversation_id, user_id) values (c.id, auth.uid()), (c.id, owner) on conflict do nothing;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, auth.uid(), trim(p_message));
  update public.conversation_participants set last_read_at = now() where conversation_id = c.id and user_id = auth.uid();
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_paid_up(p_seller uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select public.subscription_active_until(s) > now() from public.subscriptions s where s.seller_id = p_seller limit 1), true);
$function$
;

CREATE OR REPLACE FUNCTION public.store_subscription_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_days integer := coalesce((select trial_days from public.platform_settings where id = 1), 30);
begin
  if new.business_id is null then
    insert into public.subscriptions(kind, owner_id, seller_id, trial_ends_at) values ('store', new.seller_id, new.seller_id, now() + make_interval(days => v_days))
    on conflict do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.subject_paid_up(p_provider uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select public.subscription_active_until(s) > now() from public.subscriptions s
                   where (p_provider is not null and s.provider_id = p_provider) or (p_business is not null and s.business_id = p_business) limit 1), true);
$function$
;

CREATE OR REPLACE FUNCTION public.submit_commission_payment(p_ids uuid[], p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ref text := nullif(left(trim(coalesce(p_reference, '')), 120), ''); n integer; total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  update public.listing_commissions set status = 'submitted', method = p_method, reference = ref, proof_path = p_proof_path, submitted_at = now(), admin_note = null
   where id = any(coalesce(p_ids, '{}')) and owner_id = auth.uid() and status = 'due';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOTHING_TO_PAY'; end if;
  select sum(amount) into total from public.listing_commissions where id = any(p_ids) and owner_id = auth.uid() and status = 'submitted';
  perform public.notify_staff('Pagamento de comissões para confirmar', total || ' Kz · ' || n || ' venda(s)', jsonb_build_object('commission_ids', to_jsonb(p_ids), 'payment_id', p_ids[1]));
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_deal_review(p_kind text, p_ref uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS user_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_event_platform_payment(p_event_id uuid, p_kind text, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS event_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; st public.platform_settings; p public.event_platform_payments; amt numeric;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if p_kind not in ('fee', 'boost') or p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  select * into st from public.platform_settings where id = 1;
  if p_kind = 'fee' then
    amt := public.event_fee_due(e.id);
    if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  else
    if e.status <> 'published' or e.starts_at < now() then raise exception 'EVENT_NOT_ON_SALE'; end if;
    amt := st.event_boost_price_kz;
  end if;
  insert into public.event_platform_payments(event_id, organizer_id, kind, amount, days, method, reference, proof_path)
  values (e.id, e.organizer_id, p_kind, amt, case when p_kind = 'boost' then st.event_boost_days end, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path)
  returning * into p;
  perform public.notify_staff(case when p_kind = 'fee' then 'Comissão de evento paga' else 'Pedido de destaque de evento' end,
    'E-' || e.ref_no || ' · ' || amt || ' Kz · «' || left(e.title, 80) || '»', jsonb_build_object('event_payment_id', p.id));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_event_ticket_payment(p_order_id uuid, p_method text, p_reference text)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.event_orders; e public.events;
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  if o.status not in ('reserved', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'reserved' and o.pay_by < now() then raise exception 'TICKET_RESERVATION_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'REFERENCE_REQUIRED'; end if;
  if o.status = 'rejected' and o.quantity > (select quantity from public.event_ticket_types where id = o.ticket_type_id) - public.ticket_type_taken(o.ticket_type_id) then raise exception 'NOT_ENOUGH_TICKETS'; end if;
  update public.event_orders set status = 'submitted', method = p_method, reference = left(trim(p_reference), 120), submitted_at = now() where id = o.id returning * into o;
  select * into e from public.events where id = o.event_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (e.organizer_id, 'system', 'Pagamento de bilhetes para confirmar', 'B-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · «' || left(e.title, 80) || '».',
    jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_fuel_fee_payment(p_station_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS fuel_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; p public.fuel_platform_payments; amt numeric;
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  amt := public.fuel_fee_due(s.id);
  if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  insert into public.fuel_platform_payments(station_id, owner_id, amount, method, reference, proof_path)
  values (s.id, s.owner_id, amt, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path) returning * into p;
  perform public.notify_staff('Comissão de combustível paga', 'S-' || s.ref_no || ' · ' || amt || ' Kz · ' || left(s.name, 80), jsonb_build_object('fuel_payment_id', p.id));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_fuel_payment(p_order_id uuid, p_method text, p_reference text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin raise exception 'FUEL_PROOF_REQUIRED'; end $function$
;

CREATE OR REPLACE FUNCTION public.submit_fuel_payment_v2(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found or o.buyer_id <> me then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'FUEL_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'FUEL_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.fuel_orders x where x.id <> o.id and x.reference_norm = ref_n) then raise exception 'FUEL_REFERENCE_USED'; end if;
  if h is not null and exists (select 1 from public.fuel_orders x where x.id <> o.id and x.proof_hash = h) then raise exception 'FUEL_PROOF_USED'; end if;
  update public.fuel_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, code = coalesce(code, public.new_fuel_code()), note = null, updated_at = now()
    where id = o.id returning * into o;
  select * into s from public.fuel_stations where id = o.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', '⛽ Pagamento com comprovativo para confirmar', 'C-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · confirme na sua conta bancária.',
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_inspection_payment(p_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; me uuid := auth.uid(); ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  select * into i from public.inspections where id = p_id for update;
  if not found or i.owner_id <> me then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if i.status <> 'awaiting_payment' then raise exception 'INVALID_TRANSITION'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and p_proof_path not like me::text || '/%' then raise exception 'INVALID_PROOF'; end if;
  update public.inspections set status = 'payment_submitted', pay_method = p_method, pay_reference = ref, pay_proof_path = p_proof_path,
    pay_submitted_at = now(), admin_note = null, updated_at = now() where id = i.id returning * into i;
  perform public.notify_staff('🏅 Taxa de inspeção para confirmar', 'I-' || i.ref_no || ' · ' || i.fee_amount || ' Kz · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''),
    jsonb_build_object('inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_order_payment(p_order_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS order_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; pay public.order_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.order_payments where order_id = o.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.order_payments(order_id, buyer_id, amount, provider, method, reference, proof_path)
  values (o.id, auth.uid(), o.total, 'manual', p_method, ref, p_proof_path) returning * into pay;
  perform public.notify_staff('Pagamento protegido para confirmar', o.total || ' Kz · ' || public.order_ref(o),
    jsonb_build_object('payment_id', pay.id, 'order_id', o.id));
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_promo_boost(p_post_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS promo_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p public.promo_posts; st public.platform_settings; b public.promo_boosts;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from public.promo_posts where id = p_post_id;
  if not found or p.owner_id <> me then raise exception 'POST_NOT_FOUND'; end if;
  if p.status <> 'published' then raise exception 'POST_HIDDEN'; end if;
  if p.kind = 'live' and p.live_ends_at < now() then raise exception 'LIVE_ENDED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and p_proof_path !~ ('^' || me::text || '/') then raise exception 'INVALID_PROOF'; end if;
  if exists (select 1 from public.promo_boosts where post_id = p.id and status = 'pending') then raise exception 'BOOST_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.promo_boosts(post_id, owner_id, amount, days, method, reference, proof_path)
  values (p.id, me, st.promo_boost_price_kz, st.promo_boost_days, p_method, nullif(trim(coalesce(p_reference, '')), ''), p_proof_path)
  returning * into b;
  perform public.notify_staff('Destaque de vídeo por confirmar', 'V-' || p.ref_no || ' · ' || st.promo_boost_price_kz || ' Kz', jsonb_build_object('for', 'admin_promo'));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_review(p_provider_id uuid, p_business_id uuid, p_rating integer, p_comment text)
 RETURNS reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.reviews; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'REVIEW_TARGET_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if p_provider_id is not null then
    if not exists (select 1 from public.provider_profiles where user_id = p_provider_id and active) then raise exception 'PROVIDER_NOT_FOUND'; end if;
    owner := p_provider_id;
  else
    select owner_id into owner from public.businesses where id = p_business_id and active;
    if owner is null then raise exception 'BUSINESS_NOT_FOUND'; end if;
  end if;
  if owner = auth.uid() then raise exception 'CANNOT_REVIEW_SELF'; end if;
  select * into r from public.reviews where author_id = auth.uid()
    and provider_id is not distinct from p_provider_id and business_id is not distinct from p_business_id;
  if found then
    update public.reviews set rating = p_rating, comment = nullif(trim(p_comment), ''), status = 'published', created_at = now()
     where id = r.id returning * into r;
  else
    insert into public.reviews(author_id, provider_id, business_id, rating, comment, status)
    values (auth.uid(), p_provider_id, p_business_id, p_rating, nullif(trim(p_comment), ''), 'published') returning * into r;
    insert into public.notifications(user_id, type, title, body, data)
    values (owner, 'review', 'Nova avaliação', p_rating || ' estrela(s)' || coalesce(': ' || left(trim(p_comment), 140), ''),
            jsonb_build_object('review_id', r.id, 'provider_id', p_provider_id, 'business_id', p_business_id));
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(p_subscription_id uuid, p_months integer, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS subscription_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.subscriptions; pay public.subscription_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p_subscription_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if p_months is null or p_months not between 1 and 12 then raise exception 'INVALID_MONTHS'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.subscription_payments where subscription_id = s.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.subscription_payments(subscription_id, owner_id, months, amount, method, reference, proof_path)
  values (s.id, auth.uid(), p_months, p_months * public.plan_monthly_price(s.kind), p_method, ref, p_proof_path)
  returning * into pay;
  perform public.notify_staff('Pagamento de mensalidade para confirmar', pay.amount || ' Kz · ' || p_months || ' mês(es)', jsonb_build_object('payment_id', pay.id));
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_venue_fee_payment(p_venue_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS venue_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; p public.venue_platform_payments; amt numeric;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  amt := public.venue_fee_due(v.id);
  if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  insert into public.venue_platform_payments(venue_id, owner_id, amount, method, reference, proof_path)
  values (v.id, v.owner_id, amt, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path) returning * into p;
  perform public.notify_staff('Taxa de reservas paga', 'E-' || v.ref_no || ' · ' || amt || ' Kz', jsonb_build_object('venue_payment_id', p.id));
  return p;
end $function$
;
