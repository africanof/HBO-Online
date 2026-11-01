# Esquema completo do Huambo Online (cópia do projeto antigo)

Fotografia fiel da base de dados do projeto antigo (`foqsmszwbhiyqqtuwypg`), tirada a 1/11/2026 e verificada parte a parte por impressão digital (md5).
Serve para **criar um projeto Supabase novo do zero**. O histórico de migrações antigo não chegava para isso: faltava, por exemplo, a criação da tabela `profiles`.

## Conteúdo

| Ficheiro | O que tem |
| --- | --- |
| `../migrations/20261101000000_esquema_inicial.sql` | Extensões, 15 sequências, 92 tabelas, 402 funções, 738 restrições, 260 índices, 1 vista, 63 gatilhos, RLS nas 92 tabelas, 187 regras de acesso, permissões e tempo real |
| `05_dados_e_tarefas.sql` | 7 armazenamentos de ficheiros, dados de referência (províncias, municípios, categorias, praças, definições) e 13 tarefas agendadas |
| `inventario-projeto-antigo.json` | Impressões digitais de cada objeto, para comparar com o projeto novo |

Não inclui utilizadores, anúncios, encomendas nem ficheiros guardados: só a estrutura e os dados de referência.

## Como aplicar num projeto novo

1. Aplicar a migração `supabase/migrations/20261101000000_esquema_inicial.sql`.
2. No projeto novo, criar no cofre (Vault) o segredo `huambo_cron_anon_key` com a chave pública do projeto.
3. Trocar `__PROJECT_URL__` em `05_dados_e_tarefas.sql` pelo endereço do projeto novo (`https://<ref>.supabase.co`) e aplicá-lo.
4. Publicar as Edge Functions de `supabase/functions` (`photo-search` e `payment-webhook` com `verify_jwt = false`; as outras com `true`) e configurar os segredos `OPENAI_API_KEY`, `PROXYPAY_API_KEY` e `PROXYPAY_ENV`.
5. Comparar o inventário do projeto novo com `inventario-projeto-antigo.json`.
