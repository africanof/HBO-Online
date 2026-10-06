-- Enforce saved-search deduplication and immediate/daily frequency.
create unique index if not exists uq_notifications_saved_search_match
on public.notifications (
  user_id,
  ((data->>'saved_search_id')::uuid),
  ((data->>'listing_id')::uuid)
) where type='saved_search'
  and data ? 'saved_search_id'
  and data ? 'listing_id';

create or replace function public.notify_classified_saved_searches()
returns trigger language plpgsql security definer set search_path=public
as $$
declare s record;
begin
  if new.status <> 'published' or (tg_op='UPDATE' and old.status='published') then return new; end if;

  for s in
    select id,user_id,name,coalesce(notification_frequency,'immediate') as frequency,last_notified_at
    from public.classified_saved_searches
    where active=true
      and user_id<>new.owner_id
      and public.classified_saved_search_matches_listing(filters,new)
  loop
    if public.notification_type_enabled(s.user_id,'saved_search')
       and (s.frequency='immediate' or s.last_notified_at is null or s.last_notified_at <= now()-interval '24 hours')
       and not exists (
         select 1 from public.notifications n
         where n.user_id=s.user_id and n.type='saved_search'
           and n.data->>'saved_search_id'=s.id::text
           and n.data->>'listing_id'=new.id::text
       )
    then
      insert into public.notifications(user_id,type,title,body,data)
      values(
        s.user_id,'saved_search','Novo anúncio encontrado',
        'Um novo anúncio corresponde à sua pesquisa guardada "'||s.name||'".',
        jsonb_build_object('saved_search_id',s.id,'listing_id',new.id,'listing_type',new.listing_type,'purpose',new.purpose)
      )
      on conflict do nothing;

      if found then
        update public.classified_saved_searches
        set last_notified_at=now(),updated_at=now()
        where id=s.id;
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_classified_saved_searches on public.classified_listings;
create trigger trg_notify_classified_saved_searches
after insert or update of status on public.classified_listings
for each row execute function public.notify_classified_saved_searches();

revoke execute on function public.notify_classified_saved_searches() from public;