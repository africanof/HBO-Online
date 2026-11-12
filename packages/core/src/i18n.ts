/**
 * Várias línguas (igual no Site e na APP): português (Angola), inglês, mandarim (chinês simplificado) e francês.
 * O português é a língua base: se faltar uma tradução, mostra-se o texto em português.
 * Cada app junta os seus próprios textos com `mergeDictionaries` (sem tocar neste ficheiro).
 */
export type Lang = "pt" | "en" | "zh" | "fr";
export const LANGS: Lang[] = ["pt", "en", "fr", "zh"];
export const DEFAULT_LANG: Lang = "pt";
export const LANG_LABELS: Record<Lang, string> = { pt: "Português", en: "English", zh: "中文", fr: "Français" };
export const LANG_FLAGS: Record<Lang, string> = { pt: "🇦🇴", en: "🇬🇧", zh: "🇨🇳", fr: "🇫🇷" };
/** Etiqueta HTML/acessibilidade. */
export const LANG_TAGS: Record<Lang, string> = { pt: "pt-AO", en: "en", zh: "zh-Hans", fr: "fr" };
export const LANG_COOKIE = "lang";
export const LANG_STORAGE_KEY = "huambo-online:lang";

export type Dictionary = Record<string, Partial<Record<Lang, string>> & { pt: string }>;

