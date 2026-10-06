-- Route daily saved-search matches to the digest queue.
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
      elsif not exists (
        select 1 from public.notifications n
        where n.user_id=s.user_id and n.type='saved_search'
          and n.data->>'saved_search_id'=s.id::text
          and n.data->>'listing_id'=new.id::text
      ) then
        insert into public.notifications(user_id,type,title,body,data)
        values(
          s.user_id,'saved_search','Novo anúncio encontrado',
          'Um novo anúncio corresponde à sua pesquisa guardada "'||s.name||'".',
          jsonb_build_object('saved_search_id',s.id,'listing_id',new.id,'listing_type',new.listing_type,'purpose',new.purpose)
        ) on conflict do nothing;
        if found then
          update public.classified_saved_searches set last_notified_at=now(),updated_at=now() where id=s.id;
        end if;
      end if;
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_classified_saved_searches() from public;
