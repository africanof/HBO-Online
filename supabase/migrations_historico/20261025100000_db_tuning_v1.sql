-- Afinação da base de dados (recomendações do Supabase), sem mudar o que as regras permitem:
-- 1) Nas regras de acesso (RLS), auth.uid() passa a (select auth.uid()): é calculado uma vez por pedido
--    em vez de uma vez por linha (listas mais rápidas quando houver muitos dados).
-- 2) Índices para as ligações entre tabelas (chaves estrangeiras) que ainda não tinham.
-- 3) photo_search_limit com search_path fixo.

do $$
declare p record; stmt text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
           where schemaname = 'public' and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
             and coalesce(qual, '') || coalesce(with_check, '') !~ 'SELECT auth\.uid\(\)'
  loop
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then stmt := stmt || ' using (' || regexp_replace(p.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g') || ')'; end if;
    if p.with_check is not null then stmt := stmt || ' with check (' || regexp_replace(p.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g') || ')'; end if;
    execute stmt;
  end loop;
end $$;

do $$
declare fk record; cols text; idx text;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conname, c.conkey, cl.relname
    from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
    from unnest(fk.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = fk.tbl and a.attnum = k.attnum;
    idx := left(fk.relname || '_' || replace(replace(cols, '"', ''), ', ', '_') || '_fk_idx', 63);
    execute format('create index if not exists %I on %s (%s)', idx, fk.tbl, cols);
  end loop;
end $$;

alter function public.photo_search_limit() set search_path = public;
