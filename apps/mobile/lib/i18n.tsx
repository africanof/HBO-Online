import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nManager, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMMON_DICT, LISTING_CHECKOUT_DICT, IMPORT_DICT, DEFAULT_LANG, LANG_STORAGE_KEY, LANG_TAGS, AVG_PHOTO_KB, detectLang, formatEventDate, isLang, makeT, mergeDictionaries, tc, type Dictionary, type Lang } from "@huambo-online/core";
import { DICT_LISTINGS } from "./i18n/listings";
import { DICT_SHOP } from "./i18n/shop";
import { DICT_SERVICES } from "./i18n/services";
import { DICT_ADMIN } from "./i18n/admin";

/**
 * Línguas da APP: português (base), inglês e mandarim (chinês simplificado).
 * Os textos comuns ao Site e à APP vêm de COMMON_DICT (@huambo-online/core); aqui ficam só os da APP.
 * Se faltar uma tradução, aparece o texto em português.
 */
export const APP_DICT: Dictionary = {
  // Escolha da língua
  "lang.change_to": { pt: "Mudar a língua para {name}", en: "Change language to {name}", zh: "将语言切换为{name}", fr: "Changer la langue en {name}" },

  // Aparência e poupar dados
  "theme.hint": { pt: "Automático segue o modo claro ou escuro do seu telemóvel.", en: "Automatic follows your phone's light or dark mode.", zh: "“自动”会跟随手机的浅色或深色模式。", fr: "Automatique suit le mode clair ou sombre de votre téléphone." },
  "theme.system": { pt: "🌓 Automático", en: "🌓 Automatic", zh: "🌓 自动", fr: "🌓 Automatique" },
  "theme.light": { pt: "☀️ Claro", en: "☀️ Light", zh: "☀️ 浅色", fr: "☀️ Clair" },
  "theme.dark": { pt: "🌙 Escuro", en: "🌙 Dark", zh: "🌙 深色", fr: "🌙 Sombre" },
  "theme.light_mode": { pt: "☀️ Modo claro", en: "☀️ Light mode", zh: "☀️ 浅色模式", fr: "☀️ Mode clair" },
  "theme.dark_mode": { pt: "🌙 Modo escuro", en: "🌙 Dark mode", zh: "🌙 深色模式", fr: "🌙 Mode sombre" },
  "theme.to_light": { pt: "Mudar para o modo claro", en: "Switch to light mode", zh: "切换到浅色模式", fr: "Passer en mode clair" },
  "theme.to_dark": { pt: "Mudar para o modo escuro", en: "Switch to dark mode", zh: "切换到深色模式", fr: "Passer en mode sombre" },
  "data.hint": { pt: "Gaste menos saldo: as fotografias das listas não carregam e, nos anúncios, só carregam quando tocar. Os vídeos só carregam quando carrega em ▶.", en: "Use less mobile data: photos in lists don't load, and in listings they only load when you tap them. Videos only load when you press ▶.", zh: "节省流量：列表中的照片不加载，信息详情中的照片点击后才加载。视频只在按下 ▶ 后加载。", fr: "Consommez moins de données mobiles : les photos des listes ne se chargent pas et, dans les annonces, elles ne se chargent que lorsque vous touchez. Les vidéos ne se chargent que lorsque vous appuyez sur ▶." },
  "data.on": { pt: "📉 Ligado", en: "📉 On", zh: "📉 开启", fr: "📉 Activé" },
  "data.off": { pt: "Desligado", en: "Off", zh: "关闭", fr: "Désactivé" },
  "data.toggle": { pt: "📉 Poupar dados", en: "📉 Data saver", zh: "📉 节省流量", fr: "📉 Économie de données" },
  "data.toggle_on": { pt: "📉 A poupar dados", en: "📉 Saving data", zh: "📉 正在节省流量", fr: "📉 Économie de données active" },
  "data.turn_on": { pt: "Ligar Poupar dados", en: "Turn on data saver", zh: "开启节省流量", fr: "Activer l'économie de données" },
  "data.turn_off": { pt: "Desligar Poupar dados", en: "Turn off data saver", zh: "关闭节省流量", fr: "Désactiver l'économie de données" },
  "data.saved_one": { pt: "Poupou cerca de {size} (1 fotografia não carregada).", en: "You saved about {size} (1 photo not loaded).", zh: "已节省约 {size}（1 张照片未加载）。", fr: "Vous avez économisé environ {size} (1 photo non chargée)." },
  "data.saved_many": { pt: "Poupou cerca de {size} ({n} fotografias não carregadas).", en: "You saved about {size} ({n} photos not loaded).", zh: "已节省约 {size}（{n} 张照片未加载）。", fr: "Vous avez économisé environ {size} ({n} photos non chargées)." },

  // Sem internet
  "offline.none": { pt: "Sem internet. Verifique a ligação e tente novamente.", en: "No internet. Check your connection and try again.", zh: "没有网络。请检查网络连接后重试。", fr: "Pas d'internet. Vérifiez votre connexion et réessayez." },
  "offline.today": { pt: "📡 Sem internet — a mostrar o que foi guardado às {time}.", en: "📡 No internet — showing what was saved at {time}.", zh: "📡 没有网络——正在显示 {time} 保存的内容。", fr: "📡 Pas d'internet — affichage de ce qui a été enregistré à {time}." },
  "offline.yesterday": { pt: "📡 Sem internet — a mostrar o que foi guardado ontem às {time}.", en: "📡 No internet — showing what was saved yesterday at {time}.", zh: "📡 没有网络——正在显示昨天 {time} 保存的内容。", fr: "📡 Pas d'internet — affichage de ce qui a été enregistré hier à {time}." },
  "offline.days": { pt: "📡 Sem internet — a mostrar o que foi guardado há {n} dias.", en: "📡 No internet — showing what was saved {n} days ago.", zh: "📡 没有网络——正在显示 {n} 天前保存的内容。", fr: "📡 Pas d'internet — affichage de ce qui a été enregistré il y a {n} jours." },

  // Pesquisa, cartões e ícones do topo
  "search.photo": { pt: "Pesquisar por fotografia", en: "Search by photo", zh: "以图搜索", fr: "Rechercher par photo" },
  "card.video": { pt: "▶ Vídeo", en: "▶ Video", zh: "▶ 视频", fr: "▶ Vidéo" },
  "card.featured": { pt: "⭐ Destaque", en: "⭐ Featured", zh: "⭐ 精选", fr: "⭐ À la une" },
  "card.featured_a11y": { pt: "Destaque: ", en: "Featured: ", zh: "精选：", fr: "À la une : " },
  "bell.notifications": { pt: "Notificações ({n} por ler)", en: "Notifications ({n} unread)", zh: "通知（{n} 条未读）", fr: "Notifications ({n} non lues)" },
  "bell.messages": { pt: "Mensagens ({n} por ler)", en: "Messages ({n} unread)", zh: "消息（{n} 条未读）", fr: "Messages ({n} non lus)" },
  "bell.cart": { pt: "Carrinho ({n} artigos)", en: "Cart ({n} items)", zh: "购物车（{n} 件商品）", fr: "Panier ({n} articles)" },

  // Há quanto tempo
  "time.now": { pt: "agora mesmo", en: "just now", zh: "刚刚", fr: "à l'instant" },
  "time.min": { pt: "há {n} min", en: "{n} min ago", zh: "{n} 分钟前", fr: "il y a {n} min" },
  "time.h": { pt: "há {n} h", en: "{n} h ago", zh: "{n} 小时前", fr: "il y a {n} h" },
  "time.day": { pt: "há 1 dia", en: "1 day ago", zh: "1 天前", fr: "il y a 1 jour" },
  "time.days": { pt: "há {n} dias", en: "{n} days ago", zh: "{n} 天前", fr: "il y a {n} jours" },

  // Etiquetas e preços que vêm do core (os preços continuam em Kz)
  "tag.sale": { pt: "Venda", en: "For sale", zh: "出售", fr: "À vendre" },
  "tag.rent": { pt: "Arrendamento", en: "For rent", zh: "出租", fr: "À louer" },
  "tag.lease": { pt: "Aluguer", en: "For hire", zh: "租用", fr: "À louer" },
  "tag.wanted": { pt: "Procuro", en: "Wanted", zh: "求购", fr: "Recherche" },
  "tag.service": { pt: "Serviço", en: "Service", zh: "服务", fr: "Service" },
  "tag.auction": { pt: "Leilão", en: "Auction", zh: "拍卖", fr: "Enchère" },
  "tag.fixed": { pt: "Preço fixo", en: "Fixed price", zh: "一口价", fr: "Prix fixe" },
  "tag.negotiable": { pt: "Negociável", en: "Negotiable", zh: "可议价", fr: "Négociable" },
  "tag.offers": { pt: "Aceita propostas", en: "Open to offers", zh: "接受报价", fr: "Ouvert aux offres" },
  "tag.trade": { pt: "Troca", en: "Swap", zh: "交换", fr: "Échange" },
  "tag.accepts_trade": { pt: "Aceita troca", en: "Swaps accepted", zh: "接受交换", fr: "Échanges acceptés" },
  "tag.sold_out": { pt: "Esgotado", en: "Sold out", zh: "售罄", fr: "Complet" },
  "price.on_request": { pt: "Preço sob consulta", en: "Price on request", zh: "价格面议", fr: "Prix sur demande" },
  "price.trade": { pt: "🔁 Troca", en: "🔁 Swap", zh: "🔁 交换", fr: "🔁 Échange" },
  "price.budget_tbd": { pt: "Orçamento a combinar", en: "Budget to be agreed", zh: "预算面议", fr: "Budget à convenir" },
  "price.up_to": { pt: "até {price}", en: "up to {price}", zh: "最高 {price}", fr: "jusqu'à {price}" },
  "price.from": { pt: "a partir de {price}", en: "from {price}", zh: "{price} 起", fr: "à partir de {price}" },
  "price.tickets_from": { pt: "Desde {price}", en: "From {price}", zh: "{price} 起", fr: "À partir de {price}" },
  "price.no_tickets": { pt: "Sem bilhetes", en: "No tickets", zh: "暂无门票", fr: "Pas de billets" },
  "price.free": { pt: "Grátis", en: "Free", zh: "免费", fr: "Gratuit" },
  "rating.none": { pt: "Sem avaliações", en: "No reviews", zh: "暂无评价", fr: "Aucune évaluation" },
  "market.listings_one": { pt: "{n} anúncio", en: "{n} listing", zh: "{n} 条信息", fr: "{n} annonce" },
  "market.listings_many": { pt: "{n} anúncios", en: "{n} listings", zh: "{n} 条信息", fr: "{n} annonces" },
  "market.products_one": { pt: "{n} produto", en: "{n} product", zh: "{n} 件商品", fr: "{n} produit" },
  "market.products_many": { pt: "{n} produtos", en: "{n} products", zh: "{n} 件商品", fr: "{n} produits" },
  "market.shops_one": { pt: "{n} loja", en: "{n} shop", zh: "{n} 家店铺", fr: "{n} boutique" },
  "market.shops_many": { pt: "{n} lojas", en: "{n} shops", zh: "{n} 家店铺", fr: "{n} boutiques" },
  "market.empty": { pt: "Ainda sem vendedores no Huambo Online", en: "No sellers on Huambo Online yet", zh: "Huambo Online 上暂无卖家", fr: "Pas encore de vendeurs sur Huambo Online" },

  // Página inicial
  "home.welcome": { pt: "Entre para comprar, vender e guardar favoritos.", en: "Sign in to buy, sell and save favourites.", zh: "登录后即可买卖商品并收藏喜欢的内容。", fr: "Connectez-vous pour acheter, vendre et enregistrer des favoris." },
  "home.hero_title": { pt: "Compre, venda e encontre tudo no Huambo.", en: "Buy, sell and find everything in Huambo.", zh: "在万博买卖、寻找一切。", fr: "Achetez, vendez et trouvez de tout au Huambo." },
  "home.hero_text": { pt: "Classificados, loja, leilões, profissionais e empresas.", en: "Classifieds, shop, auctions, professionals and businesses.", zh: "分类信息、商店、拍卖、专业人士和企业。", fr: "Petites annonces, boutique, enchères, professionnels et entreprises." },
  "home.sell_now": { pt: "Vender agora", en: "Sell now", zh: "立即出售", fr: "Vendre maintenant" },
  "home.loading": { pt: "A carregar novidades…", en: "Loading what's new…", zh: "正在加载最新内容…", fr: "Chargement des nouveautés…" },
  "home.videos": { pt: "🎬 Vídeos e lives", en: "🎬 Videos and live streams", zh: "🎬 视频和直播", fr: "🎬 Vidéos et directs" },
  "home.auctions": { pt: "🔨 Leilões a decorrer", en: "🔨 Ongoing auctions", zh: "🔨 进行中的拍卖", fr: "🔨 Enchères en cours" },
  "home.markets": { pt: "🧺 Praças do Huambo", en: "🧺 Huambo markets", zh: "🧺 万博市场", fr: "🧺 Marchés du Huambo" },
  "home.for_you": { pt: "Recomendados para si", en: "Recommended for you", zh: "为您推荐", fr: "Recommandés pour vous" },
  "home.new": { pt: "Novidades", en: "New listings", zh: "最新信息", fr: "Nouvelles annonces" },
  "home.wanted_badge": { pt: "🔎 PROCURA-SE", en: "🔎 WANTED", zh: "🔎 求购", fr: "🔎 RECHERCHE" },
  "home.budget": { pt: "Orçamento:", en: "Budget:", zh: "预算：", fr: "Budget :" },
  "home.sell_title": { pt: "Tem algo para vender?", en: "Got something to sell?", zh: "有东西要卖吗？", fr: "Vous avez quelque chose à vendre ?" },
  "home.sell_text": { pt: "Publique grátis com fotografias e receba mensagens de compradores.", en: "Post for free with photos and get messages from buyers.", zh: "免费发布带照片的信息，接收买家的消息。", fr: "Publiez gratuitement avec des photos et recevez des messages d'acheteurs." },
  "home.post_listing": { pt: "+ Publicar anúncio", en: "+ Post a listing", zh: "+ 发布信息", fr: "+ Publier une annonce" },
  "home.post_wanted": { pt: "🔎 Publicar o que procuro", en: "🔎 Post what I'm looking for", zh: "🔎 发布求购信息", fr: "🔎 Publier ce que je cherche" },
  "home.in_shop": { pt: "🛍️ Na loja", en: "🛍️ In the shop", zh: "🛍️ 商店商品", fr: "🛍️ Dans la boutique" },
  "home.for_rent": { pt: "🔑 Para arrendar", en: "🔑 For rent", zh: "🔑 出租", fr: "🔑 À louer" },
  "home.first_title": { pt: "Seja o primeiro a anunciar!", en: "Be the first to post!", zh: "成为第一个发布信息的人！", fr: "Soyez le premier à publier !" },
  "home.first_text": { pt: "Ainda há poucos artigos. Publique o seu e ajude o Huambo Online a crescer.", en: "There are only a few items so far. Post yours and help Huambo Online grow.", zh: "目前商品还不多。发布您的商品，帮助 Huambo Online 成长。", fr: "Il y a encore peu d'articles. Publiez le vôtre et aidez Huambo Online à grandir." },
  "home.shortcuts": { pt: "Atalhos", en: "Shortcuts", zh: "快捷入口", fr: "Raccourcis" },
  "home.pro_title": { pt: "Profissional, empresa, estafeta ou agente?", en: "Professional, business, courier or agent?", zh: "专业人士、企业、快递员还是代理人？", fr: "Professionnel, entreprise, livreur ou agent ?" },
  "home.pro_text": { pt: "Crie o seu perfil e receba clientes de todo o Huambo. Agentes ajudam quem não tem telemóvel ou não sabe usar a internet a vender, trocar ou leiloar — e ganham comissão em cada venda.", en: "Create your profile and get customers from all over Huambo. Agents help people who have no phone or don't know how to use the internet to sell, swap or auction — and earn a commission on every sale.", zh: "创建您的资料，接待来自万博各地的客户。代理人帮助没有手机或不会上网的人出售、交换或拍卖物品，并从每笔交易中赚取佣金。", fr: "Créez votre profil et recevez des clients de tout le Huambo. Les agents aident les personnes qui n'ont pas de téléphone ou ne savent pas utiliser internet à vendre, échanger ou mettre aux enchères — et touchent une commission sur chaque vente." },
  "home.i_am_pro": { pt: "Sou profissional", en: "I'm a professional", zh: "我是专业人士", fr: "Je suis professionnel" },
  "home.i_have_business": { pt: "Tenho uma empresa", en: "I have a business", zh: "我有企业", fr: "J'ai une entreprise" },
  "home.be_courier": { pt: "Quero ser estafeta", en: "I want to be a courier", zh: "我想成为快递员", fr: "Je veux être livreur" },
  "home.be_agent": { pt: "Quero ser um agente", en: "I want to be an agent", zh: "我想成为代理人", fr: "Je veux être agent" },

  // Atalhos (página inicial e conta)
  "more.agri": { pt: "Agricultura e campo", en: "Farming and agriculture", zh: "农业与田园", fr: "Agriculture et élevage" },
  "more.videos": { pt: "Vídeos e lives", en: "Videos and live streams", zh: "视频和直播", fr: "Vidéos et directs" },
  "more.following": { pt: "A seguir", en: "Following", zh: "关注中", fr: "Abonnements" },
  "more.safety": { pt: "Segurança", en: "Safety", zh: "安全须知", fr: "Sécurité" },
  "more.agent": { pt: "Ser agente", en: "Become an agent", zh: "成为代理人", fr: "Devenir agent" },
  "more.invite": { pt: "Convidar amigos", en: "Invite friends", zh: "邀请好友", fr: "Inviter des amis" },
  "more.my_listings": { pt: "Os meus anúncios", en: "My listings", zh: "我的信息", fr: "Mes annonces" },
  "more.orders": { pt: "Encomendas", en: "Orders", zh: "订单", fr: "Commandes" },
  "more.recent": { pt: "Vistos recentemente", en: "Recently viewed", zh: "最近浏览", fr: "Vus récemment" },
  "more.saved_searches": { pt: "Pesquisas guardadas", en: "Saved searches", zh: "已保存的搜索", fr: "Recherches enregistrées" },

  // Entrar e 2.º passo
  "login.step2_title": { pt: "Entrar — 2.º passo", en: "Sign in — step 2", zh: "登录——第 2 步", fr: "Connexion — étape 2" },
  "login.step2_text": { pt: "A palavra-passe está certa. Esta conta tem a entrada em dois passos ligada.", en: "Your password is correct. This account has two-step sign-in turned on.", zh: "密码正确。此账户已开启两步登录。", fr: "Votre mot de passe est correct. Ce compte a la connexion en deux étapes activée." },
  "login.cancel_exit": { pt: "Cancelar e sair", en: "Cancel and sign out", zh: "取消并退出", fr: "Annuler et se déconnecter" },
  "login.recover_title": { pt: "Recuperar palavra-passe", en: "Recover password", zh: "找回密码", fr: "Récupérer le mot de passe" },
  "login.wait": { pt: "Aguarde…", en: "Please wait…", zh: "请稍候…", fr: "Veuillez patienter…" },
  "login.send_link": { pt: "Enviar link de recuperação", en: "Send recovery link", zh: "发送找回链接", fr: "Envoyer le lien de récupération" },
  "login.back": { pt: "← Voltar a entrar", en: "← Back to sign in", zh: "← 返回登录", fr: "← Retour à la connexion" },
  "login.create": { pt: "Criar uma conta", en: "Create an account", zh: "注册新账户", fr: "Créer un compte" },
  "login.need_email": { pt: "Indique o email.", en: "Enter your email.", zh: "请输入电子邮箱。", fr: "Indiquez votre e-mail." },
  "login.reset_sent": { pt: "Se o email existir, enviámos um link para definir uma nova palavra-passe.", en: "If that email exists, we've sent a link to set a new password.", zh: "如果该邮箱存在，我们已发送设置新密码的链接。", fr: "Si cet e-mail existe, nous avons envoyé un lien pour définir un nouveau mot de passe." },
  "mfa.text": { pt: "Abra a APP autenticadora (Google Authenticator, Microsoft Authenticator ou Authy) e escreva os 6 algarismos que aparecem para o Huambo Online.", en: "Open your authenticator app (Google Authenticator, Microsoft Authenticator or Authy) and enter the 6 digits shown for Huambo Online.", zh: "打开身份验证器应用（Google Authenticator、Microsoft Authenticator 或 Authy），输入 Huambo Online 显示的 6 位数字。", fr: "Ouvrez votre application d'authentification (Google Authenticator, Microsoft Authenticator ou Authy) et indiquez les 6 chiffres affichés pour Huambo Online." },
  "mfa.code": { pt: "Código de 6 algarismos", en: "6-digit code", zh: "6 位数字验证码", fr: "Code à 6 chiffres" },
  "mfa.confirming": { pt: "A confirmar…", en: "Confirming…", zh: "正在确认…", fr: "Confirmation…" },

  // Criar conta
  "signup.phone_opt": { pt: "Telefone (opcional)", en: "Phone (optional)", zh: "电话（选填）", fr: "Téléphone (facultatif)" },
  "signup.muni_opt": { pt: "Município (opcional)", en: "Municipality (optional)", zh: "市镇（选填）", fr: "Municipalité (facultatif)" },
  "signup.muni_ph": { pt: "Ex.: Huambo, Caála…", en: "E.g. Huambo, Caála…", zh: "例如：Huambo、Caála…", fr: "Ex. : Huambo, Caála…" },
  "signup.invite_opt": { pt: "Código de convite (opcional)", en: "Invite code (optional)", zh: "邀请码（选填）", fr: "Code d'invitation (facultatif)" },
  "signup.invite": { pt: "Código de convite", en: "Invite code", zh: "邀请码", fr: "Code d'invitation" },
  "signup.invite_ph": { pt: "Ex.: K7M2QX", en: "E.g. K7M2QX", zh: "例如：K7M2QX", fr: "Ex. : K7M2QX" },
  "signup.have_account": { pt: "Já tenho conta", en: "I already have an account", zh: "我已有账户", fr: "J'ai déjà un compte" },
  "signup.not_configured": { pt: "Serviço de autenticação não configurado.", en: "The sign-in service is not set up.", zh: "登录服务尚未配置。", fr: "Le service de connexion n'est pas configuré." },
  "signup.bad_email": { pt: "Email inválido.", en: "Invalid email.", zh: "电子邮箱无效。", fr: "E-mail invalide." },
  "signup.bad_invite": { pt: "O código de convite tem 6 letras e números (ex.: K7M2QX).", en: "The invite code has 6 letters and numbers (e.g. K7M2QX).", zh: "邀请码由 6 位字母和数字组成（例如：K7M2QX）。", fr: "Le code d'invitation a 6 lettres et chiffres (ex. : K7M2QX)." },
  "signup.exists": { pt: "Já existe uma conta com este email. Use «Entrar».", en: "An account with this email already exists. Use “Sign in”.", zh: "该邮箱已注册账户，请使用“登录”。", fr: "Un compte existe déjà avec cet e-mail. Utilisez «Se connecter»." },
  "signup.created": { pt: "Conta criada com sucesso.", en: "Account created successfully.", zh: "账户创建成功。", fr: "Compte créé avec succès." },
  "signup.confirm_email": { pt: "Conta criada. Abra o email que enviámos e clique no link para confirmar. Depois pode entrar.", en: "Account created. Open the email we sent you and tap the link to confirm. Then you can sign in.", zh: "账户已创建。请打开我们发送的邮件并点击链接确认，然后即可登录。", fr: "Compte créé. Ouvrez l'e-mail que nous vous avons envoyé et touchez le lien pour confirmer. Vous pourrez ensuite vous connecter." },

  // Nova palavra-passe
  "recover.title": { pt: "Nova palavra-passe", en: "New password", zh: "新密码", fr: "Nouveau mot de passe" },
  "recover.saving": { pt: "A guardar…", en: "Saving…", zh: "正在保存…", fr: "Enregistrement…" },
  "recover.set": { pt: "Definir nova palavra-passe", en: "Set new password", zh: "设置新密码", fr: "Définir le nouveau mot de passe" },
  "recover.done": { pt: "Palavra-passe atualizada.", en: "Password updated.", zh: "密码已更新。", fr: "Mot de passe mis à jour." },

  // Conta
  "account.title": { pt: "A sua conta", en: "Your account", zh: "您的账户", fr: "Votre compte" },
  "account.sign_in_hint": { pt: "Inicie sessão para gerir a sua conta.", en: "Sign in to manage your account.", zh: "请登录以管理您的账户。", fr: "Connectez-vous pour gérer votre compte." },
  "account.photo": { pt: "Fotografia de perfil", en: "Profile photo", zh: "头像", fr: "Photo de profil" },
  "account.change_photo": { pt: "📷 Mudar fotografia de perfil", en: "📷 Change profile photo", zh: "📷 更换头像", fr: "📷 Changer la photo de profil" },
  "account.photo_permission": { pt: "Autorize o acesso às fotografias.", en: "Please allow access to your photos.", zh: "请允许访问您的照片。", fr: "Veuillez autoriser l'accès à vos photos." },
  "account.photo_too_big": { pt: "Escolha uma imagem até 2 MB.", en: "Choose an image of up to 2 MB.", zh: "请选择不超过 2 MB 的图片。", fr: "Choisissez une image de 2 Mo maximum." },
  "account.photo_ok": { pt: "Fotografia atualizada.", en: "Photo updated.", zh: "头像已更新。", fr: "Photo mise à jour." },
  "account.signed_in_as": { pt: "Sessão iniciada como {email}", en: "Signed in as {email}", zh: "当前登录账户：{email}", fr: "Connecté en tant que {email}" },
  "account.pro_profile": { pt: "🧰 Perfil profissional", en: "🧰 Professional profile", zh: "🧰 专业人士资料", fr: "🧰 Profil professionnel" },
  "account.businesses": { pt: "🏪 As minhas empresas", en: "🏪 My businesses", zh: "🏪 我的企业", fr: "🏪 Mes entreprises" },
  "account.products": { pt: "🛍️ Os meus produtos", en: "🛍️ My products", zh: "🛍️ 我的商品", fr: "🛍️ Mes produits" },
  "account.plan": { pt: "💳 O meu plano", en: "💳 My plan", zh: "💳 我的套餐", fr: "💳 Mon forfait" },
  "account.commissions": { pt: "💸 Comissões", en: "💸 Commissions", zh: "💸 佣金", fr: "💸 Commissions" },
  "account.balance": { pt: "💰 O meu saldo", en: "💰 My balance", zh: "💰 我的余额", fr: "💰 Mon solde" },
  "account.stats": { pt: "📊 Estatísticas", en: "📊 Statistics", zh: "📊 统计数据", fr: "📊 Statistiques" },
  "account.tickets": { pt: "🎟️ Os meus bilhetes", en: "🎟️ My tickets", zh: "🎟️ 我的门票", fr: "🎟️ Mes billets" },
  "account.fuel_bookings": { pt: "⛽ Reservas de combustível", en: "⛽ Fuel bookings", zh: "⛽ 燃油预订", fr: "⛽ Réservations de carburant" },
  "account.fuel_stations": { pt: "⛽ Os meus postos", en: "⛽ My fuel stations", zh: "⛽ 我的加油站", fr: "⛽ Mes stations" },
  "account.events": { pt: "🎤 Os meus eventos", en: "🎤 My events", zh: "🎤 我的活动", fr: "🎤 Mes événements" },
  "account.returns": { pt: "↩️ Devoluções e reembolsos", en: "↩️ Returns and refunds", zh: "↩️ 退货与退款", fr: "↩️ Retours et remboursements" },
  "account.service_requests": { pt: "🛠️ Pedidos de serviço", en: "🛠️ Service requests", zh: "🛠️ 服务请求", fr: "🛠️ Demandes de service" },
  "account.offers": { pt: "💬 As minhas propostas", en: "💬 My offers", zh: "💬 我的报价", fr: "💬 Mes offres" },
  "account.bids": { pt: "🔨 As minhas licitações", en: "🔨 My bids", zh: "🔨 我的出价", fr: "🔨 Mes enchères" },
  "account.reviews": { pt: "⭐ Avaliações", en: "⭐ Reviews", zh: "⭐ 评价", fr: "⭐ Évaluations" },
  "account.verify": { pt: "✔ Verificar perfil", en: "✔ Verify profile", zh: "✔ 认证资料", fr: "✔ Vérifier le profil" },
  "account.two_step": { pt: "🔐 Entrar em dois passos", en: "🔐 Two-step sign-in", zh: "🔐 两步登录", fr: "🔐 Connexion en deux étapes" },
  "account.inspected": { pt: "🏅 Selo «Inspecionado»", en: "🏅 “Inspected” badge", zh: "🏅 “已检验”标志", fr: "🏅 Badge « Inspecté »" },
  "account.terms": { pt: "📄 Termos e Privacidade", en: "📄 Terms and Privacy", zh: "📄 条款与隐私", fr: "📄 Conditions et Confidentialité" },
  "account.rentals": { pt: "📅 Alugueres", en: "📅 Rentals", zh: "📅 租赁", fr: "📅 Locations" },
  "account.courier": { pt: "🛵 Ser estafeta / Entregas", en: "🛵 Become a courier / Deliveries", zh: "🛵 成为快递员 / 配送", fr: "🛵 Devenir livreur / Livraisons" },
  "account.personal": { pt: "Dados pessoais", en: "Personal details", zh: "个人资料", fr: "Données personnelles" },
  "account.name": { pt: "Nome", en: "Name", zh: "姓名", fr: "Nom" },
  "account.save_changes": { pt: "Guardar alterações", en: "Save changes", zh: "保存更改", fr: "Enregistrer les modifications" },
  "account.profile_ok": { pt: "Perfil atualizado.", en: "Profile updated.", zh: "资料已更新。", fr: "Profil mis à jour." },
  "account.security": { pt: "Segurança", en: "Security", zh: "账户安全", fr: "Sécurité" },
  "account.change_password": { pt: "Alterar palavra-passe", en: "Change password", zh: "修改密码", fr: "Changer le mot de passe" },
  "account.password_ok": { pt: "Palavra-passe alterada com sucesso.", en: "Password changed successfully.", zh: "密码修改成功。", fr: "Mot de passe modifié avec succès." },
  "account.privacy": { pt: "Privacidade", en: "Privacy", zh: "隐私", fr: "Confidentialité" },
  "account.delete_text": { pt: "Eliminar a conta remove permanentemente os seus dados.", en: "Deleting your account permanently removes your data.", zh: "删除账户将永久清除您的数据。", fr: "Supprimer votre compte efface définitivement vos données." },
  "account.delete_placeholder": { pt: "Escreva ELIMINAR para confirmar", en: "Type ELIMINAR to confirm", zh: "输入 ELIMINAR 以确认", fr: "Tapez ELIMINAR pour confirmer" },
  "account.deleting": { pt: "A eliminar…", en: "Deleting…", zh: "正在删除…", fr: "Suppression…" },
  "account.delete": { pt: "Eliminar a minha conta", en: "Delete my account", zh: "删除我的账户", fr: "Supprimer mon compte" },
  "account.deleted": { pt: "Conta eliminada.", en: "Account deleted.", zh: "账户已删除。", fr: "Compte supprimé." },
  "account.sign_out": { pt: "Terminar sessão", en: "Sign out", zh: "退出登录", fr: "Se déconnecter" },

  // WhatsApp (na conta)
  "wa.team_btn": { pt: "💬 Conversar no WhatsApp", en: "💬 Chat on WhatsApp", zh: "💬 通过 WhatsApp 咨询", fr: "💬 Discuter sur WhatsApp" },
  "wa.team_hint": { pt: "Fala com a equipa do Huambo Online, que trata do contacto com o vendedor. A mensagem já leva a ligação do anúncio.", en: "You talk to the Huambo Online team, who handle the contact with the seller. The message already includes the link.", zh: "您将与 Huambo Online 团队沟通，由团队联系卖家。消息中已包含链接。", fr: "Vous parlez avec l'équipe de Huambo Online, qui s'occupe du contact avec le vendeur. Le message contient déjà le lien." },
  "wa.team_req": { pt: "💬 Falar deste pedido no WhatsApp", en: "💬 Ask about this on WhatsApp", zh: "💬 通过 WhatsApp 咨询此请求", fr: "💬 Demander sur WhatsApp" },
  "wa.seller_staff": { pt: "💬 WhatsApp do vendedor (só a equipa)", en: "💬 Seller's WhatsApp (team only)", zh: "💬 卖家 WhatsApp（仅团队）", fr: "💬 WhatsApp du vendeur (équipe uniquement)" },
  "wa.team_title": { pt: "💬 WhatsApp da equipa", en: "💬 Team WhatsApp", zh: "💬 团队 WhatsApp", fr: "💬 WhatsApp de l'équipe" },
  "wa.team_text": { pt: "Este número aparece no botão «Conversar no WhatsApp» em todos os anúncios, produtos e pedidos do Site e da APP. As mensagens chegam já com a ligação direta.", en: "This number is used by the «Chat on WhatsApp» button on every listing, product and request on the Site and the APP. Messages arrive with the direct link.", zh: "此号码用于网站和应用中所有信息、商品和请求上的「通过 WhatsApp 咨询」按钮。消息会附带直达链接。", fr: "Ce numéro est utilisé par le bouton «Discuter sur WhatsApp» de chaque annonce, produit et recherche sur le Site et l'APP. Les messages arrivent avec le lien direct." },
  "wa.team_saved": { pt: "Número da equipa guardado.", en: "Team number saved.", zh: "团队号码已保存。", fr: "Numéro de l'équipe enregistré." },
  "wa.team_deleted": { pt: "Número apagado: o botão do WhatsApp deixa de aparecer.", en: "Number deleted: the WhatsApp button no longer appears.", zh: "号码已删除：WhatsApp 按钮将不再显示。", fr: "Numéro supprimé : le bouton WhatsApp n'apparaît plus." },
  "sh.pd.tip": { pt: "📸 Depois de pagar, envie a fotografia nítida do talão inteiro (valor, data, conta de destino e n.º da operação). A equipa confere e confirma.", en: "📸 After paying, send a clear photo of the whole receipt (amount, date, destination account and operation number). The team checks and confirms it.", zh: "📸 付款后，请上传完整收据的清晰照片（金额、日期、收款账户和交易编号）。团队会核对并确认。", fr: "📸 Après avoir payé, envoyez une photo nette du justificatif complet (montant, date, compte de destination et numéro d'opération). L'équipe le vérifie et le confirme." },
  "sh.pd.help": { pt: "🤖 Dúvidas sobre o pagamento? Pergunte ao assistente", en: "🤖 Questions about paying? Ask the assistant", zh: "🤖 对付款有疑问？询问助手", fr: "🤖 Des questions sur le paiement ? Demandez à l'assistant" },
  "wa.text": { pt: "O seu número de WhatsApp fica guardado só para a equipa do Huambo Online (administração e moderadores). Os outros utilizadores falam consigo pelas Mensagens.", en: "Your WhatsApp number is kept only for the Huambo Online team (administrators and moderators). Other users contact you through Messages.", zh: "您的 WhatsApp 号码仅供 Huambo Online 团队（管理员和版主）查看。其他用户通过站内消息与您联系。", fr: "Votre numéro WhatsApp est réservé à l'équipe de Huambo Online (administrateurs et modérateurs). Les autres utilisateurs vous contactent via Messages." },
  "wa.number": { pt: "Número de WhatsApp", en: "WhatsApp number", zh: "WhatsApp 号码", fr: "Numéro WhatsApp" },
  "wa.privacy": { pt: "Pode apagar o número quando quiser.", en: "You can delete the number at any time.", zh: "您可以随时删除该号码。", fr: "Vous pouvez supprimer le numéro à tout moment." },
  "wa.save": { pt: "Guardar WhatsApp", en: "Save WhatsApp", zh: "保存 WhatsApp", fr: "Enregistrer le WhatsApp" },
  "wa.deleted": { pt: "Número de WhatsApp apagado.", en: "WhatsApp number deleted.", zh: "WhatsApp 号码已删除。", fr: "Numéro WhatsApp supprimé." },
  "wa.saved_public": { pt: "Guardado. Só a equipa do Huambo Online vê o seu número.", en: "Saved. Only the Huambo Online team can see your number.", zh: "已保存。只有 Huambo Online 团队能看到您的号码。", fr: "Enregistré. Seule l'équipe de Huambo Online peut voir votre numéro." },
};

