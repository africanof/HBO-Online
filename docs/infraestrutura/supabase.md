# Supabase — Huambo Online

## Projeto oficial
- Project ref: `pewymvkowbdizdiyjmao`
- Endereço: `https://pewymvkowbdizdiyjmao.supabase.co`
- Organização: conta `africanofesto@gmail.com`
- Região: eu-central-1 (Frankfurt)
- PostgreSQL: 17
- Criado a 1/11/2026 a partir do esquema completo do projeto anterior (`foqsmszwbhiyqqtuwypg`, sem acesso), com a mesma estrutura, verificada objeto a objeto. Ver `supabase/baseline/README.md`.

## Isolamento
Não utilizar nem alterar os projetos Supabase do Angola Localiza ou Huambo Localiza.

## Segurança
Chaves secretas/service-role nunca devem entrar no repositório nem no cliente Web/Mobile. Apenas a chave pública (publishable) é usada no Site e na APP, através de variáveis de ambiente.

## Segredos das Edge Functions (painel do Supabase → Edge Functions → Secrets)
| Segredo | Para quê |
| --- | --- |
| `OPENAI_API_KEY` | Pesquisa por fotografia e «Melhorar com IA» (gpt-4o-mini) |
| `PROXYPAY_API_KEY`, `PROXYPAY_ENV` | Pagamento protegido com referências Multicaixa |

## Regra de alterações
Schema, RLS, Auth, Storage, Edge Functions e demais recursos só são alterados neste projeto, com uma nova migração em `supabase/migrations/`, e verificados depois de cada mudança.

## Mudanças depois da cópia (novembro de 2026)

