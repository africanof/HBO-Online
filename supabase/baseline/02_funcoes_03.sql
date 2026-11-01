CREATE OR REPLACE FUNCTION public.cancel_payout(p_payout_id uuid)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pr public.payout_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into pr from public.payout_requests where id = p_payout_id for update;
  if not found or pr.user_id <> auth.uid() then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if pr.status <> 'requested' then raise exception 'PAYOUT_IN_PROGRESS'; end if;
  update public.payout_requests set status = 'cancelled' where id = pr.id returning * into pr;
  perform public.wallet_add(pr.user_id, null, pr.id, 'available', 'payout_returned', pr.amount, 'Levantamento L-' || pr.ref_no || ' cancelado');
  return pr;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_rental_request(p_request_id uuid)
 RETURNS rental_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.rental_requests;
begin
  select * into r from public.rental_requests where id = p_request_id for update;
  if not found or r.renter_id <> auth.uid() then raise exception 'RENTAL_NOT_FOUND'; end if;
  if r.status not in ('pending','accepted') then raise exception 'RENTAL_ALREADY_ANSWERED'; end if;
  update public.rental_requests set status = 'cancelled', updated_at = now() where id = r.id returning * into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_venue_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; me uuid := auth.uid(); was text; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  select * into v from public.venues where id = o.venue_id;
  was := o.status;
  if o.buyer_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  elsif v.owner_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
  else raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  update public.venue_orders set status = 'cancelled', note = coalesce(txt, note), updated_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when o.buyer_id = me then v.owner_id else o.buyer_id end, 'system', 'Pedido cancelado',
    'R-' || o.ref_no || coalesce(': ' || txt, '') || case when v.owner_id = me and was in ('submitted', 'paid') then ' O estabelecimento deve devolver o dinheiro.' else '' end,
    case when o.buyer_id = me then jsonb_build_object('for', 'venue', 'venue_id', v.id) else jsonb_build_object('for', 'venue_orders') end);
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.cart_add(p_product_id uuid, p_quantity integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; p public.products;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.products where id = p_product_id and active;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p.seller_id = auth.uid() then raise exception 'CANNOT_BUY_OWN_PRODUCT'; end if;
  insert into public.carts(user_id) values (auth.uid()) on conflict (user_id) do update set updated_at = now() returning id into cid;
  insert into public.cart_items(cart_id, product_id, quantity) values (cid, p_product_id, least(p_quantity, greatest(p.stock, 1)))
  on conflict (cart_id, product_id) do update set
    quantity = least(case when public.cart_items.ordered_at is null then public.cart_items.quantity else 0 end + excluded.quantity, greatest(p.stock, 1)),
    ordered_at = null;
end $function$
;

CREATE OR REPLACE FUNCTION public.cart_contents()
 RETURNS TABLE(product_id uuid, name text, price numeric, currency text, stock integer, active boolean, media jsonb, seller_id uuid, seller_name text, quantity integer, line_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.name, p.price, p.currency, p.stock, p.active, p.media, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'),
         ci.quantity, p.price * ci.quantity
  from public.carts c join public.cart_items ci on ci.cart_id = c.id join public.products p on p.id = ci.product_id
  left join public.profiles pr on pr.id = p.seller_id
  where c.user_id = auth.uid() and ci.ordered_at is null
  order by pr.full_name, p.name;
$function$
;

CREATE OR REPLACE FUNCTION public.cart_delivery_quote(p_municipality_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('seller_id', x.seller_id, 'seller_name', x.seller_name, 'subtotal', x.sub,
    'quote', public.seller_delivery_quote(x.seller_id, p_municipality_id, x.sub)) order by x.seller_name), '[]')
  from (select p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor') seller_name, sum(p.price * ci.quantity) sub
        from public.carts c join public.cart_items ci on ci.cart_id = c.id and ci.ordered_at is null join public.products p on p.id = ci.product_id
        left join public.profiles pr on pr.id = p.seller_id
        where c.user_id = auth.uid() group by p.seller_id, pr.full_name) x
$function$
;

CREATE OR REPLACE FUNCTION public.cart_set_quantity(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_quantity, 0) < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null then return; end if;
  update public.cart_items ci set quantity = least(p_quantity, greatest(p.stock, 1))
  from public.products p where ci.cart_id = cid and ci.product_id = p_product_id and p.id = ci.product_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.check_agent_code(p_code text)
 RETURNS TABLE(code text, first_name text, market_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.code, split_part(trim(a.full_name), ' ', 1), m.name
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where a.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and a.status = 'active'
$function$
;

CREATE OR REPLACE FUNCTION public.check_in_event_ticket(p_event_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; t public.event_tickets; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); tn text; holder text;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if c like 'HO%' then c := substr(c, 3); end if;
  if char_length(c) <> 8 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'HO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into t from public.event_tickets where code = c for update;
  if not found or t.event_id <> e.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  select name into tn from public.event_ticket_types where id = t.ticket_type_id;
  select buyer_name into holder from public.event_orders where id = t.order_id;
  if t.status = 'void' then return jsonb_build_object('result', 'void', 'code', c, 'type', tn, 'holder', holder); end if;
  if t.status = 'used' then return jsonb_build_object('result', 'used', 'code', c, 'type', tn, 'holder', holder, 'at', t.checked_in_at); end if;
  update public.event_tickets set status = 'used', checked_in_at = now(), checked_in_by = auth.uid() where id = t.id;
  return jsonb_build_object('result', 'ok', 'code', c, 'type', tn, 'holder', holder);
end $function$
;

CREATE OR REPLACE FUNCTION public.checkout_cart(p_cart_id uuid, p_delivery_address_id uuid DEFAULT NULL::uuid, p_delivery_fee numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_order uuid;
  v_subtotal numeric(14,2);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.carts where id=p_cart_id and user_id=v_user) then raise exception 'CART_NOT_FOUND'; end if;

  select coalesce(sum(p.price * ci.quantity),0)
    into v_subtotal
  from public.cart_items ci
  join public.products p on p.id=ci.product_id
  where ci.cart_id=p_cart_id and p.active=true and p.stock >= ci.quantity;

  if v_subtotal is null or v_subtotal=0 then raise exception 'CART_EMPTY_OR_UNAVAILABLE'; end if;

  if exists (
    select 1 from public.cart_items ci
    join public.products p on p.id=ci.product_id
    where ci.cart_id=p_cart_id and (not p.active or p.stock < ci.quantity)
  ) then raise exception 'STOCK_CHANGED'; end if;

  insert into public.orders(buyer_id,status,currency,subtotal,delivery_fee,total,delivery_address_id)
  values(v_user,'pending','AOA',v_subtotal,greatest(p_delivery_fee,0),v_subtotal+greatest(p_delivery_fee,0),p_delivery_address_id)
  returning id into v_order;

  insert into public.order_items(order_id,product_id,seller_id,quantity,unit_price,line_total)
  select v_order,p.id,p.seller_id,ci.quantity,p.price, p.price*ci.quantity
  from public.cart_items ci join public.products p on p.id=ci.product_id
  where ci.cart_id=p_cart_id;

  update public.products p
  set stock=p.stock-ci.quantity, updated_at=now()
  from public.cart_items ci
  where ci.cart_id=p_cart_id and ci.product_id=p.id;

  delete from public.cart_items where cart_id=p_cart_id;
  return v_order;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_delivery(p_delivery_id uuid)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.delivery_requests; o public.orders; c public.couriers;
begin
  select * into c from public.couriers where user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'NOT_APPROVED_COURIER'; end if;
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.status <> 'pending' then raise exception 'DELIVERY_ALREADY_TAKEN'; end if;
  select * into o from public.orders where id = d.order_id;
  if o.seller_id = auth.uid() or o.buyer_id = auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  update public.delivery_requests set assigned_to = auth.uid(), status = 'accepted', assigned_at = now() where id = d.id returning * into d;
  update public.orders set fulfillment_status = 'assigned', updated_at = now() where id = o.id;
  insert into public.notifications(user_id, type, title, body, data)
  select u, 'delivery', 'Estafeta a caminho', c.display_name || ' (' || c.phone || ') vai fazer a entrega.', jsonb_build_object('delivery_id', d.id, 'order_id', o.id)
  from unnest(array[o.seller_id, o.buyer_id]) u;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); ref uuid; created timestamptz; name text;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select user_id into ref from public.referral_codes where code = c;
  if ref is null then raise exception 'REFERRAL_NOT_FOUND'; end if;
  if ref = me then raise exception 'REFERRAL_SELF'; end if;
  if exists (select 1 from public.referrals where referred_id = me) then raise exception 'REFERRAL_ALREADY'; end if;
  select u.created_at into created from auth.users u where u.id = me;
  if created < now() - interval '14 days' then raise exception 'REFERRAL_TOO_LATE'; end if;
  if exists (select 1 from public.referrals where referred_id = ref and referrer_id = me) then raise exception 'REFERRAL_SELF'; end if;
  insert into public.referrals(referred_id, referrer_id) values (me, ref);
  select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Alguém') into name from public.profiles where id = me;
  insert into public.notifications(user_id, type, title, body, data)
  values (ref, 'system', 'Convite aceite 🎉', coalesce(name, 'Alguém') || ' entrou no Huambo Online com o seu convite. Ganha um mês grátis quando pagar a primeira mensalidade.',
    jsonb_build_object('for', 'referral'));
  return (select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'um amigo') from public.profiles where id = ref);
