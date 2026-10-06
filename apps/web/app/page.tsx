const modules = [
  ["Explorar", "Pesquisar produtos, serviços e classificados.", "/explorar"],
  ["Classificados", "Anúncios de compra, venda e aluguer.", "/explorar"],
  ["Mensagens", "Converse com empresas, profissionais e anunciantes.", "/mensagens"],
  ["Notificações", "Acompanhe alertas e novidades da plataforma.", "/notificacoes"],
  ["Pesquisas guardadas", "Guarde pesquisas e receba alertas.", "/pesquisas-guardadas"],
  ["Guardados", "Veja os anúncios que guardou.", "/guardados"],
  ["Conta", "Gerir perfil e atividades da sua conta.", "/conta"],
];

export default function Home() {
  return (
    <main style={{maxWidth:1100,margin:"0 auto",padding:"40px 24px"}}>
      <p style={{fontWeight:800,letterSpacing:1}}>HUAMBO ONLINE</p>
      <h1 style={{fontSize:"clamp(32px,6vw,56px)",marginBottom:12}}>Tudo o que o Huambo tem para oferecer.</h1>
      <p style={{fontSize:18,lineHeight:1.6,maxWidth:760}}>
        Negócios, profissionais, produtos, serviços, marketplace e logística num único ecossistema.
      </p>
      <nav style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginTop:30}}>
        {modules.map(([title,description,href]) => (
          <a key={href} href={href} style={{display:"block",padding:20,border:"1px solid #ddd",borderRadius:16,color:"inherit",textDecoration:"none"}}>
            <h2 style={{margin:"0 0 8px"}}>{title}</h2><p style={{margin:0,lineHeight:1.5}}>{description}</p>
          </a>
        ))}
      </nav>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:28}}>
        <a href="/conta/login">Entrar</a><a href="/conta/criar">Criar conta</a>
      </div>
    </main>
  );
}
