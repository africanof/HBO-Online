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
| `NEXT_PUBLIC_SITE_URL` | Endereço público do Site (Google, partilhas, mapa do site) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Opcional — email de contacto nas páginas de ajuda |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Opcional — cache partilhada (só servidor) |
| `ANDROID_SHA256_FINGERPRINTS` | Opcional — impressões digitais extra da APP (só servidor) |

## Publicação

O Site é alojado na **Vercel** (`vercel.json` nesta pasta). Cada envio para `main` publica uma nova versão.
Passo a passo: [`docs/guias/publicar-site-vercel.md`](../../docs/guias/publicar-site-vercel.md).

As regras de negócio vêm de `@huambo-online/core`; aqui fica só a interface.
