-- A IA também lê e confirma os comprovativos de combustível/gás e de reservas (pagos ao Huambo Online),
-- até ao mesmo limite (platform_settings.proof_auto_max_kz) e com as mesmas verificações (valor, conta de
-- destino da plataforma, data, n.º de operação nunca usado, máximo 3 por pessoa em 24 horas).
-- O pagamento protegido das encomendas (Loja e anúncios) continua a ser confirmado sempre pela equipa.

do $$ declare d text := pg_get_functiondef('public.pending_proof_payments()'::regprocedure);
  o text := $o$ union all select 'order', p.id, p.proof_path, p.amount, p.method, p.reference, p.buyer_id, p.created_at, 'Pagamento protegido da encomenda' from public.order_payments p where p.status = 'pending' and p.provider = 'manual' and p.proof_path is not null$o$;
begin
  d := regexp_replace(d, '\s+', ' ', 'g');
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND pending_proof_payments'; end if;
  execute replace(d, o, o || $n$ union all select 'fuel_order', f.id, f.proof_path, f.total, f.pay_method, f.reference, f.buyer_id, f.updated_at, 'Combustível/gás C-' || f.ref_no from public.fuel_orders f where f.status = 'submitted' and f.proof_path is not null and public.platform_collects() union all select 'venue_order', v.id, v.proof_path, v.total, v.pay_method, v.reference, v.buyer_id, v.updated_at, 'Reserva R-' || v.ref_no from public.venue_orders v where v.status = 'submitted' and v.proof_path is not null and public.platform_collects()$n$);
end $$;

do $$ declare d text := pg_get_functiondef('public.ai_save_proof_check(text,uuid,text,boolean,numeric,date,text,text,text,text,text,text[],text)'::regprocedure);
  o text := $o$        when 'commission' then$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND ai_save_proof_check'; end if;
  execute replace(d, o, $n$        when 'fuel_order' then perform public.decide_fuel_payment(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
        when 'venue_order' then perform public.decide_venue_payment(p_payment_id, true, 'Confirmado automaticamente: o comprovativo bate certo.');
$n$ || o);
end $$;
