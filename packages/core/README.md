# `@huambo-online/core`

Regras de negócio partilhadas pelo Site e pela APP: validações, cálculos (comissões, entregas, planos), pesquisa, leilões, reputação, traduções partilhadas e muito mais.

- Um módulo por domínio em `src/<dominio>.ts`, com o teste ao lado em `src/<dominio>.test.ts`.
- Tudo o que é público é exportado por `src/index.ts`.
- Não depende de React, Next.js nem Expo.

```bash
pnpm --filter @huambo-online/core test
```
