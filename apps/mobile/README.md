# APP — `@huambo-online/mobile`

APP Android/iOS do Huambo Online em **Expo** e React Native, com navegação por ficheiros (`expo-router`).

## Estrutura

```text
apps/mobile/
├── app/          # Ecrãs (um ficheiro por rota)
├── components/   # Componentes de interface reutilizáveis
├── lib/          # Supabase, traduções (i18n), tema e utilitários
├── assets/       # Ícone e ecrã de arranque
├── app.json      # Configuração Expo (nome, identificador, permissões, App Links)
└── eas.json      # Perfis de compilação EAS (preview = APK, production = AAB)
```

## Comandos

```bash
pnpm dev:mobile
```

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Endereço do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave **pública** do Supabase |
| `EXPO_PUBLIC_SITE_URL` | Endereço do Site (links de confirmação e recuperação) |

## Compilar e publicar

Ver [`docs/guias/lancar-app-android.md`](../../docs/guias/lancar-app-android.md).
O identificador `ao.huamboonline.app` não pode mudar depois da primeira publicação na Google Play.
