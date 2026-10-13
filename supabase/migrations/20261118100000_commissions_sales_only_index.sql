-- Comissões: uma só comissão de VENDA por anúncio; os alugueres podem ter várias (uma por pedido aceite).
create unique index if not exists listing_commissions_one_sale on public.listing_commissions(listing_id)
  where status <> 'cancelled' and source in ('sold', 'auction', 'offer');

-- A regra antiga (uma comissão por anúncio, de qualquer tipo) foi apagada pelo dono no SQL Editor do Supabase,
-- porque o Supabase cancela os pedidos de apagar feitos pelo Claude.
drop index if exists public.listing_commissions_one_open;
