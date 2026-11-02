-- Municípios das 20 províncias que ainda não os tinham, segundo a nova Divisão Político-Administrativa
-- (Lei n.º 14/24, de 5 de Setembro; em vigor desde 1/1/2025: 21 províncias, 326 municípios).
-- Fontes: mapas «Nova Divisão Político-Administrativa da República de Angola» (fonte: Diário da República,
-- Série 171) para 16 províncias; Cuanza Sul completado com o Decreto Presidencial n.º 270/24 (Quissongo,
-- Quenha); Benguela, Huíla, Bié e Namibe pelo texto da lei e notícias oficiais (ANGOP, governos provinciais).
-- Cada lista confere com o n.º oficial de municípios da província. As províncias continuam BLOQUEADAS:
-- a equipa desbloqueia-as no painel (🗺️ Províncias) quando quiser. Nomes repetidos são ignorados.
do $$
declare r record; n text; pid uuid;
begin
  for r in select * from (values
    ('Malanje', array['Quihuhu', 'Massango', 'Marimba', 'Cuale', 'Mbanji ya Ngola', 'Kunda dya Baze', 'Cateco Cangola', 'Cahombo', 'Milando', 'Cambo Suinginge', 'Kiwaba Nzoji', 'Quela', 'Ngola Luiji', 'Calandula', 'Cacuso', 'Pungu a Ndongo', 'Malanje', 'Quêssua', 'Muquixe', 'Caculama', 'Xandel', 'Cangandala', 'Cambundi Catembo', 'Quitapa', 'Capunda', 'Luquembo', 'Quirima']),
    ('Lunda Norte', array['Chitato', 'Lóvua', 'Mussungue', 'Dundo', 'Canzar', 'Luremo', 'Caungula', 'Camaxilo', 'Cuilo', 'Cafunfo', 'Cassanje Calucala', 'Cuango', 'Lubalo', 'Xá Cassau', 'Lucapa', 'Cambulo', 'Xá Muteba', 'Capenda Camulemba', 'Luangue']),
    ('Lunda Sul', array['Sombo', 'Muangueji', 'Chiluage', 'Saurimo', 'Muriege', 'Cacolo', 'Cassengo', 'Xassengue', 'Cassai-Sul', 'Muconda', 'Alto Chicapa', 'Luma Cassai', 'Dala', 'Cazage']),
    ('Moxico', array['Camanongue', 'Luena', 'Léua', 'Cangumbe', 'Lucusse', 'Lutuai', 'Alto Cuito', 'Lutembo', 'Cangamba', 'Lumbala Nguimbo', 'Ninda', 'Chiúme']),
    ('Moxico Leste', array['Luau', 'Luacano', 'Caianda', 'Nana Candundo', 'Lóvua do Zambeze', 'Cameia', 'Lago Dilolo', 'Cazombo', 'Macondo']),
    ('Cunene', array['Chissuata', 'Cuvelai', 'Mupa', 'Cafima', 'Cahama', 'Curoca', 'Humbe', 'Nehone', 'Cuanhama', 'Ombadja', 'Chiéde', 'Chitado', 'Naulila', 'Namacunde']),
    ('Cubango', array['Cutato', 'Menongue', 'Cuchi', 'Chinguanja', 'Longa', 'Caiundo', 'Nancova', 'Savate', 'Mavengue', 'Cuangar', 'Calai']),
    ('Cuando', array['Cuito Cuanavale', 'Dima', 'Mavinga', 'Rivungo', 'Xipundo', 'Luengue', 'Dirico', 'Mucusso', 'Luiana']),
    ('Cabinda', array['Miconje', 'Belize', 'Buco Zau', 'Massabi', 'Necuto', 'Cacongo', 'Tando Zinze', 'Liambo', 'Cabinda', 'Ngoio']),
    ('Zaire', array['Luvo', 'Cuimba', 'Soyo', 'Nóqui', 'Lufico', 'Mbanza Kongo', 'Quêlo', 'Tomboco', 'Serra de Canda', 'Nzeto', 'Quindeje']),
    ('Uíge', array['Nova Esperança', 'Maquela do Zombo', 'Sacandica', 'Quimbele', 'Alto Zaza', 'Damba', 'Lucunga', 'Milunga', 'Nsosso', 'Bembe', 'Songo', 'Mucaba', 'Sanza Pombo', 'Massau', 'Ambuíla', 'Uíge', 'Bungo', 'Puri', 'Quipedro', 'Negage', 'Cangola', 'Dange Quitexe', 'Vista Alegre']),
    ('Bengo', array['Ambriz', 'Nambuangongo', 'Muxaluando', 'Quicunzo', 'Bula Atumba', 'Dande', 'Piri', 'Quibaxe', 'Panguila', 'Úcua', 'Barra do Dande', 'Pango Aluquém']),
    ('Luanda', array['Ingombota', 'Sambizanga', 'Rangel', 'Maianga', 'Samba', 'Talatona', 'Mussulo', 'Hoji ya Henda', 'Cazenga', 'Cacuaco', 'Kilamba Kiaxi', 'Mulenvos', 'Camama', 'Viana', 'Belas', 'Kilamba']),
    ('Icolo e Bengo', array['Sequele', 'Cabo Ledo', 'Bom Jesus', 'Cabiri', 'Catete', 'Calumbo', 'Quiçama']),
    ('Cuanza Norte', array['Bolongongo', 'Ambaca', 'Tango', 'Terreiro', 'Luinga', 'Quiculungo', 'Aldeia Nova', 'Banga', 'Samba Cajú', 'Ngonguembo', 'Cêrca', 'Golungo Alto', 'Lucala', 'Caculo Cabaça', 'Massangano', 'Cazengo', 'Cambambe']),
    ('Cuanza Sul', array['Quirimbo', 'Munenga', 'Cassongue', 'Calulo', 'Quilenda', 'Mussende', 'Porto Amboim', 'Quibala', 'Lonhe', 'Condé', 'Gabela', 'Boa Entrada', 'Gangula', 'Ebo', 'Sanga', 'Conda', 'Waku Kungo', 'Seles', 'Amboiva', 'Sumbe', 'Pambangala', 'Gungo', 'Quissongo', 'Quenha']),
    ('Benguela', array['Benguela', 'Ganda', 'Lobito', 'Catumbela', 'Bocoio', 'Balombo', 'Cubal', 'Baía Farta', 'Caimbambo', 'Chongorói', 'Chicuma', 'Babera', 'Egipto-Praia', 'Biópio', 'Chila', 'Chindumbo', 'Capupa', 'Yambala', 'Dombe Grande', 'Canhamela', 'Catengue', 'Bolonguera', 'Navegantes']),
    ('Huíla', array['Lubango', 'Humpata', 'Chibia', 'Gambos', 'Quipungo', 'Matala', 'Jamba', 'Cuvango', 'Chipindo', 'Caluquembe', 'Caconda', 'Chicomba', 'Cacula', 'Quilengues', 'Hoque', 'Galangue', 'Palanca', 'Capelongo', 'Capunda Cavilongo', 'Viti Vivali', 'Chicungo', 'Dongo', 'Chituto']),
    ('Bié', array['Cuito', 'Andulo', 'Camacupa', 'Catabola', 'Chinguar', 'Chitembo', 'Cuemba', 'Cunhinga', 'Nharêa', 'Calucinga', 'Lúbia', 'Chipeta', 'Belo Horizonte', 'Mumbué', 'Cambândua', 'Chicala', 'Ringoma', 'Umpulo', 'Luando']),
    ('Namibe', array['Moçâmedes', 'Tômbwa', 'Bibala', 'Virei', 'Camucuio', 'Lucira', 'Iona', 'Sacomar', 'Cacimbas'])
  ) as t(province, names) loop
    select id into pid from public.provinces where name = r.province and country_code = 'AO';
    if pid is null then raise exception 'Província não encontrada: %', r.province; end if;
    foreach n in array r.names loop
      if not exists (select 1 from public.municipalities m where m.province_id = pid and lower(m.name) = lower(n)) then
        insert into public.municipalities(province_id, name) values (pid, n);
      end if;
    end loop;
  end loop;
end $$;
