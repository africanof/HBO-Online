"use client";
import { useEffect, useState } from "react";
import { listProducts, listProductCategories, formatPrice, friendlyError } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";
import { ItemCard } from "../../components/ItemCard";

type Option = { id: string; name: string };

export default function Loja() {
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? []));
    const start = new URLSearchParams(window.location.search).get("q") ?? "";
    setQ(start); void search(undefined, { q: start });
  }, []);
  async function search(e?: React.FormEvent, over: { q?: string; categoryId?: string } = {}) {
    e?.preventDefault(); setError("");
    const r = await listProducts(supabase(), { query: over.q ?? q, categoryId: over.categoryId ?? categoryId, municipalityId });
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← Início</a>
    <div className="results-bar"><h1 style={{ margin: 0 }}>{q ? <>Loja: «{q}»</> : "Loja"}</h1>
      <div className="row"><a className="btn" href="/carrinho">🛒 Carrinho</a><a className="btn secondary" href="/encomendas">📦 Encomendas</a><a className="btn secondary" href="/conta/produtos">Vender produtos</a></div></div>
    {categories.length > 0 && <nav className="chips" aria-label="Categorias">
      {[{ id: "", name: "Tudo" }, ...categories].map(c => <button key={c.id} type="button" className={"chip" + (categoryId === c.id ? " on" : "")} aria-pressed={categoryId === c.id} onClick={() => { setCategoryId(c.id); void search(undefined, { categoryId: c.id }); }}>{c.name}</button>)}
    </nav>}
    <div className="results">
      <form onSubmit={search} className="filters card">
        <h2>Filtros</h2>
        <label>Pesquisar<input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: arroz, telemóvel, cimento…" /></label>
        <label>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <button type="submit">Aplicar filtros</button>
      </form>
      <section className="stack" aria-label="Produtos">
        <strong>{items === null ? "A carregar…" : `${items.length} produto(s)`}</strong>
        {error && <p className="error" role="alert">{error}</p>}
        {items?.length === 0 && <div className="card"><strong>Ainda não há produtos nesta pesquisa.</strong><a href="/conta/produtos">Venda os seus produtos aqui →</a></div>}
        <div className="results-grid">{items?.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)}
          tag={p.stock > 0 ? undefined : "Esgotado"} meta={[p.stock > 0 ? `${p.stock} em stock` : null, p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}</div>
      </section>
    </div>
  </main>;
}
