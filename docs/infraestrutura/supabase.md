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

## Mudanças depois da cópia (novembro de 2026)

| Migração | O que faz |
| --- | --- |
| `20261101120000_moderadores.sql` | Moderadores fazem tudo no painel, menos alterar contas de administrador ou dar o papel de administrador. |
| `20261101130000_contactos_privados.sql` | Telefone, WhatsApp e localização de anúncios e profissionais ficam em tabelas privadas (só o próprio e a equipa). |
| `20261101140000_mensagens_mediadas.sql` | Mensagens mediadas: os utilizadores só veem as suas mensagens e as da «Equipa Huambo Online»; a equipa reencaminha (painel → Mensagens). |
| `20261101150000_contactos_privados_negocios.sql` | Telefone e WhatsApp de empresas (hotéis, restaurantes…) e postos ficam privados; a localização continua pública. |
| `20261101160000_permissoes_sequencias.sql` | Correção: repõe a permissão de uso dos contadores (`ref_no`), perdida na cópia. |
| `20261101170000_pedidos_mediados.sql` | Encomendas, reservas, bilhetes, pedidos de serviço, propostas e alugueres ficam à espera da equipa (painel → Pedidos) até serem reencaminhados; avisos ao vendedor retidos; telefone e morada do comprador em privado. |
| `20261101171000_pedidos_mediados_correcao.sql` | Correção: os contactos privados dos pedidos só são lidos pela equipa. |
| `20261101180000_estado_pedidos_cliente.sql` | O cliente vê os seus pedidos «à espera da equipa» ou recusados (com o motivo) em «Encomendas» e «A sua conta». |
| `20261101181000_pedidos_aprovados_cliente.sql` | O cliente também vê os pedidos aprovados (reencaminhados) e recebe um aviso quando a equipa aprova. |
| `20261101190000_categorias_emprego.sql` | Categorias de anúncios «Emprego e recrutamento», «Estágios remunerados» e «Estágios não remunerados». |
| `20261101200000_documentos_emprego.sql` | Documentos Word/PDF no chat, só em conversas sobre vagas de emprego e estágios; corrige o reencaminhamento de anexos pela equipa. |
| `20261101210000_mais_categorias.sql` | 59 categorias novas: anúncios, Loja, profissionais, serviços e empresas. |
| `20261101220000_arrendamento_imoveis_gratis.sql` | Arrendamento e aluguer de imóveis sem comissão (`listing_commission_free`). |

Todas já estão aplicadas no projeto `pewymvkowbdizdiyjmao`.
