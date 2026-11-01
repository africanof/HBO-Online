CREATE OR REPLACE FUNCTION public.my_blocks()
 RETURNS TABLE(user_id uuid, name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.blocked_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), b.created_at
  from public.user_blocks b left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() and b.active order by b.created_at desc limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.my_commissions()
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, listed_price numeric, sale_amount numeric, rate_pct numeric, amount numeric, source text, status text, due_at timestamp with time zone, overdue boolean, reference text, admin_note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.listing_id, c.listing_title, c.listed_price, c.sale_amount, c.rate_pct, c.amount, c.source, c.status, c.due_at,
    c.status = 'due' and c.due_at < now(), c.reference, c.admin_note, c.created_at
  from public.listing_commissions c where c.owner_id = auth.uid() and c.status <> 'cancelled'
  order by (c.status = 'due') desc, c.due_at, c.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_conversation_partners()
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_name text, other_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (me.conversation_id) me.conversation_id, o.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url
  from public.conversation_participants me
  join public.conversation_participants o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  left join public.profiles p on p.id = o.user_id
  where me.user_id = auth.uid()
  order by me.conversation_id, o.joined_at;
$function$
;

CREATE OR REPLACE FUNCTION public.my_deliveries(p_role text DEFAULT 'courier'::text)
 RETURNS TABLE(id uuid, order_id uuid, status text, notes text, requested_at timestamp with time zone, assigned_at timestamp with time zone, delivered_at timestamp with time zone, total numeric, currency text, delivery_text text, contact_phone text, seller_name text, buyer_name text, courier_name text, courier_phone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.order_id, d.status, d.notes, d.requested_at, d.assigned_at, d.delivered_at, o.total, o.currency, o.delivery_text,
    case when p_role = 'courier' or o.seller_id = auth.uid() then o.contact_phone end,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), coalesce(nullif(bp.full_name, ''), 'Cliente'), c.display_name, c.phone
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id
  left join public.profiles bp on bp.id = o.buyer_id
  left join public.couriers c on c.user_id = d.assigned_to
  where (p_role = 'courier' and d.assigned_to = auth.uid())
     or (p_role <> 'courier' and (o.seller_id = auth.uid() or o.buyer_id = auth.uid()))
  order by d.requested_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_disputes()
 RETURNS TABLE(id uuid, order_id uuid, my_role text, other_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, order_items jsonb, events jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.order_id, case when d.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note,
    d.created_at, d.updated_at, o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', oi.quantity) order by pr.name), '[]')
       from public.order_items oi join public.products pr on pr.id = oi.product_id where oi.order_id = o.id),
    public.dispute_events_json(d.id)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles p on p.id = case when d.buyer_id = auth.uid() then d.seller_id else d.buyer_id end
  where auth.uid() in (d.buyer_id, d.seller_id)
  order by (d.status <> 'resolved') desc, d.updated_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_disputes_v2()
 RETURNS TABLE(id uuid, order_id uuid, my_role text, other_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, order_items jsonb, events jsonb, protected boolean, escrow_status text, refund_to text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.order_id, case when d.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note,
    d.created_at, d.updated_at, o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', oi.quantity) order by pr.name), '[]')
       from public.order_items oi join public.products pr on pr.id = oi.product_id where oi.order_id = o.id),
    public.dispute_events_json(d.id), o.protected, o.escrow_status,
    case when d.buyer_id = auth.uid() then d.refund_to end
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles p on p.id = case when d.buyer_id = auth.uid() then d.seller_id else d.buyer_id end
  where auth.uid() in (d.buyer_id, d.seller_id)
  order by (d.status <> 'resolved') desc, d.updated_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_event_tickets()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.starts_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.quantity, o.total, o.unit_price, o.method, o.reference, o.pay_by, o.note, o.created_at,
      e.id event_id, e.title, e.starts_at, e.ends_at, e.venue, e.status event_status, e.cancel_reason,
      pi.holder pay_holder, pi.iban pay_iban, pi.express pay_express, pi.note pay_note, t.name type_name,
      (select coalesce(jsonb_agg(jsonb_build_object('code', k.code, 'status', k.status) order by k.code), '[]') from public.event_tickets k where k.order_id = o.id) tickets
    from public.event_orders o join public.events e on e.id = o.event_id join public.event_ticket_types t on t.id = o.ticket_type_id
      left join public.event_payment_info pi on pi.event_id = e.id
    where o.buyer_id = auth.uid() order by e.starts_at desc limit 200) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_field_agent()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); a public.field_agents; st public.platform_settings;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  select * into a from public.field_agents where user_id = me;
  if not found then return jsonb_build_object('agent', null, 'sale_pct', st.agent_sale_pct); end if;
  return jsonb_build_object(
    'agent', jsonb_build_object('code', a.code, 'status', a.status, 'full_name', a.full_name, 'phone', a.phone, 'note', a.note,
      'admin_note', a.admin_note, 'market_id', a.market_id, 'market_name', (select m.name from public.markets m where m.id = a.market_id), 'created_at', a.created_at),
    'sale_pct', st.agent_sale_pct,
    'pending_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'pending'),
    'approved_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'approved'),
    'listings', (select count(*) from public.classified_listings where agent_id = me),
    'sold', (select count(*) from public.classified_listings where agent_id = me and status = 'sold'),
    'helped', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select l.id, l.title, l.status, l.price, l.currency, l.created_at from public.classified_listings l
      where l.agent_id = me and l.status <> 'draft' order by l.created_at desc limit 100) x),
    'commissions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select c.id, c.listing_id, c.listing_title, c.amount, c.sale_amount, c.rate_pct, c.status, c.admin_note, c.created_at, c.decided_at,
        (select l.status from public.classified_listings l where l.id = c.listing_id) listing_status
      from public.agent_commissions c where c.agent_id = me order by c.created_at desc limit 100) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.my_follower_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*) from public.followed_sellers where seller_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.my_follows()
 RETURNS TABLE(kind text, id uuid, name text, picture text, detail text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'seller', f.seller_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url, p.municipality, f.created_at
    from public.followed_sellers f join public.profiles p on p.id = f.seller_id where f.user_id = auth.uid()
  union all
  select 'provider', f.provider_id, pp.display_name, pp.avatar_url, pp.headline, f.created_at
    from public.followed_providers f join public.provider_profiles pp on pp.user_id = f.provider_id where f.user_id = auth.uid()
  union all
  select 'business', f.business_id, b.name, b.logo_url, b.address_text, f.created_at
    from public.followed_businesses f join public.businesses b on b.id = f.business_id where f.user_id = auth.uid()
  order by 6 desc limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.my_fuel_orders()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.unit_price, o.subtotal, o.fee_pct, o.fee_amount, o.total, o.code,
      case when o.status in ('reserved', 'submitted', 'paid') then o.qr_token end qr_token,
      o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.plate,
      o.created_at, s.id station_id, s.name station_name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id left join public.fuel_station_pay y on y.station_id = s.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_inspections()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name, i.status, i.address, i.phone, i.preferred_time,
      i.note, i.scheduled_for, i.admin_note, i.inspected_at, i.valid_until, i.created_at, i.fee_amount, i.pay_method, i.pay_reference, i.paid_at
    from public.inspections i where i.owner_id = auth.uid() order by i.created_at desc limit 50) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_item_stats(p_days integer DEFAULT 30)
 RETURNS TABLE(kind text, item_id uuid, title text, status text, created_at timestamp with time zone, views bigint, views_total bigint, whatsapp bigint, calls bigint, shares bigint, saves bigint, messages bigint, offers bigint, orders bigint, followers bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); d integer := least(greatest(coalesce(p_days, 30), 1), 365); since date; since_ts timestamptz;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  since := public.angola_today() - (d - 1);
  since_ts := (since::timestamp at time zone 'Africa/Luanda');
  return query
  with items as (
    select 'listing'::text k, l.id, l.title::text t, l.status::text st, l.created_at c from public.classified_listings l
      where l.owner_id = me and l.status not in ('draft', 'cancelled')
    union all select 'product', p.id, p.name, case when p.active then 'active' else 'inactive' end, p.created_at from public.products p where p.seller_id = me
    union all select 'business', b.id, b.name, case when b.active then 'active' else 'inactive' end, b.created_at from public.businesses b where b.owner_id = me
    union all select 'provider', pp.user_id, pp.display_name, case when pp.active then 'active' else 'inactive' end, pp.created_at from public.provider_profiles pp where pp.user_id = me
  )
  select i.k, i.id, i.t, i.st, i.c,
    coalesce(sum(s.views) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.views), 0)::bigint,
    coalesce(sum(s.whatsapp) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.calls) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.shares) filter (where s.day >= since), 0)::bigint,
    (select count(*) from public.saved_items si where case i.k when 'listing' then si.classified_listing_id when 'product' then si.product_id
       when 'business' then si.business_id else si.provider_id end = i.id),
    (select count(*) from public.conversations cv where cv.created_at >= since_ts and cv.created_by <> me and case i.k when 'listing' then cv.classified_listing_id
       when 'product' then cv.product_id when 'business' then cv.business_id else cv.provider_id end = i.id),
    case when i.k = 'listing' then (select count(*) from public.listing_offers o where o.listing_id = i.id and o.created_at >= since_ts) else 0 end,
    case when i.k = 'product' then (select count(distinct oi.order_id) from public.order_items oi where oi.product_id = i.id and oi.created_at >= since_ts)
         when i.k = 'provider' then (select count(*) from public.service_requests r where r.provider_id = i.id and r.business_id is null and r.created_at >= since_ts)
         when i.k = 'business' then (select count(*) from public.service_requests r where r.business_id = i.id and r.created_at >= since_ts) else 0 end,
    case when i.k = 'business' then (select count(*) from public.followed_businesses f where f.business_id = i.id)
         when i.k = 'provider' then (select count(*) from public.followed_providers f where f.provider_id = i.id) else 0 end
  from items i
  left join public.item_stats_daily s on s.kind = i.k and s.item_id = i.id
  group by i.k, i.id, i.t, i.st, i.c;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_listing_boosts()
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, days integer, amount numeric, status text, method text, reference text, starts_at timestamp with time zone, ends_at timestamp with time zone, admin_note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.ref_no, b.listing_id, l.title, b.days, b.amount, b.status, b.method, b.reference, b.starts_at, b.ends_at, b.admin_note, b.created_at
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id
  where b.owner_id = auth.uid() order by b.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_listing_claims()
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, role text, other_name text, request text, reason text, description text, amount numeric, status text, outcome text, seller_note text, admin_note text, decided_by_admin boolean, respond_by timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.ref_no, c.listing_id, c.listing_title, case when c.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.request, c.reason, c.description, c.amount, c.status, c.outcome, c.seller_note, c.admin_note,
    c.decided_by_admin, c.respond_by, c.created_at, c.updated_at
  from public.listing_claims c left join public.profiles p on p.id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  where c.buyer_id = auth.uid() or c.seller_id = auth.uid()
  order by c.updated_at desc limit 200
