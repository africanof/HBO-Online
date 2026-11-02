# Google Play — ficha da APP e respostas aos formulários

Tudo o que a Play Console pede para publicar a **Huambo Online**, pronto a copiar.
Imagens em `apps/mobile/store/` (ícone 512×512 e imagem de destaque 1024×500).

---

## 1. Ficha da loja principal

**Nome da app** (máx. 30)
```
Huambo Online
```

**Descrição breve** (máx. 80)
```
Compre, venda e arrende no Huambo: classificados, casas, carros, emprego e loja.
```

**Descrição completa** (máx. 4000)
```
Huambo Online é o marketplace da província do Huambo (Angola). Tudo num só sítio:

• Classificados: venda, troca, leilões e «Procura-se»
• Imóveis: casas, apartamentos, vivendas e terrenos para vender ou arrendar
• Viaturas: carros, 4x4, pick-ups, camiões e motorizadas
• Emprego e estágios: candidate-se e envie o seu CV
• Loja online: produtos de lojas e armazéns, com entrega em todo o Huambo
• Profissionais e empresas: eletricistas, canalizadores, pedreiros, explicadores e muito mais
• Praças: o que se vende no Kapango, Ferro, Cassilhas e outras praças
• Combustível e gás: veja onde há agora e reserve
• Eventos e bilhetes, hotéis, restaurantes e reservas

Mais segurança:
• Pagamento protegido: o dinheiro só chega ao vendedor depois de receber a encomenda
• Perfis verificados e alertas de burla nas mensagens
• Pontos de encontro seguros

Prático:
• Publique um anúncio em minutos, com a câmara do telemóvel
• «Fundo branco» para fotografias de produtos mais bonitas
• Alertas de pesquisas guardadas e «Novidades para si»
• Modo «Poupar dados» para gastar menos saldo
• Português, English, Français e 中文

Site: https://huamboonline.com
```

**Gráficos**
- Ícone da app: `apps/mobile/store/icone-512.png`
- Imagem de destaque: `apps/mobile/store/destaque-1024x500.png`
- Capturas de ecrã do telemóvel: 2 a 8 imagens (tiradas no próprio telemóvel com a APP instalada).

**Categoria:** Compras · **Etiquetas:** Compras, Estilo de vida
**Email de contacto:** africanofesto@gmail.com · **Site:** https://huamboonline.com

---

## 2. Conteúdo da app (Política → Conteúdo da app)

| Pergunta | Resposta |
|---|---|
| Política de privacidade | `https://huamboonline.com/privacidade` |
| Anúncios (publicidade de terceiros) | **Não**, a app não contém anúncios |
| Acesso à app | **Algumas funcionalidades precisam de sessão** → criar uma conta de teste e indicar o email e a palavra-passe (ver 2.1) |
| Classificação de conteúdo | ver secção 3 |
| Público-alvo | **18 anos ou mais** (conta exige 18 anos, ver Termos) |
| App de notícias | **Não** |
| Apps de saúde / governamentais / financeiras | **Não** |
| Eliminação de conta | Sim, na app (A minha conta → Apagar conta) e em `https://huamboonline.com/apagar-conta` |

### 2.1 Conta de teste para os revisores da Google
Crie uma conta normal no Site (por exemplo `revisor.play@…`), confirme o email e escreva na Play Console:
```
Email: <a conta de teste>
Palavra-passe: <a palavra-passe>
Instruções: Entre com esta conta em «A minha conta → Entrar». Pode publicar anúncios, enviar mensagens e ver a Loja. Os pagamentos são feitos por transferência/Multicaixa Express e confirmados pela equipa; não é preciso pagar nada para testar.
```

---

