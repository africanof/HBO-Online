/**
 * Várias línguas (igual no Site e na APP): português (Angola), inglês e mandarim (chinês simplificado).
 * O português é a língua base: se faltar uma tradução, mostra-se o texto em português.
 * Cada app junta os seus próprios textos com `mergeDictionaries` (sem tocar neste ficheiro).
 */
export type Lang = "pt" | "en" | "zh";
export const LANGS: Lang[] = ["pt", "en", "zh"];
export const DEFAULT_LANG: Lang = "pt";
export const LANG_LABELS: Record<Lang, string> = { pt: "Português", en: "English", zh: "中文" };
export const LANG_FLAGS: Record<Lang, string> = { pt: "🇦🇴", en: "🇬🇧", zh: "🇨🇳" };
/** Etiqueta HTML/acessibilidade. */
export const LANG_TAGS: Record<Lang, string> = { pt: "pt-AO", en: "en", zh: "zh-Hans" };
export const LANG_COOKIE = "lang";
export const LANG_STORAGE_KEY = "huambo-online:lang";

export type Dictionary = Record<string, Partial<Record<Lang, string>> & { pt: string }>;

export function isLang(v: unknown): v is Lang { return v === "pt" || v === "en" || v === "zh"; }
/** «en-GB,en;q=0.9» / «zh-CN» / «pt-PT» → língua suportada (português por omissão). */
export function detectLang(input: string | readonly string[] | null | undefined): Lang {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  for (const raw of list) {
    const code = String(raw).trim().split(";")[0].toLowerCase();
    if (code.startsWith("pt")) return "pt";
    if (code.startsWith("en")) return "en";
    if (code.startsWith("zh")) return "zh";
  }
  return DEFAULT_LANG;
}
export function mergeDictionaries(...ds: Dictionary[]): Dictionary { return Object.assign({}, ...ds); }
/** Texto traduzido; «{nome}» é trocado pelos valores. Chave desconhecida → a própria chave (para dar por ela). */
export function translate(dict: Dictionary, lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const e = dict[key];
  let s = e ? (e[lang] ?? e.pt) : key;
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
  "lang.choose": { pt: "Língua", en: "Language", zh: "语言" },
  "lang.saved": { pt: "Língua alterada.", en: "Language changed.", zh: "语言已更改。" },
  "app.tagline": { pt: "Compre, venda e encontre tudo no Huambo", en: "Buy, sell and find everything in Huambo", zh: "在万博买卖、寻找一切" },
  "nav.home": { pt: "Início", en: "Home", zh: "首页" },
  "nav.explore": { pt: "Explorar", en: "Explore", zh: "浏览" },
  "nav.search": { pt: "Pesquisar", en: "Search", zh: "搜索" },
  "nav.sell": { pt: "Vender", en: "Sell", zh: "出售" },
  "nav.messages": { pt: "Mensagens", en: "Messages", zh: "消息" },
  "nav.account": { pt: "A minha conta", en: "My account", zh: "我的账户" },
  "nav.account_short": { pt: "Conta", en: "Account", zh: "账户" },
  "nav.saved": { pt: "Guardados", en: "Saved", zh: "收藏" },
  "nav.notifications": { pt: "Notificações", en: "Notifications", zh: "通知" },
  "nav.admin": { pt: "Administração", en: "Administration", zh: "管理" },
  "nav.shop": { pt: "Loja", en: "Shop", zh: "商店" },
  "nav.services": { pt: "Serviços", en: "Services", zh: "服务" },
  "nav.businesses": { pt: "Empresas", en: "Businesses", zh: "企业" },
  "nav.markets": { pt: "Praças", en: "Markets", zh: "市场" },
  "nav.help": { pt: "Ajuda", en: "Help", zh: "帮助" },
  "nav.terms": { pt: "Termos de Uso", en: "Terms of Use", zh: "使用条款" },
  "nav.privacy": { pt: "Política de Privacidade", en: "Privacy Policy", zh: "隐私政策" },
  "nav.appearance": { pt: "Aparência", en: "Appearance", zh: "外观" },
  "nav.data_saver": { pt: "Poupar dados", en: "Data saver", zh: "节省流量" },
  "nav.bookings": { pt: "Reservas", en: "Bookings", zh: "预订" },
  "auth.login": { pt: "Entrar", en: "Sign in", zh: "登录" },
  "auth.logout": { pt: "Sair", en: "Sign out", zh: "退出" },
  "auth.signup": { pt: "Criar conta", en: "Create account", zh: "注册账户" },
  "auth.signup_lower": { pt: "criar conta", en: "create account", zh: "注册账户" },
  "auth.hello": { pt: "Olá!", en: "Hello!", zh: "您好！" },
  "auth.hello_name": { pt: "Olá, {name}", en: "Hello, {name}", zh: "您好，{name}" },
  "auth.full_name": { pt: "Nome completo", en: "Full name", zh: "全名" },
  "auth.email": { pt: "E-mail", en: "Email", zh: "电子邮箱" },
  "auth.phone": { pt: "Telefone", en: "Phone", zh: "电话" },
  "auth.municipality": { pt: "Município", en: "Municipality", zh: "市镇" },
  "auth.password": { pt: "Palavra-passe", en: "Password", zh: "密码" },
  "auth.password_min": { pt: "Palavra-passe (mínimo 8 caracteres)", en: "Password (at least 8 characters)", zh: "密码（至少8个字符）" },
  "auth.password_confirm": { pt: "Confirmar palavra-passe", en: "Confirm password", zh: "确认密码" },
  "auth.forgot": { pt: "Esqueci-me da palavra-passe", en: "I forgot my password", zh: "忘记密码" },
  "auth.no_account": { pt: "Ainda não tem conta?", en: "Don't have an account yet?", zh: "还没有账户？" },
  "auth.have_account": { pt: "Já tem conta?", en: "Already have an account?", zh: "已有账户？" },
  "auth.signing_in": { pt: "A entrar…", en: "Signing in…", zh: "正在登录…" },
  "auth.creating": { pt: "A criar a conta…", en: "Creating account…", zh: "正在创建账户…" },
  "auth.check_email": { pt: "Conta criada! Abra o e-mail que lhe enviámos para confirmar a conta.", en: "Account created! Open the email we sent you to confirm your account.", zh: "账户已创建！请打开我们发送给您的邮件以确认账户。" },
  "auth.mfa_title": { pt: "Código da APP autenticadora", en: "Authenticator app code", zh: "身份验证器应用代码" },
  "auth.mfa_hint": { pt: "Escreva os 6 algarismos que aparecem na APP autenticadora.", en: "Enter the 6 digits shown in your authenticator app.", zh: "请输入身份验证器应用中显示的6位数字。" },
  "common.loading": { pt: "A carregar…", en: "Loading…", zh: "加载中…" },
  "common.save": { pt: "Guardar", en: "Save", zh: "保存" },
  "common.cancel": { pt: "Cancelar", en: "Cancel", zh: "取消" },
  "common.confirm": { pt: "Confirmar", en: "Confirm", zh: "确认" },
  "common.send": { pt: "Enviar", en: "Send", zh: "发送" },
  "common.back": { pt: "Voltar", en: "Back", zh: "返回" },
  "common.close": { pt: "Fechar", en: "Close", zh: "关闭" },
  "common.edit": { pt: "Editar", en: "Edit", zh: "编辑" },
  "common.delete": { pt: "Apagar", en: "Delete", zh: "删除" },
  "common.see_all": { pt: "Ver tudo", en: "See all", zh: "查看全部" },
  "common.see_more": { pt: "Ver mais", en: "See more", zh: "查看更多" },
  "common.share": { pt: "Partilhar", en: "Share", zh: "分享" },
  "common.call": { pt: "Ligar", en: "Call", zh: "致电" },
  "common.whatsapp": { pt: "Falar no WhatsApp", en: "Chat on WhatsApp", zh: "通过WhatsApp联系" },
  "common.search_placeholder": { pt: "O que procura?", en: "What are you looking for?", zh: "您在找什么？" },
  "common.offline": { pt: "Sem internet — a mostrar o que ficou guardado.", en: "No internet — showing saved content.", zh: "无网络——正在显示已保存的内容。" },
  "common.error": { pt: "Não foi possível concluir. Tente novamente.", en: "Something went wrong. Please try again.", zh: "操作未完成，请重试。" },
  "common.price_on_request": { pt: "Preço a combinar", en: "Price on request", zh: "价格面议" },
  "common.verified": { pt: "Verificado", en: "Verified", zh: "已认证" },
  "home.categories": { pt: "Categorias", en: "Categories", zh: "分类" },
  "home.latest": { pt: "Anúncios recentes", en: "Latest listings", zh: "最新信息" },
  "home.events": { pt: "Próximos eventos", en: "Upcoming events", zh: "近期活动" },
  "home.providers": { pt: "Profissionais", en: "Professionals", zh: "专业人士" },
  "home.products": { pt: "Produtos da Loja", en: "Shop products", zh: "商店商品" },
  "home.wanted": { pt: "Procura-se", en: "Wanted", zh: "求购" },
  "home.trades": { pt: "Trocas", en: "Swaps", zh: "以物易物" },
  "cat.Imóveis": { pt: "Imóveis", en: "Real estate", zh: "房产" },
  "cat.Viaturas": { pt: "Viaturas", en: "Vehicles", zh: "车辆" },
  "cat.Campo": { pt: "Campo", en: "Farming", zh: "农业" },
  "cat.Fábricas": { pt: "Fábricas", en: "Factories", zh: "工厂" },
  "cat.Combustível e gás": { pt: "Combustível e gás", en: "Fuel and gas", zh: "燃油和燃气" },
  "cat.Hotéis": { pt: "Hotéis", en: "Hotels", zh: "酒店" },
  "cat.Restaurantes": { pt: "Restaurantes", en: "Restaurants", zh: "餐厅" },
  "cat.Armazéns": { pt: "Armazéns", en: "Wholesale", zh: "批发仓库" },
  "cat.Eventos": { pt: "Eventos", en: "Events", zh: "活动" },
  "cat.Praças": { pt: "Praças", en: "Markets", zh: "市场" },
  "cat.Loja": { pt: "Loja", en: "Shop", zh: "商店" },
  "cat.Arrendar": { pt: "Arrendar", en: "Rent", zh: "租赁" },
  "cat.Leilões": { pt: "Leilões", en: "Auctions", zh: "拍卖" },
  "cat.Procura-se": { pt: "Procura-se", en: "Wanted", zh: "求购" },
  "cat.Trocas": { pt: "Trocas", en: "Swaps", zh: "以物易物" },
  "cat.Produtos": { pt: "Produtos", en: "Products", zh: "商品" },
  "cat.Profissionais": { pt: "Profissionais", en: "Professionals", zh: "专业人士" },
  "cat.Empresas": { pt: "Empresas", en: "Businesses", zh: "企业" }
};
/** Nome de uma categoria da página inicial na língua escolhida. */
export function categoryLabelIn(label: string, lang: Lang): string { return translate(COMMON_DICT, lang, "cat." + label) === "cat." + label ? label : translate(COMMON_DICT, lang, "cat." + label); }
