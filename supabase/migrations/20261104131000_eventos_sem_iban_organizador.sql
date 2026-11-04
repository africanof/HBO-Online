-- Com o pagamento protegido, os bilhetes são pagos ao Huambo Online: o organizador já não precisa de
-- indicar a sua conta (IBAN/Express) para publicar um evento com bilhetes pagos.
do $$ declare d text := pg_get_functiondef('public.guard_event()'::regprocedure);
  o text := 'if exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active and t.price > 0)';
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND guard_event'; end if;
  execute replace(d, o, 'if not public.platform_collects() and exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active and t.price > 0)');
end $$;
