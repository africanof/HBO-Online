-- Nova categoria de empresas: «Postos de combustível e gás».
insert into public.categories(name, slug, type, active)
select 'Postos de combustível e gás', 'combustivel-gas', 'business', true
where not exists (select 1 from public.categories where slug = 'combustivel-gas');
