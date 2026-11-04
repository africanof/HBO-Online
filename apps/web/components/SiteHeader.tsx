"use client";
import { useEffect, useState } from "react";
import { getCurrentUserProfile, getMyAdminRole, canModerate, searchHref, SEARCH_SCOPES, LOGO_PARTS, INFO_LINKS, type SearchScope } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useUnreadCounts } from "./NotificationBell";
import { ThemePicker, ThemeToggle } from "./ThemePicker";
import { DataSaverPicker, DataSaverToggle } from "./DataSaver";
import { LanguagePicker } from "./LanguagePicker";
import { useT } from "../lib/i18n";

/** Cores do logótipo a partir do tema (claro/escuro). */
const LOGO_VARS = ["var(--logo-blue)", "var(--logo-red)", "var(--logo-yellow)", "var(--logo-green)"];

export function Logo({ size }: { size?: number }) {
  const { t } = useT();
  return <a href="/" className="logo" aria-label={t("hdr.logo_home")} style={size ? { fontSize: size } : undefined}>
    {/* Logótipo: um só nome para leitores de ecrã (as cores são a marca e estão isentas da regra de contraste). */}
    <span role="img" aria-label="Huambo Online">{LOGO_PARTS.map(([t], i) => <span key={t} aria-hidden="true" style={{ color: LOGO_VARS[i] }}>{t}</span>)}</span>
  </a>;
}

const SCOPE_BY_PATH: [string, SearchScope][] = [["/loja", "loja"], ["/pracas", "pracas"], ["/profissionais", "profissionais"], ["/empresas", "empresas"]];
/** [ícone, chave do texto, endereço] */
const CATEGORY_LINKS: [string, string, string][] = [
  ["", "nav.home", "/"], ["", "scope.classificados", "/explorar"], ["🏠", "cat.Imóveis", "/imoveis"], ["🚗", "cat.Viaturas", "/viaturas"], ["🌾", "cat.Campo", "/agricultura"], ["🏭", "cat.Fábricas", "/empresas?categoria=fabricas"], ["💼", "cat.Emprego", "/emprego"], ["🎟️", "cat.Eventos", "/eventos"], ["⛽", "web.fuel", "/combustivel"], ["🛎️", "nav.bookings", "/reservas"], ["✈️", "cat.Importação", "/importacao"], ["🎬", "web.videos", "/videos"],
  ["", "cat.Arrendar", "/explorar?finalidade=rent"], ["", "cat.Leilões", "/explorar?finalidade=auction"], ["", "cat.Procura-se", "/procura-se"], ["", "cat.Trocas", "/trocas"], ["", "cat.Praças", "/pracas"], ["", "web.events_tickets", "/eventos"], ["", "cat.Loja", "/loja"],
  ["", "cat.Profissionais", "/profissionais"], ["", "cat.Empresas", "/empresas"], ["", "web.recent", "/historico"]
];

/** Cabeçalho de todas as páginas: saudação, pesquisa grande, ícones e barra de categorias. */
export function SiteHeader() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [admin, setAdmin] = useState(false);
  const [q, setQ] = useState(""); const [scope, setScope] = useState<SearchScope>("classificados");
  const counts = useUnreadCounts();
  const { t } = useT();
  const [helloA, helloB] = t("hdr.hello_named").split("{name}");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQ(params.get("q") ?? "");
    const match = SCOPE_BY_PATH.find(([p]) => window.location.pathname.startsWith(p));
    if (match) setScope(match[1]);
    if (!supabaseConfigured) { setName(null); return; }
    const c = supabase();
    void c.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setName(null); return; }
      const p = await getCurrentUserProfile(c);
      setName(p.data?.fullName?.split(" ")[0] || "");
      setAdmin(canModerate(await getMyAdminRole(c)));
    });
  }, []);

  function submit(e: React.FormEvent) { e.preventDefault(); window.location.href = searchHref(scope, q); }

  return <header>
    <div className="topbar"><div className="topbar-in">
      {name === undefined ? <span>&nbsp;</span> : name === null
        ? <span>{t("auth.hello")} <a href="/conta/login" style={{ color: "var(--accent)", textDecoration: "underline" }}>{t("auth.login")}</a> {t("hdr.or")} <a href="/conta/criar" style={{ color: "var(--accent)", textDecoration: "underline" }}>{t("auth.signup_lower")}</a></span>
        : <span>{helloA}<strong>{name || t("hdr.welcome")}</strong>{helloB}</span>}
      <a className="hide-sm" href="/pracas">{t("nav.markets")}</a>
      <a className="hide-sm" href="/loja">{t("nav.shop")}</a>
      <a className="hide-sm" href="/profissionais">{t("nav.services")}</a>
      <a className="hide-sm" href="/empresas">{t("nav.businesses")}</a>
      <span className="spacer" />
      <LanguagePicker variant="compact" />
      <DataSaverToggle />
      <ThemeToggle />
      <a href="/classificados/publicar"><strong>{t("nav.sell")}</strong></a>
      <a className="hide-sm" href="/guardados">{t("nav.saved")}</a>
      <a className="hide-sm" href="/conta">{t("nav.account")}</a>
      {admin && <a href="/admin">{t("nav.admin")}</a>}
    </div></div>
    <div className="header">
      <Logo />
      <form className="searchform" role="search" onSubmit={submit}>
        <div className="search">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("common.search_placeholder")} aria-label={t("nav.search")} />
          <select value={scope} onChange={e => setScope(e.target.value as SearchScope)} aria-label={t("hdr.where")}>
            {SEARCH_SCOPES.map(s => <option key={s.value} value={s.value}>{t("scope." + s.value)}</option>)}
          </select>
        </div>
        <a className="icon-btn" href="/pesquisar-foto" aria-label={t("hdr.photo_search")} title={t("hdr.photo_search")} style={{ alignSelf: "center" }}>📷</a>
        <button className="search-btn" type="submit">{t("nav.search")}</button>
      </form>
      <nav className="icons" aria-label={t("hdr.shortcuts")}>
        <a className="icon-btn" href="/notificacoes" aria-label={t("hdr.notif_unread", { n: counts.notifications })}>🔔{counts.notifications > 0 && <span className="count">{counts.notifications}</span>}</a>
        <a className="icon-btn" href="/mensagens" aria-label={t("hdr.msg_unread", { n: counts.messages })}>💬{counts.messages > 0 && <span className="count">{counts.messages}</span>}</a>
        <a className="icon-btn" href="/conta" aria-label={t("nav.account")}>👤</a>
        <a className="icon-btn" href="/carrinho" aria-label={t("hdr.cart_items", { n: counts.cart })}>🛒{counts.cart > 0 && <span className="count">{counts.cart}</span>}</a>
      </nav>
    </div>
    <nav className="catnav" aria-label={t("home.categories")}><div className="catnav-in">
      {CATEGORY_LINKS.map(([icon, k, h]) => <a key={k} href={h}>{icon ? icon + " " : ""}{t(k)}</a>)}
    </div></nav>
  </header>;
}

