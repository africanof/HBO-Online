# Como contribuir

Obrigado por ajudar a construir o Huambo Online. Este guia resume como trabalhamos.

## Fluxo de trabalho

1. Crie um ramo a partir de `main` com um nome descritivo:
   - `feat/<assunto>` — nova funcionalidade
   - `fix/<assunto>` — correção
   - `docs/<assunto>` — documentação
   - `chore/<assunto>` — manutenção, dependências, configuração
2. Faça commits pequenos e com mensagens claras (ver abaixo).
3. Antes de enviar, corra localmente:

   ```bash
   pnpm check
   ```

4. Abra um pull request para `main` e preencha o modelo. A CI tem de ficar verde.

## Mensagens de commit

Escreva em português, no imperativo ou descritivo, a começar pela área afetada:

```text
Site: código QR dos perfis
APP: serviços traduzidos
Core: regras de entrega por vendedor
Supabase: tabela de reservas
```

## Onde colocar o código

| Tipo de código | Local |
| --- | --- |
| Regras de negócio, validações, cálculos | `packages/core/src` (com teste `*.test.ts` ao lado) |
| Tipos e contratos partilhados | `packages/types/src` |
| Acesso ao Supabase partilhado | `packages/supabase/src` |
| Páginas e componentes do Site | `apps/web/app`, `apps/web/components` |
| Ecrãs e componentes da APP | `apps/mobile/app`, `apps/mobile/components` |
| Traduções de cada app | `apps/*/lib/i18n` |
| Alterações à base de dados | `supabase/migrations` |
| Lógica no servidor com segredos | `supabase/functions` |

Se uma regra é usada pelo Site **e** pela APP, tem de estar em `packages/core`.

## Base de dados (Supabase)

- Cada alteração é uma nova migração em `supabase/migrations/` — nunca edite uma migração já aplicada.
- Nome do ficheiro: `AAAAMMDDHHMMSS_descricao_curta_vN.sql` (ex.: `20261129100000_seller_delivery_v1.sql`).
- Todas as tabelas novas têm RLS ativo e políticas explícitas.
- Funções `security definer` fixam o `search_path` e só dão `execute` a quem precisa.

Mais detalhes em [`supabase/README.md`](supabase/README.md).

## Traduções

Todo o texto visível tem de existir em português, inglês e mandarim. Os textos partilhados estão em `packages/core/src/i18n*.ts`; os de cada app em `apps/*/lib/i18n`.

## Segurança

- Nunca commite chaves secretas, tokens ou ficheiros `.env`.
- O Site e a APP só usam a chave **pública** do Supabase.
- Segredos de produção ficam nos *GitHub Secrets* ou nos segredos das Edge Functions.

Vulnerabilidades: ver [`SECURITY.md`](SECURITY.md).
