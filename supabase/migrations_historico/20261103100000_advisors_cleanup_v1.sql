-- Revisão dos avisos do Supabase (segurança e velocidade) depois das últimas mudanças.

-- 1) Índices para chaves estrangeiras sem índice (apagar/atualizar utilizadores fica rápido).
create index if not exists auction_bids_retracted_by_idx on public.auction_bids (retracted_by);
create index if not exists auction_max_bids_bidder_id_idx on public.auction_max_bids (bidder_id);
create index if not exists auction_max_bids_retracted_by_idx on public.auction_max_bids (retracted_by);
create index if not exists listing_commissions_decided_by_idx on public.listing_commissions (decided_by);
create index if not exists order_dispute_events_actor_id_idx on public.order_dispute_events (actor_id);
create index if not exists subscription_payments_decided_by_idx on public.subscription_payments (decided_by);
create index if not exists subscription_payments_owner_id_idx on public.subscription_payments (owner_id);

-- 2) Índices repetidos (addresses_street_idx, cart_items_cart_product_uidx, carts_user_uidx):
--    ficam por agora; apagar índices pede confirmação à parte. Não estragam nada, só ocupam espaço.

-- 3) search_path fixo nas funções auxiliares.
alter function public.auction_increment(numeric, numeric) set search_path = public;
alter function public.portfolio_photos_ok(text[], uuid) set search_path = public;
alter function public.subscription_active_until(public.subscriptions) set search_path = public;

-- 4) Funções internas que os visitantes sem sessão não precisam de chamar.
--    (subject_paid_up, product_paid_up e portfolio_target_public ficam: são usadas nas regras de leitura pública.)
revoke execute on function public.store_paid_up(uuid) from anon, public;
revoke execute on function public.portfolio_target_owned(uuid, uuid) from anon, public;
revoke execute on function public.plan_monthly_price(text) from anon, public;
