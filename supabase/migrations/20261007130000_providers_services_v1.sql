-- Huambo Online — profissionais, serviços, contacto e avaliações

alter table public.provider_profiles
  add column if not exists municipality_id uuid references public.municipalities(id),
  add column if not exists whatsapp text,
  add column if not exists avatar_url text;
alter table public.services add column if not exists municipality_id uuid references public.municipalities(id);

create index if not exists provider_profiles_category_idx on public.provider_profiles(category_id) where active;
create index if not exists provider_profiles_municipality_idx on public.provider_profiles(municipality_id) where active;
create index if not exists services_provider_idx on public.services(provider_id) where active;

-- Uma avaliação por pessoa por profissional/empresa
create unique index if not exists reviews_author_provider_uidx on public.reviews(author_id, provider_id) where provider_id is not null;
create unique index if not exists reviews_author_business_uidx on public.reviews(author_id, business_id) where business_id is not null;

-- Diretório de profissionais com média das avaliações
create or replace function public.provider_directory(p_query text default '', p_category_id uuid default null,
  p_municipality_id uuid default null, p_limit integer default 30)
returns table(user_id uuid, display_name text, headline text, bio text, category_id uuid, category_name text,
  municipality_id uuid, municipality_name text, phone text, whatsapp text, avatar_url text, verified boolean,
  rating numeric, review_count bigint, services_count bigint, created_at timestamptz)
language sql stable set search_path = public as $$
  select p.user_id, p.display_name, p.headline, p.bio, p.category_id, c.name, p.municipality_id, m.name,
         p.phone, p.whatsapp, p.avatar_url, p.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id),
         (select count(*) from public.services s where s.provider_id = p.user_id and s.active), p.created_at
  from public.provider_profiles p
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  left join public.reviews r on r.provider_id = p.user_id and r.status = 'published'
  where p.active
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or lower(p.display_name || ' ' || coalesce(p.headline, '') || ' ' || coalesce(p.bio, '')) like '%' || lower(p_query) || '%'
         or exists (select 1 from public.services s where s.provider_id = p.user_id and s.active and lower(s.title) like '%' || lower(p_query) || '%'))
  group by p.user_id, c.name, m.name
  order by p.verified desc, count(distinct r.id) desc, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
grant execute on function public.provider_directory(text, uuid, uuid, integer) to anon, authenticated;

-- Avaliar um profissional ou empresa (publicada logo; editar substitui a anterior)
create or replace function public.submit_review(p_provider_id uuid, p_business_id uuid, p_rating integer, p_comment text)
returns public.reviews language plpgsql security definer set search_path = public as $$
declare r public.reviews; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'REVIEW_TARGET_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if p_provider_id is not null then
    if not exists (select 1 from public.provider_profiles where user_id = p_provider_id and active) then raise exception 'PROVIDER_NOT_FOUND'; end if;
    owner := p_provider_id;
  else
    select owner_id into owner from public.businesses where id = p_business_id and active;
    if owner is null then raise exception 'BUSINESS_NOT_FOUND'; end if;
  end if;
  if owner = auth.uid() then raise exception 'CANNOT_REVIEW_SELF'; end if;
  select * into r from public.reviews where author_id = auth.uid()
    and provider_id is not distinct from p_provider_id and business_id is not distinct from p_business_id;
  if found then
    update public.reviews set rating = p_rating, comment = nullif(trim(p_comment), ''), status = 'published', created_at = now()
     where id = r.id returning * into r;
  else
    insert into public.reviews(author_id, provider_id, business_id, rating, comment, status)
    values (auth.uid(), p_provider_id, p_business_id, p_rating, nullif(trim(p_comment), ''), 'published') returning * into r;
    insert into public.notifications(user_id, type, title, body, data)
    values (owner, 'review', 'Nova avaliação', p_rating || ' estrela(s)' || coalesce(': ' || left(trim(p_comment), 140), ''),
            jsonb_build_object('review_id', r.id, 'provider_id', p_provider_id, 'business_id', p_business_id));
  end if;
  return r;
end $$;

-- Avaliações públicas com o nome do autor
create or replace function public.list_reviews(p_provider_id uuid default null, p_business_id uuid default null)
returns table(id uuid, rating integer, comment text, created_at timestamptz, author_id uuid, author_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador')
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published'
    and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by r.created_at desc limit 100;
$$;
grant execute on function public.list_reviews(uuid, uuid) to anon, authenticated;

-- Contactar profissional ou empresa (mesma lógica dos classificados)
create or replace function public.start_directory_conversation(p_provider_id uuid, p_business_id uuid, p_message text)
returns public.conversations language plpgsql security definer set search_path = public as $$
declare c public.conversations; owner uuid; subj text; ctx text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'CONTACT_TARGET_REQUIRED'; end if;
  if p_provider_id is not null then
    select user_id, display_name into owner, subj from public.provider_profiles where user_id = p_provider_id and active;
    ctx := 'provider';
  else
    select owner_id, name into owner, subj from public.businesses where id = p_business_id and active;
    ctx := 'business';
  end if;
  if owner is null then raise exception 'NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_CONTACT_SELF'; end if;
  select * into c from public.conversations
   where created_by = auth.uid() and context_type = ctx
     and provider_id is not distinct from p_provider_id and business_id is not distinct from p_business_id
   order by created_at limit 1;
  if not found then
    insert into public.conversations(created_by, subject, context_type, provider_id, business_id)
    values (auth.uid(), subj, ctx, p_provider_id, p_business_id) returning * into c;
  end if;
  insert into public.conversation_participants(conversation_id, user_id) values (c.id, auth.uid()), (c.id, owner) on conflict do nothing;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, auth.uid(), trim(p_message));
  update public.conversation_participants set last_read_at = now() where conversation_id = c.id and user_id = auth.uid();
  return c;
end $$;

revoke all on function public.submit_review(uuid, uuid, integer, text) from public, anon;
revoke all on function public.start_directory_conversation(uuid, uuid, text) from public, anon;
grant execute on function public.submit_review(uuid, uuid, integer, text) to authenticated;
grant execute on function public.start_directory_conversation(uuid, uuid, text) to authenticated;

-- Avaliações só pela função (evita estrelas "auto-publicadas" por inserção direta)
create or replace function public.guard_review_write()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  -- invoker: numa inserção direta pela API current_user = authenticated; dentro de submit_review = dono da função
  if public.has_admin_role() or current_user in ('postgres', 'supabase_admin') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then return old; end if;
  raise exception 'USE_REVIEW_FUNCTION';
end $$;
create trigger trg_guard_review_write before insert or update on public.reviews
  for each row execute function public.guard_review_write();

create policy reviews_admin_update on public.reviews for update to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
