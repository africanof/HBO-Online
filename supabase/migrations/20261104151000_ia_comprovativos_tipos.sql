-- Os comprovativos verificados pela IA passam a aceitar também combustível/gás e reservas.
alter table public.payment_proof_checks drop constraint if exists payment_proof_checks_kind_check;
alter table public.payment_proof_checks add constraint payment_proof_checks_kind_check
  check (kind in ('subscription', 'boost', 'promo_boost', 'event_fee', 'fuel_fee', 'venue_fee', 'commission', 'order', 'fuel_order', 'venue_order'));