export function isLang(v: unknown): v is Lang { return v === "pt" || v === "en" || v === "zh" || v === "fr"; }
/** «en-GB,en;q=0.9» / «zh-CN» / «pt-PT» → língua suportada (português por omissão). */
export function detectLang(input: string | readonly string[] | null | undefined): Lang {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  for (const raw of list) {
    const code = String(raw).trim().split(";")[0].toLowerCase();
    if (code.startsWith("pt")) return "pt";
    if (code.startsWith("en")) return "en";
    if (code.startsWith("zh")) return "zh";
    if (code.startsWith("fr")) return "fr";
  }
  return DEFAULT_LANG;
}
export function mergeDictionaries(...ds: Dictionary[]): Dictionary { return Object.assign({}, ...ds); }
/** Texto traduzido; «{nome}» é trocado pelos valores. Chave desconhecida → a própria chave (para dar por ela). */
export function translate(dict: Dictionary, lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const e = dict[key];
  let s = e ? (e[lang] ?? (lang === "fr" ? e.en : undefined) ?? e.pt) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export function makeT(dict: Dictionary, lang: Lang) {
  return (key: string, vars?: Record<string, string | number>) => translate(dict, lang, key, vars);
}
/** Chaves sem tradução numa língua (os testes garantem que não há nenhuma). */
export function missingTranslations(dict: Dictionary, lang: Lang): string[] {
  return Object.keys(dict).filter(k => !dict[k][lang]?.trim());
}

/** Textos comuns ao Site e à APP. */
export const COMMON_DICT: Dictionary = {
  "lang.choose": { pt: "Língua", en: "Language", zh: "语言", fr: "Langue" },
  "lang.saved": { pt: "Língua alterada.", en: "Language changed.", zh: "语言已更改。", fr: "Langue modifiée." },
  "app.tagline": { pt: "Compre, venda e encontre tudo no Huambo", en: "Buy, sell and find everything in Huambo", zh: "在万博买卖、寻找一切", fr: "Achetez, vendez et trouvez de tout au Huambo" },
  "nav.home": { pt: "Início", en: "Home", zh: "首页", fr: "Accueil" },
  "nav.explore": { pt: "Explorar", en: "Explore", zh: "浏览", fr: "Explorer" },
  "nav.search": { pt: "Pesquisar", en: "Search", zh: "搜索", fr: "Rechercher" },
  "nav.sell": { pt: "Vender", en: "Sell", zh: "出售", fr: "Vendre" },
  "nav.messages": { pt: "Mensagens", en: "Messages", zh: "消息", fr: "Messages" },
  "nav.account": { pt: "A minha conta", en: "My account", zh: "我的账户", fr: "Mon compte" },
  "nav.account_short": { pt: "Conta", en: "Account", zh: "账户", fr: "Compte" },
  "nav.saved": { pt: "Guardados", en: "Saved", zh: "收藏", fr: "Favoris" },
  "nav.notifications": { pt: "Notificações", en: "Notifications", zh: "通知", fr: "Notifications" },
  "nav.admin": { pt: "Administração", en: "Administration", zh: "管理", fr: "Administration" },
  "nav.shop": { pt: "Loja", en: "Shop", zh: "商店", fr: "Boutique" },
  "nav.services": { pt: "Serviços", en: "Services", zh: "服务", fr: "Services" },
  "nav.businesses": { pt: "Empresas", en: "Businesses", zh: "企业", fr: "Entreprises" },
  "nav.markets": { pt: "Praças", en: "Markets", zh: "市场", fr: "Marchés" },
  "nav.help": { pt: "Ajuda", en: "Help", zh: "帮助", fr: "Aide" },
  "nav.terms": { pt: "Termos de Uso", en: "Terms of Use", zh: "使用条款", fr: "Conditions d'utilisation" },
  "nav.privacy": { pt: "Política de Privacidade", en: "Privacy Policy", zh: "隐私政策", fr: "Politique de confidentialité" },
  "nav.appearance": { pt: "Aparência", en: "Appearance", zh: "外观", fr: "Apparence" },
  "nav.data_saver": { pt: "Poupar dados", en: "Data saver", zh: "节省流量", fr: "Économie de données" },
  "nav.bookings": { pt: "Reservas", en: "Bookings", zh: "预订", fr: "Réservations" },
  "auth.login": { pt: "Entrar", en: "Sign in", zh: "登录", fr: "Se connecter" },
  "auth.logout": { pt: "Sair", en: "Sign out", zh: "退出", fr: "Se déconnecter" },
  "auth.signup": { pt: "Criar conta", en: "Create account", zh: "注册账户", fr: "Créer un compte" },
  "auth.signup_lower": { pt: "criar conta", en: "create account", zh: "注册账户", fr: "créer un compte" },
  "auth.hello": { pt: "Olá!", en: "Hello!", zh: "您好！", fr: "Bonjour !" },
  "auth.hello_name": { pt: "Olá, {name}", en: "Hello, {name}", zh: "您好，{name}", fr: "Bonjour, {name}" },
  "auth.full_name": { pt: "Nome completo", en: "Full name", zh: "全名", fr: "Nom complet" },
  "auth.email": { pt: "E-mail", en: "Email", zh: "电子邮箱", fr: "E-mail" },
  "auth.phone": { pt: "Telefone", en: "Phone", zh: "电话", fr: "Téléphone" },
  "auth.municipality": { pt: "Município", en: "Municipality", zh: "市镇", fr: "Municipalité" },
  "auth.password": { pt: "Palavra-passe", en: "Password", zh: "密码", fr: "Mot de passe" },
  "auth.password_min": { pt: "Palavra-passe (mínimo 8 caracteres)", en: "Password (at least 8 characters)", zh: "密码（至少8个字符）", fr: "Mot de passe (au moins 8 caractères)" },
  "auth.password_confirm": { pt: "Confirmar palavra-passe", en: "Confirm password", zh: "确认密码", fr: "Confirmer le mot de passe" },
  "auth.forgot": { pt: "Esqueci-me da palavra-passe", en: "I forgot my password", zh: "忘记密码", fr: "J'ai oublié mon mot de passe" },
  "auth.no_account": { pt: "Ainda não tem conta?", en: "Don't have an account yet?", zh: "还没有账户？", fr: "Pas encore de compte ?" },
  "auth.have_account": { pt: "Já tem conta?", en: "Already have an account?", zh: "已有账户？", fr: "Vous avez déjà un compte ?" },
  "auth.signing_in": { pt: "A entrar…", en: "Signing in…", zh: "正在登录…", fr: "Connexion…" },
  "auth.creating": { pt: "A criar a conta…", en: "Creating account…", zh: "正在创建账户…", fr: "Création du compte…" },
  "auth.check_email": { pt: "Conta criada! Abra o e-mail que lhe enviámos para confirmar a conta.", en: "Account created! Open the email we sent you to confirm your account.", zh: "账户已创建！请打开我们发送给您的邮件以确认账户。", fr: "Compte créé ! Ouvrez l'e-mail que nous vous avons envoyé pour confirmer votre compte." },
  "auth.mfa_title": { pt: "Código da APP autenticadora", en: "Authenticator app code", zh: "身份验证器应用代码", fr: "Code de l'application d'authentification" },
  "auth.mfa_hint": { pt: "Escreva os 6 algarismos que aparecem na APP autenticadora.", en: "Enter the 6 digits shown in your authenticator app.", zh: "请输入身份验证器应用中显示的6位数字。", fr: "Indiquez les 6 chiffres affichés dans votre application d'authentification." },
  "common.loading": { pt: "A carregar…", en: "Loading…", zh: "加载中…", fr: "Chargement…" },
  "common.save": { pt: "Guardar", en: "Save", zh: "保存", fr: "Enregistrer" },
  "common.cancel": { pt: "Cancelar", en: "Cancel", zh: "取消", fr: "Annuler" },
  "common.confirm": { pt: "Confirmar", en: "Confirm", zh: "确认", fr: "Confirmer" },
  "common.send": { pt: "Enviar", en: "Send", zh: "发送", fr: "Envoyer" },
  "common.back": { pt: "Voltar", en: "Back", zh: "返回", fr: "Retour" },
  "common.close": { pt: "Fechar", en: "Close", zh: "关闭", fr: "Fermer" },
  "common.edit": { pt: "Editar", en: "Edit", zh: "编辑", fr: "Modifier" },
  "common.delete": { pt: "Apagar", en: "Delete", zh: "删除", fr: "Supprimer" },
  "common.see_all": { pt: "Ver tudo", en: "See all", zh: "查看全部", fr: "Tout voir" },
  "common.see_more": { pt: "Ver mais", en: "See more", zh: "查看更多", fr: "Voir plus" },
  "common.share": { pt: "Partilhar", en: "Share", zh: "分享", fr: "Partager" },
  "common.call": { pt: "Ligar", en: "Call", zh: "致电", fr: "Appeler" },
  "common.whatsapp": { pt: "Falar no WhatsApp", en: "Chat on WhatsApp", zh: "通过WhatsApp联系", fr: "Discuter sur WhatsApp" },
  "common.search_placeholder": { pt: "O que procura?", en: "What are you looking for?", zh: "您在找什么？", fr: "Que cherchez-vous ?" },
  "common.offline": { pt: "Sem internet — a mostrar o que ficou guardado.", en: "No internet — showing saved content.", zh: "无网络——正在显示已保存的内容。", fr: "Pas d'internet — affichage du contenu enregistré." },
  "common.error": { pt: "Não foi possível concluir. Tente novamente.", en: "Something went wrong. Please try again.", zh: "操作未完成，请重试。", fr: "Une erreur s'est produite. Veuillez réessayer." },
  "common.price_on_request": { pt: "Preço a combinar", en: "Price on request", zh: "价格面议", fr: "Prix sur demande" },
  "common.verified": { pt: "Verificado", en: "Verified", zh: "已认证", fr: "Vérifié" },
  "home.categories": { pt: "Categorias", en: "Categories", zh: "分类", fr: "Catégories" },
  "home.latest": { pt: "Anúncios recentes", en: "Latest listings", zh: "最新信息", fr: "Dernières annonces" },
  "home.events": { pt: "Próximos eventos", en: "Upcoming events", zh: "近期活动", fr: "Prochains événements" },
  "home.providers": { pt: "Profissionais", en: "Professionals", zh: "专业人士", fr: "Professionnels" },
  "home.products": { pt: "Produtos da Loja", en: "Shop products", zh: "商店商品", fr: "Produits de la boutique" },
  "home.wanted": { pt: "Procura-se", en: "Wanted", zh: "求购", fr: "Recherche" },
  "home.trades": { pt: "Trocas", en: "Swaps", zh: "以物易物", fr: "Échanges" },
  "cat.Imóveis": { pt: "Imóveis", en: "Real estate", zh: "房产", fr: "Immobilier" },
  "cat.Viaturas": { pt: "Viaturas", en: "Vehicles", zh: "车辆", fr: "Véhicules" },
  "cat.Campo": { pt: "Campo", en: "Farming", zh: "农业", fr: "Agriculture" },
  "cat.Fábricas": { pt: "Fábricas", en: "Factories", zh: "工厂", fr: "Usines" },
  "cat.Combustível e gás": { pt: "Combustível e gás", en: "Fuel and gas", zh: "燃油和燃气", fr: "Carburant et gaz" },
  "cat.Hotéis": { pt: "Hotéis", en: "Hotels", zh: "酒店", fr: "Hôtels" },
  "cat.Restaurantes": { pt: "Restaurantes", en: "Restaurants", zh: "餐厅", fr: "Restaurants" },
  "cat.Emprego": { pt: "Emprego", en: "Jobs", zh: "招聘", fr: "Emploi" },
  "cat.Emprego e recrutamento": { pt: "Emprego e recrutamento", en: "Jobs and recruitment", zh: "就业与招聘", fr: "Emploi et recrutement" },
  "cat.Estágios remunerados": { pt: "Estágios remunerados", en: "Paid internships", zh: "带薪实习", fr: "Stages rémunérés" },
  "cat.Telemóveis e tablets": { pt: "Telemóveis e tablets", en: "Phones and tablets", zh: "手机和平板", fr: "Téléphones et tablettes" },
  "cat.Informática": { pt: "Informática", en: "Computers", zh: "电脑", fr: "Informatique" },
  "cat.Eletrodomésticos": { pt: "Eletrodomésticos", en: "Home appliances", zh: "家用电器", fr: "Électroménager" },
  "cat.TV, som e imagem": { pt: "TV, som e imagem", en: "TV, audio and video", zh: "电视和影音", fr: "TV, son et image" },
  "cat.Móveis e decoração": { pt: "Móveis e decoração", en: "Furniture and decor", zh: "家具和装饰", fr: "Meubles et décoration" },
  "cat.Casa e jardim": { pt: "Casa e jardim", en: "Home and garden", zh: "家居和园艺", fr: "Maison et jardin" },
  "cat.Moda e acessórios": { pt: "Moda e acessórios", en: "Fashion and accessories", zh: "时尚和配饰", fr: "Mode et accessoires" },
  "cat.Bebé e criança": { pt: "Bebé e criança", en: "Baby and kids", zh: "母婴和儿童", fr: "Bébé et enfant" },
  "cat.Desporto e lazer": { pt: "Desporto e lazer", en: "Sports and leisure", zh: "运动和休闲", fr: "Sport et loisirs" },
  "cat.Animais": { pt: "Animais", en: "Animals", zh: "动物", fr: "Animaux" },
  "cat.Materiais de construção": { pt: "Materiais de construção", en: "Building materials", zh: "建筑材料", fr: "Matériaux de construction" },
  "cat.Peças e acessórios auto": { pt: "Peças e acessórios auto", en: "Car parts and accessories", zh: "汽车配件", fr: "Pièces et accessoires auto" },
  "cat.Máquinas e ferramentas": { pt: "Máquinas e ferramentas", en: "Machinery and tools", zh: "机械和工具", fr: "Machines et outils" },
  "cat.Livros e material escolar": { pt: "Livros e material escolar", en: "Books and school supplies", zh: "书籍和学习用品", fr: "Livres et fournitures scolaires" },
  "cat.Outros": { pt: "Outros", en: "Other", zh: "其他", fr: "Autres" },
  "cat.Mercearia e alimentação": { pt: "Mercearia e alimentação", en: "Groceries and food", zh: "杂货和食品", fr: "Épicerie et alimentation" },
  "cat.Bebidas": { pt: "Bebidas", en: "Drinks", zh: "饮料", fr: "Boissons" },
  "cat.Beleza e higiene": { pt: "Beleza e higiene", en: "Beauty and hygiene", zh: "美容和个护", fr: "Beauté et hygiène" },
  "cat.Casa e cozinha": { pt: "Casa e cozinha", en: "Home and kitchen", zh: "家居和厨房", fr: "Maison et cuisine" },
  "cat.Roupa e calçado": { pt: "Roupa e calçado", en: "Clothing and shoes", zh: "服装和鞋类", fr: "Vêtements et chaussures" },
  "cat.Telemóveis e acessórios": { pt: "Telemóveis e acessórios", en: "Phones and accessories", zh: "手机和配件", fr: "Téléphones et accessoires" },
  "cat.Informática e escritório": { pt: "Informática e escritório", en: "Computers and office", zh: "电脑和办公", fr: "Informatique et bureau" },
  "cat.Papelaria e escola": { pt: "Papelaria e escola", en: "Stationery and school", zh: "文具和学习用品", fr: "Papeterie et école" },
  "cat.Artigos para bebé": { pt: "Artigos para bebé", en: "Baby products", zh: "婴儿用品", fr: "Produits pour bébé" },
  "cat.Ferragens e construção": { pt: "Ferragens e construção", en: "Hardware and building", zh: "五金和建材", fr: "Quincaillerie et construction" },
  "cat.Saúde e bem-estar": { pt: "Saúde e bem-estar", en: "Health and wellness", zh: "健康和保健", fr: "Santé et bien-être" },
  "cat.Eletricistas": { pt: "Eletricistas", en: "Electricians", zh: "电工", fr: "Électriciens" },
  "cat.Canalizadores": { pt: "Canalizadores", en: "Plumbers", zh: "水管工", fr: "Plombiers" },
  "cat.Pedreiros": { pt: "Pedreiros", en: "Bricklayers", zh: "泥瓦匠", fr: "Maçons" },
  "cat.Pintores": { pt: "Pintores", en: "Painters", zh: "油漆工", fr: "Peintres" },
  "cat.Carpinteiros": { pt: "Carpinteiros", en: "Carpenters", zh: "木匠", fr: "Menuisiers" },
  "cat.Serralheiros": { pt: "Serralheiros", en: "Metalworkers", zh: "金属工", fr: "Serruriers" },
  "cat.Mecânicos": { pt: "Mecânicos", en: "Mechanics", zh: "机修工", fr: "Mécaniciens" },
  "cat.Técnicos de frio e ar condicionado": { pt: "Técnicos de frio e ar condicionado", en: "Refrigeration and AC technicians", zh: "制冷和空调技师", fr: "Techniciens en froid et climatisation" },
  "cat.Técnicos de informática": { pt: "Técnicos de informática", en: "IT technicians", zh: "电脑技术员", fr: "Techniciens informatiques" },
  "cat.Costureiras e alfaiates": { pt: "Costureiras e alfaiates", en: "Seamstresses and tailors", zh: "裁缝", fr: "Couturières et tailleurs" },
  "cat.Cabeleireiros e barbeiros": { pt: "Cabeleireiros e barbeiros", en: "Hairdressers and barbers", zh: "美发师和理发师", fr: "Coiffeurs et barbiers" },
  "cat.Esteticistas": { pt: "Esteticistas", en: "Beauticians", zh: "美容师", fr: "Esthéticiennes" },
  "cat.Fotógrafos e vídeo": { pt: "Fotógrafos e vídeo", en: "Photographers and video", zh: "摄影和摄像", fr: "Photographes et vidéo" },
  "cat.Explicadores": { pt: "Explicadores", en: "Tutors", zh: "家教", fr: "Professeurs particuliers" },
  "cat.Motoristas": { pt: "Motoristas", en: "Drivers", zh: "司机", fr: "Chauffeurs" },
  "cat.Enfermeiros": { pt: "Enfermeiros", en: "Nurses", zh: "护士", fr: "Infirmiers" },
  "cat.Cozinheiros e catering": { pt: "Cozinheiros e catering", en: "Cooks and catering", zh: "厨师和餐饮服务", fr: "Cuisiniers et traiteurs" },
  "cat.Seguranças": { pt: "Seguranças", en: "Security guards", zh: "保安", fr: "Agents de sécurité" },
  "cat.Reparações e manutenção": { pt: "Reparações e manutenção", en: "Repairs and maintenance", zh: "维修和保养", fr: "Réparations et entretien" },
  "cat.Beleza e bem-estar": { pt: "Beleza e bem-estar", en: "Beauty and wellness", zh: "美容和养生", fr: "Beauté et bien-être" },
  "cat.Eventos e festas": { pt: "Eventos e festas", en: "Events and parties", zh: "活动和派对", fr: "Événements et fêtes" },
  "cat.Educação e explicações": { pt: "Educação e explicações", en: "Education and tutoring", zh: "教育和辅导", fr: "Éducation et soutien scolaire" },
  "cat.Saúde": { pt: "Saúde", en: "Health", zh: "医疗健康", fr: "Santé" },
  "cat.Mudanças e fretes": { pt: "Mudanças e fretes", en: "Moving and freight", zh: "搬家和货运", fr: "Déménagements et fret" },
  "cat.Jardinagem": { pt: "Jardinagem", en: "Gardening", zh: "园艺", fr: "Jardinage" },
  "cat.Design e publicidade": { pt: "Design e publicidade", en: "Design and advertising", zh: "设计和广告", fr: "Design et publicité" },
  "cat.Supermercados": { pt: "Supermercados", en: "Supermarkets", zh: "超市", fr: "Supermarchés" },
  "cat.Salões de beleza": { pt: "Salões de beleza", en: "Beauty salons", zh: "美容院", fr: "Salons de beauté" },
  "cat.Ginásios": { pt: "Ginásios", en: "Gyms", zh: "健身房", fr: "Salles de sport" },
  "cat.Gráficas e papelarias": { pt: "Gráficas e papelarias", en: "Print shops and stationers", zh: "印刷和文具店", fr: "Imprimeries et papeteries" },
  "cat.Imobiliárias": { pt: "Imobiliárias", en: "Real estate agencies", zh: "房地产中介", fr: "Agences immobilières" },
  "cat.Stands de automóveis": { pt: "Stands de automóveis", en: "Car dealers", zh: "汽车销售商", fr: "Concessionnaires automobiles" },
  "cat.Bancos e câmbios": { pt: "Bancos e câmbios", en: "Banks and exchange", zh: "银行和兑换", fr: "Banques et bureaux de change" },
  "cat.Estágios não remunerados": { pt: "Estágios não remunerados", en: "Unpaid internships", zh: "无薪实习", fr: "Stages non rémunérés" },
  "cat.Armazéns": { pt: "Armazéns", en: "Wholesale", zh: "批发仓库", fr: "Vente en gros" },
  "cat.Importação": { pt: "Importação", en: "Imports", zh: "进口代购", fr: "Importation" },
  "cat.Eventos": { pt: "Eventos", en: "Events", zh: "活动", fr: "Événements" },
  "cat.Praças": { pt: "Praças", en: "Markets", zh: "市场", fr: "Marchés" },
  "cat.Loja": { pt: "Loja", en: "Shop", zh: "商店", fr: "Boutique" },
  "cat.Arrendar": { pt: "Arrendar", en: "Rent", zh: "租赁", fr: "Louer" },
  "cat.Leilões": { pt: "Leilões", en: "Auctions", zh: "拍卖", fr: "Enchères" },
  "cat.Procura-se": { pt: "Procura-se", en: "Wanted", zh: "求购", fr: "Recherche" },
  "cat.Trocas": { pt: "Trocas", en: "Swaps", zh: "以物易物", fr: "Échanges" },
  "cat.Perdidos e achados": { pt: "Perdidos e achados", en: "Lost and found", zh: "失物招领", fr: "Objets perdus" },
  "cat.Produtos": { pt: "Produtos", en: "Products", zh: "商品", fr: "Produits" },
  "cat.Profissionais": { pt: "Profissionais", en: "Professionals", zh: "专业人士", fr: "Professionnels" },
  "cat.Empresas": { pt: "Empresas", en: "Businesses", zh: "企业", fr: "Entreprises" }
};
/** Nome de uma categoria da página inicial na língua escolhida. */
export function categoryLabelIn(label: string, lang: Lang): string { return translate(COMMON_DICT, lang, "cat." + label) === "cat." + label ? label : translate(COMMON_DICT, lang, "cat." + label); }
