CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'INVALID_STATUS'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  update public.profiles set status = p_status where id = p_user_id;
  if p_status <> 'active' then
    update public.classified_listings set status = 'paused' where owner_id = p_user_id and status = 'published';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_venue_status(p_venue_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS venues
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'suspended' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.venues set status = p_status, admin_note = txt where id = p_venue_id returning * into v;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  select name into bname from public.businesses where id = v.business_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', case p_status when 'approved' then 'Estabelecimento aprovado ✔' when 'suspended' then 'Estabelecimento suspenso' else 'Estabelecimento à espera de revisão' end,
    bname || case p_status when 'approved' then ': já recebe reservas e encomendas.' else coalesce(': ' || txt, '') end,
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'venue_' || p_status, 'venue', v.id, jsonb_build_object('note', txt));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_start_payout_batch()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b uuid := gen_random_uuid(); n integer;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.payout_requests set status = 'processing', batch_id = b, processed_at = now(), decided_by = auth.uid() where status = 'requested';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NO_PAYOUTS'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout_batch_started', 'payout_batch', b, jsonb_build_object('count', n));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status <> 'active'),
    'listings_published', (select count(*) from public.classified_listings where status = 'published'),
    'listings_total', (select count(*) from public.classified_listings),
    'listings_7d', (select count(*) from public.classified_listings where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.moderation_reports where status in ('open', 'reviewing')),
    'conversations', (select count(*) from public.conversations),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'products_active', (select count(*) from public.products where active),
    'providers', (select count(*) from public.provider_profiles where active),
    'businesses', (select count(*) from public.businesses where active),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
    'orders_completed_30d', (select count(*) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'sales_value_30d', (select coalesce(sum(total), 0) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'services_30d', (select count(*) from public.service_requests where created_at > now() - interval '30 days'),
    'services_done_30d', (select count(*) from public.service_requests where status in ('done', 'confirmed') and updated_at > now() - interval '30 days'),
    'deals_30d', (select count(*) from public.classified_listings where deal_at > now() - interval '30 days'),
    'reviews_30d', (select count(*) from public.user_reviews where created_at > now() - interval '30 days')
                  + (select count(*) from public.reviews where created_at > now() - interval '30 days'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'disputes_open', (select count(*) from public.order_disputes where status <> 'resolved'),
    'disputes_escalated', (select count(*) from public.order_disputes where status = 'escalated'),
    'refunds_30d', (select coalesce(sum(amount), 0) from public.order_disputes where outcome = 'refunded' and resolved_at > now() - interval '30 days'),
    'plans_trial', (select count(*) from public.subscriptions s where s.trial_ends_at > now() and (s.paid_until is null or s.paid_until <= now())),
    'plans_paid', (select count(*) from public.subscriptions s where s.paid_until > now()),
    'plans_expired', (select count(*) from public.subscriptions s where public.subscription_active_until(s) <= now()),
    'plan_payments_pending', (select count(*) from public.subscription_payments where status = 'pending'),
    'plan_revenue_30d', (select coalesce(sum(amount), 0) from public.subscription_payments where status = 'confirmed' and decided_at > now() - interval '30 days')
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_commission(p_id uuid, p_action text, p_note text DEFAULT NULL::text, p_sale_amount numeric DEFAULT NULL::numeric)
 RETURNS listing_commissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_commissions; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into c from public.listing_commissions where id = p_id for update;
  if not found then raise exception 'COMMISSION_NOT_FOUND'; end if;
  if p_action = 'confirm' and c.status in ('submitted', 'due') then
    update public.listing_commissions set status = 'paid', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'reject' and c.status = 'submitted' then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_commissions set status = 'due', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'waive' and c.status in ('due', 'submitted') then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_commissions set status = 'waived', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'adjust' and c.status in ('due', 'submitted') then
    if p_sale_amount is null or p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
    update public.listing_commissions set sale_amount = p_sale_amount, amount = round(p_sale_amount * rate_pct / 100), admin_note = coalesce(txt, admin_note)
     where id = c.id returning * into c;
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'commission_' || p_action, 'classified_listing', c.listing_id, jsonb_build_object('commission_id', c.id, 'amount', c.amount, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (c.owner_id, 'system',
    case p_action when 'confirm' then 'Comissão paga ✔' when 'reject' then 'Pagamento da comissão não confirmado' when 'waive' then 'Comissão anulada' else 'Comissão corrigida' end,
    '«' || c.listing_title || '»: ' || case p_action when 'confirm' then 'pagamento de ' || c.amount || ' Kz confirmado.' when 'adjust' then 'nova comissão ' || c.amount || ' Kz.' else coalesce(txt, '') end,
    jsonb_build_object('listing_id', c.listing_id, 'for', 'commission'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_commission_create(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; a public.field_agents; st public.platform_settings; offer_amt numeric; amt numeric; fee numeric;
begin
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.agent_id is null or l.status <> 'sold' or l.purpose not in ('sale', 'auction') then return; end if;
  if exists (select 1 from public.agent_commissions where listing_id = l.id and status <> 'cancelled') then return; end if;
  select * into a from public.field_agents where user_id = l.agent_id;
  if not found or a.status <> 'active' or a.user_id = l.owner_id then return; end if;
  select * into st from public.platform_settings where id = 1;
  if l.deal_with is not null then
    select o.amount into offer_amt from public.listing_offers o where o.listing_id = l.id and o.buyer_id = l.deal_with and o.status = 'accepted' and o.amount is not null
     order by o.responded_at desc nulls last limit 1;
  end if;
  amt := coalesce(l.sale_amount, offer_amt, l.price);
  if amt is null or amt <= 0 or st.agent_sale_pct <= 0 then return; end if;
  fee := round(amt * st.agent_sale_pct / 100);
  if fee <= 0 then return; end if;
  insert into public.agent_commissions(agent_id, listing_id, listing_title, owner_id, amount, sale_amount, rate_pct)
  values (a.user_id, l.id, left(l.title, 200), l.owner_id, fee, amt, st.agent_sale_pct);
  insert into public.notifications(user_id, type, title, body, data)
  values (a.user_id, 'system', 'Venda! 🎉', '«' || left(l.title, 120) || '» foi vendido por ' || amt || ' Kz. A sua comissão de ' || fee
    || ' Kz está à espera de confirmação.', jsonb_build_object('for', 'agent'));
end $function$
;

CREATE OR REPLACE FUNCTION public.angola_iban_digits(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare s text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if s ~ '^AO06[0-9]{21}$' then s := substr(s, 5); end if;
  if s !~ '^[0-9]{21}$' then return null; end if;
  if mod((s || '102406')::numeric, 97) <> 1 then return null; end if;
  return s;
end $function$
;

CREATE OR REPLACE FUNCTION public.angola_today()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ select (now() at time zone 'Africa/Luanda')::date $function$
;

CREATE OR REPLACE FUNCTION public.apply_field_agent(p_market_id uuid, p_full_name text, p_phone text, p_note text DEFAULT NULL::text)
 RETURNS field_agents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.field_agents; me uuid := auth.uid(); ph text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 3 then raise exception 'NAME_REQUIRED'; end if;
  if char_length(ph) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if p_market_id is null or not exists (select 1 from public.markets where id = p_market_id and status = 'active') then raise exception 'MARKET_REQUIRED'; end if;
  select * into a from public.field_agents where user_id = me for update;
  if not found then
    insert into public.field_agents(user_id, market_id, full_name, phone, note)
    values (me, p_market_id, trim(p_full_name), ph, nullif(left(trim(coalesce(p_note, '')), 500), '')) returning * into a;
    perform public.notify_staff('Pedido para ser agente', a.full_name || ' · ' || a.code, jsonb_build_object('agent_id', me));
  elsif a.status = 'suspended' then raise exception 'AGENT_SUSPENDED';
  else
    update public.field_agents set market_id = p_market_id, full_name = trim(p_full_name), phone = ph,
      note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      status = case when a.status = 'rejected' then 'pending' else a.status end
    where user_id = me returning * into a;
    if a.status = 'pending' then perform public.notify_staff('Pedido para ser agente', a.full_name || ' · ' || a.code, jsonb_build_object('agent_id', me)); end if;
  end if;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.apply_notification_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.notification_preferences;
begin
  select * into p from public.notification_preferences where user_id = new.user_id;
  if not found then return new; end if;
  if not p.enabled then return null; end if;
  if (new.type = 'saved_search' and not p.saved_search) or (new.type = 'message' and not p.messages)
     or (new.type in ('auction','bid') and not p.auctions) or (new.type in ('order','delivery') and not p.marketplace)
     or (new.type = 'review' and not p.reviews) or (new.type = 'system' and not p.system) then
    return null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.assign_delivery(p_delivery_id uuid, p_assignee uuid)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.delivery_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into v from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v.status not in ('pending','assigned') then raise exception 'DELIVERY_NOT_ASSIGNABLE'; end if;
  update public.delivery_requests set assigned_to = p_assignee, status = 'assigned', assigned_at = now() where id = p_delivery_id returning * into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_bids_for(p_auction_id uuid)
 RETURNS TABLE(id uuid, bidder_label text, amount numeric, created_at timestamp with time zone, is_mine boolean, retracted boolean, retract_reason text, retracted_by_seller boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; see_names boolean;
begin
  select * into a from public.auctions where auctions.id = p_auction_id;
  if not found or (a.status not in ('live', 'ended') and a.seller_id is distinct from auth.uid() and not public.has_admin_role()) then raise exception 'AUCTION_NOT_FOUND'; end if;
  see_names := a.seller_id = auth.uid() or public.has_admin_role();
  return query
  with ranked as (
    select b.*, dense_rank() over (order by first_bid.first_at, b.bidder_id) as n
    from public.auction_bids b
    join (select x.bidder_id, min(x.created_at) first_at from public.auction_bids x where x.auction_id = a.id group by x.bidder_id) first_bid on first_bid.bidder_id = b.bidder_id
    where b.auction_id = a.id)
  select r.id,
    case when r.bidder_id = auth.uid() then 'Você'
         when see_names then coalesce(nullif((select p.full_name from public.profiles p where p.id = r.bidder_id), ''), 'Licitador ' || r.n)
         else 'Licitador ' || r.n end,
    r.amount, r.created_at, r.bidder_id = auth.uid(), r.retracted_at is not null,
    case when r.retracted_at is not null then r.retract_reason end, r.retracted_by is not null and r.retracted_by <> r.bidder_id
  from ranked r order by r.amount desc, r.created_at asc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_bids_for_v2(p_auction_id uuid)
 RETURNS TABLE(id uuid, bidder_label text, amount numeric, created_at timestamp with time zone, is_mine boolean, is_auto boolean, retracted boolean, retract_reason text, retracted_by_seller boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; see_names boolean;
begin
  select * into a from public.auctions where auctions.id = p_auction_id;
  if not found or (a.status not in ('live', 'ended') and a.seller_id is distinct from auth.uid() and not public.has_admin_role()) then raise exception 'AUCTION_NOT_FOUND'; end if;
  see_names := a.seller_id = auth.uid() or public.has_admin_role();
  return query
  with ranked as (
    select b.*, dense_rank() over (order by first_bid.first_at, b.bidder_id) as n
    from public.auction_bids b
    join (select x.bidder_id, min(x.created_at) first_at from public.auction_bids x where x.auction_id = a.id group by x.bidder_id) first_bid on first_bid.bidder_id = b.bidder_id
    where b.auction_id = a.id)
  select r.id,
    case when r.bidder_id = auth.uid() then 'Você'
         when see_names then coalesce(nullif((select p.full_name from public.profiles p where p.id = r.bidder_id), ''), 'Licitador ' || r.n)
         else 'Licitador ' || r.n end,
    r.amount, r.created_at, r.bidder_id = auth.uid(), r.is_auto, r.retracted_at is not null,
    case when r.retracted_at is not null then r.retract_reason end, r.retracted_by is not null and r.retracted_by <> r.bidder_id
  from ranked r order by r.created_at desc, r.amount desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_drop_bidder(a auctions, p_bidder uuid, p_by uuid, p_reason text)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare before record; after record;
begin
  select * into before from public.auction_standing(a.id);
  update public.auction_max_bids set retracted_at = now(), retracted_by = p_by, retract_reason = p_reason
   where auction_id = a.id and bidder_id = p_bidder and retracted_at is null;
  update public.auction_bids set retracted_at = now(), retracted_by = p_by, retract_reason = p_reason
   where auction_id = a.id and bidder_id = p_bidder and retracted_at is null;
  select * into after from public.auction_standing(a.id);
  update public.auctions set current_price = after.price, updated_at = now() where id = a.id returning * into a;
  if after.leader is not null and after.leader is distinct from before.leader then
    insert into public.auction_bids(auction_id, bidder_id, amount, is_auto) values (a.id, after.leader, after.price, true);
    insert into public.notifications(user_id, type, title, body, data)
    values (after.leader, 'bid', 'Voltou a ganhar o leilão', 'Um lance maior foi retirado em «' || a.title || '». Está a ganhar com ' || after.price || ' Kz.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_for_listing(p_listing_id uuid)
 RETURNS TABLE(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, min_increment numeric, current_price numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or coalesce((select s.leader_max from public.auction_standing(a.id) s), 0) >= a.reserve_price),
         public.auction_increment(a.current_price, a.min_increment), a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select m.max_amount from public.auction_max_bids m where m.auction_id = a.id and m.bidder_id = auth.uid() and m.retracted_at is null),
         coalesce((select s.leader = auth.uid() from public.auction_standing(a.id) s), false)
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.auction_for_listing_v2(p_listing_id uuid)
 RETURNS TABLE(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, has_reserve boolean, min_increment numeric, current_price numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean, buy_now_price numeric, buy_now_available boolean, bought_now boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or coalesce((select s.leader_max from public.auction_standing(a.id) s), 0) >= a.reserve_price), a.reserve_price is not null,
         public.auction_increment(a.current_price, a.min_increment), a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select m.max_amount from public.auction_max_bids m where m.auction_id = a.id and m.bidder_id = auth.uid() and m.retracted_at is null),
         coalesce((select s.leader = auth.uid() from public.auction_standing(a.id) s), false),
         a.buy_now_price,
         a.buy_now_price is not null and a.status = 'live' and now() < a.ends_at
           and not exists (select 1 from public.auction_max_bids m where m.auction_id = a.id and m.retracted_at is null),
         a.bought_now
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.auction_increment(p_price numeric, p_min numeric DEFAULT 0)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select greatest(coalesce(p_min, 0), case
    when p_price < 1000 then 50 when p_price < 5000 then 100 when p_price < 25000 then 250 when p_price < 100000 then 500
    when p_price < 250000 then 1000 when p_price < 1000000 then 2500 when p_price < 5000000 then 5000 else 10000 end);
$function$
;

CREATE OR REPLACE FUNCTION public.auction_mark_listing_sold()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'ended' and old.status is distinct from 'ended' and new.winner_id is not null and new.classified_listing_id is not null then
    update public.classified_listings set sale_amount = new.current_price, deal_with = coalesce(deal_with, new.winner_id), deal_at = coalesce(deal_at, now()), status = 'sold'
     where id = new.classified_listing_id and status <> 'sold';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_recalc(p_auction_id uuid)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions;
begin
  update public.auctions x set current_price = coalesce((select max(b.amount) from public.auction_bids b where b.auction_id = x.id and b.retracted_at is null), x.starting_price),
    updated_at = now()
   where x.id = p_auction_id returning * into a;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_standing(p_auction_id uuid, OUT leader uuid, OUT leader_max numeric, OUT price numeric)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; second_max numeric;
begin
  select * into a from public.auctions where id = p_auction_id;
  select m.bidder_id, m.max_amount into leader, leader_max from public.auction_max_bids m
   where m.auction_id = p_auction_id and m.retracted_at is null order by m.max_amount desc, m.max_set_at asc limit 1;
  if leader is null then price := a.starting_price; return; end if;
  select m.max_amount into second_max from public.auction_max_bids m
   where m.auction_id = p_auction_id and m.retracted_at is null order by m.max_amount desc, m.max_set_at asc offset 1 limit 1;
  price := case when second_max is null then a.starting_price
                else least(leader_max, second_max + public.auction_increment(second_max, a.min_increment)) end;
  if a.reserve_price is not null and leader_max >= a.reserve_price then price := greatest(price, a.reserve_price); end if;
  price := least(greatest(price, a.starting_price), leader_max);
end $function$
;

CREATE OR REPLACE FUNCTION public.audit_admin_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n jsonb := to_jsonb(new); o jsonb := to_jsonb(old); owner text; changes jsonb := '{}'::jsonb; k text;
begin
  if auth.uid() is null or not public.has_admin_role() then return new; end if;
  owner := coalesce(n->>'owner_id', n->>'user_id', case when tg_table_name = 'profiles' then n->>'id' end);
  if owner is not null and owner = auth.uid()::text and tg_table_name <> 'user_roles' then return new; end if;
  foreach k in array array['status', 'role', 'featured', 'active', 'verified', 'kyc_level'] loop
    if n ? k and (o is null or (n->k) is distinct from (o->k)) then changes := changes || jsonb_build_object(k, n->k); end if;
  end loop;
  if changes = '{}'::jsonb then return new; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'update', tg_table_name, coalesce((n->>'id')::uuid, (n->>'user_id')::uuid), changes);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.available_deliveries()
 RETURNS TABLE(id uuid, order_id uuid, requested_at timestamp with time zone, notes text, total numeric, currency text, delivery_text text, seller_name text, seller_municipality text, items jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_approved_courier() then raise exception 'NOT_APPROVED_COURIER'; end if;
  return query select d.id, d.order_id, d.requested_at, d.notes, o.total, o.currency, o.delivery_text,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), sp.municipality,
    (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity) order by p.name), '[]')
       from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id
  where d.status = 'pending' and o.seller_id <> auth.uid() and o.buyer_id <> auth.uid()
  order by d.requested_at limit 100;
end $function$
;

CREATE OR REPLACE FUNCTION public.boost_expire()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l record; n integer := 0;
begin
  perform set_config('huambo.allow_feature', 'on', true);
  for l in update public.classified_listings set featured = false, featured_until = null
      where featured_until is not null and featured_until <= now() returning id, owner_id, title loop
    n := n + 1;
    insert into public.notifications(user_id, type, title, body, data)
    values (l.owner_id, 'system', 'O destaque terminou', '«' || l.title || '» já não está em destaque. Pode destacar outra vez em «Os meus anúncios».',
      jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  end loop;
  perform set_config('huambo.allow_feature', '', true);
  update public.listing_boosts set status = 'expired' where status = 'active' and ends_at <= now();
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.business_directory(p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, owner_id uuid, name text, description text, category_id uuid, category_name text, municipality_id uuid, municipality_name text, phone text, whatsapp text, logo_url text, address_text text, verified boolean, rating numeric, review_count bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select b.id, b.owner_id, b.name, b.description, b.category_id, coalesce(c.name, b.custom_category), b.municipality_id, m.name,
         b.phone, b.whatsapp, b.logo_url, b.address_text, b.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id), b.created_at
  from public.businesses b
  left join public.categories c on c.id = b.category_id
  left join public.municipalities m on m.id = b.municipality_id
  left join public.reviews r on r.business_id = b.id and r.status = 'published'
  where b.active
    and (p_category_id is null or b.category_id = p_category_id)
    and (p_municipality_id is null or b.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', b.name, b.description, b.custom_category, c.name)) like '%' || public.fold_text(trim(p_query)) || '%')
  group by b.id, c.name, m.name
  order by b.verified desc, count(distinct r.id) desc, b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.business_stats(p_business_id uuid)
 RETURNS TABLE(rating numeric, review_count bigint, confirmed_reviews bigint, services_requested bigint, services_done bigint, sales_done bigint, member_since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select round(avg(rating)::numeric, 1) from public.reviews where business_id = p_business_id and status = 'published'),
    (select count(*) from public.reviews where business_id = p_business_id and status = 'published'),
    (select count(*) from public.reviews where business_id = p_business_id and status = 'published' and service_request_id is not null),
    (select count(*) from public.service_requests where business_id = p_business_id),
    (select count(*) from public.service_requests where business_id = p_business_id and status in ('done', 'confirmed')),
    (select count(*) from public.orders o join public.businesses b on b.owner_id = o.seller_id where b.id = p_business_id and o.status = 'completed'),
    (select created_at from public.businesses where id = p_business_id);
$function$
;

CREATE OR REPLACE FUNCTION public.buy_auction_now(p_auction_id uuid)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  if a.buy_now_price is null then raise exception 'BUY_NOW_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'BUY_NOW_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_by is not null and retracted_by <> auth.uid()) then raise exception 'BIDDER_BLOCKED'; end if;
  update public.auctions set status = 'ended', winner_id = auth.uid(), current_price = buy_now_price, bought_now = true, ends_at = greatest(now(), starts_at + interval '1 second'), updated_at = now()
   where id = a.id returning * into a;
  insert into public.notifications(user_id, type, title, body, data)
  values (auth.uid(), 'auction', 'Comprou já! 🎉', 'Comprou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor para combinar a entrega.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id)),
         (a.seller_id, 'auction', 'Vendido com «Comprar já»', '«' || a.title || '» foi comprado por ' || a.current_price || ' Kz. O comprador vai contactá-lo.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.buyer_listing_claim(p_claim_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found or c.buyer_id <> auth.uid() then raise exception 'CLAIM_NOT_FOUND'; end if;
  if p_action = 'confirm' and c.status in ('accepted', 'open', 'escalated', 'declined') then
    update public.listing_claims set status = 'resolved', outcome = 'done', resolved_at = now(), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'withdraw' and c.status <> 'resolved' then
    update public.listing_claims set status = 'resolved', outcome = 'withdrawn', resolved_at = now(), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'escalate' and (c.status = 'declined' or (c.status in ('open', 'accepted') and (c.respond_by < now() or c.status = 'accepted'))) then
    update public.listing_claims set status = 'escalated', admin_note = coalesce(admin_note, txt), updated_at = now() where id = c.id returning * into c;
    perform public.notify_staff('Reclamação de anúncio para decidir', 'R-' || c.ref_no || ' · ' || left(c.listing_title, 100), jsonb_build_object('claim_id', c.id));
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (c.seller_id, 'system', case p_action when 'confirm' then 'Reclamação resolvida ✔' when 'withdraw' then 'Reclamação retirada' else 'Reclamação enviada à administração' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || ')' || case when txt is not null then ': ' || txt else '.' end, jsonb_build_object('for', 'claim'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_delivery_request(p_delivery_id uuid)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.delivery_requests;
begin
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.requester_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  if d.status not in ('pending', 'assigned', 'accepted') then raise exception 'DELIVERY_IN_PROGRESS'; end if;
  update public.delivery_requests set status = 'cancelled' where id = d.id returning * into d;
  if d.assigned_to is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (d.assigned_to, 'delivery', 'Entrega cancelada', 'O vendedor cancelou o pedido de entrega.', jsonb_build_object('delivery_id', d.id, 'for', 'courier'));
  end if;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id uuid, p_reason text)
 RETURNS events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into e from public.events where id = p_event_id for update;
  if not found or (e.organizer_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('huambo.allow_cancel', 'on', true);
  update public.events set status = 'cancelled', cancel_reason = txt where id = e.id returning * into e;
  perform set_config('huambo.allow_cancel', '', true);
  update public.event_tickets set status = 'void' where event_id = e.id and status = 'valid';
  update public.event_orders set status = 'cancelled', decided_at = now() where event_id = e.id and status in ('reserved', 'submitted');
  insert into public.notifications(user_id, type, title, body, data)
  select distinct o.buyer_id, 'system', 'Evento cancelado', '«' || left(e.title, 80) || '» foi cancelado: ' || txt || ' Se já pagou, o organizador tem de devolver o dinheiro.',
    jsonb_build_object('for', 'tickets', 'event_id', e.id)
  from public.event_orders o where o.event_id = e.id and o.status in ('confirmed', 'cancelled');
  return e;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_event_ticket_order(p_order_id uuid)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.event_orders;
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  if o.status not in ('reserved', 'submitted', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  update public.event_orders set status = 'cancelled', decided_at = now() where id = o.id returning * into o;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_fuel_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid(); txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if o.buyer_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  elsif s.owner_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
  else raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  update public.fuel_orders set status = 'cancelled', note = coalesce(txt, note), updated_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when o.buyer_id = me then s.owner_id else o.buyer_id end, 'system', '⛽ Pedido cancelado',
    'C-' || o.ref_no || ' · ' || s.name || coalesce(': ' || txt, '') || case when s.owner_id = me and o.status = 'cancelled' and o.method = 'prepaid' and o.reference is not null then ' O posto deve devolver o dinheiro.' else '' end,
    jsonb_build_object('for', case when o.buyer_id = me then 'fuel_station' else 'fuel_orders' end, 'station_id', s.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_inspection(p_id uuid)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections;
begin
  update public.inspections set status = 'cancelled', updated_at = now()
    where id = p_id and owner_id = auth.uid() and (status = 'awaiting_payment' or (fee_amount = 0 and status in ('requested', 'scheduled'))) returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  return i;
end $function$
;
