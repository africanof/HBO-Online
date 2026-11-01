-- Mensagens mediadas pela equipa (intermediária total).
--
-- Os utilizadores nunca falam diretamente uns com os outros:
-- • Cada pessoa só vê as mensagens que ela própria escreveu e as mensagens da equipa
--   dirigidas a ela (ou às duas partes).
-- • A equipa (administradores e moderadores) lê todas as conversas e reencaminha ou
--   responde a cada lado, em nome da «Equipa Huambo Online».
-- • A outra parte não é identificada: na lista de conversas aparece «Equipa Huambo Online».
-- • As fotografias, vídeos e áudios só chegam ao outro lado se a equipa os reencaminhar.

alter table public.messages
  add column if not exists from_team boolean not null default false,
  add column if not exists audience uuid references auth.users(id) on delete set null,
  add column if not exists forwarded_from uuid references public.messages(id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users(id) on delete set null;
create index if not exists messages_pending_idx on public.messages (created_at) where not from_team and handled_at is null;

-- Só a equipa escreve como «equipa»; ninguém marca mensagens como tratadas por fora das funções.
create or replace function public.guard_team_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.from_team and not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
    if not new.from_team then new.audience := null; new.forwarded_from := null; end if;
    new.handled_at := null; new.handled_by := null;
  elsif not public.has_admin_role() and current_user not in ('postgres', 'supabase_admin') then
    new.from_team := old.from_team; new.audience := old.audience; new.forwarded_from := old.forwarded_from;
    new.handled_at := old.handled_at; new.handled_by := old.handled_by;
  end if;
  return new;
end $function$;
revoke all on function public.guard_team_message() from public, anon, authenticated;
drop trigger if exists trg_guard_team_message on public.messages;
create trigger trg_guard_team_message before insert or update on public.messages
  for each row execute function public.guard_team_message();

-- Quem vê cada mensagem.
create or replace function public.can_read_message(p_conversation_id uuid, p_sender_id uuid, p_from_team boolean, p_audience uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p_sender_id = auth.uid()
      or public.has_admin_role()
      or (p_from_team and (p_audience is null or p_audience = auth.uid())
          and exists (select 1 from public.conversation_participants cp where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid()));
$function$;
revoke all on function public.can_read_message(uuid, uuid, boolean, uuid) from public, anon;
grant execute on function public.can_read_message(uuid, uuid, boolean, uuid) to authenticated;

drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select to authenticated
  using (public.can_read_message(conversation_id, sender_id, from_team, audience));

-- A equipa vê todas as conversas e quem participa nelas.
drop policy if exists conversations_team_read on public.conversations;
create policy conversations_team_read on public.conversations for select to authenticated using ((select public.has_admin_role()));
drop policy if exists participants_team_read on public.conversation_participants;
create policy participants_team_read on public.conversation_participants for select to authenticated using ((select public.has_admin_role()));

-- Anexos: cada um vê os seus, os que a equipa lhe reencaminhou, e a equipa vê todos.
drop policy if exists "huambo chat media read" on storage.objects;
create policy "huambo chat media read" on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select public.has_admin_role())
    or exists (select 1 from public.messages m
               join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = (select auth.uid())
               where m.attachment_path = objects.name and m.from_team and (m.audience is null or m.audience = (select auth.uid())))
  ));

-- Avisos: a mensagem de um utilizador não avisa o outro lado; a da equipa avisa o destinatário.
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
  preview := coalesce(nullif(trim(new.body), ''), case new.attachment_kind when 'image' then '📷 Fotografia' when 'video' then '🎬 Vídeo' when 'audio' then '🎤 Mensagem de voz' else '' end);
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

