-- Francês: os anúncios também podem ser traduzidos (e guardados) em francês.
alter table public.listing_translations drop constraint if exists listing_translations_lang_check;
alter table public.listing_translations add constraint listing_translations_lang_check check (lang in ('en', 'zh', 'pt', 'fr'));
do $$
declare d text := pg_get_functiondef('public.ai_save_translation(uuid,text,text,text,text)'::regprocedure);
begin
  d := replace(d, $q$if p_lang not in ('en', 'zh', 'pt') then$q$, $q$if p_lang not in ('en', 'zh', 'pt', 'fr') then$q$);
  if position($q$'fr'$q$ in d) = 0 then raise exception 'correção não aplicada'; end if;
  execute d;
end $$;
