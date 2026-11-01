CREATE OR REPLACE FUNCTION public.my_venues()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select v.*, b.name business_name, (select to_jsonb(y) - 'venue_id' - 'updated_at' from public.venue_pay y where y.venue_id = v.id) pay
    from public.venues v join public.businesses b on b.id = v.business_id where v.owner_id = auth.uid()) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_verifications()
 RETURNS TABLE(id uuid, kind text, business_id uuid, business_name text, status text, admin_note text, created_at timestamp with time zone, decided_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.id, v.kind, v.business_id, b.name, v.status, v.admin_note, v.created_at, v.decided_at
  from public.verification_requests v left join public.businesses b on b.id = v.business_id
  where v.user_id = auth.uid() order by v.created_at desc limit 50;
$function$
;

CREATE OR REPLACE FUNCTION public.my_verifications_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select v.id, v.kind, v.business_id, b.name business_name, v.status, v.admin_note, v.created_at, v.decided_at,
      case when v.id_number is not null then '•••••' || right(v.id_number, 5) end id_number_hint, v.selfie_path is not null has_selfie
    from public.verification_requests v left join public.businesses b on b.id = v.business_id
    where v.user_id = auth.uid() order by v.created_at desc limit 50) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_wallet()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare st public.platform_settings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'pending', (select coalesce(sum(amount), 0) from public.wallet_entries where user_id = uid and bucket = 'pending'),
    'available', (select coalesce(sum(amount), 0) from public.wallet_entries where user_id = uid and bucket = 'available'),
    'in_payout', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = uid and status in ('requested', 'processing')),
    'paid_out', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = uid and status = 'paid'),
    'account', (select jsonb_build_object('method', a.method, 'holder_name', a.holder_name,
        'destination', case when a.method = 'iban' then public.format_angola_iban(a.iban) else a.express_number end, 'updated_at', a.updated_at)
      from public.payout_accounts a where a.user_id = uid),
    'entries', (select coalesce(jsonb_agg(x order by x.id desc), '[]') from (
        select e.id, e.bucket, e.kind, e.amount, e.note, e.created_at, e.order_id from public.wallet_entries e where e.user_id = uid order by e.id desc limit 100) x),
    'payouts', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select p.id, p.ref_no, p.amount, p.method, p.destination, p.status, p.admin_note, p.bank_reference, p.created_at, p.paid_at
          from public.payout_requests p where p.user_id = uid order by p.created_at desc limit 50) x),
    'payout_min_kz', st.payout_min_kz, 'payout_weekdays', to_jsonb(st.payout_weekdays), 'fee_pct', st.protected_fee_pct,
    'auto_release_days', st.auto_release_days);
end $function$
;

