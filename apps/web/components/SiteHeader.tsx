"use client";
import { useEffect, useState } from "react";
import { getCurrentUserProfile, getMyAdminRole, canModerate, searchHref, SEARCH_SCOPES, LOGO_PARTS, INFO_LINKS, type SearchScope } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useUnreadCounts } from "./NotificationBell";
import { ThemePicker, ThemeToggle } from "./ThemePicker";
import { DataSaverPicker, DataSaverToggle } from "./DataSaver";

/** Cores do logótipo a partir do tema (claro/escuro). */
const LOGO_VARS = ["var(--logo-blue)", "var(--logo-red)", "var(--logo-yellow)", "var(--logo-green)"];

export function Logo({ size }: { size?: number }) {
  return <a href="/" className="logo" aria-label="Huambo Online — página inicial" style={size ? { fontSize: size } : undefined}>
    {/* Logótipo: um só nome para leitores de ecrã (as cores são a marca e estão isentas da regra de contraste). */}
    <span role="img" aria-label="Huambo Online">{LOGO_PARTS.map(([t], i) => <span key={t} aria-hidden="true" style={{ color: LOGO_VARS[i] }}>{t}</span>)}</span>
  </a>;
}

const SCOPE_BY_PATH: [string, SearchScope][] = [["/loja", "loja"], ["/pracas", "pracas"], ["/profissionais", "profissionais"], ["/empresas", "empresas"]];
const CATEGORY_LINKS: [string, string][] = [
  ["Início", "/"], ["Classificados", "/explorar"], ["Imóveis", "/explorar?tipo=real_estate"], ["Viaturas", "/explorar?tipo=vehicle"], ["🌾 Campo", "/agricultura"], ["🎟️ Eventos", "/eventos"],
  ["Arrendar", "/explorar?finalidade=rent"], ["Leilões", "/explorar?finalidade=auction"], ["Procura-se", "/procura-se"], ["Trocas", "/trocas"], ["Praças", "/pracas"], ["Eventos e bilhetes", "/eventos"], ["Loja", "/loja"],
  ["Profissionais", "/profissionais"], ["Empresas", "/empresas"], ["Vistos recentemente", "/historico"]
];

/** Cabeçalho de todas as páginas: saudação, pesquisa grande, ícones e barra de categorias. */
export function SiteHeader() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [admin, setAdmin] = useState(false);
  const [q, setQ] = useState(""); const [scope, setScope] = useState<SearchScope>("classificados");
  const counts = useUnreadCounts();

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
        ? <span>Olá! <a href="/conta/login" style={{ color: "var(--accent)", textDecoration: "underline" }}>Entrar</a> ou <a href="/conta/criar" style={{ color: "var(--accent)", textDecoration: "underline" }}>criar conta</a></span>
        : <span>Olá, <strong>{name || "bem-vindo"}</strong>!</span>}
      <a className="hide-sm" href="/pracas">Praças</a>
      <a className="hide-sm" href="/loja">Loja</a>
      <a className="hide-sm" href="/profissionais">Serviços</a>
      <a className="hide-sm" href="/empresas">Empresas</a>
      <span className="spacer" />
      <DataSaverToggle />
      <ThemeToggle />
      <a href="/classificados/publicar"><strong>Vender</strong></a>
      <a className="hide-sm" href="/guardados">Guardados</a>
      <a className="hide-sm" href="/conta">A minha conta</a>
      {admin && <a href="/admin">Administração</a>}
    </div></div>
    <div className="header">
      <Logo />
      <form className="searchform" role="search" onSubmit={submit}>
        <div className="search">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="O que procura?" aria-label="Pesquisar" />
          <select value={scope} onChange={e => setScope(e.target.value as SearchScope)} aria-label="Onde pesquisar">
            {SEARCH_SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <a className="icon-btn" href="/pesquisar-foto" aria-label="Pesquisar por fotografia" title="Pesquisar por fotografia" style={{ alignSelf: "center" }}>📷</a>
        <button className="search-btn" type="submit">Pesquisar</button>
      </form>
      <nav className="icons" aria-label="Atalhos">
        <a className="icon-btn" href="/notificacoes" aria-label={`Notificações (${counts.notifications} por ler)`}>🔔{counts.notifications > 0 && <span className="count">{counts.notifications}</span>}</a>
        <a className="icon-btn" href="/mensagens" aria-label={`Mensagens (${counts.messages} por ler)`}>💬{counts.messages > 0 && <span className="count">{counts.messages}</span>}</a>
        <a className="icon-btn" href="/conta" aria-label="A minha conta">👤</a>
        <a className="icon-btn" href="/carrinho" aria-label={`Carrinho (${counts.cart} artigos)`}>🛒{counts.cart > 0 && <span className="count">{counts.cart}</span>}</a>
      </nav>
    </div>
    <nav className="catnav" aria-label="Categorias"><div className="catnav-in">
      {CATEGORY_LINKS.map(([l, h]) => <a key={h} href={h}>{l}</a>)}
    </div></nav>
  </header>;
}

export function SiteFooter() {
  const cols: [string, [string, string][]][] = [
    ["Comprar", [["Classificados", "/explorar"], ["Procura-se (pedidos)", "/procura-se"], ["Publicar o que procuro", "/classificados/publicar?finalidade=wanted"], ["Trocas", "/trocas"], ["Agricultura e campo", "/agricultura"], ["Praças", "/pracas"], ["Loja", "/loja"], ["Leilões", "/explorar?finalidade=auction"], ["Carrinho", "/carrinho"], ["Encomendas", "/encomendas"]]],
    ["Vender", [["Publicar anúncio", "/classificados/publicar"], ["Os meus anúncios", "/meus-anuncios"], ["Vender produtos", "/conta/produtos"], ["Alugueres", "/alugueres"]]],
    ["Serviços", [["Profissionais", "/profissionais"], ["Empresas", "/empresas"], ["Ser profissional", "/conta/profissional"], ["Ser estafeta", "/entregas"], ["Ser agente nas praças", "/agente"], ["Organizar um evento", "/eventos/meus"], ["Convide um amigo", "/convidar"]]],
    ["A minha conta", [["Conta", "/conta"], ["Mensagens", "/mensagens"], ["Notificações", "/notificacoes"], ["Guardados", "/guardados"], ["As minhas licitações", "/licitacoes"], ["Pesquisas guardadas", "/pesquisas-guardadas"]]],
    ["Ajuda e informação", INFO_LINKS.map(l => [l.label, l.href] as [string, string])]
  ];
  return <footer className="footer"><div className="footer-in">
    {cols.map(([title, links]) => <nav key={title} aria-label={title}><h3>{title}</h3>{links.map(([l, h]) => <a key={h} href={h}>{l}</a>)}</nav>)}
    <div className="stack" style={{ gap: 6 }}><h3 style={{ margin: 0 }}>Aparência</h3><ThemePicker /><h3 style={{ margin: "8px 0 0" }}>Poupar dados</h3><DataSaverPicker /></div>
    <small>© {new Date().getFullYear()} Huambo Online · Comércio, serviços e negócios do Huambo.</small>
  </div></footer>;
}
