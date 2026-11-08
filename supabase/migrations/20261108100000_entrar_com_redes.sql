-- Entrar com Google, Facebook ou Apple: o nome e a fotografia vêm da conta escolhida.
-- (Google e Facebook enviam «name»/«picture»; a Apple pode não enviar o nome: fica a parte antes do @ do email.)
create or replace function public.handle_new_huambo_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, phone, province, municipality, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(trim(m->>'full_name'), ''), nullif(trim(m->>'name'), ''),
                  nullif(trim(concat_ws(' ', m->>'given_name', m->>'family_name')), ''), split_part(coalesce(new.email, ''), '@', 1), ''), 120),
    nullif(m->>'phone', ''),
    'Huambo',
    coalesce(m->>'municipality', ''),
    case when coalesce(m->>'avatar_url', m->>'picture', '') ~ '^https://' then coalesce(m->>'avatar_url', m->>'picture') end
  )
  on conflict (id) do nothing;

  insert into public.account_capabilities (user_id, capability)
  values (new.id, 'customer')
  on conflict (user_id, capability) do nothing;

  return new;
end $$;