CREATE OR REPLACE FUNCTION public.new_fuel_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'CB-';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.fuel_orders where code = c);
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.new_ticket_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'HO-';
    for i in 1..8 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); if i = 4 then c := c || '-'; end if; end loop;
    exit when not exists (select 1 from public.event_tickets where code = c);
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.new_venue_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'RV-';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.venue_orders where code = c);
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.normalize_bi(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_whatsapp(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d ~ '^00' then d := substr(d, 3); end if;
  if d ~ '^9[0-9]{8}$' then return '244' || d; end if;
  if d ~ '^2449[0-9]{8}$' then return d; end if;
  if d ~ '^244' then return null; end if;
  if d ~ '^[1-9][0-9]{9,14}$' then return d; end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_classified_saved_searches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('saved_search', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_followers(p_followers uuid[], p_source text, p_title text, p_body text, p_data jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  insert into public.notifications(user_id, type, title, body, data)
  select f, 'system', left(p_title, 120), left(p_body, 300), p_data || jsonb_build_object('for', 'follow', 'source', p_source)
  from (select distinct unnest(p_followers) f) x
  where f is not null and not exists (select 1 from public.notifications n where n.user_id = x.f and n.data->>'for' = 'follow'
    and n.data->>'source' = p_source and n.created_at > now() - interval '1 hour')
  limit 2000;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; c record; preview text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  preview := coalesce(nullif(trim(new.body), ''), case new.attachment_kind when 'image' then '📷 Fotografia' when 'video' then '🎬 Vídeo' when 'audio' then '🎤 Mensagem de voz' else '' end);
  for p in select cp.user_id from public.conversation_participants cp where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id loop
    insert into public.notifications(user_id, type, title, body, data)
    values (p.user_id, 'message', 'Nova mensagem', left(preview, 180),
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id, 'listing_id', c.classified_listing_id))
    on conflict do nothing;
  end loop;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_staff(p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.notifications(user_id, type, title, body, data)
  select distinct r.user_id, 'system', p_title, p_body, p_data || jsonb_build_object('for', 'admin')
  from public.user_roles r where r.role in ('moderator', 'admin') limit 20;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_wanted_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.purpose = 'wanted' and new.status = 'published' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('wanted', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.open_listing_claim(p_listing_id uuid, p_request text, p_reason text, p_description text, p_amount numeric DEFAULT NULL::numeric)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.open_order_dispute(p_order_id uuid, p_request text, p_reason text, p_description text, p_amount numeric DEFAULT NULL::numeric, p_photos text[] DEFAULT '{}'::text[])
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; d public.order_disputes; ph text[]; amt numeric; txt text := nullif(left(trim(coalesce(p_description, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.buyer_id <> auth.uid() then raise exception 'NOT_ORDER_PARTY'; end if;
  if o.status in ('pending', 'cancelled') or (o.status <> 'completed' and o.payment_status <> 'paid') then raise exception 'DISPUTE_NOT_ALLOWED'; end if;
  if o.status = 'completed' and coalesce(o.completed_at, o.updated_at) < now() - interval '14 days' then raise exception 'DISPUTE_WINDOW_CLOSED'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and outcome <> 'withdrawn') then raise exception 'DISPUTE_ALREADY_DECIDED'; end if;
  if (select count(*) from public.order_disputes where order_id = o.id) >= 3 then raise exception 'TOO_MANY_REQUESTS'; end if;
  if p_request not in ('refund', 'return_refund', 'replacement') then raise exception 'INVALID_REQUEST'; end if;
  if p_reason not in ('not_received', 'damaged', 'not_as_described', 'wrong_item', 'missing_items', 'other') then raise exception 'INVALID_REASON'; end if;
  if p_reason = 'not_received' and p_request <> 'refund' then raise exception 'INVALID_REQUEST'; end if;
  if txt is null or char_length(txt) < 5 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_request = 'replacement' then amt := null;
  else
    amt := coalesce(p_amount, o.total - o.refunded_amount);
    if amt <= 0 or amt > o.total - o.refunded_amount then raise exception 'INVALID_AMOUNT'; end if;
  end if;
  ph := public.dispute_clean_photos(o.id, p_photos);
  insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount)
  values (o.id, o.buyer_id, o.seller_id, p_request, p_reason, txt, amt) returning * into d;
  perform public.dispute_log(d, 'buyer', 'opened', txt, ph);
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.order_delivery_point(p_order_id uuid)
 RETURNS TABLE(lat numeric, lng numeric, delivery_text text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.delivery_lat, o.delivery_lng, o.delivery_text from public.orders o
  where o.id = p_order_id and auth.uid() is not null and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()
    or exists (select 1 from public.delivery_requests d where d.order_id = o.id and d.assigned_to = auth.uid() and d.status <> 'cancelled'))
$function$
;

CREATE OR REPLACE FUNCTION public.order_payment_quote(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; pay public.order_payments;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  select * into pay from public.order_payments where order_id = o.id and status = 'pending' and provider = 'proxypay' and (expires_at is null or expires_at > now());
  return jsonb_build_object('order_id', o.id, 'buyer_id', o.buyer_id, 'amount', o.total, 'ref', public.order_ref(o), 'pay_by', o.pay_by,
    'existing', case when pay.id is null then null else jsonb_build_object('entity', pay.entity, 'reference', pay.reference, 'amount', pay.amount, 'expires_at', pay.expires_at) end);
end $function$
;

CREATE OR REPLACE FUNCTION public.order_ref(o orders)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select 'E-' || coalesce(o.ref_no::text, left(o.id::text, 8)) $function$
;

CREATE OR REPLACE FUNCTION public.orders_escrow_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare days integer; diff numeric;
begin
  if not new.protected then return new; end if;
  if new.escrow_status = 'awaiting_payment' then
    if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then raise exception 'PROTECTED_PAID_BY_PLATFORM'; end if;
    if new.status in ('processing', 'ready', 'completed') or new.fulfillment_status in ('assigned', 'in_transit', 'delivered') then
      raise exception 'AWAITING_PAYMENT'; end if;
  end if;
  -- cancelada antes de pagar: a referência deixa de valer
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.escrow_status = 'awaiting_payment' then
    update public.order_payments set status = 'expired' where order_id = new.id and status = 'pending' and provider = 'proxypay';
  end if;
  -- entregue: começa a contagem para libertar o dinheiro
  if new.fulfillment_status = 'delivered' and old.fulfillment_status is distinct from 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
    if new.escrow_status = 'held' and new.release_at is null then
      select auto_release_days into days from public.platform_settings where id = 1;
      days := coalesce(days, 3);
      new.release_at := now() + make_interval(days => days);
      if new.received_at is null then
        insert into public.notifications(user_id, type, title, body, data)
        values (new.buyer_id, 'order', 'Recebeu a encomenda? 📦',
          'A encomenda ' || public.order_ref(new) || ' foi marcada como entregue. Carregue em «Confirmar receção» ou peça reembolso. Se não disser nada em '
          || days || ' dias, o pagamento é entregue ao vendedor.', jsonb_build_object('order_id', new.id, 'for', 'purchase'));
      end if;
    end if;
  end if;
  -- reembolso de dinheiro ainda retido: sai do saldo pendente do vendedor
  if new.refunded_amount > old.refunded_amount and old.escrow_status = 'held' then
    diff := new.refunded_amount - old.refunded_amount;
    perform public.wallet_add(new.seller_id, new.id, null, 'pending', 'refund', -diff, 'Reembolso ao cliente · ' || public.order_ref(new));
    if new.refunded_amount >= new.total then new.escrow_status := 'refunded'; end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.organizer_event_panel(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; st public.platform_settings;
begin
  select * into e from public.events where id = p_event_id;
  if not found or (e.organizer_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'sold', (select coalesce(sum(quantity), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'revenue', (select coalesce(sum(total), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'checked_in', (select count(*) from public.event_tickets where event_id = e.id and status = 'used'),
    'fee_pct', st.event_ticket_fee_pct,
    'fee_total', (select coalesce(sum(fee_amount), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'fee_due', public.event_fee_due(e.id),
    'fee_pending', exists (select 1 from public.event_platform_payments where event_id = e.id and kind = 'fee' and status = 'pending'),
    'boost_pending', exists (select 1 from public.event_platform_payments where event_id = e.id and kind = 'boost' and status = 'pending'),
    'boost_price_kz', st.event_boost_price_kz, 'boost_days', st.event_boost_days,
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.status, o.quantity, o.total, o.buyer_name, o.buyer_phone, o.method, o.reference, o.pay_by, o.note, o.created_at, t.name type_name
      from public.event_orders o join public.event_ticket_types t on t.id = o.ticket_type_id where o.event_id = e.id order by o.created_at desc limit 500) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.kind, p.amount, p.days, p.status, p.admin_note, p.created_at from public.event_platform_payments p where p.event_id = e.id order by p.created_at desc limit 50) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.photo_search_limit()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select 20 $function$
;

CREATE OR REPLACE FUNCTION public.photo_searches_left()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.photo_search_limit() - coalesce((select count from public.photo_search_usage
    where user_id = auth.uid() and day = (now() at time zone 'Africa/Luanda')::date), 0);
$function$
;

CREATE OR REPLACE FUNCTION public.place_auction_bid(p_auction_id uuid, p_amount numeric)
 RETURNS auction_bids
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; b public.auction_bids; mine public.auction_max_bids; before record; after record; min_bid numeric; has_bids boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'BID_TOO_LOW'; end if;
  select * into mine from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid();
  if found and mine.retracted_by is not null and mine.retracted_by <> auth.uid() then raise exception 'BIDDER_BLOCKED'; end if;
  select * into before from public.auction_standing(a.id);
  has_bids := before.leader is not null;
  if before.leader = auth.uid() then
    if p_amount <= before.leader_max then raise exception 'MAX_MUST_INCREASE'; end if;
  else
    min_bid := case when not has_bids then a.starting_price else a.current_price + public.auction_increment(a.current_price, a.min_increment) end;
    if p_amount < min_bid then raise exception 'BID_TOO_LOW'; end if;
  end if;
  insert into public.auction_max_bids(auction_id, bidder_id, max_amount, max_set_at)
  values (a.id, auth.uid(), p_amount, now())
  on conflict (auction_id, bidder_id) do update set max_amount = excluded.max_amount, max_set_at = now(), retracted_at = null, retracted_by = null, retract_reason = null;
  select * into after from public.auction_standing(a.id);
  update public.auctions set current_price = after.price, updated_at = now() where id = a.id;

  if after.leader = auth.uid() then
    if before.leader is distinct from auth.uid() or after.price <> a.current_price then
      insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), after.price) returning * into b;
    else
      b := row(null, a.id, auth.uid(), after.price, now(), null, null, null, false)::public.auction_bids; -- só subiu o máximo
    end if;
  else
    -- ultrapassado de imediato pela licitação automática de quem já ganhava
    insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), p_amount) returning * into b;
    insert into public.auction_bids(auction_id, bidder_id, amount, is_auto, created_at) values (a.id, after.leader, after.price, true, now() + interval '1 millisecond');
  end if;

  if before.leader is not null and before.leader is distinct from after.leader then
    insert into public.notifications(user_id, type, title, body, data)
    values (before.leader, 'bid', 'A sua licitação foi ultrapassada', 'O preço de «' || a.title || '» está agora em ' || after.price || ' Kz. Pode subir o seu máximo.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  if after.price <> a.current_price or before.leader is distinct from after.leader then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.seller_id, 'bid', 'Nova licitação', 'Preço atual de «' || a.title || '»: ' || after.price || ' Kz.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_orders(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_fulfillment not in ('delivery','pickup') then raise exception 'INVALID_FULFILLMENT'; end if;
  if p_payment_method not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and nullif(trim(p_delivery_text), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid and ordered_at is null) then raise exception 'CART_EMPTY'; end if;
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid and ci.ordered_at is null for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and ci.ordered_at is null and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null loop
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, 0, sub, 'unpaid', p_payment_method,
      p_fulfillment, 'pending', trim(p_contact_phone), nullif(trim(p_delivery_text), ''), nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.ordered_at is null and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || sub || ' Kz.', jsonb_build_object('order_id', oid));
    ids := ids || oid;
  end loop;
  update public.cart_items set ordered_at = now() where cart_id = cid and ordered_at is null;
  return ids;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_orders_v2(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_protected boolean DEFAULT false)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ids uuid[]; st public.platform_settings;
begin
  if not coalesce(p_protected, false) then
    return public.place_orders(p_fulfillment, p_payment_method, p_contact_phone, p_delivery_text, p_note);
  end if;
  select * into st from public.platform_settings where id = 1;
  if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  ids := public.place_orders(p_fulfillment, 'reference', p_contact_phone, p_delivery_text, p_note);
  update public.orders set protected = true, escrow_status = 'awaiting_payment',
    pay_by = now() + make_interval(hours => st.payment_window_hours), updated_at = now()
   where id = any(ids);
  update public.notifications set body = body || ' 🛡️ Pagamento protegido: espere pelo aviso «Pagamento recebido» antes de enviar.',
    data = data || jsonb_build_object('for', 'sale')
   where type = 'order' and title = 'Nova encomenda' and data->>'order_id' = any(ids::text[]);
  return ids;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_orders_v3(p_choices jsonb, p_payment_method text, p_contact_phone text, p_municipality_id uuid DEFAULT NULL::uuid, p_delivery_text text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_protected boolean DEFAULT false)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric; choice text; q jsonb; fee numeric; st public.platform_settings;
  pay text := case when coalesce(p_protected, false) then 'reference' else p_payment_method end;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if pay not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_choices is null or jsonb_typeof(p_choices) <> 'object' then raise exception 'INVALID_FULFILLMENT'; end if;
  if coalesce(p_protected, false) then
    select * into st from public.platform_settings where id = 1;
    if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid and ordered_at is null) then raise exception 'CART_EMPTY'; end if;
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid and ci.ordered_at is null for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and ci.ordered_at is null and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null loop
    choice := p_choices ->> s.seller_id::text;
    if choice is null or choice not in ('pickup', 'delivery') then raise exception 'FULFILLMENT_REQUIRED'; end if;
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    q := public.seller_delivery_quote(s.seller_id, p_municipality_id, sub);
    if choice = 'pickup' then
      if not (q->>'pickup')::boolean then raise exception 'SELLER_NO_PICKUP'; end if;
      fee := 0;
    else
      if nullif(trim(coalesce(p_delivery_text, '')), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
      if not (q->>'delivery')::boolean then
        raise exception '%', case q->>'reason' when 'no_delivery' then 'SELLER_NO_DELIVERY' when 'min_order' then 'DELIVERY_BELOW_MINIMUM'
          when 'needs_area' then 'DELIVERY_AREA_REQUIRED' else 'DELIVERY_AREA_NOT_COVERED' end;
      end if;
      fee := coalesce((q->>'fee')::numeric, 0);
    end if;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, delivery_municipality_id, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, fee, sub + fee, 'unpaid', pay,
      choice, 'pending', trim(p_contact_phone), case when choice = 'delivery' then nullif(trim(p_delivery_text), '') end,
      case when choice = 'delivery' then p_municipality_id end, nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.ordered_at is null and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || (sub + fee) || ' Kz'
      || case when choice = 'pickup' then ' (levantamento no local).' when fee > 0 then ' (inclui entrega: ' || fee || ' Kz).' else ' (entrega grátis).' end
      || case when coalesce(p_protected, false) then ' 🛡️ Pagamento protegido: espere pelo aviso «Pagamento recebido» antes de enviar.' else '' end,
      jsonb_build_object('order_id', oid) || case when coalesce(p_protected, false) then jsonb_build_object('for', 'sale') else '{}'::jsonb end);
    ids := ids || oid;
  end loop;
  update public.cart_items set ordered_at = now() where cart_id = cid and ordered_at is null;
  if coalesce(p_protected, false) then
    update public.orders set protected = true, escrow_status = 'awaiting_payment',
      pay_by = now() + make_interval(hours => st.payment_window_hours), updated_at = now()
     where id = any(ids);
  end if;
  return ids;
end $function$
;

CREATE OR REPLACE FUNCTION public.plan_monthly_price(p_kind text)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_kind when 'provider' then provider_monthly_kz when 'business' then business_monthly_kz else store_monthly_kz end from public.platform_settings where id = 1;
$function$
;

CREATE OR REPLACE FUNCTION public.plan_subject_exists(s subscriptions)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case s.kind when 'provider' then exists (select 1 from public.provider_profiles pp where pp.user_id = s.provider_id)
                     when 'business' then exists (select 1 from public.businesses b where b.id = s.business_id)
                     else exists (select 1 from public.products p where p.seller_id = s.seller_id and p.business_id is null) end;
$function$
;

CREATE OR REPLACE FUNCTION public.plan_subject_name(s subscriptions)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(case s.kind when 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = s.provider_id)
                              when 'business' then (select b.name from public.businesses b where b.id = s.business_id)
                              else 'A minha Loja' end, 'Perfil apagado');
$function$
;

CREATE OR REPLACE FUNCTION public.portfolio_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' and (select count(*) from public.portfolio_items
      where provider_id is not distinct from new.provider_id and business_id is not distinct from new.business_id) >= 40 then
    raise exception 'PORTFOLIO_FULL';
  end if;
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id; new.provider_id := old.provider_id; new.business_id := old.business_id; new.created_at := old.created_at;
  end if;
  new.title := trim(new.title); new.description := nullif(trim(coalesce(new.description, '')), ''); new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.portfolio_photos_ok(p_photos text[], p_owner uuid)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(bool_and(p ~ ('^https://[a-z0-9.-]+/storage/v1/object/public/classified-media/' || p_owner::text || '/[A-Za-z0-9._-]{1,120}$')), false)
  from unnest(p_photos) p;
$function$
;

CREATE OR REPLACE FUNCTION public.portfolio_target_owned(p_provider uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_provider is not null then p_provider = auth.uid() and exists (select 1 from public.provider_profiles where user_id = p_provider)
              else exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) end;
$function$
;

CREATE OR REPLACE FUNCTION public.portfolio_target_public(p_provider uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_provider is not null then exists (select 1 from public.provider_profiles where user_id = p_provider and active) and public.subject_paid_up(p_provider, null)
              else exists (select 1 from public.businesses where id = p_business and active) and public.subject_paid_up(null, p_business) end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_job_queue(p_limit integer DEFAULT 300)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j public.job_queue; n integer := 0;
begin
  for j in select * from public.job_queue where done_at is null and run_after <= now() order by id limit greatest(1, least(p_limit, 2000)) for update skip locked loop
    begin
      case j.kind
        when 'saved_search' then perform public.job_saved_search(j.ref_id);
        when 'wanted' then perform public.job_wanted(j.ref_id);
        when 'follow_listing' then perform public.job_follow_listing(j.ref_id);
        when 'follow_product' then perform public.job_follow_product(j.ref_id);
        when 'follow_portfolio' then perform public.job_follow_portfolio(j.ref_id);
        when 'fuel_alert' then perform public.job_fuel_alert(j.ref_id);
      end case;
      update public.job_queue set done_at = now(), attempts = attempts + 1 where id = j.id;
      n := n + 1;
    exception when others then
      update public.job_queue set attempts = attempts + 1, last_error = left(sqlerrm, 500),
        run_after = now() + make_interval(mins => power(2, least(attempts, 6))::int),
        done_at = case when attempts + 1 >= 5 then now() end
      where id = j.id;
    end;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.product_catalog(p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_seller_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, seller_id uuid, seller_name text, business_id uuid, business_name text, name text, description text, category_id uuid, category_name text, price numeric, currency text, stock integer, media jsonb, municipality_id uuid, municipality_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'), p.business_id, b.name, p.name, p.description,
         p.category_id, c.name, p.price, p.currency, p.stock, p.media, p.municipality_id, m.name, p.created_at
  from public.products p
  left join public.profiles pr on pr.id = p.seller_id
  left join public.businesses b on b.id = p.business_id
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  where p.active and coalesce(pr.status, 'active') = 'active' and public.product_paid_up(p.seller_id, p.business_id)
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (p_seller_id is null or p.seller_id = p_seller_id)
    and (coalesce(p_query, '') = '' or lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(p_query) || '%')
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$function$
;