end $function$
;

CREATE OR REPLACE FUNCTION public.classified_saved_search_matches_listing(p_filters jsonb, p_listing classified_listings)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
 f jsonb:=case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end;
 category_filter uuid; min_price numeric; max_price numeric; filter_territory uuid; filter_kind text;
 listing_territory uuid; listing_neighborhood uuid; listing_municipality uuid; listing_province uuid; listing_country_code text;
 listing_matches boolean:=true; mode text := nullif(trim(coalesce(f->>'saleMode','')),'');
begin
 begin
  if nullif(trim(f->>'categoryId'),'') is not null then category_filter:=(f->>'categoryId')::uuid; end if;
  if nullif(trim(f->>'minPrice'),'') is not null then min_price:=(f->>'minPrice')::numeric; end if;
  if nullif(trim(f->>'maxPrice'),'') is not null then max_price:=(f->>'maxPrice')::numeric; end if;
 exception when invalid_text_representation then return false; end;
 select a.street_id,n.id,m.id,p.id,p.country_code into listing_territory,listing_neighborhood,listing_municipality,listing_province,listing_country_code
 from public.addresses a left join public.streets s on s.id=a.street_id left join public.neighborhoods n on n.id=s.neighborhood_id left join public.municipalities m on m.id=n.municipality_id left join public.provinces p on p.id=m.province_id where a.id=p_listing.address_id;
 if p_listing.address_id is not null and not public.listing_territory_active(p_listing) then return false; end if;
 begin
  listing_municipality:=coalesce(listing_municipality,nullif(p_listing.attributes->>'municipalityId','')::uuid);
  listing_province:=coalesce(listing_province,nullif(p_listing.attributes->>'provinceId','')::uuid);
 exception when invalid_text_representation then null; end;
 if listing_province is null and listing_municipality is not null then select m.province_id into listing_province from public.municipalities m where m.id=listing_municipality; end if;
 if listing_country_code is null and listing_province is not null then select p.country_code into listing_country_code from public.provinces p where p.id=listing_province; end if;
 if nullif(trim(f->>'streetId'),'') is not null then
  begin filter_territory:=(f->>'streetId')::uuid; filter_kind:='street'; exception when invalid_text_representation then return false; end;
 elsif nullif(trim(f->>'neighborhoodId'),'') is not null then
  begin filter_territory:=(f->>'neighborhoodId')::uuid; filter_kind:='neighborhood'; exception when invalid_text_representation then return false; end;
 elsif nullif(trim(f->>'municipalityId'),'') is not null then
  begin filter_territory:=(f->>'municipalityId')::uuid; filter_kind:='municipality'; exception when invalid_text_representation then return false; end;
 elsif nullif(trim(f->>'provinceId'),'') is not null then
  begin filter_territory:=(f->>'provinceId')::uuid; filter_kind:='province'; exception when invalid_text_representation then return false; end;
 end if;
 if filter_territory is not null then
  if not public.saved_search_territory_active(filter_territory,filter_kind) then return false; end if;
  listing_matches:=case filter_kind when 'street' then listing_territory=filter_territory when 'neighborhood' then listing_neighborhood=filter_territory when 'municipality' then listing_municipality=filter_territory when 'province' then listing_province=filter_territory else false end;
  if not coalesce(listing_matches,false) then return false; end if;
 elsif nullif(trim(f->>'countryCode'),'') is not null then
  if not exists(select 1 from public.provinces p where p.country_code=f->>'countryCode' and p.active) then return false; end if;
  if listing_country_code is distinct from f->>'countryCode' then return false; end if;
 end if;
 return (category_filter is null or p_listing.category_id=category_filter)
 and (min_price is null or (p_listing.price is not null and p_listing.price>=min_price))
 and (max_price is null or (p_listing.price is not null and p_listing.price<=max_price))
 and (coalesce(trim(f->>'listingType'),'')='' or p_listing.listing_type=f->>'listingType')
 and (coalesce(trim(f->>'purpose'),'')='' or p_listing.purpose=f->>'purpose')
 and (coalesce(trim(f->>'query'),'')='' or public.fold_text(concat_ws(' ', p_listing.title, p_listing.description, p_listing.trade_wants)) like '%'||public.fold_text(trim(f->>'query'))||'%')
 and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> (f->'attributes'))
 and (mode is null or p_listing.purpose <> 'wanted' and case mode
       when 'trade' then p_listing.sale_mode = 'trade' or p_listing.accepts_trade
       when 'auction' then p_listing.purpose = 'auction' or p_listing.sale_mode = 'auction'
       when 'negotiable' then p_listing.purpose <> 'auction' and coalesce(p_listing.sale_mode, 'negotiable') = 'negotiable'
       else p_listing.purpose <> 'auction' and p_listing.sale_mode = mode end);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.clean_refund_destination(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare d text := public.angola_iban_digits(p); n text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d is not null then return public.format_angola_iban(d); end if;
  if n ~ '^(244)?9[0-9]{8}$' then return 'Multicaixa Express ' || right(n, 9); end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.close_auction(p_auction_id uuid)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; st record;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status not in ('live','scheduled') then return a; end if;
  if now() < a.ends_at then
    if auth.uid() is distinct from a.seller_id and not public.has_admin_role() then raise exception 'AUCTION_NOT_ENDED'; end if;
    if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
    update public.auctions set status = 'cancelled', updated_at = now() where id = a.id returning * into a;
    return a;
  end if;
  select * into st from public.auction_standing(a.id);
  update public.auctions set status = 'ended',
    winner_id = case when st.leader is not null and (reserve_price is null or st.leader_max >= reserve_price) then st.leader end,
    current_price = st.price, updated_at = now()
  where id = a.id returning * into a;
  if a.winner_id is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.winner_id, 'auction', 'Ganhou o leilão!', 'Ganhou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'auction', 'Leilão terminado',
          case when a.winner_id is not null then '«' || a.title || '» vendido por ' || a.current_price || ' Kz.'
               when st.leader is not null then '«' || a.title || '» terminou sem atingir o preço mínimo de venda.' else '«' || a.title || '» terminou sem vencedor.' end,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.close_classified_listing(p_listing_id uuid, p_final_status text)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
 if p_final_status not in ('sold','rented','closed','cancelled') then raise exception 'INVALID_FINAL_STATUS'; end if;
 select * into l from public.classified_listings where id=p_listing_id for update;
 if not found then raise exception 'LISTING_NOT_FOUND'; end if;
 if l.owner_id<>auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
 update public.classified_listings set status=p_final_status,updated_at=now() where id=p_listing_id returning * into l;
 return l;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.collect_fuel(p_station_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; o public.fuel_orders; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if c like 'CB%' then c := substr(c, 3); end if;
  if char_length(c) <> 6 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'CB-' || c;
  select * into o from public.fuel_orders where code = c for update;
  if not found or o.station_id <> s.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  if o.status = 'collected' then return jsonb_build_object('result', 'used', 'code', c, 'at', o.collected_at, 'buyer', o.buyer_name); end if;
  if o.status not in ('reserved', 'paid') then return jsonb_build_object('result', o.status, 'code', c, 'buyer', o.buyer_name); end if;
  update public.fuel_orders set status = 'collected', collected_at = now(), updated_at = now() where id = o.id returning * into o;
  update public.fuel_products set reservable_qty = greatest(0, reservable_qty - o.quantity) where id = o.product_id;
  return jsonb_build_object('result', 'ok', 'code', c, 'buyer', o.buyer_name, 'plate', o.plate, 'product', o.product, 'quantity', o.quantity,
    'total', o.total, 'fee', o.fee_amount, 'method', o.method);
end $function$
;

CREATE OR REPLACE FUNCTION public.complete_venue_order(p_venue_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; o public.venue_orders; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if c like 'RV%' then c := substr(c, 3); end if;
  if char_length(c) <> 6 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'RV-' || c;
  select * into o from public.venue_orders where code = c for update;
  if not found or o.venue_id <> v.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  if o.status = 'completed' then return jsonb_build_object('result', 'used', 'code', c, 'at', o.completed_at, 'buyer', o.buyer_name); end if;
  if o.status not in ('reserved', 'paid') then return jsonb_build_object('result', o.status, 'code', c, 'buyer', o.buyer_name); end if;
  update public.venue_orders set status = 'completed', completed_at = now(), updated_at = now() where id = o.id returning * into o;
  if o.kind <> 'stay' then
    update public.venue_items i set qty_total = greatest(0, i.qty_total - l.qty), updated_at = now()
      from public.venue_order_lines l where l.order_id = o.id and l.item_id = i.id and i.qty_total is not null;
  end if;
  return jsonb_build_object('result', 'ok', 'code', c, 'kind', o.kind, 'buyer', o.buyer_name, 'guests', o.guests, 'check_in', o.check_in, 'check_out', o.check_out,
    'slot_at', o.slot_at, 'total', o.total, 'method', o.method,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'unit', l.unit)), '[]') from public.venue_order_lines l where l.order_id = o.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.confirm_order_received(p_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected then raise exception 'NOT_PROTECTED'; end if;
  if o.escrow_status = 'awaiting_payment' then raise exception 'AWAITING_PAYMENT'; end if;
  if o.escrow_status <> 'held' or o.status = 'cancelled' then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  update public.orders set received_at = now(), status = 'completed', fulfillment_status = 'delivered',
    completed_at = coalesce(completed_at, now()), updated_at = now() where id = o.id;
  perform public.escrow_release(o.id, 'buyer');
  select * into o from public.orders where id = p_order_id;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.confirm_service(p_id uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.client_id <> auth.uid() then raise exception 'NOT_SERVICE_CLIENT'; end if;
  if r.status not in ('accepted', 'done') then raise exception 'INVALID_TRANSITION'; end if;
  owner := public.service_request_owner(r);
  update public.service_requests set status = 'confirmed', updated_at = now() where id = r.id returning * into r;
  -- Uma avaliação por pessoa e profissional/empresa: a mais recente substitui a anterior.
  update public.reviews set rating = p_rating, comment = nullif(left(trim(coalesce(p_comment, '')), 1000), ''),
         status = 'published', service_request_id = r.id, created_at = now()
   where author_id = auth.uid() and ((r.provider_id is not null and provider_id = r.provider_id) or (r.business_id is not null and business_id = r.business_id));
  if not found then
    insert into public.reviews(author_id, provider_id, business_id, rating, comment, status, service_request_id)
    values (auth.uid(), r.provider_id, r.business_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''), 'published', r.id);
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'review', 'Serviço confirmado e avaliado', p_rating || ' estrela(s)' || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 140), ''),
          jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.consume_photo_search()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'Africa/Luanda')::date; used integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  insert into public.photo_search_usage(user_id, day, count) values (auth.uid(), d, 1)
  on conflict (user_id, day) do update set count = public.photo_search_usage.count + 1
    where public.photo_search_usage.count < public.photo_search_limit()
  returning count into used;
  if used is null then raise exception 'PHOTO_SEARCH_LIMIT'; end if;
  return public.photo_search_limit() - used;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_classified_auction(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_starting_price numeric, p_reserve_price numeric DEFAULT NULL::numeric, p_min_increment numeric DEFAULT 0)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; a public.auctions;
