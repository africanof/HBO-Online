import type { Metadata } from "next";
import { HELP_FAQ, contactLine } from "@huambo-online/core";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Ajuda", description: "Perguntas frequentes: publicar, propostas, trocas, serviços, avaliações, verificação e segurança.", alternates: { canonical: "/ajuda" } };

export default function Ajuda() {
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/">← Início</a>
    <h1>❓ Ajuda</h1>
    <p style={{ fontSize: 19 }}>Respostas às perguntas mais comuns. Toque numa pergunta para ver a resposta.</p>
    <a className="btn secondary" href="/seguranca" style={{ justifySelf: "start" }}>🛡️ Segurança: pontos de encontro e sinais de burla</a>
    {HELP_FAQ.map(f => <details key={f.q} className="card faq"><summary><strong>{f.q}</strong></summary><p style={{ margin: 0, lineHeight: 1.6 }}>{f.a}</p></details>)}
    <section className="card"><h2 style={{ margin: 0 }}>Precisa de mais ajuda?</h2><p style={{ margin: 0 }}>{contactLine(CONTACT_EMAIL)}</p></section>
    <nav className="row" aria-label="Mais informação"><a href="/termos">Termos de Uso</a> · <a href="/privacidade">Política de Privacidade</a> · <a href="/devolucoes">Devoluções e reembolsos</a> · <a href="/apagar-conta">Como apagar a conta</a></nav>
  </main>;
}
