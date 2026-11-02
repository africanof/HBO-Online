# Supabase

Backend do Huambo Online: base de dados PostgreSQL, autenticação, armazenamento, tempo real e Edge Functions.

Projeto, isolamento e regras: [`docs/infraestrutura/supabase.md`](../docs/infraestrutura/supabase.md).

## Estrutura

```text
supabase/
├── migrations/   # Alterações à base de dados, aplicadas por ordem do nome (começa no esquema inicial completo)
├── baseline/     # Dados de referência, tarefas agendadas e inventário do esquema (ver README)
├── migrations_historico/  # Migrações antigas, só para consulta
└── functions/    # Edge Functions (Deno)
    ├── _shared/            # Código partilhado entre funções (cliente ProxyPay)
    ├── payment-reference/  # Cria referências de pagamento ProxyPay (Multicaixa)
    ├── payment-webhook/    # Recebe a confirmação de pagamento da ProxyPay
    ├── photo-search/       # Pesquisa por fotografia (palavras-chave a partir da imagem)
    └── cleanup-videos/     # Limpeza diária de vídeos que já não são precisos
```

## Migrações

- Nome: `AAAAMMDDHHMMSS_descricao_curta_vN.sql`.
- Uma migração aplicada **nunca** é editada — corrige-se com uma nova.
- Tabelas novas: RLS ativo e políticas explícitas para cada operação.
- Funções `security definer`: `search_path` fixo e `execute` só para os papéis necessários.

## Segredos das Edge Functions

Configurados no painel do Supabase (nunca no repositório):

| Segredo | Usado por |
| --- | --- |
| `PROXYPAY_API_KEY`, `PROXYPAY_ENV` | `payment-reference`, `payment-webhook` |
| `OPENAI_API_KEY` | `photo-search`, `generate-ad`, `ai-assist`, `ai-triage` e `ai-proof-check` |
