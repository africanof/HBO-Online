-- Mensagens diretas entre utilizadores, com bloqueio de contactos.
--
-- • O TEXTO passa a ir diretamente à outra parte (sem esperar pela equipa).
-- • Cada mensagem é verificada ANTES de ser entregue (regras fixas na base de dados, instantâneas):
--   telefones (também escritos por extenso ou partidos), e-mails, ligações, WhatsApp/Telegram,
--   @utilizador, IBAN/NIB e números de conta. Se tiver contactos, NÃO é entregue: fica só visível
--   para quem a escreveu, marcada como bloqueada.
-- • Depois, a IA (Edge Function «ai-chat-guard», a cada minuto) revê as mensagens com números ou
--   palavras suspeitas, para apanhar contactos disfarçados; se encontrar, retira a mensagem.
-- • À 3.ª tentativa em 7 dias, a pessoa fica 24 horas sem poder enviar mensagens e a equipa é avisada.
-- • Fotografias, áudios, vídeos e documentos continuam a passar primeiro pela equipa (como antes).
-- • A equipa continua a poder ler todas as conversas.

alter table public.messages add column if not exists blocked_reason text,
  add column if not exists ai_checked_at timestamptz;
create index if not exists messages_ai_queue_idx on public.messages (created_at)
  where not from_team and attachment_kind is null and blocked_reason is null and ai_checked_at is null;

create table if not exists public.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid,
  reason text not null,
  excerpt text,
  created_at timestamptz not null default now()
);
create index if not exists chat_blocks_user_idx on public.chat_blocks(user_id, created_at desc);
alter table public.chat_blocks enable row level security;
drop policy if exists chat_blocks_team_read on public.chat_blocks;
create policy chat_blocks_team_read on public.chat_blocks for select to authenticated using ((select public.has_admin_role()));
grant select on public.chat_blocks to authenticated;

create table if not exists public.chat_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null,
  strikes int not null default 3,
  created_at timestamptz not null default now()
);
alter table public.chat_suspensions enable row level security;
drop policy if exists chat_suspensions_read on public.chat_suspensions;
create policy chat_suspensions_read on public.chat_suspensions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));
grant select on public.chat_suspensions to authenticated;

