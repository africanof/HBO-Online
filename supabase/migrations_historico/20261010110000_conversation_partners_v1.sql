-- Nome (e fotografia) da outra pessoa em cada conversa, sem expor os perfis completos
create or replace function public.my_conversation_partners()
returns table(conversation_id uuid, other_user_id uuid, other_name text, other_avatar text)
language sql stable security definer set search_path = public as $$
  select distinct on (me.conversation_id) me.conversation_id, o.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url
  from public.conversation_participants me
  join public.conversation_participants o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  left join public.profiles p on p.id = o.user_id
  where me.user_id = auth.uid()
  order by me.conversation_id, o.joined_at;
$$;
revoke all on function public.my_conversation_partners() from public, anon;
grant execute on function public.my_conversation_partners() to authenticated;
