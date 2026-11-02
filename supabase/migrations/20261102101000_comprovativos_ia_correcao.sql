-- Correção: os avisos de texto juntavam-se à lista como se fossem listas (erro «malformed array literal»).
do $$
declare d text := pg_get_functiondef('public.ai_save_proof_check(text,uuid,text,boolean,numeric,date,text,text,text,text,text,text[])'::regprocedure);
begin
  d := replace(d, '''Este n.º de operação já foi usado noutro pagamento (talão repetido).''; end if;', '''Este n.º de operação já foi usado noutro pagamento (talão repetido).''::text; end if;');
  d := replace(d, '''A conta de destino não é nenhuma das contas da plataforma.''; end if;', '''A conta de destino não é nenhuma das contas da plataforma.''::text; end if;');
  d := replace(d, '''A data do talão não bate com a data do pedido.''; end if;', '''A data do talão não bate com a data do pedido.''::text; end if;');
  execute d;
end $$;