-- Motivo (código) se o texto tiver contactos; null se estiver limpo.
create or replace function public.chat_contact_reason(p_text text)
returns text language plpgsql immutable set search_path = public as $$
declare s text; d text;
begin
  if p_text is null or btrim(p_text) = '' then return null; end if;
  s := translate(lower(p_text), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  s := regexp_replace(s, 'https?://(www\.)?huamboonline\.com\S*|(www\.)?huamboonline\.com\S*', ' ', 'g');
  -- E-mail
  if s ~ '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\marroba\M)\s*[a-z0-9-]+\s*(\.|\mponto\M|\mdot\M)\s*[a-z]{2,}'
     or s ~ '\m(gmail|hotmail|yahoo|outlook|icloud|live\.com)\M' then return 'email'; end if;
  -- Ligações
  if s ~ '(https?://|www\.|wa\.me|t\.me|bit\.ly|linktr\.ee)' or s ~ '[a-z0-9-]{2,}\.(com|ao|net|org|pt|br|me|ly|io|co)\M' then return 'link'; end if;
  -- Aplicações de mensagens
  if s ~ '\m(whats\s*app|whatsap+|wats\s*ap+|wh?atsap+|zap|zapzap|watzap|telegram|telegrama|signal|wechat|imo|messenger)\M' then return 'app'; end if;
  -- @utilizador (Instagram, TikTok, …)
  if s ~ '(^|[\s:(])@[a-z0-9._]{3,}' then return 'handle'; end if;
  -- Dados bancários
  if s ~ '\m(iban|nib|swift)\M' or s ~ '\mao\s*\d{2}([\s.\-]*\d){15,}' then return 'bank'; end if;
  -- Números escritos por extenso → algarismos
  s := regexp_replace(s, '\mzero\M', '0', 'g'); s := regexp_replace(s, '\m(um|uma)\M', '1', 'g'); s := regexp_replace(s, '\m(dois|duas)\M', '2', 'g');
  s := regexp_replace(s, '\mtres\M', '3', 'g'); s := regexp_replace(s, '\mquatro\M', '4', 'g'); s := regexp_replace(s, '\mcinco\M', '5', 'g');
  s := regexp_replace(s, '\mseis\M', '6', 'g'); s := regexp_replace(s, '\msete\M', '7', 'g'); s := regexp_replace(s, '\moito\M', '8', 'g');
  s := regexp_replace(s, '\mnove\M', '9', 'g');
  -- Tira preços, datas e horas (não são contactos)
  s := regexp_replace(s, '(kz|akz|aoa|usd|\$|€)\s*\d[\d\s.,]*', ' ', 'g');
  s := regexp_replace(s, '\d[\d\s.,]*\s*(kz|akz|kwanzas?|aoa|usd|\$|€|euros?|dolares|mil\M|milhoes|milhao|contos)', ' ', 'g');
  s := regexp_replace(s, '(^|\D)(0?[1-9]|[12]\d|3[01])\s*[/.\-]\s*(0?[1-9]|1[0-2])\s*[/.\-]\s*(19|20)?\d{2}(\D|$)', ' ', 'g');
  s := regexp_replace(s, '\d{1,2}\s*[:h]\s*\d{2}', ' ', 'g');
  -- Junta algarismos separados por espaços, pontos, traços, barras ou parênteses
  d := regexp_replace(s, '(\d)[\s.\-_/,()*+|]+(?=\d)', '\1', 'g');
  if d ~ '(^|\D)(\+?244)?[29]\d{8}(\D|$)' then return 'phone'; end if;
  if d ~ '\d{10,}' then return 'number'; end if;
  return null;
end $$;

create or replace function public._chat_strike(p_user uuid, p_conv uuid, p_msg uuid, p_reason text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare since timestamptz; n int;
begin
  insert into public.chat_blocks(user_id, conversation_id, message_id, reason, excerpt) values (p_user, p_conv, p_msg, p_reason, left(p_body, 300));
  since := greatest(now() - interval '7 days', coalesce((select until from public.chat_suspensions where user_id = p_user), '-infinity'::timestamptz));
  select count(*) into n from public.chat_blocks where user_id = p_user and created_at > since;
  if n >= 3 then
    insert into public.chat_suspensions(user_id, until, strikes) values (p_user, now() + interval '24 hours', n)
      on conflict (user_id) do update set until = excluded.until, strikes = excluded.strikes, created_at = now();
    insert into public.notifications(user_id, type, title, body, data) values (p_user, 'system', '🚫 Mensagens suspensas por 24 horas',
      'Tentou partilhar contactos ou dados bancários 3 vezes. Combine tudo nas mensagens do Huambo Online e pague com o pagamento protegido.', jsonb_build_object('for', 'messages'));
    perform public.notify_staff('🚫 Utilizador suspenso das mensagens (24 h)', coalesce((select full_name from public.profiles where id = p_user), 'Utilizador') || ' · ' || n || ' tentativas de partilhar contactos.',
      jsonb_build_object('user_id', p_user, 'conversation_id', p_conv, 'tab', 'messages'));
  end if;
  return n;
end $$;
revoke all on function public._chat_strike(uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- Antes de gravar: suspensão, filtro de contactos e entrega direta do texto.
create or replace function public.zz_messages_contact_filter()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text; recent text;
begin
  if new.from_team then return new; end if;
  if tg_op = 'UPDATE' then
    if new.body is distinct from old.body and new.attachment_kind is null and public.chat_contact_reason(new.body) is not null then raise exception 'CONTACT_BLOCKED'; end if;
    return new;
  end if;
  if exists (select 1 from public.chat_suspensions where user_id = new.sender_id and until > now()) then raise exception 'CHAT_SUSPENDED'; end if;
  if new.attachment_kind is not null then return new; end if; -- anexos: continuam a passar pela equipa
  r := public.chat_contact_reason(new.body);
  if r is null then
    -- Número partido em várias mensagens seguidas (últimos 15 minutos).
    select string_agg(m.body, ' ' order by m.created_at) into recent from (
      select body, created_at from public.messages where conversation_id = new.conversation_id and sender_id = new.sender_id and not from_team
        and attachment_kind is null and blocked_reason is null and created_at > now() - interval '15 minutes' order by created_at desc limit 4) m;
    if recent is not null and public.chat_contact_reason(recent || ' ' || new.body) in ('phone', 'number') then r := 'split'; end if;
  end if;
  new.handled_at := now(); -- não fica à espera da equipa
  if r is not null then
    new.blocked_reason := r;
    perform public._chat_strike(new.sender_id, new.conversation_id, new.id, r, new.body);
  end if;
  return new;
end $$;
revoke all on function public.zz_messages_contact_filter() from public, anon, authenticated;
drop trigger if exists zz_messages_contact_filter on public.messages;
create trigger zz_messages_contact_filter before insert or update on public.messages for each row execute function public.zz_messages_contact_filter();

-- Quem vê cada mensagem: quem escreveu, a equipa, e a outra parte quando é texto entregue
-- (ou mensagem da equipa para ela).
create or replace function public.can_read_message_v2(p_conversation_id uuid, p_sender_id uuid, p_from_team boolean, p_audience uuid, p_attachment text, p_blocked text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_sender_id = auth.uid()
      or public.has_admin_role()
      or (exists (select 1 from public.conversation_participants cp where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid())
          and ((p_from_team and (p_audience is null or p_audience = auth.uid()))
            or (not p_from_team and p_attachment is null and p_blocked is null)));
$$;
revoke all on function public.can_read_message_v2(uuid, uuid, boolean, uuid, text, text) from public, anon;
grant execute on function public.can_read_message_v2(uuid, uuid, boolean, uuid, text, text) to authenticated;
drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select to authenticated
  using (public.can_read_message_v2(conversation_id, sender_id, from_team, audience, attachment_kind, blocked_reason));

-- Avisos: mensagens da equipa (como antes) e, agora, texto entregue diretamente.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $function$
declare p record; c record; preview text; who text;
begin
  if not new.from_team and (new.attachment_kind is not null or new.blocked_reason is not null) then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  preview := coalesce(nullif(trim(new.body), ''), case new.attachment_kind when 'image' then '📷 Fotografia' when 'video' then '🎬 Vídeo'
    when 'audio' then '🎤 Mensagem de voz' when 'document' then '📄 Documento' else '' end);
  who := case when new.from_team then 'Equipa Huambo Online' else coalesce(nullif(split_part(trim((select full_name from public.profiles where id = new.sender_id)), ' ', 1), ''), 'Utilizador') end;
  for p in select cp.user_id from public.conversation_participants cp
           where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
             and (not new.from_team or new.audience is null or cp.user_id = new.audience) loop
    insert into public.notifications(user_id, type, title, body, data)
    values (p.user_id, 'message', 'Nova mensagem de ' || who, left(preview, 180),
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id, 'listing_id', c.classified_listing_id))
    on conflict do nothing;
  end loop;
  return new;
end $function$;

-- Na lista de conversas aparece o nome da outra pessoa.
create or replace function public.my_conversation_partners()
returns table(conversation_id uuid, other_user_id uuid, other_name text, other_avatar text)
language sql stable security definer set search_path = public as $function$
  select distinct on (me.conversation_id) me.conversation_id, o.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url
  from public.conversation_participants me
  join public.conversation_participants o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  left join public.profiles p on p.id = o.user_id
  where me.user_id = auth.uid()
  order by me.conversation_id, o.joined_at;
$function$;

-- Mensagens de texto antigas que ainda esperavam pela equipa passam a ser entregues (se não tiverem contactos).
update public.messages set handled_at = now()
  where not from_team and attachment_kind is null and handled_at is null and public.chat_contact_reason(body) is null;
update public.messages set handled_at = now(), blocked_reason = public.chat_contact_reason(body)
  where not from_team and attachment_kind is null and handled_at is null;

-- ───────── IA: revisão de contactos disfarçados (Edge Function «ai-chat-guard») ─────────
create or replace function public.ai_chat_queue(p_limit int default 20)
returns table(message_id uuid, body text, context text)
language sql stable security definer set search_path = public as $$
  select m.id, m.body,
    (select string_agg(x.body, E'\n' order by x.created_at) from (
       select body, created_at from public.messages y where y.conversation_id = m.conversation_id and y.sender_id = m.sender_id and not y.from_team
         and y.attachment_kind is null and y.created_at < m.created_at and y.created_at > m.created_at - interval '30 minutes' order by y.created_at desc limit 5) x)
  from public.messages m
  where not m.from_team and m.attachment_kind is null and m.blocked_reason is null and m.ai_checked_at is null
    and m.created_at > now() - interval '2 hours'
    and (m.body ~ '\d.*\d.*\d'
      or translate(lower(m.body), 'áàâãéêíóôõúç', 'aaaaeeiooouc') ~ '\m(zero|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|contact|contacto|contato|numero|telefone|telemovel|celular|liga|ligar|ligue|chama|chamar|verde|whats|wats|zap|insta|face|tiktok|mail|arroba|conta|banco|iban|nib|express|transfer|deposito|fora)\w*')
  order by m.created_at limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.ai_chat_verdict(p_message_id uuid, p_contact boolean, p_kind text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m public.messages;
begin
  select * into m from public.messages where id = p_message_id for update;
  if not found then return; end if;
  if p_contact and m.blocked_reason is null then
    update public.messages set blocked_reason = 'ai_' || coalesce(nullif(left(regexp_replace(lower(p_kind), '[^a-z_]', '', 'g'), 20), ''), 'contact'), ai_checked_at = now() where id = m.id;
    insert into public.notifications(user_id, type, title, body, data) values (m.sender_id, 'system', '🚫 Mensagem retirada',
      'Uma mensagem sua parecia ter contactos ou dados bancários e foi retirada. Combine tudo aqui e pague com o pagamento protegido.',
      jsonb_build_object('for', 'messages', 'conversation_id', m.conversation_id));
    perform public._chat_strike(m.sender_id, m.conversation_id, m.id, 'ai_' || coalesce(p_kind, 'contact'), m.body);
  else
    update public.messages set ai_checked_at = now() where id = m.id;
  end if;
end $$;
revoke all on function public.ai_chat_queue(int), public.ai_chat_verdict(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.ai_chat_queue(int), public.ai_chat_verdict(uuid, boolean, text) to service_role;

-- Equipa: suspensões em curso e levantar uma suspensão.
create or replace function public.admin_list_chat_suspensions()
returns table(user_id uuid, name text, until timestamptz, strikes int, last_reason text, last_excerpt text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select s.user_id, coalesce(p.full_name, 'Utilizador'), s.until, s.strikes,
      (select b.reason from public.chat_blocks b where b.user_id = s.user_id order by b.created_at desc limit 1),
      (select b.excerpt from public.chat_blocks b where b.user_id = s.user_id order by b.created_at desc limit 1)
    from public.chat_suspensions s left join public.profiles p on p.id = s.user_id where s.until > now() order by s.until desc;
end $$;
create or replace function public.admin_lift_chat_suspension(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.chat_suspensions set until = now() where user_id = p_user;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details) values (auth.uid(), 'chat_suspension_lifted', 'user', p_user, '{}'::jsonb);
end $$;
revoke all on function public.admin_list_chat_suspensions(), public.admin_lift_chat_suspension(uuid) from public, anon;
grant execute on function public.admin_list_chat_suspensions(), public.admin_lift_chat_suspension(uuid) to authenticated;

-- A cada minuto, se houver mensagens suspeitas por rever, chama a IA.
select cron.unschedule('huambo-online-ai-chat-guard') where exists (select 1 from cron.job where jobname = 'huambo-online-ai-chat-guard');
select cron.schedule('huambo-online-ai-chat-guard', '* * * * *', $$
  select net.http_post('https://pewymvkowbdizdiyjmao.supabase.co/functions/v1/ai-chat-guard', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'huambo_cron_anon_key')), 30000)
  where exists (select 1 from public.ai_chat_queue(1))
$$);