begin
 select * into l from public.classified_listings where id=p_listing_id for update;
 if not found then raise exception 'LISTING_NOT_FOUND'; end if;
 if l.owner_id<>auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
 if l.status not in ('published','draft') then raise exception 'LISTING_NOT_AUCTIONABLE'; end if;
 if l.listing_type not in ('real_estate','vehicle','product','classified') then raise exception 'LISTING_TYPE_NOT_AUCTIONABLE'; end if;
 if p_ends_at<=p_starts_at then raise exception 'INVALID_AUCTION_WINDOW'; end if;
 if p_starting_price<0 or p_min_increment<0 then raise exception 'INVALID_AUCTION_PRICE'; end if;

 insert into public.auctions(
   seller_id,title,description,currency,starting_price,reserve_price,min_increment,current_price,
   starts_at,ends_at,status,classified_listing_id
 ) values (
   l.owner_id,l.title,l.description,l.currency,p_starting_price,p_reserve_price,p_min_increment,
   p_starting_price,p_starts_at,p_ends_at,
   case when p_starts_at<=now() then 'live' else 'scheduled' end,p_listing_id
 ) returning * into a;

 update public.classified_listings set purpose='auction',updated_at=now() where id=p_listing_id;
 return a;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_classified_saved_search(p_name text, p_filters jsonb)
 RETURNS classified_saved_searches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.classified_saved_searches;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.classified_saved_searches(user_id,name,filters) values(auth.uid(),trim(p_name),coalesce(p_filters,'{}'::jsonb)) returning * into v;
 return v;
