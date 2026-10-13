import type { Metadata } from "next";
import { SAFETY_TIPS, SCAM_WARNING_TEXT } from "@huambo-online/core";
import { SafeSpotsList } from "../../components/Safety";

export const metadata: Metadata = { title: "Segurança", description: "Como comprar e vender em segurança no Huambo: pontos de encontro seguros, sinais de burla, bloquear e denunciar.", alternates: { canonical: "/seguranca" } };

export default function Seguranca() {
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/ajuda">← Ajuda</a>
    <h1>🛡️ Comprar e vender em segurança</h1>
    <p style={{ fontSize: 19, margin: 0 }}>A maior parte das pessoas é honesta. Estas regras simples protegem-no das poucas que não são.</p>
    <section className="card"><h2 style={{ margin: 0 }}>✅ Regras de ouro</h2><ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{SAFETY_TIPS.map(t => <li key={t}>{t}</li>)}</ul></section>
    <section className="card"><h2 style={{ margin: 0 }}>📍 Pontos de encontro seguros</h2><p style={{ margin: 0 }}>Para ver o artigo e pagar, combine num destes lugares:</p><SafeSpotsList /></section>
    <section className="card"><h2 style={{ margin: 0 }}>⚠️ Sinais de burla</h2><p style={{ margin: 0 }}>Nas mensagens, o Huambo Online avisa-o quando a outra pessoa:</p><ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{Object.values(SCAM_WARNING_TEXT).map(t => <li key={t}>{t}</li>)}</ul></section>
    <section className="card"><h2 style={{ margin: 0 }}>🚫 Bloquear e 🚩 Denunciar</h2><p style={{ margin: 0 }}>Numa conversa, carregue em «🚫 Bloquear» para deixar de receber mensagens dessa pessoa e em «🚩 Denunciar» para avisar a administração. Na Loja, use o Pagamento protegido quando estiver disponível: o dinheiro só chega ao vendedor depois de receber a encomenda.</p></section>
  </main>;
}
