-- O Site e a APP usam a API (roles anon / authenticated). Sem GRANT nenhuma tabela era acessível
-- (criar conta, categorias, anúncios, mensagens… falhavam todos).
-- A segurança por linha (RLS, ativa em todas as tabelas) continua a decidir o que cada pessoa vê ou altera.

grant select on public.categories, public.provinces, public.municipalities, public.communes, public.neighborhoods,
  public.streets, public.classified_listings, public.businesses, public.services, public.products,
  public.provider_profiles, public.reviews, public.auctions to anon;

grant select, insert, update, delete on
  public.account_capabilities, public.addresses, public.auction_bids, public.auctions, public.businesses,
  public.cart_items, public.carts, public.categories, public.classified_listings, public.communes,
  public.conversation_participants, public.conversations, public.delivery_requests, public.followed_businesses,
  public.followed_providers, public.messages, public.moderation_reports, public.municipalities, public.neighborhoods,
  public.notification_preferences, public.order_items, public.orders, public.organization_members, public.organizations,
  public.products, public.profiles, public.provider_profiles, public.provinces, public.rental_requests, public.reviews,
  public.saved_items, public.services, public.streets, public.user_roles
to authenticated;
