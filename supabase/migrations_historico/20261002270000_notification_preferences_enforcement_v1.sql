-- Enforce universal notification preferences for generated notifications.
-- System notifications remain enabled when the global switch is on.
create or replace function public.notification_type_enabled(p_user_id uuid,p_type text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select case
    when p_type='system' then coalesce((select enabled from public.notification_preferences where user_id=p_user_id),true)
    else coalesce((select enabled and case p_type
      when 'saved_search' then saved_search
      when 'message' then messages
      when 'order' then marketplace
      when 'auction' then auctions
      when 'bid' then auctions
      when 'delivery' then marketplace
      when 'review' then reviews
      when 'rental' then rentals
      else system end from public.notification_preferences where user_id=p_user_id),true)
  end;
$$;

revoke all on function public.notification_type_enabled(uuid,text) from public;
grant execute on function public.notification_type_enabled(uuid,text) to authenticated,service_role;

create or replace function public.notify_classified_saved_searches()
returns trigger language plpgsql security definer set search_path=public
as $$
declare s record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  for s in
    select id,user_id,name from public.classified_saved_searches
    where active=true and user_id<>new.owner_id
      and public.classified_saved_search_matches_listing(filters,new)
  loop
    if public.notification_type_enabled(s.user_id,'saved_search')
       and not exists(select 1 from public.notifications n where n.user_id=s.user_id and n.type='saved_search' and n.data @> jsonb_build_object('saved_search_id',s.id,'listing_id',new.id))
    then
      insert into public.notifications(user_id,type,title,body,data)
      values(s.user_id,'saved_search','Novo anúncio encontrado','Um novo anúncio corresponde à sua pesquisa guardada "'||s.name||'".',
        jsonb_build_object('saved_search_id',s.id,'listing_id',new.id,'listing_type',new.listing_type,'purpose',new.purpose));
      update public.classified_saved_searches set last_notified_at=now(),updated_at=now() where id=s.id;
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.notify_classified_saved_searches() from public;
