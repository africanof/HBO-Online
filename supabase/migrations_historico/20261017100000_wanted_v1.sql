-- «Procura-se»: pedidos de compradores com orçamento (de… até…) e aviso automático
-- aos vendedores que têm artigos parecidos na Loja ou em anúncios de venda.

alter table public.classified_listings add column if not exists budget_min numeric check (budget_min is null or budget_min >= 0);
alter table public.classified_listings add column if not exists budget_max numeric check (budget_max is null or budget_max >= 0);
alter table public.classified_listings add constraint classified_budget_order
  check (budget_min is null or budget_max is null or budget_min <= budget_max) not valid;
alter table public.classified_listings validate constraint classified_budget_order;

-- Palavras do título que servem para procurar (sem "preciso", "procuro", "compro"…).
create or replace function public.wanted_keywords(p_title text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct w), '{}') from (
    select lower(w) w from regexp_split_to_table(coalesce(p_title, ''), '[^[:alnum:]]+') w
  ) t
  where char_length(w) >= 4 and w not in (
    'preciso','procuro','procura','compro','comprar','quero','pago','pagar','alguem','alguém','vende','vendo','venda',
    'estado','bom','boa','bons','boas','usado','usada','novo','nova','urgente','urgência','para',
    'mais','menos','como','com','sem','até','desde','entre','kwanzas','preço','barato','barata','qualquer','tipo')
  limit 6;
$$;

-- Quando um pedido «Procuro» é publicado, avisa até 30 vendedores com artigos parecidos.
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
  insert into public.notifications(user_id, type, title, body, data)
  select s.seller, 'system', 'Alguém procura o que vende', '«' || new.title || '».' || budget,
         jsonb_build_object('listing_id', new.id, 'for', 'wanted')
  from (
    select distinct p.seller_id as seller from public.products p
     where p.active and p.seller_id <> new.owner_id and exists (select 1 from unnest(words) w where lower(p.name) like '%' || w || '%')
    union
    select distinct l.owner_id from public.classified_listings l
     where l.status = 'published' and l.purpose in ('sale', 'rent', 'lease', 'auction') and l.owner_id <> new.owner_id
       and exists (select 1 from unnest(words) w where lower(l.title) like '%' || w || '%')
  ) s limit 30;
  return new;
end $$;
revoke all on function public.notify_wanted_matches() from public, anon, authenticated;

create trigger trg_notify_wanted_matches after insert or update of status on public.classified_listings
  for each row execute function public.notify_wanted_matches();
