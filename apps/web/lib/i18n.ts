"use client";
/**
 * Várias línguas no Site: português (base), inglês e mandarim (chinês simplificado).
 * - WEB_DICT: textos só do Site, juntos com os textos comuns (COMMON_DICT) do @huambo-online/core.
 * - <I18nProvider> + useT(): { lang, t, setLang }.
 * - A língua escolhida fica no cookie «lang» (1 ano) e no localStorage. Na primeira visita usa a língua do navegador.
 * As páginas continuam estáticas: o servidor gera sempre em português e o navegador troca para a língua guardada.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  COMMON_DICT, LISTING_CHECKOUT_DICT, IMPORT_DICT, CHAT_GUARD_DICT, ITEM_INSPECTION_DICT, DEFAULT_LANG, LANG_COOKIE, LANG_STORAGE_KEY, LANG_TAGS, AVG_PHOTO_KB,
  detectLang, isLang, makeT, mergeDictionaries, tc, timeAgo, formatEventDate, savedText, type Dictionary, type Lang
} from "@huambo-online/core";
import { DICT_LISTINGS } from "./i18n/listings";
import { DICT_SHOP } from "./i18n/shop";
import { DICT_SERVICES } from "./i18n/services";
import { DICT_ADMIN } from "./i18n/admin";

export const WEB_DICT: Dictionary = {
  // Cabeçalho
  "hdr.or": { pt: "ou", en: "or", zh: "或", fr: "ou" },
  "hdr.welcome": { pt: "bem-vindo", en: "welcome", zh: "欢迎", fr: "bienvenue" },
  "hdr.hello_named": { pt: "Olá, {name}!", en: "Hello, {name}!", zh: "您好，{name}！", fr: "Bonjour, {name} !" },
  "hdr.logo_home": { pt: "Huambo Online — página inicial", en: "Huambo Online — home page", zh: "Huambo Online — 首页", fr: "Huambo Online — page d'accueil" },
  "hdr.where": { pt: "Onde pesquisar", en: "Where to search", zh: "搜索范围", fr: "Où rechercher" },
  "hdr.photo_search": { pt: "Pesquisar por fotografia", en: "Search by photo", zh: "以图搜索", fr: "Rechercher par photo" },
  "hdr.shortcuts": { pt: "Atalhos", en: "Shortcuts", zh: "快捷方式", fr: "Raccourcis" },
  "hdr.notif_unread": { pt: "Notificações ({n} por ler)", en: "Notifications ({n} unread)", zh: "通知（{n}条未读）", fr: "Notifications ({n} non lues)" },
  "hdr.msg_unread": { pt: "Mensagens ({n} por ler)", en: "Messages ({n} unread)", zh: "消息（{n}条未读）", fr: "Messages ({n} non lus)" },
  "hdr.cart_items": { pt: "Carrinho ({n} artigos)", en: "Cart ({n} items)", zh: "购物车（{n}件商品）", fr: "Panier ({n} articles)" },
  "scope.classificados": { pt: "Classificados", en: "Classifieds", zh: "分类信息", fr: "Petites annonces" },
  "scope.loja": { pt: "Loja", en: "Shop", zh: "商店", fr: "Boutique" },
  "scope.pracas": { pt: "Praças", en: "Markets", zh: "市场", fr: "Marchés" },
  "scope.profissionais": { pt: "Profissionais", en: "Professionals", zh: "专业人士", fr: "Professionnels" },
  "scope.empresas": { pt: "Empresas", en: "Businesses", zh: "企业", fr: "Entreprises" },
  "web.fuel": { pt: "Combustível", en: "Fuel", zh: "燃油", fr: "Carburant" },
  "web.videos": { pt: "Vídeos", en: "Videos", zh: "视频", fr: "Vidéos" },
  "web.events_tickets": { pt: "Eventos e bilhetes", en: "Events and tickets", zh: "活动与门票", fr: "Événements et billets" },
  "web.recent": { pt: "Vistos recentemente", en: "Recently viewed", zh: "最近浏览", fr: "Vus récemment" },
  "web.offline_banner": { pt: "📡 Está sem internet. Pode continuar a ver o que já abriu; as alterações só são enviadas quando a ligação voltar.", en: "📡 You're offline. You can keep viewing what you've already opened; changes are only sent when the connection is back.", zh: "📡 您当前没有网络。您可以继续查看已打开的内容；更改将在网络恢复后发送。", fr: "📡 Vous êtes hors ligne. Vous pouvez continuer à voir ce que vous avez déjà ouvert ; les modifications ne sont envoyées qu'au retour de la connexion." },

  // Rodapé
  "ft.buy": { pt: "Comprar", en: "Buy", zh: "购买", fr: "Acheter" },
  "ft.help_info": { pt: "Ajuda e informação", en: "Help and information", zh: "帮助与信息", fr: "Aide et informations" },
  "ft.wanted_requests": { pt: "Procura-se (pedidos)", en: "Wanted (requests)", zh: "求购（需求）", fr: "Recherches (demandes)" },
  "ft.post_wanted": { pt: "Publicar o que procuro", en: "Post what I'm looking for", zh: "发布我的需求", fr: "Publier ce que je cherche" },
  "ft.farming": { pt: "Agricultura e campo", en: "Agriculture and farming", zh: "农业与田园", fr: "Agriculture et élevage" },
  "ft.cart": { pt: "Carrinho", en: "Cart", zh: "购物车", fr: "Panier" },
  "ft.orders": { pt: "Encomendas", en: "Orders", zh: "订单", fr: "Commandes" },
  "ft.post_ad": { pt: "Publicar anúncio", en: "Post an ad", zh: "发布广告", fr: "Publier une annonce" },
  "ft.my_ads": { pt: "Os meus anúncios", en: "My ads", zh: "我的广告", fr: "Mes annonces" },
  "ft.sell_products": { pt: "Vender produtos", en: "Sell products", zh: "出售商品", fr: "Vendre des produits" },
  "ft.rentals": { pt: "Alugueres", en: "Rentals", zh: "租赁", fr: "Locations" },
  "ft.be_pro": { pt: "Ser profissional", en: "Become a professional", zh: "成为专业人士", fr: "Devenir professionnel" },
  "ft.be_courier": { pt: "Ser estafeta", en: "Become a courier", zh: "成为配送员", fr: "Devenir livreur" },
  "ft.be_agent": { pt: "Ser agente nas praças", en: "Become a market agent", zh: "成为市场代理", fr: "Devenir agent de marché" },
  "ft.organize_event": { pt: "Organizar um evento", en: "Organise an event", zh: "组织活动", fr: "Organiser un événement" },
  "ft.post_video": { pt: "Publicar vídeo ou live", en: "Post a video or live stream", zh: "发布视频或直播", fr: "Publier une vidéo ou un direct" },
  "ft.register_fuel": { pt: "Registar posto de combustível ou gás", en: "Register a fuel or gas station", zh: "登记加油站或燃气站", fr: "Enregistrer une station de carburant ou de gaz" },
  "ft.register_venue": { pt: "Registar hotel, restaurante ou armazém", en: "Register a hotel, restaurant or warehouse", zh: "登记酒店、餐厅或仓库", fr: "Enregistrer un hôtel, un restaurant ou un entrepôt" },
  "ft.invite": { pt: "Convide um amigo", en: "Invite a friend", zh: "邀请好友", fr: "Inviter un ami" },
  "ft.my_bids": { pt: "As minhas licitações", en: "My bids", zh: "我的出价", fr: "Mes enchères" },
  "ft.saved_searches": { pt: "Pesquisas guardadas", en: "Saved searches", zh: "已保存的搜索", fr: "Recherches enregistrées" },
  "ft.local": { pt: "📍 No Huambo", en: "📍 In Huambo", zh: "📍 在万博", fr: "📍 Au Huambo" },
  "ft.about": { pt: "Sobre o Huambo Online", en: "About Huambo Online", zh: "关于 Huambo Online", fr: "À propos de Huambo Online" },
  "ft.all_municipalities": { pt: "Todos os municípios", en: "All municipalities", zh: "所有市", fr: "Toutes les communes" },
  "ft.houses_sale": { pt: "Casas à venda no Huambo", en: "Houses for sale in Huambo", zh: "万博房屋出售", fr: "Maisons à vendre au Huambo" },
  "ft.houses_rent": { pt: "Casas para arrendar no Huambo", en: "Houses for rent in Huambo", zh: "万博房屋出租", fr: "Maisons à louer au Huambo" },
  "ft.land_sale": { pt: "Terrenos à venda no Huambo", en: "Land for sale in Huambo", zh: "万博土地出售", fr: "Terrains à vendre au Huambo" },
  "ft.cars_sale": { pt: "Carros à venda no Huambo", en: "Cars for sale in Huambo", zh: "万博汽车出售", fr: "Voitures à vendre au Huambo" },
  "ft.jobs_local": { pt: "Emprego no Huambo", en: "Jobs in Huambo", zh: "万博招聘", fr: "Emploi au Huambo" },
  "home.by_municipality": { pt: "📍 Anúncios por município", en: "📍 Listings by municipality", zh: "📍 按市浏览广告", fr: "📍 Annonces par commune" },
  "home.by_municipality_text": { pt: "Casas, terrenos, carros e emprego em cada município da província do Huambo.", en: "Houses, land, cars and jobs in every municipality of Huambo province.", zh: "万博省各市的房屋、土地、汽车和工作。", fr: "Maisons, terrains, voitures et emplois dans chaque commune de la province du Huambo." },
  "ft.tagline": { pt: "Comércio, serviços e negócios do Huambo.", en: "Trade, services and business in Huambo.", zh: "万博的商贸、服务与企业。", fr: "Commerce, services et affaires au Huambo." },
  "info./seguranca": { pt: "Segurança e burlas", en: "Safety and scams", zh: "安全与防骗", fr: "Sécurité et arnaques" },
  "info./devolucoes": { pt: "Devoluções e reembolsos", en: "Returns and refunds", zh: "退货与退款", fr: "Retours et remboursements" },
  "info./apagar-conta": { pt: "Como apagar a conta", en: "How to delete your account", zh: "如何删除账户", fr: "Comment supprimer votre compte" },

  // Aparência e Poupar dados
  "theme.system": { pt: "🌓 Automático", en: "🌓 Automatic", zh: "🌓 自动", fr: "🌓 Automatique" },
  "theme.light": { pt: "☀️ Claro", en: "☀️ Light", zh: "☀️ 浅色", fr: "☀️ Clair" },
  "theme.dark": { pt: "🌙 Escuro", en: "🌙 Dark", zh: "🌙 深色", fr: "🌙 Sombre" },
  "theme.to_light": { pt: "Mudar para o modo claro", en: "Switch to light mode", zh: "切换到浅色模式", fr: "Passer en mode clair" },
  "theme.to_dark": { pt: "Mudar para o modo escuro", en: "Switch to dark mode", zh: "切换到深色模式", fr: "Passer en mode sombre" },
  "theme.light_short": { pt: "Claro", en: "Light", zh: "浅色", fr: "Clair" },
  "theme.dark_short": { pt: "Escuro", en: "Dark", zh: "深色", fr: "Sombre" },
  "ds.auto": { pt: "Automático", en: "Automatic", zh: "自动", fr: "Automatique" },
  "ds.on": { pt: "📉 Ligado", en: "📉 On", zh: "📉 开启", fr: "📉 Activé" },
  "ds.off": { pt: "Desligado", en: "Off", zh: "关闭", fr: "Désactivé" },
  "ds.turn_off": { pt: "Desligar Poupar dados", en: "Turn off Data saver", zh: "关闭节省流量", fr: "Désactiver l'économie de données" },
  "ds.turn_on": { pt: "Ligar Poupar dados (não carrega as fotografias das listas)", en: "Turn on Data saver (photos in lists won't load)", zh: "开启节省流量（列表中的照片不加载）", fr: "Activer l'économie de données (les photos des listes ne se chargent pas)" },
  "ds.saving": { pt: "A poupar dados", en: "Saving data", zh: "正在节省流量", fr: "Économie de données" },
  "ds.desc_on": { pt: "Ligado: as fotografias das listas não carregam; na página do artigo, toque para as ver. Os vídeos só carregam quando carrega em ▶.", en: "On: photos in lists don't load; on an item's page, tap to see them. Videos only load when you press ▶.", zh: "已开启：列表中的照片不加载；在商品页面点击即可查看。视频只在点击 ▶ 时加载。", fr: "Activé : les photos des listes ne se chargent pas ; sur la page d'un article, touchez pour les voir. Les vidéos ne se chargent que lorsque vous appuyez sur ▶." },
  "ds.desc_auto": { pt: "Automático: liga sozinho quando o telemóvel ou o navegador está em poupança de dados.", en: "Automatic: turns on by itself when your phone or browser is in data saving mode.", zh: "自动：当手机或浏览器处于省流模式时自动开启。", fr: "Automatique : s'active tout seul quand votre téléphone ou votre navigateur est en mode économie de données." },
  "ds.desc_off": { pt: "Desligado: as fotografias carregam normalmente.", en: "Off: photos load normally.", zh: "已关闭：照片正常加载。", fr: "Désactivé : les photos se chargent normalement." },
  "ds.saved_one": { pt: "Poupou cerca de {size} (1 fotografia não carregada).", en: "You saved about {size} (1 photo not loaded).", zh: "已节省约 {size}（1张照片未加载）。", fr: "Vous avez économisé environ {size} (1 photo non chargée)." },
  "ds.saved_many": { pt: "Poupou cerca de {size} ({n} fotografias não carregadas).", en: "You saved about {size} ({n} photos not loaded).", zh: "已节省约 {size}（{n}张照片未加载）。", fr: "Vous avez économisé environ {size} ({n} photos non chargées)." },

  // Página inicial
  "home.hero_title": { pt: "Compre, venda e encontre tudo no Huambo.", en: "Buy, sell and find everything in Huambo.", zh: "在万博买卖、寻找一切。", fr: "Achetez, vendez et trouvez de tout au Huambo." },
  "home.hero_text": { pt: "Classificados, loja, leilões, profissionais e empresas — num único lugar, com entrega ao domicílio.", en: "Classifieds, shop, auctions, professionals and businesses — all in one place, with home delivery.", zh: "分类信息、商店、拍卖、专业人士和企业——尽在一处，送货上门。", fr: "Petites annonces, boutique, enchères, professionnels et entreprises — tout au même endroit, avec livraison à domicile." },
  "home.start_buying": { pt: "Começar a comprar", en: "Start shopping", zh: "开始购物", fr: "Commencer mes achats" },
  "home.sell_now": { pt: "Vender agora", en: "Sell now", zh: "立即出售", fr: "Vendre maintenant" },
  "home.explore_cats": { pt: "Explore as categorias", en: "Explore the categories", zh: "浏览分类", fr: "Explorer les catégories" },
  "home.popular_cats": { pt: "Categorias populares", en: "Popular categories", zh: "热门分类", fr: "Catégories populaires" },
  "home.loading": { pt: "A carregar novidades…", en: "Loading what's new…", zh: "正在加载最新内容…", fr: "Chargement des nouveautés…" },
  "home.videos": { pt: "Vídeos e lives", en: "Videos and live streams", zh: "视频与直播", fr: "Vidéos et directs" },
  "home.auctions": { pt: "Leilões a decorrer", en: "Ongoing auctions", zh: "进行中的拍卖", fr: "Enchères en cours" },
  "home.markets": { pt: "Praças do Huambo", en: "Huambo markets", zh: "万博市场", fr: "Marchés du Huambo" },
  "home.for_you": { pt: "Recomendados para si", en: "Recommended for you", zh: "为您推荐", fr: "Recommandés pour vous" },
  "home.new_listings": { pt: "Novidades nos classificados", en: "New in classifieds", zh: "分类信息新品", fr: "Nouveautés dans les petites annonces" },
  "home.wanted_title": { pt: "Procura-se — compradores à procura", en: "Wanted — buyers looking for items", zh: "求购——买家正在寻找", fr: "Recherches — acheteurs à la recherche d'articles" },
  "home.wanted_badge": { pt: "PROCURA-SE", en: "WANTED", zh: "求购", fr: "RECHERCHE" },
  "home.budget": { pt: "Orçamento:", en: "Budget:", zh: "预算：", fr: "Budget :" },
  "home.sell_title": { pt: "Tem algo para vender?", en: "Have something to sell?", zh: "有东西要出售吗？", fr: "Vous avez quelque chose à vendre ?" },
  "home.sell_text": { pt: "Publique grátis com fotografias e receba mensagens de compradores do Huambo.", en: "Post for free with photos and get messages from buyers in Huambo.", zh: "免费发布带照片的广告，接收万博买家的消息。", fr: "Publiez gratuitement avec des photos et recevez des messages d'acheteurs du Huambo." },
  "home.in_shop": { pt: "Na loja", en: "In the shop", zh: "商店好物", fr: "Dans la boutique" },
  "home.sold_out": { pt: "Esgotado", en: "Sold out", zh: "售罄", fr: "Complet" },
  "home.for_rent": { pt: "Para arrendar", en: "For rent", zh: "出租", fr: "À louer" },
  "home.trusted_pros": { pt: "Profissionais de confiança", en: "Trusted professionals", zh: "值得信赖的专业人士", fr: "Professionnels de confiance" },
  "home.first_title": { pt: "Seja o primeiro a anunciar!", en: "Be the first to post an ad!", zh: "成为第一个发布广告的人！", fr: "Soyez le premier à publier une annonce !" },
  "home.first_text": { pt: "Ainda há poucos artigos. Publique o seu e ajude o Huambo Online a crescer.", en: "There are only a few items so far. Post yours and help Huambo Online grow.", zh: "目前商品还不多。发布您的商品，帮助 Huambo Online 成长。", fr: "Il y a encore peu d'articles. Publiez le vôtre et aidez Huambo Online à grandir." },
  "home.pro_title": { pt: "Profissional, empresa, estafeta ou agente?", en: "Professional, business, courier or agent?", zh: "专业人士、企业、配送员还是代理？", fr: "Professionnel, entreprise, livreur ou agent ?" },
  "home.pro_text": { pt: "Crie o seu perfil e receba clientes de todo o Huambo. Agentes ajudam quem não tem telemóvel ou não sabe usar a internet a vender, trocar ou leiloar — e ganham comissão em cada venda.", en: "Create your profile and get customers from all over Huambo. Agents help people who don't have a phone or don't know how to use the internet to sell, swap or auction — and earn a commission on every sale.", zh: "创建您的资料，接待来自万博各地的客户。代理帮助没有手机或不会上网的人出售、交换或拍卖——每笔成交都能赚取佣金。", fr: "Créez votre profil et recevez des clients de tout le Huambo. Les agents aident les personnes qui n'ont pas de téléphone ou ne savent pas utiliser internet à vendre, échanger ou mettre aux enchères — et touchent une commission sur chaque vente." },
  "home.i_am_pro": { pt: "Sou profissional", en: "I'm a professional", zh: "我是专业人士", fr: "Je suis professionnel" },
  "home.have_business": { pt: "Tenho uma empresa", en: "I have a business", zh: "我有企业", fr: "J'ai une entreprise" },
  "home.want_courier": { pt: "Quero ser estafeta", en: "I want to be a courier", zh: "我想成为配送员", fr: "Je veux être livreur" },
  "home.want_agent": { pt: "Quero ser um agente", en: "I want to be an agent", zh: "我想成为代理", fr: "Je veux être agent" },
  "purpose.sale": { pt: "Venda", en: "Sale", zh: "出售", fr: "Vente" },
  "purpose.rent": { pt: "Arrendamento", en: "Rental", zh: "出租", fr: "Location" },
  "purpose.lease": { pt: "Aluguer", en: "Hire", zh: "租用", fr: "Location" },
  "purpose.wanted": { pt: "Procuro", en: "Wanted", zh: "求购", fr: "Recherche" },
  "purpose.service": { pt: "Serviço", en: "Service", zh: "服务", fr: "Service" },
  "purpose.auction": { pt: "Leilão", en: "Auction", zh: "拍卖", fr: "Enchère" },
  "mk.listings_one": { pt: "{n} anúncio", en: "{n} listing", zh: "{n}条广告", fr: "{n} annonce" },
  "mk.listings_many": { pt: "{n} anúncios", en: "{n} listings", zh: "{n}条广告", fr: "{n} annonces" },
  "mk.products_one": { pt: "{n} produto", en: "{n} product", zh: "{n}件商品", fr: "{n} produit" },
  "mk.products_many": { pt: "{n} produtos", en: "{n} products", zh: "{n}件商品", fr: "{n} produits" },
  "mk.shops_one": { pt: "{n} loja", en: "{n} shop", zh: "{n}家店铺", fr: "{n} boutique" },
  "mk.shops_many": { pt: "{n} lojas", en: "{n} shops", zh: "{n}家店铺", fr: "{n} boutiques" },
  "mk.empty": { pt: "Ainda sem vendedores no Huambo Online", en: "No sellers on Huambo Online yet", zh: "Huambo Online 上暂无卖家", fr: "Pas encore de vendeurs sur Huambo Online" },
  "promo.video": { pt: "Vídeo", en: "Video", zh: "视频", fr: "Vidéo" },
  "promo.live_badge": { pt: "EM DIRETO", en: "LIVE", zh: "直播中", fr: "EN DIRECT" },
  "promo.ended": { pt: "Terminada", en: "Ended", zh: "已结束", fr: "Terminée" },
  "promo.live_now": { pt: "Em direto agora", en: "Live now", zh: "正在直播", fr: "En direct maintenant" },
  "promo.live_ended": { pt: "Live terminada", en: "Live stream ended", zh: "直播已结束", fr: "Direct terminé" },
  "promo.views_one": { pt: "1 visualização", en: "1 view", zh: "1次观看", fr: "1 vue" },
  "promo.views_many": { pt: "{n} visualizações", en: "{n} views", zh: "{n}次观看", fr: "{n} vues" },
  "rating.none": { pt: "Sem avaliações", en: "No reviews yet", zh: "暂无评价", fr: "Pas encore d'évaluations" },

  // Entrar
  "login.step2_title": { pt: "Entrar — segundo passo", en: "Sign in — second step", zh: "登录——第二步", fr: "Connexion — deuxième étape" },
  "login.step2_text": { pt: "A sua conta está protegida com a entrada em dois passos.", en: "Your account is protected with two-step sign-in.", zh: "您的账户已启用两步登录保护。", fr: "Votre compte est protégé par une connexion en deux étapes." },
  "login.recover_title": { pt: "Recuperar palavra-passe", en: "Recover password", zh: "找回密码", fr: "Récupérer le mot de passe" },
  "login.wait": { pt: "Aguarde…", en: "Please wait…", zh: "请稍候…", fr: "Veuillez patienter…" },
  "login.send_link": { pt: "Enviar link de recuperação", en: "Send recovery link", zh: "发送找回链接", fr: "Envoyer le lien de récupération" },
  "login.back_to_login": { pt: "← Voltar a entrar", en: "← Back to sign in", zh: "← 返回登录", fr: "← Retour à la connexion" },
  "login.create": { pt: "Criar uma conta", en: "Create an account", zh: "创建账户", fr: "Créer un compte" },
  "login.reset_sent": { pt: "Se o email existir, enviámos um link para definir uma nova palavra-passe.", en: "If that email exists, we've sent a link to set a new password.", zh: "如果该邮箱存在，我们已发送设置新密码的链接。", fr: "Si cet e-mail existe, nous avons envoyé un lien pour définir un nouveau mot de passe." },
  "mfa.intro": { pt: "Abra a APP autenticadora (Google Authenticator, Microsoft Authenticator ou Authy) e escreva os 6 algarismos que aparecem para o Huambo Online.", en: "Open your authenticator app (Google Authenticator, Microsoft Authenticator or Authy) and enter the 6 digits shown for Huambo Online.", zh: "打开身份验证器应用（Google Authenticator、Microsoft Authenticator 或 Authy），输入 Huambo Online 显示的6位数字。", fr: "Ouvrez votre application d'authentification (Google Authenticator, Microsoft Authenticator ou Authy) et indiquez les 6 chiffres affichés pour Huambo Online." },
  "mfa.confirming": { pt: "A confirmar…", en: "Confirming…", zh: "正在确认…", fr: "Confirmation…" },
  "mfa.confirm_you": { pt: "Confirmar que é você", en: "Confirm it's you", zh: "确认是您本人", fr: "Confirmez que c'est vous" },

  // Criar conta
  "signup.intro": { pt: "Uma conta para descobrir, comprar, vender e prestar serviços.", en: "One account to discover, buy, sell and offer services.", zh: "一个账户即可发现、购买、出售和提供服务。", fr: "Un seul compte pour découvrir, acheter, vendre et proposer des services." },
  "signup.phone_opt": { pt: "Telefone (opcional)", en: "Phone (optional)", zh: "电话（选填）", fr: "Téléphone (facultatif)" },
  "signup.muni_opt": { pt: "Município (opcional)", en: "Municipality (optional)", zh: "市镇（选填）", fr: "Municipalité (facultatif)" },
  "signup.muni_ph": { pt: "Ex.: Huambo, Caála…", en: "E.g. Huambo, Caála…", zh: "例如：Huambo、Caála…", fr: "Ex. : Huambo, Caála…" },
  "signup.invite": { pt: "Código de convite (opcional)", en: "Invite code (optional)", zh: "邀请码（选填）", fr: "Code d'invitation (facultatif)" },
  "signup.invite_ph": { pt: "Ex.: K7M2QX", en: "E.g. K7M2QX", zh: "例如：K7M2QX", fr: "Ex. : K7M2QX" },
  "signup.have": { pt: "Já tenho conta", en: "I already have an account", zh: "我已有账户", fr: "J'ai déjà un compte" },
  "signup.not_configured": { pt: "Serviço de autenticação não configurado. Tente mais tarde.", en: "The sign-in service isn't set up. Please try again later.", zh: "登录服务尚未配置，请稍后再试。", fr: "Le service de connexion n'est pas configuré. Réessayez plus tard." },
  "signup.bad_email": { pt: "Email inválido.", en: "Invalid email.", zh: "邮箱无效。", fr: "E-mail invalide." },
  "signup.invite_shape": { pt: "O código de convite tem 6 letras e números (ex.: K7M2QX).", en: "The invite code has 6 letters and numbers (e.g. K7M2QX).", zh: "邀请码由6位字母和数字组成（例如：K7M2QX）。", fr: "Le code d'invitation a 6 lettres et chiffres (ex. : K7M2QX)." },
  "signup.exists": { pt: "Já existe uma conta com este email. Use «Entrar».", en: "An account with this email already exists. Use “Sign in”.", zh: "该邮箱已注册账户，请使用“登录”。", fr: "Un compte existe déjà avec cet e-mail. Utilisez «Se connecter»." },
  "signup.created_in": { pt: "Conta criada com sucesso. A entrar…", en: "Account created. Signing you in…", zh: "账户创建成功，正在登录…", fr: "Compte créé. Connexion en cours…" },
  "signup.created_confirm": { pt: "Conta criada. Abra o email que enviámos e clique no link para confirmar a conta. Depois pode entrar.", en: "Account created. Open the email we sent and click the link to confirm your account. Then you can sign in.", zh: "账户已创建。请打开我们发送的邮件并点击链接确认账户，然后即可登录。", fr: "Compte créé. Ouvrez l'e-mail que nous avons envoyé et cliquez sur le lien pour confirmer votre compte. Vous pourrez ensuite vous connecter." },

  // Recuperar acesso
  "recover.title": { pt: "Recuperar acesso", en: "Recover access", zh: "恢复访问", fr: "Récupérer l'accès" },
  "recover.intro": { pt: "Defina uma nova palavra-passe para a sua conta.", en: "Set a new password for your account.", zh: "为您的账户设置新密码。", fr: "Définissez un nouveau mot de passe pour votre compte." },
  "recover.new_pw": { pt: "Nova palavra-passe", en: "New password", zh: "新密码", fr: "Nouveau mot de passe" },
  "recover.saving": { pt: "A guardar…", en: "Saving…", zh: "正在保存…", fr: "Enregistrement…" },
  "recover.submit": { pt: "Definir nova palavra-passe", en: "Set new password", zh: "设置新密码", fr: "Définir le nouveau mot de passe" },
  "recover.too_short": { pt: "A palavra-passe deve ter pelo menos 8 caracteres.", en: "The password must be at least 8 characters long.", zh: "密码至少需要8个字符。", fr: "Le mot de passe doit contenir au moins 8 caractères." },
  "recover.mismatch": { pt: "As palavras-passe não coincidem.", en: "The passwords don't match.", zh: "两次输入的密码不一致。", fr: "Les mots de passe ne correspondent pas." },
  "recover.done": { pt: "Palavra-passe atualizada. Pode iniciar sessão novamente.", en: "Password updated. You can sign in again.", zh: "密码已更新，您可以重新登录。", fr: "Mot de passe mis à jour. Vous pouvez vous reconnecter." },

  // A sua conta
  "acct.yours": { pt: "A sua conta", en: "Your account", zh: "您的账户", fr: "Votre compte" },
  "acct.sign_in_to_manage": { pt: "Inicie sessão para gerir a sua conta.", en: "Sign in to manage your account.", zh: "请登录以管理您的账户。", fr: "Connectez-vous pour gérer votre compte." },
  "acct.photo": { pt: "Fotografia de perfil", en: "Profile photo", zh: "头像", fr: "Photo de profil" },
  "acct.pick_image": { pt: "Escolha uma imagem.", en: "Choose an image.", zh: "请选择一张图片。", fr: "Choisissez une image." },
  "acct.image_2mb": { pt: "Escolha uma imagem até 2 MB.", en: "Choose an image of up to 2 MB.", zh: "请选择不超过 2 MB 的图片。", fr: "Choisissez une image de 2 Mo maximum." },
  "acct.photo_updated": { pt: "Fotografia atualizada.", en: "Photo updated.", zh: "头像已更新。", fr: "Photo mise à jour." },
  "acct.signed_in_as": { pt: "Sessão iniciada como {email}", en: "Signed in as {email}", zh: "当前登录：{email}", fr: "Connecté en tant que {email}" },
  "acct.l.professional": { pt: "Perfil profissional", en: "Professional profile", zh: "专业资料", fr: "Profil professionnel" },
  "acct.l.businesses": { pt: "As minhas empresas", en: "My businesses", zh: "我的企业", fr: "Mes entreprises" },
  "acct.l.plan": { pt: "O meu plano", en: "My plan", zh: "我的套餐", fr: "Mon forfait" },
  "acct.l.commissions": { pt: "Comissões", en: "Commissions", zh: "佣金", fr: "Commissions" },
  "acct.l.balance": { pt: "O meu saldo", en: "My balance", zh: "我的余额", fr: "Mon solde" },
  "acct.l.stats": { pt: "Estatísticas", en: "Statistics", zh: "统计", fr: "Statistiques" },
  "acct.l.agent": { pt: "Ser agente", en: "Become an agent", zh: "成为代理", fr: "Devenir agent" },
  "acct.l.invite": { pt: "Convidar amigos", en: "Invite friends", zh: "邀请好友", fr: "Inviter des amis" },
  "acct.l.tickets": { pt: "Os meus bilhetes", en: "My tickets", zh: "我的门票", fr: "Mes billets" },
  "acct.l.events": { pt: "Os meus eventos", en: "My events", zh: "我的活动", fr: "Mes événements" },
  "acct.l.videos": { pt: "Vídeos e lives", en: "Videos and live streams", zh: "视频与直播", fr: "Vidéos et directs" },
  "acct.l.fuel_orders": { pt: "Reservas de combustível", en: "Fuel reservations", zh: "燃油预订", fr: "Réservations de carburant" },
  "acct.l.stations": { pt: "Os meus postos", en: "My stations", zh: "我的加油站", fr: "Mes stations" },
  "acct.l.products": { pt: "Os meus produtos", en: "My products", zh: "我的商品", fr: "Mes produits" },
  "acct.l.services": { pt: "Pedidos de serviço", en: "Service requests", zh: "服务请求", fr: "Demandes de service" },
  "acct.l.offers": { pt: "As minhas propostas", en: "My offers", zh: "我的报价", fr: "Mes offres" },
  "acct.l.reviews": { pt: "Avaliações", en: "Reviews", zh: "评价", fr: "Évaluations" },
  "acct.l.verify": { pt: "Verificar perfil", en: "Verify profile", zh: "验证资料", fr: "Vérifier le profil" },
  "acct.l.inspected": { pt: "Selo «Inspecionado»", en: "“Inspected” badge", zh: "“已检验”标识", fr: "Badge «Inspecté»" },
  "acct.l.safety": { pt: "Segurança", en: "Safety", zh: "安全须知", fr: "Sécurité" },
  "acct.l.deliveries": { pt: "Ser estafeta / Entregas", en: "Become a courier / Deliveries", zh: "成为配送员 / 配送", fr: "Devenir livreur / Livraisons" },
  "acct.l.following": { pt: "A seguir", en: "Following", zh: "关注", fr: "Abonnements" },
  "acct.profile_updated": { pt: "Perfil atualizado.", en: "Profile updated.", zh: "资料已更新。", fr: "Profil mis à jour." },
  "acct.personal": { pt: "Dados pessoais", en: "Personal details", zh: "个人信息", fr: "Données personnelles" },
  "acct.name": { pt: "Nome", en: "Name", zh: "姓名", fr: "Nom" },
  "acct.save_changes": { pt: "Guardar alterações", en: "Save changes", zh: "保存更改", fr: "Enregistrer les modifications" },
  "acct.pw_changed": { pt: "Palavra-passe alterada com sucesso.", en: "Password changed successfully.", zh: "密码修改成功。", fr: "Mot de passe modifié avec succès." },
  "acct.security": { pt: "Segurança", en: "Security", zh: "账户安全", fr: "Sécurité" },
  "acct.change_pw": { pt: "Alterar palavra-passe", en: "Change password", zh: "修改密码", fr: "Changer le mot de passe" },
  "acct.twostep": { pt: "Entrar em dois passos", en: "Two-step sign-in", zh: "两步登录", fr: "Connexion en deux étapes" },
  "acct.twostep_text": { pt: "Mais proteção: além da palavra-passe, pedimos um código da APP autenticadora do seu telemóvel (Google Authenticator, Microsoft Authenticator ou Authy).", en: "Extra protection: besides your password, we ask for a code from the authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy).", zh: "更多保护：除密码外，我们还会要求输入您手机上身份验证器应用（Google Authenticator、Microsoft Authenticator 或 Authy）中的代码。", fr: "Protection supplémentaire : en plus du mot de passe, nous demandons un code de l'application d'authentification de votre téléphone (Google Authenticator, Microsoft Authenticator ou Authy)." },
  "acct.recommended_admin": { pt: " Recomendado para administradores.", en: " Recommended for administrators.", zh: "建议管理员启用。", fr: " Recommandé pour les administrateurs." },
  "acct.appearance_text": { pt: "Escolha o modo claro, escuro, ou automático (segue o seu telemóvel ou computador).", en: "Choose light, dark or automatic mode (follows your phone or computer).", zh: "选择浅色、深色或自动模式（跟随您的手机或电脑）。", fr: "Choisissez le mode clair, sombre ou automatique (suit votre téléphone ou ordinateur)." },
  "acct.datasaver_text": { pt: "Gaste menos saldo: as fotografias das listas não carregam e, nos anúncios, só carregam quando tocar.", en: "Use less mobile data: photos in lists don't load and, in ads, they only load when you tap.", zh: "节省流量费用：列表中的照片不加载，广告中的照片只在点击时加载。", fr: "Consommez moins de données mobiles : les photos des listes ne se chargent pas et, dans les annonces, elles ne se chargent que lorsque vous touchez." },
  "acct.language_text": { pt: "Escolha a língua do site. Fica guardada neste aparelho.", en: "Choose the language of the site. It is saved on this device.", zh: "选择网站语言，设置将保存在此设备上。", fr: "Choisissez la langue du site. Elle est enregistrée sur cet appareil." },
  "acct.deleted": { pt: "Conta eliminada.", en: "Account deleted.", zh: "账户已删除。", fr: "Compte supprimé." },
  "acct.privacy": { pt: "Privacidade", en: "Privacy", zh: "隐私", fr: "Confidentialité" },
  "acct.delete_text": { pt: "Eliminar a conta remove permanentemente os seus dados.", en: "Deleting your account permanently removes your data.", zh: "删除账户将永久清除您的数据。", fr: "Supprimer votre compte efface définitivement vos données." },
  "acct.type_delete": { pt: "Escreva ELIMINAR para confirmar", en: "Type ELIMINAR to confirm", zh: "输入 ELIMINAR 以确认", fr: "Tapez ELIMINAR pour confirmer" },
  "acct.delete_btn": { pt: "Eliminar a minha conta", en: "Delete my account", zh: "删除我的账户", fr: "Supprimer mon compte" },
  "acct.logout": { pt: "Terminar sessão", en: "Sign out", zh: "退出登录", fr: "Se déconnecter" },
  "wa.deleted": { pt: "Número de WhatsApp apagado.", en: "WhatsApp number deleted.", zh: "WhatsApp 号码已删除。", fr: "Numéro WhatsApp supprimé." },
  "wa.saved_visible": { pt: "Guardado. Só a equipa do Huambo Online vê o seu número.", en: "Saved. Only the Huambo Online team can see your number.", zh: "已保存。只有 Huambo Online 团队能看到您的号码。", fr: "Enregistré. Seule l'équipe de Huambo Online peut voir votre numéro." },
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
  "wa.note": { pt: "Pode apagar o número quando quiser.", en: "You can delete the number at any time.", zh: "您可以随时删除该号码。", fr: "Vous pouvez supprimer le numéro à tout moment." },
  "wa.save": { pt: "Guardar WhatsApp", en: "Save WhatsApp", zh: "保存 WhatsApp", fr: "Enregistrer le WhatsApp" },

  // Página não encontrada
  "nf.title": { pt: "Página não encontrada", en: "Page not found", zh: "页面未找到", fr: "Page introuvable" },
  "nf.text": { pt: "O endereço pode estar errado, ou a página foi retirada. Se acabou de ser publicada, espere um minuto e tente de novo.", en: "The address may be wrong, or the page has been removed. If it was just published, wait a minute and try again.", zh: "地址可能有误，或页面已被移除。如果刚刚发布，请稍等一分钟后重试。", fr: "L'adresse est peut-être incorrecte ou la page a été supprimée. Si elle vient d'être publiée, attendez une minute et réessayez." },
  "nf.home": { pt: "Ir para o início", en: "Go to the home page", zh: "返回首页", fr: "Aller à l'accueil" },
  "nf.listings": { pt: "Ver anúncios", en: "See listings", zh: "查看广告", fr: "Voir les annonces" }
};

/** Todos os textos do Site (comuns + só do Site). */
export const DICT: Dictionary = mergeDictionaries(COMMON_DICT, LISTING_CHECKOUT_DICT, IMPORT_DICT, CHAT_GUARD_DICT, ITEM_INSPECTION_DICT, WEB_DICT, DICT_LISTINGS, DICT_SHOP, DICT_SERVICES, DICT_ADMIN);

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

