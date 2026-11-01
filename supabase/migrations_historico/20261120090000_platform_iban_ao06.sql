-- IBAN das contas da plataforma com o prefixo AO06 (pedido do dono). Os dois IBAN foram verificados (controlo certo).
update public.platform_settings set
  iban = 'AO06 0066 0000 0734 1533 1013 7',
  payment_accounts = '[{"bank": "Banco Yetu", "iban": "AO06 0066 0000 0734 1533 1013 7", "holder": "Aires Cláudio Festo"}, {"bank": "Standard Bank", "iban": "AO06 0060 0101 0100 4635 1176 8", "holder": "Aires Cláudio Festo"}]'::jsonb,
  updated_at = now()
where id = 1;
