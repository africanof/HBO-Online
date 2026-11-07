-- «💳 Pedir pagamento» dentro da conversa: quem vende propõe o preço combinado e quem compra paga com pagamento protegido.
-- O pedido é uma proposta já aceite (só para aquela pessoa, válida 48 horas). Não reserva o artigo:
-- a encomenda só nasce quando quem compra carrega em «Pagar» (com entrega e telefone), pelo caminho normal.

alter table public.listing_offers add column if not exists via_chat boolean not null default false;
alter table public.messages add column if not exists payment_offer_id uuid references public.listing_offers(id) on delete set null;
create index if not exists messages_payment_offer_idx on public.messages (payment_offer_id) where payment_offer_id is not null;

-- Só a função abaixo pode criar mensagens com cartão de pagamento.
create or replace function public.aa_guard_payment_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.payment_offer_id is distinct from old.payment_offer_id then raise exception 'NOT_ALLOWED'; end if;
    return new;
  end if;
  if new.payment_offer_id is not null and coalesce(current_setting('huambo.chat_payment', true), '') <> 'on' then raise exception 'NOT_ALLOWED'; end if;
  return new;
end $$;
revoke all on function public.aa_guard_payment_message() from public, anon, authenticated;
drop trigger if exists aa_guard_payment_message on public.messages;
create trigger aa_guard_payment_message before insert or update on public.messages for each row execute function public.aa_guard_payment_message();

create or replace function public.chat_payment_request(p_conversation_id uuid, p_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.conversations; l public.classified_listings; v_buyer uuid; v_offer uuid; v_open uuid; v_open_buyer uuid; v_msg uuid; n int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not coalesce((select protected_enabled from public.platform_settings where id = 1), false) then raise exception 'PROTECTED_DISABLED'; end if;
  select * into c from public.conversations where id = p_conversation_id;
  if not found or c.classified_listing_id is null then raise exception 'NO_LISTING'; end if;
  if not exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = auth.uid()) then raise exception 'NOT_ALLOWED'; end if;
  select * into l from public.classified_listings where id = c.classified_listing_id for update;
  if not found or l.status <> 'published' then raise exception 'LISTING_NOT_AVAILABLE'; end if;
  if l.owner_id <> auth.uid() then raise exception 'SELLER_ONLY'; end if;
  if l.purpose not in ('sale', 'rent', 'lease') then raise exception 'NOT_FOR_SALE'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'PRICE_REQUIRED'; end if;
  if coalesce(l.price, 0) > 0 and p_amount > l.price then raise exception 'ABOVE_LISTING_PRICE'; end if;
  select count(*) into n from public.conversation_participants where conversation_id = c.id and user_id <> l.owner_id;
  if n <> 1 then raise exception 'NO_BUYER'; end if;
  select user_id into v_buyer from public.conversation_participants where conversation_id = c.id and user_id <> l.owner_id;
  select o.id, o.buyer_id into v_open, v_open_buyer from public.orders o where o.id = public.listing_open_order(l.id);
  if v_open is not null then raise exception 'LISTING_RESERVED'; end if;
  if (select count(*) from public.listing_offers where listing_id = l.id and buyer_id = v_buyer and via_chat and created_at > now() - interval '1 day') >= 5 then raise exception 'TOO_MANY_REQUESTS'; end if;
  -- Os pedidos anteriores desta conversa deixam de valer; uma proposta pendente da pessoa fica substituída.
  update public.listing_offers set status = 'withdrawn', responded_at = now()
    where listing_id = l.id and buyer_id = v_buyer and via_chat and status = 'accepted';
  update public.listing_offers set status = 'declined', seller_note = 'Substituída pelo pedido de pagamento na conversa.', responded_at = now()
    where listing_id = l.id and buyer_id = v_buyer and status = 'pending';
  -- Inserida já aceite: não cria a encomenda agora (o artigo não fica reservado).
  insert into public.listing_offers(listing_id, buyer_id, amount, message, status, responded_at, via_chat)
  values (l.id, v_buyer, p_amount, 'Pedido de pagamento na conversa', 'accepted', now(), true) returning id into v_offer;
  perform set_config('huambo.chat_payment', 'on', true);
  insert into public.messages(conversation_id, sender_id, body, payment_offer_id, handled_at)
  values (c.id, auth.uid(), '💳 Pedido de pagamento: «' || left(l.title, 80) || '» — ' || public.money_label(p_amount, l.currency) || ' com pagamento protegido.', v_offer, now())
  returning id into v_msg;
  perform set_config('huambo.chat_payment', '', true);
  return v_offer;