/** Todos os textos da APP (comuns + só da APP). */
export const DICT: Dictionary = mergeDictionaries(COMMON_DICT, LISTING_CHECKOUT_DICT, IMPORT_DICT, APP_DICT, DICT_LISTINGS, DICT_SHOP, DICT_SERVICES, DICT_ADMIN);

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Textos em português que vêm do core (etiquetas, preços) → chave da tradução. */
const CORE_TEXT: Record<string, string> = {
  "Venda": "tag.sale", "Arrendamento": "tag.rent", "Aluguer": "tag.lease", "Procuro": "tag.wanted", "Serviço": "tag.service", "Leilão": "tag.auction",
  "Preço fixo": "tag.fixed", "Negociável": "tag.negotiable", "Aceita propostas": "tag.offers", "Troca": "tag.trade", "Aceita troca": "tag.accepts_trade",
  "Esgotado": "tag.sold_out", "Preço sob consulta": "price.on_request", "🔁 Troca": "price.trade", "Orçamento a combinar": "price.budget_tbd",
  "Sem bilhetes": "price.no_tickets", "Grátis": "price.free", "Sem avaliações": "rating.none"
};
/** Traduz um texto curto que veio do core em português (se não o conhecer, fica como está). */
export function coreText(s: string | undefined, t: TFn): string | undefined {
  if (!s) return s;
  const key = CORE_TEXT[s];
  if (key) return t(key);
  let m = /^até (.+)$/.exec(s); if (m) return t("price.up_to", { price: m[1] });
  m = /^a partir de (.+)$/.exec(s); if (m) return t("price.from", { price: m[1] });
  m = /^Desde (.+)$/.exec(s); if (m) return t("price.tickets_from", { price: m[1] });
  return s;
}

