CREATE OR REPLACE FUNCTION public.dispute_action(p_dispute_id uuid, p_action text, p_note text DEFAULT NULL::text, p_photos text[] DEFAULT '{}'::text[])
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.order_disputes; r text; ph text[]; nxt text; outc text; ev text; held boolean; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  r := case when d.buyer_id = auth.uid() then 'buyer' when d.seller_id = auth.uid() then 'seller' when public.has_admin_role() then 'admin' end;
  if r is null then raise exception 'NOT_ORDER_PARTY'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  -- dinheiro ainda guardado pelo Huambo Online (pagamento protegido): o reembolso sai da plataforma
  held := exists (select 1 from public.orders where id = d.order_id and escrow_status = 'held');
  ph := case when r = 'admin' then '{}' else public.dispute_clean_photos(d.order_id, p_photos) end;
  ev := case p_action when 'accept' then 'accepted' when 'decline' then 'declined' when 'mark_returned' then 'returned'
    when 'confirm_return' then 'return_received' when 'mark_refunded' then 'refund_sent' when 'confirm_refund' then 'refund_confirmed'
    when 'confirm_replacement' then 'replacement_received' when 'escalate' then 'escalated' when 'withdraw' then 'withdrawn'
    when 'comment' then 'comment' end;
  if ev is null then raise exception 'INVALID_ACTION'; end if;

  if p_action = 'accept' and r = 'seller' and d.status = 'open' then
    nxt := case d.request when 'refund' then 'awaiting_refund' when 'return_refund' then 'awaiting_return' else 'replacing' end;
  elsif p_action = 'decline' and r = 'seller' and d.status = 'open' then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    nxt := 'declined';
  elsif p_action = 'mark_returned' and r = 'buyer' and d.status = 'awaiting_return' then nxt := 'returned';
  elsif p_action = 'confirm_return' and r = 'seller' and d.status = 'returned' then nxt := 'awaiting_refund';
  elsif p_action = 'mark_refunded' and d.status = 'awaiting_refund' and ((r = 'seller' and not held) or (r = 'admin' and held)) then
    if held and d.refund_to is null then raise exception 'REFUND_ACCOUNT_REQUIRED'; end if;
    nxt := 'refund_sent';
  elsif p_action = 'confirm_refund' and d.status = 'refund_sent' and (r = 'buyer' or (r = 'admin' and held)) then nxt := 'resolved'; outc := 'refunded';
  elsif p_action = 'confirm_replacement' and r = 'buyer' and d.status = 'replacing' then nxt := 'resolved'; outc := 'replaced';
  elsif p_action = 'withdraw' and r = 'buyer' then nxt := 'resolved'; outc := 'withdrawn';
  elsif p_action = 'escalate' and r in ('buyer', 'seller') and d.status <> 'escalated' then
    -- o comprador pode chamar logo depois de uma recusa; de resto, só ao fim de 3 dias sem avanço
    if not ((r = 'buyer' and d.status = 'declined') or (d.status not in ('declined', 'open') and d.updated_at < now() - interval '3 days')
            or (r = 'buyer' and d.status = 'open' and d.updated_at < now() - interval '3 days')) then raise exception 'ESCALATE_TOO_EARLY'; end if;
    nxt := 'escalated';
  elsif p_action = 'comment' then
    if txt is null and cardinality(ph) = 0 then raise exception 'MESSAGE_REQUIRED'; end if;
    nxt := d.status;
  else raise exception 'INVALID_TRANSITION'; end if;

  update public.order_disputes set status = nxt, outcome = coalesce(outc, outcome),
    resolved_at = case when nxt = 'resolved' then now() else resolved_at end,
    updated_at = case when p_action = 'comment' then updated_at else now() end
   where id = d.id returning * into d;
  if outc = 'refunded' then
    update public.orders set refunded_amount = least(total, refunded_amount + d.amount),
      payment_status = case when refunded_amount + d.amount >= total then 'refunded' else payment_status end, updated_at = now()
     where id = d.order_id;
  end if;
  perform public.dispute_log(d, r, ev, txt, ph);
  if nxt = 'escalated' then
    perform public.notify_staff('Disputa para decidir', coalesce(txt, 'Encomenda com pedido de devolução ou reembolso.'), jsonb_build_object('dispute_id', d.id));
  end if;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.dispute_clean_photos(p_order_id uuid, p_photos text[])
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p text; res text[] := '{}';
begin
  foreach p in array coalesce(p_photos, '{}') loop
    if p !~ ('^' || p_order_id::text || '/' || auth.uid()::text || '/[A-Za-z0-9._-]{1,120}$') then raise exception 'INVALID_PHOTO'; end if;
    res := res || p;
  end loop;
  if cardinality(res) > 4 then raise exception 'TOO_MANY_PHOTOS'; end if;
  return res;
