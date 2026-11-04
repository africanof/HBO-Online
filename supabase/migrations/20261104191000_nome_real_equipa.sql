-- Administradores e moderadores veem sempre o nome real e a fotografia, em qualquer página
-- (anúncios, perfil de vendedor, avaliações, licitações, conversas…). Os outros continuam a ver o nome público.
-- Só nas funções de LEITURA: os avisos (notificações) continuam a usar o nome público, para nunca levarem
-- o nome real de ninguém a outros utilizadores.

create or replace function public.viewer_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when public.has_admin_role() then coalesce(nullif(trim(p.full_name), ''), public.shown_name(p_user)) else public.shown_name(p_user) end
  from public.profiles p where p.id = p_user;
$$;
create or replace function public.viewer_avatar(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when public.has_admin_role() then p.avatar_url else public.shown_avatar(p_user) end from public.profiles p where p.id = p_user;
$$;
grant execute on function public.viewer_name(uuid), public.viewer_avatar(uuid) to anon, authenticated;

do $$
declare fn text; d text; n int := 0;
  fns text[] := array['auction_bids_for_v2(uuid)', 'auction_bids_for(uuid)', 'available_deliveries()', 'cart_contents()', 'cart_delivery_quote(uuid)',
    'get_public_profile(uuid)', 'list_reviews_v2(uuid,uuid)', 'list_reviews_v3(uuid,uuid)', 'list_reviews(uuid,uuid)', 'listing_deal_candidates(uuid)',
    'listing_offers_for(uuid)', 'my_blocks()', 'my_conversation_partners()', 'my_deliveries(text)', 'my_disputes_v2()', 'my_disputes()', 'my_follows()',
    'my_listing_claims()', 'my_orders_v2(text)', 'my_orders_v3(text)', 'my_orders(text)', 'my_pending_reviews()', 'my_rental_requests(text)',
    'my_service_requests_v2(text)', 'my_service_requests_v3(text)', 'my_service_requests(text)', 'product_catalog(text,uuid,uuid,uuid,integer)',
    'public_seller(uuid)', 'user_reviews_for_v2(uuid)', 'user_reviews_for(uuid)'];
begin
  foreach fn in array fns loop
    d := pg_get_functiondef(fn::regprocedure);
    d := replace(replace(d, 'public.shown_name(', 'public.viewer_name('), 'public.shown_avatar(', 'public.viewer_avatar(');
    execute d; n := n + 1;
  end loop;
  raise notice 'funções: %', n;
end $$;