-- Na lista de conversas, a outra parte aparece como «Equipa Huambo Online» (a equipa vê os nomes).
create or replace function public.my_conversation_partners()
 returns table(conversation_id uuid, other_user_id uuid, other_name text, other_avatar text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select distinct on (me.conversation_id) me.conversation_id,
         case when public.has_admin_role() then o.user_id end,
         case when public.has_admin_role() then coalesce(nullif(p.full_name, ''), 'Utilizador') else 'Equipa Huambo Online' end,
         case when public.has_admin_role() then p.avatar_url end
  from public.conversation_participants me
  join public.conversation_participants o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  left join public.profiles p on p.id = o.user_id
  where me.user_id = auth.uid()
  order by me.conversation_id, o.joined_at;
$function$;

-- ───────────── Ferramentas da equipa ─────────────

/** Conversas para a equipa: as que têm mensagens por tratar primeiro. */
create or replace function public.admin_list_mediated_conversations(p_pending_only boolean default true, p_limit integer default 50)
 returns table(conversation_id uuid, subject text, context_type text, classified_listing_id uuid, updated_at timestamptz,
               pending bigint, last_message_at timestamptz, participants jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select c.id, c.subject, c.context_type, c.classified_listing_id, c.updated_at,
         (select count(*) from public.messages m where m.conversation_id = c.id and not m.from_team and m.handled_at is null),
         (select max(m.created_at) from public.messages m where m.conversation_id = c.id),
         (select coalesce(jsonb_agg(jsonb_build_object('user_id', cp.user_id, 'name', coalesce(nullif(pr.full_name, ''), 'Utilizador'),
                   'role', case when cp.user_id = c.created_by then 'starter' else 'owner' end) order by cp.joined_at), '[]'::jsonb)
            from public.conversation_participants cp left join public.profiles pr on pr.id = cp.user_id where cp.conversation_id = c.id)
  from public.conversations c
  where not coalesce(p_pending_only, true)
     or exists (select 1 from public.messages m where m.conversation_id = c.id and not m.from_team and m.handled_at is null)
  order by 6 desc, 7 desc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end $function$;
revoke all on function public.admin_list_mediated_conversations(boolean, integer) from public, anon;
grant execute on function public.admin_list_mediated_conversations(boolean, integer) to authenticated;

/** Número de mensagens à espera da equipa (para o painel). */
create or replace function public.admin_pending_messages_count()
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when public.has_admin_role()
    then (select count(*) from public.messages where not from_team and handled_at is null) else 0 end;
$function$;
revoke all on function public.admin_pending_messages_count() from public, anon;
grant execute on function public.admin_pending_messages_count() to authenticated;

/**
 * A equipa escreve a uma das partes (p_audience) ou às duas (null).
 * Com p_forward_message_id reencaminha essa mensagem (texto e anexo) e marca-a como tratada.
 */
create or replace function public.team_send_message(p_conversation_id uuid, p_audience uuid, p_body text, p_forward_message_id uuid default null)
 returns public.messages
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare src public.messages; out_msg public.messages; txt text;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_audience is not null and not exists (select 1 from public.conversation_participants where conversation_id = p_conversation_id and user_id = p_audience) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  txt := nullif(trim(coalesce(p_body, '')), '');
  if p_forward_message_id is not null then
    select * into src from public.messages where id = p_forward_message_id and conversation_id = p_conversation_id and not from_team;
    if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
    insert into public.messages(conversation_id, sender_id, body, attachment_kind, attachment_path, attachment_seconds, from_team, audience, forwarded_from)
    values (p_conversation_id, auth.uid(), coalesce(txt, src.body), src.attachment_kind, src.attachment_path, src.attachment_seconds, true, p_audience, src.id)
    returning * into out_msg;
    update public.messages set handled_at = now(), handled_by = auth.uid() where id = src.id;
  else
    if txt is null then raise exception 'MESSAGE_REQUIRED'; end if;
    insert into public.messages(conversation_id, sender_id, body, from_team, audience)
    values (p_conversation_id, auth.uid(), left(txt, 4000), true, p_audience) returning * into out_msg;
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_forward_message_id is null then 'team_message' else 'forward_message' end, 'conversation', p_conversation_id,
          jsonb_build_object('message_id', out_msg.id, 'audience', p_audience, 'forwarded_from', p_forward_message_id));
  return out_msg;
end $function$;
revoke all on function public.team_send_message(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.team_send_message(uuid, uuid, text, uuid) to authenticated;

/** Marcar uma mensagem como tratada sem a reencaminhar (por exemplo, conteúdo impróprio). */
create or replace function public.admin_mark_message_handled(p_message_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.messages set handled_at = now(), handled_by = auth.uid() where id = p_message_id and not from_team and handled_at is null;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'message_handled', 'message', p_message_id, '{}'::jsonb);
end $function$;
revoke all on function public.admin_mark_message_handled(uuid) from public, anon;
grant execute on function public.admin_mark_message_handled(uuid) to authenticated;
