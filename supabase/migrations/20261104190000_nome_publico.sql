-- Nome público: os outros utilizadores deixam de ver o nome completo e a fotografia das pessoas
-- particulares (para não as procurarem nas redes sociais e fecharem o negócio fora do Huambo Online).
-- • Cada pessoa pode escolher um nome público (alcunha), verificado: sem contactos, sem @, sem redes
--   sociais e sem os apelidos do nome verdadeiro; a IA revê-o depois (ai-chat-guard).
-- • Sem alcunha aparece «Primeiro nome + inicial do último» (ex.: «Adão N.»).
-- • A fotografia de perfil só aparece em profissionais e empresas (que têm página pública).
-- • A equipa (administração e moderadores) continua a ver o nome completo: as funções «admin_*» não mudam.

alter table public.profiles add column if not exists public_name text check (public_name is null or char_length(public_name) between 3 and 30),
  add column if not exists public_name_checked_at timestamptz;

create or replace function public.shown_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(p.public_name), ''),
    case when array_length(regexp_split_to_array(trim(coalesce(p.full_name, '')), '\s+'), 1) > 1
      then split_part(trim(p.full_name), ' ', 1) || ' ' || upper(left((regexp_split_to_array(trim(p.full_name), '\s+'))[array_length(regexp_split_to_array(trim(p.full_name), '\s+'), 1)], 1)) || '.'
      else nullif(trim(coalesce(p.full_name, '')), '') end,
    'Utilizador')
  from public.profiles p where p.id = p_user;
$$;

create or replace function public.shown_avatar(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.provider_profiles pp where pp.user_id = p_user and pp.active)
               or exists (select 1 from public.businesses b where b.owner_id = p_user and b.active)
              then p.avatar_url end
  from public.profiles p where p.id = p_user;
$$;
grant execute on function public.shown_name(uuid), public.shown_avatar(uuid) to anon, authenticated;