## 3. Classificação de conteúdo (questionário IARC)
- Categoria: **Todos os outros tipos de apps** (não é jogo).
- Violência, sexo, linguagem ofensiva, drogas, tabaco, álcool, jogos de azar: **Não**.
- **Os utilizadores podem interagir/comunicar?** **Sim** (mensagens entre comprador e vendedor, mediadas pela equipa).
- **Partilha a localização dos utilizadores com outros utilizadores?** **Não** (a localização só é vista pela equipa; o estafeta partilha a posição com o cliente durante a entrega — se a pergunta for sobre localização em tempo real entre utilizadores, responder **Sim**).
- **Permite compras de bens físicos?** **Sim** (Loja e classificados).
- Conteúdo gerado por utilizadores: **Sim**, com denúncia e moderação.

Resultado esperado: classificação para adolescentes/maiores (por causa da comunicação entre utilizadores e compras).

---

## 4. Segurança dos dados (Data safety)

**Recolhe ou partilha dados?** Sim, recolhe.
**Os dados são encriptados em trânsito?** Sim (HTTPS).
**Os utilizadores podem pedir a eliminação dos dados?** Sim.
**Partilha com terceiros?** Não (os fornecedores que tratam dados por nossa conta — Supabase, Vercel, OpenAI, Resend — são *prestadores de serviços*, não contam como «partilha»).

Dados recolhidos (todos **recolhidos**, nenhum **partilhado**; nenhum usado para publicidade):

| Tipo de dados (nome na Play Console) | Obrigatório? | Para quê |
|---|---|---|
| Informações pessoais → **Nome** | Obrigatório | Funcionalidade da app, gestão da conta |
| Informações pessoais → **Endereço de email** | Obrigatório | Gestão da conta, comunicações (resumo por email) |
| Informações pessoais → **Número de telefone** | Opcional | Funcionalidade da app (entregas, contacto da equipa) |
| Informações pessoais → **Morada** | Opcional | Funcionalidade da app (entregas) |
| Informações pessoais → **Outras informações** (fotografia e número do BI na verificação) | Opcional | Prevenção de fraudes e segurança |
| Localização → **Localização aproximada** e **Localização precisa** | Opcional | Funcionalidade da app (ponto no mapa, entregas) |
| Informações financeiras → **Histórico de compras** | Obrigatório para quem compra | Funcionalidade da app |
| Informações financeiras → **Outras informações financeiras** (IBAN para levantamentos, comprovativos de pagamento) | Opcional | Funcionalidade da app, prevenção de fraudes |
| Mensagens → **Outras mensagens na app** | Opcional | Funcionalidade da app |
| Fotos e vídeos → **Fotos** e **Vídeos** | Opcional | Funcionalidade da app (anúncios, chat) |
| Ficheiros de áudio → **Gravações de voz ou som** | Opcional | Funcionalidade da app (mensagens de voz) |
| Ficheiros e documentos | Opcional | Funcionalidade da app (CV nas vagas de emprego) |
| Atividade na app → **Pesquisas na app** e **Outras ações** (anúncios vistos/guardados) | Opcional | Personalização (recomendações e «Novidades para si») |
| Identificadores de dispositivo ou outros | **Não** recolhe | — |

Sem SDK de estatísticas, publicidade ou rastreio de terceiros.

---

## 5. Teste fechado (contas pessoais novas)
1. **Testar e lançar → Testes → Teste fechado → Criar faixa**.
2. Em **Testadores**, criar uma lista com os emails Gmail de pelo menos **12 pessoas**.
3. **Criar nova versão** → carregar `huambo-online.aab` (artefacto «huambo-online-production» do GitHub Actions).
4. Partilhar com os testadores a **ligação de participação** que a Play Console mostra; cada um aceita e instala pela Play Store.
5. Os 12 testadores mantêm a app instalada **14 dias seguidos**; depois disso aparece **Pedir acesso à produção**.

## 6. Compilar uma nova versão sem créditos da Expo
GitHub → Actions → **APP Android (no GitHub, sem gastar créditos da Expo)** → *Run workflow* → `production`.
O AAB fica em *Artifacts* (30 dias). O número da versão (`versionCode`) sobe sozinho na Expo.
