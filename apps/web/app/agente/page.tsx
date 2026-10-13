"use client";
import { useEffect, useState } from "react";
import { getMyAgentPanel, applyAsAgent, listMarketOptions, agentOfferText, agentInviteMessage, agentTotals, agentCommissionLine, whatsappShareUrl, formatPrice, friendlyError,
  AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, type AgentPanel } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";

export default function Agente() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<AgentPanel | null>(null); const [markets, setMarkets] = useState<{ id: string; name: string }[]>([]);
  const [marketId, setMarketId] = useState(""); const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const r = await getMyAgentPanel(supabase());
    if (r.error) { setError(friendlyError(r.error)); return; }
    setP(r.data);
    const a = r.data?.agent;
    if (a) { setMarketId(a.market_id ?? ""); setFullName(a.full_name); setPhone(a.phone); setNote(a.note ?? ""); }
  }
  useEffect(() => {
    void currentUserId().then(id => { setUid(id); if (id) void load(); });
    void listMarketOptions(supabase()).then(r => setMarkets((r.data ?? []) as { id: string; name: string }[]));
  }, []);
  async function apply(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    const r = await applyAsAgent(supabase(), { marketId, fullName, phone, note });
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setEditing(false); setNotice(p?.agent?.status === "active" ? "Dados guardados." : "Pedido enviado. A administração vai responder em breve.");
    await load();
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  const intro = <>
    <h1>🤝 Agentes no terreno</h1>
    <p style={{ margin: 0, fontSize: 19 }}>Trabalha numa praça (por exemplo, o Kapango)? Ajude os vendedores a pôr os anúncios no Huambo Online e ganhe uma comissão sempre que um desses anúncios for vendido.</p>
    {p && <p className="ok" style={{ margin: 0 }}>{agentOfferText(p.sale_pct)}</p>}
    <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 4 }}>
      <li>Peça para ser agente (escolha a sua praça). A administração confirma.</li>
      <li>Recebe um código, por exemplo <strong>AG1001</strong>.</li>
      <li>Ajude o vendedor a publicar <strong>na conta dele</strong> e peça-lhe para escrever o seu código.</li>
      <li>Quando o vendedor marcar o anúncio como <strong>vendido</strong>, ganha a sua parte do valor da venda.</li>
      <li>Depois de a administração confirmar, o valor entra no seu <a href="/conta/saldo">💰 saldo</a> e pode levantar.</li>
    </ol>
  </>;
  if (!uid) return <main className="stack" style={{ maxWidth: 820 }}>{intro}<p><a className="btn" href="/conta/login?voltar=/agente">Entrar para pedir</a></p></main>;
  const a = p?.agent, t = agentTotals(p);
  const form = <form className="card stack" onSubmit={apply} style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>{a ? "Os meus dados de agente" : "Pedir para ser agente"}</h2>
    <label>Praça onde trabalha<select value={marketId} onChange={e => setMarketId(e.target.value)}>
      <option value="">Escolha a praça</option>{markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label>Nome completo<input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={120} autoComplete="name" /></label>
    <label>Telefone<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="923 000 000" /></label>
    <label>Conte-nos um pouco (opcional)<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Ex.: vendo na banca 12 e conheço muitos vendedores." /></label>
    <div className="row"><button type="submit" disabled={busy}>{busy ? "A enviar…" : a ? "Guardar" : "Enviar pedido"}</button>{a && <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancelar</button>}</div>
  </form>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/conta">← A sua conta</a>
    {intro}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!a && form}
    {a && <>
      <section className="card" style={{ gap: 6 }}>
        <strong>{AGENT_STATUS_LABELS[a.status]}</strong>
        <span>{a.full_name} · 📍 {a.market_name ?? "—"} · 📞 {a.phone}</span>
        {a.status === "pending" && <span>Estamos a ver o seu pedido. Recebe um aviso quando for aprovado.</span>}
        {(a.status === "rejected" || a.status === "suspended") && a.admin_note && <span className="error">Motivo: {a.admin_note}</span>}
        {a.status === "rejected" && <span>Pode corrigir os dados e pedir outra vez.</span>}
        {a.status !== "suspended" && !editing && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setEditing(true)}>{a.status === "rejected" ? "Pedir outra vez" : "Mudar os meus dados"}</button>}
      </section>
      {editing && form}
      {a.status === "active" && <>
        <section className="card" style={{ gap: 8, textAlign: "center" }}>
          <span>O seu código</span>
          <strong style={{ fontSize: 40, letterSpacing: 2 }}>{a.code}</strong>
          <span>Peça ao vendedor para o escrever em «Código do agente» quando publicar.</span>
          <div className="row" style={{ justifyContent: "center" }}>
            <a className="btn" href={whatsappShareUrl(agentInviteMessage(a.code, a.full_name.split(" ")[0], window.location.origin))} target="_blank" rel="noopener">📲 Convidar vendedores no WhatsApp</a>
            <a className="btn secondary" href={"/classificados/publicar?agente=" + a.code}>+ Publicar com um vendedor</a>
          </div>
        </section>
        <section className="stats" aria-label="Resumo">
          <div className="stat"><strong>{t.listings}</strong><span>📋 Anúncios com o seu código</span></div>
          <div className="stat"><strong>{t.sold}</strong><span>🎉 Já vendidos</span></div>
          <div className="stat"><strong>{formatPrice(t.pending)}</strong><span>⏳ À espera de confirmação</span></div>
          <div className="stat"><strong>{formatPrice(t.approved)}</strong><span>✅ Já no saldo (total)</span></div>
        </section>
        <a className="btn secondary" href="/conta/saldo" style={{ justifySelf: "start" }}>💰 Ver o meu saldo e levantar</a>
      </>}
      {(p?.helped ?? []).length > 0 && <h2 style={{ margin: "8px 0 0" }}>Anúncios que ajudou a pôr</h2>}
      {(p?.helped ?? []).map(h => <article key={h.id} className="card" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><a href={"/classificados/" + h.id}>{h.title}</a>{h.price != null && <span>{formatPrice(h.price, h.currency ?? undefined)}</span>}</div>
        <small>{h.status === "sold" ? "🎉 Vendido" : h.status === "published" ? "À venda — ganha quando for vendido" : "Fora do ar"}</small>
      </article>)}
      {(p?.commissions ?? []).length > 0 && <h2 style={{ margin: "8px 0 0" }}>Comissões</h2>}
      {(p?.commissions ?? []).map(c => <article key={c.id} className="card" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>{c.listing_id && c.listing_status === "published" ? <a href={"/classificados/" + c.listing_id}>{c.listing_title}</a> : <span>{c.listing_title}</span>}<strong>{formatPrice(c.amount)}</strong></div>
        <span>{agentCommissionLine(c)}</span>
        <small>{new Date(c.created_at).toLocaleDateString("pt-AO")} · {AGENT_COMMISSION_STATUS_LABELS[c.status]}{c.admin_note ? " · " + c.admin_note : ""}</small>
      </article>)}
    </>}
  </main>;
}
