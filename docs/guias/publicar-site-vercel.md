# Publicar o Site na Vercel (passo a passo)

O repositório já está preparado: a configuração está em `apps/web/vercel.json`, com o servidor na Europa (Frankfurt, junto do Supabase) e sem recompilar quando só a APP ou a documentação mudam.

> ℹ️ O plano grátis da Vercel (**Hobby**) é para uso pessoal e não comercial. Para o site a funcionar com vendas e comissões, a Vercel pede o plano pago **Pro** (preço atual em <https://vercel.com/pricing>). Pode começar com o Hobby para testar.

## 1. Criar a conta
1. Abra <https://vercel.com/signup> e escolha **Continue with GitHub**, com a conta `africanof`.
2. Autorize a Vercel a ver o repositório `HBO-Online` (pode escolher só este repositório).

## 2. Importar o projeto
1. No painel da Vercel: **Add New… → Project**.
2. Ao lado de `africanof/HBO-Online`, carregue em **Import**.
3. **Project Name:** `huambo-online`. O endereço passa a ser `https://huambo-online.vercel.app`; se o nome estiver ocupado, a Vercel acrescenta letras ao fim.
4. **Root Directory:** carregue em **Edit** e escolha `apps/web`.
5. **Framework Preset:** deve aparecer **Next.js**. Não mude os comandos de build nem de instalação.

## 3. Variáveis de ambiente
Abra **Environment Variables** e acrescente:

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pewymvkowbdizdiyjmao.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a chave **pública** (`sb_publishable_…`, a mesma de `apps/mobile/eas.json`) |
| `NEXT_PUBLIC_SITE_URL` | o endereço do passo 2.3, por exemplo `https://huambo-online.vercel.app` |

Se o serviço no Render tiver outras variáveis (**Render → serviço → Environment**), como `NEXT_PUBLIC_CONTACT_EMAIL`, `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` ou `ANDROID_SHA256_FINGERPRINTS`, copie-as também.

Nunca coloque aqui chaves secretas do Supabase (`service_role`).

## 4. Publicar
1. Carregue em **Deploy** e espere 2 a 4 minutos.
2. Abra o endereço e confirme a página inicial, os classificados e o início de sessão.

A partir daqui, **cada envio para `main` publica o site sozinho**. Cada pull request recebe também um endereço de pré-visualização.

## 5. Autorizar o novo endereço no Supabase
Sem este passo, os links de confirmação de conta e de recuperação de palavra-passe não abrem no novo site.

1. No GitHub: **Actions → «Configurar endereços de autenticação do Supabase» → Run workflow**.
2. **Endereço do site:** o novo endereço da Vercel.
3. **Outros endereços autorizados:** `https://huambo-na-m-o.onrender.com` (a APP atual ainda usa este).
4. **Run workflow**. Precisa do segredo `SUPABASE_ACCESS_TOKEN` no GitHub.

## 6. Domínio próprio (opcional)
**Vercel → projeto → Settings → Domains → Add** e siga as instruções de DNS. Depois atualize `NEXT_PUBLIC_SITE_URL` e repita o passo 5.

## 7. Terminar a mudança
1. Dê o endereço final ao responsável técnico. A APP (`apps/mobile/app.json` e `eas.json`), os testes e a documentação passam a apontar para ele, e gera-se uma nova versão da APP.
2. **Mantenha o Render ligado** até a nova versão da APP estar instalada pelos utilizadores, porque as versões antigas abrem links do Render.
3. Depois disso, apague o serviço no Render e corra de novo o passo 5 sem o endereço antigo.
