-- Área de atividade "Outra": o profissional ou a empresa escreve a sua própria área
-- quando não está na lista. A área escrita aparece nas listas e entra na pesquisa.

alter table public.provider_profiles add column if not exists custom_category text
  check (custom_category is null or char_length(trim(custom_category)) between 2 and 60);
alter table public.businesses add column if not exists custom_category text
  check (custom_category is null or char_length(trim(custom_category)) between 2 and 60);

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
    and (coalesce(p_query, '') = '' or lower(p.display_name || ' ' || coalesce(p.headline, '') || ' ' || coalesce(p.bio, '') || ' ' || coalesce(p.custom_category, '')) like '%' || lower(p_query) || '%'
         or exists (select 1 from public.services s where s.provider_id = p.user_id and s.active and lower(s.title) like '%' || lower(p_query) || '%'))
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
    and (coalesce(p_query, '') = '' or lower(b.name || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.custom_category, '')) like '%' || lower(p_query) || '%')
  group by b.id, c.name, m.name
  order by b.verified desc, count(distinct r.id) desc, b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$;
