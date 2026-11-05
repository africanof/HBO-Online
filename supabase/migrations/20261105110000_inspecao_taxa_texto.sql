-- Inspeção: o aviso ao comprador quando não aprova diz que é devolvido o VALOR DA COMPRA (a taxa de inspeção
-- nunca é devolvida, mesmo que o negócio não se concretize).
do $$ declare d text := pg_get_functiondef('public.admin_item_inspection_step(uuid,text,timestamptz,text,jsonb,text,text[],text)'::regprocedure);
  o text := 'Vai receber o seu dinheiro de volta. Indique a conta para o reembolso em «Reclamações».';
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND'; end if;
  execute replace(d, o, 'Vai receber de volta o valor da compra (a taxa de inspeção não é devolvida). Indique a conta para o reembolso em «Reclamações».');
end $$;
