-- Profissionais: podem escrever o nome que quiserem (com apelido, etc.). O original fica guardado em privado
-- (provider_private_contacts, como o telefone e o WhatsApp) e só o próprio, os administradores e os moderadores
-- o veem; o público vê a versão protegida («Adão N.»). A equipa usa estes dados para falar com eles fora da APP.
-- Na lista de profissionais, a equipa recebe também o telefone e o WhatsApp reais.

alter table public.provider_private_contacts add column if not exists display_name text;

create or replace function public.guard_provider_display_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare raw text;
begin
  if tg_op = 'UPDATE' and new.display_name is not distinct from old.display_name then return new; end if;
  raw := regexp_replace(trim(coalesce(new.display_name, '')), '\s+', ' ', 'g');
  if raw = '' then raw := public.shown_name(new.user_id); end if;
  -- Guardar o original em privado (exceto se a pessoa só voltou a gravar a versão protegida).
  if raw is distinct from public.shown_name(new.user_id) then
    insert into public.provider_private_contacts(user_id, display_name) values (new.user_id, left(raw, 120))
      on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now();
  end if;
  new.display_name := case when public.public_name_problem(new.user_id, raw) is null then raw else public.shown_name(new.user_id) end;
  return new;
end $$;

-- O Adão tinha escrito «Adão Neto» antes da regra: guarda-se em privado.
insert into public.provider_private_contacts(user_id, display_name)
select pp.user_id, 'Adão Neto' from public.provider_profiles pp where pp.user_id = '16c35bde-44df-4426-a272-481d79fad69c'
on conflict (user_id) do update set display_name = coalesce(provider_private_contacts.display_name, excluded.display_name);

-- Contactos privados (próprio e equipa): passa a incluir o nome original.
drop function if exists public.provider_private_contact(uuid);
create function public.provider_private_contact(p_user_id uuid)
returns table(phone text, whatsapp text, directions text, geo_lat numeric, geo_lng numeric, display_name text)
language sql stable security definer set search_path = public as $$
  select c.phone, c.whatsapp, c.directions, c.geo_lat, c.geo_lng, c.display_name
  from public.provider_private_contacts c
  where c.user_id = p_user_id and (p_user_id = auth.uid() or public.has_admin_role());
$$;
revoke all on function public.provider_private_contact(uuid) from public, anon;
grant execute on function public.provider_private_contact(uuid) to authenticated;

-- Lista de profissionais: a equipa vê o nome original, o telefone e o WhatsApp; os outros não.
do $$ declare d text := pg_get_functiondef('public.provider_directory(text,uuid,uuid,integer)'::regprocedure);
begin
  if strpos(d, 'select p.user_id, p.display_name,') = 0 or strpos(d, 'null::text, null::text,') = 0 then raise exception 'PATCH_NOT_FOUND provider_directory'; end if;
  d := replace(d, 'select p.user_id, p.display_name,', 'select p.user_id, case when public.has_admin_role() then coalesce((select pc.display_name from public.provider_private_contacts pc where pc.user_id = p.user_id), p.display_name) else p.display_name end,');
  d := replace(d, 'null::text, null::text,', 'case when public.has_admin_role() then (select pc.phone from public.provider_private_contacts pc where pc.user_id = p.user_id) end, case when public.has_admin_role() then (select pc.whatsapp from public.provider_private_contacts pc where pc.user_id = p.user_id) end,');
  execute d;
end $$;
