CREATE OR REPLACE FUNCTION public.admin_list_disputes(p_status text DEFAULT 'escalated'::text)
 RETURNS TABLE(id uuid, order_id uuid, buyer_id uuid, buyer_name text, seller_id uuid, seller_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, payment_method text, order_status text, events jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), d.seller_id, coalesce(nullif(s.full_name, ''), 'Utilizador'),
    d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note, d.created_at, d.updated_at, o.total, o.payment_method, o.status,
    public.dispute_events_json(d.id)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles b on b.id = d.buyer_id left join public.profiles s on s.id = d.seller_id
  where p_status is null or (p_status = 'active' and d.status <> 'resolved') or d.status = p_status
  order by (d.status = 'escalated') desc, d.updated_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_disputes_v2(p_status text DEFAULT 'escalated'::text)
 RETURNS TABLE(id uuid, order_id uuid, buyer_id uuid, buyer_name text, seller_id uuid, seller_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, payment_method text, order_status text, events jsonb, protected boolean, escrow_status text, refund_to text, order_ref text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), d.seller_id, coalesce(nullif(s.full_name, ''), 'Utilizador'),
    d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note, d.created_at, d.updated_at, o.total, o.payment_method, o.status,
    public.dispute_events_json(d.id), o.protected, o.escrow_status, d.refund_to, public.order_ref(o)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles b on b.id = d.buyer_id left join public.profiles s on s.id = d.seller_id
  where p_status is null or (p_status = 'active' and d.status <> 'resolved') or d.status = p_status
    or (p_status = 'escrow_refunds' and o.escrow_status = 'held' and d.status in ('awaiting_refund', 'refund_sent'))
  order by (d.status = 'escalated') desc, d.updated_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_event_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, event_id uuid, event_ref bigint, event_title text, organizer_name text, kind text, amount numeric, days integer, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.event_id, e.ref_no, e.title, coalesce(nullif(pr.full_name, ''), 'Organizador'), p.kind, p.amount, p.days,
    p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at
  from public.event_platform_payments p join public.events e on e.id = p.event_id left join public.profiles pr on pr.id = p.organizer_id
  where p_status is null or p.status = p_status order by p.created_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_fuel_orders(p_status text DEFAULT 'submitted'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.subtotal, o.fee_amount, o.total, o.buyer_name, o.buyer_phone, o.reference, o.proof_path,
      o.qr_token, o.note, o.created_at, s.id station_id, s.ref_no station_ref, s.name station_name
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id
    where o.method = 'prepaid' and (coalesce(p_status, '') = '' or o.status = p_status) order by o.created_at desc limit 200) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_fuel_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, station_id uuid, station_ref bigint, station_name text, owner_name text, amount numeric, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.station_id, s.ref_no, s.name, coalesce(nullif(pr.full_name, ''), 'Dono'), p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at
  from public.fuel_platform_payments p join public.fuel_stations s on s.id = p.station_id left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status order by p.created_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_inspections(p_status text DEFAULT 'requested'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.sort_at), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name,
      case when i.kind = 'business' then (select c.slug from public.businesses b join public.categories c on c.id = b.category_id where b.id = i.target_id) end category_slug,
      i.owner_id, coalesce(nullif(p.full_name, ''), '—') owner_name, i.status, i.address, i.phone, i.preferred_time, i.note, i.scheduled_for, i.inspector_name,
      i.checklist, i.admin_note, i.inspected_at, i.valid_until, i.created_at, i.fee_amount, i.pay_method, i.pay_reference, i.pay_proof_path, i.pay_submitted_at, i.paid_at,
      coalesce(i.scheduled_for, i.pay_submitted_at, i.created_at) sort_at
    from public.inspections i left join public.profiles p on p.id = i.owner_id
    where coalesce(p_status, '') = '' or i.status = p_status or (p_status = 'approved' and i.status = 'approved' and i.valid_until > now())
    order by coalesce(i.scheduled_for, i.pay_submitted_at, i.created_at) limit 300) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_listing_claims(p_status text DEFAULT 'escalated'::text)
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, buyer_name text, seller_name text, seller_id uuid, request text, reason text, description text, amount numeric, status text, outcome text, seller_note text, admin_note text, created_at timestamp with time zone, seller_claims bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.ref_no, c.listing_id, c.listing_title, coalesce(nullif(b.full_name, ''), 'Comprador'), coalesce(nullif(s.full_name, ''), 'Vendedor'),
    c.seller_id, c.request, c.reason, c.description, c.amount, c.status, c.outcome, c.seller_note, c.admin_note, c.created_at,
    (select count(*) from public.listing_claims x where x.seller_id = c.seller_id)
  from public.listing_claims c left join public.profiles b on b.id = c.buyer_id left join public.profiles s on s.id = c.seller_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_listings(p_status text DEFAULT NULL::text, p_query text DEFAULT ''::text)
 RETURNS TABLE(id uuid, title text, status text, featured boolean, price numeric, currency text, created_at timestamp with time zone, owner_id uuid, owner_name text, reports bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select l.id, l.title, l.status, l.featured, l.price, l.currency, l.created_at, l.owner_id, p.full_name,
         (select count(*) from public.moderation_reports r where r.target_type = 'classified_listing' and r.target_id = l.id)
  from public.classified_listings l left join public.profiles p on p.id = l.owner_id
  where (p_status is null or l.status = p_status)
    and (coalesce(p_query,'') = '' or lower(l.title) like '%' || lower(p_query) || '%')
  order by l.created_at desc
  limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_order_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, order_id uuid, order_ref text, buyer_id uuid, buyer_name text, buyer_phone text, seller_name text, amount numeric, paid_amount numeric, provider text, method text, status text, entity text, reference text, proof_path text, admin_note text, created_at timestamp with time zone, decided_at timestamp with time zone, order_status text, escrow_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.order_id, public.order_ref(o), p.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), o.contact_phone,
    coalesce(nullif(s.full_name, ''), 'Utilizador'), p.amount, p.paid_amount, p.provider, p.method, p.status, p.entity, p.reference, p.proof_path,
    p.admin_note, p.created_at, p.decided_at, o.status, o.escrow_status
  from public.order_payments p join public.orders o on o.id = p.order_id
  left join public.profiles b on b.id = p.buyer_id left join public.profiles s on s.id = o.seller_id
  where p_status is null or p.status = p_status
  order by p.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_payouts(p_status text DEFAULT 'requested'::text)
 RETURNS TABLE(id uuid, ref_no bigint, user_id uuid, user_name text, phone text, amount numeric, method text, holder_name text, destination text, status text, batch_id uuid, bank_reference text, admin_note text, created_at timestamp with time zone, processed_at timestamp with time zone, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.user_id, coalesce(nullif(pf.full_name, ''), 'Utilizador'), pf.phone, p.amount, p.method, p.holder_name,
    p.destination, p.status, p.batch_id, p.bank_reference, p.admin_note, p.created_at, p.processed_at, p.paid_at
  from public.payout_requests p left join public.profiles pf on pf.id = p.user_id
  where p_status is null or p.status = p_status
  order by p.created_at limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_promo_boosts(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, post_id uuid, post_ref bigint, post_title text, post_kind text, owner_name text, amount numeric, days integer, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select b.id, b.ref_no, b.post_id, p.ref_no, p.title, p.kind, coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.days, b.method,
    b.reference, b.proof_path, b.status, b.admin_note, b.created_at
  from public.promo_boosts b join public.promo_posts p on p.id = b.post_id left join public.profiles pr on pr.id = b.owner_id
  where p_status is null or b.status = p_status order by b.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_promo_posts(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, ref_no bigint, kind text, title text, subject_kind text, subject_id uuid, subject_name text, video_url text, external_url text, status text, hidden_reason text, views integer, featured_until timestamp with time zone, created_at timestamp with time zone, reports bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select x.id, x.ref_no, x.kind, x.title, x.subject_kind, x.subject_id, s.name, x.video_url, x.external_url, x.status, x.hidden_reason, x.views, x.featured_until, x.created_at,
    (select count(*) from public.moderation_reports r where r.target_type = 'promo_post' and r.target_id = x.id and r.status in ('open', 'reviewing'))
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where p_status is null or x.status = p_status
  order by 15 desc, x.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamp with time zone, reporter_name text, listing_title text, listing_status text, listing_owner uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
         p.full_name, l.title, l.status, l.owner_id
  from public.moderation_reports r
  left join public.profiles p on p.id = r.reporter_id
  left join public.classified_listings l on r.target_type = 'classified_listing' and l.id = r.target_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open','reviewing')) desc, r.created_at desc
  limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_reports_v2(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamp with time zone, reporter_name text, target_title text, target_active boolean, target_owner uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, coalesce(nullif(rp.full_name, ''), 'Utilizador'),
    case r.target_type
      when 'classified_listing' then (select l.title from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.name from public.products p where p.id = r.target_id)
      when 'business' then (select b.name from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select coalesce(nullif(u.full_name, ''), 'Utilizador') from public.profiles u where u.id = r.target_id)
      when 'promo_post' then (select x.title from public.promo_posts x where x.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.status not in ('cancelled') from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.active from public.products p where p.id = r.target_id)
      when 'business' then (select b.active from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.active from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select u.status = 'active' from public.profiles u where u.id = r.target_id)
      when 'promo_post' then (select x.status = 'published' from public.promo_posts x where x.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.owner_id from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.seller_id from public.products p where p.id = r.target_id)
      when 'business' then (select b.owner_id from public.businesses b where b.id = r.target_id)
      when 'promo_post' then (select x.owner_id from public.promo_posts x where x.id = r.target_id)
      when 'provider' then r.target_id
      when 'user' then r.target_id
      else null end
  from public.moderation_reports r left join public.profiles rp on rp.id = r.reporter_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open', 'reviewing')) desc, r.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_subscription_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, subscription_id uuid, kind text, subject_id uuid, subject_name text, owner_id uuid, owner_name text, phone text, months integer, amount numeric, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone, active_until timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, s.id, s.kind, coalesce(s.provider_id, s.business_id, s.seller_id), public.plan_subject_name(s),
    p.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone,
    p.months, p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at, public.subscription_active_until(s)
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
  left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status
  order by (p.status = 'pending') desc, p.created_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_query text DEFAULT ''::text)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, municipality text, status text, role text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, listings bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select u.id, u.email::text, p.full_name, p.phone, p.municipality, coalesce(p.status,'active'),
         coalesce((select r.role from public.user_roles r where r.user_id = u.id), 'user'),
         u.created_at, u.last_sign_in_at,
         (select count(*) from public.classified_listings l where l.owner_id = u.id)
  from auth.users u left join public.profiles p on p.id = u.id
  where coalesce(p_query,'') = '' or lower(coalesce(u.email,'') || ' ' || coalesce(p.full_name,'')) like '%' || lower(p_query) || '%'
  order by u.created_at desc
  limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_venue_orders(p_status text DEFAULT 'submitted'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.kind, o.status, o.method, o.subtotal, o.client_fee, o.business_fee, o.total, o.buyer_name, o.buyer_phone, o.reference, o.proof_path,
      o.qr_token, o.note, o.created_at, v.id venue_id, v.ref_no venue_ref, b.name venue_name
    from public.venue_orders o join public.venues v on v.id = o.venue_id join public.businesses b on b.id = v.business_id
    where o.method = 'prepaid' and (coalesce(p_status, '') = '' or o.status = p_status) order by o.created_at desc limit 200) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_venue_payments(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select p.id, p.ref_no, p.venue_id, v.ref_no venue_ref, b.name venue_name, coalesce(nullif(pr.full_name, ''), 'Dono') owner_name, p.amount, p.method, p.reference,
      p.proof_path, p.status, p.admin_note, p.created_at
    from public.venue_platform_payments p join public.venues v on v.id = p.venue_id join public.businesses b on b.id = v.business_id left join public.profiles pr on pr.id = p.owner_id
    where coalesce(p_status, '') = '' or p.status = p_status order by p.created_at limit 300) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_venues(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select v.id, v.ref_no, v.kind, v.subtype, v.status, v.admin_note, v.accepts_prepay, v.created_at, b.id business_id, b.name, b.phone, b.address_text, b.verified,
      coalesce(nullif(pr.full_name, ''), '—') owner_name, (select to_jsonb(y) - 'venue_id' - 'updated_at' from public.venue_pay y where y.venue_id = v.id) pay,
      public.venue_fee_due(v.id) fee_due, public.venue_fees_overdue(v.id) fee_overdue
    from public.venues v join public.businesses b on b.id = v.business_id left join public.profiles pr on pr.id = v.owner_id
    where coalesce(p_status, '') = '' or v.status = p_status order by v.created_at limit 300) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_verifications(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, user_id uuid, user_name text, phone text, kind text, business_id uuid, business_name text, document_path text, note text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select v.id, v.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.phone, v.kind, v.business_id, b.name, v.document_path,
    v.note, v.status, v.admin_note, v.created_at
  from public.verification_requests v left join public.profiles p on p.id = v.user_id left join public.businesses b on b.id = v.business_id
  where p_status is null or v.status = p_status
  order by (v.status = 'pending') desc, v.created_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_verifications_v2(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.pending desc, x.created_at), '[]') from (
    select v.id, v.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador') user_name, p.phone, p.created_at account_created_at, v.kind, v.business_id, b.name business_name,
      v.document_path, v.back_path, v.selfie_path, v.id_number, v.note, v.status, v.admin_note, v.created_at, v.decided_at, v.status = 'pending' pending,
      (select count(*) from public.verification_requests o where o.user_id = v.user_id and o.kind = v.kind and o.status = 'rejected') previous_rejections
    from public.verification_requests v left join public.profiles p on p.id = v.user_id left join public.businesses b on b.id = v.business_id
    where coalesce(p_status, '') = '' or v.status = p_status
    order by (v.status = 'pending') desc, v.created_at limit 200) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_mark_payouts_paid(p_ids uuid[], p_bank_reference text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pr public.payout_requests; n integer := 0; ref text := nullif(left(trim(coalesce(p_bank_reference, '')), 120), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  for pr in update public.payout_requests set status = 'paid', paid_at = now(), bank_reference = coalesce(ref, bank_reference), decided_by = auth.uid()
    where id = any(p_ids) and status in ('requested', 'processing') returning * loop
    n := n + 1;
    insert into public.notifications(user_id, type, title, body, data)
    values (pr.user_id, 'system', 'Levantamento pago 💸', pr.amount || ' Kz foram enviados para ' || pr.destination || ' (L-' || pr.ref_no || ').',
      jsonb_build_object('payout_id', pr.id, 'for', 'wallet'));
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'payout_paid', 'payout', pr.id, jsonb_build_object('amount', pr.amount, 'reference', ref));
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_moderate_listing(p_listing_id uuid, p_status text, p_featured boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status is not null and p_status not in ('draft','published','paused','sold','rented','closed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  update public.classified_listings
     set status = coalesce(p_status, status), featured = coalesce(p_featured, featured)
   where id = p_listing_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_reject_payout(p_payout_id uuid, p_note text)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pr public.payout_requests; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into pr from public.payout_requests where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if pr.status not in ('requested', 'processing') then raise exception 'PAYOUT_ALREADY_DECIDED'; end if;
  update public.payout_requests set status = 'rejected', admin_note = txt, decided_by = auth.uid() where id = pr.id returning * into pr;
  perform public.wallet_add(pr.user_id, null, pr.id, 'available', 'payout_returned', pr.amount, 'Levantamento L-' || pr.ref_no || ' não feito');
  insert into public.notifications(user_id, type, title, body, data)
  values (pr.user_id, 'system', 'Levantamento não feito', txt || ' O dinheiro voltou ao seu saldo.', jsonb_build_object('payout_id', pr.id, 'for', 'wallet'));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout_rejected', 'payout', pr.id, jsonb_build_object('amount', pr.amount, 'note', txt));
  return pr;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_release_escrow(p_order_id uuid, p_note text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ok boolean; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  if exists (select 1 from public.order_disputes where order_id = p_order_id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  ok := public.escrow_release(p_order_id, 'admin', true);
  if not ok then raise exception 'NOTHING_TO_RELEASE'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'escrow_released', 'order', p_order_id, jsonb_build_object('note', txt));
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then raise exception 'INVALID_STATUS'; end if;
  update public.moderation_reports
     set status = p_status,
         resolved_by = case when p_status in ('resolved','dismissed') then auth.uid() else null end,
         resolved_at = case when p_status in ('resolved','dismissed') then now() else null end
   where id = p_report_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_revenue(p_from date, p_to date)
 RETURNS TABLE(paid_at timestamp with time zone, kind text, description text, payer_name text, amount numeric, method text, reference text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_PERIOD'; end if;
  return query
  select p.decided_at, 'plan_' || s.kind, public.plan_subject_name(s) || ' · ' || p.months || case when p.months = 1 then ' mês' else ' meses' end,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), p.amount, p.method, p.reference
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'confirmed' and (p.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select c.decided_at, 'commission', c.listing_title || ' · venda ' || c.sale_amount || ' Kz', coalesce(nullif(pr.full_name, ''), 'Utilizador'), c.amount, c.method, c.reference
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where c.status = 'paid' and (c.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select o.released_at, 'protected_fee', 'Pagamento protegido · ' || public.order_ref(o) || ' · ' || (o.total - o.refunded_amount) || ' Kz',
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), o.platform_fee, null::text, null::text
  from public.orders o left join public.profiles pr on pr.id = o.seller_id
  where o.platform_fee > 0 and (o.released_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select b.decided_at, 'boost', 'Destaque D-' || b.ref_no || ' · ' || l.title || ' · ' || b.days || ' dias', coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.method, b.reference
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles pr on pr.id = b.owner_id
  where b.status in ('active', 'expired') and b.amount > 0 and (b.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select i.paid_at, 'inspection', 'Inspeção I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''), coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         i.fee_amount, i.pay_method, i.pay_reference
  from public.inspections i left join public.profiles pr on pr.id = i.owner_id
  where i.paid_at is not null and i.fee_amount > 0 and (i.paid_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select vp.decided_at, 'venue_fee', 'Taxa de reservas E-' || v.ref_no || ' · ' || bz.name, coalesce(nullif(pr.full_name, ''), 'Utilizador'), vp.amount, vp.method, vp.reference
  from public.venue_platform_payments vp join public.venues v on v.id = vp.venue_id join public.businesses bz on bz.id = v.business_id left join public.profiles pr on pr.id = vp.owner_id
  where vp.status = 'confirmed' and (vp.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_revoke_inspection(p_id uuid, p_note text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.inspections set status = 'revoked', admin_note = txt, updated_at = now() where id = p_id and status = 'approved' returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'inspection_revoked', i.kind, i.target_id, jsonb_build_object('inspection', i.ref_no, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', 'Selo «Inspecionado» retirado', coalesce(public.inspection_target_name(i.kind, i.target_id), '') || ': ' || txt,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_schedule_inspection(p_id uuid, p_when timestamp with time zone, p_inspector text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_when is null or p_when < now() - interval '1 day' then raise exception 'INSPECTION_DATE_REQUIRED'; end if;
  update public.inspections set status = 'scheduled', scheduled_for = p_when, inspector_name = nullif(left(trim(coalesce(p_inspector, '')), 80), ''),
    admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), updated_at = now()
    where id = p_id and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', '🏅 Inspeção marcada', coalesce(public.inspection_target_name(i.kind, i.target_id), '') || ': ' ||
    to_char(i.scheduled_for at time zone 'Africa/Luanda', 'DD/MM "às" HH24:MI') || coalesce(' · ' || i.inspector_name, '') || '. Esteja no local.',
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_courier_status(p_user_id uuid, p_status text)
 RETURNS couriers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.couriers;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  update public.couriers set status = p_status, updated_at = now() where user_id = p_user_id returning * into c;
  if not found then raise exception 'NOT_COURIER'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (p_user_id, 'delivery', case p_status when 'approved' then 'Conta de estafeta aprovada' else 'Conta de estafeta suspensa' end,
    case p_status when 'approved' then 'Já pode aceitar entregas no Huambo Online.' else 'Contacte a administração para mais informações.' end,
    jsonb_build_object('for', 'courier'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_fuel_station_status(p_station_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS fuel_stations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'suspended' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.fuel_stations set status = p_status, admin_note = txt where id = p_station_id returning * into s;
  if not found then raise exception 'FUEL_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', case p_status when 'approved' then '⛽ Posto aprovado ✔' when 'suspended' then 'Posto suspenso' else 'Posto à espera de revisão' end,
    s.name || case p_status when 'approved' then ': já aparece em «Combustível e gás». Marque quando houver!' else coalesce(': ' || txt, '') end,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fuel_station_' || p_status, 'fuel_station', s.id, jsonb_build_object('note', txt));
  return s;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_promo_hidden(p_id uuid, p_hidden boolean, p_reason text DEFAULT NULL::text)
 RETURNS promo_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.promo_posts;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_hidden and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
  update public.promo_posts set status = case when p_hidden then 'hidden' else 'published' end, hidden_reason = case when p_hidden then trim(p_reason) end, updated_at = now()
   where id = p_id returning * into p;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_hidden then
    insert into public.notifications(user_id, type, title, body, data)
    values (p.owner_id, 'system', 'Vídeo escondido pela administração', '«' || p.title || '»: ' || trim(p_reason), jsonb_build_object('for', 'promo', 'post_id', p.id));
  end if;
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_target_active(p_target_type text, p_target_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_target_type = 'product' then update public.products set active = p_active where id = p_target_id;
  elsif p_target_type = 'business' then update public.businesses set active = p_active where id = p_target_id;
  elsif p_target_type = 'provider' then update public.provider_profiles set active = p_active where user_id = p_target_id;
  else raise exception 'INVALID_TARGET'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_active then 'show' else 'hide' end, p_target_type, p_target_id, '{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_role not in ('user','moderator','admin') then raise exception 'INVALID_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  insert into public.user_roles(user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
end $function$
;
