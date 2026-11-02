# Como gerar a APP Android (passo a passo)

A APP já está preparada: nome «Huambo Online», ícone, ecrã de arranque, identificador
`ao.huamboonline.app`, permissões (câmara e galeria, sem microfone) e ligação ao Supabase
(só a chave **pública**). Falta apenas a sua conta Expo.

> ⚠️ Cada compilação gasta créditos da Expo. O workflow **só corre quando carregar no botão**.

## 1. Criar a conta Expo (grátis)
1. Abra <https://expo.dev/signup> e crie a conta.
2. Em **Account settings → Access tokens**, crie um token (ex.: «github-huambo») e copie-o.

## 2. Guardar o token no GitHub (nunca no chat nem no código)
1. No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
2. Nome: `EXPO_TOKEN` · Valor: o token copiado → **Add secret**.

## 3. Gerar o APK para testar
1. No repositório: **Actions → «APP Android (EAS)» → Run workflow**.
2. Escolha **preview** (APK) → **Run workflow**.
3. O GitHub verifica os testes e pede a compilação à Expo (demora ~15–30 min).
4. Em <https://expo.dev> → o seu projeto → **Builds**, descarregue o APK e instale no telemóvel
   (pode ser preciso autorizar «instalar de fontes desconhecidas»).

## 4. Publicar na Google Play (quando quiser)
1. Conta de programador Google Play (pagamento único de 25 USD).
2. Gere com **production** (ficheiro AAB) e envie-o na Play Console.
3. Na ficha da APP use:
   - Política de privacidade: <https://huamboonline.com/privacidade>
   - Eliminação de conta: <https://huamboonline.com/apagar-conta>

## Mudar o identificador
O identificador `ao.huamboonline.app` **não pode mudar depois da 1.ª publicação na Google Play**.
Se preferir outro, diga antes de publicar (está em `apps/mobile/app.json`).
