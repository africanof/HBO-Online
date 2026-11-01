# Site — `@huambo-online/web`

Site do Huambo Online em **Next.js** (App Router) e React.

## Estrutura

```text
apps/web/
├── app/          # Rotas (uma pasta por página), API pública e metadados (sitemap, robots, manifest)
├── components/   # Componentes de interface reutilizáveis
├── lib/          # Supabase, traduções (i18n), SEO, cache e utilitários
└── public/       # Ficheiros estáticos
```

## Comandos

```bash
pnpm dev:web
```

```bash
pnpm build:web
```

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave **pública** do Supabase |

As regras de negócio vêm de `@huambo-online/core`; aqui fica só a interface.
