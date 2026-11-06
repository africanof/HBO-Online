-- WhatsApp da equipa (API oficial da Meta, WhatsApp Cloud API) com a IA a responder primeiro.
-- • whatsapp_numbers: os números da empresa (vários), cada um com a sua área e as suas instruções para a IA.
-- • whatsapp_threads: uma conversa por número e por cliente. status «ai» = a IA responde; «human» = à espera da
--   equipa (a IA cala-se); «closed» = arrumada (a próxima mensagem do cliente volta à IA).
-- • whatsapp_messages: tudo o que entra e sai (cliente, IA, equipa).
-- Quem recebe e responde é a Edge Function «whatsapp-webhook»; a equipa responde pela «whatsapp-send».
-- Sem os segredos WHATSAPP_TOKEN / WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN nada é enviado nem recebido.

create table if not exists public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,30}$'),
  display_phone text check (char_length(display_phone) <= 30),
  label text not null check (char_length(trim(label)) between 2 and 60),
  area text not null default 'support' check (area in ('support', 'imports', 'inspections', 'sales', 'other')),
  ai_enabled boolean not null default true,
  ai_instructions text check (char_length(ai_instructions) <= 3000),
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_threads (
  id uuid primary key default gen_random_uuid(),
  number_id uuid not null references public.whatsapp_numbers(id) on delete cascade,
  wa_id text not null check (wa_id ~ '^[0-9]{6,20}$'),
  contact_name text check (char_length(contact_name) <= 120),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'ai' check (status in ('ai', 'human', 'closed')),
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  handed_over_at timestamptz,
  unread int not null default 0,
  created_at timestamptz not null default now(),
  unique (number_id, wa_id)
);
create index if not exists whatsapp_threads_status_idx on public.whatsapp_threads(status, last_message_at desc);
create index if not exists whatsapp_threads_user_idx on public.whatsapp_threads(user_id);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.whatsapp_threads(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  author text not null check (author in ('customer', 'ai', 'team', 'system')),
  team_user_id uuid references auth.users(id) on delete set null,
  body text check (char_length(body) <= 4096),
  media_type text,
  wa_message_id text unique,
  status text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_thread_idx on public.whatsapp_messages(thread_id, created_at);
create index if not exists whatsapp_messages_team_user_idx on public.whatsapp_messages(team_user_id);

alter table public.whatsapp_numbers enable row level security;
alter table public.whatsapp_threads enable row level security;
alter table public.whatsapp_messages enable row level security;
drop policy if exists whatsapp_numbers_team on public.whatsapp_numbers;
create policy whatsapp_numbers_team on public.whatsapp_numbers for select to authenticated using ((select public.has_admin_role()));
drop policy if exists whatsapp_threads_team on public.whatsapp_threads;
create policy whatsapp_threads_team on public.whatsapp_threads for select to authenticated using ((select public.has_admin_role()));
drop policy if exists whatsapp_messages_team on public.whatsapp_messages;
create policy whatsapp_messages_team on public.whatsapp_messages for select to authenticated using ((select public.has_admin_role()));
revoke all on public.whatsapp_numbers, public.whatsapp_threads, public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_numbers, public.whatsapp_threads, public.whatsapp_messages to authenticated;

-- Equipa: números (criar/editar). Só administradores (não moderadores).
create or replace function public.admin_save_whatsapp_number(p_id uuid, p_phone_number_id text, p_display_phone text, p_label text, p_area text,
  p_ai_enabled boolean, p_ai_instructions text, p_active boolean, p_sort int)
returns public.whatsapp_numbers language plpgsql security definer set search_path = public as $$
declare r public.whatsapp_numbers;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_id is null then
    insert into public.whatsapp_numbers(phone_number_id, display_phone, label, area, ai_enabled, ai_instructions, active, sort)
    values (trim(p_phone_number_id), nullif(trim(coalesce(p_display_phone, '')), ''), trim(p_label), coalesce(p_area, 'support'), coalesce(p_ai_enabled, true),
      nullif(trim(coalesce(p_ai_instructions, '')), ''), coalesce(p_active, true), coalesce(p_sort, 100))
    returning * into r;
  else
    update public.whatsapp_numbers set phone_number_id = trim(p_phone_number_id), display_phone = nullif(trim(coalesce(p_display_phone, '')), ''),
      label = trim(p_label), area = coalesce(p_area, area), ai_enabled = coalesce(p_ai_enabled, ai_enabled),
      ai_instructions = nullif(trim(coalesce(p_ai_instructions, '')), ''), active = coalesce(p_active, active), sort = coalesce(p_sort, sort)
    where id = p_id returning * into r;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return r;
end $$;

-- Equipa: lista de conversas (as que esperam pela equipa primeiro).
create or replace function public.admin_list_whatsapp_threads(p_only_waiting boolean default false, p_number uuid default null, p_limit int default 100)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
    select to_jsonb(t) || jsonb_build_object('number_label', n.label, 'number_area', n.area, 'display_phone', n.display_phone,
      'account_name', case when t.user_id is not null then public.viewer_name(t.user_id) end,
      'last_body', (select left(coalesce(m.body, '📎 ' || coalesce(m.media_type, 'anexo')), 140) from public.whatsapp_messages m where m.thread_id = t.id order by m.created_at desc limit 1),
      'window_open', coalesce(t.last_inbound_at > now() - interval '24 hours', false))
    from public.whatsapp_threads t join public.whatsapp_numbers n on n.id = t.number_id
    where (not coalesce(p_only_waiting, false) or t.status = 'human') and (p_number is null or t.number_id = p_number)
    order by (t.status = 'human') desc, t.last_message_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300);