export function SiteFooter() {
  const { t } = useT();
  // Textos já traduzidos: [título, [texto, endereço][]]
  const cols: [string, [string, string][]][] = [
    [t("ft.buy"), [[t("scope.classificados"), "/explorar"], [t("ft.wanted_requests"), "/procura-se"], [t("ft.post_wanted"), "/classificados/publicar?finalidade=wanted"], [t("cat.Trocas"), "/trocas"], [t("ft.farming"), "/agricultura"], [t("nav.markets"), "/pracas"], [t("nav.shop"), "/loja"], [t("cat.Leilões"), "/explorar?finalidade=auction"], [t("ft.cart"), "/carrinho"], [t("ft.orders"), "/encomendas"]]],
    [t("nav.sell"), [[t("ft.post_ad"), "/classificados/publicar"], [t("ft.my_ads"), "/meus-anuncios"], [t("ft.sell_products"), "/conta/produtos"], [t("ft.rentals"), "/alugueres"]]],
    [t("nav.services"), [[t("cat.Profissionais"), "/profissionais"], [t("nav.businesses"), "/empresas"], [t("ft.be_pro"), "/conta/profissional"], [t("ft.be_courier"), "/entregas"], [t("ft.be_agent"), "/agente"], [t("ft.organize_event"), "/eventos/meus"], [t("ft.post_video"), "/videos/meus"], [t("ft.register_fuel"), "/combustivel/meus"], [t("ft.register_venue"), "/reservas/painel"], [t("cat.Importação"), "/importacao"], [t("ft.invite"), "/convidar"]]],
    [t("nav.account"), [[t("nav.account_short"), "/conta"], [t("nav.messages"), "/mensagens"], [t("nav.notifications"), "/notificacoes"], [t("nav.saved"), "/guardados"], [t("ft.my_bids"), "/licitacoes"], [t("ft.saved_searches"), "/pesquisas-guardadas"]]],
    [t("ft.local"), [[t("ft.about"), "/sobre"], [t("ft.all_municipalities"), "/huambo"], [t("ft.houses_sale"), "/huambo/huambo/casas-a-venda"], [t("ft.houses_rent"), "/huambo/huambo/casas-para-arrendar"],
      [t("ft.land_sale"), "/huambo/huambo/terrenos-a-venda"], [t("ft.cars_sale"), "/huambo/huambo/carros-a-venda"], [t("ft.jobs_local"), "/huambo/huambo/emprego"], ["Caála", "/huambo/caala"], ["Bailundo", "/huambo/bailundo"]]],
    [t("ft.help_info"), INFO_LINKS.map(l => [infoLabel(l.href, l.label, t), l.href] as [string, string])]
  ];
  return <footer className="footer"><div className="footer-in">
    {cols.map(([title, links]) => <nav key={title} aria-label={title}><h3>{title}</h3>{links.map(([l, h]) => <a key={h} href={h}>{l}</a>)}</nav>)}
    <div className="stack" style={{ gap: 6 }}><h3 style={{ margin: 0 }}>{t("nav.appearance")}</h3><ThemePicker /><h3 style={{ margin: "8px 0 0" }}>{t("nav.data_saver")}</h3><DataSaverPicker /><h3 style={{ margin: "8px 0 0" }}>🌐 {t("lang.choose")}</h3><LanguagePicker /></div>
    <small>© {new Date().getFullYear()} Huambo Online · {t("ft.tagline")}</small>
  </div></footer>;
}

/** Nome traduzido das páginas de ajuda (o core só tem o português). */
const INFO_KEYS: Record<string, string> = { "/ajuda": "nav.help", "/termos": "nav.terms", "/privacidade": "nav.privacy", "/seguranca": "info./seguranca", "/devolucoes": "info./devolucoes", "/apagar-conta": "info./apagar-conta" };
function infoLabel(href: string, fallback: string, t: (k: string) => string): string { return INFO_KEYS[href] ? t(INFO_KEYS[href]) : fallback; }
