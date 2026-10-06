create or replace function public.notify_new_message() returns trigger language plpgsql security definer set search_path=public as $$
declare p record; c record;
begin
 select * into c from public.conversations where id=new.conversation_id;
 for p in select cp.user_id from public.conversation_participants cp where cp.conversation_id=new.conversation_id and cp.user_id<>new.sender_id loop
   insert into public.notifications(user_id,type,title,body,data)
   values(p.user_id,'message','Nova mensagem',left(new.body,180),jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id,'listing_id',c.classified_listing_id))
   on conflict do nothing;
 end loop;
 return new;
end $$;
drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message after insert on public.messages for each row execute function public.notify_new_message();
revoke execute on function public.notify_new_message() from public;