end $$;

-- Equipa: mensagens de uma conversa (marca como lida).
create or replace function public.admin_whatsapp_messages(p_thread uuid)
returns setof public.whatsapp_messages language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.whatsapp_threads set unread = 0 where id = p_thread and unread > 0;
  return query select * from public.whatsapp_messages where thread_id = p_thread order by created_at limit 500;
end $$;

-- Equipa: passar para a equipa, devolver à IA ou arrumar.
create or replace function public.admin_whatsapp_set_status(p_thread uuid, p_status text)
returns public.whatsapp_threads language plpgsql security definer set search_path = public as $$
declare t public.whatsapp_threads;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('ai', 'human', 'closed') then raise exception 'INVALID_INPUT'; end if;
  update public.whatsapp_threads set status = p_status, handed_over_at = case when p_status = 'human' then now() else handed_over_at end, unread = 0
  where id = p_thread returning * into t;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'whatsapp_status', 'whatsapp_thread', t.id, jsonb_build_object('status', p_status));
  return t;
end $$;

-- Quantas conversas esperam pela equipa (para o separador da administração).
create or replace function public.whatsapp_waiting_count()
returns int language sql stable security definer set search_path = public as $$
  select case when public.has_admin_role() then (select count(*)::int from public.whatsapp_threads where status = 'human') else 0 end;
$$;

