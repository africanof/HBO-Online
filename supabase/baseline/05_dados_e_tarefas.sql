-- ============================================================
-- Parte 5: armazenamento, tarefas agendadas e dados de referência
-- ============================================================

-- Armazenamento de ficheiros (buckets)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', t, 2097152, '{image/jpeg,image/png,image/webp,image/heic,image/heif}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('chat-media', 'chat-media', f, 31457280, '{image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/3gpp,audio/webm,audio/ogg,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/mpeg,audio/3gpp,audio/wav}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('classified-media', 'classified-media', t, 5242880, '{image/jpeg,image/png,image/webp,image/heic,image/heif}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('dispute-evidence', 'dispute-evidence', f, 5242880, '{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media-videos', 'media-videos', t, 31457280, '{video/mp4,video/quicktime,video/webm,video/3gpp}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('payment-proofs', 'payment-proofs', f, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('verification-docs', 'verification-docs', f, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Dados de referência (mesmos identificadores do projeto antigo)
insert into public.provinces select * from json_populate_recordset(null::public.provinces, '[{"id":"2b6abaf7-d75f-4676-adeb-f5363f70db15","name":"Bengo","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"3ea545bd-40a8-4a7e-b689-0cce69d1e272","name":"Benguela","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"4d54fd3e-dfc7-44d7-bf21-dbf57d68ed6b","name":"Bié","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"bcd11e97-917a-4697-ab06-92725bf9dcc0","name":"Cabinda","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"c358e218-3cd1-4955-8966-8f107b7d2eab","name":"Cuando","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"96be3ef7-aa32-4b26-9415-f881fb60dfbd","name":"Cuanza Norte","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"6590ec85-c9a9-44be-9edb-3686e3b87bc1","name":"Cuanza Sul","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"8de69c99-de49-408b-b647-6057577c0d7c","name":"Cubango","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"17a0aa22-3a10-4a49-a8f5-aefa159631c6","name":"Cunene","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Huambo","country_code":"AO","created_at":"2026-10-02T00:23:31.623951+00:00","active":true}, 
 {"id":"11d12d80-a27a-48eb-a16f-340c1e00d562","name":"Huíla","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"dad21197-efae-4a25-85f0-d60757593a3c","name":"Icolo e Bengo","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"a0bf6987-38a9-458e-81f2-49677582e38f","name":"Luanda","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"7f8038ea-c4ab-4f16-b7f1-9d246a4f63d8","name":"Lunda Norte","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"4bb15978-ddec-42df-bd5f-16c674a70f38","name":"Lunda Sul","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"08ca09e6-eb42-4090-9637-15623c7f9a72","name":"Malanje","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"d6abf495-bae3-4c12-9cc4-522279933706","name":"Moxico","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"a2a3d7d0-1699-4eda-98f0-61c1921d03ce","name":"Moxico Leste","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"a54f53a1-1e3f-42a6-9863-ce276e0191d5","name":"Namibe","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"7c5d41e5-fae3-4d06-91b3-772d5ff3dfd0","name":"Uíge","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}, 
 {"id":"f1ca3f39-b73e-429b-917c-b506c2030597","name":"Zaire","country_code":"AO","created_at":"2026-10-02T00:25:50.175078+00:00","active":false}]') on conflict do nothing;
insert into public.municipalities select * from json_populate_recordset(null::public.municipalities, '[{"id":"feba0e85-eb52-45a2-b117-2ad38f28aaf0","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Alto Hama","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"5bbfef4a-dd4d-4ccd-b381-c87eee8e785d","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Bailundo","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"fd95617e-6fb4-4390-a713-2ec13b8e609b","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Bimbe","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"bde54ca0-17df-44b3-b06b-c5a9aaead42a","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Caála","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"8874ab4d-cb92-4d13-9f60-44c55f286e56","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Cachiungo","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"68c66a8c-5b53-4934-b3f9-531621951796","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Chicala Choloanga","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"fe888175-5552-4de8-b282-01b57786f0de","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Chilata","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"f3bf5678-3b50-41e2-a241-2b90a5be78a6","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Chinjenje","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"78291089-3521-408a-b791-04db8f88c9bd","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Cuima","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"ea3d60f8-b216-447c-b6cd-709d185d6ceb","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Ecunha","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"e8ad10a7-1adc-4766-a89f-e815177d2c32","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Galanga","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"92bbf929-f9c9-4ee1-979c-19d2600c1232","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Huambo","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"f3489ed8-2076-4a88-adfa-a29686f10d66","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Londuimbali","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"2d945708-12d5-4370-8c27-0c4f3ab93456","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Longonjo","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"80030425-7e4a-41de-ab6b-deef87c0a845","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Mungo","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"6219cfb8-b884-4cd5-b670-58e4a1eea16a","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Sambo","created_at":"2026-10-02T00:23:58.091994+00:00"}, 
 {"id":"cfce285d-08ab-42e1-b863-d99ff1118426","province_id":"59ff6ed7-9406-4905-991d-537277c54b36","name":"Ucuma","created_at":"2026-10-02T00:23:58.091994+00:00"}]') on conflict do nothing;
insert into public.categories select * from json_populate_recordset(null::public.categories, '[{"id":"a9d010c5-1bfb-4f3e-afea-b29fba701311","name":"Advogados","slug":"advogados","type":"professional","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"4faf1e2d-2321-4a70-8f31-921491bdf73a","name":"Alimentação","slug":"alimentacao","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"bb1f35f9-6e0c-42f2-8cbf-9102772b98d5","name":"Armazéns (comércio a grosso)","slug":"armazens","type":"business","active":true,"created_at":"2026-10-16T00:36:20.0099+00:00"}, 
 {"id":"481dac2d-4651-4b43-a924-59cc3b421dbd","name":"Clínicas","slug":"clinicas","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"76f71ed8-2905-4c09-8c31-cad4dea21deb","name":"Construção","slug":"construcao","type":"service","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"63d21abc-6562-480c-8f23-7ed92f09d13e","name":"Contabilistas","slug":"contabilistas","type":"professional","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"ba32bcf1-b26c-44f4-be2e-33aa8eb30e39","name":"Domésticas","slug":"domesticas","type":"professional","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"34e7d471-5c01-417a-a18b-6335bf475bbd","name":"Eletrónica","slug":"eletronica","type":"product","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"e40afb3b-cb96-415c-a83f-96185b930bc1","name":"Escolas","slug":"escolas","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"97dca15a-53df-42ea-9fd2-2c7f32409be5","name":"Fábricas","slug":"fabricas","type":"business","active":true,"created_at":"2026-10-13T22:21:18.267901+00:00"}, 
 {"id":"8b07d2de-7bc7-4813-944b-dc9fb97b3250","name":"Farmácias","slug":"farmacias","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"c68b2b18-f45c-44f9-893d-8540b50249a9","name":"Hotéis e hospedagem","slug":"hoteis","type":"business","active":true,"created_at":"2026-10-16T00:36:20.0099+00:00"}, 
 {"id":"ad3aa8fc-f553-4f8c-9872-474312440420","name":"Limpeza","slug":"limpeza","type":"service","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"88a6e815-7b79-4d09-abd0-09cdc70a4b56","name":"Lojas","slug":"lojas","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"82b100d5-20b2-492e-be68-27c04778f98a","name":"Moda","slug":"moda","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"f056246e-ab8a-4c9d-9a02-173ed2dcacd5","name":"Oficinas","slug":"oficinas","type":"business","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"424adffb-42c5-42a6-b9c2-af4e4fb02b72","name":"Postos de combustível e gás","slug":"combustivel-gas","type":"business","active":true,"created_at":"2026-10-14T06:01:44.302113+00:00"}, 
 {"id":"e82e499b-434a-4872-9948-84dff53132a1","name":"Professores","slug":"professores","type":"professional","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"ada5fe77-9949-4d97-ad60-9f0636e1875f","name":"Restaurantes","slug":"restaurantes","type":"business","active":true,"created_at":"2026-10-16T00:36:20.0099+00:00"}, 
 {"id":"dd49394a-5612-405b-a430-c6d1d4f4476e","name":"Tecnologia","slug":"tecnologia","type":"service","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}, 
 {"id":"c35010aa-e147-4d59-80f1-621a74827e8c","name":"Transporte","slug":"transporte","type":"service","active":true,"created_at":"2026-10-02T05:47:24.321702+00:00"}]') on conflict do nothing;
insert into public.markets select * from json_populate_recordset(null::public.markets, '[{"id": "f005027e-0bfe-4027-92a3-8fac045765b4", "name": "Praça da Alemanha", "status": "active", "photo_url": null, "created_at": "2026-10-11T04:10:12.456699+00:00", "updated_at": "2026-10-11T04:10:12.456699+00:00", "description": null, "address_text": null, "suggested_by": null, "opening_hours": null, "municipality_id": "92bbf929-f9c9-4ee1-979c-19d2600c1232"}, {"id": "d466c270-22f8-4aaf-b0d9-8022ce707fca", "name": "Praça das Cassilhas", "status": "active", "photo_url": null, "created_at": "2026-10-11T04:10:12.456699+00:00", "updated_at": "2026-10-11T04:10:12.456699+00:00", "description": null, "address_text": null, "suggested_by": null, "opening_hours": null, "municipality_id": "92bbf929-f9c9-4ee1-979c-19d2600c1232"}, {"id": "89a81e57-5b29-449b-b82e-3a68d6208d28", "name": "Praça do Ferro", "status": "active", "photo_url": null, "created_at": "2026-10-11T04:10:12.456699+00:00", "updated_at": "2026-10-11T04:10:12.456699+00:00", "description": null, "address_text": null, "suggested_by": null, "opening_hours": null, "municipality_id": "92bbf929-f9c9-4ee1-979c-19d2600c1232"}, {"id": "db6a869c-0f24-45b3-9a2d-f7dc09023403", "name": "Praça do Kapango", "status": "active", "photo_url": null, "created_at": "2026-10-11T04:10:12.456699+00:00", "updated_at": "2026-10-11T04:10:12.456699+00:00", "description": null, "address_text": null, "suggested_by": null, "opening_hours": null, "municipality_id": "92bbf929-f9c9-4ee1-979c-19d2600c1232"}]') on conflict do nothing;
insert into public.platform_settings select * from json_populate_recordset(null::public.platform_settings, '[{"id":1,"provider_monthly_kz":2000,"business_monthly_kz":5000,"trial_days":30,"bank_name":"Banco Yetu","iban":"AO06 0066 0000 0734 1533 1013 7","account_holder":"Aires Cláudio Festo","express_number":"932 806 332","payment_note":"Escreva o seu nome no descritivo","updated_at":"2026-10-20T21:27:58.017+00:00","store_monthly_kz":5000,"listing_commission_pct":5,"commission_due_days":2,"payment_accounts":[{"bank": "Banco Yetu", "iban": "AO06 0066 0000 0734 1533 1013 7", "holder": "Aires Cláudio Festo"}, {"bank": "Standard Bank", "iban": "AO06 0060 0101 0100 4635 1176 8", "holder": "Aires Cláudio Festo"}],"protected_enabled":true,"payment_provider":"manual","proxypay_entity":null,"protected_fee_pct":5,"auto_release_days":3,"payment_window_hours":24,"payout_min_kz":1000,"payout_weekdays":[2,5],"boost_price_kz":100,"boost_days":7,"safe_spots":[{"name": "À porta de uma esquadra da Polícia Nacional", "note": "Há sempre agentes por perto."}, {"name": "Numa agência bancária ou caixa Multicaixa movimentada", "note": "Tem câmaras e seguranças, e dá para levantar dinheiro na hora."}, {"name": "Num supermercado ou centro comercial", "note": "Muita gente, luz e câmaras."}, {"name": "Num posto de combustível", "note": "Aberto até tarde e com câmaras."}],"agent_fee_kz":100,"agent_daily_cap":20,"agent_sale_pct":2,"referral_reward_days":30,"claim_days":7,"event_ticket_fee_pct":5,"event_boost_price_kz":1000,"event_boost_days":7,"event_payment_hours":24,"promo_boost_price_kz":1000,"promo_boost_days":7,"fuel_fee_pct":10,"fuel_pay_minutes":60,"inspection_valid_months":12,"inspection_fee_kz":5000,"inspection_fee_provider_kz":2000,"venue_client_fee_pct":5,"venue_business_fee_pct":5,"venue_pay_minutes":120}]') on conflict do nothing;

-- Tarefas agendadas (pg_cron). __PROJECT_URL__ é trocado pelo endereço do projeto novo.
-- A tarefa de limpeza de vídeos lê a chave pública do cofre: criar antes o segredo «huambo_cron_anon_key».
select cron.schedule('huambo-online-saved-search-daily-digest', '0 7 * * *', 'select public.flush_daily_saved_search_notifications(now());');
select cron.schedule('huambo-online-finalize-auctions', '*/5 * * * *', 'select public.finalize_due_auctions();');
select cron.schedule('huambo-online-cleanup-videos', '10 2 * * *', '
  select net.http_post(
    url := ''__PROJECT_URL__/functions/v1/cleanup-videos'',
    headers := jsonb_build_object(''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer '' || (select decrypted_secret from vault.decrypted_secrets where name = ''huambo_cron_anon_key'' limit 1)),
    body := ''{}''::jsonb
  );
');
select cron.schedule('huambo-online-subscription-reminders', '15 8 * * *', 'select public.subscription_reminders();');
select cron.schedule('huambo-online-escrow-tick', '*/15 * * * *', 'select public.escrow_tick();');
select cron.schedule('huambo-online-boost-expire', '7 * * * *', 'select public.boost_expire();');
select cron.schedule('huambo-online-claims-tick', '23 * * * *', 'select public.listing_claims_tick()');
select cron.schedule('huambo-online-events-tick', '*/15 * * * *', 'select public.events_tick()');
select cron.schedule('huambo-online-promo-tick', '*/5 * * * *', 'select public.promo_tick()');
select cron.schedule('huambo-online-fuel-tick', '*/5 * * * *', 'select public.fuel_tick()');
select cron.schedule('huambo-online-job-queue', '30 seconds', 'select public.process_job_queue(300)');
select cron.schedule('huambo-online-job-queue-cleanup', '41 3 * * *', 'select public.job_queue_cleanup()');
select cron.schedule('huambo-online-venue-tick', '*/5 * * * *', 'select public.venue_tick()');
