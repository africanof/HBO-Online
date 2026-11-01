-- Chat: fotografias, vídeos e mensagens de voz (Site e APP).
-- Ficheiros num bucket PRIVADO (chat-media), na pasta «conversa/remetente/…». Só quem está na conversa os vê.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 31457280, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/3gpp', 'audio/wav'])
on conflict (id) do nothing;

create policy "huambo chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and exists (select 1 from public.conversation_participants cp
    where cp.conversation_id::text = (storage.foldername(name))[1] and cp.user_id = (select auth.uid())));
create policy "huambo chat media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[1] and cp.user_id = (select auth.uid())));
create policy "huambo chat media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[2] = (select auth.uid())::text);

alter table public.messages add column if not exists attachment_kind text check (attachment_kind in ('image', 'video', 'audio'));
alter table public.messages add column if not exists attachment_path text;
alter table public.messages add column if not exists attachment_seconds integer check (attachment_seconds is null or attachment_seconds between 0 and 600);
alter table public.messages add constraint messages_attachment_both check ((attachment_kind is null) = (attachment_path is null));
alter table public.messages add constraint messages_attachment_own_folder
  check (attachment_path is null or attachment_path like conversation_id::text || '/' || sender_id::text || '/%');
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (length(trim(body)) > 0 or attachment_path is not null);

-- Aviso com o tipo do anexo quando não há texto.
create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; c record; preview text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  preview := coalesce(nullif(trim(new.body), ''), case new.attachment_kind when 'image' then '📷 Fotografia' when 'video' then '🎬 Vídeo' when 'audio' then '🎤 Mensagem de voz' else '' end);
  for p in select cp.user_id from public.conversation_participants cp where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id loop
    insert into public.notifications(user_id, type, title, body, data)
    values (p.user_id, 'message', 'Nova mensagem', left(preview, 180),
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id, 'listing_id', c.classified_listing_id))
    on conflict do nothing;
  end loop;
  return new;
end $$;
