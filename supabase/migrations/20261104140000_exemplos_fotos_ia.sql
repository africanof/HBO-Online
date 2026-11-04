-- Os exemplos passam a usar as fotografias ilustrativas geradas por IA (função gen-examples), guardadas em
-- classified-media/exemplos/<nome>.jpg, em vez das ilustrações com texto do Site (/exemplos/<nome>.jpg).
-- Continuam marcados: «(exemplo)» no nome, selo «EXEMPLO» nos cartões e aviso na página.
do $$ declare
  old_base text := 'https://huamboonline.com/exemplos/';
  new_base text := 'https://pewymvkowbdizdiyjmao.supabase.co/storage/v1/object/public/classified-media/exemplos/';
begin
  update public.classified_listings set media = replace(media::text, old_base, new_base)::jsonb where media::text like '%' || old_base || '%';
  update public.products set media = replace(media::text, old_base, new_base)::jsonb where media::text like '%' || old_base || '%';
  update public.provider_profiles set avatar_url = replace(avatar_url, old_base, new_base) where avatar_url like old_base || '%';
  update public.businesses set logo_url = replace(logo_url, old_base, new_base) where logo_url like old_base || '%';
  update public.events set cover_url = replace(cover_url, old_base, new_base) where cover_url like old_base || '%';
end $$;
