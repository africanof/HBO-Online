"use client";
import { useEffect, useState } from "react";
import { listProducts, listProductCategories, formatPrice, friendlyError } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";

type Option = { id: string; name: string };

export default function Loja() {
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? [])); void search(); }, []);
  async function search(e?: React.FormEvent) {
    e?.preventDefault(); setError("");
    const r = await listProducts(supabase(), { query: q, categoryId, municipalityId });
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>Loja</h1>
    <div className="row"><a className="btn" href="/carrinho">🛒 Carrinho</a><a className="btn secondary" href="/encomendas">📦 Encomendas</a><a className="btn secondary" href="/conta/produtos">Vender produtos</a></div>
    <form onSubmit={search} className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
      <label>Pesquisar<input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: arroz, telemóvel, cimento…" /></label>
      <label>Categoria<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button type="submit" style={{ alignSelf: "end" }}>Pesquisar</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {items?.length === 0 && <p>Ainda não há produtos nesta pesquisa.</p>}
    <section className="grid">{items?.map(p => <a key={p.id} href={"/loja/" + p.id} className="card" style={{ color: "inherit", textDecoration: "none" }}>
      {Array.isArray(p.media) && p.media[0] ? <img className="thumb" src={p.media[0]} alt="" /> : <div className="thumb" />}
      <strong style={{ fontSize: 19 }}>{p.name}</strong>
      <span className="price">{formatPrice(p.price, p.currency)}</span>
      <span>{p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} · {[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")}</span>
    </a>)}</section>
  </main>;
}
