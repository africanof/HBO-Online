-- Huambo Online — reparação do fluxo principal
-- Fotografias (Storage), contactar anunciante, publicação segura, perfil,
-- preferências de notificações, eliminar conta e funções internas.
-- O território do anúncio fica em attributes.provinceId / attributes.municipalityId.

-- 1. Proteção do anúncio: estado "published" e destaque só pelas funções do servidor
create or replace function public.guard_classified_listing()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin boolean := public.has_admin_role();
begin
  if tg_op = 'INSERT' then
    if not admin then new.status := 'draft'; new.featured := false; end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  if not admin then
    new.featured := old.featured;
    if new.status = 'published' and old.status is distinct from 'published'
       and coalesce(current_setting('huambo.allow_publish', true), '') <> 'on' then
      raise exception 'USE_PUBLISH_FUNCTION';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_classified_listing on public.classified_listings;
create trigger trg_guard_classified_listing before insert or update on public.classified_listings
  for each row execute function public.guard_classified_listing();

create or replace function public.publish_classified_listing(p_listing_id uuid)
returns public.classified_listings language plpgsql security definer set search_path = public as $$
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
end $$;

drop policy if exists classified_admin_read on public.classified_listings;
create policy classified_admin_read on public.classified_listings for select to authenticated using (public.has_admin_role());
drop policy if exists classified_admin_update on public.classified_listings;
create policy classified_admin_update on public.classified_listings for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
drop policy if exists classified_admin_delete on public.classified_listings;
create policy classified_admin_delete on public.classified_listings for delete to authenticated using (public.has_admin_role());

-- 2. Alertas de pesquisas guardadas também usam o território guardado em attributes
create or replace function public.classified_saved_search_matches_listing(p_filters jsonb, p_listing public.classified_listings)
returns boolean language plpgsql stable set search_path = public as $function$
declare
 f jsonb:=case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end;
 category_filter uuid; min_price numeric; max_price numeric; filter_territory uuid; filter_kind text;
 listing_territory uuid; listing_neighborhood uuid; listing_municipality uuid; listing_province uuid; listing_country_code text;
 listing_matches boolean:=true;
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
 and (coalesce(trim(f->>'query'),'')='' or lower(p_listing.title) like '%'||lower(trim(f->>'query'))||'%' or lower(coalesce(p_listing.description,'')) like '%'||lower(trim(f->>'query'))||'%')
 and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> f->'attributes');
end;
$function$;

-- 3. Contactar anunciante: tipo "classified" aceite, participantes e conversa reutilizada
alter table public.conversations drop constraint if exists conversations_context_type_check;
alter table public.conversations add constraint conversations_context_type_check
  check (context_type = any (array['general','business','provider','service','product','order','classified']));

create or replace function public.start_classified_conversation(p_listing_id uuid, p_message text)
returns public.conversations language plpgsql security definer set search_path = public as $$
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
end $$;

insert into public.conversation_participants(conversation_id, user_id)
select c.id, c.created_by from public.conversations c on conflict do nothing;
insert into public.conversation_participants(conversation_id, user_id)
select c.id, l.owner_id from public.conversations c join public.classified_listings l on l.id = c.classified_listing_id on conflict do nothing;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 4. Perfil: fotografia, dados públicos mínimos do anunciante e campos protegidos
alter table public.profiles add column if not exists avatar_url text;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then
    new.kyc_level := old.kyc_level; new.trust_score := old.trust_score;
    new.status := old.status; new.phone_verified := old.phone_verified;
  end if;
  new.id := old.id; new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.get_public_profile(p_user_id uuid)
returns table(id uuid, full_name text, avatar_url text, province text, municipality text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, p.province, p.municipality, p.created_at
  from public.profiles p where p.id = p_user_id and p.status = 'active';
$$;
revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- 5. Storage: cada utilizador só envia/apaga na sua própria pasta; leitura pública
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
where id = 'classified-media';
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "huambo media insert own folder" on storage.objects;
create policy "huambo media insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('classified-media','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "huambo media update own folder" on storage.objects;
create policy "huambo media update own folder" on storage.objects for update to authenticated
  using (bucket_id in ('classified-media','avatars') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('classified-media','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "huambo media delete own folder" on storage.objects;
create policy "huambo media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id in ('classified-media','avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- 6. Preferências de notificações
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  saved_search boolean not null default true,
  messages boolean not null default true,
  rentals boolean not null default true,
  auctions boolean not null default true,
  marketplace boolean not null default true,
  reviews boolean not null default true,
  system boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for select to authenticated using (user_id = auth.uid());

create or replace function public.get_notification_preferences()
returns public.notification_preferences language plpgsql stable security definer set search_path = public as $$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.notification_preferences where user_id = auth.uid();
  if not found then
    r.user_id := auth.uid(); r.enabled := true; r.saved_search := true; r.messages := true; r.rentals := true;
    r.auctions := true; r.marketplace := true; r.reviews := true; r.system := true; r.updated_at := now();
  end if;
  return r;
end $$;

create or replace function public.upsert_notification_preferences(p_enabled boolean, p_saved_search boolean, p_messages boolean,
  p_rentals boolean, p_auctions boolean, p_marketplace boolean, p_reviews boolean, p_system boolean)
returns public.notification_preferences language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.get_notification_preferences() from public, anon;
revoke all on function public.upsert_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.upsert_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

create or replace function public.apply_notification_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;
drop trigger if exists trg_apply_notification_preferences on public.notifications;
create trigger trg_apply_notification_preferences before insert on public.notifications
  for each row execute function public.apply_notification_preferences();

-- 7. Eliminar conta: o conteúdo do próprio utilizador sai com a conta
--    (encomendas e entregas mantêm-se, por serem registos de compra)
do $$
declare r record;
begin
  for r in select * from (values
    ('classified_listings','classified_listings_owner_id_fkey','owner_id'),
    ('conversations','conversations_created_by_fkey','created_by'),
    ('messages','messages_sender_id_fkey','sender_id'),
    ('services','services_provider_id_fkey','provider_id'),
    ('products','products_seller_id_fkey','seller_id'),
    ('businesses','businesses_owner_id_fkey','owner_id'),
    ('organizations','organizations_owner_id_fkey','owner_id'),
    ('reviews','reviews_author_id_fkey','author_id'),
    ('rental_requests','rental_requests_renter_id_fkey','renter_id'),
    ('moderation_reports','moderation_reports_reporter_id_fkey','reporter_id'),
    ('auctions','auctions_seller_id_fkey','seller_id'),
    ('auction_bids','auction_bids_bidder_id_fkey','bidder_id')
  ) as t(tbl, con, col) loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.con);
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete cascade', r.tbl, r.con, r.col);
  end loop;
end $$;

-- 8. Segurança: funções de gatilho não são chamáveis pela API
revoke execute on function public.handle_new_huambo_user() from public, anon, authenticated;
revoke execute on function public.touch_conversation() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.notify_new_message() from public, anon, authenticated;
revoke execute on function public.notify_classified_saved_searches() from public, anon, authenticated;
revoke execute on function public.guard_classified_listing() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.apply_notification_preferences() from public, anon, authenticated;
alter function public.validate_classified_attributes(text, jsonb) set search_path = public;
