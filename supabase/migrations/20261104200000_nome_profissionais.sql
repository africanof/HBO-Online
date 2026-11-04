-- Profissionais: o nome da página pública segue as mesmas regras do nome público (sem apelidos do nome
-- verdadeiro, sem contactos nem redes sociais). As fotografias mantêm-se. As empresas não mudam (nome comercial).
-- Também: o nome curto ignora o que está entre parênteses («Pedro (exemplo)» → «Pedro»).

create or replace function public.shown_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  with p as (select public_name, full_name, regexp_split_to_array(trim(regexp_replace(regexp_replace(coalesce(full_name, ''), '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g')), ' ') w
             from public.profiles where id = p_user)
  select coalesce(nullif(trim(p.public_name), ''),
    case when array_length(p.w, 1) > 1 then p.w[1] || ' ' || upper(left(p.w[array_length(p.w, 1)], 1)) || '.'
         else nullif(p.w[1], '') end,
    'Utilizador') from p;
$$;

-- Problema de um nome mostrado ao público (null = está bem). Usada no nome público e no nome de profissional.
create or replace function public.public_name_problem(p_user uuid, p_name text)
returns text language plpgsql stable security definer set search_path = public as $$
declare fold text := translate(lower(coalesce(p_name, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'); f text; w text;
begin
  if public.chat_contact_reason(p_name) is not null or p_name ~ '[@#/\\]|\d{3,}'
     or fold ~ '\m(whats|wats|zap|face|facebook|insta|instagram|tiktok|telegram|gmail|email|telefone|liga|contacto|contato|oficial)\w*' then return 'PUBLIC_NAME_CONTACT'; end if;
  select translate(lower(regexp_replace(coalesce(full_name, ''), '\([^)]*\)', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') into f from public.profiles where id = p_user;
  foreach w in array (regexp_split_to_array(trim(coalesce(f, '')), '\s+'))[2:] loop
    w := regexp_replace(w, '[^a-z]', '', 'g');
    if char_length(w) >= 3 and w not in ('dos', 'das', 'del', 'van') and fold ~ ('\m' || w || '\M') then return 'PUBLIC_NAME_SURNAME'; end if;
  end loop;
  return null;
end $$;

create or replace function public.set_public_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); e text;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if n = '' then update public.profiles set public_name = null, public_name_checked_at = now() where id = me; return public.shown_name(me); end if;
  if char_length(n) < 3 or char_length(n) > 30 then raise exception 'PUBLIC_NAME_LENGTH'; end if;
  e := public.public_name_problem(me, n); if e is not null then raise exception '%', e; end if;
  update public.profiles set public_name = n, public_name_checked_at = null, updated_at = now() where id = me;
  return n;
end $$;

-- Nome da página de profissional: verificado ao gravar.
create or replace function public.guard_provider_display_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare e text;
begin
  if tg_op = 'UPDATE' and new.display_name is not distinct from old.display_name then return new; end if;
  new.display_name := regexp_replace(trim(coalesce(new.display_name, '')), '\s+', ' ', 'g');
  if new.display_name = '' then new.display_name := public.shown_name(new.user_id); end if;
  e := public.public_name_problem(new.user_id, new.display_name);
  if e is not null then raise exception '%', e; end if;
  return new;
end $$;
revoke all on function public.guard_provider_display_name() from public, anon, authenticated;
drop trigger if exists guard_provider_display_name on public.provider_profiles;
create trigger guard_provider_display_name before insert or update of display_name on public.provider_profiles
  for each row execute function public.guard_provider_display_name();

-- Profissionais que já existem com o apelido no nome: passam ao nome curto (ou à alcunha, se tiverem).
update public.provider_profiles pp set display_name = public.shown_name(pp.user_id)
  where public.public_name_problem(pp.user_id, pp.display_name) is not null;