end; $function$
;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.notifications;
begin
  insert into public.notifications(user_id,type,title,body,data)
  values(p_user_id,p_type,p_title,p_body,coalesce(p_data,'{}'::jsonb))
  returning * into v;
  return v;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), true);
$function$
;

CREATE OR REPLACE FUNCTION public.decide_event_ticket_order(p_order_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.event_orders; e public.events; st public.platform_settings; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  select * into e from public.events where id = o.event_id;
  if e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if o.status not in ('reserved', 'submitted') then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  if p_confirm then
    update public.event_orders set status = 'confirmed', decided_at = now(), note = txt, fee_pct = st.event_ticket_fee_pct,
      fee_amount = round(total * st.event_ticket_fee_pct / 100), method = coalesce(method, 'cash') where id = o.id returning * into o;
    perform public.issue_event_tickets(o);
  else
    update public.event_orders set status = 'rejected', decided_at = now(), note = txt where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then 'Bilhetes confirmados 🎟️' else 'Pagamento dos bilhetes não confirmado' end,
    case when p_confirm then o.quantity || ' bilhete(s) para «' || left(e.title, 80) || '». Mostre o código à entrada.' else '«' || left(e.title, 80) || '»: ' || txt end,
    jsonb_build_object('for', 'tickets', 'event_id', e.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.decide_fuel_payment(p_order_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if o.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.fuel_orders set status = 'paid', code = coalesce(code, public.new_fuel_code()), hold_until = now() + make_interval(mins => s.hold_minutes), note = txt, updated_at = now()
      where id = o.id returning * into o;
  else
    update public.fuel_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '⛽ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': levante ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' até ' || to_char(o.hold_until at time zone 'Africa/Luanda', 'DD/MM HH24:MI') || '. Mostre o QR no posto.'
         else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_orders'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.decide_venue_payment(p_order_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  select * into v from public.venues where id = o.venue_id;
  if v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if o.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select name into bname from public.businesses where id = v.business_id;
  if p_confirm then
    update public.venue_orders set status = 'paid', code = coalesce(code, public.new_venue_code()), note = txt, updated_at = now() where id = o.id returning * into o;
  else
    update public.venue_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '✔ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then bname || ': mostre o QR ou o código ' || o.code || ' ao chegar.' else bname || ': ' || txt end,
    jsonb_build_object('for', 'venue_orders'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_promo_post(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.promo_posts where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'POST_NOT_FOUND'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.delivery_requires_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from public.orders where id = new.order_id and escrow_status = 'awaiting_payment') then raise exception 'AWAITING_PAYMENT'; end if;
  return new;
end $function$
;
