-- Conversas: deixa passar só o «📍 Ponto de encontro» enviado pela APP (≈100 m, sem outros números),
-- no máximo um por hora por pessoa e conversa. Qualquer outra ligação continua bloqueada.
create or replace function public.is_meeting_point(p_body text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_body, '') ~ '^📍 (Ponto de encontro|Meeting point|见面地点|Point de rendez-vous) ?[:：] ?https://www\.google\.com/maps/search/\?api=1&query=-?[0-9]{1,2}\.[0-9]{3},-?[0-9]{1,2}\.[0-9]{3}$'
$$;

CREATE OR REPLACE FUNCTION public.zz_messages_contact_filter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r text; recent text;
begin
  if new.from_team then return new; end if;
  if tg_op = 'UPDATE' then
    if new.body is distinct from old.body and new.attachment_kind is null and public.chat_contact_reason(new.body) is not null then raise exception 'CONTACT_BLOCKED'; end if;
    return new;
  end if;
  if exists (select 1 from public.chat_suspensions where user_id = new.sender_id and until > now())
     and not exists (select 1 from public.conversations c where c.id = new.conversation_id and c.context_type = 'support') then raise exception 'CHAT_SUSPENDED'; end if;
  if exists (select 1 from public.conversations c where c.id = new.conversation_id and c.context_type = 'support') then
    -- Suporte: aviso à equipa (no máximo um a cada 10 minutos por conversa).
    if not exists (select 1 from public.notifications n where n.data->>'support_conversation_id' = new.conversation_id::text and n.created_at > now() - interval '10 minutes') then
      perform public.notify_staff('🆘 Pedido de suporte', coalesce(public.shown_name(new.sender_id), 'Utilizador') || ': ' || left(coalesce(new.body, '📎 anexo'), 140),
        jsonb_build_object('support_conversation_id', new.conversation_id, 'tab', 'messages'));
    end if;
    return new;
  end if;
  if new.attachment_kind is not null then return new; end if; -- anexos: continuam a passar pela equipa
  -- Ponto de encontro da APP (formato exato, um por hora).
  if public.is_meeting_point(new.body) and not exists (select 1 from public.messages m where m.conversation_id = new.conversation_id and m.sender_id = new.sender_id
       and m.created_at > now() - interval '1 hour' and public.is_meeting_point(m.body) and m.blocked_reason is null) then
    new.handled_at := now();
    return new;
  end if;
  r := public.chat_contact_reason(new.body);
  if r is null then
    -- Número partido em várias mensagens seguidas (últimos 15 minutos).
    select string_agg(m.body, ' ' order by m.created_at) into recent from (
      select body, created_at from public.messages where conversation_id = new.conversation_id and sender_id = new.sender_id and not from_team
        and attachment_kind is null and blocked_reason is null and not public.is_meeting_point(body) and created_at > now() - interval '15 minutes' order by created_at desc limit 4) m;
    if recent is not null and public.chat_contact_reason(recent || ' ' || new.body) in ('phone', 'number') then r := 'split'; end if;
  end if;
  new.handled_at := now(); -- não fica à espera da equipa
  if r is not null then
    new.blocked_reason := r;
    perform public._chat_strike(new.sender_id, new.conversation_id, new.id, r, new.body);
  end if;
  return new;
end $function$;
