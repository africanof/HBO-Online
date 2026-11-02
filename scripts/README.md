# Scripts

Testes **só de leitura** ao site publicado (não criam contas nem dados).

| Script | O que faz |
| --- | --- |
| `smoke-site.mjs` | Abre as páginas principais e confirma que respondem com o conteúdo esperado |
| `a11y-site.mjs` | Verifica acessibilidade (WCAG 2 A/AA) com o axe |

## Uso

```bash
npm install --no-save playwright@1 axe-core@4
```

```bash
SITE_URL=https://huamboonline.com pnpm smoke:site
```

```bash
SITE_URL=https://huamboonline.com pnpm a11y:site
```

Também podem ser corridos no GitHub: **Actions → «Teste do site publicado» → Run workflow**.
