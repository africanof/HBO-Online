-- Notification preferences are stored per saved search (frequency + quiet_until).
-- Do not depend on a non-existent global notification_type_enabled() routine.
create or replace function public.notify_classified_saved_searches()
returns trigger language plpgsql security definer set search_path=public as $$
declare s record;
begin
 if new.status<>'published' or (tg_op='UPDATE' and old.status='published') then return new; end if;
 for s in select id,user_id,name,coalesce(notification_frequency,'immediate') frequency,notification_quiet_until
 from public.classified_saved_searches
 where active=true and user_id<>new.owner_id
   and (notification_quiet_until is null or notification_quiet_until<=now())
   and public.classified_saved_search_matches_listing(filters,new)
 loop
   if s.frequency='daily' then
     insert into public.saved_search_notification_queue(saved_search_id,user_id,listing_id)
     values(s.id,s.user_id,new.id) on conflict do nothing;
   else
     insert into public.notifications(user_id,type,title,body,data)
     values(s.user_id,'saved_search','Novo anúncio encontrado','Um novo anúncio corresponde à sua pesquisa guardada "'||s.name||'".',
       jsonb_build_object('saved_search_id',s.id,'listing_id',new.id,'listing_type',new.listing_type,'purpose',new.purpose))
     on conflict do nothing;
     if found then update public.classified_saved_searches set last_notified_at=now(),updated_at=now() where id=s.id; end if;
   end if;
 end loop;
 return new;
end $$;
revoke all on function public.notify_classified_saved_searches() from public,anon,authenticated;

create or replace function public.flush_daily_saved_search_notifications(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public as $$
declare s record; inserted_count integer:=0;
begin
 for s in select q.saved_search_id,q.user_id,count(*) total,min(q.created_at) first_match,max(q.created_at) last_match,array_agg(q.listing_id order by q.created_at) listing_ids
 from public.saved_search_notification_queue q join public.classified_saved_searches ss on ss.id=q.saved_search_id
 where q.delivered_at is null and (q.processing_at is null or q.processing_at<p_now-interval '15 minutes')
 and ss.active=true and coalesce(ss.notification_frequency,'immediate')='daily'
 and (ss.notification_quiet_until is null or ss.notification_quiet_until<=p_now)
 group by q.saved_search_id,q.user_id loop
   update public.saved_search_notification_queue set processing_at=p_now where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and (processing_at is null or processing_at<p_now-interval '15 minutes');
   if found then
     insert into public.notifications(user_id,type,title,body,data)
     values(s.user_id,'saved_search',case when s.total=1 then 'Novo anúncio encontrado' else s.total||' novos anúncios encontrados' end,
       case when s.total=1 then 'Um novo anúncio corresponde à sua pesquisa guardada.' else s.total||' novos anúncios correspondem à sua pesquisa guardada.' end,
       jsonb_build_object('saved_search_id',s.saved_search_id,'listing_ids',to_jsonb(s.listing_ids),'count',s.total,'digest',true,'first_match_at',s.first_match,'last_match_at',s.last_match))
     on conflict do nothing;
     if found then
       update public.saved_search_notification_queue set delivered_at=p_now,processing_at=null where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and processing_at=p_now;
       update public.classified_saved_searches set last_notified_at=p_now,updated_at=p_now where id=s.saved_search_id;
       inserted_count:=inserted_count+1;
     else
       update public.saved_search_notification_queue set processing_at=null where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null;
     end if;
   end if;
 end loop; return inserted_count;
end $$;
revoke all on function public.flush_daily_saved_search_notifications(timestamptz) from public,anon,authenticated;
grant execute on function public.flush_daily_saved_search_notifications(timestamptz) to service_role;