$function$
;

CREATE OR REPLACE FUNCTION public.my_listing_offer_counts()
 RETURNS TABLE(listing_id uuid, pending bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.listing_id, count(*) from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where l.owner_id = auth.uid() and o.status = 'pending' group by o.listing_id;
$function$
;

CREATE OR REPLACE FUNCTION public.my_offers()
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, listing_status text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.listing_id, l.title, l.status, o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at
  from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where o.buyer_id = auth.uid() order by o.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders(p_role text DEFAULT 'buyer'::text)
 RETURNS TABLE(id uuid, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.buyer_id, o.seller_id,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders_v2(p_role text DEFAULT 'buyer'::text)
 RETURNS TABLE(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders_v3(p_role text DEFAULT 'buyer'::text)
 RETURNS TABLE(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text, pay_by timestamp with time zone, paid_at timestamp with time zone, delivered_at timestamp with time zone, release_at timestamp with time zone, released_at timestamp with time zone, platform_fee numeric, payment jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id),
         o.fulfillment_status, o.protected, o.escrow_status, o.pay_by, o.paid_at, o.delivered_at, o.release_at, o.released_at,
         case when p_role = 'seller' then o.platform_fee else 0 end,
         case when p_role = 'seller' or not o.protected then null else
           (select jsonb_build_object('id', op.id, 'status', op.status, 'provider', op.provider, 'method', op.method, 'entity', op.entity,
              'reference', op.reference, 'amount', op.amount, 'expires_at', op.expires_at, 'admin_note', op.admin_note, 'created_at', op.created_at)
              from public.order_payments op where op.order_id = o.id order by op.created_at desc limit 1) end
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders_v4(p_role text)
 RETURNS TABLE(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text, pay_by timestamp with time zone, paid_at timestamp with time zone, delivered_at timestamp with time zone, release_at timestamp with time zone, released_at timestamp with time zone, platform_fee numeric, payment jsonb, subtotal numeric, delivery_fee numeric, delivery_municipality_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.*, o.subtotal, o.delivery_fee, m.name
  from public.my_orders_v3(p_role) v join public.orders o on o.id = v.id left join public.municipalities m on m.id = o.delivery_municipality_id
$function$
;

CREATE OR REPLACE FUNCTION public.my_pending_reviews()
 RETURNS TABLE(kind text, ref_id uuid, title text, other_id uuid, other_name text, other_role text, done_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from (
    select 'order'::text, o.id, 'Encomenda de ' || to_char(o.created_at, 'DD/MM/YYYY'),
           case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end,
           coalesce(nullif(p.full_name, ''), 'Utilizador'),
           case when o.buyer_id = auth.uid() then 'seller' else 'buyer' end, o.updated_at
    from public.orders o left join public.profiles p on p.id = case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end
    where o.status = 'completed' and auth.uid() in (o.buyer_id, o.seller_id) and o.seller_id is not null
      and not exists (select 1 from public.user_reviews r where r.author_id = auth.uid() and r.order_id = o.id)
    union all
    select 'listing', l.id, l.title,
           case when l.owner_id = auth.uid() then l.deal_with else l.owner_id end,
           coalesce(nullif(p.full_name, ''), 'Utilizador'),
           case when (l.owner_id = auth.uid()) = (l.purpose = 'wanted') then 'seller' else 'buyer' end, l.deal_at
    from public.classified_listings l left join public.profiles p on p.id = case when l.owner_id = auth.uid() then l.deal_with else l.owner_id end
    where l.deal_with is not null and auth.uid() in (l.owner_id, l.deal_with)
      and not exists (select 1 from public.user_reviews r where r.author_id = auth.uid() and r.listing_id = l.id)
  ) t where auth.uid() is not null order by 7 desc nulls last limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_promo_posts()
 RETURNS TABLE(id uuid, ref_no bigint, subject_kind text, subject_id uuid, subject_name text, kind text, title text, live_starts_at timestamp with time zone, live_ends_at timestamp with time zone, status text, hidden_reason text, featured_until timestamp with time zone, views integer, created_at timestamp with time zone, boost_status text, boost_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.ref_no, x.subject_kind, x.subject_id, s.name, x.kind, x.title, x.live_starts_at, x.live_ends_at, x.status, x.hidden_reason, x.featured_until, x.views, x.created_at,
    b.status, b.admin_note
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  left join lateral (select pb.status, pb.admin_note from public.promo_boosts pb where pb.post_id = x.id order by pb.created_at desc limit 1) b on true
  where x.owner_id = auth.uid()
  order by x.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_promo_subjects()
 RETURNS TABLE(kind text, id uuid, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'provider', pp.user_id, pp.display_name from public.provider_profiles pp where pp.user_id = auth.uid() and pp.active
  union all select 'business', b.id, b.name from public.businesses b where b.owner_id = auth.uid() and b.active
  union all select 'store', pr.id, coalesce(nullif(pr.full_name, ''), 'A minha loja') from public.profiles pr
    where pr.id = auth.uid() and exists (select 1 from public.subscriptions s where s.seller_id = pr.id and s.kind = 'store');
$function$
;

CREATE OR REPLACE FUNCTION public.my_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select code into c from public.referral_codes where user_id = me;
  if c is not null then return c; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    begin
      insert into public.referral_codes(user_id, code) values (me, c);
      return c;
    exception when unique_violation then
      select code into c from public.referral_codes where user_id = me;
      if c is not null then return c; end if;
    end;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_referrals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); created timestamptz;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select u.created_at into created from auth.users u where u.id = me;
  return jsonb_build_object(
    'code', public.my_referral_code(),
    'reward_days', (select referral_reward_days from public.platform_settings where id = 1),
    'invited', (select count(*) from public.referrals where referrer_id = me),
    'earned', (select count(*) from public.referrals where referrer_id = me and status in ('earned', 'rewarded')),
    'days_earned', (select coalesce(sum(reward_days), 0) from public.referrals where referrer_id = me and status in ('earned', 'rewarded')),
    'waiting_days', (select coalesce(sum(reward_days), 0) from public.referrals where referrer_id = me and status = 'earned'),
    'can_claim', created >= now() - interval '14 days' and not exists (select 1 from public.referrals where referred_id = me),
    'invited_by', (select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'um amigo') from public.referrals r join public.profiles p on p.id = r.referrer_id where r.referred_id = me),
    'friends', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Amigo') as name, r.status, r.reward_days, r.created_at
      from public.referrals r left join public.profiles p on p.id = r.referred_id where r.referrer_id = me order by r.created_at desc limit 100) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.my_rental_requests(p_role text DEFAULT 'renter'::text)
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, proposed_price numeric, message text, other_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.listing_id, l.title, r.status, r.starts_at, r.ends_at, r.proposed_price, r.message,
         coalesce(nullif(p.full_name, ''), 'Utilizador'), r.created_at
  from public.rental_requests r
  join public.classified_listings l on l.id = r.listing_id
  left join public.profiles p on p.id = case when p_role = 'owner' then r.renter_id else l.owner_id end
  where (p_role = 'owner' and l.owner_id = auth.uid()) or (p_role <> 'owner' and r.renter_id = auth.uid())
  order by r.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_saved_items()
 RETURNS TABLE(id uuid, kind text, target_id uuid, title text, subtitle text, image text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id,
    case when s.classified_listing_id is not null then 'listing' when s.provider_id is not null then 'provider'
         when s.business_id is not null then 'business' when s.product_id is not null then 'product' else 'other' end,
    coalesce(s.classified_listing_id, s.provider_id, s.business_id, s.product_id, s.service_id, s.auction_id),
    coalesce(l.title, pp.display_name, b.name, p.name, 'Item'),
    coalesce(case when l.id is not null then coalesce(l.price::text || ' Kz', 'Preço sob consulta') end,
             pp.headline, left(b.description, 100), case when p.id is not null then p.price::text || ' Kz' end, ''),
    coalesce(l.media->>0, p.media->>0, pp.avatar_url, b.logo_url),
    s.created_at
  from public.saved_items s
  left join public.classified_listings l on l.id = s.classified_listing_id and (l.status = 'published' or l.owner_id = auth.uid())
  left join public.provider_profiles pp on pp.user_id = s.provider_id and pp.active
  left join public.businesses b on b.id = s.business_id and b.active
  left join public.products p on p.id = s.product_id and p.active
  where s.user_id = auth.uid()
  order by s.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_service_requests(p_as text DEFAULT 'client'::text)
 RETURNS TABLE(id uuid, status text, description text, provider_note text, created_at timestamp with time zone, updated_at timestamp with time zone, provider_id uuid, business_id uuid, target_name text, client_id uuid, client_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente')
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  where auth.uid() is not null and case when p_as = 'provider'
    then (s.provider_id = auth.uid() or b.owner_id = auth.uid()) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_service_requests_v2(p_as text DEFAULT 'client'::text)
 RETURNS TABLE(id uuid, status text, description text, provider_note text, created_at timestamp with time zone, updated_at timestamp with time zone, provider_id uuid, business_id uuid, target_name text, client_id uuid, client_name text, preferred_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente'), s.preferred_date
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  where auth.uid() is not null and case when p_as = 'provider'
    then (s.provider_id = auth.uid() or b.owner_id = auth.uid()) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_stats_daily(p_days integer DEFAULT 30)
 RETURNS TABLE(day date, views bigint, contacts bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); d integer := least(greatest(coalesce(p_days, 30), 1), 365); since date;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  since := public.angola_today() - (d - 1);
  return query
  with days as (select g::date dd from generate_series(since, public.angola_today(), interval '1 day') g),
  ev as (select s.day dd, sum(s.views) v, sum(s.whatsapp + s.calls) c from public.item_stats_daily s where s.owner_id = me and s.day >= since group by s.day),
  mine as (
    select l.id from public.classified_listings l where l.owner_id = me
    union all select p.id from public.products p where p.seller_id = me
    union all select b.id from public.businesses b where b.owner_id = me
    union all select me),
  msg as (select (cv.created_at at time zone 'Africa/Luanda')::date dd, count(*) c from public.conversations cv
    where cv.created_by <> me and cv.created_at >= (since::timestamp at time zone 'Africa/Luanda')
      and coalesce(cv.classified_listing_id, cv.product_id, cv.business_id, cv.provider_id) in (select id from mine)
    group by 1)
  select days.dd, coalesce(ev.v, 0)::bigint, (coalesce(ev.c, 0) + coalesce(msg.c, 0))::bigint
  from days left join ev on ev.dd = days.dd left join msg on msg.dd = days.dd order by days.dd;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_subscriptions()
 RETURNS TABLE(id uuid, kind text, subject_id uuid, name text, trial_ends_at timestamp with time zone, paid_until timestamp with time zone, active_until timestamp with time zone, state text, monthly_price numeric, pending_payment_id uuid, pending_amount numeric, last_rejected_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.kind, coalesce(s.provider_id, s.business_id, s.seller_id), public.plan_subject_name(s),
    s.trial_ends_at, s.paid_until, public.subscription_active_until(s),
    case when public.subscription_active_until(s) <= now() then 'expired'
         when s.paid_until is not null and s.paid_until > now() then case when s.paid_until < now() + interval '7 days' then 'expiring' else 'paid' end
         when s.trial_ends_at < now() + interval '7 days' then 'trial_ending' else 'trial' end,
    public.plan_monthly_price(s.kind), p.id, p.amount,
    (select r.admin_note from public.subscription_payments r where r.subscription_id = s.id and r.status = 'rejected' order by r.decided_at desc limit 1)
  from public.subscriptions s
  left join public.subscription_payments p on p.subscription_id = s.id and p.status = 'pending'
  where s.owner_id = auth.uid() and public.plan_subject_exists(s)
  order by case s.kind when 'provider' then 0 when 'store' then 1 else 2 end, s.created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.my_venue_orders()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.kind, o.status, o.method, o.guests, o.check_in, o.check_out, o.slot_at, o.buyer_note, o.subtotal, o.client_fee_pct, o.client_fee, o.total, o.code,
      case when o.status in ('reserved', 'submitted', 'paid') then o.qr_token end qr_token,
      o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.completed_at,
      v.id venue_id, v.kind venue_kind, b.name venue_name, b.address_text, b.directions, b.geo_lat, b.geo_lng, b.phone,
      (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
        from public.venue_order_lines l where l.order_id = o.id) lines,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.venue_orders o join public.venues v on v.id = o.venue_id join public.businesses b on b.id = v.business_id
      left join public.venue_pay y on y.venue_id = v.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$function$
;
