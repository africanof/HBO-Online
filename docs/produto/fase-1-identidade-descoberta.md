# Fase 1 — Identidade, Localização e Descoberta

## Objetivo
Criar a fundação funcional para que a mesma conta possa descobrir, representar e futuramente operar como cliente, profissional, vendedor ou empresa.

## Decisões
- Reutilizar a infraestrutura territorial existente no backend quando este projeto for ligado ao Supabase.
- Não duplicar tabelas de província/município/bairro/rua/endereço.
- Separar identidade da atividade comercial: uma pessoa pode acumular papéis.
- Pesquisa deve devolver entidades de tipos diferentes: empresas, profissionais, serviços e produtos.
- Site e APP usam os mesmos contratos e regras de domínio.

## Primeiras telas Web
1. Home / Descobrir
2. Resultados
3. Perfil público
4. Entrar / Criar conta
5. Escolha de tipo de atividade após criação da conta

## Primeiras telas Mobile
1. Home
2. Explorar
3. Resultados
4. Perfil público
5. Conta
6. Atividade

## Modelo de descoberta
Entrada:
- texto
- categoria
- município
- bairro
- proximidade
- tipo de entidade

Saída:
- negócios
- profissionais
- serviços
- produtos

## Categorias iniciais
- Alimentação
- Comércio
- Educação
- Saúde
- Farmácias
- Automóvel
- Construção
- Casa
- Tecnologia
- Beleza
- Profissionais liberais
- Serviços domésticos
- Transporte
- Agricultura
- Imobiliário
- Hotelaria
- Outros

## Critérios de conclusão
- APP e Web têm navegação equivalente para descoberta.
- Contratos partilhados compilam.
- Não existe duplicação da hierarquia territorial.
- Nenhum build/deploy automático é criado.
- CI apenas valida código.
