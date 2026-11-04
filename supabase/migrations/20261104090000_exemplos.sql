-- Exemplos para mostrar como o Huambo Online funciona (2 por secção): classificados, trocas, imóveis,
-- viaturas, emprego, «Procura-se», agricultura, loja, profissionais, empresas, reservas, eventos e combustível.
-- Ficam em 3 contas de sistema sem login («… — Exemplos», email @huambo.invalid). Todos os nomes acabam em
-- «(exemplo)», as fotografias têm a faixa «EXEMPLO» e a descrição diz que não estão à venda.
-- O Site não os põe no Google (sem indexação e fora do mapa do site).
-- Corre de novo sem duplicar: apaga primeiro os exemplos antigos destas contas.
-- Para apagar tudo: select public.remove_examples();
-- Os avisos automáticos (seguidores, pesquisas guardadas, «Procura-se») ficam desligados durante a criação,
-- para nenhum utilizador real ser avisado de um exemplo.

create or replace function public.remove_examples() returns void
language plpgsql security definer set search_path to 'public' as $$
declare ids uuid[];
begin
  select array_agg(id) into ids from auth.users where email like 'exemplo%@huambo.invalid';
  if ids is null then return; end if;
  delete from public.fuel_products where station_id in (select id from public.fuel_stations where owner_id = any(ids));
  delete from public.fuel_stations where owner_id = any(ids);
  delete from public.event_ticket_types where event_id in (select id from public.events where organizer_id = any(ids));
  delete from public.events where organizer_id = any(ids);
  delete from public.venues where owner_id = any(ids);
  delete from public.subscriptions where owner_id = any(ids);
  delete from public.products where seller_id = any(ids);
  delete from public.businesses where owner_id = any(ids);
  delete from public.provider_profiles where user_id = any(ids);
  delete from public.classified_listings where owner_id = any(ids);
end $$;
revoke all on function public.remove_examples() from public, anon, authenticated;

-- Gatilhos (avisos, regras de publicação e assinaturas automáticas) desligados só durante a criação.
alter table public.classified_listings disable trigger user;
alter table public.products disable trigger user;
alter table public.provider_profiles disable trigger user;
alter table public.businesses disable trigger user;
alter table public.events disable trigger user;
alter table public.event_ticket_types disable trigger user;
alter table public.fuel_stations disable trigger user;
alter table public.fuel_products disable trigger user;
alter table public.venues disable trigger user;

do $$
declare
  d uuid; p1 uuid; p2 uuid;
  site text := 'https://huamboonline.com/exemplos/';
  nota text := E'\n\nℹ️ Anúncio de exemplo, criado pela equipa do Huambo Online para mostrar como funciona. Não está à venda.';
  prov uuid; m_hb uuid; m_ca uuid; m_ba uuid;
  b_rest uuid; b_hotel uuid; ev uuid; st uuid;
  u record;
  cat jsonb;
