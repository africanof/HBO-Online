-- Leilões: incrementos iguais aos do eBay, em kwanzas (valores do eBay em dólares × 1000).
-- eBay: <1 → 0,05 · 1–4,99 → 0,25 · 5–24,99 → 0,50 · 25–99,99 → 1 · 100–249,99 → 2,50 · 250–499,99 → 5
--       500–999,99 → 10 · 1000–2499,99 → 25 · 2500–4999,99 → 50 · 5000+ → 100
create or replace function public.auction_increment(p_price numeric, p_min numeric default 0)
returns numeric language sql immutable set search_path = public as $$
  select greatest(coalesce(p_min, 0), case
    when p_price < 1000 then 50 when p_price < 5000 then 250 when p_price < 25000 then 500 when p_price < 100000 then 1000
    when p_price < 250000 then 2500 when p_price < 500000 then 5000 when p_price < 1000000 then 10000
    when p_price < 2500000 then 25000 when p_price < 5000000 then 50000 else 100000 end);
$$;