-- Escolher (ou apagar) o nome público.
create or replace function public.set_public_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); f text; w text; fold text;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if n = '' then update public.profiles set public_name = null, public_name_checked_at = now() where id = me; return public.shown_name(me); end if;
  if char_length(n) < 3 or char_length(n) > 30 then raise exception 'PUBLIC_NAME_LENGTH'; end if;
  fold := translate(lower(n), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  if public.chat_contact_reason(n) is not null or n ~ '[@#/\\]|\d{3,}'
     or fold ~ '\m(whats|wats|zap|face|facebook|insta|instagram|tiktok|telegram|gmail|email|telefone|liga|contacto|contato|oficial)\w*' then raise exception 'PUBLIC_NAME_CONTACT'; end if;
  select translate(lower(full_name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') into f from public.profiles where id = me;
  -- Os apelidos (todas as palavras do nome verdadeiro menos a primeira) não podem aparecer.
  foreach w in array (regexp_split_to_array(coalesce(f, ''), '\s+'))[2:] loop
    if char_length(w) >= 3 and w not in ('dos', 'das', 'del', 'van') and fold ~ ('\m' || w || '\M') then raise exception 'PUBLIC_NAME_SURNAME'; end if;
  end loop;
  update public.profiles set public_name = n, public_name_checked_at = null, updated_at = now() where id = me;
  return n;
end $$;
revoke all on function public.set_public_name(text) from public, anon;
grant execute on function public.set_public_name(text) to authenticated;

-- Funções que mostram pessoas a OUTROS utilizadores: nome público e fotografia só de profissionais/empresas.
do $$
declare fn text; d text; a text; n int := 0;
  fns text[] := array['auction_bids_for_v2(uuid)', 'auction_bids_for(uuid)', 'available_deliveries()', 'cart_contents()', 'cart_delivery_quote(uuid)',
    'get_public_profile(uuid)', 'list_reviews_v2(uuid,uuid)', 'list_reviews_v3(uuid,uuid)', 'list_reviews(uuid,uuid)', 'listing_deal_candidates(uuid)',
    'listing_offers_for(uuid)', 'my_blocks()', 'my_conversation_partners()', 'my_deliveries(text)', 'my_disputes_v2()', 'my_disputes()', 'my_follows()',
    'my_listing_claims()', 'my_orders_v2(text)', 'my_orders_v3(text)', 'my_orders(text)', 'my_pending_reviews()', 'my_rental_requests(text)',
    'my_service_requests_v2(text)', 'my_service_requests_v3(text)', 'my_service_requests(text)', 'product_catalog(text,uuid,uuid,uuid,integer)',
    'promo_subject(text,uuid)', 'public_seller(uuid)', 'user_reviews_for_v2(uuid)', 'user_reviews_for(uuid)'];
  bare text[] := array['claim_referral(text)', 'inspection_target_name(text,uuid)', 'job_follow_listing(uuid)', 'job_follow_product(uuid)', 'toggle_follow(text,uuid)', 'notify_new_message()'];
begin
  foreach fn in array fns loop
    d := pg_get_functiondef(fn::regprocedure);
    for a in select distinct m[1] from regexp_matches(d, 'public\.profiles\s+([a-z_0-9]+)', 'gi') m where m[1] !~* '^(where|on|join|left|using)$' loop
      d := regexp_replace(d, '\m' || a || '\.full_name\M', 'public.shown_name(' || a || '.id)', 'g');
      d := regexp_replace(d, '\m' || a || '\.avatar_url\M', 'public.shown_avatar(' || a || '.id)', 'g');
    end loop;
    execute d; n := n + 1;
  end loop;
  -- Subconsultas «select … full_name … from public.profiles where id = …»
  foreach fn in array bare loop
    d := pg_get_functiondef(fn::regprocedure);
    d := regexp_replace(d, '(?<![.\w])full_name(?!\w)', 'public.shown_name(id)', 'g');
    execute d; n := n + 1;
  end loop;
  raise notice 'funções atualizadas: %', n;
end $$;

-- Lista de profissionais: o telefone e o WhatsApp ficam só para a equipa (já estão vazios aqui; por precaução).
do $$ declare d text := pg_get_functiondef('public.provider_directory(text,uuid,uuid,integer)'::regprocedure);
begin
  if strpos(d, 'p.phone, p.whatsapp,') = 0 then raise exception 'PATCH_NOT_FOUND provider_directory'; end if;
  execute replace(d, 'p.phone, p.whatsapp,', 'null::text, null::text,');
end $$;

-- IA: revê os nomes públicos novos (fila própria, mesma função ai-chat-guard).
create or replace function public.ai_name_queue(p_limit int default 20)
returns table(user_id uuid, public_name text, full_name text)
language sql stable security definer set search_path = public as $$
  select id, public_name, full_name from public.profiles where public_name is not null and public_name_checked_at is null order by updated_at limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;
create or replace function public.ai_name_verdict(p_user uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ok then update public.profiles set public_name_checked_at = now() where id = p_user;
  else
    update public.profiles set public_name = null, public_name_checked_at = now() where id = p_user;
    insert into public.notifications(user_id, type, title, body, data) values (p_user, 'system', 'Nome público recusado',
      'O nome público que escolheu parecia ter contactos, redes sociais ou o seu nome verdadeiro. Escolha outro em «A minha conta».', jsonb_build_object('for', 'account'));
  end if;
end $$;
revoke all on function public.ai_name_queue(int), public.ai_name_verdict(uuid, boolean) from public, anon, authenticated;
grant execute on function public.ai_name_queue(int), public.ai_name_verdict(uuid, boolean) to service_role;

select cron.unschedule('huambo-online-ai-chat-guard') where exists (select 1 from cron.job where jobname = 'huambo-online-ai-chat-guard');
select cron.schedule('huambo-online-ai-chat-guard', '* * * * *', $$
  select net.http_post('https://pewymvkowbdizdiyjmao.supabase.co/functions/v1/ai-chat-guard', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'huambo_cron_anon_key')), 30000)
  where exists (select 1 from public.ai_chat_queue(1)) or exists (select 1 from public.ai_name_queue(1))
$$);
