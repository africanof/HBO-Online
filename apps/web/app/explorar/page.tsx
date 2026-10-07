"use client";
import { useEffect, useState } from "react";
import { searchClassifiedListings, saveClassifiedSearch, listProvinces, listMunicipalities, formatPrice, friendlyError, parsePrice,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, type ClassifiedSearchFilters } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";

type Option = { id: string; name: string };

export default function ExplorarPage() {
  const [q, setQ] = useState(""); const [purpose, setPurpose] = useState(""); const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState(""); const [provinceId, setProvinceId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [name, setName] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const [provinces, setProvinces] = useState<Option[]>([]); const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = supabase();
    void c.from("categories").select("id,name").eq("active", true).order("name").then(({ data }) => setCategories(data ?? []));
    void listProvinces(c).then(({ data }) => setProvinces((data ?? []) as Option[]));
    void search();
  }, []);
  useEffect(() => {
    if (!provinceId) { setMunicipalities([]); return; }
    void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[]));
  }, [provinceId]);

  function filters(): ClassifiedSearchFilters {
    return { query: q, purpose: (purpose || undefined) as any, listingType: (type || undefined) as any, categoryId: categoryId || undefined,
      provinceId: provinceId || undefined, municipalityId: municipalityId || undefined, minPrice: parsePrice(min), maxPrice: parsePrice(max) };
  }
  async function search(e?: React.FormEvent) {
    e?.preventDefault(); setError(""); setNotice(""); setBusy(true);
    const r = await searchClassifiedListings(supabase(), filters());
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data ?? []) as any[]);
  }
  async function save() {
    setError(""); setNotice("");
    const c = supabase(); const u = await c.auth.getUser();
    if (!u.data.user) { setError("Inicie sessão para guardar pesquisas."); return; }
    if (!name.trim()) { setError("Dê um nome à pesquisa."); return; }
    const r = await saveClassifiedSearch(c, name, filters());
    if (r.error) setError(friendlyError(r.error)); else { setName(""); setNotice("Pesquisa guardada. Vai receber alertas de novos anúncios."); }
  }

  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>Explorar classificados</h1>
    <form onSubmit={search} className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
      <label>Pesquisar<input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: casa, Hilux…" /></label>
      <label>Finalidade<select value={purpose} onChange={e => setPurpose(e.target.value)}><option value="">Todas</option>{PUBLISHABLE_PURPOSES.map(p => <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>)}</select></label>
      <label>Tipo<select value={type} onChange={e => setType(e.target.value)}><option value="">Todos</option>{Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Categoria<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Província<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setMunicipalityId(""); }}><option value="">Todas</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Município<select value={municipalityId} disabled={!provinceId} onChange={e => setMunicipalityId(e.target.value)}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Preço mínimo (Kz)<input value={min} onChange={e => setMin(e.target.value)} inputMode="numeric" /></label>
      <label>Preço máximo (Kz)<input value={max} onChange={e => setMax(e.target.value)} inputMode="numeric" /></label>
      <button type="submit" disabled={busy} style={{ alignSelf: "end" }}>{busy ? "A pesquisar…" : "Pesquisar"}</button>
    </form>
    <div className="row"><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome para guardar esta pesquisa" style={{ maxWidth: 360 }} /><button type="button" className="secondary" onClick={save}>⭐ Guardar pesquisa</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items?.length === 0 && <p>Nenhum anúncio encontrado. <a href="/classificados/publicar">Publique o primeiro!</a></p>}
    <section className="grid" aria-label="Resultados">
      {items?.map(x => <a key={x.id} href={`/classificados/${x.id}`} className="card" style={{ color: "inherit", textDecoration: "none" }}>
        {Array.isArray(x.media) && x.media[0] ? <img className="thumb" src={x.media[0]} alt="" /> : <div className="thumb" />}
        <strong style={{ fontSize: 19 }}>{x.title}</strong>
        <span className="price">{formatPrice(x.price, x.currency)}</span>
        <span>{LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? x.listing_type} · {PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose}</span>
      </a>)}
    </section>
  </main>;
}
