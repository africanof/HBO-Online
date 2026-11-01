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
| `ANTHROPIC_API_KEY` | Pesquisa por fotografia |
| `PROXYPAY_API_KEY`, `PROXYPAY_ENV` | Pagamento protegido com referências Multicaixa |

## Regra de alterações
Schema, RLS, Auth, Storage, Edge Functions e demais recursos só são alterados neste projeto, com uma nova migração em `supabase/migrations/`, e verificados depois de cada mudança.