const angola = (ms: number) => new Date(ms + 3600000); // hora de Angola (UTC+1), formatada como UTC

/** «sáb., 18/10/2026, 20:00» / «Sat, 18 Oct 2026, 20:00» / «2026年10月18日周六 20:00» (hora de Angola). */
export function formatDateTimeIn(iso: string, lang: Lang): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  try {
    return new Intl.DateTimeFormat(LANG_TAGS[lang], { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(angola(ms));
  } catch { return formatEventDate(iso); }
}
/** Só o dia, na língua escolhida (hora de Angola). */
export function formatDayIn(ms: number, lang: Lang): string {
  try { return new Intl.DateTimeFormat(LANG_TAGS[lang], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(angola(ms)); }
  catch { return new Date(ms).toLocaleDateString(LANG_TAGS[lang]); }
}
/** «há 5 min», «3 h ago», «2 天前»… e, depois de uma semana, a data. */
export function timeAgoIn(iso: string | null | undefined, t: TFn, lang: Lang, now = Date.now()): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor((now - ms) / 60000);
  if (min < 1) return t("time.now");
  if (min < 60) return t("time.min", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("time.h", { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? t("time.day") : t("time.days", { n: d });
  return formatDayIn(ms, lang);
}
/** «📡 Sem internet — a mostrar o que foi guardado às 14:05.» na língua escolhida. */
export function offlineNoticeIn(savedAt: number | null, t: TFn, now = Date.now()): string {
  if (!savedAt) return t("offline.none");
  const d = angola(savedAt); const n = angola(now);
  const time = String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  const days = Math.round((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86400000);
  return days <= 0 ? t("offline.today", { time }) : days === 1 ? t("offline.yesterday", { time }) : t("offline.days", { n: days });
}
/** «3 anúncios · 2 lojas» na língua escolhida. */
export function marketSummaryIn(m: { listings?: number; products?: number; businesses?: number }, t: TFn): string {
  const parts: string[] = [];
  const add = (v: number | undefined, key: string) => { const n = Number(v) || 0; if (n > 0) parts.push(t(`market.${key}_${n === 1 ? "one" : "many"}`, { n })); };
  add(m.listings, "listings"); add(m.products, "products"); add(m.businesses, "shops");
  return parts.length ? parts.join(" · ") : t("market.empty");
}
/** «Poupou cerca de 1,2 MB (8 fotografias não carregadas).» na língua escolhida. */
export function savedTextIn(photos: number, t: TFn): string {
  if (photos <= 0) return "";
  const kb = photos * AVG_PHOTO_KB;
  const size = kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : kb + " KB";
  return photos === 1 ? t("data.saved_one", { size }) : t("data.saved_many", { size, n: photos });
}

/** Línguas do telemóvel (Android: I18nManager; iOS: SettingsManager; por fim, Intl). */
export function deviceLocales(): string[] {
  const out: string[] = [];
  try { const id = (I18nManager.getConstants() as { localeIdentifier?: string }).localeIdentifier; if (id) out.push(id); } catch { /* sem módulo nativo */ }
  try {
    const s = (NativeModules as any)?.SettingsManager?.settings;
    const ios = s?.AppleLanguages?.[0] ?? s?.AppleLocale;
    if (typeof ios === "string") out.push(ios);
  } catch { /* sem módulo nativo */ }
  try { const l = Intl.DateTimeFormat().resolvedOptions().locale; if (l) out.push(l); } catch { /* sem Intl */ }
  return out.map(x => x.replace(/_/g, "-"));
}
/** Primeira língua suportada da lista do telemóvel; se nenhuma for pt/en/zh, português. */
export function detectDeviceLang(locales = deviceLocales()): Lang {
  for (const l of locales) { const code = l.toLowerCase(); if (code.startsWith("pt") || code.startsWith("en") || code.startsWith("zh") || code.startsWith("fr")) return detectLang(l); }
  return DEFAULT_LANG;
}

/** tc(texto) traduz um texto que veio do core em português (etiquetas, estados, erros). */
type I18nState = { lang: Lang; t: TFn; tc: (s: string) => string; setLang: (l: Lang) => void };
const I18nContext = createContext<I18nState>({ lang: DEFAULT_LANG, t: makeT(DICT, DEFAULT_LANG), tc: (s: string) => s, setLang: () => {} });
/** { lang, t, setLang } — t("chave", { nome: "…" }) dá o texto na língua escolhida. */
export const useT = () => useContext(I18nContext);

/** Guarda a língua escolhida no telemóvel; na primeira vez segue a língua do telemóvel. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(LANG_STORAGE_KEY)
      .then(v => { if (alive) setLangState(isLang(v) ? v : detectDeviceLang()); })
      .catch(() => { if (alive) setLangState(detectDeviceLang()); });
    return () => { alive = false; };
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void AsyncStorage.setItem(LANG_STORAGE_KEY, l).catch(() => {});
  }, []);
  const value = useMemo(() => ({ lang, t: makeT(DICT, lang), tc: (s: string) => tc(s, lang), setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
