-- Entrega em casa: o pedido aos estafetas mostra só o município; a morada continua privada (a equipa passa-a ao estafeta escolhido).
create or replace function public.courier_delivery_on_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.delivery_requests; pt public.pickup_points;
begin
  if new.escrow_status = 'held' and old.escrow_status is distinct from 'held' and new.courier_fee > 0 and new.fulfillment_type in ('delivery', 'point')
     and not exists (select 1 from public.delivery_requests x where x.order_id = new.id and x.status <> 'cancelled') then
    if new.fulfillment_type = 'point' then select * into pt from public.pickup_points where id = new.pickup_point_id; end if;
    insert into public.delivery_requests(order_id, requester_id, status, notes)
    values (new.id, new.buyer_id, 'pending', left(case when new.fulfillment_type = 'point' then '📦 Levar ao ponto de recolha: ' || coalesce(pt.name || ' — ' || pt.address, '')
                                                    else '🏠 Entrega em casa — ' || coalesce((select name from public.municipalities where id = new.delivery_municipality_id), 'Huambo') || ' (a morada é dada pela equipa ao estafeta escolhido)' end, 500))
    returning * into d;
    insert into public.notifications(user_id, type, title, body, data)
    select c.user_id, 'delivery', 'Nova entrega disponível', 'Encomenda ' || public.order_ref(new) || ' · ' || public.money_label(new.courier_fee, new.currency) || ' de entrega.',
           jsonb_build_object('delivery_id', d.id, 'for', 'courier')
    from public.couriers c where c.status = 'approved' and c.available and c.user_id not in (new.seller_id, new.buyer_id) limit 100;
    insert into public.notifications(user_id, type, title, body, data) values
      (new.seller_id, 'delivery', 'Um estafeta vai buscar o artigo 🛵', 'Prepare «' || left(coalesce(new.title, ''), 60) || '». O estafeta do Huambo Online vai buscá-lo e levá-lo a quem comprou.',
       jsonb_build_object('order_id', new.id, 'for', 'sale'));
  end if;
  return new;
end $$;
