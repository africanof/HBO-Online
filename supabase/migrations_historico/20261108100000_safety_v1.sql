-- Segurança: bloquear pessoas nas mensagens e pontos de encontro seguros (editáveis pela administração).

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
create policy user_blocks_own_read on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;

-- Bloquear / desbloquear. Devolve true se ficou bloqueado.
create or replace function public.toggle_block(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); was boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user_id is null or p_user_id = me then raise exception 'CANNOT_BLOCK_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  select active into was from public.user_blocks where blocker_id = me and blocked_id = p_user_id;
  insert into public.user_blocks(blocker_id, blocked_id, active, created_at) values (me, p_user_id, true, now())
  on conflict (blocker_id, blocked_id) do update set active = not coalesce(was, false), created_at = now();
  return not coalesce(was, false);
end $$;

create or replace function public.my_blocks()
returns table(user_id uuid, name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), b.created_at
  from public.user_blocks b left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() and b.active order by b.created_at desc limit 500;
$$;

-- Ninguém envia mensagens numa conversa com quem o bloqueou (nem a quem bloqueou).
create or replace function public.messages_block_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.conversation_participants o join public.user_blocks b
               on (b.blocker_id = o.user_id and b.blocked_id = new.sender_id) or (b.blocker_id = new.sender_id and b.blocked_id = o.user_id)
             where b.active and o.conversation_id = new.conversation_id and o.user_id <> new.sender_id) then
    raise exception 'BLOCKED';
  end if;
  return new;
end $$;
create trigger messages_block_guard before insert on public.messages for each row execute function public.messages_block_guard();

-- Pontos de encontro seguros (a administração pode juntar lugares reais do Huambo).
alter table public.platform_settings add column if not exists safe_spots jsonb not null default '[
  {"name": "À porta de uma esquadra da Polícia Nacional", "note": "Há sempre agentes por perto."},
  {"name": "Numa agência bancária ou caixa Multicaixa movimentada", "note": "Tem câmaras e seguranças, e dá para levantar dinheiro na hora."},
  {"name": "Num supermercado ou centro comercial", "note": "Muita gente, luz e câmaras."},
  {"name": "Num posto de combustível", "note": "Aberto até tarde e com câmaras."}
]'::jsonb check (jsonb_typeof(safe_spots) = 'array' and jsonb_array_length(safe_spots) <= 20);
grant update (safe_spots) on public.platform_settings to authenticated;

revoke all on function public.messages_block_guard() from public, anon, authenticated;
revoke all on function public.toggle_block(uuid) from public, anon;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.toggle_block(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;
