CREATE OR REPLACE FUNCTION public.product_paid_up(p_seller uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_business is not null then public.subject_paid_up(null, p_business) else public.store_paid_up(p_seller) end;
$function$
;

CREATE OR REPLACE FUNCTION public.promo_feed(p_kind text DEFAULT NULL::text, p_subject_kind text DEFAULT NULL::text, p_subject_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, ref_no bigint, subject_kind text, subject_id uuid, subject_name text, subject_picture text, kind text, title text, description text, video_url text, external_url text, cover_url text, live_starts_at timestamp with time zone, live_ends_at timestamp with time zone, live_state text, featured boolean, views integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.ref_no, x.subject_kind, x.subject_id, s.name, s.picture, x.kind, x.title, x.description, x.video_url, x.external_url, x.cover_url,
    x.live_starts_at, x.live_ends_at,
    case when x.kind <> 'live' then null when now() < x.live_starts_at then 'upcoming' when now() <= x.live_ends_at then 'live' else 'ended' end,
    coalesce(x.featured_until > now(), false), x.views, x.created_at
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where x.status = 'published' and s.visible
    and (p_kind is null or x.kind = p_kind)
    and (p_subject_kind is null or (x.subject_kind = p_subject_kind and x.subject_id = p_subject_id))
    and (x.kind <> 'live' or x.live_ends_at > now() - interval '3 days' or p_subject_id is not null)
  order by (x.kind = 'live' and now() between x.live_starts_at and x.live_ends_at) desc,
    coalesce(x.featured_until > now(), false) desc,
    (x.kind = 'live' and now() < x.live_starts_at) desc,
    case when x.kind = 'live' and now() < x.live_starts_at then x.live_starts_at end asc,
    x.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.promo_notify_followers(p promo_posts, p_source text, p_title text, p_body text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public.notify_followers(
    case p.subject_kind
      when 'provider' then array(select user_id from public.followed_providers where provider_id = p.subject_id)
      when 'business' then array(select user_id from public.followed_businesses where business_id = p.subject_id)
      else array(select user_id from public.followed_sellers where seller_id = p.subject_id) end,
    p_source, p_title, p_body, jsonb_build_object('post_id', p.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.promo_subject(p_kind text, p_id uuid, OUT owner uuid, OUT name text, OUT picture text, OUT visible boolean)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_kind = 'provider' then
    select pp.user_id, pp.display_name, pp.avatar_url, pp.active and public.subject_paid_up(pp.user_id, null) into owner, name, picture, visible
      from public.provider_profiles pp where pp.user_id = p_id;
  elsif p_kind = 'business' then
    select b.owner_id, b.name, b.logo_url, b.active and public.subject_paid_up(null, b.id) into owner, name, picture, visible
      from public.businesses b where b.id = p_id;
  elsif p_kind = 'store' then
    select pr.id, coalesce(nullif(pr.full_name, ''), 'Loja'), pr.avatar_url, pr.status = 'active' and public.store_paid_up(pr.id) into owner, name, picture, visible
      from public.profiles pr where pr.id = p_id and exists (select 1 from public.subscriptions s where s.seller_id = pr.id and s.kind = 'store');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.promo_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.promo_posts; s record; n integer := 0;
begin
  for p in select * from public.promo_posts where kind = 'live' and status = 'published' and not live_notified
             and live_starts_at <= now() + interval '5 minutes' and live_ends_at > now() for update skip locked loop
    select * into s from public.promo_subject(p.subject_kind, p.subject_id);
    if s.visible then perform public.promo_notify_followers(p, 'live:' || p.id, '🔴 ' || s.name || ' está em direto agora', p.title); end if;
    update public.promo_posts set live_notified = true where id = p.id;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.provider_confirm_payment(p_reference text, p_amount numeric, p_provider_payment_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.order_payments;
begin
  if p_provider_payment_id is null or p_reference is null then return 'invalid'; end if;
  if exists (select 1 from public.order_payments where provider_payment_id = p_provider_payment_id) then return 'duplicate'; end if;
  select * into pay from public.order_payments where provider = 'proxypay' and reference = p_reference and status in ('pending', 'expired')
   order by created_at desc limit 1 for update;
  if not found then
    perform public.notify_staff('Pagamento ProxyPay sem encomenda', p_amount || ' Kz · referência ' || p_reference, jsonb_build_object('reference', p_reference));
    return 'unknown_reference';
  end if;
  if p_amount < pay.amount then
    update public.order_payments set paid_amount = p_amount, provider_payment_id = p_provider_payment_id,
      admin_note = 'Pagou ' || p_amount || ' Kz em vez de ' || pay.amount || ' Kz.' where id = pay.id;
    perform public.notify_staff('Pagamento com valor errado', p_amount || ' Kz em vez de ' || pay.amount || ' Kz · referência ' || p_reference,
      jsonb_build_object('payment_id', pay.id, 'order_id', pay.order_id));
    return 'amount_mismatch';
  end if;
  perform public.escrow_mark_paid(pay.id, p_amount, p_provider_payment_id);
  return 'ok';
end $function$
;

CREATE OR REPLACE FUNCTION public.provider_directory(p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE(user_id uuid, display_name text, headline text, bio text, category_id uuid, category_name text, municipality_id uuid, municipality_name text, phone text, whatsapp text, avatar_url text, verified boolean, rating numeric, review_count bigint, services_count bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select p.user_id, p.display_name, p.headline, p.bio, p.category_id, coalesce(c.name, p.custom_category), p.municipality_id, m.name,
         p.phone, p.whatsapp, p.avatar_url, p.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id),
         (select count(*) from public.services s where s.provider_id = p.user_id and s.active), p.created_at
  from public.provider_profiles p
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  left join public.reviews r on r.provider_id = p.user_id and r.status = 'published'
  where p.active
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', p.display_name, p.headline, p.bio, p.custom_category, c.name)) like '%' || public.fold_text(trim(p_query)) || '%'
         or exists (select 1 from public.services s where s.provider_id = p.user_id and s.active and public.fold_text(s.title) like '%' || public.fold_text(trim(p_query)) || '%'))
  group by p.user_id, c.name, m.name
  order by p.verified desc, count(distinct r.id) desc, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.provider_register_reference(p_order_id uuid, p_entity text, p_reference text, p_amount numeric, p_expires_at timestamp with time zone)
 RETURNS order_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; pay public.order_payments;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  if p_amount <> o.total then raise exception 'INVALID_AMOUNT'; end if;
  update public.order_payments set status = 'expired' where order_id = o.id and status = 'pending' and provider = 'proxypay';
  if exists (select 1 from public.order_payments where order_id = o.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.order_payments(order_id, buyer_id, amount, provider, method, entity, reference, expires_at)
  values (o.id, o.buyer_id, o.total, 'proxypay', 'reference', p_entity, p_reference, p_expires_at) returning * into pay;
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.public_seller(p_user_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, municipality text, member_since timestamp with time zone, listings bigint, products bigint, is_provider boolean, rating numeric, review_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.full_name, p.avatar_url, p.municipality, p.created_at,
         (select count(*) from public.classified_listings l where l.owner_id = p.id and l.status = 'published'),
         (select count(*) from public.products x where x.seller_id = p.id and x.active),
         exists (select 1 from public.provider_profiles pp where pp.user_id = p.id and pp.active),
         (select coalesce(round(avg(r.rating)::numeric, 1), 0) from public.reviews r where r.provider_id = p.id and r.status = 'published'),
         (select count(*) from public.reviews r where r.provider_id = p.id and r.status = 'published')
  from public.profiles p where p.id = p_user_id and p.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.public_trust_signals(p_user_id uuid)
 RETURNS TABLE(identity_verified boolean, phone_verified boolean, provider_verified boolean, businesses_verified bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select kyc_level >= 1 from public.profiles where id = p_user_id), false),
         coalesce((select phone_verified from public.profiles where id = p_user_id), false),
         coalesce((select verified from public.provider_profiles where user_id = p_user_id), false),
         (select count(*) from public.businesses where owner_id = p_user_id and verified and active);
$function$
;

CREATE OR REPLACE FUNCTION public.public_user_stats(p_user_id uuid)
 RETURNS TABLE(seller_rating numeric, seller_reviews bigint, buyer_rating numeric, buyer_reviews bigint, sales_done bigint, purchases_done bigint, listings_sold bigint, listings_active bigint, services_requested bigint, services_done bigint, service_rating numeric, service_reviews bigint, member_since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select round(avg(rating)::numeric, 1) from public.user_reviews where target_id = p_user_id and role = 'seller' and status = 'published'),
    (select count(*) from public.user_reviews where target_id = p_user_id and role = 'seller' and status = 'published'),
    (select round(avg(rating)::numeric, 1) from public.user_reviews where target_id = p_user_id and role = 'buyer' and status = 'published'),
    (select count(*) from public.user_reviews where target_id = p_user_id and role = 'buyer' and status = 'published'),
    (select count(*) from public.orders where seller_id = p_user_id and status = 'completed'),
    (select count(*) from public.orders where buyer_id = p_user_id and status = 'completed')
      + (select count(*) from public.classified_listings where deal_with = p_user_id and purpose <> 'wanted')
      + (select count(*) from public.classified_listings where owner_id = p_user_id and purpose = 'wanted' and deal_with is not null),
    (select count(*) from public.classified_listings where owner_id = p_user_id and purpose <> 'wanted' and status in ('sold', 'rented'))
      + (select count(*) from public.classified_listings where deal_with = p_user_id and purpose = 'wanted'),
    (select count(*) from public.classified_listings where owner_id = p_user_id and status = 'published'),
    (select count(*) from public.service_requests where provider_id = p_user_id),
    (select count(*) from public.service_requests where provider_id = p_user_id and status in ('done', 'confirmed')),
    (select round(avg(rating)::numeric, 1) from public.reviews where provider_id = p_user_id and status = 'published'),
    (select count(*) from public.reviews where provider_id = p_user_id and status = 'published'),
    (select created_at from public.profiles where id = p_user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.publish_classified_listing(p_listing_id uuid)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; m uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_LISTING_OWNER'; end if;
  if nullif(trim(l.title), '') is null then raise exception 'TITLE_REQUIRED'; end if;
  begin m := nullif(l.attributes->>'municipalityId', '')::uuid; exception when others then m := null; end;
  if l.address_id is null and (m is null or not exists (select 1 from public.municipalities x where x.id = m)) then
    raise exception 'LOCATION_REQUIRED';
  end if;
  if not public.validate_classified_attributes(l.listing_type, l.attributes) then raise exception 'INVALID_ATTRIBUTES'; end if;
  if jsonb_typeof(l.media) <> 'array' then raise exception 'MEDIA_INVALID'; end if;
  if jsonb_array_length(l.media) > 10 then raise exception 'TOO_MANY_PHOTOS'; end if;
  perform set_config('huambo.allow_publish', 'on', true);
  update public.classified_listings set status = 'published' where id = p_listing_id returning * into l;
  perform set_config('huambo.allow_publish', '', true);
  return l;
end $function$
;

CREATE OR REPLACE FUNCTION public.queue_video_cleanup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.video_url is not null and (tg_op = 'DELETE' or new.video_url is distinct from old.video_url) then
    insert into public.media_cleanup_queue(path) values (public.video_path(old.video_url)) on conflict (path) do nothing;
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION public.record_item_event(p_kind text, p_id uuid, p_event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid;
begin
  if p_event not in ('view', 'whatsapp', 'call', 'share') then return; end if;
  if p_kind = 'listing' then select owner_id into v_owner from public.classified_listings where id = p_id and status = 'published';
  elsif p_kind = 'product' then select seller_id into v_owner from public.products where id = p_id and active;
  elsif p_kind = 'business' then select owner_id into v_owner from public.businesses where id = p_id and active;
  elsif p_kind = 'provider' then select user_id into v_owner from public.provider_profiles where user_id = p_id and active;
  else return; end if;
  if v_owner is null or v_owner = auth.uid() then return; end if;
  insert into public.item_stats_daily as s (kind, item_id, day, owner_id, views, whatsapp, calls, shares)
  values (p_kind, p_id, public.angola_today(), v_owner,
    (p_event = 'view')::int, (p_event = 'whatsapp')::int, (p_event = 'call')::int, (p_event = 'share')::int)
  on conflict (kind, item_id, day) do update set
    views = s.views + excluded.views, whatsapp = s.whatsapp + excluded.whatsapp,
    calls = s.calls + excluded.calls, shares = s.shares + excluded.shares, owner_id = excluded.owner_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_promo_view(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.promo_posts set views = views + 1 where id = p_id and status = 'published' and owner_id is distinct from auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.referral_apply_reward(p_referred uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.referrals; s public.subscriptions; days int;
begin
  select * into r from public.referrals where referred_id = p_referred for update;
  if not found or r.status = 'rewarded' then return; end if;
  days := coalesce(r.reward_days, (select referral_reward_days from public.platform_settings where id = 1), 30);
  if days <= 0 then return; end if;
  select x.* into s from public.subscriptions x where x.owner_id = r.referrer_id
    order by public.subscription_active_until(x) asc limit 1 for update;
  if not found then
    if r.status = 'joined' then
      update public.referrals set status = 'earned', reward_days = days, earned_at = now() where referred_id = r.referred_id;
      insert into public.notifications(user_id, type, title, body, data)
      values (r.referrer_id, 'system', 'Ganhou 1 mês grátis 🎁', 'Quem convidou pagou a primeira mensalidade. O seu prémio de ' || days
        || ' dias fica guardado e entra na sua primeira mensalidade (profissional, empresa ou loja).', jsonb_build_object('for', 'referral'));
    end if;
    return;
  end if;
  update public.subscriptions set paid_until = greatest(now(), public.subscription_active_until(s)) + make_interval(days => days), last_reminder = null where id = s.id;
  update public.referrals set status = 'rewarded', reward_days = days, subscription_id = s.id, earned_at = coalesce(earned_at, now()), rewarded_at = now()
   where referred_id = r.referred_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.referrer_id, 'system', 'Ganhou 1 mês grátis 🎁', 'Quem convidou pagou a primeira mensalidade: juntámos ' || days || ' dias grátis à sua mensalidade.',
    jsonb_build_object('for', 'plan'));
end $function$
;

CREATE OR REPLACE FUNCTION public.referral_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and not exists (select 1 from public.subscription_payments x where x.owner_id = new.owner_id and x.status = 'confirmed' and x.id <> new.id) then
    perform public.referral_apply_reward(new.owner_id);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.referral_on_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.referrals;
begin
  for r in select * from public.referrals where referrer_id = new.owner_id and status = 'earned' for update loop
    update public.subscriptions set trial_ends_at = trial_ends_at + make_interval(days => coalesce(r.reward_days, 30)) where id = new.id;
    update public.referrals set status = 'rewarded', subscription_id = new.id, rewarded_at = now() where referred_id = r.referred_id;
  end loop;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.register_courier(p_name text, p_phone text, p_vehicle text, p_municipality_id uuid)
 RETURNS couriers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.couriers;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.couriers(user_id, display_name, phone, vehicle, municipality_id)
  values (auth.uid(), trim(p_name), trim(p_phone), coalesce(p_vehicle, 'moto'), p_municipality_id)
  on conflict (user_id) do update set display_name = excluded.display_name, phone = excluded.phone,
    vehicle = excluded.vehicle, municipality_id = excluded.municipality_id, updated_at = now()
  returning * into c;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.rental_commission_on_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select * into l from public.classified_listings where id = new.listing_id;
    if found then perform public.listing_commission_add(l, new.proposed_price, 'rental', new.id); end if;
  elsif old.status = 'accepted' and new.status is distinct from 'accepted' then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Aluguer cancelado.')
     where rental_request_id = new.id and status = 'due';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.reply_to_review(p_kind text, p_review_id uuid, p_reply text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := nullif(left(trim(coalesce(p_reply, '')), 1000), ''); author uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'service' then
    select r.author_id into author from public.reviews r left join public.businesses b on b.id = r.business_id
     where r.id = p_review_id and (r.provider_id = auth.uid() or b.owner_id = auth.uid());
    if not found then raise exception 'NOT_REVIEW_TARGET'; end if;
    update public.reviews set owner_reply = t, owner_reply_at = case when t is null then null else now() end where id = p_review_id;
  elsif p_kind = 'deal' then
    select r.author_id into author from public.user_reviews r where r.id = p_review_id and r.target_id = auth.uid();
    if not found then raise exception 'NOT_REVIEW_TARGET'; end if;
    update public.user_reviews set reply = t, reply_at = case when t is null then null else now() end where id = p_review_id;
  else raise exception 'INVALID_KIND'; end if;
  if t is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (author, 'review', 'Responderam à sua avaliação', left(t, 140), jsonb_build_object('for', 'reply'));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.report_classified_listing(p_listing_id uuid, p_reason text, p_details text DEFAULT NULL::text)
 RETURNS moderation_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.moderation_reports;
begin
 if not exists(select 1 from public.classified_listings where id=p_listing_id) then
   raise exception 'LISTING_NOT_FOUND';
 end if;
 insert into public.moderation_reports(reporter_id,target_type,target_id,reason,details,status)
 values(auth.uid(),'classified_listing',p_listing_id,trim(p_reason),nullif(trim(p_details),''),'open')
 returning * into r;
 return r;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text DEFAULT NULL::text)
 RETURNS moderation_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.moderation_reports; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;
  owner := case p_target_type
    when 'user' then (select id from public.profiles where id = p_target_id)
    when 'provider' then (select user_id from public.provider_profiles where user_id = p_target_id)
    when 'business' then (select owner_id from public.businesses where id = p_target_id)
    when 'product' then (select seller_id from public.products where id = p_target_id)
    when 'classified_listing' then (select owner_id from public.classified_listings where id = p_target_id)
    when 'promo_post' then (select owner_id from public.promo_posts where id = p_target_id)
    else null end;
  if p_target_type not in ('user', 'provider', 'business', 'product', 'classified_listing', 'promo_post') then raise exception 'INVALID_TARGET'; end if;
  if owner is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_REPORT_SELF'; end if;
  if exists (select 1 from public.moderation_reports where reporter_id = auth.uid() and target_type = p_target_type and target_id = p_target_id and status in ('open', 'reviewing')) then
    raise exception 'ALREADY_REPORTED';
  end if;
  if (select count(*) from public.moderation_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.moderation_reports(reporter_id, target_type, target_id, reason, details, status)
  values (auth.uid(), p_target_type, p_target_id, left(trim(p_reason), 200), nullif(left(trim(coalesce(p_details, '')), 1000), ''), 'open')
  returning * into r;
  perform public.notify_staff('Nova denúncia', left(trim(p_reason), 140), jsonb_build_object('report_id', r.id));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.report_fuel(p_product_id uuid, p_has boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not exists (select 1 from public.fuel_products p join public.fuel_stations s on s.id = p.station_id where p.id = p_product_id and s.status = 'approved') then raise exception 'FUEL_NOT_FOUND'; end if;
  if exists (select 1 from public.fuel_reports where product_id = p_product_id and user_id = me and created_at > now() - interval '30 minutes') then raise exception 'FUEL_REPORT_TOO_SOON'; end if;
  if (select count(*) from public.fuel_reports where user_id = me and created_at > now() - interval '1 day') >= 20 then raise exception 'TOO_MANY_REQUESTS'; end if;
  insert into public.fuel_reports(product_id, user_id, has) values (p_product_id, me, p_has);
end $function$
;

CREATE OR REPLACE FUNCTION public.reputation_summary(p_business_id uuid DEFAULT NULL::uuid, p_provider_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(rating numeric, review_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(round(avg(r.rating)::numeric,2),0),count(*)
  from public.reviews r
  where r.status='published'
    and (p_business_id is null or r.business_id=p_business_id)
    and (p_provider_id is null or r.provider_id=p_provider_id)
    and (p_product_id is null or r.product_id=p_product_id)
    and (p_service_id is null or r.service_id=p_service_id);
$function$
;

CREATE OR REPLACE FUNCTION public.request_classified_rental(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_price numeric, p_message text DEFAULT NULL::text)
 RETURNS rental_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; r public.rental_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id and status = 'published' and purpose in ('rent','lease');
  if not found then raise exception 'LISTING_NOT_RENTABLE'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_RENT_OWN_LISTING'; end if;
  if p_ends_at <= p_starts_at or p_price < 0 or p_starts_at < now() - interval '1 day' then raise exception 'INVALID_RENTAL_REQUEST'; end if;
  if exists (select 1 from public.rental_requests x where x.listing_id = p_listing_id and x.status = 'accepted'
             and x.starts_at < p_ends_at and x.ends_at > p_starts_at) then raise exception 'RENTAL_WINDOW_UNAVAILABLE'; end if;
  insert into public.rental_requests(listing_id, renter_id, starts_at, ends_at, proposed_price, message)
  values (p_listing_id, auth.uid(), p_starts_at, p_ends_at, p_price, nullif(trim(p_message), '')) returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Novo pedido de aluguer', 'Recebeu um pedido para «' || l.title || '».', jsonb_build_object('rental_id', r.id, 'listing_id', l.id));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_identity_verification(p_front_path text, p_back_path text, p_selfie_path text, p_id_number text, p_note text DEFAULT NULL::text)
 RETURNS verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.verification_requests; me uuid := auth.uid(); bi text := public.normalize_bi(p_id_number);
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if coalesce((select kyc_level from public.profiles where id = me), 0) >= 1 then raise exception 'ALREADY_VERIFIED'; end if;
  if p_front_path is null or p_back_path is null or p_selfie_path is null then raise exception 'IDENTITY_PHOTOS_REQUIRED'; end if;
  if split_part(p_front_path, '/', 1) <> me::text or split_part(p_back_path, '/', 1) <> me::text or split_part(p_selfie_path, '/', 1) <> me::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_front_path = p_back_path or p_front_path = p_selfie_path or p_back_path = p_selfie_path then raise exception 'IDENTITY_PHOTOS_REQUIRED'; end if;
  if bi !~ '^[0-9]{9}[A-Z]{2}[0-9]{3}$' then raise exception 'INVALID_BI_NUMBER'; end if;
  if exists (select 1 from public.verification_requests where user_id = me and kind = 'identity' and status = 'pending') then raise exception 'VERIFICATION_PENDING'; end if;
  if exists (select 1 from public.verification_requests where id_number = bi and kind = 'identity' and status in ('pending', 'approved') and user_id <> me) then raise exception 'BI_ALREADY_USED'; end if;
  insert into public.verification_requests(user_id, kind, document_path, back_path, selfie_path, id_number, note)
  values (me, 'identity', p_front_path, p_back_path, p_selfie_path, bi, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', 'Identidade (BI + selfie)', jsonb_build_object('verification_id', v.id));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_inspection(p_kind text, p_target uuid, p_address text, p_phone text, p_preferred_time text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); i public.inspections; fee numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('provider', 'business', 'store') then raise exception 'INVALID_KIND'; end if;
  if public.inspection_target_owner(p_kind, p_target) is distinct from me then raise exception 'INSPECTION_NOT_OWNER'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 5 then raise exception 'INSPECTION_ADDRESS_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status in ('awaiting_payment', 'payment_submitted', 'requested', 'scheduled')) then raise exception 'INSPECTION_OPEN'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status = 'approved' and valid_until > now() + interval '30 days') then raise exception 'INSPECTION_STILL_VALID'; end if;
  select coalesce(case when p_kind = 'provider' then inspection_fee_provider_kz else inspection_fee_kz end, 0) into fee from public.platform_settings where id = 1;
  insert into public.inspections(kind, target_id, owner_id, status, fee_amount, address, phone, preferred_time, note)
  values (p_kind, p_target, me, case when fee > 0 then 'awaiting_payment' else 'requested' end, fee, left(trim(p_address), 300), left(regexp_replace(p_phone, '[^0-9+]', '', 'g'), 20),
    nullif(left(trim(coalesce(p_preferred_time, '')), 120), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into i;
  if fee = 0 then
    perform public.notify_staff('🏅 Pedido de inspeção', 'I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(p_kind, p_target), ''), jsonb_build_object('inspection_id', i.id));
  end if;
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_listing_boost(p_listing_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS listing_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; st public.platform_settings; b public.listing_boosts; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if l.status <> 'published' then raise exception 'LISTING_NOT_PUBLISHED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.listing_boosts where listing_id = l.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.listing_boosts(listing_id, owner_id, days, amount, method, reference, proof_path)
  values (l.id, auth.uid(), st.boost_days, st.boost_price_kz, p_method, ref, p_proof_path) returning * into b;
  perform public.notify_staff('Destaque para confirmar', b.amount || ' Kz · ' || l.title || ' · D-' || b.ref_no, jsonb_build_object('boost_id', b.id, 'listing_id', l.id));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_order_delivery(p_order_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; d public.delivery_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.seller_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_ORDER_PARTY'; end if;
  if o.fulfillment_type <> 'delivery' then raise exception 'ORDER_IS_PICKUP'; end if;
  if o.status in ('completed', 'cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.delivery_requests x where x.order_id = o.id and x.status not in ('delivered', 'cancelled')) then
    raise exception 'DELIVERY_ALREADY_REQUESTED';
  end if;
  insert into public.delivery_requests(order_id, requester_id, status, notes)
  values (o.id, auth.uid(), 'pending', nullif(trim(coalesce(p_notes, '')), '')) returning * into d;
  update public.orders set fulfillment_status = 'pending', updated_at = now() where id = o.id;
  insert into public.notifications(user_id, type, title, body, data)
  select c.user_id, 'delivery', 'Nova entrega disponível', 'Encomenda de ' || o.total || ' Kz para entregar.',
         jsonb_build_object('delivery_id', d.id, 'for', 'courier')
  from public.couriers c where c.status = 'approved' and c.available and c.user_id <> o.seller_id limit 100;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_payout(p_amount numeric DEFAULT NULL::numeric)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.payout_accounts; st public.platform_settings; avail numeric; amt numeric; pr public.payout_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payout:' || auth.uid()::text, 0));
  select * into a from public.payout_accounts where user_id = auth.uid();
  if not found then raise exception 'PAYOUT_ACCOUNT_REQUIRED'; end if;
  if exists (select 1 from public.payout_requests where user_id = auth.uid() and status in ('requested', 'processing')) then raise exception 'PAYOUT_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  select coalesce(sum(amount), 0) into avail from public.wallet_entries where user_id = auth.uid() and bucket = 'available';
  amt := round(coalesce(p_amount, avail), 2);
  if amt <= 0 or amt > avail then raise exception 'NOT_ENOUGH_BALANCE'; end if;
  if amt < st.payout_min_kz then raise exception 'PAYOUT_TOO_SMALL'; end if;
  insert into public.payout_requests(user_id, amount, method, holder_name, destination)
  values (auth.uid(), amt, a.method, a.holder_name, case when a.method = 'iban' then public.format_angola_iban(a.iban) else a.express_number end)
  returning * into pr;
  perform public.wallet_add(auth.uid(), null, pr.id, 'available', 'payout', -amt, 'Levantamento L-' || pr.ref_no);
  perform public.notify_staff('Pedido de levantamento', amt || ' Kz · ' || a.holder_name || ' · L-' || pr.ref_no, jsonb_build_object('payout_id', pr.id));
  return pr;
end $function$
;