| Migração | O que faz |
| --- | --- |
| `20261101120000_moderadores.sql` | Moderadores fazem tudo no painel, menos alterar contas de administrador ou dar o papel de administrador. |
| `20261101130000_contactos_privados.sql` | Telefone, WhatsApp e localização de anúncios e profissionais ficam em tabelas privadas (só o próprio e a equipa). |
| `20261101140000_mensagens_mediadas.sql` | Mensagens mediadas: os utilizadores só veem as suas mensagens e as da «Equipa Huambo Online»; a equipa reencaminha (painel → Mensagens). |
| `20261101150000_contactos_privados_negocios.sql` | Telefone e WhatsApp de empresas (hotéis, restaurantes…) e postos ficam privados; a localização continua pública. |
| `20261101160000_permissoes_sequencias.sql` | Correção: repõe a permissão de uso dos contadores (`ref_no`), perdida na cópia. |
| `20261101170000_pedidos_mediados.sql` | Encomendas, reservas, bilhetes, pedidos de serviço, propostas e alugueres ficam à espera da equipa (painel → Pedidos) até serem reencaminhados; avisos ao vendedor retidos; telefone e morada do comprador em privado. |
| `20261101171000_pedidos_mediados_correcao.sql` | Correção: os contactos privados dos pedidos só são lidos pela equipa. |
| `20261101180000_estado_pedidos_cliente.sql` | O cliente vê os seus pedidos «à espera da equipa» ou recusados (com o motivo) em «Encomendas» e «A sua conta». |
| `20261101181000_pedidos_aprovados_cliente.sql` | O cliente também vê os pedidos aprovados (reencaminhados) e recebe um aviso quando a equipa aprova. |
| `20261101190000_categorias_emprego.sql` | Categorias de anúncios «Emprego e recrutamento», «Estágios remunerados» e «Estágios não remunerados». |
| `20261101200000_documentos_emprego.sql` | Documentos Word/PDF no chat, só em conversas sobre vagas de emprego e estágios; corrige o reencaminhamento de anexos pela equipa. |
| `20261101210000_mais_categorias.sql` | 59 categorias novas: anúncios, Loja, profissionais, serviços e empresas. |
| `20261101220000_arrendamento_imoveis_gratis.sql` | Arrendamento e aluguer de imóveis sem comissão (`listing_commission_free`). |
| `20261101230000_recomendacoes.sql` | Recomendações «Para si»: histórico `user_interests` (vistas, pesquisas, guardados; 90 dias) e `recommended_listings`. |
| `20261101240000_ia_anuncios.sql` | «✨ Melhorar com IA»: limite de 15 usos por dia (`ai_writer_usage`, `consume_ai_writer`) para a Edge Function `generate-ad` (OpenAI gpt-4o-mini; segredo `OPENAI_API_KEY`). |
| `20261101250000_ia_assistente.sql` | Assistente de IA: limites `ai_usage`/`consume_ai`, triagem automática `listing_ai_reviews` (cron a cada 10 min → `ai-triage`), traduções `listing_translations`, ajuda no preço `price_hint`. |
| `20261101251000_ia_traducoes_funcoes.sql` | Traduções pela Edge Function só através de funções (`ai_listing_text`, `ai_cached_translation`, `ai_save_translation`): o `service_role` deste projeto não lê nem escreve tabelas diretamente. |
| `20261101260000_whatsapp_equipa.sql` | WhatsApp da equipa: `platform_settings.team_whatsapp` (público) e `admin_set_team_whatsapp`; `my_team_request_states` passa a devolver `link` (página do anúncio/pedido). |
| `20261102100000_comprovativos_ia.sql` | Comprovativos lidos pela IA (`ai-proof-check`, cron a cada 5 min): `payment_proof_checks`, conferência fixa (valor, conta de destino, data, talão repetido) e `admin_list_proof_checks`. A equipa confirma sempre. |
| `20261102101000_comprovativos_ia_correcao.sql` | Correção dos avisos de texto em `ai_save_proof_check`. |
| `20261102110000_comprovativos_automaticos.sql` | Impressão digital (SHA-256) dos comprovativos (mesmo ficheiro = repetido) e aprovação automática só de taxas pequenas da plataforma (`platform_settings.proof_auto_max_kz`, 1 000 Kz; 0 desliga; máx. 3 por pessoa/24 h; nunca encomendas), em nome da conta interna «Verificação automática (IA)». |
| `20261102111000_comprovativos_correcao_registos.sql` | Correção: verificação sem n.º de operação lido. |
| `20261102120000_provincias_desbloquear.sql` | Províncias: a equipa liga/desliga províncias (exige municípios; nunca a última) e gere os municípios (`admin_list_provinces`, `admin_set_province_active`, `admin_add_municipalities`, `admin_rename_municipality`, `admin_delete_municipality` só se ninguém o usar); registo no `admin_audit_log`. |
| `20261102130000_municipios_angola.sql` | Municípios das 20 outras províncias (DPA 2024: 326 no total, com o Huambo); províncias continuam bloqueadas até a equipa as desbloquear. |
| `20261102140000_rastreio_encomendas.sql` | Rastreio de encomendas: histórico `order_tracking_events` (gatilhos em encomendas e entregas), posição do estafeta (`courier_share_location`, só durante a entrega, apagada no fim) e `order_tracking(id)` para comprador, vendedor e equipa. |
| `20261102150000_frances.sql` | Francês: traduções de anúncios também em `fr`. |
| `20261102160000_fundo_branco.sql` | Fundo branco nas fotos: limite de 40 fotos por pessoa e por dia (`consume_ai('bg_remove')`), usado pela função Python `/api/fundo` do Site. |
| `20261102170000_novidades_interesses.sql` | «✨ Novidades para si»: avisos diários/semanais (ou desligados) com anúncios novos pelos interesses de cada pessoa; candidatos por regras (`interest_digest_queue`), escolha final pela Edge Function `ai-interests` (GPT, com regras de reserva), `send_interest_digest`, `interest_notified`; cron às 18:30–20:30 de Angola. |
| `20261102180000_email_resumo.sql` | Resumo diário por email (Resend, Edge Function `email-digest`): `notifications.emailed_at`, preferência `email_digest` (cancelar com `unsubscribe_email`), contador `email_send_log` que nunca passa do plano grátis (90/dia, 2 700/mês); cron às 20:00 e 20:20 de Angola. Precisa dos segredos `RESEND_API_KEY` e `EMAIL_FROM`. |
| `20261104090000_exemplos.sql` | Exemplos (2 por secção) em 3 contas de sistema sem login (`exemplo*@huambo.invalid`): nomes «… (exemplo)», imagens com faixa «EXEMPLO» em `/exemplos`, fora do Google e do mapa do site. Criados sem avisos aos utilizadores. Apagar tudo: `select public.remove_examples();`. |
| `20261104100000_exemplos_bloqueio.sql` | Os exemplos não podem ser comprados, reservados nem contactados: gatilho `aa_block_example` no carrinho, encomendas, bilhetes, gás, reservas, propostas, alugueres, pedidos de serviço e conversas (erro `EXAMPLE_ITEM`). |
| `20261104110000_pagamento_protegido_anuncios.sql` | Pagamento protegido obrigatório nos anúncios: encomendas com origem (`source`: anúncio, proposta, leilão, aluguer), `protected_buy_listing()`, encomenda automática em proposta aceite/leilão ganho/aluguer aceite, anúncio «Reservado» (`listing_reserved`), pago → vendido/arrendado sem comissão separada; arrendamento de imóveis sem comissão (`fee_free`). |
| `20261104120000_servicos_orcamento.sql` + `20261104121000_auto_forward_ordem.sql` | Serviços com orçamento e pagamento protegido obrigatório: `send_service_quote`, `accept_service_quote` (encomenda `source = service`), «Serviço concluído» só depois de pago (conta como entregue), confirmar o serviço liberta o dinheiro; `my_service_requests_v3`. Encomendas de serviço/proposta/aluguer/leilão ficam logo visíveis ao vendedor (`zz_orders_auto_forward`). |
| `20261104130000_pagamento_protegido_eventos_postos_reservas.sql` + `20261104131000_eventos_sem_iban_organizador.sql` | Bilhetes, combustível/gás e reservas pagos ao Huambo Online (`platform_collects()`): sem pagar no posto/local/em dinheiro; a equipa confirma (`decide_*` só admin); valor guardado no saldo (`escrow` held/released/refunded) e libertado ao ler o código ou 1 dia depois do evento, já sem comissão; cancelado depois de pago → aviso à equipa para devolver; comissões fora das faturas; contas mostradas ao cliente = as do Huambo Online; `admin_list_event_orders`. |
| `20261104140000_exemplos_fotos_ia.sql` | Exemplos com fotografias geradas por IA (função `gen-examples`, gpt-image-2, uma vez) em `classified-media/exemplos/`. |
| `20261104150000_ia_comprovativos_gas_reservas.sql` + `20261104151000_ia_comprovativos_tipos.sql` | A IA lê e confirma também os comprovativos de combustível/gás (`fuel_order`) e de reservas (`venue_order`) até `proof_auto_max_kz`; encomendas continuam sempre pela equipa. |
| `20261104160000_importacao.sql` | Importação (compras no exterior): `import_catalog` (o que costumamos importar) e `import_requests` (pedido → orçamento da equipa → aceitar → pagamento ao Huambo Online com comprovativo → comprado → a caminho → chegou → entregue, ou devolvido). Funções `import_*`, `decide_import_payment`, `admin_list_import_requests`; os comprovativos (`import_order`) aparecem no painel e a IA lê-os, mas só a equipa confirma. |
| `20261104170000_importacao_taxa_pesquisa.sql` | Taxa de pesquisa e orçamento paga antes de a equipa pesquisar (`platform_settings.import_research_fee_kz`, 2000 Kz; 0 = sem taxa), descontada no total se o cliente aceitar (`import_research_deduct`). Estados `research_payment` → `research_submitted` → `requested`; `import_submit_research_payment`, `decide_import_research`, `admin_set_import_research`. O comprovativo (`import_research`) pode ser confirmado sozinho pela IA. |
| `20261104180000_mensagens_diretas_filtro_contactos.sql` | Mensagens de texto diretas entre utilizadores; `chat_contact_reason` bloqueia antes de entregar telefones (também por extenso ou partidos), e-mails, ligações, WhatsApp/Telegram, @, IBAN/NIB e contas (`messages.blocked_reason`; só quem escreveu a vê). A IA (`ai-chat-guard`, cron a cada minuto, `ai_chat_queue`/`ai_chat_verdict`) revê as suspeitas. À 3.ª tentativa em 7 dias: `chat_suspensions` 24 h (`CHAT_SUSPENDED`). Anexos continuam pela equipa. |
| `20261104190000_nome_publico.sql` | Nome público: `profiles.public_name` (alcunha, `set_public_name` recusa contactos, @, redes sociais e apelidos; a IA revê em `ai-chat-guard`) ou «Nome I.» (`shown_name`). Fotografia só de profissionais/empresas (`shown_avatar`). Todas as funções não-admin que mostram pessoas a outros usam estas duas; a equipa continua a ver o nome completo. `provider_directory` deixa de devolver telefone/WhatsApp. |
| `20261104191000_nome_real_equipa.sql` | `viewer_name`/`viewer_avatar`: administradores e moderadores veem sempre o nome real e a fotografia nas funções de leitura; os avisos continuam com o nome público. |
| `20261104200000_nome_profissionais.sql` | Nome da página de profissional com as regras do nome público (`public_name_problem`; trigger `guard_provider_display_name`); os existentes com apelido passam ao nome curto. Fotografias mantêm-se; empresas não mudam. `shown_name` ignora o que está entre parênteses. |
| `20261104201000_nome_profissional_privado.sql` | O nome escrito pelo profissional fica em `provider_private_contacts.display_name` (próprio e equipa); o público vê a versão protegida. `provider_directory` dá à equipa o nome original, o telefone e o WhatsApp. |
| `20261105100000_inspecao_artigos.sql` | Inspeção de artigos pela equipa (`item_inspections`): modo vendedor (selo «🔍 Inspecionado» 90 dias, `item_inspection_badge`) e modo comprador ligado à encomenda protegida (`guard_order_inspection` impede «entregue» antes do fim; não aprovada → `order_disputes` em «awaiting_refund»; aprovada → `handover` marca entregue). Taxas em `platform_settings.item_inspection_fee_*` (2 000 / 10 000 / 20 000 Kz). Comprovativo `item_inspection` no painel (IA pode confirmar). |
| `20261105120000_suporte.sql` | Suporte: a IA responde primeiro (página `/suporte`); «👤 Falar com um agente» chama `open_support_conversation` e abre uma conversa `context_type = support` com a equipa (resumo da conversa com o assistente). Nessas conversas o filtro de contactos e a suspensão não se aplicam, tudo fica pendente para a equipa e `notify_staff` avisa (no máximo 1 aviso / 10 min). |

Todas já estão aplicadas no projeto `pewymvkowbdizdiyjmao`.
