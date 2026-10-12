-- WhatsApp: o vendedor pode mostrar o seu número de WhatsApp nos anúncios e produtos (escolha dele, desligado por omissão).
-- O número só é dado a quem tem sessão iniciada (menos recolha automática de números) e só de contas ativas.

alter table public.profiles
  add column if not exists whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  add column if not exists whatsapp_public boolean not null default false;

-- Número em formato internacional sem «+» (Angola: 244 + 9 algarismos). Devolve null se não for válido.
create or replace function public.normalize_whatsapp(p text) returns text
language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d ~ '^00' then d := substr(d, 3); end if;
  if d ~ '^9[0-9]{8}$' then return '244' || d; end if;
  if d ~ '^2449[0-9]{8}$' then return d; end if;
  if d ~ '^244' then return null; end if;
  if d ~ '^[1-9][0-9]{9,14}$' then return d; end if;
  return null;
end $$;

create or replace function public.set_my_whatsapp(p_number text, p_public boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_number, '')), '') is null then
    update public.profiles set whatsapp = null, whatsapp_public = false where id = auth.uid();
    return jsonb_build_object('whatsapp', null, 'whatsapp_public', false);
  end if;
  n := public.normalize_whatsapp(p_number);
  if n is null then raise exception 'INVALID_WHATSAPP'; end if;
  update public.profiles set whatsapp = n, whatsapp_public = coalesce(p_public, false) where id = auth.uid();
  return jsonb_build_object('whatsapp', n, 'whatsapp_public', coalesce(p_public, false));
end $$;

create or replace function public.seller_whatsapp(p_user_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.whatsapp from public.profiles p
  where auth.uid() is not null and p.id = p_user_id and p.whatsapp_public and p.status = 'active';
$$;

revoke all on function public.normalize_whatsapp(text) from public, anon;
revoke all on function public.set_my_whatsapp(text, boolean) from public, anon;
revoke all on function public.seller_whatsapp(uuid) from public, anon;
grant execute on function public.set_my_whatsapp(text, boolean) to authenticated;
grant execute on function public.seller_whatsapp(uuid) to authenticated;
