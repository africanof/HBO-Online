# Huambo Online — Documento-Mestre de Produto e Arquitetura

## 1. Visão

Criar uma infraestrutura digital para a economia local do Huambo, permitindo descobrir, comparar, contratar, comprar, vender, reservar, pagar e entregar produtos e serviços.

## 2. Superfícies

### Web
- Descoberta pública e SEO
- Diretório de empresas
- Marketplace
- Classificados
- Serviços profissionais
- B2B
- Contas e painéis
- Administração

### Mobile
- Descoberta local
- Pesquisa
- Perfis
- Marketplace
- Contratação de serviços
- Chat
- Pedidos
- Notificações
- Localização
- Entregas

## 3. Domínios principais

### Identidade
- users
- profiles
- roles
- organizations
- organization_members

### Local
- countries
- provinces
- municipalities
- neighborhoods
- streets
- locations
- service_areas

### Negócios
- businesses
- business_categories
- business_hours
- business_locations
- business_services
- business_media

### Profissionais
- providers
- provider_categories
- provider_services
- portfolios
- availability
- service_requests
- proposals
- bookings

### Marketplace
- stores
- products
- product_categories
- product_variants
- inventory
- carts
- orders
- order_items
- seller_payouts

### Classificados
- listings
- listing_categories
- listing_media

### B2B
- buyer_requests
- supplier_quotes
- quote_items

### Comunicação
- conversations
- conversation_members
- messages
- attachments

### Confiança
- verifications
- reviews
- review_replies
- reports
- disputes

### Pagamentos
- payment_methods
- payments
- refunds
- commissions
- transactions

### Logística
- delivery_orders
- couriers
- courier_profiles
- delivery_assignments
- delivery_events
- delivery_tracking

### Administração
- admin_roles
- moderation_cases
- audit_logs
- platform_settings

## 4. Modelo de identidade

Uma conta pode ter mais de um papel.

Exemplo:

> Uma pessoa pode ser cliente, freelancer e proprietária de uma loja simultaneamente.

Por isso não devemos criar contas separadas para cada tipo de atividade.

## 5. Perfis

### Pessoa
Identidade básica, contactos, preferências e reputação.

### Profissional
Pessoa + competências + serviços + preço + disponibilidade + portfólio + área de atendimento + verificações.

### Empresa
Organização + localização + categoria + serviços/produtos + equipa + verificações.

### Loja
Empresa ou vendedor + catálogo + estoque + pedidos + entregas.

## 6. Fluxos fundamentais

### Descobrir
Pesquisar → filtrar → comparar → abrir perfil → contactar/reservar/comprar.

### Serviço
Publicar necessidade → encontrar profissionais → propostas → contratação → execução → pagamento → avaliação.

### Marketplace
Pesquisar → produto → carrinho → checkout → pagamento → preparação → entrega/levantamento → avaliação.

### B2B
Pedido de cotação → fornecedores → propostas → negociação → contratação → pagamento → entrega.

### Classificado
Anúncio → contacto → negociação → conclusão → avaliação/denúncia.

## 7. Confiança

A plataforma deve mostrar fatos verificáveis, não uma classificação arbitrária de pessoas.

Sinais:
- telefone verificado
- identidade verificada
- empresa verificada
- documentação verificada
- localização verificada
- histórico de transações
- avaliações
- trabalhos realizados

## 8. Monetização futura

A arquitetura deve suportar:
- comissão por venda
- comissão por contratação
- planos para empresas
- destaque patrocinado
- publicidade
- taxas de entrega
- serviços B2B
- funcionalidades premium

Nenhum modelo de monetização deve ficar acoplado ao catálogo.

## 9. Segurança

- Autenticação centralizada
- Autorização no backend
- Princípio do menor privilégio
- Auditoria de ações administrativas
- Validação de entradas
- Proteção contra fraude
- Separação entre dados públicos e privados
- Idempotência para pagamentos e pedidos

## 10. Ordem de implementação

### Fase 0 — Fundação
Monorepo, contratos, design system, navegação e CI.

### Fase 1 — Identidade e localização
Contas, perfis, localização do Huambo, pesquisa inicial.

### Fase 2 — Diretório
Empresas, profissionais, categorias, páginas públicas e avaliações.

### Fase 3 — Serviços
Serviços, pedidos, propostas, agenda e contratação.

### Fase 4 — Marketplace
Lojas, produtos, estoque, carrinho, pedidos e vendedores.

### Fase 5 — Comunicação
Chat e notificações.

### Fase 6 — Pagamentos
Camada abstrata de pagamentos, transações, comissões e reembolsos.

### Fase 7 — Logística
Estafetas, atribuição, tracking e entrega.

### Fase 8 — B2B
Pedidos de cotação e fornecedores.

### Fase 9 — Administração
Moderação, KYC/KYB, auditoria, métricas e gestão.

### Fase 10 — Escala
Performance, observabilidade, SEO, analytics, cache e expansão.

## 11. Regra arquitetural

A APP e o site podem ter UX diferente, mas devem consumir os mesmos contratos, regras de domínio e backend.

Não criar uma regra de negócio exclusiva para web quando ela também deveria existir no mobile.
