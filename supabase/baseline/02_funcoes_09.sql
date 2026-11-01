CREATE OR REPLACE FUNCTION public.request_service(p_provider_id uuid, p_business_id uuid, p_description text)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests; owner uuid; who text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'INVALID_TARGET'; end if;
  if char_length(trim(coalesce(p_description, ''))) < 3 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_provider_id is not null then
    select pp.user_id, pp.display_name into owner, who from public.provider_profiles pp where pp.user_id = p_provider_id and pp.active;
  else
    select b.owner_id, b.name into owner, who from public.businesses b where b.id = p_business_id and b.active;
  end if;
  if owner is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_REQUEST_OWN_SERVICE'; end if;
  if (select count(*) from public.service_requests s where s.client_id = auth.uid() and s.created_at > now() - interval '1 day') >= 20 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.service_requests(client_id, provider_id, business_id, description)
  values (auth.uid(), p_provider_id, p_business_id, left(trim(p_description), 1000)) returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'system', 'Novo pedido de serviço', left(trim(p_description), 160), jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_service_v2(p_provider_id uuid, p_business_id uuid, p_description text, p_preferred_date date DEFAULT NULL::date)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests;
begin
  if p_preferred_date is not null and (p_preferred_date < (now() at time zone 'Africa/Luanda')::date or p_preferred_date > (now() at time zone 'Africa/Luanda')::date + 365) then
    raise exception 'INVALID_DATE';
  end if;
  r := public.request_service(p_provider_id, p_business_id, p_description);
  if p_preferred_date is not null then
    update public.service_requests set preferred_date = p_preferred_date where id = r.id returning * into r;
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_verification(p_kind text, p_business_id uuid DEFAULT NULL::uuid, p_document_path text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.verification_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind = 'identity' then raise exception 'IDENTITY_NEEDS_SELFIE'; end if;
  if p_kind not in ('provider', 'business') then raise exception 'INVALID_KIND'; end if;
  if p_kind = 'provider' and not exists (select 1 from public.provider_profiles where user_id = auth.uid()) then raise exception 'NO_PROVIDER_PROFILE'; end if;
  if p_kind = 'business' and not exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()) then raise exception 'NOT_BUSINESS_OWNER'; end if;
  if p_document_path is not null and split_part(p_document_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_document_path is null then raise exception 'DOCUMENT_REQUIRED'; end if;
  if exists (select 1 from public.verification_requests where user_id = auth.uid() and kind = p_kind and status = 'pending'
             and business_id is not distinct from case when p_kind = 'business' then p_business_id end) then raise exception 'VERIFICATION_PENDING'; end if;
  insert into public.verification_requests(user_id, kind, business_id, document_path, note)
  values (auth.uid(), p_kind, case when p_kind = 'business' then p_business_id end, p_document_path, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', case p_kind when 'provider' then 'Profissional' else 'Empresa' end, jsonb_build_object('verification_id', v.id));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.require_capability(target_user uuid, target_capability text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.account_capabilities
    where user_id = target_user and capability = target_capability
  );
$function$
;

CREATE OR REPLACE FUNCTION public.require_listing_conformity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.purpose <> 'wanted' and new.conformity_accepted_at is null then
    raise exception 'CONFORMITY_REQUIRED';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.require_product_conformity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.active and (tg_op = 'INSERT' or not old.active or old.conformity_accepted_at is null) and new.conformity_accepted_at is null then
    raise exception 'CONFORMITY_REQUIRED';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_event_tickets(p_ticket_type_id uuid, p_quantity integer, p_name text, p_phone text DEFAULT NULL::text)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); t public.event_ticket_types; e public.events; o public.event_orders; st public.platform_settings; left_ int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into t from public.event_ticket_types where id = p_ticket_type_id for update;
  if not found or not t.active then raise exception 'TICKET_TYPE_NOT_FOUND'; end if;
  select * into e from public.events where id = t.event_id;
  if e.status <> 'published' or coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then raise exception 'EVENT_NOT_ON_SALE'; end if;
  if e.organizer_id = me then raise exception 'CANNOT_BUY_OWN_TICKETS'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > t.max_per_order then raise exception 'INVALID_TICKET_QUANTITY'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  left_ := t.quantity - public.ticket_type_taken(t.id);
  if p_quantity > left_ then raise exception 'NOT_ENOUGH_TICKETS'; end if;
  if t.price > 0 and exists (select 1 from public.event_orders where buyer_id = me and event_id = e.id and status in ('reserved', 'submitted')) then raise exception 'TICKET_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.event_orders(event_id, ticket_type_id, buyer_id, buyer_name, buyer_phone, quantity, unit_price, total, status, pay_by, decided_at)
  values (e.id, t.id, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_quantity, t.price, t.price * p_quantity,
    case when t.price = 0 then 'confirmed' else 'reserved' end,
    case when t.price = 0 then null else now() + make_interval(hours => st.event_payment_hours) end,
    case when t.price = 0 then now() end)
  returning * into o;
  if t.price = 0 then
    perform public.issue_event_tickets(o);
  else
    insert into public.notifications(user_id, type, title, body, data)
    values (e.organizer_id, 'system', 'Nova reserva de bilhetes 🎟️', o.quantity || ' × ' || t.name || ' · «' || left(e.title, 80) || '» · B-' || o.ref_no || '. Confirme quando receber o pagamento.',
      jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  end if;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_fuel(p_product_id uuid, p_quantity numeric, p_method text, p_name text, p_phone text DEFAULT NULL::text, p_plate text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p public.fuel_products; s public.fuel_stations; st public.platform_settings; o public.fuel_orders; left_ numeric; sub numeric; fee numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into p from public.fuel_products where id = p_product_id for update;
  if not found then raise exception 'FUEL_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = p.station_id;
  if s.status <> 'approved' then raise exception 'FUEL_NOT_FOUND'; end if;
  if s.owner_id = me then raise exception 'CANNOT_BUY_OWN'; end if;
  if p_method not in ('at_station', 'prepaid') then raise exception 'INVALID_METHOD'; end if;
  if not s.accepts_reservations or public.fuel_fees_overdue(s.id) then raise exception 'FUEL_NO_RESERVATIONS'; end if;
  if p_method = 'prepaid' and (not s.accepts_prepay or not exists (select 1 from public.fuel_station_pay x where x.station_id = s.id and (x.iban is not null or x.express is not null))) then raise exception 'FUEL_NO_PREPAY'; end if;
  if p.status not in ('available', 'low') then raise exception 'FUEL_NOT_AVAILABLE'; end if;
  if p.price is null then raise exception 'FUEL_NO_PRICE'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > p.max_per_order then raise exception 'FUEL_INVALID_QUANTITY'; end if;
  if p.product like 'gas_%' and p_quantity <> trunc(p_quantity) then raise exception 'FUEL_INVALID_QUANTITY'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  left_ := p.reservable_qty - public.fuel_reserved_qty(p.id);
  if p_quantity > left_ then raise exception 'FUEL_NOT_ENOUGH'; end if;
  if exists (select 1 from public.fuel_orders where buyer_id = me and product = p.product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')) then raise exception 'FUEL_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  sub := round(p.price * p_quantity);
  fee := round(sub * st.fuel_fee_pct / 100);
  insert into public.fuel_orders(station_id, product_id, product, buyer_id, buyer_name, buyer_phone, plate, quantity, unit_price, subtotal, fee_pct, fee_amount, total,
    method, status, code, hold_until, pay_by)
  values (s.id, p.id, p.product, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), nullif(upper(trim(coalesce(p_plate, ''))), ''),
    p_quantity, p.price, sub, st.fuel_fee_pct, fee, sub + fee, p_method,
    case when p_method = 'at_station' then 'reserved' else 'awaiting_payment' end,
    case when p_method = 'at_station' then public.new_fuel_code() end,
    case when p_method = 'at_station' then now() + make_interval(mins => s.hold_minutes) end,
    case when p_method = 'prepaid' then now() + make_interval(mins => st.fuel_pay_minutes) end)
  returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', case when p_method = 'at_station' then '⛽ Nova reserva' else '⛽ Nova compra adiantada' end,
    'C-' || o.ref_no || ' · ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' · ' || o.total || ' Kz · ' || o.buyer_name,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_venue(p_venue_id uuid, p_kind text, p_lines jsonb, p_method text, p_name text, p_phone text DEFAULT NULL::text, p_check_in date DEFAULT NULL::date, p_check_out date DEFAULT NULL::date, p_guests integer DEFAULT NULL::integer, p_slot_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); v public.venues; b public.businesses; st public.platform_settings; o public.venue_orders; i public.venue_items;
  ln jsonb; q numeric; nights int := 1; sub numeric := 0; cfee numeric; bfee numeric; today date := (now() at time zone 'Africa/Luanda')::date; n int := 0; free_ numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into v from public.venues where id = p_venue_id;
  if not found or v.status <> 'approved' then raise exception 'VENUE_NOT_FOUND'; end if;
  select * into b from public.businesses where id = v.business_id;
  if not b.active then raise exception 'VENUE_NOT_FOUND'; end if;
  if v.owner_id = me then raise exception 'CANNOT_BUY_OWN'; end if;
  if not v.accepts_reservations or public.venue_fees_overdue(v.id) then raise exception 'VENUE_NO_RESERVATIONS'; end if;
  if p_method not in ('at_place', 'prepaid') then raise exception 'INVALID_METHOD'; end if;
  if p_method = 'at_place' and not v.accepts_pay_at_place then raise exception 'VENUE_NO_PAY_AT_PLACE'; end if;
  if p_method = 'prepaid' and (not v.accepts_prepay or not exists (select 1 from public.venue_pay y where y.venue_id = v.id and (y.iban is not null or y.express is not null))) then raise exception 'VENUE_NO_PREPAY'; end if;
  if (v.kind = 'hotel' and p_kind <> 'stay') or (v.kind = 'restaurant' and p_kind not in ('table', 'order')) or (v.kind = 'warehouse' and p_kind <> 'order') then raise exception 'INVALID_KIND'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then p_lines := '[]'; end if;
  if jsonb_array_length(p_lines) > 40 then raise exception 'VENUE_TOO_MANY_LINES'; end if;
  if (select count(*) from public.venue_orders where buyer_id = me and venue_id = v.id and public.venue_open_status(status)) >= 3 then raise exception 'VENUE_ORDER_OPEN'; end if;
  if p_kind = 'stay' then
    if jsonb_array_length(p_lines) <> 1 then raise exception 'VENUE_ONE_ROOM_TYPE'; end if;
    if p_check_in is null or p_check_out is null or p_check_in < today or p_check_in > today + 365 or p_check_out <= p_check_in then raise exception 'VENUE_INVALID_DATES'; end if;
    nights := p_check_out - p_check_in;
    if nights > 60 then raise exception 'VENUE_INVALID_DATES'; end if;
    if p_guests is null or p_guests < 1 then raise exception 'VENUE_INVALID_GUESTS'; end if;
  elsif p_kind = 'table' then
    if p_guests is null or p_guests < 1 or p_guests > 100 then raise exception 'VENUE_INVALID_GUESTS'; end if;
    if p_slot_at is null or p_slot_at < now() or p_slot_at > now() + interval '60 days' then raise exception 'VENUE_INVALID_TIME'; end if;
  else
    if jsonb_array_length(p_lines) = 0 then raise exception 'VENUE_EMPTY_ORDER'; end if;
    if p_slot_at is null or p_slot_at < now() - interval '5 minutes' or p_slot_at > now() + interval '30 days' then raise exception 'VENUE_INVALID_TIME'; end if;
  end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.venue_orders(venue_id, buyer_id, kind, buyer_name, buyer_phone, guests, check_in, check_out, slot_at, buyer_note,
    subtotal, client_fee_pct, business_fee_pct, total, method, status)
  values (v.id, me, p_kind, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_guests,
    case when p_kind = 'stay' then p_check_in end, case when p_kind = 'stay' then p_check_out end, case when p_kind <> 'stay' then p_slot_at end,
    nullif(left(trim(coalesce(p_note, '')), 300), ''), 0, st.venue_client_fee_pct, st.venue_business_fee_pct, 0, p_method, 'reserved')
  returning * into o;
  for ln in select * from jsonb_array_elements(p_lines) loop
    begin q := (ln->>'qty')::numeric; exception when others then raise exception 'VENUE_INVALID_QUANTITY'; end;
    select * into i from public.venue_items where id = (ln->>'item_id')::uuid and venue_id = v.id for update;
    if not found then raise exception 'VENUE_ITEM_NOT_FOUND'; end if;
    if not i.available then raise exception 'VENUE_ITEM_NOT_AVAILABLE'; end if;
    if q is null or q <= 0 or q > 100000 then raise exception 'VENUE_INVALID_QUANTITY'; end if;
    if exists (select 1 from public.venue_order_lines where order_id = o.id and item_id = i.id) then raise exception 'VENUE_DUPLICATE_ITEM'; end if;
    if p_kind = 'stay' then
      if q <> trunc(q) or q > 20 then raise exception 'VENUE_INVALID_QUANTITY'; end if;
      if p_guests > coalesce(i.capacity, 2) * q then raise exception 'VENUE_TOO_MANY_GUESTS'; end if;
      if public.venue_room_free(i.id, p_check_in, p_check_out) < q then raise exception 'VENUE_NO_ROOMS'; end if;
    else
      if q < i.min_qty then raise exception 'VENUE_BELOW_MINIMUM'; end if;
      if i.qty_total is not null and q > i.qty_total - public.venue_item_reserved(i.id) then raise exception 'VENUE_NOT_ENOUGH'; end if;
    end if;
    insert into public.venue_order_lines(order_id, item_id, name, unit, qty, unit_price, line_total)
    values (o.id, i.id, i.name, i.unit, q, i.price, round(i.price * q * nights));
    sub := sub + round(i.price * q * nights);
    n := n + 1;
  end loop;
  cfee := round(sub * st.venue_client_fee_pct / 100);
  bfee := round(sub * st.venue_business_fee_pct / 100);
  if p_method = 'prepaid' and sub = 0 then raise exception 'VENUE_NOTHING_TO_PAY'; end if;
  update public.venue_orders set subtotal = sub, client_fee = cfee, business_fee = bfee, total = sub + cfee,
    status = case when p_method = 'at_place' then 'reserved' else 'awaiting_payment' end,
    code = case when p_method = 'at_place' then public.new_venue_code() end,
    hold_until = case when p_method = 'at_place' then
      case when p_kind = 'stay' then ((p_check_in + 1)::timestamp + time '12:00') at time zone 'Africa/Luanda' else p_slot_at + make_interval(mins => v.hold_minutes) end end,
    pay_by = case when p_method = 'prepaid' then now() + make_interval(mins => st.venue_pay_minutes) end
  where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', case p_kind when 'stay' then '🏨 Nova reserva de quarto' when 'table' then '🍽️ Nova reserva de mesa' else '📦 Nova encomenda' end,
    'R-' || o.ref_no || ' · ' || o.buyer_name || ' · ' || o.total || ' Kz' || case when p_method = 'prepaid' then ' (vai pagar adiantado)' else ' (paga no local)' end,
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_listing_claim(p_claim_id uuid, p_accept boolean, p_note text DEFAULT NULL::text)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found or c.seller_id <> auth.uid() then raise exception 'CLAIM_NOT_FOUND'; end if;
  if c.status <> 'open' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_accept and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.listing_claims set status = case when p_accept then 'accepted' else 'declined' end, seller_note = txt, updated_at = now()
   where id = c.id returning * into c;
  insert into public.notifications(user_id, type, title, body, data)
  values (c.buyer_id, 'system', case when p_accept then 'Reclamação aceite ✔' else 'Reclamação recusada' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): ' || coalesce(txt, case when p_accept then 'o vendedor aceitou.' else '' end)
    || case when p_accept then '' else ' Pode pedir à administração para decidir.' end, jsonb_build_object('for', 'claim'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_offer(p_offer_id uuid, p_accept boolean, p_note text DEFAULT NULL::text)
 RETURNS listing_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.listing_offers; l public.classified_listings;
begin
  select * into o from public.listing_offers where id = p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = o.listing_id;
  if l.owner_id is distinct from auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if o.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  update public.listing_offers set status = case when p_accept then 'accepted' else 'declined' end,
    seller_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), responded_at = now()
   where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_accept then 'Proposta aceite ✔' else 'Proposta recusada' end,
          '«' || l.title || '»' || coalesce(': ' || o.seller_note, case when p_accept then '. Combine a entrega com o vendedor pelas mensagens.' else '' end),
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'my_offer'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_rental_request(p_request_id uuid, p_accept boolean)
 RETURNS rental_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.rental_requests; l public.classified_listings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = r.listing_id;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if r.status <> 'pending' then raise exception 'RENTAL_ALREADY_ANSWERED'; end if;
  if p_accept and exists (select 1 from public.rental_requests x where x.listing_id = r.listing_id and x.status = 'accepted'
                          and x.id <> r.id and x.starts_at < r.ends_at and x.ends_at > r.starts_at) then raise exception 'RENTAL_WINDOW_UNAVAILABLE'; end if;
  update public.rental_requests set status = case when p_accept then 'accepted' else 'rejected' end, updated_at = now()
   where id = r.id returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.renter_id, 'system', case when p_accept then 'Aluguer aceite' else 'Aluguer recusado' end,
          'O seu pedido para «' || l.title || '» foi ' || case when p_accept then 'aceite.' else 'recusado.' end,
          jsonb_build_object('rental_id', r.id, 'listing_id', l.id));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.retract_auction_bid(p_auction_id uuid, p_reason text)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; latest timestamptz; reason text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  reason := case p_reason when 'typo' then 'Enganei-me no valor' when 'listing_changed' then 'O vendedor mudou o anúncio'
    when 'cannot_contact' then 'Não consigo contactar o vendedor' end;
  if reason is null then raise exception 'INVALID_REASON'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  select max_set_at into latest from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_at is null;
  if latest is null then raise exception 'NO_BID_TO_RETRACT'; end if;
  if a.ends_at - now() <= interval '12 hours' and latest < now() - interval '1 hour' then raise exception 'RETRACT_TOO_LATE'; end if;
  if (select count(*) from public.auction_max_bids where bidder_id = auth.uid() and retracted_by = auth.uid() and retracted_at > now() - interval '30 days') >= 3 then raise exception 'TOO_MANY_RETRACTIONS'; end if;
  a := public.auction_drop_bidder(a, auth.uid(), auth.uid(), reason);
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'bid', 'Lance retirado', 'Um licitador retirou os lances em «' || a.title || '» (' || reason || '). Preço atual: ' || a.current_price || ' Kz.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.round_listing_geo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.geo_lat := round(new.geo_lat, 3);
  new.geo_lng := round(new.geo_lng, 3);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_payout_account(p_method text, p_holder text, p_destination text)
 RETURNS payout_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.payout_accounts; holder text := nullif(left(trim(coalesce(p_holder, '')), 120), ''); dig text; num text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if holder is null or char_length(holder) < 3 then raise exception 'HOLDER_REQUIRED'; end if;
  if p_method = 'iban' then
    dig := public.angola_iban_digits(p_destination);
    if dig is null then raise exception 'INVALID_IBAN'; end if;
  elsif p_method = 'express' then
    num := right(regexp_replace(coalesce(p_destination, ''), '[^0-9]', '', 'g'), 9);
    if num !~ '^9[0-9]{8}$' then raise exception 'INVALID_EXPRESS_NUMBER'; end if;
  else raise exception 'INVALID_PAYOUT_METHOD'; end if;
  insert into public.payout_accounts(user_id, method, holder_name, iban, express_number, updated_at)
  values (auth.uid(), p_method, holder, dig, num, now())
  on conflict (user_id) do update set method = excluded.method, holder_name = excluded.holder_name, iban = excluded.iban,
    express_number = excluded.express_number, updated_at = now()
  returning * into a;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_promo_post(p_id uuid, p_subject_kind text, p_subject_id uuid, p_kind text, p_title text, p_description text DEFAULT NULL::text, p_video_url text DEFAULT NULL::text, p_external_url text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_live_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_live_minutes integer DEFAULT NULL::integer)
 RETURNS promo_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); s record; p public.promo_posts; old public.promo_posts;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('video', 'live') then raise exception 'INVALID_KIND'; end if;
  select * into s from public.promo_subject(p_subject_kind, p_subject_id);
  if s.owner is null or s.owner <> me then raise exception 'NOT_SUBJECT_OWNER'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 4 then raise exception 'TITLE_REQUIRED'; end if;
  if p_kind = 'video' and p_video_url is null and p_external_url is null then raise exception 'VIDEO_REQUIRED'; end if;
  if p_kind = 'live' then
    if p_external_url is null then raise exception 'LIVE_LINK_REQUIRED'; end if;
    if p_live_starts_at is null then raise exception 'LIVE_TIME_REQUIRED'; end if;
    if coalesce(p_live_minutes, 0) not between 10 and 480 then raise exception 'LIVE_DURATION_INVALID'; end if;
  end if;
  if p_id is null then
    if p_kind = 'live' and p_live_starts_at < now() - interval '10 minutes' then raise exception 'LIVE_IN_PAST'; end if;
    if p_kind = 'live' and p_live_starts_at > now() + interval '60 days' then raise exception 'LIVE_TOO_FAR'; end if;
    if (select count(*) from public.promo_posts x where x.owner_id = me and x.created_at > now() - interval '1 day') >= 5 then raise exception 'TOO_MANY_POSTS'; end if;
    insert into public.promo_posts(owner_id, subject_kind, subject_id, kind, title, description, video_url, external_url, cover_url, live_starts_at, live_ends_at)
    values (me, p_subject_kind, p_subject_id, p_kind, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_video_url, p_external_url, p_cover_url,
      case when p_kind = 'live' then p_live_starts_at end, case when p_kind = 'live' then p_live_starts_at + make_interval(mins => p_live_minutes) end)
    returning * into p;
    if s.visible then
      perform public.promo_notify_followers(p, 'promo:' || p.id,
        case when p.kind = 'live' then '🔴 Live de ' || s.name || ' — ' || to_char(p.live_starts_at at time zone 'Africa/Luanda', 'DD/MM HH24:MI')
             else '🎬 Vídeo novo de ' || s.name end, p.title);
    end if;
  else
    select * into old from public.promo_posts where id = p_id for update;
    if not found or old.owner_id <> me then raise exception 'POST_NOT_FOUND'; end if;
    if old.kind <> p_kind or old.subject_kind <> p_subject_kind or old.subject_id <> p_subject_id then raise exception 'CANNOT_CHANGE_KIND'; end if;
    update public.promo_posts set title = trim(p_title), description = nullif(trim(coalesce(p_description, '')), ''), video_url = p_video_url, external_url = p_external_url,
      cover_url = p_cover_url,
      live_starts_at = case when p_kind = 'live' then p_live_starts_at end,
      live_ends_at = case when p_kind = 'live' then p_live_starts_at + make_interval(mins => p_live_minutes) end,
      live_notified = case when p_kind = 'live' and p_live_starts_at is distinct from old.live_starts_at then false else old.live_notified end,
      updated_at = now()
    where id = p_id returning * into p;
  end if;
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.saved_search_territory_active(p_territory_id uuid, p_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare ok boolean;
begin
  if p_territory_id is null then return true; end if;
  if p_kind='street' then
    select s.active and p.active into ok from public.streets s join public.neighborhoods n on n.id=s.neighborhood_id join public.municipalities m on m.id=n.municipality_id join public.provinces p on p.id=m.province_id where s.id=p_territory_id;
  elsif p_kind='neighborhood' then
    select p.active into ok from public.neighborhoods n join public.municipalities m on m.id=n.municipality_id join public.provinces p on p.id=m.province_id where n.id=p_territory_id;
  elsif p_kind='municipality' then
    select p.active into ok from public.municipalities m join public.provinces p on p.id=m.province_id where m.id=p_territory_id;
  elsif p_kind='province' then
    select p.active into ok from public.provinces p where p.id=p_territory_id;
  else return false;
  end if;
  return coalesce(ok,false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.search_classified_by_location(p_province_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_neighborhood_id uuid DEFAULT NULL::uuid, p_listing_type text DEFAULT NULL::text, p_purpose text DEFAULT NULL::text, p_limit integer DEFAULT 30)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select l.*
 from public.classified_listings l
 join public.addresses a on a.id=l.address_id
 join public.streets s on s.id=a.street_id
 join public.neighborhoods n on n.id=s.neighborhood_id
 join public.municipalities m on m.id=n.municipality_id
 where l.status='published'
 and (p_province_id is null or m.province_id=p_province_id)
 and (p_municipality_id is null or n.municipality_id=p_municipality_id)
 and (p_neighborhood_id is null or s.neighborhood_id=p_neighborhood_id)
 and (p_listing_type is null or l.listing_type=p_listing_type)
 and (p_purpose is null or l.purpose=p_purpose)
 order by l.featured desc,l.created_at desc
 limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_classified_listings(p_listing_type text DEFAULT NULL::text, p_purpose text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_query text DEFAULT ''::text, p_attributes jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 30)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select *
 from public.classified_listings l
 where l.status='published'
 and (p_listing_type is null or l.listing_type=p_listing_type)
 and (p_purpose is null or l.purpose=p_purpose)
 and (p_category_id is null or l.category_id=p_category_id)
 and (p_min_price is null or l.price>=p_min_price)
 and (p_max_price is null or l.price<=p_max_price)
 and (p_query='' or lower(l.title) like '%'||lower(p_query)||'%' or lower(coalesce(l.description,'')) like '%'||lower(p_query)||'%')
 and (p_attributes='{}'::jsonb or l.attributes @> p_attributes)
 order by l.featured desc,l.created_at desc
 limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_classified_listings_v2(p_listing_type text DEFAULT NULL::text, p_purpose text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_query text DEFAULT ''::text, p_attributes jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 30, p_sale_mode text DEFAULT NULL::text)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select * from public.classified_listings l
  where l.status = 'published'
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_purpose is null or l.purpose = p_purpose)
    and (p_category_id is null or l.category_id = p_category_id)
    and (p_min_price is null or l.price >= p_min_price)
    and (p_max_price is null or l.price <= p_max_price)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', l.title, l.description, l.trade_wants)) like '%' || public.fold_text(trim(p_query)) || '%')
    and (coalesce(p_attributes, '{}'::jsonb) = '{}'::jsonb or l.attributes @> p_attributes)
    and (p_sale_mode is null or l.purpose <> 'wanted' and case p_sale_mode
          when 'trade' then l.sale_mode = 'trade' or l.accepts_trade
          when 'auction' then l.purpose = 'auction' or l.sale_mode = 'auction'
          when 'negotiable' then l.purpose <> 'auction' and coalesce(l.sale_mode, 'negotiable') = 'negotiable'
          else l.purpose <> 'auction' and l.sale_mode = p_sale_mode end)
  order by l.featured desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_huambo_online(p_query text DEFAULT ''::text, p_limit integer DEFAULT 30)
 RETURNS TABLE(entity_type text, entity_id uuid, title text, description text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with q as (select lower(trim(coalesce(p_query,''))) as term),
  results as (
    select 'business'::text as entity_type,b.id as entity_id,b.name as title,coalesce(b.description,'') as description
    from public.businesses b,q where b.active and (q.term='' or lower(b.name) like '%'||q.term||'%' or lower(coalesce(b.description,'')) like '%'||q.term||'%')
    union all
    select 'product',p.id,p.name,coalesce(p.description,'')
    from public.products p,q where p.active and (q.term='' or lower(p.name) like '%'||q.term||'%' or lower(coalesce(p.description,'')) like '%'||q.term||'%')
    union all
    select 'service',s.id,s.title,coalesce(s.description,'')
    from public.services s,q where s.active and (q.term='' or lower(s.title) like '%'||q.term||'%' or lower(coalesce(s.description,'')) like '%'||q.term||'%')
  )
  select entity_type,entity_id,title,description from results order by title limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_huambo_online(p_query text DEFAULT ''::text, p_limit integer DEFAULT 30, p_entity_type text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric)
 RETURNS TABLE(entity_type text, entity_id uuid, title text, description text, price numeric, category_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with results as (
    select 'business'::text entity_type,b.id entity_id,b.name title,coalesce(b.description,'') description,null::numeric price,b.category_id
    from public.businesses b
    where b.active
      and (p_entity_type is null or p_entity_type='business')
      and (p_category_id is null or b.category_id=p_category_id)
      and (p_query='' or lower(b.name) like '%'||lower(p_query)||'%' or lower(coalesce(b.description,'')) like '%'||lower(p_query)||'%')
    union all
    select 'product',p.id,p.name,coalesce(p.description,''),p.price,p.category_id
    from public.products p
    where p.active
      and (p_entity_type is null or p_entity_type='product')
      and (p_category_id is null or p.category_id=p_category_id)
      and (p_min_price is null or p.price>=p_min_price)
      and (p_max_price is null or p.price<=p_max_price)
      and (p_query='' or lower(p.name) like '%'||lower(p_query)||'%' or lower(coalesce(p.description,'')) like '%'||lower(p_query)||'%')
    union all
    select 'service',s.id,s.title,coalesce(s.description,''),s.price_from,s.category_id
    from public.services s
    where s.active
      and (p_entity_type is null or p_entity_type='service')
      and (p_category_id is null or s.category_id=p_category_id)
      and (p_min_price is null or coalesce(s.price_from,0)>=p_min_price)
      and (p_max_price is null or coalesce(s.price_from,0)<=p_max_price)
      and (p_query='' or lower(s.title) like '%'||lower(p_query)||'%' or lower(coalesce(s.description,'')) like '%'||lower(p_query)||'%')
  )
  select * from results order by title limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_trades(p_query text DEFAULT ''::text, p_only_trade boolean DEFAULT false, p_limit integer DEFAULT 40)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select l.* from public.classified_listings l
  where l.status = 'published' and l.purpose <> 'wanted'
    and (l.sale_mode = 'trade' or (not coalesce(p_only_trade, false) and l.accepts_trade))
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', l.title, l.description, l.trade_wants)) like '%' || public.fold_text(trim(p_query)) || '%')
  order by l.featured desc, (l.sale_mode = 'trade') desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$function$
;
