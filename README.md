# Huambo Online

[![CI](https://github.com/africanof/HBO-Online/actions/workflows/ci.yml/badge.svg)](https://github.com/africanof/HBO-Online/actions/workflows/ci.yml)

Plataforma digital de comércio, serviços e negócios do Huambo — um único produto com **Site** e **APP** (Android/iOS) a partilhar as mesmas regras e a mesma base de dados.

🌐 **Site publicado:** <https://huambo-na-m-o.onrender.com> (Render, a partir do ramo `main`)

## Índice

- [Produto](#produto)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Tecnologias](#tecnologias)
- [Começar](#começar)
- [Comandos](#comandos)
- [Documentação](#documentação)
- [Princípios](#princípios)
- [Contribuir](#contribuir)

## Produto

O Huambo Online reúne num único ecossistema:

| Área | Exemplos |
| --- | --- |
| Descoberta | Classificados, pesquisa (incl. por fotografia), praças, pesquisas guardadas |
| Comércio | Loja multi-vendedor, carrinho, encomendas, leilões e licitações, trocas, propostas |
| Serviços | Profissionais, empresas, reservas, eventos e bilhetes, alugueres, combustível, inspeções |
| Confiança | Verificação de identidade, avaliações, reputação, disputas, devoluções, segurança |
| Pagamentos | Pagamento protegido (ProxyPay / Multicaixa), planos, comissões, saldo |
| Logística | Entregas, estafetas, regras de entrega por vendedor |
| Comunicação | Mensagens (texto, fotos, áudio), notificações, resumos diários |
| Administração | Moderação, mercados, estafetas, agentes de campo |

Línguas suportadas: **português**, **inglês** e **mandarim**.

## Estrutura do repositório

Monorepo [pnpm workspaces](https://pnpm.io/workspaces):

```text
HBO-Online/
├── apps/
│   ├── web/              # Site — Next.js (App Router)
│   └── mobile/           # APP — Expo / React Native (expo-router)
├── packages/
│   ├── core/             # Regras de negócio partilhadas (com testes Vitest)
│   ├── types/            # Contratos e tipos TypeScript partilhados
│   ├── supabase/         # Cliente Supabase e autenticação partilhados
│   ├── ui/               # Design tokens partilhados
│   └── config/           # Configuração comum (nome, país, moeda, locale)
├── supabase/
│   ├── migrations/       # Migrações SQL da base de dados (ordem cronológica)
│   └── functions/        # Edge Functions (Deno): pagamentos, pesquisa por foto, limpezas
├── scripts/              # Testes do site publicado (smoke e acessibilidade)
├── docs/                 # Documentação de produto, infraestrutura e guias
└── .github/              # CI, builds Android, modelos de issues e PRs
```

Cada pasta principal tem o seu próprio `README.md` com detalhes.

**Regra de dependências:** `apps/*` → `packages/core` → `packages/types`. As apps nunca dependem uma da outra e os pacotes nunca dependem das apps.

## Tecnologias

- **Linguagem:** TypeScript
- **Site:** Next.js 16, React 19
- **APP:** Expo 57, React Native, expo-router, EAS Build
- **Backend:** Supabase (PostgreSQL 17, Auth, Storage, Realtime, Edge Functions, pg_cron)
- **Testes:** Vitest (unitários), Playwright + axe (site publicado)
- **CI:** GitHub Actions

## Começar

### Requisitos

- Node.js 22 (ver [`.nvmrc`](.nvmrc))
- pnpm 10 (`corepack enable` instala a versão certa automaticamente)

### Instalação

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com o endereço e a **chave pública** do Supabase. Chaves secretas nunca entram no repositório nem no Site/APP — ver [`SECURITY.md`](SECURITY.md).

### Correr em desenvolvimento

```bash
pnpm dev:web
```

```bash
pnpm dev:mobile
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev:web` | Arranca o Site em modo de desenvolvimento |
| `pnpm dev:mobile` | Arranca a APP (Expo) |
| `pnpm build:web` | Compila o Site para produção |
| `pnpm start:web` | Serve o Site compilado |
| `pnpm typecheck` | Verifica os tipos em todos os pacotes |
| `pnpm test` | Corre os testes unitários |
| `pnpm check` | `typecheck` + `test` (o mesmo que a CI valida) |
| `pnpm smoke:site` | Testa as páginas do site publicado (precisa de Playwright) |
| `pnpm a11y:site` | Testa a acessibilidade do site publicado (precisa de Playwright e axe) |

## Documentação

Toda a documentação está em [`docs/`](docs/README.md):

- **Produto:** [arquitetura de produto](docs/produto/arquitetura-de-produto.md), [fundação](docs/produto/fundacao.md), [fase 1](docs/produto/fase-1-identidade-descoberta.md)
- **Infraestrutura:** [Supabase](docs/infraestrutura/supabase.md), [cache](docs/infraestrutura/cache.md)
- **Guias:** [gerar e publicar a APP Android](docs/guias/lancar-app-android.md)

## Princípios

1. Site e APP são duas interfaces do mesmo produto.
2. Regras de negócio não são duplicadas entre plataformas — vivem em `packages/core`.
3. Segurança e permissões são aplicadas no backend (RLS no Supabase).
4. Marketplace, serviços, empresas e logística partilham entidades e identidade.
5. Nenhuma funcionalidade crítica depende exclusivamente da interface.
6. O projeto cresce por módulos, sem dependências circulares.

## Contribuir

Leia o [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de abrir um pull request. Problemas de segurança seguem o [`SECURITY.md`](SECURITY.md).
