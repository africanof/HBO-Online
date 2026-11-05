-- Suporte: a IA responde primeiro (página «Falar com o suporte», sem gravar conversa). Quando a pessoa carrega em
-- «Falar com um agente», abre-se uma conversa de SUPORTE com a Equipa Huambo Online nas Mensagens, com o resumo
-- do que falou com a IA. Nessas conversas:
-- • as mensagens da pessoa ficam à espera da equipa (aparecem no topo do painel Mensagens);
-- • o filtro de contactos não se aplica (a pessoa pode dar o telefone à equipa);
-- • a equipa é avisada quando chega uma mensagem (no máximo um aviso por conversa a cada 10 minutos).

alter table public.conversations drop constraint if exists conversations_context_type_check;
alter table public.conversations add constraint conversations_context_type_check
  check (context_type = any (array['general', 'business', 'provider', 'service', 'product', 'order', 'classified', 'support']));

create or replace function public.open_support_conversation(p_summary text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; txt text := nullif(left(trim(coalesce(p_summary, '')), 3500), '');
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select c.id into cid from public.conversations c where c.created_by = me and c.context_type = 'support' order by c.created_at desc limit 1;
  if cid is null then
    insert into public.conversations(subject, context_type, created_by) values ('Suporte', 'support', me) returning id into cid;
    insert into public.conversation_participants(conversation_id, user_id) values (cid, me);
  end if;
  insert into public.messages(conversation_id, sender_id, body)
  values (cid, me, coalesce('👤 Quero falar com um agente.' || E'\n\n' || 'Conversa com o assistente:' || E'\n' || txt, '👤 Quero falar com um agente.'));
  return cid;
end $$;
revoke all on function public.open_support_conversation(text) from public, anon;
grant execute on function public.open_support_conversation(text) to authenticated;

-- Filtro de mensagens: nas conversas de suporte, nada é bloqueado e tudo fica à espera da equipa.
do $$ declare d text := pg_get_functiondef('public.zz_messages_contact_filter()'::regprocedure);
  o text := $o$  if new.attachment_kind is not null then return new; end if; -- anexos: continuam a passar pela equipa$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND zz_messages_contact_filter'; end if;
  if strpos(d, 'support') = 0 then
    execute replace(d, o, $n$  if exists (select 1 from public.conversations c where c.id = new.conversation_id and c.context_type = 'support') then
    -- Suporte: aviso à equipa (no máximo um a cada 10 minutos por conversa).
    if not exists (select 1 from public.notifications n where n.data->>'support_conversation_id' = new.conversation_id::text and n.created_at > now() - interval '10 minutes') then
      perform public.notify_staff('🆘 Pedido de suporte', coalesce(public.shown_name(new.sender_id), 'Utilizador') || ': ' || left(coalesce(new.body, '📎 anexo'), 140),
        jsonb_build_object('support_conversation_id', new.conversation_id, 'tab', 'messages'));
    end if;
    return new;
  end if;
$n$ || o);
  end if;
end $$;

-- Quem está suspenso das mensagens continua a poder escrever ao suporte.
do $$ declare d text := pg_get_functiondef('public.zz_messages_contact_filter()'::regprocedure);
  o text := $o$if exists (select 1 from public.chat_suspensions where user_id = new.sender_id and until > now()) then raise exception 'CHAT_SUSPENDED'; end if;$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND suspension'; end if;
  execute replace(d, o, $n$if exists (select 1 from public.chat_suspensions where user_id = new.sender_id and until > now())
     and not exists (select 1 from public.conversations c where c.id = new.conversation_id and c.context_type = 'support') then raise exception 'CHAT_SUSPENDED'; end if;$n$);
end $$;
