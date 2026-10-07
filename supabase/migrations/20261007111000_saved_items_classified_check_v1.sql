-- "Guardar anúncio" falhava: a regra antiga não contava classified_listing_id.
alter table public.saved_items drop constraint if exists saved_items_check;
alter table public.saved_items add constraint saved_items_check check (
  (business_id is not null)::int + (provider_id is not null)::int + (service_id is not null)::int
  + (product_id is not null)::int + (auction_id is not null)::int + (classified_listing_id is not null)::int = 1);
