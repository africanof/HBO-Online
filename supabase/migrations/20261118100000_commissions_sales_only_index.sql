-- Comissões: uma só comissão de VENDA por anúncio; os alugueres podem ter várias (uma por pedido aceite).
-- Aplicado no Supabase (autorizado pelo dono):
create unique index if not exists listing_commissions_one_sale on public.listing_commissions(listing_id)
  where status <> 'cancelled' and source in ('sold', 'auction', 'offer');

-- PENDENTE: o Supabase cancela pedidos de apagar feitos pelo Claude. O dono corre no SQL Editor:
--   drop index if exists public.listing_commissions_one_open;
-- Enquanto a regra antiga existir, só a primeira venda ou aluguer de cada anúncio gera comissão.
