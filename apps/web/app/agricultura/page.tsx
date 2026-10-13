"use client";
import { useEffect, useState } from "react";
import { listAgroListings, listingPriceLabel, readAgro, agroSummary, friendlyError, timeAgo, isFeatured, AGRO_CATEGORIES, type AgroCategory } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ItemCard } from "../../components/ItemCard";

/** Agricultura e campo: colheitas, gado, insumos e serviços agrícolas do Huambo. */
export default function Agricultura() {
  const [cat, setCat] = useState<AgroCategory | "">(""); const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(c = cat, query = q) {
    setError("");
    const r = await listAgroListings(supabase(), { category: c, query });
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data);
  }
  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tipo") as AgroCategory | null; const c = t && AGRO_CATEGORIES.some(x => x.value === t) ? t : ""; setCat(c); void load(c, ""); }, []);
  return <main className="stack">
    <a href="/">← Início</a>
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>🌾 Agricultura e campo</h1><p>Milho, batata, feijão, hortícolas, gado, sementes e adubos, direto de quem produz no Huambo. Venda a granel por saco, quilo, tonelada ou cabeça.</p></div>
      <a className="btn" href="/classificados/publicar?campo=1">+ Vender produtos do campo</a>
    </section>
    <form onSubmit={e => { e.preventDefault(); void load(); }} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: batata, milho, cabritos…" style={{ maxWidth: 420 }} aria-label="Procurar no campo" />
      <button type="submit">Procurar</button>
    </form>
    <div className="row" role="radiogroup" aria-label="Tipo de produto do campo">
      <button type="button" role="radio" aria-checked={cat === ""} className={"chip" + (cat === "" ? " on" : "")} onClick={() => { setCat(""); void load("", q); }}>Tudo</button>
      {AGRO_CATEGORIES.map(c => <button key={c.value} type="button" role="radio" aria-checked={cat === c.value} className={"chip" + (cat === c.value ? " on" : "")} onClick={() => { setCat(c.value); void load(c.value, q); }}>{c.icon} {c.label.replace(/ \(.*\)$/, "")}</button>)}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null && !error && <p>A carregar…</p>}
    {items?.length === 0 && <div className="card"><strong>Ainda não há anúncios{cat ? " deste tipo" : ""}{q ? ` com «${q}»` : ""}.</strong><a href="/classificados/publicar?campo=1">Seja o primeiro a anunciar →</a></div>}
    <div className="results-grid">{items?.map(x => { const a = readAgro(x.attributes); const c = AGRO_CATEGORIES.find(k => k.value === a?.category);
      return <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
        price={listingPriceLabel(x)} icon={c?.icon ?? "🌾"} tag={x.purpose === "wanted" ? "Procura" : undefined}
        meta={[a ? agroSummary(a).split(" · ").slice(1).join(" · ") : "", timeAgo(x.created_at)].filter(Boolean).join(" · ")} />; })}</div>
  </main>;
}