// --- Língua guardada (cookie + localStorage) --------------------------------------------------
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + LANG_COOKIE + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}
/** Cookie → localStorage → língua do navegador (português por omissão). */
export function readStoredLang(): Lang {
  const c = readCookie(); if (isLang(c)) return c;
  try { const s = localStorage.getItem(LANG_STORAGE_KEY); if (isLang(s)) return s; } catch { /* sem armazenamento */ }
  // Robôs de pesquisa (Google, Bing…) veem sempre o português: é a língua oficial do Site.
  try { if (BOT_UA.test(navigator.userAgent)) return DEFAULT_LANG; } catch { /* sem navigator */ }
  try { return detectLang(navigator.languages?.length ? navigator.languages : navigator.language); } catch { return DEFAULT_LANG; }
}
/** Robôs de pesquisa e de pré-visualização de ligações. */
export const BOT_UA = /bot|crawl|spider|slurp|google-inspectiontool|lighthouse|facebookexternalhit|whatsapp|bingpreview/i;

let current: Lang | null = null;
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === LANG_STORAGE_KEY) { current = readStoredLang(); fn(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}
function getSnapshot(): Lang { if (current === null) current = readStoredLang(); return current; }

/** Guarda a língua (cookie de 1 ano + localStorage) e atualiza todas as partes da página. */
export function saveLang(lang: Lang) {
  current = lang;
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANG_COOKIE}=${lang}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
  } catch { /* */ }
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* sem armazenamento */ }
  try { document.documentElement.lang = LANG_TAGS[lang]; } catch { /* */ }
  listeners.forEach(fn => fn());
}

