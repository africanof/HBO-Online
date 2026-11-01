-- Recomendações «Para si», sem inteligência artificial: regras simples sobre o que cada pessoa vê,
-- pesquisa e guarda nos últimos 30 dias.
--   • ver um anúncio vale 1 · pesquisar vale 2 · guardar vale 3
--   • as 3 categorias e o tipo de anúncio com mais pontos, e as últimas palavras pesquisadas,
--     escolhem os anúncios a sugerir (nunca os da própria pessoa)
--   • sem histórico (ou poucos resultados) completa com os anúncios em destaque e os mais recentes
-- Só a própria pessoa vê o seu histórico; é apagado ao fim de 90 dias.

create table if not exists public.user_interests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('view', 'search', 'save')),
  listing_id uuid references public.classified_listings(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  listing_type text,
  query text,
  created_at timestamptz not null default now()
);
create index if not exists user_interests_user_idx on public.user_interests (user_id, created_at desc);
alter table public.user_interests enable row level security;
revoke all on public.user_interests from public, anon, authenticated;
grant select, delete on public.user_interests to authenticated;
create policy user_interests_own_read on public.user_interests for select to authenticated using (user_id = (select auth.uid()));
create policy user_interests_own_delete on public.user_interests for delete to authenticated using (user_id = (select auth.uid()));
grant usage, select on all sequences in schema public to authenticated, service_role;

/** Regista que a pessoa abriu um anúncio (no máximo uma vez por hora por anúncio). */
create or replace function public.track_listing_view(p_listing_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare l public.classified_listings;
begin
  if auth.uid() is null then return; end if;
  select * into l from public.classified_listings where id = p_listing_id and status = 'published';
  if not found or l.owner_id = auth.uid() then return; end if;
  if exists (select 1 from public.user_interests where user_id = auth.uid() and kind = 'view' and listing_id = p_listing_id
             and created_at > now() - interval '1 hour') then return; end if;
  insert into public.user_interests(user_id, kind, listing_id, category_id, listing_type)
  values (auth.uid(), 'view', l.id, l.category_id, l.listing_type);
end $function$;
revoke all on function public.track_listing_view(uuid) from public, anon;
grant execute on function public.track_listing_view(uuid) to authenticated;

/** Regista uma pesquisa (palavras, categoria e/ou tipo); repetições em 10 minutos não contam. */
create or replace function public.track_search(p_query text, p_category_id uuid default null, p_listing_type text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare q text := nullif(lower(left(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'), 80)), '');
  t text := case when p_listing_type in ('classified', 'product', 'vehicle', 'real_estate', 'service') then p_listing_type end;
  c uuid := case when exists (select 1 from public.categories where id = p_category_id) then p_category_id end;
begin
  if auth.uid() is null or (q is null and c is null and t is null) then return; end if;
  if q is not null and char_length(q) < 2 then q := null; end if;
  if exists (select 1 from public.user_interests where user_id = auth.uid() and kind = 'search'
             and query is not distinct from q and category_id is not distinct from c and listing_type is not distinct from t
             and created_at > now() - interval '10 minutes') then return; end if;
  insert into public.user_interests(user_id, kind, category_id, listing_type, query) values (auth.uid(), 'search', c, t, q);
end $function$;
revoke all on function public.track_search(text, uuid, text) from public, anon;
grant execute on function public.track_search(text, uuid, text) to authenticated;

/** Guardar um anúncio conta como interesse forte. */
create or replace function public.track_saved_listing()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare l public.classified_listings;
begin
  if new.classified_listing_id is null then return new; end if;
  select * into l from public.classified_listings where id = new.classified_listing_id;
  if found and l.owner_id <> new.user_id then
    insert into public.user_interests(user_id, kind, listing_id, category_id, listing_type)
    values (new.user_id, 'save', l.id, l.category_id, l.listing_type);
  end if;
  return new;
end $function$;
revoke all on function public.track_saved_listing() from public, anon, authenticated;
drop trigger if exists trg_track_saved_listing on public.saved_items;
create trigger trg_track_saved_listing after insert on public.saved_items for each row execute function public.track_saved_listing();

/** Anúncios recomendados para quem tem a sessão aberta (ou os mais recentes, para visitantes). */
create or replace function public.recommended_listings(p_limit integer default 12)
 returns setof public.classified_listings
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); n int := greatest(1, least(coalesce(p_limit, 12), 40));
begin
  return query
  with hist as (
    select i.*, case i.kind when 'save' then 3 when 'search' then 2 else 1 end as w
    from public.user_interests i
    where me is not null and i.user_id = me and i.created_at > now() - interval '30 days'
  ),
  cats as (select category_id, sum(w) as score from hist where category_id is not null group by 1 order by 2 desc limit 3),
  types as (select listing_type, sum(w) as score from hist where listing_type is not null group by 1 order by 2 desc limit 1),
  terms as (select distinct on (query) query from (select query, created_at from hist where query is not null order by created_at desc limit 20) x limit 3),
  seen as (select distinct listing_id from hist where listing_id is not null and created_at > now() - interval '3 days'),
  pool as (
    select l.id, l.featured, l.created_at, (
        coalesce((select c.score from cats c where c.category_id = l.category_id), 0)
      + coalesce((select t.score from types t where t.listing_type = l.listing_type), 0) * 0.5
      + case when exists (select 1 from terms q where l.title ilike '%' || q.query || '%' or coalesce(l.description, '') ilike '%' || q.query || '%') then 4 else 0 end
    )::numeric as rel
    from public.classified_listings l
    where l.status = 'published' and (me is null or l.owner_id <> me)
      and not exists (select 1 from seen s where s.listing_id = l.id)
  ),
  ranked as (
    select p.id, row_number() over (order by (p.rel > 0) desc, p.rel desc, p.featured desc, p.created_at desc) as rn from pool p
  )
  select l.* from ranked r join public.classified_listings l on l.id = r.id where r.rn <= n order by r.rn;
end $function$;
revoke all on function public.recommended_listings(integer) from public;
grant execute on function public.recommended_listings(integer) to anon, authenticated;

-- Limpeza diária: o histórico só é guardado 90 dias.
select cron.schedule('huambo-online-interests-cleanup', '17 3 * * *',
  $$delete from public.user_interests where created_at < now() - interval '90 days'$$);
