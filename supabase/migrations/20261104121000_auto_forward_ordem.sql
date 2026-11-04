-- O reencaminhamento automático tem de correr DEPOIS de trg_guard_team_request (que limpa os campos da equipa
-- ao criar): os gatilhos correm por ordem alfabética, por isso passa a chamar-se zz_orders_auto_forward.
drop trigger if exists orders_auto_forward on public.orders;
drop trigger if exists zz_orders_auto_forward on public.orders;
create trigger zz_orders_auto_forward before insert on public.orders for each row execute function public.orders_auto_forward();
