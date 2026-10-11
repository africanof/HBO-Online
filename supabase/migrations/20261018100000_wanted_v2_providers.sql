-- «Procura-se» também para serviços: «Procuro eletricista», «Preciso de doméstica»…
-- As palavras passam a ser comparadas sem acentos e pela raiz (6 primeiras letras),
-- para «eletricista» encontrar «Eletricidade» e «doméstica» encontrar «Domésticas».
-- Os profissionais e as empresas com a área parecida também recebem o aviso.

create or replace function public.fold_text(p text) returns text
language sql immutable set search_path = public as $$
  select translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;

-- Raízes das palavras do título (sem acentos; palavras comuns de pedido ignoradas).
create or replace function public.wanted_keywords(p_title text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct left(w, 6)), '{}') from (
    select w from regexp_split_to_table(public.fold_text(p_title), '[^a-z0-9]+') w
  ) t
  where char_length(w) >= 4 and w not in (
    'preciso','precisa','procuro','procura','compro','comprar','quero','pago','pagar','alguem','vende','vendo','venda',
    'estado','bons','boas','usado','usada','novo','nova','urgente','urgencia','para','mais','menos','como','desde',
    'entre','kwanzas','preco','barato','barata','qualquer','tipo','servico','servicos','profissional','pessoa',
    'senhor','senhora','trabalho','fazer','minha','minhas','meus','numa','numas','esta','este','isto','aqui','zona','bairro');
$$;

create or replace function public.notify_wanted_matches() returns trigger
language plpgsql security definer set search_path = public as $$
declare words text[]; budget text;
begin
  if new.purpose <> 'wanted' or new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;
  words := public.wanted_keywords(new.title);
  if coalesce(array_length(words, 1), 0) = 0 then return new; end if;
  budget := case
    when new.budget_min is not null and new.budget_max is not null then ' Orçamento: ' || new.budget_min || ' – ' || new.budget_max || ' Kz.'
    when new.budget_max is not null then ' Orçamento: até ' || new.budget_max || ' Kz.'
    when new.budget_min is not null then ' Orçamento: a partir de ' || new.budget_min || ' Kz.'
    else '' end;

  -- Vendedores (Loja e anúncios de venda/arrendamento)
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura o que vende', '«' || new.title || '».' || budget, jsonb_build_object('listing_id', new.id, 'for', 'wanted')
  from (
    select p.seller_id as uid from public.products p
     where p.active and p.seller_id <> new.owner_id and exists (select 1 from unnest(words) w where public.fold_text(p.name) like '%' || w || '%')
    union
    select l.owner_id from public.classified_listings l
     where l.status = 'published' and l.purpose in ('sale', 'rent', 'lease', 'auction') and l.owner_id <> new.owner_id
       and exists (select 1 from unnest(words) w where public.fold_text(l.title) like '%' || w || '%')
  ) s limit 30;

  -- Profissionais e empresas (área, área escrita, resumo, nome e serviços)
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura os seus serviços', '«' || new.title || '».' || budget, jsonb_build_object('listing_id', new.id, 'for', 'wanted')
  from (
    select pp.user_id as uid from public.provider_profiles pp
      left join public.categories c on c.id = pp.category_id
     where pp.active and pp.user_id <> new.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, pp.custom_category, pp.headline, pp.display_name)) like '%' || w || '%'
       or exists (select 1 from public.services sv where sv.provider_id = pp.user_id and sv.active and public.fold_text(sv.title) like '%' || w || '%'))
    union
    select b.owner_id from public.businesses b
      left join public.categories c on c.id = b.category_id
     where b.active and b.owner_id <> new.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, b.custom_category, b.name, b.description)) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = new.id::text)
  limit 30;
  return new;
end $$;
revoke all on function public.notify_wanted_matches() from public, anon, authenticated;

-- Pesquisa de profissionais e empresas sem acentos e também pela área.
create or replace function public.provider_directory(p_query text default '', p_category_id uuid default null, p_municipality_id uuid default null, p_limit integer default 30)
returns table(user_id uuid, display_name text, headline text, bio text, category_id uuid, category_name text, municipality_id uuid, municipality_name text,
  phone text, whatsapp text, avatar_url text, verified boolean, rating numeric, review_count bigint, services_count bigint, created_at timestamptz)
language sql stable set search_path to 'public' as $function$
  select p.user_id, p.display_name, p.headline, p.bio, p.category_id, coalesce(c.name, p.custom_category), p.municipality_id, m.name,
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
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', p.display_name, p.headline, p.bio, p.custom_category, c.name)) like '%' || public.fold_text(trim(p_query)) || '%'
         or exists (select 1 from public.services s where s.provider_id = p.user_id and s.active and public.fold_text(s.title) like '%' || public.fold_text(trim(p_query)) || '%'))
  group by p.user_id, c.name, m.name
  order by p.verified desc, count(distinct r.id) desc, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$;

create or replace function public.business_directory(p_query text default '', p_category_id uuid default null, p_municipality_id uuid default null, p_limit integer default 30)
returns table(id uuid, owner_id uuid, name text, description text, category_id uuid, category_name text, municipality_id uuid, municipality_name text,
  phone text, whatsapp text, logo_url text, address_text text, verified boolean, rating numeric, review_count bigint, created_at timestamptz)
language sql stable set search_path to 'public' as $function$
  select b.id, b.owner_id, b.name, b.description, b.category_id, coalesce(c.name, b.custom_category), b.municipality_id, m.name,
         b.phone, b.whatsapp, b.logo_url, b.address_text, b.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id), b.created_at
  from public.businesses b
  left join public.categories c on c.id = b.category_id
  left join public.municipalities m on m.id = b.municipality_id
  left join public.reviews r on r.business_id = b.id and r.status = 'published'
  where b.active
    and (p_category_id is null or b.category_id = p_category_id)
    and (p_municipality_id is null or b.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', b.name, b.description, b.custom_category, c.name)) like '%' || public.fold_text(trim(p_query)) || '%')
  group by b.id, c.name, m.name
  order by b.verified desc, count(distinct r.id) desc, b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$;
