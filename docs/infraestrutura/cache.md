# Cache das listas públicas (Fase 1 já ativa · Fase 2 = Redis)

## O que já está a funcionar (Fase 1)
- O Site tem 3 endereços com cache: `/api/publico/combustivel`, `/api/publico/classificados` e `/api/publico/vendedor/<id>`.
- Guardam a resposta na **memória do servidor do Site**: combustível 30 s, classificados e vendedores 60 s.
- Muitos pedidos iguais ao mesmo tempo → **uma só consulta** ao PostgreSQL (o resto espera pela mesma resposta).
- Se a base de dados demorar mais de 8 s, o pedido desiste (não fica preso) e **erros nunca são guardados**.
- O Site e a APP usam primeiro estes endereços. Se não responderem em 3–4 s (por exemplo, o servidor a arrancar a frio),
  vão **direto ao Supabase**, como antes, e só voltam a tentar a cache uns minutos depois. Nada deixa de funcionar.
- Só listas **públicas** (iguais para todos) passam pela cache. Nada pessoal (reservas, mensagens, pagamentos) é guardado.
- Cada resposta traz `X-Cache: HIT-memory` (veio da cache) ou `MISS-memory` (foi à base de dados).

## Fase 2: ligar o Redis (antes de abrir a outras províncias)
A memória do servidor só serve uma máquina. Com várias máquinas (mais visitas), a cache tem de ser partilhada: Redis.
O código já está preparado — não é preciso mudar código, só pôr duas variáveis no servidor do Site:

1. Criar uma conta em **upstash.com** → *Create Database* → Redis → região mais perto (ex.: Frankfurt `eu-central-1`).
2. Na página da base de dados, copiar **REST URL** e **REST TOKEN**.
3. Na **Vercel** → projeto `huambo-online` → *Settings → Environment Variables* → juntar (ambiente Production):
   - `UPSTASH_REDIS_REST_URL` = (o REST URL)
   - `UPSTASH_REDIS_REST_TOKEN` = (o REST TOKEN)
   ⚠️ **Sem** `NEXT_PUBLIC_` no nome: o token é secreto e fica só no servidor.
4. Guardar e fazer *Redeploy* da última publicação. As respostas passam a dizer `X-Cache: HIT-redis`.

Para tirar o Redis, basta apagar as duas variáveis: volta à memória do servidor sozinho.

Nota: na Vercel cada pedido pode correr numa máquina diferente, por isso a cache em memória ajuda pouco. Com mais visitas, ligar o Redis é o passo certo.
