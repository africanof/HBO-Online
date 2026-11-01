-- Traduções de anúncios pela Edge Function «ai-assist» sem acesso direto às tabelas: o papel
-- service_role deste projeto só trabalha através de funções (as tabelas não lhe dão leitura/escrita).

/** Texto de um anúncio visível (para traduzir) e a sua impressão digital. Só o servidor. */
create or replace function public.ai_listing_text(p_listing_id uuid)
 returns table(title text, description text, source_hash text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select l.title, l.description, md5(coalesce(l.title, '') || '|' || coalesce(l.description, ''))
  from public.classified_listings l
  where l.id = p_listing_id and l.status in ('published', 'sold', 'rented')
$function$;
revoke all on function public.ai_listing_text(uuid) from public, anon, authenticated;
grant execute on function public.ai_listing_text(uuid) to service_role;

/** Tradução guardada (se ainda corresponder ao texto atual). Só o servidor. */
create or replace function public.ai_cached_translation(p_listing_id uuid, p_lang text, p_source_hash text)
 returns table(title text, description text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select t.title, t.description from public.listing_translations t
  where t.listing_id = p_listing_id and t.lang = p_lang and t.source_hash = p_source_hash
$function$;
revoke all on function public.ai_cached_translation(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_cached_translation(uuid, text, text) to service_role;

/** Guarda uma tradução. Só o servidor. */
create or replace function public.ai_save_translation(p_listing_id uuid, p_lang text, p_source_hash text, p_title text, p_description text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_lang not in ('en', 'zh', 'pt') then raise exception 'INVALID_INPUT'; end if;
  insert into public.listing_translations(listing_id, lang, source_hash, title, description, created_at)
  values (p_listing_id, p_lang, p_source_hash, left(p_title, 200), left(p_description, 6000), now())
  on conflict (listing_id, lang) do update set source_hash = excluded.source_hash, title = excluded.title,
    description = excluded.description, created_at = now();
end $function$;
revoke all on function public.ai_save_translation(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ai_save_translation(uuid, text, text, text, text) to service_role;
