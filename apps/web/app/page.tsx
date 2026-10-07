const modules = [
  ["Explorar classificados", "Pesquisar anúncios de compra, venda e aluguer.", "/explorar"],
  ["Loja", "Comprar produtos de vendedores do Huambo.", "/loja"],
  ["Profissionais e serviços", "Eletricistas, advogados, técnicos, explicadores…", "/profissionais"],
  ["Empresas e lojas", "Farmácias, oficinas, lojas, restaurantes…", "/empresas"],
  ["Publicar anúncio", "Venda ou arrende com fotografias.", "/classificados/publicar"],
  ["Os meus anúncios", "Editar, pausar ou apagar os seus anúncios.", "/meus-anuncios"],
  ["Mensagens", "Converse com anunciantes e compradores.", "/mensagens"],
  ["Notificações", "Acompanhe alertas e novidades.", "/notificacoes"],
  ["Pesquisas guardadas", "Receba alertas de novos anúncios.", "/pesquisas-guardadas"],
  ["Guardados", "Os anúncios que guardou.", "/guardados"],
  ["Conta", "Perfil, segurança e privacidade.", "/conta"]
];

export default function Home() {
  return (
    <main>
      <p style={{ fontWeight: 800, letterSpacing: 1 }}>HUAMBO ONLINE</p>
      <h1>Tudo o que o Huambo tem para oferecer.</h1>
      <p style={{ fontSize: 19, maxWidth: 760 }}>Negócios, profissionais, produtos, serviços e classificados num único lugar.</p>
      <div className="row" style={{ margin: "20px 0" }}>
        <a className="btn" href="/classificados/publicar">+ Publicar anúncio</a>
        <a className="btn secondary" href="/explorar">Ver anúncios</a>
      </div>
      <nav className="grid">
        {modules.map(([title, description, href]) => (
          <a key={href} href={href} className="card" style={{ color: "inherit", textDecoration: "none" }}>
            <strong style={{ fontSize: 20 }}>{title}</strong><span>{description}</span>
          </a>
        ))}
      </nav>
      <div className="row" style={{ marginTop: 28 }}>
        <a href="/conta/login">Entrar</a><a href="/conta/criar">Criar conta</a>
      </div>
    </main>
  );
}
