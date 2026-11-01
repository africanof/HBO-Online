-- Nova categoria de empresas: «Fábricas» (aparece também nas categorias da página inicial).
insert into public.categories(name, slug, type, active)
select 'Fábricas', 'fabricas', 'business', true
where not exists (select 1 from public.categories where slug = 'fabricas');