end $$;
revoke all on function public.chat_payment_request(uuid, numeric) from public, anon;
grant execute on function public.chat_payment_request(uuid, numeric) to authenticated;

-- Estado dos cartões de pagamento de uma conversa (para os dois lados).
create or replace function public.chat_payment_cards(p_conversation_id uuid)
returns table(offer_id uuid, listing_id uuid, title text, photo text, purpose text, currency text, amount numeric, listing_price numeric,
  offer_status text, expires_at timestamptz, is_buyer boolean, listing_status text, order_id uuid, order_status text, escrow_status text)
language sql stable security definer set search_path = public as $$
  select o.id, l.id, l.title, (case when jsonb_typeof(l.media) = 'array' then l.media ->> 0 end), l.purpose, coalesce(l.currency, 'AOA'), o.amount, l.price,
         case when o.status = 'accepted' and o.created_at < now() - interval '48 hours'
                   and not exists (select 1 from public.orders x where x.source = 'offer' and x.source_ref = o.id) then 'expired' else o.status end,
         o.created_at + interval '48 hours', o.buyer_id = auth.uid(), l.status,
         ord.id, ord.status, ord.escrow_status
  from public.messages m
  join public.listing_offers o on o.id = m.payment_offer_id
  join public.classified_listings l on l.id = o.listing_id
  left join lateral (select x.id, x.status, x.escrow_status from public.orders x where x.source = 'offer' and x.source_ref = o.id order by x.created_at desc limit 1) ord on true
  where m.conversation_id = p_conversation_id
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid())
    and (o.buyer_id = auth.uid() or l.owner_id = auth.uid())
$$;
revoke all on function public.chat_payment_cards(uuid) from public, anon;
grant execute on function public.chat_payment_cards(uuid) to authenticated;

-- A compra protegida não usa um pedido da conversa com mais de 48 horas.
do $m$
declare src text;
begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'protected_buy_listing';
  if position('via_chat' in src) = 0 then
    src := replace(src, $a$and status = 'accepted' and amount is not null$a$,
                        $a$and status = 'accepted' and amount is not null and (not via_chat or created_at > now() - interval '48 hours')$a$);
    if position('via_chat' in src) = 0 then raise exception 'protected_buy_listing: texto esperado não encontrado'; end if;
    execute src;
  end if;
end $m$;

-- Limpeza: pedidos da conversa por usar há mais de 48 horas ficam retirados.
do $$ begin
  perform cron.unschedule('chat_payment_expire') where exists (select 1 from cron.job where jobname = 'chat_payment_expire');
  perform cron.schedule('chat_payment_expire', '23 * * * *', $c$update public.listing_offers o set status = 'withdrawn' where o.via_chat and o.status = 'accepted' and o.created_at < now() - interval '48 hours' and not exists (select 1 from public.orders x where x.source = 'offer' and x.source_ref = o.id);$c$);
end $$;

-- O filtro de contactos deixa passar o cartão de pagamento criado acima (o preço tem algarismos).
do $m$
declare src text;
begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'zz_messages_contact_filter';
  if position('huambo.chat_payment' in src) = 0 then
    src := replace(src, $a$  if new.attachment_kind is not null then return new; end if; -- anexos$a$,
      $a$  if new.payment_offer_id is not null and coalesce(current_setting('huambo.chat_payment', true), '') = 'on' then new.handled_at := now(); return new; end if;
  if new.attachment_kind is not null then return new; end if; -- anexos$a$);
    if position('huambo.chat_payment' in src) = 0 then raise exception 'zz_messages_contact_filter: texto esperado não encontrado'; end if;
    execute src;
  end if;
end $m$;
