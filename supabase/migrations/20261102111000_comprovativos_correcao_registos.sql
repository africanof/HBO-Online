-- Correção: sem n.º de operação lido, a verificação falhava («record dup is not assigned yet»).
do $$
declare d text := pg_get_functiondef('public.ai_save_proof_check(text,uuid,text,boolean,numeric,date,text,text,text,text,text,text[],text)'::regprocedure);
begin
  if position('into dup;' in d) = 0 then
    d := replace(d, E'begin\n  select * into q from public.pending_proof_payments()',
      E'begin\n  select null::text as kind, null::uuid as payment_id into dup;\n  select null::text as kind, null::uuid as payment_id into fdup;\n  select * into q from public.pending_proof_payments()');
    if position('into dup;' in d) = 0 then raise exception 'correção não aplicada'; end if;
    execute d;
  end if;
end $$;
