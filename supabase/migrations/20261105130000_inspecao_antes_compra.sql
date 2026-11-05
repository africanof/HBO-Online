-- Inspeção também ANTES de comprar («prebuy»): qualquer interessado pode pedir e pagar a inspeção de um anúncio
-- ou produto que não é seu. A equipa combina com o vendedor, inspeciona e envia o relatório ao interessado (e ao
-- vendedor). O selo público do anúncio continua a vir só das inspeções pedidas pelo vendedor.
-- Depois de comprar, o modo «buyer» (ligado à encomenda protegida) continua igual.
-- A taxa nunca é devolvida (também se o vendedor vender a outra pessoa antes da inspeção).

alter table public.item_inspections drop constraint if exists item_inspections_mode_check;
alter table public.item_inspections add constraint item_inspections_mode_check check (mode in ('seller', 'buyer', 'prebuy'));

create or replace function public.request_item_inspection(p_listing_id uuid default null, p_product_id uuid default null, p_order_id uuid default null, p_note text default null)
returns public.item_inspections language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.classified_listings; p public.products; o public.orders; i public.item_inspections;
  v_mode text; v_cat text; v_seller uuid; v_title text; v_listing uuid := p_listing_id; v_product uuid := p_product_id;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_order_id is not null then
    select * into o from public.orders where id = p_order_id;
    if not found or o.buyer_id <> me then raise exception 'ORDER_NOT_FOUND'; end if;
    if not o.protected or o.status in ('completed', 'cancelled') or o.fulfillment_status = 'delivered' or o.escrow_status not in ('awaiting_payment', 'held') then raise exception 'INSPECTION_NOT_ALLOWED'; end if;
    v_mode := 'buyer'; v_seller := o.seller_id; v_title := o.title; v_listing := o.listing_id;
    if v_listing is null then select oi.product_id into v_product from public.order_items oi where oi.order_id = o.id limit 1; end if;
  end if;
  if v_listing is not null then
    select * into l from public.classified_listings where id = v_listing;
    if not found then raise exception 'LISTING_NOT_FOUND'; end if;
    if v_mode is null then
      -- Sem encomenda: o dono pede para o seu anúncio; outra pessoa pede antes de comprar.
      v_mode := case when l.owner_id = me then 'seller' else 'prebuy' end;
      if v_mode = 'prebuy' and (l.status <> 'published' or l.purpose = 'wanted') then raise exception 'INSPECTION_NOT_ALLOWED'; end if;
    end if;
    v_cat := public.item_inspection_category(l.listing_type); v_seller := coalesce(v_seller, l.owner_id); v_title := coalesce(v_title, l.title);
  elsif v_product is not null then
    select * into p from public.products where id = v_product;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if v_mode is null then v_mode := case when p.seller_id = me then 'seller' else 'prebuy' end; end if;
    v_cat := 'item'; v_seller := coalesce(v_seller, p.seller_id); v_title := coalesce(v_title, p.name);
  else
    raise exception 'INVALID_INPUT';
  end if;
  if exists (select 1 from public.item_inspections x where x.requester_id = me and x.status not in ('approved', 'failed', 'handed_over', 'cancelled')
             and coalesce(x.order_id::text, '') = coalesce(p_order_id::text, '') and coalesce(x.listing_id, x.product_id) = coalesce(v_listing, v_product)) then
    raise exception 'INSPECTION_EXISTS'; end if;
  insert into public.item_inspections(mode, category, listing_id, product_id, order_id, requester_id, seller_id, title, fee, pay_by, note)
  values (v_mode, v_cat, v_listing, case when v_listing is null then v_product end, p_order_id, me, v_seller, left(v_title, 200),
    public.item_inspection_fee(v_cat), now() + interval '48 hours', nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into i;
  if v_mode = 'buyer' then
    perform public._item_inspection_notify(i, v_seller, '🔍 O comprador pediu inspeção', 'A equipa do Huambo Online vai inspecionar o artigo antes da entrega. Aguarde o contacto da equipa.');
  end if;
  return i;
end $$;

-- Taxa confirmada: no modo «antes de comprar», o vendedor é avisado de que a equipa o vai contactar.
do $$ declare d text := pg_get_functiondef('public.decide_item_inspection_payment(uuid,boolean,text)'::regprocedure);
  o text := $o$    perform public._item_inspection_notify(i, i.requester_id, '🔍 Taxa de inspeção paga', 'A equipa vai contactar para marcar a inspeção.');$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND decide_item_inspection_payment'; end if;
  if strpos(d, 'prebuy') = 0 then
    execute replace(d, o, o || $n$
    if i.mode = 'prebuy' then
      perform public._item_inspection_notify(i, i.seller_id, '🔍 Um interessado pediu a inspeção do seu artigo',
        'A equipa do Huambo Online vai contactá-lo para marcar a inspeção. A taxa foi paga pelo interessado.');
    end if;$n$);
  end if;
end $$;

-- Resultado: avisos próprios do modo «antes de comprar» e validade do relatório.
do $$ declare d text := pg_get_functiondef('public.admin_item_inspection_step(uuid,text,timestamptz,text,jsonb,text,text[],text)'::regprocedure);
  a text := $o$when p_step = 'approve' and i.mode = 'seller' then now()$o$;
  b text := $o$      case when i.mode = 'buyer' and p_step = 'fail' then$o$;
  c text := $o$  elsif p_step = 'handover' then$o$;
begin
  if strpos(d, a) = 0 or strpos(d, b) = 0 or strpos(d, c) = 0 then raise exception 'PATCH_NOT_FOUND admin_item_inspection_step'; end if;
  if strpos(d, 'prebuy') = 0 then
    d := replace(d, a, $n$when p_step = 'approve' and i.mode in ('seller', 'prebuy') then now()$n$);
    d := replace(d, b, $n$      case when i.mode = 'prebuy' and p_step = 'approve' then 'O artigo foi aprovado. Veja o relatório em «As minhas inspeções» e, se quiser, compre com pagamento protegido.'
           when i.mode = 'prebuy' then 'O artigo não foi aprovado. Veja o relatório em «As minhas inspeções» antes de decidir.'
           when i.mode = 'buyer' and p_step = 'fail' then$n$);
    d := replace(d, c, $n$    if i.mode = 'prebuy' then
      perform public._item_inspection_notify(i, i.seller_id, case when p_step = 'approve' then '✅ Inspeção aprovada' else '❌ Inspeção não aprovada' end,
        'Inspeção pedida por um interessado. O relatório está em «As minhas inspeções».');
    end if;
$n$ || c);
    execute d;
  end if;
end $$;

-- Painel da equipa: as inspeções «antes de comprar» aprovadas também ficam concluídas.
do $$ declare d text := pg_get_functiondef('public.admin_list_item_inspections(boolean)'::regprocedure);
  o text := $o$not (i.status = 'approved' and i.mode = 'seller')$o$;
begin
  if strpos(d, o) = 0 then raise exception 'PATCH_NOT_FOUND admin_list_item_inspections'; end if;
  execute replace(d, o, $n$not (i.status = 'approved' and i.mode in ('seller', 'prebuy'))$n$);
end $$;
