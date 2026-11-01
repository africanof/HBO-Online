CREATE OR REPLACE FUNCTION public.guard_fuel_station_pay()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations;
begin
  if public.has_admin_role() then return new; end if;
  if tg_op = 'UPDATE' and new.holder is not distinct from old.holder and new.iban is not distinct from old.iban and new.express is not distinct from old.express then return new; end if;
  select * into s from public.fuel_stations where id = new.station_id;
  if s.status = 'approved' and (tg_op = 'UPDATE' or new.iban is not null or new.express is not null) then
    perform set_config('app.fuel_pay_changed', '1', true);
    update public.fuel_stations set status = 'pending', admin_note = 'Conta para pagamentos mudou: à espera de nova aprovação.' where id = s.id;
    perform set_config('app.fuel_pay_changed', '', true);
    perform public.notify_staff('⛽ Posto mudou a conta para pagamentos', 'S-' || s.ref_no || ' · ' || s.name || ' precisa de nova aprovação.', jsonb_build_object('fuel_station_id', s.id));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_listing_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('huambo.allow_agent', true), '') = 'on' or public.has_admin_role() then return new; end if;
  if tg_op = 'INSERT' then new.agent_id := null; else new.agent_id := old.agent_id; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_listing_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.deal_with is distinct from old.deal_with and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'USE_SERVER_FUNCTIONS';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_message_sender()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_order_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  raise exception 'USE_ORDER_FUNCTIONS';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then
    new.kyc_level := old.kyc_level; new.trust_score := old.trust_score;
    new.status := old.status; new.phone_verified := old.phone_verified;
  end if;
  new.id := old.id; new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_review_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.has_admin_role() or current_user in ('postgres', 'supabase_admin') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then return old; end if;
  raise exception 'USE_REVIEW_FUNCTION';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_server_only_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  raise exception 'USE_SERVER_FUNCTIONS';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_store_paid_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.products;
begin
  -- só verifica quando entra um produto novo ou a quantidade sobe
  if tg_op = 'UPDATE' and new.product_id = old.product_id and new.quantity <= old.quantity then return new; end if;
  select * into p from public.products where id = new.product_id;
  if found and not public.product_paid_up(p.seller_id, p.business_id) then raise exception 'STORE_UNAVAILABLE'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_ticket_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare taken int;
begin
  if tg_op = 'DELETE' then
    if public.ticket_type_taken(old.id) > 0 or exists (select 1 from public.event_orders where ticket_type_id = old.id) then raise exception 'TICKET_TYPE_HAS_ORDERS'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.event_id := old.event_id;
    taken := public.ticket_type_taken(old.id);
    if new.quantity < taken then raise exception 'TICKETS_ALREADY_SOLD'; end if;
    if new.price <> old.price and exists (select 1 from public.event_orders where ticket_type_id = old.id and status in ('reserved', 'submitted', 'confirmed')) then raise exception 'TICKET_PRICE_LOCKED'; end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_venue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.has_admin_role() then new.updated_at := now(); return new; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.owner_id) then raise exception 'NOT_BUSINESS_OWNER'; end if;
    if (select count(*) from public.venues where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_VENUES'; end if;
    new.status := 'pending'; new.admin_note := null;
  else
    if new.owner_id <> old.owner_id or new.business_id <> old.business_id or new.ref_no <> old.ref_no then raise exception 'ADMIN_ONLY'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note)
       and coalesce(current_setting('app.venue_pay_changed', true), '') <> '1' then raise exception 'ADMIN_ONLY'; end if;
    if new.kind <> old.kind and old.status = 'approved' then
      new.status := 'pending'; new.admin_note := 'Mudou o tipo de estabelecimento: à espera de nova aprovação.';
      perform public.notify_staff('Estabelecimento mudou de tipo', 'E-' || new.ref_no || ' precisa de nova aprovação.', jsonb_build_object('venue_id', new.id));
    end if;
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_venue_pay()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues;
begin
  if public.has_admin_role() then return new; end if;
  select * into v from public.venues where id = new.venue_id;
  if v.status = 'approved' and (tg_op = 'INSERT' or new.iban is distinct from old.iban or new.express is distinct from old.express or new.holder is distinct from old.holder) then
    perform set_config('app.venue_pay_changed', '1', true);
    update public.venues set status = 'pending', admin_note = 'Conta para pagamentos mudou: à espera de nova aprovação.' where id = v.id;
    perform set_config('app.venue_pay_changed', '', true);
    perform public.notify_staff('Estabelecimento mudou a conta para pagamentos', 'E-' || v.ref_no || ' precisa de nova aprovação.', jsonb_build_object('venue_id', v.id));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_verified_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.has_admin_role() or current_user in ('postgres', 'supabase_admin') then return new; end if;
  if tg_op = 'INSERT' then new.verified := false; else new.verified := old.verified; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_huambo_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, province, municipality)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    'Huambo',
    coalesce(new.raw_user_meta_data->>'municipality', '')
  )
  on conflict (id) do nothing;

  insert into public.account_capabilities (user_id, capability)
  values (new.id, 'customer')
  on conflict (user_id, capability) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_admin_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('moderator','admin'))
     and public.current_user_active() and public.mfa_ok();