end $function$
;

CREATE OR REPLACE FUNCTION public.dispute_events_json(p_dispute_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('actor_role', e.actor_role, 'action', e.action, 'note', e.note, 'photos', to_jsonb(e.photos), 'created_at', e.created_at) order by e.created_at), '[]')
  from public.order_dispute_events e where e.dispute_id = p_dispute_id;
$function$
;

CREATE OR REPLACE FUNCTION public.dispute_log(d order_disputes, p_role text, p_action text, p_note text, p_photos text[] DEFAULT '{}'::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare who uuid; title text; body text;
begin
  insert into public.order_dispute_events(dispute_id, actor_id, actor_role, action, note, photos)
  values (d.id, case when p_role = 'system' then null else auth.uid() end, p_role, p_action, nullif(left(trim(coalesce(p_note, '')), 1000), ''), coalesce(p_photos, '{}'));
  title := case p_action
    when 'opened' then 'Pedido de devolução ou reembolso'
    when 'accepted' then 'O vendedor aceitou o seu pedido ✔'
    when 'declined' then 'O vendedor recusou o seu pedido'
    when 'returned' then 'O comprador devolveu o artigo'
    when 'return_received' then 'O vendedor recebeu a devolução'
    when 'refund_sent' then 'O vendedor diz que devolveu o dinheiro'
    when 'refund_confirmed' then 'Reembolso confirmado ✔'
    when 'replacement_received' then 'Troca confirmada ✔'
    when 'escalated' then 'Pedido enviado à administração'
    when 'decided' then 'A administração decidiu'
    when 'withdrawn' then 'O comprador desistiu do pedido'
    when 'auto_refund' then 'Encomenda paga cancelada: reembolso'
    else 'Nova mensagem no pedido de devolução' end;
  body := coalesce(nullif(left(trim(coalesce(p_note, '')), 200), ''), 'Encomenda de ' || replace(to_char(coalesce(d.amount, (select total from public.orders where id = d.order_id)), 'FM999,999,999,990'), ',', ' ') || ' Kz');
  -- avisa a(s) outra(s) parte(s)
  for who in select x from unnest(array[d.buyer_id, d.seller_id]) x
    where p_role in ('admin', 'system') or x is distinct from auth.uid() loop
    insert into public.notifications(user_id, type, title, body, data)
    values (who, 'order', title, body, jsonb_build_object('order_id', d.order_id, 'dispute_id', d.id, 'for', 'dispute'));
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.enqueue_job(p_kind text, p_ref uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.job_queue(kind, ref_id) values (p_kind, p_ref) on conflict (kind, ref_id) where done_at is null do nothing
$function$
;

CREATE OR REPLACE FUNCTION public.escrow_mark_paid(p_payment_id uuid, p_paid_amount numeric, p_provider_payment_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.order_payments; o public.orders; d public.order_disputes;
begin
  select * into pay from public.order_payments where id = p_payment_id for update;
  if not found or pay.status not in ('pending', 'expired') then return false; end if;
  update public.order_payments set status = 'confirmed', decided_at = now(), decided_by = auth.uid(),
    paid_amount = coalesce(p_paid_amount, pay.amount), provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
   where id = pay.id returning * into pay;
  select * into o from public.orders where id = pay.order_id for update;
  if o.escrow_status <> 'awaiting_payment' then
    perform public.notify_staff('Pagamento a mais — devolver ao cliente', pay.paid_amount || ' Kz · ' || public.order_ref(o) || ' já estava paga.',
      jsonb_build_object('payment_id', pay.id, 'order_id', o.id));
    return false;
  end if;
  update public.orders set escrow_status = 'held', payment_status = 'paid', paid_at = now(), updated_at = now() where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'sale', o.total, 'Pagamento recebido · ' || public.order_ref(o));
  if o.status = 'cancelled' then
    if not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
      insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
      values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda foi paga depois de ser cancelada.', o.total, 'awaiting_refund')
      returning * into d;
      perform public.dispute_log(d, 'system', 'auto_refund', 'A encomenda foi paga depois de ser cancelada: o Huambo Online vai devolver o dinheiro.');
    end if;
  else
    insert into public.notifications(user_id, type, title, body, data) values
      (o.seller_id, 'order', 'Pagamento recebido 🛡️', 'O cliente pagou ' || o.total || ' Kz da encomenda ' || public.order_ref(o)
        || '. O dinheiro fica guardado pelo Huambo Online até o cliente receber. Já pode preparar e enviar.', jsonb_build_object('order_id', o.id, 'for', 'sale')),
      (o.buyer_id, 'order', 'Pagamento confirmado ✔', 'Recebemos ' || o.total || ' Kz da encomenda ' || public.order_ref(o)
        || '. O dinheiro fica guardado até confirmar que recebeu a encomenda.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.escrow_refund_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders;
begin
  if new.status <> 'awaiting_refund' or (tg_op = 'UPDATE' and old.status = 'awaiting_refund') then return new; end if;
  select * into o from public.orders where id = new.order_id;
  if o.escrow_status is distinct from 'held' then return new; end if;
  perform public.notify_staff('Reembolso a enviar (pagamento protegido)', coalesce(new.amount, o.total) || ' Kz · ' || public.order_ref(o),
    jsonb_build_object('dispute_id', new.id, 'order_id', o.id));
  if new.refund_to is null then
    insert into public.notifications(user_id, type, title, body, data)
    values (new.buyer_id, 'order', 'Para onde devolvemos o dinheiro?',
      'O Huambo Online vai devolver ' || coalesce(new.amount, o.total) || ' Kz da encomenda ' || public.order_ref(o) || '. Indique o seu IBAN ou número Multicaixa Express no pedido.',
      jsonb_build_object('order_id', o.id, 'dispute_id', new.id, 'for', 'dispute'));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.escrow_release(p_order_id uuid, p_by text, p_force boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; net numeric; fee numeric; pct numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.escrow_status is distinct from 'held' then return false; end if;
  if o.status = 'cancelled' and not p_force then return false; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then return false; end if;
  net := o.total - o.refunded_amount;
  if net <= 0 then
    update public.orders set escrow_status = 'refunded', updated_at = now() where id = o.id;
    return false;
  end if;
  select protected_fee_pct into pct from public.platform_settings where id = 1;
  fee := round(net * coalesce(pct, 0) / 100, 2);
  update public.orders set escrow_status = 'released', released_at = now(), platform_fee = fee,
    status = case when status = 'cancelled' then status else 'completed' end,
    fulfillment_status = case when status = 'cancelled' then fulfillment_status else 'delivered' end,
    completed_at = coalesce(completed_at, case when status = 'cancelled' then null else now() end), updated_at = now()
   where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'release', -net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'release', net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'fee', -fee, 'Comissão do pagamento protegido (' || pct || '%) · ' || public.order_ref(o));
  insert into public.notifications(user_id, type, title, body, data)
  values (o.seller_id, 'system', 'Dinheiro disponível 💰', (net - fee) || ' Kz da encomenda ' || public.order_ref(o) || ' já podem ser levantados.',
    jsonb_build_object('order_id', o.id, 'for', 'wallet'));
  if p_by = 'auto' then
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento entregue ao vendedor', 'Passou o prazo depois da entrega da encomenda ' || public.order_ref(o)
      || ' sem reclamação, por isso o pagamento foi entregue ao vendedor.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.escrow_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; cancelled integer := 0; released integer := 0;
begin
  -- 1) encomendas protegidas não pagas a tempo (e sem comprovativo à espera) são canceladas e o stock volta
  for o in select * from public.orders x where x.escrow_status = 'awaiting_payment' and x.status <> 'cancelled' and x.pay_by < now()
      and not exists (select 1 from public.order_payments p where p.order_id = x.id and p.status = 'pending' and p.provider = 'manual')
      for update skip locked loop
    update public.products p set stock = p.stock + oi.quantity, updated_at = now() from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
    update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id;
    insert into public.notifications(user_id, type, title, body, data) values
      (o.buyer_id, 'order', 'Encomenda cancelada', 'A encomenda ' || public.order_ref(o) || ' foi cancelada porque o pagamento não chegou a tempo.',
        jsonb_build_object('order_id', o.id, 'for', 'purchase')),
      (o.seller_id, 'order', 'Encomenda cancelada', 'O cliente não pagou a encomenda ' || public.order_ref(o) || ' a tempo. O stock voltou à Loja.',
        jsonb_build_object('order_id', o.id, 'for', 'sale'));
    cancelled := cancelled + 1;
  end loop;
  -- 2) referências ProxyPay vencidas
  update public.order_payments set status = 'expired' where provider = 'proxypay' and status = 'pending' and expires_at < now();
  -- 3) dinheiro libertado depois do prazo, sem reclamação
  for o in select * from public.orders x where x.escrow_status = 'held' and x.status <> 'cancelled' and x.release_at <= now()
      and not exists (select 1 from public.order_disputes d where d.order_id = x.id and d.status <> 'resolved') loop
    if public.escrow_release(o.id, 'auto') then released := released + 1; end if;
  end loop;
  return jsonb_build_object('cancelled', cancelled, 'released', released);