-- Liga o número do WhatsApp a uma conta do Huambo Online (pelo telefone guardado no perfil), para a IA
-- poder falar das encomendas dessa pessoa. Só é chamada pela Edge Function (service_role).
create or replace function public.whatsapp_match_user(p_wa_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where right(regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g'), 9) in (
      right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 9), right(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g'), 9))
    and length(regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g')) >= 9
  order by p.created_at limit 1;
$$;

-- Resumo das encomendas e pedidos recentes da pessoa (para a IA responder «onde está a minha encomenda?»).
-- Sem contactos nem dados de outras pessoas.
create or replace function public.whatsapp_user_context(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    'Conta no Huambo Online: ' || public.shown_name(p_user) || E'\n' ||
    coalesce((select string_agg(format('- Encomenda E-%s «%s»: estado %s, entrega %s, pagamento %s, total %s Kz, de %s',
        o.ref_no, left(coalesce(o.title, 'Compra'), 60), o.status, coalesce(o.fulfillment_status, '—'), coalesce(o.escrow_status, o.payment_status, '—'),
        round(o.total), to_char(o.created_at at time zone 'Africa/Luanda', 'DD/MM/YYYY')), E'\n')
      from (select * from public.orders where buyer_id = p_user or seller_id = p_user order by created_at desc limit 5) o), 'Sem encomendas.') || E'\n' ||
    coalesce((select string_agg(format('- Importação IM-%s «%s»: estado %s', i.ref_no, left(i.title, 60), i.status), E'\n')
      from (select * from public.import_requests where user_id = p_user order by created_at desc limit 3) i), '') || E'\n' ||
    coalesce((select string_agg(format('- Inspeção INS-%s «%s»: estado %s', x.ref_no, left(coalesce(x.title, ''), 60), x.status), E'\n')
      from (select * from public.item_inspections where requester_id = p_user order by created_at desc limit 3) x), ''),
  '');
$$;

revoke all on function public.admin_save_whatsapp_number(uuid, text, text, text, text, boolean, text, boolean, int), public.admin_list_whatsapp_threads(boolean, uuid, int),
  public.admin_whatsapp_messages(uuid), public.admin_whatsapp_set_status(uuid, text), public.whatsapp_waiting_count(), public.whatsapp_match_user(text), public.whatsapp_user_context(uuid) from public, anon;
grant execute on function public.admin_save_whatsapp_number(uuid, text, text, text, text, boolean, text, boolean, int), public.admin_list_whatsapp_threads(boolean, uuid, int),
  public.admin_whatsapp_messages(uuid), public.admin_whatsapp_set_status(uuid, text), public.whatsapp_waiting_count() to authenticated;
revoke all on function public.whatsapp_match_user(text), public.whatsapp_user_context(uuid) from authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funções só para as Edge Functions (service_role).

-- Mensagem que entra: cria/atualiza a conversa e guarda a mensagem (ignora repetidas da Meta).
create or replace function public.whatsapp_inbound(p_phone_number_id text, p_wa_id text, p_name text, p_wa_message_id text, p_body text, p_media_type text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n public.whatsapp_numbers; t public.whatsapp_threads; mid uuid; uid uuid; ai_count int;
begin
  select * into n from public.whatsapp_numbers where phone_number_id = p_phone_number_id and active;
  if not found then return jsonb_build_object('ignored', true); end if;
  if exists (select 1 from public.whatsapp_messages where wa_message_id = p_wa_message_id) then return jsonb_build_object('duplicate', true); end if;
  select * into t from public.whatsapp_threads where number_id = n.id and wa_id = p_wa_id for update;
  if not found then
    uid := public.whatsapp_match_user(p_wa_id);
    insert into public.whatsapp_threads(number_id, wa_id, contact_name, user_id) values (n.id, p_wa_id, left(nullif(trim(coalesce(p_name, '')), ''), 120), uid)
    returning * into t;
  end if;
  update public.whatsapp_threads set contact_name = coalesce(left(nullif(trim(coalesce(p_name, '')), ''), 120), contact_name),
    last_inbound_at = now(), last_message_at = now(), unread = unread + 1, status = case when status = 'closed' then 'ai' else status end
  where id = t.id returning * into t;
  insert into public.whatsapp_messages(thread_id, direction, author, body, media_type, wa_message_id)
  values (t.id, 'in', 'customer', left(p_body, 4096), p_media_type, p_wa_message_id) returning id into mid;
  select count(*) into ai_count from public.whatsapp_messages where thread_id = t.id and author = 'ai' and created_at > now() - interval '24 hours';
  return jsonb_build_object('thread_id', t.id, 'status', t.status, 'number_id', n.id, 'label', n.label, 'area', n.area,
    'ai_enabled', n.ai_enabled, 'ai_instructions', n.ai_instructions, 'user_id', t.user_id, 'ai_count_24h', ai_count,
    'context', case when t.user_id is not null then public.whatsapp_user_context(t.user_id) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('author', h.author, 'body', h.body, 'media_type', h.media_type) order by h.created_at)
      from (select * from public.whatsapp_messages where thread_id = t.id order by created_at desc limit 14) h), '[]'::jsonb));
end $$;

-- Mensagem que sai (IA ou equipa).
create or replace function public.whatsapp_outbound(p_thread uuid, p_author text, p_body text, p_wa_message_id text, p_error text, p_team_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.whatsapp_messages(thread_id, direction, author, team_user_id, body, wa_message_id, status, error)
  values (p_thread, 'out', p_author, p_team_user, left(p_body, 4096), nullif(p_wa_message_id, ''), case when p_error is null then 'sent' else 'failed' end, left(p_error, 500));
  update public.whatsapp_threads set last_message_at = now(), status = case when p_author = 'team' then 'human' else status end where id = p_thread;
end $$;

-- Passar a conversa para a equipa (avisa a equipa, no máximo uma vez a cada 10 minutos por conversa).
create or replace function public.whatsapp_handover(p_thread uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.whatsapp_threads; n public.whatsapp_numbers;
begin
  update public.whatsapp_threads set status = 'human', handed_over_at = coalesce(case when status <> 'human' then now() end, handed_over_at)
  where id = p_thread returning * into t;
  if not found then return; end if;
  select * into n from public.whatsapp_numbers where id = t.number_id;
  if not exists (select 1 from public.notifications x where x.data->>'whatsapp_thread_id' = t.id::text and x.created_at > now() - interval '10 minutes') then
    perform public.notify_staff('💬 WhatsApp · ' || n.label, coalesce(t.contact_name, '+' || t.wa_id) || coalesce(': ' || left(p_reason, 140), ''),
      jsonb_build_object('whatsapp_thread_id', t.id, 'tab', 'whatsapp'));
  end if;
end $$;

-- Estado das mensagens enviadas (entregue, lida, falhou).
create or replace function public.whatsapp_status_update(p_wa_message_id text, p_status text, p_error text)
returns void language sql security definer set search_path = public as $$
  update public.whatsapp_messages set status = left(p_status, 20), error = coalesce(left(p_error, 500), error) where wa_message_id = p_wa_message_id;
$$;

-- Equipa: dados para responder (verifica se é da equipa e se a janela de 24 horas está aberta).
create or replace function public.whatsapp_team_prepare(p_thread uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.whatsapp_threads; n public.whatsapp_numbers;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into t from public.whatsapp_threads where id = p_thread;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into n from public.whatsapp_numbers where id = t.number_id;
  return jsonb_build_object('thread_id', t.id, 'wa_id', t.wa_id, 'phone_number_id', n.phone_number_id, 'user_id', auth.uid(),
    'window_open', coalesce(t.last_inbound_at > now() - interval '24 hours', false));
end $$;

revoke all on function public.whatsapp_inbound(text, text, text, text, text, text), public.whatsapp_outbound(uuid, text, text, text, text, uuid),
  public.whatsapp_handover(uuid, text), public.whatsapp_status_update(text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_inbound(text, text, text, text, text, text), public.whatsapp_outbound(uuid, text, text, text, text, uuid),
  public.whatsapp_handover(uuid, text), public.whatsapp_status_update(text, text, text), public.whatsapp_match_user(text), public.whatsapp_user_context(uuid) to service_role;
revoke all on function public.whatsapp_team_prepare(uuid) from public, anon;
grant execute on function public.whatsapp_team_prepare(uuid) to authenticated;
