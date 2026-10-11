export default function NotFound() {
  return <main className="stack" style={{ textAlign: "center", justifyItems: "center", paddingTop: 48 }}>
    <span style={{ fontSize: 72 }} aria-hidden>🧭</span>
    <h1>Página não encontrada</h1>
    <p style={{ maxWidth: 520 }}>O endereço pode estar errado, ou a página foi retirada. Se acabou de ser publicada, espere um minuto e tente de novo.</p>
    <div className="row" style={{ justifyContent: "center" }}>
      <a className="btn" href="/">Ir para o início</a>
      <a className="btn secondary" href="/explorar">Ver anúncios</a>
      <a className="btn secondary" href="/pracas">Praças</a>
    </div>
  </main>;
}
