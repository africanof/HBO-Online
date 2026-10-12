"use client";
import { useEffect, useState } from "react";
import { loadWithCache, isOfflineError, searchClassifiedListings, saveClassifiedSearch, listProvinces, listMunicipalities, formatPrice, friendlyError, parsePrice, readExploreParams, timeAgo,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, type ClassifiedSearchFilters, listingPriceLabel, SALE_MODE_FILTERS, cardSaleTag, isFeatured } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../components/ItemCard";
import { OfflineBanner } from "../../components/Offline";
import { browserStore } from "../../components/Engage";

type Option = { id: string; name: string };
type F = { q: string; purpose: string; type: string; categoryId: string; provinceId: string; municipalityId: string; min: string; max: string; mode: string };
const EMPTY: F = { q: "", purpose: "", type: "", categoryId: "", provinceId: "", municipalityId: "", min: "", max: "", mode: "" };

export default function ExplorarPage() {
  const [f, setF] = useState<F>(EMPTY);
  const [name, setName] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const [provinces, setProvinces] = useState<Option[]>([]); const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = supabase();
    void c.from("categories").select("id,name").eq("active", true).order("name").then(({ data }) => setCategories(data ?? []));
    void listProvinces(c).then(({ data }) => setProvinces((data ?? []) as Option[]));
    const p = new URLSearchParams(window.location.search);
    const fromUrl = readExploreParams(k => p.get(k));
    const start = { ...EMPTY, q: fromUrl.query, type: fromUrl.listingType, purpose: fromUrl.purpose, mode: fromUrl.saleMode };
    setF(start); void search(start);
  }, []);
  useEffect(() => {
    if (!f.provinceId) { setMunicipalities([]); return; }
    void listMunicipalities(supabase(), f.provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[]));
  }, [f.provinceId]);

  function toFilters(v: F): ClassifiedSearchFilters {
    return { query: v.q, purpose: (v.purpose || undefined) as any, listingType: (v.type || undefined) as any, categoryId: v.categoryId || undefined,
      provinceId: v.provinceId || undefined, municipalityId: v.municipalityId || undefined, minPrice: parsePrice(v.min), maxPrice: parsePrice(v.max), saleMode: (v.mode || undefined) as ClassifiedSearchFilters["saleMode"] };
  }
  async function search(v = f) {
    setError(""); setNotice(""); setBusy(true);
    const fl = toFilters(v); const key = JSON.stringify(fl);
    // Guarda a última pesquisa para a mostrar quando a rede falhar.
    const r = await loadWithCache<{ key: string; items: any[] }>(browserStore, "explorar", async () => { const x = await searchClassifiedListings(supabase(), fl); return { data: x.data ? { key, items: x.data as any[] } : null, error: x.error }; });
    const usable = r.data && r.data.key === key ? r.data.items : null;
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: usable ? r.savedAt : null });
    setBusy(false);
    if (r.error && !isOfflineError(r.error)) setError(friendlyError(r.error)); else setItems(usable ?? []);
  }
  function quick(patch: Partial<F>) { const v = { ...f, ...patch }; setF(v); void search(v); }
  async function save() {
    setError(""); setNotice("");
    const c = supabase(); const u = await c.auth.getUser();
    if (!u.data.user) { setError("Inicie sessão para guardar pesquisas."); return; }
    if (!name.trim()) { setError("Dê um nome à pesquisa."); return; }
    const r = await saveClassifiedSearch(c, name, toFilters(f));
    if (r.error) setError(friendlyError(r.error)); else { setName(""); setNotice("Pesquisa guardada. Vai receber alertas de novos anúncios."); }
  }
  const set = (k: keyof F) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return <main className="stack">
    <a href="/">← Início</a>
    <h1>{f.q ? <>Resultados para «{f.q}»</> : f.type ? LISTING_TYPE_LABELS[f.type as keyof typeof LISTING_TYPE_LABELS] : f.purpose ? PURPOSE_LABELS[f.purpose as keyof typeof PURPOSE_LABELS] : "Classificados"}</h1>
    <nav className="chips" aria-label="Finalidade">
      {([["", "Tudo"], ...Object.entries(PURPOSE_LABELS)] as [string, string][]).map(([v, l]) => <button key={v} type="button" className={"chip" + (f.purpose === v ? " on" : "")} aria-pressed={f.purpose === v} onClick={() => quick({ purpose: v })}>{l}</button>)}
    </nav>
    <nav className="chips" aria-label="Como vende">
      <span className="muted" style={{ alignSelf: "center", fontWeight: 700 }}>Como vende:</span>
      {([{ value: "", label: "Todos" }, ...SALE_MODE_FILTERS] as { value: string; label: string }[]).map(m => <button key={m.value} type="button" className={"chip" + (f.mode === m.value ? " on" : "")} aria-pressed={f.mode === m.value} onClick={() => quick({ mode: m.value })}>{m.label}</button>)}
    </nav>
    <div className="results">
      <form className="filters card" onSubmit={e => { e.preventDefault(); void search(); }}>
        <div className="row" style={{ justifyContent: "space-between" }}><h2>Filtros</h2><button type="button" className="secondary" onClick={() => setShowFilters(!showFilters)} style={{ minHeight: 40, padding: "4px 14px" }} aria-expanded={showFilters}>{showFilters ? "Menos" : "Mais"}</button></div>
        <label>Pesquisar<input value={f.q} onChange={set("q")} placeholder="Ex.: casa, Hilux…" /></label>
        <label>Tipo<select value={f.type} onChange={set("type")}><option value="">Todos</option>{Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Categoria<select value={f.categoryId} onChange={set("categoryId")}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label style={{ flex: 1 }}>Preço mín.<input value={f.min} onChange={set("min")} inputMode="numeric" placeholder="Kz" /></label>
          <label style={{ flex: 1 }}>Preço máx.<input value={f.max} onChange={set("max")} inputMode="numeric" placeholder="Kz" /></label>
        </div>
        {showFilters && <>
          <label>Província<select value={f.provinceId} onChange={e => setF({ ...f, provinceId: e.target.value, municipalityId: "" })}><option value="">Todas</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Município<select value={f.municipalityId} disabled={!f.provinceId} onChange={set("municipalityId")}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </>}
        <button type="submit" disabled={busy}>{busy ? "A pesquisar…" : "Aplicar filtros"}</button>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
        <label>Guardar esta pesquisa<input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Casas no Huambo" /></label>
        <button type="button" className="secondary" onClick={save}>⭐ Guardar e receber alertas</button>
      </form>
      <section className="stack" aria-label="Resultados">
        <div className="results-bar"><strong>{items === null ? "A carregar…" : `${items.length} resultado(s)`}</strong><a href="/classificados/publicar">+ Publicar anúncio</a></div>
        <OfflineBanner show={offline.on} savedAt={offline.at} />
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="ok" role="status">{notice}</p>}
        {items?.length === 0 && <div className="card"><strong>Nenhum anúncio encontrado.</strong><span>Experimente outras palavras ou menos filtros, ou <a href="/classificados/publicar">publique o primeiro!</a></span></div>}
        <div className="results-grid">
          {items?.map(x => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={`/classificados/${x.id}`} media={x.media} title={x.title} price={listingPriceLabel(x)}
            icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? "Leilão" : x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : cardSaleTag(x)} tagRed={x.purpose === "auction"}
            meta={[LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS], timeAgo(x.published_at ?? x.created_at)].filter(Boolean).join(" · ")} />)}
        </div>
      </section>
    </div>
  </main>;
}
