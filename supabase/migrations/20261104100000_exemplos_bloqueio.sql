-- Os exemplos (contas exemplo*@huambo.invalid) não podem ser comprados, reservados nem contactados:
-- carrinho, encomendas, bilhetes, gás, reservas e pedidos em estabelecimentos, propostas, alugueres,
-- pedidos de serviço e conversas. Quem tentar recebe EXAMPLE_ITEM (mensagem própria no Site e na APP).

create or replace function public.is_example_user(p_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select p_user is not null and exists (select 1 from auth.users u where u.id = p_user and u.email like 'exemplo%@huambo.invalid');
$$;
revoke all on function public.is_example_user(uuid) from public, anon;
grant execute on function public.is_example_user(uuid) to authenticated, service_role;

create or replace function public.block_example_target() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare target uuid;
begin
  if tg_table_name = 'cart_items' then select seller_id into target from public.products where id = new.product_id;
  elsif tg_table_name = 'orders' then target := new.seller_id;
  elsif tg_table_name = 'event_orders' then select organizer_id into target from public.events where id = new.event_id;
  elsif tg_table_name = 'fuel_orders' then select owner_id into target from public.fuel_stations where id = new.station_id;
  elsif tg_table_name = 'venue_orders' then select owner_id into target from public.venues where id = new.venue_id;
  elsif tg_table_name in ('listing_offers', 'rental_requests') then select owner_id into target from public.classified_listings where id = new.listing_id;
  elsif tg_table_name = 'service_requests' then
    target := new.provider_id;
    if target is null then select owner_id into target from public.businesses where id = new.business_id; end if;
  elsif tg_table_name = 'conversation_participants' then target := new.user_id;
  end if;
  if public.is_example_user(target) then raise exception 'EXAMPLE_ITEM'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['cart_items','orders','event_orders','fuel_orders','venue_orders','listing_offers','rental_requests','service_requests','conversation_participants'] loop
    execute format('drop trigger if exists aa_block_example on public.%I', t);
    execute format('create trigger aa_block_example before insert on public.%I for each row execute function public.block_example_target()', t);
  end loop;
end $$;
