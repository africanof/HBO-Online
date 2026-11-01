-- Documentos (Word e PDF) no chat, só nas conversas sobre anúncios de emprego e estágios.
-- Fotografias continuam a poder ser enviadas em qualquer conversa.
-- Também corrige o reencaminhamento de anexos pela equipa: a cópia da equipa aponta para o
-- ficheiro de quem o enviou (na mesma conversa), o que a regra antiga não deixava.

-- 1) Anexos: a pasta tem de ser a da conversa; a do remetente, salvo quando é a equipa a reencaminhar.
alter table public.messages drop constraint if exists messages_attachment_own_folder;
alter table public.messages add constraint messages_attachment_own_folder check (
  attachment_path is null
  or attachment_path like conversation_id::text || '/' || sender_id::text || '/%'
  or (from_team and attachment_path like conversation_id::text || '/%'));

-- 2) Novo tipo de anexo: documento.
alter table public.messages drop constraint if exists messages_attachment_kind_check;
alter table public.messages add constraint messages_attachment_kind_check
  check (attachment_kind = any (array['image', 'video', 'audio', 'document']));

-- 3) O espaço do chat aceita PDF e Word.
update storage.buckets set allowed_mime_types = (
  select array(select distinct unnest(coalesce(allowed_mime_types, '{}') || array[
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])))
where id = 'chat-media';

-- 4) Categorias de emprego (os documentos só entram nas conversas sobre estes anúncios).
create or replace function public.is_job_listing(p_listing_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.classified_listings l join public.categories c on c.id = l.category_id
                 where l.id = p_listing_id and c.slug in ('emprego', 'estagios-remunerados', 'estagios-nao-remunerados'));
$function$;
revoke all on function public.is_job_listing(uuid) from public, anon;
grant execute on function public.is_job_listing(uuid) to authenticated;

create or replace function public.guard_document_attachment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.attachment_kind = 'document' and not new.from_team
     and not exists (select 1 from public.conversations c where c.id = new.conversation_id and public.is_job_listing(c.classified_listing_id)) then
    raise exception 'DOCUMENTS_ONLY_FOR_JOBS';
  end if;
  return new;
end $function$;
revoke all on function public.guard_document_attachment() from public, anon, authenticated;
drop trigger if exists trg_guard_document_attachment on public.messages;
create trigger trg_guard_document_attachment before insert on public.messages
  for each row execute function public.guard_document_attachment();

-- 5) Pré-visualização nos avisos.
create or replace function public.notify_new_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare p record; c record; preview text;
begin
  if not new.from_team then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  preview := coalesce(nullif(trim(new.body), ''), case new.attachment_kind when 'image' then '📷 Fotografia' when 'video' then '🎬 Vídeo'
    when 'audio' then '🎤 Mensagem de voz' when 'document' then '📄 Documento' else '' end);
  for p in select cp.user_id from public.conversation_participants cp
           where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
             and (new.audience is null or cp.user_id = new.audience) loop
    insert into public.notifications(user_id, type, title, body, data)
    values (p.user_id, 'message', 'Nova mensagem da Equipa Huambo Online', left(preview, 180),
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id, 'listing_id', c.classified_listing_id))
    on conflict do nothing;
  end loop;
  return new;
end $function$;
