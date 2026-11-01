-- Categorias de anúncios para emprego: recrutamento e estágios (remunerados e não remunerados).
insert into public.categories(name, slug, type, active) values
  ('Emprego e recrutamento', 'emprego', 'classified', true),
  ('Estágios remunerados', 'estagios-remunerados', 'classified', true),
  ('Estágios não remunerados', 'estagios-nao-remunerados', 'classified', true)
on conflict (slug) do update set name = excluded.name, type = excluded.type, active = true;
