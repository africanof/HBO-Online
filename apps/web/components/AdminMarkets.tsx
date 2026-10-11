"use client";
import { useEffect, useState } from "react";
import { listMarketsForAdmin, saveMarket, setMarketStatus, friendlyError, MARKET_STATUS_LABELS, type MarketStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useTerritory } from "./Directory";

const empty = { name: "", municipalityId: "", addressText: "", openingHours: "", photoUrl: "", description: "" };

/** Administração das praças: aprovar sugestões, editar dados e esconder. */
export function AdminMarkets() {
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const { municipalities } = useTerritory();
  async function load() { const r = await listMarketsForAdmin(supabase()); if (r.error) setError(friendlyError(r.error)); else setItems(r.data ?? []); }
  useEffect(() => { void load(); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); setForm(empty); setEditing(null); await load(); }
  }
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <h2>Praças ({items.length})</h2>
    {items.map(m => <div key={m.id} className="card">
      <strong>{m.name} · <span className="badge">{MARKET_STATUS_LABELS[m.status as MarketStatus]}</span></strong>
      <span className="item-meta">{[m.address_text, m.municipalities?.name, m.opening_hours].filter(Boolean).join(" · ") || "Sem morada nem horário"}</span>
      {m.description && <span>{m.description}</span>}
      <div className="row">
        {m.status !== "active" && <button onClick={() => act(() => setMarketStatus(supabase(), m.id, "active"), "Praça visível.")}>{m.status === "pending" ? "Aprovar" : "Mostrar"}</button>}
        {m.status !== "hidden" && <button className="secondary" onClick={() => act(() => setMarketStatus(supabase(), m.id, "hidden"), "Praça escondida.")}>Esconder</button>}
        <button className="secondary" onClick={() => { setEditing(m.id); setForm({ name: m.name, municipalityId: m.municipality_id ?? "", addressText: m.address_text ?? "", openingHours: m.opening_hours ?? "", photoUrl: m.photo_url ?? "", description: m.description ?? "" }); }}>Editar</button>
      </div>
    </div>)}
    <form className="card stack" onSubmit={e => { e.preventDefault(); const status = items.find(i => i.id === editing)?.status ?? "active"; void act(() => saveMarket(supabase(), { ...form, status }, editing ?? undefined), editing ? "Praça atualizada." : "Praça adicionada."); }}>
      <h2 style={{ margin: 0 }}>{editing ? "Editar praça" : "Adicionar praça"}</h2>
      <label>Nome<input value={form.name} onChange={set("name")} placeholder="Ex.: Praça do Kapango" /></label>
      <label>Município<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">Escolha…</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Bairro / morada<input value={form.addressText} onChange={set("addressText")} /></label>
      <label>Horário<input value={form.openingHours} onChange={set("openingHours")} placeholder="Ex.: Todos os dias, 06:00–18:00" /></label>
      <label>Fotografia (endereço https://)<input value={form.photoUrl} onChange={set("photoUrl")} /></label>
      <label>Descrição<textarea rows={3} value={form.description} onChange={set("description")} placeholder="O que se vende, como chegar…" /></label>
      <div className="row"><button>{editing ? "Guardar" : "Adicionar"}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}</div>
    </form>
  </section>;
}
