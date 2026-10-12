"use client";
import { useEffect, useState } from "react";
import { listMarkets, suggestMarket, marketSummary, friendlyError, type Market } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";
import { LiteImg } from "../../components/LiteImg";

export default function Pracas() {
  const [q, setQ] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const { municipalities } = useTerritory();
  const [items, setItems] = useState<Market[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); const [busy, setBusy] = useState(false);
  useEffect(() => { const start = new URLSearchParams(window.location.search).get("q") ?? ""; setQ(start); void search(undefined, start); }, []);
  async function search(e?: React.FormEvent, query = q) {
    e?.preventDefault(); setError("");
    const r = await listMarkets(supabase(), { query, municipalityId });
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as Market[]) ?? []);
  }
  async function suggest(e: React.FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    if (!(await currentUserId())) { window.location.href = "/conta/login?voltar=/pracas"; return; }
    setBusy(true);
    const r = await suggestMarket(supabase(), form); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Obrigado! A praça vai aparecer depois de a administração aprovar."); setForm({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); }
  }
  return <main className="stack">
    <a href="/">← Início</a>
    <section className="banner yellow">
      <div><h1 style={{ margin: 0 }}>🧺 Praças do Huambo</h1><p>Encontre o que se vende nas praças — Kapango, Ferro, Cassilhas, Alemanha e outras — e os vendedores de cada uma.</p></div>
    </section>
    <form onSubmit={search} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar praça…" style={{ maxWidth: 360 }} aria-label="Procurar praça" />
      <select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)} style={{ maxWidth: 240 }} aria-label="Município"><option value="">Todos os municípios</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <button type="submit">Procurar</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items?.length === 0 && <p>Nenhuma praça encontrada.</p>}
    <section className="grid">
      {items?.map(m => <a key={m.id} href={"/pracas/" + m.id} className="item card" style={{ padding: 12 }}>
        <div className="item-img" style={{ aspectRatio: "16/9" }}>{m.photo_url ? <LiteImg src={m.photo_url} alt="" loading="lazy" placeholder="🧺" /> : <span aria-hidden>🧺</span>}</div>
        <strong style={{ fontSize: 19 }}>{m.name}</strong>
        <span className="item-meta">📍 {[m.address_text, m.municipality_name].filter(Boolean).join(", ") || "Huambo"}</span>
        {m.opening_hours && <span className="item-meta">🕘 {m.opening_hours}</span>}
        <span><strong>{marketSummary(m)}</strong></span>
      </a>)}
    </section>
    <section className="card">
      <h2 style={{ margin: 0 }}>Falta alguma praça?</h2>
      {!form.open ? <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setForm({ ...form, open: true })}>+ Sugerir uma praça</button> :
        <form className="stack" onSubmit={suggest}>
          <label>Nome da praça<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Praça do São Pedro" /></label>
          <label>Município<select value={form.municipalityId} onChange={e => setForm({ ...form, municipalityId: e.target.value })}><option value="">Escolha…</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label>Bairro ou referência (opcional)<input value={form.addressText} onChange={e => setForm({ ...form, addressText: e.target.value })} /></label>
          <label>O que se vende lá? (opcional)<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          <div className="row"><button disabled={busy}>Enviar sugestão</button><button type="button" className="secondary" onClick={() => setForm({ ...form, open: false })}>Cancelar</button></div>
        </form>}
    </section>
  </main>;
}
