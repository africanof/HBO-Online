-- Vídeos nos anúncios e nos produtos (1 por artigo, até 30 MB / 60 s).
-- Os vídeos de anúncios fechados/vendidos são apagados ao fim de 7 dias; os de produtos
-- escondidos ao fim de 30 dias; os de artigos apagados ou substituídos logo a seguir.
-- A limpeza corre todos os dias pela função "cleanup-videos" (Edge Function, no servidor).

create extension if not exists pg_net with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-videos', 'media-videos', true, 31457280, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'])
on conflict (id) do nothing;

-- Cada pessoa só envia/apaga vídeos na sua própria pasta (igual às fotografias).
alter policy "huambo media insert own folder" on storage.objects
  with check ((bucket_id = any (array['classified-media', 'avatars', 'media-videos'])) and ((storage.foldername(name))[1] = (auth.uid())::text));
alter policy "huambo media update own folder" on storage.objects
  using ((bucket_id = any (array['classified-media', 'avatars', 'media-videos'])) and ((storage.foldername(name))[1] = (auth.uid())::text))
  with check ((bucket_id = any (array['classified-media', 'avatars', 'media-videos'])) and ((storage.foldername(name))[1] = (auth.uid())::text));
alter policy "huambo media delete own folder" on storage.objects
  using ((bucket_id = any (array['classified-media', 'avatars', 'media-videos'])) and ((storage.foldername(name))[1] = (auth.uid())::text));

alter table public.classified_listings add column if not exists video_url text
  check (video_url is null or video_url ~ '^https://[^ ]+/storage/v1/object/public/media-videos/');
alter table public.products add column if not exists video_url text
  check (video_url is null or video_url ~ '^https://[^ ]+/storage/v1/object/public/media-videos/');

create or replace function public.video_path(p_url text) returns text
language sql immutable set search_path = public as $$
  select substring(p_url from '/storage/v1/object/public/media-videos/(.+)$');
$$;

-- Vídeos à espera de serem apagados (artigo apagado ou vídeo trocado).
create table if not exists public.media_cleanup_queue (
  path text primary key,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.media_cleanup_queue enable row level security;
revoke all on public.media_cleanup_queue from anon, authenticated;

create or replace function public.queue_video_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.video_url is not null and (tg_op = 'DELETE' or new.video_url is distinct from old.video_url) then
    insert into public.media_cleanup_queue(path) values (public.video_path(old.video_url)) on conflict (path) do nothing;
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.queue_video_cleanup() from public, anon, authenticated;

create trigger trg_queue_video_cleanup_listing after update of video_url or delete on public.classified_listings
  for each row execute function public.queue_video_cleanup();
create trigger trg_queue_video_cleanup_product after update of video_url or delete on public.products
  for each row execute function public.queue_video_cleanup();

-- Lista do que já pode ser apagado (só o servidor a usa).
create or replace function public.videos_due_for_cleanup()
returns table(path text) language sql stable security definer set search_path = public as $$
  select q.path from public.media_cleanup_queue q where q.due_at <= now() and q.done_at is null and q.path is not null
  union
  select public.video_path(l.video_url) from public.classified_listings l
   where l.video_url is not null and l.status in ('sold', 'rented', 'closed', 'cancelled') and l.updated_at < now() - interval '7 days'
  union
  select public.video_path(p.video_url) from public.products p
   where p.video_url is not null and not p.active and p.updated_at < now() - interval '30 days'
  limit 500;
$$;

-- Depois de apagar no Storage: tira o vídeo dos artigos e limpa a fila.
create or replace function public.mark_videos_removed(p_paths text[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; k integer;
begin
  update public.classified_listings set video_url = null where public.video_path(video_url) = any(p_paths);
  get diagnostics k = row_count; n := n + k;
  update public.products set video_url = null where public.video_path(video_url) = any(p_paths);
  get diagnostics k = row_count; n := n + k;
  update public.media_cleanup_queue set done_at = now() where path = any(p_paths);
  return n;
end $$;

revoke all on function public.videos_due_for_cleanup() from public, anon, authenticated;
revoke all on function public.mark_videos_removed(text[]) from public, anon, authenticated;
grant execute on function public.videos_due_for_cleanup() to service_role;
grant execute on function public.mark_videos_removed(text[]) to service_role;

-- Todos os dias às 03:10 (hora de Angola = UTC+1 → 02:10 UTC).
select cron.schedule('huambo-online-cleanup-videos', '10 2 * * *', $$
  select net.http_post(
    url := 'https://foqsmszwbhiyqqtuwypg.supabase.co/functions/v1/cleanup-videos',
    -- A função exige uma chave válida: a chave pública (anon) está guardada no Vault como
    -- 'huambo_cron_anon_key' (criada à parte, nunca escrita no código).
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'huambo_cron_anon_key' limit 1)),
    body := '{}'::jsonb
  );
$$);