begin
  -- 1) Contas de exemplo (sem palavra-passe e bloqueadas: ninguém entra nelas).
  for u in select * from (values
      ('exemplos@huambo.invalid', 'Huambo Online — Exemplos'),
      ('exemplo-eletricista@huambo.invalid', 'Pedro (exemplo)'),
      ('exemplo-explicadora@huambo.invalid', 'Ana (exemplo)')) v(email, nome)
  loop
    if not exists (select 1 from auth.users where email = u.email) then
      insert into auth.users(instance_id, id, aud, role, email, encrypted_password, banned_until, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', u.email, '', 'infinity',
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.nome), now(), now(), '', '', '', '', '', '', '', '');
    end if;
    update public.profiles set full_name = u.nome, province = 'Huambo', municipality = 'Huambo'
      where id = (select id from auth.users where email = u.email);
  end loop;
  select id into d from auth.users where email = 'exemplos@huambo.invalid';
  select id into p1 from auth.users where email = 'exemplo-eletricista@huambo.invalid';
  select id into p2 from auth.users where email = 'exemplo-explicadora@huambo.invalid';

  perform public.remove_examples();

  select id into prov from public.provinces where name = 'Huambo';
  select m.id into m_hb from public.municipalities m where m.province_id = prov and m.name = 'Huambo';
  select m.id into m_ca from public.municipalities m where m.province_id = prov and m.name = 'Caála';
  select m.id into m_ba from public.municipalities m where m.province_id = prov and m.name = 'Bailundo';
  select jsonb_object_agg(slug, id) into cat from public.categories;
  if prov is null or m_hb is null or m_ca is null or m_ba is null then raise exception 'Território do Huambo em falta'; end if;

  -- 2) Classificados, trocas, imóveis, viaturas, emprego, «Procura-se» e agricultura.
  insert into public.classified_listings(owner_id, category_id, listing_type, purpose, title, description, price, sale_mode,
    accepts_trade, trade_wants, budget_min, budget_max, attributes, media, status, conformity_accepted_at)
  select d, (cat->>x.cat)::uuid, x.lt, x.pu, x.title, x.descr || nota, x.price, x.sm, x.tr, x.tw, x.bmin, x.bmax,
    x.attrs || jsonb_build_object('provinceId', prov, 'municipalityId', x.mun),
    case when x.img is null then '[]'::jsonb else jsonb_build_array(site || x.img || '.jpg') end, 'published', now()
  from (values
    ('telemoveis-e-tablets', 'classified', 'sale', 'Samsung Galaxy A54 128 GB (exemplo)',
      'Telemóvel em muito bom estado, com carregador e capa. Bateria dura o dia todo.', 185000::numeric, 'negotiable', true, 'iPhone 11 ou portátil',
      null::numeric, null::numeric, '{"phoneType":"telemovel","brand":"Samsung","model":"Galaxy A54","storage":"128","condition":"como_novo"}'::jsonb, m_hb, 'telemovel'),
    ('eletrodomesticos', 'classified', 'sale', 'Frigorífico LG 300 litros (exemplo)',
      'Frigorífico com congelador, a funcionar bem. Entrega combinada na Caála.', 210000, 'fixed', true, 'Arca congeladora',
      null, null, '{"applianceType":"frigorifico","brand":"LG","condition":"usado"}', m_ca, 'frigorifico'),
    (null, 'real_estate', 'sale', 'Vivenda T3 com quintal na Cidade Alta (exemplo)',
      'Vivenda com 3 quartos, 2 casas de banho, sala ampla, cozinha e quintal murado. Documentação em dia.', 45000000, 'negotiable', false, null,
      null, null, '{"propertyType":"vivenda","area_m2":320,"bedrooms":3,"bathrooms":2}', m_hb, 'vivenda'),
    (null, 'real_estate', 'rent', 'Apartamento T2 mobilado para arrendar (exemplo)',
      'Apartamento mobilado, 2 quartos, água e luz. Renda mensal; pede-se um mês de caução.', 180000, 'fixed', false, null,
      null, null, '{"propertyType":"apartamento","area_m2":85,"bedrooms":2,"bathrooms":1}', m_hb, 'apartamento'),
    (null, 'vehicle', 'sale', 'Toyota Hilux 2.5 D-4D 2018 (exemplo)',
      'Pick-up cabine dupla, gasóleo, caixa manual, revisões feitas. Pronta para o campo e para a cidade.', 18500000, 'negotiable', false, null,
      null, null, '{"vehicleType":"pickup","brand":"Toyota","model":"Hilux","year":2018,"mileage":142000,"fuel":"gasoleo","transmission":"manual"}', m_hb, 'hilux'),
    (null, 'vehicle', 'sale', 'Motorizada Haojue 125 (exemplo)',
      'Motorizada económica, ideal para trabalho e entregas. Documentos em ordem.', 650000, 'fixed', false, null,
      null, null, '{"vehicleType":"mota","brand":"Haojue","model":"125","year":2023,"mileage":8000,"fuel":"gasolina","transmission":"manual"}', m_ba, 'motorizada'),
    ('emprego', 'classified', 'service', 'Operador(a) de caixa para supermercado (exemplo)',
      'Procuramos operador(a) de caixa com 12.ª classe e experiência com dinheiro. Horário por turnos. Envie o CV pelas Mensagens.', 120000, null, false, null,
      null, null, '{}', m_hb, 'vaga'),
    ('estagios-remunerados', 'classified', 'service', 'Estágio remunerado em contabilidade (exemplo)',
      'Estágio de 6 meses para finalistas de contabilidade ou gestão. Subsídio mensal e possibilidade de contrato.', 60000, null, false, null,
      null, null, '{}', m_hb, 'estagio'),
    ('informatica', 'classified', 'wanted', 'Procuro portátil para estudante (exemplo)',
      'Procuro portátil com pelo menos 8 GB de memória, para estudar. Pode ser usado, em bom estado.', null, null, false, null,
      80000, 150000, '{}', m_hb, null),
    (null, 'real_estate', 'wanted', 'Procuro casa T2 para arrendar na Caála (exemplo)',
      'Família procura casa com 2 quartos na Caála, perto da estrada principal.', null, null, false, null,
      60000, 100000, '{}', m_ca, null),
    (null, 'product', 'sale', 'Batata rena em sacos de 50 kg (exemplo)',
      'Batata rena fresca, colhida esta semana. Vendemos a partir de 1 saco; entrega no Huambo e na Caála.', 12000, 'fixed', false, null,
      null, null, '{"agro":true,"agroCategory":"tuberculos","unit":"saco50","quantity":40}', m_ca, 'batata'),
    (null, 'product', 'sale', 'Milho seco da nova colheita (exemplo)',
      'Milho seco e limpo, bom para fuba e para ração. Grandes quantidades com desconto.', 9500, 'negotiable', false, null,
      null, null, '{"agro":true,"agroCategory":"cereais","unit":"saco50","quantity":100}', m_ba, 'milho')
  ) as x(cat, lt, pu, title, descr, price, sm, tr, tw, bmin, bmax, attrs, mun, img);

  -- 3) Loja: 2 produtos (com a assinatura da loja de exemplo).
  insert into public.subscriptions(kind, owner_id, seller_id, trial_ends_at) values ('store', d, d, now() + interval '1 year');
  insert into public.products(seller_id, name, description, category_id, price, stock, active, media, municipality_id, conformity_accepted_at) values
    (d, 'Arroz agulha 25 kg (exemplo)', 'Saco de arroz agulha de 25 kg, grão longo. Entrega em todo o Huambo.' || nota,
      (cat->>'mercearia-e-alimentacao')::uuid, 21500, 40, true, jsonb_build_array(site || 'arroz.jpg'), m_hb, now()),
    (d, 'Panela de pressão 7 litros (exemplo)', 'Panela de pressão em alumínio, 7 litros, com válvula de segurança.' || nota,
      (cat->>'casa-e-cozinha')::uuid, 18900, 15, true, jsonb_build_array(site || 'panela.jpg'), m_hb, now());

  -- 4) Profissionais: 2 perfis (cada um na sua conta).
  insert into public.provider_profiles(user_id, display_name, headline, bio, category_id, municipality_id, avatar_url, active) values
    (p1, 'Pedro, eletricista (exemplo)', 'Instalações elétricas, quadros e reparações',
      'Eletricista com 10 anos de experiência em casas, lojas e armazéns. Orçamento sem compromisso.' || nota,
      (cat->>'eletricistas')::uuid, m_hb, site || 'eletricista.jpg', true),
    (p2, 'Ana, explicações de Matemática (exemplo)', 'Explicações de Matemática e Física (7.ª à 12.ª classe)',
      'Professora licenciada. Explicações em grupo ou individuais, em casa do aluno ou online.' || nota,
      (cat->>'explicadores')::uuid, m_ca, site || 'explicadora.jpg', true);
  insert into public.subscriptions(kind, owner_id, provider_id, trial_ends_at) values
    ('provider', p1, p1, now() + interval '1 year'), ('provider', p2, p2, now() + interval '1 year');

  -- 5) Empresas: restaurante e hotel, ambos com reservas.
  insert into public.businesses(owner_id, name, description, category_id, municipality_id, logo_url, address_text, active)
    values (d, 'Restaurante Mesa Farta (exemplo)', 'Comida angolana caseira: funge, muamba, calulu e grelhados. Almoços e jantares.' || nota,
      (cat->>'restaurantes')::uuid, m_hb, site || 'restaurante.jpg', 'Huambo (exemplo)', true) returning id into b_rest;
  insert into public.businesses(owner_id, name, description, category_id, municipality_id, logo_url, address_text, active)
    values (d, 'Hotel Jardim do Planalto (exemplo)', 'Quartos com pequeno-almoço, Wi-Fi e estacionamento. Sala para eventos.' || nota,
      (cat->>'hoteis')::uuid, m_hb, site || 'hotel.jpg', 'Huambo (exemplo)', true) returning id into b_hotel;
  insert into public.subscriptions(kind, owner_id, business_id, trial_ends_at) values
    ('business', d, b_rest, now() + interval '1 year'), ('business', d, b_hotel, now() + interval '1 year');
  insert into public.venues(business_id, owner_id, kind, subtype, accepts_reservations, accepts_pay_at_place, opening_hours, check_in_time, check_out_time, policies, status) values
    (b_rest, d, 'restaurant', 'restaurante', true, true, 'Todos os dias, 11h–22h', null, null, 'Reservas de mesa até 2 horas antes.', 'approved'),
    (b_hotel, d, 'hotel', 'hotel', true, true, '24 horas', '14:00', '12:00', 'Pequeno-almoço incluído. Cancelamento grátis até 24 horas antes.', 'approved');

  -- 6) Eventos: 2, com entrada gratuita.
  insert into public.events(organizer_id, title, description, category, starts_at, ends_at, venue, municipality_id, cover_url, status)
    values (d, 'Noite de música angolana (exemplo)', 'Música ao vivo com artistas do Huambo. Entrada gratuita com bilhete.' || nota, 'music',
      date_trunc('day', now()) + interval '20 days 19 hours', date_trunc('day', now()) + interval '20 days 23 hours',
      'Salão de festas (exemplo), Huambo', m_hb, site || 'concerto.jpg', 'published') returning id into ev;
  insert into public.event_ticket_types(event_id, name, price, quantity, max_per_order, active) values (ev, 'Entrada geral', 0, 300, 4, true);
  insert into public.events(organizer_id, title, description, category, starts_at, ends_at, venue, municipality_id, cover_url, status)
    values (d, 'Feira dos produtores do Huambo (exemplo)', 'Produtores locais vendem batata, milho, feijão, fruta e hortícolas. Entrada livre.' || nota, 'business',
      date_trunc('day', now()) + interval '35 days 8 hours', date_trunc('day', now()) + interval '35 days 17 hours',
      'Recinto da feira (exemplo), Caála', m_ca, site || 'feira.jpg', 'published') returning id into ev;
  insert into public.event_ticket_types(event_id, name, price, quantity, max_per_order, active) values (ev, 'Entrada livre', 0, 1000, 10, true);

  -- 7) Combustível e gás: 2 postos aprovados.
  insert into public.fuel_stations(owner_id, name, kind, municipality_id, address, opening_hours, accepts_reservations, status)
    values (d, 'Posto Avenida (exemplo)', 'both', m_hb, 'Avenida principal (exemplo), Huambo', 'Todos os dias, 6h–22h', true, 'approved') returning id into st;
  insert into public.fuel_products(station_id, product, price, status, queue, reservable_qty, max_per_order) values
    (st, 'gasolina', 300, 'available', 'short', 500, 40), (st, 'gasoleo', 300, 'low', 'medium', 200, 40), (st, 'gas_12kg', 7500, 'available', 'none', 20, 2);
  insert into public.fuel_stations(owner_id, name, kind, municipality_id, address, opening_hours, accepts_reservations, status)
    values (d, 'Revenda de gás do Bairro (exemplo)', 'gas', m_ca, 'Bairro central (exemplo), Caála', 'Segunda a sábado, 7h–19h', true, 'approved') returning id into st;
  insert into public.fuel_products(station_id, product, price, status, queue, reservable_qty, max_per_order) values
    (st, 'gas_12kg', 7500, 'available', 'short', 30, 2), (st, 'gas_6kg', 4000, 'out', 'none', 0, 2);
end $$;

alter table public.classified_listings enable trigger user;
alter table public.products enable trigger user;
alter table public.provider_profiles enable trigger user;
alter table public.businesses enable trigger user;
alter table public.events enable trigger user;
alter table public.event_ticket_types enable trigger user;
alter table public.fuel_stations enable trigger user;
alter table public.fuel_products enable trigger user;
alter table public.venues enable trigger user;
