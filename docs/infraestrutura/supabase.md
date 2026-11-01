# Supabase — Huambo Online

## Projeto oficial
- Project ref: `foqsmszwbhiyqqtuwypg`
- Projeto: Huambo na mão 1.0
- Região: eu-west-1
- PostgreSQL: 17

Este é o projeto Supabase destinado ao Huambo Online.

## Isolamento
Não utilizar nem alterar os projetos Supabase do Angola Localiza ou Huambo Localiza.

## Estado inicial
O projeto foi identificado como INACTIVE em 2026-10-02. Nenhuma alteração de schema deve ser executada enquanto estiver inativo.

## Segurança
Chaves secretas/service-role nunca devem entrar no repositório nem no cliente Web/Mobile. Apenas a publishable key poderá ser usada no frontend, através de variáveis de ambiente.

## Regra de alterações
Schema, RLS, Auth, Storage, Edge Functions e demais recursos só serão alterados neste projeto específico e serão verificados após cada mudança.