end $function$
;

CREATE OR REPLACE FUNCTION public.event_fee_due(p_event uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce((select sum(fee_amount) from public.event_orders where event_id = p_event and status = 'confirmed'), 0)
    - coalesce((select sum(amount) from public.event_platform_payments where event_id = p_event and kind = 'fee' and status = 'confirmed'), 0))
$function$
;

CREATE OR REPLACE FUNCTION public.event_ticket_availability(p_event_id uuid)
 RETURNS TABLE(id uuid, name text, price numeric, quantity integer, left_count integer, max_per_order integer, active boolean, sort integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.price, t.quantity, greatest(t.quantity - public.ticket_type_taken(t.id), 0), t.max_per_order, t.active, t.sort
  from public.event_ticket_types t join public.events e on e.id = t.event_id
  where t.event_id = p_event_id and (e.status <> 'draft' or e.organizer_id = auth.uid())
  order by t.sort, t.price
$function$
;

CREATE OR REPLACE FUNCTION public.events_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with x as (update public.event_orders set status = 'expired', decided_at = now() where status = 'reserved' and pay_by < now() returning 1)
  select count(*) into n from x;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.finalize_due_auctions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x record; n integer := 0; st record;
begin
  update public.auctions set status = 'live', updated_at = now() where status = 'scheduled' and starts_at <= now() and ends_at > now();
  for x in select * from public.auctions where status = 'live' and ending_notified_at is null and ends_at > now() and ends_at <= now() + interval '1 hour' for update skip locked loop
    select * into st from public.auction_standing(x.id);
    insert into public.notifications(user_id, type, title, body, data)
    select m.bidder_id, 'auction',
      case when m.bidder_id = st.leader then 'Leilão a terminar: está a ganhar' else 'Leilão a terminar: foi ultrapassado' end,
      '«' || x.title || '» termina em menos de 1 hora. Preço atual: ' || st.price || ' Kz.' || case when m.bidder_id = st.leader then '' else ' Suba o seu máximo para ganhar.' end,
      jsonb_build_object('auction_id', x.id, 'listing_id', x.classified_listing_id)
    from public.auction_max_bids m where m.auction_id = x.id and m.retracted_at is null;
    insert into public.notifications(user_id, type, title, body, data)
    select distinct si.user_id, 'auction', 'Leilão guardado a terminar', '«' || x.title || '» termina em menos de 1 hora. Preço atual: ' || st.price || ' Kz.',
      jsonb_build_object('auction_id', x.id, 'listing_id', x.classified_listing_id)
    from public.saved_items si
    where si.classified_listing_id = x.classified_listing_id and si.user_id <> x.seller_id
      and not exists (select 1 from public.auction_max_bids m where m.auction_id = x.id and m.bidder_id = si.user_id and m.retracted_at is null);
    update public.auctions set ending_notified_at = now() where id = x.id;
  end loop;
  for x in select id from public.auctions where status in ('live','scheduled') and ends_at <= now() loop
    perform public.close_auction(x.id); n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.find_by_ref(p_ref text)
 RETURNS TABLE(kind text, id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m text[]; k text; n bigint;
begin
  m := regexp_match(upper(trim(coalesce(p_ref, ''))), '^([APE])[\s-]*0*([0-9]{1,12})$');
  if m is null then return; end if;
  k := m[1]; n := m[2]::bigint;
  if k = 'A' then
    return query select 'listing'::text, l.id from public.classified_listings l
      where l.ref_no = n and (l.status in ('published', 'sold', 'rented', 'closed') or l.owner_id = auth.uid() or public.has_admin_role());
  elsif k = 'P' then
    return query select 'product'::text, p.id from public.products p where p.ref_no = n and (p.active or p.seller_id = auth.uid() or public.has_admin_role());
  else
    return query select 'order'::text, o.id from public.orders o where o.ref_no = n and (auth.uid() in (o.buyer_id, o.seller_id) or public.has_admin_role());
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.flush_daily_saved_search_notifications(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare s record; inserted_count integer:=0; cycle_key text; begin for s in select q.saved_search_id,q.user_id,count(*) total,min(q.created_at) first_match,max(q.created_at) last_match,array_agg(q.listing_id order by q.created_at) listing_ids from public.saved_search_notification_queue q join public.classified_saved_searches ss on ss.id=q.saved_search_id where q.delivered_at is null and (q.processing_at is null or q.processing_at<p_now-interval '15 minutes') and ss.active=true and coalesce(ss.notification_frequency,'immediate')='daily' and (ss.notification_quiet_until is null or ss.notification_quiet_until<=p_now) group by q.saved_search_id,q.user_id loop update public.saved_search_notification_queue set processing_at=p_now where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and (processing_at is null or processing_at<p_now-interval '15 minutes'); if found then cycle_key:=to_char((p_now at time zone 'Africa/Luanda')::date,'YYYY-MM-DD'); insert into public.notifications(user_id,type,title,body,data) values(s.user_id,'saved_search',case when s.total=1 then 'Novo anúncio encontrado' else s.total||' novos anúncios encontrados' end,case when s.total=1 then 'Um novo anúncio corresponde à sua pesquisa guardada.' else s.total||' novos anúncios correspondem à sua pesquisa guardada.' end,jsonb_build_object('saved_search_id',s.saved_search_id,'listing_ids',to_jsonb(s.listing_ids),'count',s.total,'digest',true,'digest_cycle',cycle_key,'first_match_at',s.first_match,'last_match_at',s.last_match)) on conflict do nothing; if found then update public.saved_search_notification_queue set delivered_at=p_now,processing_at=null where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and processing_at=p_now; update public.classified_saved_searches set last_notified_at=p_now,updated_at=p_now where id=s.saved_search_id; inserted_count:=inserted_count+1; else update public.saved_search_notification_queue set processing_at=null where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and processing_at=p_now; end if; end if; end loop; return inserted_count; end $function$
;

CREATE OR REPLACE FUNCTION public.fold_text(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$function$
;

CREATE OR REPLACE FUNCTION public.follow_info(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'followers', case p_kind
      when 'seller' then (select count(*) from public.followed_sellers where seller_id = p_id)
      when 'provider' then (select count(*) from public.followed_providers where provider_id = p_id)
      when 'business' then (select count(*) from public.followed_businesses where business_id = p_id) else 0 end,
    'following', auth.uid() is not null and case p_kind
      when 'seller' then exists (select 1 from public.followed_sellers where seller_id = p_id and user_id = auth.uid())
      when 'provider' then exists (select 1 from public.followed_providers where provider_id = p_id and user_id = auth.uid())
      when 'business' then exists (select 1 from public.followed_businesses where business_id = p_id and user_id = auth.uid()) else false end);
$function$
;

CREATE OR REPLACE FUNCTION public.follow_notify_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and new.purpose <> 'wanted' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('follow_listing', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.follow_notify_portfolio()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enqueue_job('follow_portfolio', new.id);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.follow_notify_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.active and not (tg_op = 'UPDATE' and old.active) then perform public.enqueue_job('follow_product', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.format_angola_iban(p_digits text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select 'AO06 ' || trim(regexp_replace(p_digits, '(.{4})', '\1 ', 'g'));
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_fee_due(p_station uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected'), 0)
    - coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0))
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_feed(p_product text DEFAULT NULL::text, p_municipality uuid DEFAULT NULL::uuid, p_station uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(product_id uuid, station_id uuid, station_ref bigint, station_name text, kind text, municipality_name text, address text, directions text, geo_lat numeric, geo_lng numeric, phone text, whatsapp text, opening_hours text, product text, price numeric, status text, queue text, note text, status_at timestamp with time zone, updated_at timestamp with time zone, reservable_left numeric, max_per_order numeric, accepts_reservations boolean, accepts_prepay boolean, hold_minutes integer, yes_2h bigint, no_2h bigint, last_report_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, s.id, s.ref_no, s.name, s.kind, m.name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone, s.whatsapp, s.opening_hours,
    p.product, p.price, p.status, p.queue, p.note, p.status_at, p.updated_at,
    greatest(0, p.reservable_qty - public.fuel_reserved_qty(p.id)), p.max_per_order,
    s.accepts_reservations and not public.fuel_fees_overdue(s.id), s.accepts_prepay and exists (select 1 from public.fuel_station_pay x where x.station_id = s.id and (x.iban is not null or x.express is not null)),
    s.hold_minutes,
    (select count(*) from public.fuel_reports r where r.product_id = p.id and r.has and r.created_at > now() - interval '2 hours'),
    (select count(*) from public.fuel_reports r where r.product_id = p.id and not r.has and r.created_at > now() - interval '2 hours'),
    (select max(r.created_at) from public.fuel_reports r where r.product_id = p.id)
  from public.fuel_products p join public.fuel_stations s on s.id = p.station_id left join public.municipalities m on m.id = s.municipality_id
  where s.status = 'approved'
    and (p_product is null or p.product = p_product)
    and (p_municipality is null or s.municipality_id = p_municipality)
    and (p_station is null or s.id = p_station)
  order by case p.status when 'available' then 0 when 'low' then 1 when 'unknown' then 2 else 3 end, p.status_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_fees_overdue(p_station uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected' and collected_at < now() - interval '7 days'), 0)
    > coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_order_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid(); t text := lower(regexp_replace(coalesce(p_token, ''), '[^A-Fa-f0-9]', '', 'g')); role_ text;
begin
  if char_length(t) <> 32 then return jsonb_build_object('result', 'invalid'); end if;
  select * into o from public.fuel_orders where qr_token = t;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into s from public.fuel_stations where id = o.station_id;
  role_ := case when me is not null and s.owner_id = me then 'station' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and o.buyer_id = me then 'buyer' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'ref_no', o.ref_no, 'status', o.status, 'product', o.product, 'quantity', o.quantity,
      'station_id', s.id, 'station_name', s.name);
  end if;
  return jsonb_build_object('result', 'ok', 'role', role_, 'id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'method', o.method, 'product', o.product,
    'quantity', o.quantity, 'unit_price', o.unit_price, 'subtotal', o.subtotal, 'fee_pct', o.fee_pct, 'fee_amount', o.fee_amount, 'total', o.total,
    'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'plate', o.plate, 'code', o.code, 'hold_until', o.hold_until, 'pay_method', o.pay_method,
    'reference', o.reference, 'proof_path', o.proof_path, 'note', o.note, 'created_at', o.created_at, 'collected_at', o.collected_at,
    'station_id', s.id, 'station_name', s.name);
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_product_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  if tg_op = 'UPDATE' and (new.status, new.price, new.queue, new.reservable_qty, new.note, new.max_per_order) is not distinct from (old.status, old.price, old.queue, old.reservable_qty, old.note, old.max_per_order) then return new; end if;
  new.updated_at := now();
  if new.status in ('available', 'low') and (tg_op = 'INSERT' or old.status in ('out', 'unknown')) then perform public.enqueue_job('fuel_alert', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_product_label(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p when 'gasolina' then 'Gasolina' when 'gasoleo' then 'Gasóleo' when 'petroleo' then 'Petróleo'
    when 'gas_12kg' then 'Gás (botija 12 kg)' when 'gas_6kg' then 'Gás (botija 6 kg)' else p end
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_reserved_qty(p_product uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(quantity), 0) from public.fuel_orders where product_id = p_product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_station_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.notify_staff('Novo posto para aprovar', 'S-' || new.ref_no || ' · ' || left(new.name, 80), jsonb_build_object('fuel_station_id', new.id));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_station_panel(p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; st public.platform_settings;
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or (s.owner_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_STATION_OWNER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'fee_pct', st.fuel_fee_pct,
    'collected_today', (select coalesce(sum(total), 0) from public.fuel_orders where station_id = s.id and status = 'collected' and collected_at > date_trunc('day', now() at time zone 'Africa/Luanda') at time zone 'Africa/Luanda'),
    'collected_total', (select coalesce(sum(total), 0) from public.fuel_orders where station_id = s.id and status = 'collected'),
    'fee_total', (select coalesce(sum(fee_amount), 0) from public.fuel_orders where station_id = s.id and status = 'collected'),
    'fee_due', public.fuel_fee_due(s.id),
    'fee_overdue', public.fuel_fees_overdue(s.id),
    'fee_pending', exists (select 1 from public.fuel_platform_payments where station_id = s.id and status = 'pending'),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.subtotal, o.fee_amount, o.total, o.buyer_name, o.buyer_phone, o.plate, o.code, o.qr_token,
        o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.collected_at
      from public.fuel_orders o where o.station_id = s.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.fuel_platform_payments p where p.station_id = s.id order by p.created_at desc limit 50) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with x as (update public.fuel_orders set status = 'expired', updated_at = now()
    where (status = 'reserved' and hold_until < now()) or (status = 'awaiting_payment' and pay_by < now()) returning 1)
  select count(*) into n from x;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_notification_preferences()
 RETURNS notification_preferences
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.notification_preferences where user_id = auth.uid();
  if not found then
    r.user_id := auth.uid(); r.enabled := true; r.saved_search := true; r.messages := true; r.rentals := true;
    r.auctions := true; r.marketplace := true; r.reviews := true; r.system := true; r.updated_at := now();
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_promo_post(p_id uuid)
 RETURNS TABLE(id uuid, ref_no bigint, owner_id uuid, subject_kind text, subject_id uuid, subject_name text, subject_picture text, kind text, title text, description text, video_url text, external_url text, cover_url text, live_starts_at timestamp with time zone, live_ends_at timestamp with time zone, live_state text, featured boolean, featured_until timestamp with time zone, views integer, status text, hidden_reason text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.ref_no, x.owner_id, x.subject_kind, x.subject_id, s.name, s.picture, x.kind, x.title, x.description, x.video_url, x.external_url, x.cover_url,
    x.live_starts_at, x.live_ends_at,
    case when x.kind <> 'live' then null when now() < x.live_starts_at then 'upcoming' when now() <= x.live_ends_at then 'live' else 'ended' end,
    coalesce(x.featured_until > now(), false), x.featured_until, x.views, x.status, x.hidden_reason, x.created_at
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where x.id = p_id and ((x.status = 'published' and s.visible) or x.owner_id = auth.uid() or public.has_admin_role());
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, province text, municipality text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.full_name, p.avatar_url, p.province, p.municipality, p.created_at
  from public.profiles p where p.id = p_user_id and p.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.guard_classified_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare admin boolean := public.has_admin_role(); allow_feature boolean := coalesce(current_setting('huambo.allow_feature', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not admin then
      if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
      new.status := 'draft'; new.featured := false; new.featured_until := null;
    end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  if not admin then
    if not allow_feature then new.featured := old.featured; new.featured_until := old.featured_until; end if;
    if new.status = 'published' and old.status is distinct from 'published'
       and coalesce(current_setting('huambo.allow_publish', true), '') <> 'on' then
      raise exception 'USE_PUBLISH_FUNCTION';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_commission_overdue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' and not public.has_admin_role()
     and exists (select 1 from public.listing_commissions c where c.owner_id = new.owner_id and c.status = 'due' and c.due_at < now()) then
    raise exception 'COMMISSION_OVERDUE';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare admin boolean := public.has_admin_role();
begin
  if tg_op = 'UPDATE' then
    new.organizer_id := old.organizer_id; new.ref_no := old.ref_no;
    if old.status = 'cancelled' and new.status <> 'cancelled' and not admin then raise exception 'EVENT_CANCELLED'; end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' and coalesce(current_setting('huambo.allow_cancel', true), '') <> 'on' then raise exception 'USE_CANCEL_FUNCTION'; end if;
  end if;
  if not admin and coalesce(current_setting('huambo.allow_feature', true), '') <> 'on' then
    new.featured_until := case when tg_op = 'UPDATE' then old.featured_until else null end;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.current_user_active() and not admin then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if new.starts_at < now() then raise exception 'EVENT_IN_PAST'; end if;
    if tg_op = 'UPDATE' and not exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active) then raise exception 'EVENT_NEEDS_TICKETS'; end if;
    if tg_op = 'INSERT' then raise exception 'EVENT_NEEDS_TICKETS'; end if;
    if exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active and t.price > 0)
       and not exists (select 1 from public.event_payment_info pi where pi.event_id = new.id and (nullif(trim(pi.iban), '') is not null or nullif(trim(pi.express), '') is not null)) then
      raise exception 'EVENT_NEEDS_PAYMENT_INFO';
    end if;
    if exists (select 1 from public.events e where e.organizer_id = new.organizer_id and e.id <> new.id
               and coalesce(e.ends_at, e.starts_at) < now() - interval '7 days' and public.event_fee_due(e.id) > 0) then raise exception 'EVENT_FEES_OVERDUE'; end if;
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_fuel_station()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if not public.has_admin_role() then new.status := 'pending'; new.admin_note := null; end if;
    if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if (select count(*) from public.fuel_stations where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_STATIONS'; end if;
  else
    if new.owner_id <> old.owner_id then raise exception 'NOT_ALLOWED'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note) and not public.has_admin_role()
       and coalesce(current_setting('app.fuel_pay_changed', true), '') <> '1' then raise exception 'ADMIN_ONLY'; end if;
    if not public.has_admin_role() and old.status = 'approved' and (new.name is distinct from old.name or new.kind is distinct from old.kind
        or new.municipality_id is distinct from old.municipality_id or new.address is distinct from old.address or new.directions is distinct from old.directions
        or new.geo_lat is distinct from old.geo_lat or new.geo_lng is distinct from old.geo_lng) then
      new.status := 'pending'; new.admin_note := 'Dados do posto mudaram: à espera de nova aprovação.';
      perform public.notify_staff('⛽ Posto mudou dados', 'S-' || new.ref_no || ' · ' || new.name || ' precisa de nova aprovação.', jsonb_build_object('fuel_station_id', new.id));
    end if;
    new.updated_at := now();
  end if;
  return new;
end $function$
;
