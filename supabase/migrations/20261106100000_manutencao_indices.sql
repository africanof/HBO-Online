-- Manutenção da base de dados (avisos do Supabase): índices duplicados, ligações entre tabelas sem índice
-- e funções sem caminho de pesquisa fixo. Não muda o comportamento do Site nem da APP.

-- Índices iguais a outros que já existem (os que ficam são os das restrições UNIQUE).
drop index if exists public.addresses_street_idx;
drop index if exists public.cart_items_cart_product_uidx;
drop index if exists public.carts_user_uidx;

-- Índices para as ligações entre tabelas (apagar/atualizar o registo ligado fica rápido).
create index if not exists chat_blocks_conversation_id_fk_idx on public.chat_blocks(conversation_id);
create index if not exists event_orders_team_forwarded_by_fk_idx on public.event_orders(team_forwarded_by);
create index if not exists fuel_alerts_municipality_id_fk_idx on public.fuel_alerts(municipality_id);
create index if not exists fuel_orders_team_forwarded_by_fk_idx on public.fuel_orders(team_forwarded_by);
create index if not exists fuel_platform_payments_owner_id_fk_idx on public.fuel_platform_payments(owner_id);
create index if not exists fuel_platform_payments_decided_by_fk_idx on public.fuel_platform_payments(decided_by);
create index if not exists fuel_stations_municipality_id_fk_idx on public.fuel_stations(municipality_id);
create index if not exists import_requests_catalog_id_fk_idx on public.import_requests(catalog_id);
create index if not exists item_inspections_inspector_id_fk_idx on public.item_inspections(inspector_id);
create index if not exists item_inspections_product_id_fk_idx on public.item_inspections(product_id);
create index if not exists item_inspections_requester_id_fk_idx on public.item_inspections(requester_id);
create index if not exists item_inspections_seller_id_fk_idx on public.item_inspections(seller_id);
create index if not exists listing_ai_reviews_dismissed_by_fk_idx on public.listing_ai_reviews(dismissed_by);
create index if not exists listing_offers_team_forwarded_by_fk_idx on public.listing_offers(team_forwarded_by);
create index if not exists listing_private_places_address_id_fk_idx on public.listing_private_places(address_id);
create index if not exists messages_audience_fk_idx on public.messages(audience);
create index if not exists messages_forwarded_from_fk_idx on public.messages(forwarded_from);
create index if not exists messages_handled_by_fk_idx on public.messages(handled_by);
create index if not exists orders_team_forwarded_by_fk_idx on public.orders(team_forwarded_by);
create index if not exists orders_delivery_municipality_id_fk_idx on public.orders(delivery_municipality_id);
create index if not exists promo_boosts_owner_id_fk_idx on public.promo_boosts(owner_id);
create index if not exists promo_boosts_decided_by_fk_idx on public.promo_boosts(decided_by);
create index if not exists promo_posts_owner_id_fk_idx on public.promo_posts(owner_id);
create index if not exists provider_private_contacts_address_id_fk_idx on public.provider_private_contacts(address_id);
create index if not exists rental_requests_team_forwarded_by_fk_idx on public.rental_requests(team_forwarded_by);
create index if not exists seller_delivery_zones_municipality_id_fk_idx on public.seller_delivery_zones(municipality_id);
create index if not exists service_requests_team_forwarded_by_fk_idx on public.service_requests(team_forwarded_by);
create index if not exists service_requests_order_id_fk_idx on public.service_requests(order_id);
create index if not exists user_interests_category_id_fk_idx on public.user_interests(category_id);
create index if not exists user_interests_listing_id_fk_idx on public.user_interests(listing_id);
create index if not exists venue_orders_team_forwarded_by_fk_idx on public.venue_orders(team_forwarded_by);
create index if not exists venue_platform_payments_decided_by_fk_idx on public.venue_platform_payments(decided_by);
create index if not exists venue_platform_payments_owner_id_fk_idx on public.venue_platform_payments(owner_id);

-- Caminho de pesquisa fixo (boa prática de segurança).
alter function public.ai_feature_limit(text) set search_path = public;
alter function public.clear_courier_location() set search_path = public;
alter function public.email_limits() set search_path = public;
alter function public.fuel_product_label(text) set search_path = public;
alter function public.import_ref(bigint) set search_path = public;
alter function public.item_inspection_category(text) set search_path = public;
alter function public.item_inspection_ref(bigint) set search_path = public;
alter function public.listing_ai_hash(public.classified_listings) set search_path = public;
alter function public.proof_clean(text) set search_path = public;
