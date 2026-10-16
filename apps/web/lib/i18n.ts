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
  COMMON_DICT, DEFAULT_LANG, LANG_COOKIE, LANG_STORAGE_KEY, LANG_TAGS, AVG_PHOTO_KB,
  detectLang, isLang, makeT, mergeDictionaries, tc, timeAgo, formatEventDate, savedText, type Dictionary, type Lang
} from "@huambo-online/core";
import { DICT_LISTINGS } from "./i18n/listings";
import { DICT_SHOP } from "./i18n/shop";
import { DICT_SERVICES } from "./i18n/services";
import { DICT_ADMIN } from "./i18n/admin";

export const WEB_DICT: Dictionary = {
  // Cabeçalho
  "hdr.or": { pt: "ou", en: "or", zh: "或" },
  "hdr.welcome": { pt: "bem-vindo", en: "welcome", zh: "欢迎" },
  "hdr.hello_named": { pt: "Olá, {name}!", en: "Hello, {name}!", zh: "您好，{name}！" },
  "hdr.logo_home": { pt: "Huambo Online — página inicial", en: "Huambo Online — home page", zh: "Huambo Online — 首页" },
  "hdr.where": { pt: "Onde pesquisar", en: "Where to search", zh: "搜索范围" },
  "hdr.photo_search": { pt: "Pesquisar por fotografia", en: "Search by photo", zh: "以图搜索" },
  "hdr.shortcuts": { pt: "Atalhos", en: "Shortcuts", zh: "快捷方式" },
  "hdr.notif_unread": { pt: "Notificações ({n} por ler)", en: "Notifications ({n} unread)", zh: "通知（{n}条未读）" },
  "hdr.msg_unread": { pt: "Mensagens ({n} por ler)", en: "Messages ({n} unread)", zh: "消息（{n}条未读）" },
  "hdr.cart_items": { pt: "Carrinho ({n} artigos)", en: "Cart ({n} items)", zh: "购物车（{n}件商品）" },
  "scope.classificados": { pt: "Classificados", en: "Classifieds", zh: "分类信息" },
  "scope.loja": { pt: "Loja", en: "Shop", zh: "商店" },
  "scope.pracas": { pt: "Praças", en: "Markets", zh: "市场" },
  "scope.profissionais": { pt: "Profissionais", en: "Professionals", zh: "专业人士" },
  "scope.empresas": { pt: "Empresas", en: "Businesses", zh: "企业" },
  "web.fuel": { pt: "Combustível", en: "Fuel", zh: "燃油" },
  "web.videos": { pt: "Vídeos", en: "Videos", zh: "视频" },
  "web.events_tickets": { pt: "Eventos e bilhetes", en: "Events and tickets", zh: "活动与门票" },
  "web.recent": { pt: "Vistos recentemente", en: "Recently viewed", zh: "最近浏览" },
  "web.offline_banner": { pt: "📡 Está sem internet. Pode continuar a ver o que já abriu; as alterações só são enviadas quando a ligação voltar.", en: "📡 You're offline. You can keep viewing what you've already opened; changes are only sent when the connection is back.", zh: "📡 您当前没有网络。您可以继续查看已打开的内容；更改将在网络恢复后发送。" },

  // Rodapé
  "ft.buy": { pt: "Comprar", en: "Buy", zh: "购买" },
  "ft.help_info": { pt: "Ajuda e informação", en: "Help and information", zh: "帮助与信息" },
  "ft.wanted_requests": { pt: "Procura-se (pedidos)", en: "Wanted (requests)", zh: "求购（需求）" },
  "ft.post_wanted": { pt: "Publicar o que procuro", en: "Post what I'm looking for", zh: "发布我的需求" },
  "ft.farming": { pt: "Agricultura e campo", en: "Agriculture and farming", zh: "农业与田园" },
  "ft.cart": { pt: "Carrinho", en: "Cart", zh: "购物车" },
  "ft.orders": { pt: "Encomendas", en: "Orders", zh: "订单" },
  "ft.post_ad": { pt: "Publicar anúncio", en: "Post an ad", zh: "发布广告" },
  "ft.my_ads": { pt: "Os meus anúncios", en: "My ads", zh: "我的广告" },
  "ft.sell_products": { pt: "Vender produtos", en: "Sell products", zh: "出售商品" },
  "ft.rentals": { pt: "Alugueres", en: "Rentals", zh: "租赁" },
  "ft.be_pro": { pt: "Ser profissional", en: "Become a professional", zh: "成为专业人士" },
  "ft.be_courier": { pt: "Ser estafeta", en: "Become a courier", zh: "成为配送员" },
  "ft.be_agent": { pt: "Ser agente nas praças", en: "Become a market agent", zh: "成为市场代理" },
  "ft.organize_event": { pt: "Organizar um evento", en: "Organise an event", zh: "组织活动" },
  "ft.post_video": { pt: "Publicar vídeo ou live", en: "Post a video or live stream", zh: "发布视频或直播" },
  "ft.register_fuel": { pt: "Registar posto de combustível ou gás", en: "Register a fuel or gas station", zh: "登记加油站或燃气站" },
  "ft.register_venue": { pt: "Registar hotel, restaurante ou armazém", en: "Register a hotel, restaurant or warehouse", zh: "登记酒店、餐厅或仓库" },
  "ft.invite": { pt: "Convide um amigo", en: "Invite a friend", zh: "邀请好友" },
  "ft.my_bids": { pt: "As minhas licitações", en: "My bids", zh: "我的出价" },
  "ft.saved_searches": { pt: "Pesquisas guardadas", en: "Saved searches", zh: "已保存的搜索" },
  "ft.tagline": { pt: "Comércio, serviços e negócios do Huambo.", en: "Trade, services and business in Huambo.", zh: "万博的商贸、服务与企业。" },
  "info./seguranca": { pt: "Segurança e burlas", en: "Safety and scams", zh: "安全与防骗" },
  "info./devolucoes": { pt: "Devoluções e reembolsos", en: "Returns and refunds", zh: "退货与退款" },
  "info./apagar-conta": { pt: "Como apagar a conta", en: "How to delete your account", zh: "如何删除账户" },

  // Aparência e Poupar dados
  "theme.system": { pt: "🌓 Automático", en: "🌓 Automatic", zh: "🌓 自动" },
  "theme.light": { pt: "☀️ Claro", en: "☀️ Light", zh: "☀️ 浅色" },
  "theme.dark": { pt: "🌙 Escuro", en: "🌙 Dark", zh: "🌙 深色" },
  "theme.to_light": { pt: "Mudar para o modo claro", en: "Switch to light mode", zh: "切换到浅色模式" },
  "theme.to_dark": { pt: "Mudar para o modo escuro", en: "Switch to dark mode", zh: "切换到深色模式" },
  "theme.light_short": { pt: "Claro", en: "Light", zh: "浅色" },
  "theme.dark_short": { pt: "Escuro", en: "Dark", zh: "深色" },
  "ds.auto": { pt: "Automático", en: "Automatic", zh: "自动" },
  "ds.on": { pt: "📉 Ligado", en: "📉 On", zh: "📉 开启" },
  "ds.off": { pt: "Desligado", en: "Off", zh: "关闭" },
  "ds.turn_off": { pt: "Desligar Poupar dados", en: "Turn off Data saver", zh: "关闭节省流量" },
  "ds.turn_on": { pt: "Ligar Poupar dados (não carrega as fotografias das listas)", en: "Turn on Data saver (photos in lists won't load)", zh: "开启节省流量（列表中的照片不加载）" },
  "ds.saving": { pt: "A poupar dados", en: "Saving data", zh: "正在节省流量" },
  "ds.desc_on": { pt: "Ligado: as fotografias das listas não carregam; na página do artigo, toque para as ver. Os vídeos só carregam quando carrega em ▶.", en: "On: photos in lists don't load; on an item's page, tap to see them. Videos only load when you press ▶.", zh: "已开启：列表中的照片不加载；在商品页面点击即可查看。视频只在点击 ▶ 时加载。" },
  "ds.desc_auto": { pt: "Automático: liga sozinho quando o telemóvel ou o navegador está em poupança de dados.", en: "Automatic: turns on by itself when your phone or browser is in data saving mode.", zh: "自动：当手机或浏览器处于省流模式时自动开启。" },
  "ds.desc_off": { pt: "Desligado: as fotografias carregam normalmente.", en: "Off: photos load normally.", zh: "已关闭：照片正常加载。" },
  "ds.saved_one": { pt: "Poupou cerca de {size} (1 fotografia não carregada).", en: "You saved about {size} (1 photo not loaded).", zh: "已节省约 {size}（1张照片未加载）。" },
  "ds.saved_many": { pt: "Poupou cerca de {size} ({n} fotografias não carregadas).", en: "You saved about {size} ({n} photos not loaded).", zh: "已节省约 {size}（{n}张照片未加载）。" },

  // Página inicial
  "home.hero_title": { pt: "Compre, venda e encontre tudo no Huambo.", en: "Buy, sell and find everything in Huambo.", zh: "在万博买卖、寻找一切。" },
  "home.hero_text": { pt: "Classificados, loja, leilões, profissionais e empresas — num único lugar, com entrega ao domicílio.", en: "Classifieds, shop, auctions, professionals and businesses — all in one place, with home delivery.", zh: "分类信息、商店、拍卖、专业人士和企业——尽在一处，送货上门。" },
  "home.start_buying": { pt: "Começar a comprar", en: "Start shopping", zh: "开始购物" },
  "home.sell_now": { pt: "Vender agora", en: "Sell now", zh: "立即出售" },
  "home.explore_cats": { pt: "Explore as categorias", en: "Explore the categories", zh: "浏览分类" },
  "home.popular_cats": { pt: "Categorias populares", en: "Popular categories", zh: "热门分类" },
  "home.loading": { pt: "A carregar novidades…", en: "Loading what's new…", zh: "正在加载最新内容…" },
  "home.videos": { pt: "Vídeos e lives", en: "Videos and live streams", zh: "视频与直播" },
  "home.auctions": { pt: "Leilões a decorrer", en: "Ongoing auctions", zh: "进行中的拍卖" },
  "home.markets": { pt: "Praças do Huambo", en: "Huambo markets", zh: "万博市场" },
  "home.new_listings": { pt: "Novidades nos classificados", en: "New in classifieds", zh: "分类信息新品" },
  "home.wanted_title": { pt: "Procura-se — compradores à procura", en: "Wanted — buyers looking for items", zh: "求购——买家正在寻找" },
  "home.wanted_badge": { pt: "PROCURA-SE", en: "WANTED", zh: "求购" },
  "home.budget": { pt: "Orçamento:", en: "Budget:", zh: "预算：" },
  "home.sell_title": { pt: "Tem algo para vender?", en: "Have something to sell?", zh: "有东西要出售吗？" },
  "home.sell_text": { pt: "Publique grátis com fotografias e receba mensagens de compradores do Huambo.", en: "Post for free with photos and get messages from buyers in Huambo.", zh: "免费发布带照片的广告，接收万博买家的消息。" },
  "home.in_shop": { pt: "Na loja", en: "In the shop", zh: "商店好物" },
  "home.sold_out": { pt: "Esgotado", en: "Sold out", zh: "售罄" },
  "home.for_rent": { pt: "Para arrendar", en: "For rent", zh: "出租" },
  "home.trusted_pros": { pt: "Profissionais de confiança", en: "Trusted professionals", zh: "值得信赖的专业人士" },
  "home.first_title": { pt: "Seja o primeiro a anunciar!", en: "Be the first to post an ad!", zh: "成为第一个发布广告的人！" },
  "home.first_text": { pt: "Ainda há poucos artigos. Publique o seu e ajude o Huambo Online a crescer.", en: "There are only a few items so far. Post yours and help Huambo Online grow.", zh: "目前商品还不多。发布您的商品，帮助 Huambo Online 成长。" },
  "home.pro_title": { pt: "Profissional, empresa, estafeta ou agente?", en: "Professional, business, courier or agent?", zh: "专业人士、企业、配送员还是代理？" },
  "home.pro_text": { pt: "Crie o seu perfil e receba clientes de todo o Huambo. Agentes ajudam quem não tem telemóvel ou não sabe usar a internet a vender, trocar ou leiloar — e ganham comissão em cada venda.", en: "Create your profile and get customers from all over Huambo. Agents help people who don't have a phone or don't know how to use the internet to sell, swap or auction — and earn a commission on every sale.", zh: "创建您的资料，接待来自万博各地的客户。代理帮助没有手机或不会上网的人出售、交换或拍卖——每笔成交都能赚取佣金。" },
  "home.i_am_pro": { pt: "Sou profissional", en: "I'm a professional", zh: "我是专业人士" },
  "home.have_business": { pt: "Tenho uma empresa", en: "I have a business", zh: "我有企业" },
  "home.want_courier": { pt: "Quero ser estafeta", en: "I want to be a courier", zh: "我想成为配送员" },
  "home.want_agent": { pt: "Quero ser um agente", en: "I want to be an agent", zh: "我想成为代理" },
  "purpose.sale": { pt: "Venda", en: "Sale", zh: "出售" },
  "purpose.rent": { pt: "Arrendamento", en: "Rental", zh: "出租" },
  "purpose.lease": { pt: "Aluguer", en: "Hire", zh: "租用" },
  "purpose.wanted": { pt: "Procuro", en: "Wanted", zh: "求购" },
  "purpose.service": { pt: "Serviço", en: "Service", zh: "服务" },
  "purpose.auction": { pt: "Leilão", en: "Auction", zh: "拍卖" },
  "mk.listings_one": { pt: "{n} anúncio", en: "{n} listing", zh: "{n}条广告" },
  "mk.listings_many": { pt: "{n} anúncios", en: "{n} listings", zh: "{n}条广告" },
  "mk.products_one": { pt: "{n} produto", en: "{n} product", zh: "{n}件商品" },
  "mk.products_many": { pt: "{n} produtos", en: "{n} products", zh: "{n}件商品" },
  "mk.shops_one": { pt: "{n} loja", en: "{n} shop", zh: "{n}家店铺" },
  "mk.shops_many": { pt: "{n} lojas", en: "{n} shops", zh: "{n}家店铺" },
  "mk.empty": { pt: "Ainda sem vendedores no Huambo Online", en: "No sellers on Huambo Online yet", zh: "Huambo Online 上暂无卖家" },
  "promo.video": { pt: "Vídeo", en: "Video", zh: "视频" },
  "promo.live_badge": { pt: "EM DIRETO", en: "LIVE", zh: "直播中" },
  "promo.ended": { pt: "Terminada", en: "Ended", zh: "已结束" },
  "promo.live_now": { pt: "Em direto agora", en: "Live now", zh: "正在直播" },
  "promo.live_ended": { pt: "Live terminada", en: "Live stream ended", zh: "直播已结束" },
  "promo.views_one": { pt: "1 visualização", en: "1 view", zh: "1次观看" },
  "promo.views_many": { pt: "{n} visualizações", en: "{n} views", zh: "{n}次观看" },
  "rating.none": { pt: "Sem avaliações", en: "No reviews yet", zh: "暂无评价" },

  // Entrar
  "login.step2_title": { pt: "Entrar — segundo passo", en: "Sign in — second step", zh: "登录——第二步" },
  "login.step2_text": { pt: "A sua conta está protegida com a entrada em dois passos.", en: "Your account is protected with two-step sign-in.", zh: "您的账户已启用两步登录保护。" },
  "login.recover_title": { pt: "Recuperar palavra-passe", en: "Recover password", zh: "找回密码" },
  "login.wait": { pt: "Aguarde…", en: "Please wait…", zh: "请稍候…" },
  "login.send_link": { pt: "Enviar link de recuperação", en: "Send recovery link", zh: "发送找回链接" },
  "login.back_to_login": { pt: "← Voltar a entrar", en: "← Back to sign in", zh: "← 返回登录" },
  "login.create": { pt: "Criar uma conta", en: "Create an account", zh: "创建账户" },
  "login.reset_sent": { pt: "Se o email existir, enviámos um link para definir uma nova palavra-passe.", en: "If that email exists, we've sent a link to set a new password.", zh: "如果该邮箱存在，我们已发送设置新密码的链接。" },
  "mfa.intro": { pt: "Abra a APP autenticadora (Google Authenticator, Microsoft Authenticator ou Authy) e escreva os 6 algarismos que aparecem para o Huambo Online.", en: "Open your authenticator app (Google Authenticator, Microsoft Authenticator or Authy) and enter the 6 digits shown for Huambo Online.", zh: "打开身份验证器应用（Google Authenticator、Microsoft Authenticator 或 Authy），输入 Huambo Online 显示的6位数字。" },
  "mfa.confirming": { pt: "A confirmar…", en: "Confirming…", zh: "正在确认…" },
  "mfa.confirm_you": { pt: "Confirmar que é você", en: "Confirm it's you", zh: "确认是您本人" },

  // Criar conta
  "signup.intro": { pt: "Uma conta para descobrir, comprar, vender e prestar serviços.", en: "One account to discover, buy, sell and offer services.", zh: "一个账户即可发现、购买、出售和提供服务。" },
  "signup.phone_opt": { pt: "Telefone (opcional)", en: "Phone (optional)", zh: "电话（选填）" },
  "signup.muni_opt": { pt: "Município (opcional)", en: "Municipality (optional)", zh: "市镇（选填）" },
  "signup.muni_ph": { pt: "Ex.: Huambo, Caála…", en: "E.g. Huambo, Caála…", zh: "例如：Huambo、Caála…" },
  "signup.invite": { pt: "Código de convite (opcional)", en: "Invite code (optional)", zh: "邀请码（选填）" },
  "signup.invite_ph": { pt: "Ex.: K7M2QX", en: "E.g. K7M2QX", zh: "例如：K7M2QX" },
  "signup.have": { pt: "Já tenho conta", en: "I already have an account", zh: "我已有账户" },
  "signup.not_configured": { pt: "Serviço de autenticação não configurado. Tente mais tarde.", en: "The sign-in service isn't set up. Please try again later.", zh: "登录服务尚未配置，请稍后再试。" },
  "signup.bad_email": { pt: "Email inválido.", en: "Invalid email.", zh: "邮箱无效。" },
  "signup.invite_shape": { pt: "O código de convite tem 6 letras e números (ex.: K7M2QX).", en: "The invite code has 6 letters and numbers (e.g. K7M2QX).", zh: "邀请码由6位字母和数字组成（例如：K7M2QX）。" },
  "signup.exists": { pt: "Já existe uma conta com este email. Use «Entrar».", en: "An account with this email already exists. Use “Sign in”.", zh: "该邮箱已注册账户，请使用“登录”。" },
  "signup.created_in": { pt: "Conta criada com sucesso. A entrar…", en: "Account created. Signing you in…", zh: "账户创建成功，正在登录…" },
  "signup.created_confirm": { pt: "Conta criada. Abra o email que enviámos e clique no link para confirmar a conta. Depois pode entrar.", en: "Account created. Open the email we sent and click the link to confirm your account. Then you can sign in.", zh: "账户已创建。请打开我们发送的邮件并点击链接确认账户，然后即可登录。" },

  // Recuperar acesso
  "recover.title": { pt: "Recuperar acesso", en: "Recover access", zh: "恢复访问" },
  "recover.intro": { pt: "Defina uma nova palavra-passe para a sua conta.", en: "Set a new password for your account.", zh: "为您的账户设置新密码。" },
  "recover.new_pw": { pt: "Nova palavra-passe", en: "New password", zh: "新密码" },
  "recover.saving": { pt: "A guardar…", en: "Saving…", zh: "正在保存…" },
  "recover.submit": { pt: "Definir nova palavra-passe", en: "Set new password", zh: "设置新密码" },
  "recover.too_short": { pt: "A palavra-passe deve ter pelo menos 8 caracteres.", en: "The password must be at least 8 characters long.", zh: "密码至少需要8个字符。" },
  "recover.mismatch": { pt: "As palavras-passe não coincidem.", en: "The passwords don't match.", zh: "两次输入的密码不一致。" },
  "recover.done": { pt: "Palavra-passe atualizada. Pode iniciar sessão novamente.", en: "Password updated. You can sign in again.", zh: "密码已更新，您可以重新登录。" },

  // A sua conta
  "acct.yours": { pt: "A sua conta", en: "Your account", zh: "您的账户" },
  "acct.sign_in_to_manage": { pt: "Inicie sessão para gerir a sua conta.", en: "Sign in to manage your account.", zh: "请登录以管理您的账户。" },
  "acct.photo": { pt: "Fotografia de perfil", en: "Profile photo", zh: "头像" },
  "acct.pick_image": { pt: "Escolha uma imagem.", en: "Choose an image.", zh: "请选择一张图片。" },
  "acct.image_2mb": { pt: "Escolha uma imagem até 2 MB.", en: "Choose an image of up to 2 MB.", zh: "请选择不超过 2 MB 的图片。" },
  "acct.photo_updated": { pt: "Fotografia atualizada.", en: "Photo updated.", zh: "头像已更新。" },
  "acct.signed_in_as": { pt: "Sessão iniciada como {email}", en: "Signed in as {email}", zh: "当前登录：{email}" },
  "acct.l.professional": { pt: "Perfil profissional", en: "Professional profile", zh: "专业资料" },
  "acct.l.businesses": { pt: "As minhas empresas", en: "My businesses", zh: "我的企业" },
  "acct.l.plan": { pt: "O meu plano", en: "My plan", zh: "我的套餐" },
  "acct.l.commissions": { pt: "Comissões", en: "Commissions", zh: "佣金" },
  "acct.l.balance": { pt: "O meu saldo", en: "My balance", zh: "我的余额" },
  "acct.l.stats": { pt: "Estatísticas", en: "Statistics", zh: "统计" },
  "acct.l.agent": { pt: "Ser agente", en: "Become an agent", zh: "成为代理" },
  "acct.l.invite": { pt: "Convidar amigos", en: "Invite friends", zh: "邀请好友" },
  "acct.l.tickets": { pt: "Os meus bilhetes", en: "My tickets", zh: "我的门票" },
  "acct.l.events": { pt: "Os meus eventos", en: "My events", zh: "我的活动" },
  "acct.l.videos": { pt: "Vídeos e lives", en: "Videos and live streams", zh: "视频与直播" },
  "acct.l.fuel_orders": { pt: "Reservas de combustível", en: "Fuel reservations", zh: "燃油预订" },
  "acct.l.stations": { pt: "Os meus postos", en: "My stations", zh: "我的加油站" },
  "acct.l.products": { pt: "Os meus produtos", en: "My products", zh: "我的商品" },
  "acct.l.services": { pt: "Pedidos de serviço", en: "Service requests", zh: "服务请求" },
  "acct.l.offers": { pt: "As minhas propostas", en: "My offers", zh: "我的报价" },
  "acct.l.reviews": { pt: "Avaliações", en: "Reviews", zh: "评价" },
  "acct.l.verify": { pt: "Verificar perfil", en: "Verify profile", zh: "验证资料" },
  "acct.l.inspected": { pt: "Selo «Inspecionado»", en: "“Inspected” badge", zh: "“已检验”标识" },
  "acct.l.safety": { pt: "Segurança", en: "Safety", zh: "安全须知" },
  "acct.l.deliveries": { pt: "Ser estafeta / Entregas", en: "Become a courier / Deliveries", zh: "成为配送员 / 配送" },
  "acct.l.following": { pt: "A seguir", en: "Following", zh: "关注" },
  "acct.profile_updated": { pt: "Perfil atualizado.", en: "Profile updated.", zh: "资料已更新。" },
  "acct.personal": { pt: "Dados pessoais", en: "Personal details", zh: "个人信息" },
  "acct.name": { pt: "Nome", en: "Name", zh: "姓名" },
  "acct.save_changes": { pt: "Guardar alterações", en: "Save changes", zh: "保存更改" },
  "acct.pw_changed": { pt: "Palavra-passe alterada com sucesso.", en: "Password changed successfully.", zh: "密码修改成功。" },
  "acct.security": { pt: "Segurança", en: "Security", zh: "账户安全" },
  "acct.change_pw": { pt: "Alterar palavra-passe", en: "Change password", zh: "修改密码" },
  "acct.twostep": { pt: "Entrar em dois passos", en: "Two-step sign-in", zh: "两步登录" },
  "acct.twostep_text": { pt: "Mais proteção: além da palavra-passe, pedimos um código da APP autenticadora do seu telemóvel (Google Authenticator, Microsoft Authenticator ou Authy).", en: "Extra protection: besides your password, we ask for a code from the authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy).", zh: "更多保护：除密码外，我们还会要求输入您手机上身份验证器应用（Google Authenticator、Microsoft Authenticator 或 Authy）中的代码。" },
  "acct.recommended_admin": { pt: " Recomendado para administradores.", en: " Recommended for administrators.", zh: "建议管理员启用。" },
  "acct.appearance_text": { pt: "Escolha o modo claro, escuro, ou automático (segue o seu telemóvel ou computador).", en: "Choose light, dark or automatic mode (follows your phone or computer).", zh: "选择浅色、深色或自动模式（跟随您的手机或电脑）。" },
  "acct.datasaver_text": { pt: "Gaste menos saldo: as fotografias das listas não carregam e, nos anúncios, só carregam quando tocar.", en: "Use less mobile data: photos in lists don't load and, in ads, they only load when you tap.", zh: "节省流量费用：列表中的照片不加载，广告中的照片只在点击时加载。" },
  "acct.language_text": { pt: "Escolha a língua do site. Fica guardada neste aparelho.", en: "Choose the language of the site. It is saved on this device.", zh: "选择网站语言，设置将保存在此设备上。" },
  "acct.deleted": { pt: "Conta eliminada.", en: "Account deleted.", zh: "账户已删除。" },
  "acct.privacy": { pt: "Privacidade", en: "Privacy", zh: "隐私" },
  "acct.delete_text": { pt: "Eliminar a conta remove permanentemente os seus dados.", en: "Deleting your account permanently removes your data.", zh: "删除账户将永久清除您的数据。" },
  "acct.type_delete": { pt: "Escreva ELIMINAR para confirmar", en: "Type ELIMINAR to confirm", zh: "输入 ELIMINAR 以确认" },
  "acct.delete_btn": { pt: "Eliminar a minha conta", en: "Delete my account", zh: "删除我的账户" },
  "acct.logout": { pt: "Terminar sessão", en: "Sign out", zh: "退出登录" },
  "wa.deleted": { pt: "Número de WhatsApp apagado.", en: "WhatsApp number deleted.", zh: "WhatsApp 号码已删除。" },
  "wa.saved_visible": { pt: "Guardado. O botão «Falar no WhatsApp» aparece nos seus anúncios e produtos.", en: "Saved. The “Chat on WhatsApp” button appears on your ads and products.", zh: "已保存。“通过WhatsApp联系”按钮将显示在您的广告和商品上。" },
  "wa.saved_hidden": { pt: "Guardado. O número fica escondido.", en: "Saved. Your number stays hidden.", zh: "已保存。号码将保持隐藏。" },
  "wa.text": { pt: "Os compradores podem falar consigo pelo WhatsApp, além das mensagens do Huambo Online.", en: "Buyers can contact you on WhatsApp as well as through Huambo Online messages.", zh: "除了 Huambo Online 消息外，买家还可以通过 WhatsApp 联系您。" },
  "wa.number": { pt: "Número de WhatsApp", en: "WhatsApp number", zh: "WhatsApp 号码" },
  "wa.show": { pt: "Mostrar o botão «Falar no WhatsApp» nos meus anúncios e produtos", en: "Show the “Chat on WhatsApp” button on my ads and products", zh: "在我的广告和商品上显示“通过WhatsApp联系”按钮" },
  "wa.note": { pt: "Só quem tem sessão iniciada vê o seu número. Pode esconder ou apagar quando quiser.", en: "Only signed-in users can see your number. You can hide or delete it at any time.", zh: "只有已登录的用户才能看到您的号码。您可以随时隐藏或删除。" },
  "wa.save": { pt: "Guardar WhatsApp", en: "Save WhatsApp", zh: "保存 WhatsApp" },

  // Página não encontrada
  "nf.title": { pt: "Página não encontrada", en: "Page not found", zh: "页面未找到" },
  "nf.text": { pt: "O endereço pode estar errado, ou a página foi retirada. Se acabou de ser publicada, espere um minuto e tente de novo.", en: "The address may be wrong, or the page has been removed. If it was just published, wait a minute and try again.", zh: "地址可能有误，或页面已被移除。如果刚刚发布，请稍等一分钟后重试。" },
  "nf.home": { pt: "Ir para o início", en: "Go to the home page", zh: "返回首页" },
  "nf.listings": { pt: "Ver anúncios", en: "See listings", zh: "查看广告" }
};

/** Todos os textos do Site (comuns + só do Site). */
export const DICT: Dictionary = mergeDictionaries(COMMON_DICT, WEB_DICT, DICT_LISTINGS, DICT_SHOP, DICT_SERVICES, DICT_ADMIN);

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
  try { return detectLang(navigator.languages?.length ? navigator.languages : navigator.language); } catch { return DEFAULT_LANG; }
}

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