// --- Contexto React ---------------------------------------------------------------------------
/** tc(texto) traduz um texto que veio do core em português (etiquetas, estados, erros). */
type I18nValue = { lang: Lang; t: TFunction; tc: (s: string) => string; setLang: (l: Lang) => void };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initialLang = DEFAULT_LANG }: { children: ReactNode; initialLang?: Lang }) {
  // No servidor e na hidratação usa «initialLang» (português); logo a seguir passa para a língua guardada.
  const lang = useSyncExternalStore(subscribe, getSnapshot, () => initialLang);
  useEffect(() => { document.documentElement.lang = LANG_TAGS[lang]; }, [lang]);
  const value = useMemo<I18nValue>(() => ({ lang, t: makeT(DICT, lang), tc: (s: string) => tc(s, lang), setLang: saveLang }), [lang]);
  return createElement(I18nContext.Provider, { value }, children);
}

const FALLBACK: I18nValue = { lang: DEFAULT_LANG, t: makeT(DICT, DEFAULT_LANG), tc: (s: string) => s, setLang: saveLang };
/** { lang, t, setLang } — t("chave", { n: 3 }). */
export function useT(): I18nValue { return useContext(I18nContext) ?? FALLBACK; }

// --- Datas e números na língua escolhida ------------------------------------------------------
/** Data curta (ex.: 16/10/2026 · 10/16/2026 · 2026/10/16). */
export function formatDateIn(value: string | number | Date, lang: Lang): string {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(LANG_TAGS[lang], { timeZone: "Africa/Luanda" }) : "";
}
/** «há 5 min» / «5 min ago» / «5分钟前». */
export function timeAgoIn(iso: string | null | undefined, lang: Lang, now = Date.now()): string {
  if (lang === "pt") return timeAgo(iso, now);
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const rtf = new Intl.RelativeTimeFormat(LANG_TAGS[lang], { numeric: "auto", style: "short" });
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return rtf.format(0, "second");
  if (min < 60) return rtf.format(-min, "minute");
  const h = Math.floor(min / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const days = Math.floor(h / 24);
  if (days < 7) return rtf.format(-days, "day");
  return formatDateIn(t, lang);
}
/** Data e hora de um evento (hora de Angola). */
export function eventDateIn(iso: string, lang: Lang): string {
  if (lang === "pt") return formatEventDate(iso);
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(LANG_TAGS[lang], { timeZone: "Africa/Luanda", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}
/** «Poupou cerca de 1,5 MB (10 fotografias não carregadas).» na língua escolhida. */
export function savedTextIn(photos: number, lang: Lang, t: TFunction): string {
  if (lang === "pt") return savedText(photos);
  if (photos <= 0) return "";
  const kb = photos * AVG_PHOTO_KB;
  const size = kb >= 1024 ? (kb / 1024).toLocaleString(LANG_TAGS[lang], { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " MB" : kb + " KB";
  return t(photos === 1 ? "ds.saved_one" : "ds.saved_many", { size, n: photos });
}
/** Resumo de uma praça («3 anúncios · 1 loja»). */
export function marketSummaryIn(m: { listings?: number; products?: number; businesses?: number }, t: TFunction): string {
  const parts: string[] = [];
  const add = (n: number | undefined, key: string) => { const v = Number(n) || 0; if (v > 0) parts.push(t(`mk.${key}_${v === 1 ? "one" : "many"}`, { n: v })); };
  add(m.listings, "listings"); add(m.products, "products"); add(m.businesses, "shops");
  return parts.length ? parts.join(" · ") : t("mk.empty");
}