$function$
;

CREATE OR REPLACE FUNCTION public.inspected_targets(p_kind text, p_ids uuid[])
 RETURNS TABLE(target_id uuid, inspected_at timestamp with time zone, valid_until timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (i.target_id) i.target_id, i.inspected_at, i.valid_until
  from public.inspections i
  where i.kind = p_kind and i.target_id = any(p_ids[1:200]) and i.status = 'approved' and i.valid_until > now()
  order by i.target_id, i.valid_until desc
$function$
;

CREATE OR REPLACE FUNCTION public.inspection_target_name(p_kind text, p_target uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'provider' then (select display_name from public.provider_profiles where user_id = p_target)
    when 'business' then (select name from public.businesses where id = p_target)
    when 'store' then (select 'Loja de ' || coalesce(nullif(full_name, ''), 'vendedor') from public.profiles where id = p_target)
  end
$function$
;

CREATE OR REPLACE FUNCTION public.inspection_target_owner(p_kind text, p_target uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'provider' then (select user_id from public.provider_profiles where user_id = p_target)
    when 'business' then (select owner_id from public.businesses where id = p_target)
    when 'store' then (select id from public.profiles where id = p_target and exists (select 1 from public.products x where x.seller_id = p_target))
  end
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') and public.current_user_active();
$function$
;

CREATE OR REPLACE FUNCTION public.is_approved_courier()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.couriers where user_id = auth.uid() and status = 'approved');
$function$
;

CREATE OR REPLACE FUNCTION public.is_order_party(p_order text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_order ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (select 1 from public.orders where id = p_order::uuid and auth.uid() in (buyer_id, seller_id)) else false end;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_event_tickets(o event_orders)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i int;
begin
  for i in 1..o.quantity loop
    insert into public.event_tickets(code, order_id, event_id, ticket_type_id, holder_id) values (public.new_ticket_code(), o.id, o.event_id, o.ticket_type_id, o.buyer_id);
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_follow_listing(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; who text;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.status <> 'published' or l.purpose = 'wanted' then return; end if;
  select coalesce(nullif(full_name, ''), 'Um vendedor que segue') into who from public.profiles where id = l.owner_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = l.owner_id), 'seller:' || l.owner_id,
    'Novo anúncio de ' || coalesce(who, 'um vendedor que segue'), l.title, jsonb_build_object('listing_id', l.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.job_follow_portfolio(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare it public.portfolio_items; who text;
begin
  select * into it from public.portfolio_items where id = p_id;
  if not found then return; end if;
  if it.provider_id is not null then
    select display_name into who from public.provider_profiles where user_id = it.provider_id;
    perform public.notify_followers(array(select user_id from public.followed_providers where provider_id = it.provider_id), 'provider:' || it.provider_id,
      'Trabalho novo de ' || coalesce(who, 'um profissional que segue'), it.title, jsonb_build_object('provider_id', it.provider_id));
  else
    select name into who from public.businesses where id = it.business_id;
    perform public.notify_followers(array(select user_id from public.followed_businesses where business_id = it.business_id), 'business:' || it.business_id,
      'Novidade de ' || coalesce(who, 'uma empresa que segue'), it.title, jsonb_build_object('business_id', it.business_id));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_follow_product(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.products; who text;
begin
  select * into p from public.products where id = p_id;
  if not found or not p.active then return; end if;
  select coalesce((select name from public.businesses where id = p.business_id), nullif(full_name, ''), 'Uma loja que segue') into who from public.profiles where id = p.seller_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = p.seller_id
      union select user_id from public.followed_businesses where business_id = p.business_id),
    'seller:' || p.seller_id, 'Novo produto de ' || coalesce(who, 'uma loja que segue'), p.name, jsonb_build_object('product_id', p.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.job_fuel_alert(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.fuel_products; s public.fuel_stations;
begin
  select * into p from public.fuel_products where id = p_id;
  if not found or p.status not in ('available', 'low') then return; end if;
  select * into s from public.fuel_stations where id = p.station_id;
  if s.status <> 'approved' then return; end if;
  if exists (select 1 from public.notifications n where n.data->>'for' = 'fuel' and n.data->>'product_id' = p.id::text and n.created_at > now() - interval '2 hours') then return; end if;
  insert into public.notifications(user_id, type, title, body, data)
  select distinct a.user_id, 'system', '⛽ Há ' || lower(public.fuel_product_label(p.product)) || '!',
    s.name || coalesce(' · ' || (select m.name from public.municipalities m where m.id = s.municipality_id), '') || case when p.price is not null then ' · ' || p.price || ' Kz' else '' end,
    jsonb_build_object('for', 'fuel', 'station_id', s.id, 'product_id', p.id)
  from public.fuel_alerts a
  where a.product = p.product and (a.municipality_id is null or a.municipality_id = s.municipality_id) and a.user_id <> s.owner_id
  limit 5000;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_queue_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  delete from public.job_queue where done_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_saved_search(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; s record;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.status <> 'published' then return; end if;
  for s in select id, user_id, name, coalesce(notification_frequency, 'immediate') frequency from public.classified_saved_searches
    where active = true and user_id <> l.owner_id and (notification_quiet_until is null or notification_quiet_until <= now())
      and public.classified_saved_search_matches_listing(filters, l) loop
    if s.frequency = 'daily' then
      insert into public.saved_search_notification_queue(saved_search_id, user_id, listing_id) values (s.id, s.user_id, l.id) on conflict do nothing;
    else
      insert into public.notifications(user_id, type, title, body, data)
      values (s.user_id, 'saved_search', 'Novo anúncio encontrado', 'Um novo anúncio corresponde à sua pesquisa guardada "' || s.name || '".',
        jsonb_build_object('saved_search_id', s.id, 'listing_id', l.id, 'listing_type', l.listing_type, 'purpose', l.purpose)) on conflict do nothing;
      if found then update public.classified_saved_searches set last_notified_at = now(), updated_at = now() where id = s.id; end if;
    end if;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_wanted(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; words text[]; budget text;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.purpose <> 'wanted' or l.status <> 'published' then return; end if;
  words := public.wanted_keywords(l.title);
  if coalesce(array_length(words, 1), 0) = 0 then return; end if;
  budget := case
    when l.budget_min is not null and l.budget_max is not null then ' Orçamento: ' || l.budget_min || ' – ' || l.budget_max || ' Kz.'
    when l.budget_max is not null then ' Orçamento: até ' || l.budget_max || ' Kz.'
    when l.budget_min is not null then ' Orçamento: a partir de ' || l.budget_min || ' Kz.'
    else '' end;
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura o que vende', '«' || l.title || '».' || budget, jsonb_build_object('listing_id', l.id, 'for', 'wanted')
  from (
    select p.seller_id as uid from public.products p
     where p.active and p.seller_id <> l.owner_id and exists (select 1 from unnest(words) w where public.fold_text(p.name) like '%' || w || '%')
    union
    select x.owner_id from public.classified_listings x
     where x.status = 'published' and x.purpose in ('sale', 'rent', 'lease', 'auction') and x.owner_id <> l.owner_id
       and exists (select 1 from unnest(words) w where public.fold_text(x.title) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = l.id::text)
  limit 30;
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura os seus serviços', '«' || l.title || '».' || budget, jsonb_build_object('listing_id', l.id, 'for', 'wanted')
  from (
    select pp.user_id as uid from public.provider_profiles pp left join public.categories c on c.id = pp.category_id
     where pp.active and pp.user_id <> l.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, pp.custom_category, pp.headline, pp.display_name)) like '%' || w || '%'
       or exists (select 1 from public.services sv where sv.provider_id = pp.user_id and sv.active and public.fold_text(sv.title) like '%' || w || '%'))
    union
    select b.owner_id from public.businesses b left join public.categories c on c.id = b.category_id
     where b.active and b.owner_id <> l.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, b.custom_category, b.name, b.description)) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = l.id::text)
  limit 30;
end $function$
;

CREATE OR REPLACE FUNCTION public.list_active_categories(p_type text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, slug text, type text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id,name,slug,type
  from public.categories
  where active=true and (p_type is null or type=p_type)
  order by name;
$function$
;

CREATE OR REPLACE FUNCTION public.list_active_provinces(p_country_code text DEFAULT 'AO'::text)
 RETURNS TABLE(id uuid, name text, country_code text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id,name,country_code
  from public.provinces
  where country_code=upper(p_country_code) and active=true
  order by name;
$function$
;

CREATE OR REPLACE FUNCTION public.list_events(p_category text DEFAULT NULL::text, p_municipality uuid DEFAULT NULL::uuid, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, ref_no bigint, title text, category text, starts_at timestamp with time zone, ends_at timestamp with time zone, venue text, municipality_name text, cover_url text, featured boolean, price_from numeric, tickets_left bigint, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id, e.ref_no, e.title, e.category, e.starts_at, e.ends_at, e.venue, m.name, e.cover_url, coalesce(e.featured_until > now(), false),
    (select min(t.price) from public.event_ticket_types t where t.event_id = e.id and t.active),
    (select coalesce(sum(t.quantity - public.ticket_type_taken(t.id)), 0) from public.event_ticket_types t where t.event_id = e.id and t.active),
    e.status
  from public.events e left join public.municipalities m on m.id = e.municipality_id
  where e.status = 'published' and coalesce(e.ends_at, e.starts_at + interval '6 hours') > now()
    and (p_category is null or e.category = p_category) and (p_municipality is null or e.municipality_id = p_municipality)
    and (p_query is null or e.title ilike '%' || p_query || '%' or e.venue ilike '%' || p_query || '%')
  order by coalesce(e.featured_until > now(), false) desc, e.starts_at
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
$function$
;

CREATE OR REPLACE FUNCTION public.list_reviews(p_provider_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamp with time zone, author_id uuid, author_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador')
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published'
    and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.list_reviews_v2(p_provider_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, rating smallint, comment text, created_at timestamp with time zone, author_id uuid, author_name text, confirmed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), r.service_request_id is not null
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published' and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by (r.service_request_id is not null) desc, r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.list_reviews_v3(p_provider_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, rating smallint, comment text, created_at timestamp with time zone, author_id uuid, author_name text, confirmed boolean, owner_reply text, owner_reply_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), r.service_request_id is not null, r.owner_reply, r.owner_reply_at
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published' and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by (r.service_request_id is not null) desc, r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.listing_agent_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.agent_id is not null and new.status = 'sold' and old.status is distinct from 'sold' then
    perform public.agent_commission_create(new.id);
  elsif old.status = 'sold' and new.status is distinct from 'sold' then
    update public.agent_commissions set status = 'cancelled', admin_note = 'O anúncio deixou de estar vendido.', decided_at = now()
     where listing_id = new.id and status = 'pending';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_claim_deadline(p_listing_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); l public.classified_listings; days int; since timestamptz;
begin
  if me is null then return null; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.owner_id = me then return null; end if;
  select claim_days into days from public.platform_settings where id = 1;
  if l.deal_with = me and l.status in ('sold', 'rented') then since := l.deal_at; end if;
  select greatest(since, max(r.starts_at)) into since from public.rental_requests r where r.listing_id = l.id and r.renter_id = me and r.status = 'accepted';
  if since is null then return null; end if;
  if since + make_interval(days => days) < now() then return null; end if;
  return since + make_interval(days => days);
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_claims_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer := 0; c record;
begin
  for c in select * from public.listing_claims where status = 'open' and respond_by < now() for update skip locked loop
    update public.listing_claims set status = 'escalated', updated_at = now() where id = c.id;
    insert into public.notifications(user_id, type, title, body, data)
    select x.u, 'system', 'Reclamação enviada à administração', '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): o vendedor não respondeu em 3 dias.',
      jsonb_build_object('for', 'claim') from (values (c.buyer_id), (c.seller_id)) x(u);
    perform public.notify_staff('Reclamação de anúncio para decidir', 'R-' || c.ref_no || ' · sem resposta do vendedor', jsonb_build_object('claim_id', c.id));
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_commission_add(l classified_listings, p_amount numeric, p_source text, p_rental uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare st public.platform_settings; fee numeric; due timestamptz; what text;
begin
  select * into st from public.platform_settings where id = 1;
  if p_amount is null or p_amount <= 0 or st.listing_commission_pct <= 0 then return; end if;
  fee := round(p_amount * st.listing_commission_pct / 100);
  due := now() + make_interval(days => st.commission_due_days);
  insert into public.listing_commissions(listing_id, owner_id, listing_title, listed_price, sale_amount, rate_pct, amount, source, due_at, rental_request_id)
  values (l.id, l.owner_id, l.title, l.price, p_amount, st.listing_commission_pct, fee, p_source, due, p_rental)
  on conflict do nothing;
  if not found then return; end if;
  what := case when p_source in ('rental', 'rented') then 'Arrendamento registado' else 'Venda registada' end;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', what || ': comissão de ' || st.listing_commission_pct || '%',
          '«' || l.title || '» ' || case when p_source in ('rental', 'rented') then 'arrendado' else 'vendido' end || ' por ' || p_amount || ' Kz. Comissão a pagar: '
          || fee || ' Kz até ' || to_char(due at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.',
          jsonb_build_object('listing_id', l.id, 'for', 'commission'));
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_commission_on_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare amt numeric; src text := 'sold'; offer_amt numeric;
begin
  if new.status = 'sold' and old.status is distinct from 'sold' and new.purpose in ('sale', 'auction') then
    if new.deal_with is not null then
      select o.amount into offer_amt from public.listing_offers o where o.listing_id = new.id and o.buyer_id = new.deal_with and o.status = 'accepted' and o.amount is not null
       order by o.responded_at desc nulls last limit 1;
    end if;
    amt := coalesce(new.sale_amount, offer_amt, new.price);
    if new.sale_amount is null and offer_amt is not null then src := 'offer'; end if;
    if new.purpose = 'auction' then src := 'auction'; end if;
    perform public.listing_commission_add(new, amt, src);
  elsif new.status = 'rented' and old.status is distinct from 'rented' and new.purpose in ('rent', 'lease') then
    if not exists (select 1 from public.listing_commissions c where c.listing_id = new.id and c.source = 'rental' and c.status <> 'cancelled'
                   and c.created_at > now() - interval '30 days') then
      perform public.listing_commission_add(new, coalesce(new.sale_amount, new.price), 'rented');
    end if;
  elsif (old.status = 'sold' and new.status is distinct from 'sold') or (old.status = 'rented' and new.status is distinct from 'rented') then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Anúncio deixou de estar vendido/arrendado.')
     where listing_id = new.id and status = 'due' and rental_request_id is null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_deal_candidates(p_listing_id uuid)
 RETURNS TABLE(user_id uuid, full_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select distinct x.uid, coalesce(nullif(p.full_name, ''), 'Utilizador') from (
    select cp.user_id as uid from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
     where c.classified_listing_id = p_listing_id
    union
    select o.buyer_id from public.listing_offers o where o.listing_id = p_listing_id and o.status in ('pending', 'accepted')
  ) x left join public.profiles p on p.id = x.uid
  where x.uid <> auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_offers_for(p_listing_id uuid)
 RETURNS TABLE(id uuid, buyer_id uuid, buyer_name text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select o.id, o.buyer_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at
  from public.listing_offers o left join public.profiles p on p.id = o.buyer_id
  where o.listing_id = p_listing_id order by (o.status = 'pending') desc, o.created_at desc limit 100;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_territory_active(p_listing classified_listings)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare ok boolean;
begin
  if p_listing.address_id is null then return true; end if;
  select a.active and coalesce(s.active,false) and coalesce(p.active,false) into ok
  from public.addresses a left join public.streets s on s.id=a.street_id left join public.neighborhoods n on n.id=s.neighborhood_id left join public.municipalities m on m.id=n.municipality_id left join public.provinces p on p.id=m.province_id where a.id=p_listing.address_id;
  return coalesce(ok,false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.make_offer(p_listing_id uuid, p_amount numeric, p_trade_item text DEFAULT NULL::text, p_message text DEFAULT NULL::text)
 RETURNS listing_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; o public.listing_offers; t text := nullif(left(trim(coalesce(p_trade_item, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.status <> 'published' then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_OFFER_OWN_LISTING'; end if;
  if l.purpose in ('wanted', 'auction') or coalesce(l.sale_mode, 'negotiable') in ('fixed', 'auction') and not l.accepts_trade then raise exception 'OFFERS_NOT_ACCEPTED'; end if;
  if p_amount is null and t is null then raise exception 'OFFER_REQUIRED'; end if;
  if p_amount is not null and p_amount <= 0 then raise exception 'INVALID_OFFER'; end if;
  if t is not null and not (l.accepts_trade or l.sale_mode in ('trade', 'offers')) then raise exception 'TRADE_NOT_ACCEPTED'; end if;
  if l.sale_mode = 'trade' and t is null then raise exception 'TRADE_REQUIRED'; end if;
  if l.sale_mode = 'fixed' and t is null then raise exception 'OFFERS_NOT_ACCEPTED'; end if; -- preço fixo: só propostas de troca
  if exists (select 1 from public.listing_offers where listing_id = l.id and buyer_id = auth.uid() and status = 'pending') then raise exception 'OFFER_PENDING'; end if;
  if (select count(*) from public.listing_offers where buyer_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then raise exception 'TOO_MANY_REQUESTS'; end if;
  insert into public.listing_offers(listing_id, buyer_id, amount, trade_item, message)
  values (l.id, auth.uid(), p_amount, t, nullif(left(trim(coalesce(p_message, '')), 500), '')) returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Nova proposta', '«' || l.title || '»: ' || concat_ws(' + ', case when p_amount is not null then replace(to_char(p_amount, 'FM999,999,999,990'), ',', ' ') || ' Kz' end, case when t is not null then 'troca por ' || t end),
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'offer'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.mark_videos_removed(p_paths text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer := 0; k integer;
begin
  update public.classified_listings set video_url = null where public.video_path(video_url) = any(p_paths);
  get diagnostics k = row_count; n := n + k;
  update public.products set video_url = null where public.video_path(video_url) = any(p_paths);
  get diagnostics k = row_count; n := n + k;
  update public.media_cleanup_queue set done_at = now() where path = any(p_paths);
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.market_directory(p_query text DEFAULT ''::text, p_municipality_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, municipality_id uuid, municipality_name text, address_text text, description text, opening_hours text, photo_url text, listings bigint, products bigint, businesses bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, m.name, m.municipality_id, mu.name, m.address_text, m.description, m.opening_hours, m.photo_url,
    (select count(*) from public.classified_listings l where l.market_id = m.id and l.status = 'published'),
    (select count(*) from public.products p where p.market_id = m.id and p.active),
    (select count(*) from public.businesses b where b.market_id = m.id and b.active)
  from public.markets m left join public.municipalities mu on mu.id = m.municipality_id
  where m.status = 'active'
    and (coalesce(trim(p_query), '') = '' or m.name ilike '%' || trim(p_query) || '%' or m.address_text ilike '%' || trim(p_query) || '%')
    and (p_municipality_id is null or m.municipality_id = p_municipality_id)
  order by m.name limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.messages_block_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from public.conversation_participants o join public.user_blocks b
               on (b.blocker_id = o.user_id and b.blocked_id = new.sender_id) or (b.blocker_id = new.sender_id and b.blocked_id = o.user_id)
             where b.active and o.conversation_id = new.conversation_id and o.user_id <> new.sender_id) then
    raise exception 'BLOCKED';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$function$
;

CREATE OR REPLACE FUNCTION public.my_admin_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'user');
$function$
;

CREATE OR REPLACE FUNCTION public.my_auction_bids()
 RETURNS TABLE(auction_id uuid, listing_id uuid, ref_no bigint, title text, photo text, status text, ends_at timestamp with time zone, current_price numeric, my_max numeric, standing text, bid_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.classified_listing_id, l.ref_no, a.title, l.media->>0, a.status, a.ends_at, a.current_price,
    case when m.retracted_at is null then m.max_amount end,
    case
      when m.retracted_at is not null then case when m.retracted_by = m.bidder_id then 'retracted' else 'cancelled' end
      when a.status = 'ended' and a.winner_id = m.bidder_id then 'won'
      when a.status = 'ended' then case when a.winner_id is null and s.leader = m.bidder_id then 'reserve_not_met' else 'lost' end
      when a.status = 'cancelled' then 'auction_cancelled'
      when s.leader = m.bidder_id then 'winning'
      else 'outbid' end,
    (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null)
  from public.auction_max_bids m
  join public.auctions a on a.id = m.auction_id
  left join public.classified_listings l on l.id = a.classified_listing_id
  cross join lateral public.auction_standing(a.id) s
  where m.bidder_id = auth.uid()
  order by (a.status = 'live') desc, a.ends_at asc limit 200;
$function$
;
