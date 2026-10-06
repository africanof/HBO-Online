# Huambo Online

Plataforma digital de comércio, serviços e negócios do Huambo.

## Produto

O Huambo Online reúne num único ecossistema:

- Diretório de empresas e negócios
- Freelancers e prestadores de serviços
- Marketplace multi-vendedor
- Classificados
- Comércio B2B
- Reservas e agendamentos
- Chat
- Pagamentos
- Logística e entregas
- Avaliações e confiança
- Administração e moderação

## Arquitetura

Este repositório é um monorepo com:

- `apps/web` — site Huambo Online
- `apps/mobile` — APP Android/iOS com Expo
- `packages/ui` — componentes partilhados
- `packages/types` — contratos e tipos partilhados
- `packages/core` — regras de domínio partilhadas
- `packages/config` — configuração comum
- `docs` — especificações do produto e arquitetura

## Princípios

1. Site e APP são duas interfaces do mesmo produto.
2. Regras de negócio não devem ser duplicadas entre plataformas.
3. Segurança e permissões devem ser aplicadas no backend.
4. Marketplace, serviços, empresas e logística devem compartilhar entidades e identidade.
5. Nenhuma funcionalidade crítica deve depender exclusivamente da interface.
6. O projeto deve crescer por módulos sem criar dependências circulares.

## Desenvolvimento

Requisitos: Node.js LTS e pnpm.

```bash
pnpm install
pnpm dev:web
pnpm dev:mobile
```

## Roadmap

A implementação seguirá o documento `docs/PRODUCT-ARCHITECTURE.md`, começando pela fundação, identidade, descoberta, perfis comerciais, serviços, marketplace e depois pagamentos/logística.
