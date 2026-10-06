-- Saved classified searches -> notifications
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
check (type = any (array['order','auction','bid','message','delivery','review','system','saved_search']));

create or replace function public.classified_saved_search_matches_listing(
  p_filters jsonb, p_listing public.classified_listings
) returns boolean
language sql immutable set search_path = public
as $$
  select jsonb_typeof(coalesce(p_filters,'{}'::jsonb)) = 'object'
  and (coalesce((p_filters->>'listingType'),'') = '' or p_listing.listing_type = (p_filters->>'listingType'))
  and (coalesce((p_filters->>'purpose'),'') = '' or p_listing.purpose = (p_filters->>'purpose'))
  and (coalesce((p_filters->>'categoryId'),'') = '' or p_listing.category_id = nullif((p_filters->>'categoryId'),'')::uuid)
  and (coalesce((p_filters->>'minPrice'),'') = '' or (p_listing.price is not null and p_listing.price >= ((p_filters->>'minPrice')::numeric)))
  and (coalesce((p_filters->>'maxPrice'),'') = '' or (p_listing.price is not null and p_listing.price <= ((p_filters->>'maxPrice')::numeric)))
  and (
    coalesce(trim((p_filters->>'query')),'') = ''
    or lower(p_listing.title) like '%'||lower(trim((p_filters->>'query')))||'%'
    or lower(coalesce(p_listing.description,'')) like '%'||lower(trim((p_filters->>'query')))||'%'
  )
  and (
    coalesce((p_filters->'attributes'),'{}'::jsonb) = '{}'::jsonb
    or p_listing.attributes @> (p_filters->'attributes')
  );
$$;

create or replace function public.notify_classified_saved_searches()
returns trigger language plpgsql security definer set search_path = public
as $$
declare s record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  for s in
    select id,user_id,name
    from public.classified_saved_searches
    where active = true and user_id <> new.owner_id
      and public.classified_saved_search_matches_listing(filters,new)
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id=s.user_id and n.type='saved_search'
        and n.data @> jsonb_build_object('saved_search_id',s.id,'listing_id',new.id)
    ) then
      insert into public.notifications(user_id,type,title,body,data)
      values (
        s.user_id,'saved_search','Novo anúncio encontrado',
        'Um novo anúncio corresponde à sua pesquisa guardada "'||s.name||'".',
        jsonb_build_object('saved_search_id',s.id,'listing_id',new.id,'listing_type',new.listing_type,'purpose',new.purpose)
      );
    end if;
    update public.classified_saved_searches
      set last_notified_at=now(),updated_at=now() where id=s.id;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_classified_saved_searches on public.classified_listings;
create trigger trg_notify_classified_saved_searches
after insert or update of status on public.classified_listings
for each row execute function public.notify_classified_saved_searches();

create index if not exists idx_classified_saved_searches_active_user on public.classified_saved_searches(active,user_id);
create index if not exists idx_notifications_saved_search on public.notifications(user_id,type,created_at desc) where type='saved_search';
