-- Consolidate saved-search notification execution after incremental migrations.
-- Ensures exactly one trigger and one canonical function definition.
create or replace function public.notify_classified_saved_searches()
returns trigger language plpgsql security definer set search_path=public
as $$
declare s record;
begin
  if new.status <> 'published' or (tg_op='UPDATE' and old.status='published') then return new; end if;
  for s in
    select id,user_id,name,coalesce(notification_frequency,'immediate') as frequency
    from public.classified_saved_searches
    where active=true and user_id<>new.owner_id
      and public.classified_saved_search_matches_listing(filters,new)
  loop
    if public.notification_type_enabled(s.user_id,'saved_search') then
      if s.frequency='daily' then
        insert into public.saved_search_notification_queue(saved_search_id,user_id,listing_id)
        values(s.id,s.user_id,new.id)
        on conflict do nothing;
      else
        insert into public.notifications(user_id,type,title,body,data)
        values(s.user_id,'saved_search','Novo anúncio encontrado',
          'Um novo anúncio corresponde à sua pesquisa guardada "'||s.name||'".',
          jsonb_build_object('saved_search_id',s.id,'listing_id',new.id,'listing_type',new.listing_type,'purpose',new.purpose))
        on conflict do nothing;
        if found then
          update public.classified_saved_searches set last_notified_at=now(),updated_at=now() where id=s.id;
        end if;
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

revoke execute on function public.notify_classified_saved_searches() from anon,authenticated,public;
revoke execute on function public.classified_saved_search_matches_listing(jsonb,public.classified_listings) from anon,authenticated,public;